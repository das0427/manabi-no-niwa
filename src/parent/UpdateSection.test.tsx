import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import * as db from '../core/storage/index';
import type { UpdaterStatus, UpdaterView } from '../core/offline/updater';

/** 「アプリの更新」の節と保護者画面の上の知らせ（設計 6.2 節の表）。updater.ts は差し替える */
const m = vi.hoisted(() => ({
  view: null as unknown as UpdaterView,
  requestApply: vi.fn(() => Promise.resolve({ ok: true })),
  requestCancel: vi.fn(() => Promise.resolve({ ok: true })),
  requestCheck: vi.fn(() => Promise.resolve({ ok: true })),
  setAutoCheck: vi.fn(() => Promise.resolve({ ok: true })),
  navigate: vi.fn(),
  offline: { updateReady: false },
}));

vi.mock('../core/offline/updater', () => ({
  useUpdater: () => m.view,
  requestApply: m.requestApply,
  requestCancel: m.requestCancel,
  requestCheck: m.requestCheck,
  setAutoCheck: m.setAutoCheck,
  startUpdater: vi.fn(),
}));

vi.mock('../app/router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/router')>()),
  navigate: m.navigate,
}));

vi.mock('../core/offline/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/offline/index')>()),
  useOfflineState: () => ({
    supported: true,
    status: 'ready',
    progress: null,
    updateReady: m.offline.updateReady,
    version: 'v1',
    error: null,
  }),
}));

const { UpdateNotice, UpdateSection, updateReasonText } = await import('./UpdateSection');
const { AboutTab } = await import('./AboutTab');
const { default: ParentApp } = await import('./index');
const { formatDateTime } = await import('./util');

function status(over: Partial<UpdaterStatus> = {}): UpdaterStatus {
  return {
    schema: 1,
    supported: true,
    token: 'a'.repeat(32),
    server: { pid: 1, startedAt: '2026-11-20T01:23:45Z' },
    current: { version: '2.1.0' },
    settings: { autoCheck: true },
    disk: { freeBytes: 50 * 1024 ** 3 },
    check: { state: 'ok', at: '2026-11-20T01:24:00Z', error: null },
    latest: null,
    update: {
      phase: 'idle',
      targetVersion: null,
      progress: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    },
    lastApplied: null,
    ...over,
  };
}

const NEWER = {
  version: '2.2.0',
  date: '2026-11-20',
  notes: ['小学4年の算数に「がい数」を足しました', 'おえかきの消しゴムが<b>太く</b>なりました'],
  newer: true,
  installable: true,
  blockedReason: null,
  downloadBytes: 178257920,
  needBytes: 636870912,
  parts: [{ kind: 'main', bytes: 178257920, changed: true }],
};

function setView(over: Partial<UpdaterView> = {}): void {
  m.view = {
    available: true,
    status: status(),
    flow: 'none',
    flowError: null,
    swProgress: null,
    packs: null,
    ...over,
  };
}

function withUpdate(patch: Partial<UpdaterStatus['update']>, rest: Partial<UpdaterStatus> = {}) {
  return status({ ...rest, update: { ...status().update, ...patch } });
}

const text = (id: string): string => screen.getByTestId(id).textContent ?? '';

beforeEach(() => {
  setView();
  m.offline.updateReady = false;
  m.requestApply.mockClear();
  m.requestCancel.mockClear();
  m.requestCheck.mockClear();
  m.setAutoCheck.mockClear();
  m.navigate.mockClear();
});
afterEach(cleanup);

describe('窓口が無いとき', () => {
  it('更新の節も知らせも出さない（何も描かない）', () => {
    setView({ available: false, status: null });
    const a = render(<UpdateSection />);
    expect(a.container.innerHTML).toBe('');
    const b = render(<UpdateNotice />);
    expect(b.container.innerHTML).toBe('');
  });

  it('このアプリについて: 今までの文のまま。Service Worker の「更新する」も今までどおり', () => {
    setView({ available: false, status: null });
    m.offline.updateReady = true;
    render(<AboutTab />);
    expect(screen.queryByTestId('update-section')).toBeNull();
    expect(text('about-privacy')).toBe(
      '広告・外部への通信・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。',
    );
    expect(screen.getByTestId('apply-update')).toBeTruthy();
  });
});

describe('いつもの表示', () => {
  it('いまの版と、確認の状態', () => {
    render(<UpdateSection />);
    expect(screen.getByTestId('update-section').textContent).toContain('アプリの更新');
    expect(text('update-current')).toBe('いまの版: 2.1.0');
    const at = formatDateTime(new Date('2026-11-20T01:24:00Z').getTime());
    expect(text('update-check-status')).toContain(`${at} に確かめました`);
    expect(text('update-check-status')).toContain('新しい版はありません');
    expect(screen.queryByTestId('update-available')).toBeNull();
    expect(screen.queryByTestId('update-error')).toBeNull();
    expect(screen.queryByTestId('update-done')).toBeNull();
  });

  const checks: [string, Partial<UpdaterStatus['check']>, string][] = [
    ['never', { state: 'never', at: null }, 'まだ確かめていません'],
    ['checking', { state: 'checking', at: null }, '新しい版があるか確かめています…'],
    [
      'offline',
      { state: 'offline' },
      'インターネットにつながっていないため、確かめられませんでした（つながっているときに、また確かめます）',
    ],
    [
      'error(http)',
      { state: 'error', error: { code: 'http', detail: 'HTTP 503' } },
      '確かめられませんでした（配布元（GitHub）から情報を取得できませんでした）',
    ],
    [
      'error(その他)',
      { state: 'error', error: { code: 'internal', detail: 'KeyError' } },
      '確かめられませんでした（KeyError）',
    ],
  ];
  it.each(checks)('確認の状態 %s', (_name, check, expected) => {
    setView({ status: status({ check: { ...status().check, ...check } }) });
    render(<UpdateSection />);
    expect(text('update-check-status')).toBe(expected);
  });

  it('確認の結果が ok でも、新しい版があれば「新しい版はありません」とは出さない', () => {
    setView({ status: status({ latest: NEWER }) });
    render(<UpdateSection />);
    expect(text('update-check-status')).not.toContain('新しい版はありません');
  });
});

describe('新しい版があるとき', () => {
  beforeEach(() => setView({ status: status({ latest: NEWER }) }));

  it('版・公開日・変わった点（文字として）・大きさ・更新するボタンと注意', () => {
    render(<UpdateSection />);
    const box = screen.getByTestId('update-available');
    expect(box.className).toContain('p-alert');
    expect(box.textContent).toContain('新しい版 2.2.0 があります（公開日 2026-11-20）');
    const notes = screen.getByTestId('update-notes').querySelectorAll('li');
    expect(notes).toHaveLength(2);
    // HTML として解釈しない
    expect(notes[1]!.textContent).toBe('おえかきの消しゴムが<b>太く</b>なりました');
    expect(notes[1]!.querySelector('b')).toBeNull();
    expect(text('update-size')).toBe('ダウンロードする大きさ: 約 170.0 MB（変わった部分だけ）');
    expect(screen.getByTestId('update-apply').className).toContain('p-primary');
    expect(screen.getByTestId('update-apply').textContent).toBe('更新する');
    expect(box.textContent).toContain(
      '押すと、ダウンロード・確認・切り替え・教材の取り直しまで自動で行います。終わるとアプリを1回読み込み直します（そのあと保護者画面を開き直すと結果が見られます）。学習の記録は消えません。お子さんが遊んでいないときに押してください。',
    );
    expect(screen.queryByTestId('update-disk-warning')).toBeNull();
    expect(screen.queryByTestId('update-blocked')).toBeNull();
  });

  it('変わった点が無ければ箇条書きは出さない。1 GB 以上は GB で出す', () => {
    setView({
      status: status({ latest: { ...NEWER, notes: [], downloadBytes: 1.3 * 1024 ** 3 } }),
    });
    render(<UpdateSection />);
    expect(screen.queryByTestId('update-notes')).toBeNull();
    expect(text('update-size')).toContain('約 1.3 GB');
  });

  it('［更新する］は requestApply(新しい版) を呼ぶ', () => {
    render(<UpdateSection />);
    fireEvent.click(screen.getByTestId('update-apply'));
    expect(m.requestApply).toHaveBeenCalledWith('2.2.0');
  });

  it('空きが足りないかもしれないときは警告を出す（ボタンは押せる）', () => {
    setView({
      status: status({
        latest: NEWER,
        disk: { freeBytes: 100 * 1024 * 1024 },
      }),
    });
    render(<UpdateSection />);
    expect(text('update-disk-warning')).toBe(
      '空き容量が足りないかもしれません（あと約 0.5 GB 必要です）',
    );
    const apply = screen.getByTestId('update-apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
  });

  it('自動では入れられない版（newer && !installable）は案内だけ', () => {
    setView({
      status: status({
        latest: { ...NEWER, installable: false, blockedReason: 'min-version' },
      }),
    });
    render(<UpdateSection />);
    expect(text('update-blocked')).toBe(
      '新しい版 2.2.0 があります。この版からは自動で更新できません。README の「新しい版に更新するとき」の手順で入れ直してください。',
    );
    expect(screen.queryByTestId('update-available')).toBeNull();
    expect(screen.queryByTestId('update-apply')).toBeNull();
  });
});

describe('作業中', () => {
  const working: [string, UpdaterView, string, boolean][] = [
    [
      'downloading',
      {
        available: true,
        status: withUpdate(
          {
            phase: 'downloading',
            targetVersion: '2.2.0',
            progress: {
              doneBytes: 80 * 1024 * 1024,
              totalBytes: 178257920,
              part: 'main',
              partIndex: 1,
              partCount: 1,
            },
          },
          { latest: NEWER },
        ),
        flow: 'server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      'ダウンロードしています 47%（80.0 MB / 170.0 MB）',
      true,
    ],
    [
      'extracting',
      {
        available: true,
        status: withUpdate({
          phase: 'extracting',
          targetVersion: '2.2.0',
          progress: { doneBytes: 30, totalBytes: 100, part: 'main', partIndex: 1, partCount: 1 },
        }),
        flow: 'server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '展開しています 30%',
      true,
    ],
    [
      'testing',
      {
        available: true,
        status: withUpdate({ phase: 'testing', targetVersion: '2.2.0' }),
        flow: 'server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '新しい版を確かめています',
      false,
    ],
    [
      'switching',
      {
        available: true,
        status: withUpdate({ phase: 'switching', targetVersion: '2.2.0' }),
        flow: 'server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '切り替えています',
      false,
    ],
    [
      'restarting',
      {
        available: true,
        status: withUpdate({ phase: 'restarting', targetVersion: '2.2.0' }),
        flow: 'waiting-server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '配信を起動し直しています',
      false,
    ],
    [
      'waiting-server（読めない）',
      {
        available: true,
        status: status(),
        flow: 'waiting-server',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '配信を起動し直しています',
      false,
    ],
    [
      'sw',
      {
        available: true,
        status: status(),
        flow: 'sw',
        flowError: null,
        swProgress: { done: 6, total: 10 },
        packs: null,
      },
      'アプリの新しい版を準備しています 60%',
      false,
    ],
    [
      'reloading',
      {
        available: true,
        status: status(),
        flow: 'reloading',
        flowError: null,
        swProgress: null,
        packs: null,
      },
      '読み込み直します',
      false,
    ],
    [
      'packs',
      {
        available: true,
        status: status(),
        flow: 'packs',
        flowError: null,
        swProgress: null,
        packs: { done: 3, total: 5, doneBytes: 30, totalBytes: 100 },
      },
      '教材を取り直しています（3 / 5）',
      false,
    ],
  ];

  it.each(working)('%s: 段階の文・棒・この画面を離れても続く', (_name, view, expected, cancel) => {
    m.view = view;
    render(<UpdateSection />);
    expect(text('update-progress-text')).toBe(expected);
    expect(screen.getByTestId('update-progress').tagName).toBe('PROGRESS');
    expect(text('update-leave-note')).toBe('この画面を離れても続きます');
    expect(screen.queryByTestId('update-cancel') !== null).toBe(cancel);
    // 作業中は「更新する」を出さず、「今すぐ確かめる」も押せない
    expect(screen.queryByTestId('update-available')).toBeNull();
    expect((screen.getByTestId('update-check-now') as HTMLButtonElement).disabled).toBe(true);
  });

  it('ダウンロード中の棒は進み具合を持つ。中止するは requestCancel を呼ぶ', () => {
    m.view = working[0]![1];
    render(<UpdateSection />);
    const bar = screen.getByTestId('update-progress') as HTMLProgressElement;
    expect(bar.value).toBe(80 * 1024 * 1024);
    expect(bar.max).toBe(178257920);
    fireEvent.click(screen.getByTestId('update-cancel'));
    expect(m.requestCancel).toHaveBeenCalledTimes(1);
  });

  it('進み具合が分からない段階の棒は、値を持たない（動き続ける棒）', () => {
    m.view = working[2]![1];
    render(<UpdateSection />);
    expect(screen.getByTestId('update-progress').hasAttribute('value')).toBe(false);
  });

  it('流れが無くても、配信が作業中なら作業中の表示（別の画面で押した）', () => {
    m.view = {
      available: true,
      status: withUpdate({
        phase: 'downloading',
        targetVersion: '2.2.0',
        progress: { doneBytes: 50, totalBytes: 100, part: 'main', partIndex: 1, partCount: 1 },
      }),
      flow: 'none',
      flowError: null,
      swProgress: null,
      packs: null,
    };
    render(<UpdateSection />);
    expect(text('update-progress-text')).toContain('ダウンロードしています 50%');
  });
});

describe('失敗', () => {
  const failedView = (
    code: string,
    st: UpdaterStatus = status({ latest: NEWER }),
  ): UpdaterView => ({
    available: true,
    status: st,
    flow: 'failed',
    flowError: code,
    swProgress: null,
    packs: null,
  });

  it('理由の文・いまの版はそのまま使える・もう一度ためす（requestApply(latest.version)）', () => {
    m.view = failedView(
      'sha256-mismatch',
      withUpdate(
        {
          phase: 'failed',
          error: { code: 'sha256-mismatch', detail: 'expected abc got def' },
          targetVersion: '2.2.0',
        },
        { latest: NEWER },
      ),
    );
    render(<UpdateSection />);
    const err = screen.getByTestId('update-error');
    expect(err.className).toContain('p-error');
    expect(err.textContent).toContain(
      '更新できませんでした: 取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    );
    expect(text('update-error-detail')).toBe('expected abc got def');
    expect(err.textContent).toContain('いまの版はそのまま使えます');
    // 失敗のあいだは、更新するボタンを二重に出さない
    expect(screen.queryByTestId('update-apply')).toBeNull();
    fireEvent.click(screen.getByTestId('update-retry'));
    expect(m.requestApply).toHaveBeenCalledWith('2.2.0');
  });

  const reasons: [string, string][] = [
    [
      'offline',
      'インターネットにつながっていないか、GitHub に接続できませんでした。つながってから「もう一度ためす」を押してください（取得した分は残っていて、続きから始めます）。',
    ],
    [
      'http',
      '配布元（GitHub）から取得できませんでした。新しい版の準備中かもしれません。しばらくしてからお試しください。',
    ],
    [
      'not-found',
      '配布元（GitHub）から取得できませんでした。新しい版の準備中かもしれません。しばらくしてからお試しください。',
    ],
    [
      'redirect-host',
      '配布元への接続を安全に確かめられなかったため、中止しました。ネットワークの設定（プロキシなど）をご確認ください。',
    ],
    [
      'tls',
      '配布元への接続を安全に確かめられなかったため、中止しました。ネットワークの設定（プロキシなど）をご確認ください。',
    ],
    [
      'bad-manifest',
      '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    ],
    [
      'size-mismatch',
      '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    ],
    [
      'sha256-mismatch',
      '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    ],
    [
      'unsafe-zip',
      '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    ],
    [
      'content-check',
      '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。',
    ],
    ['self-test', '新しい版を動かす準備で問題が見つかったため、元の版のままにしました。'],
    ['switch-failed', '新しい版を動かす準備で問題が見つかったため、元の版のままにしました。'],
    ['switch-broken', 'アプリのファイルの切り替えで問題が起き、元に戻せませんでした。'],
    ['interrupted', '前回の更新が途中で止まりました。もう一度押すと続きから始めます。'],
    [
      'version-changed',
      'さらに新しい版が出ていました。表示を新しくしたので、もう一度「更新する」を押してください。',
    ],
    ['busy', 'ほかの更新が進んでいます。終わるまでお待ちください。'],
    ['blocked', 'この版からは自動で更新できません。README の手順で入れ直してください。'],
    [
      'server-timeout',
      '配信が起動し直しませんでした。アプリの窓を閉じて、デスクトップのアイコンから開き直してください。',
    ],
    ['sw-failed', 'アプリの新しい版の準備に失敗しました。アプリを開き直すと、もう一度準備します。'],
    [
      'sw-mismatch',
      '読み込み直しても新しい版に切り替わりませんでした。アプリの窓を全部閉じて、開き直してください。',
    ],
    ['something-new', '更新できませんでした。'],
  ];
  it.each(reasons)('理由の文 %s', (code, sentence) => {
    m.view = failedView(code);
    render(<UpdateSection />);
    expect(text('update-error')).toContain(
      code === 'something-new'
        ? '更新できませんでした: 更新できませんでした。'
        : `更新できませんでした: ${sentence}`,
    );
  });

  it('元に戻せなかった（switch-broken）ときは「いまの版はそのまま使えます」と言わず、次にすることを出す', () => {
    m.view = failedView('switch-broken');
    render(<UpdateSection />);
    const err = screen.getByTestId('update-error');
    expect(err.textContent).not.toContain('いまの版はそのまま使えます');
    expect(text('update-error-next')).toBe(
      '「もう一度ためす」を押すと、前の版に戻してから入れ直します。直らないときは、README の「新しい版に更新するとき」の手順で入れ直してください（学習の記録は消えません）。',
    );
    fireEvent.click(screen.getByTestId('update-retry'));
    expect(m.requestApply).toHaveBeenCalledWith('2.2.0');
    // ほかの失敗では今までどおり
    cleanup();
    m.view = failedView('switch-failed');
    render(<UpdateSection />);
    expect(screen.getByTestId('update-error').textContent).toContain('いまの版はそのまま使えます');
    expect(screen.queryByTestId('update-error-next')).toBeNull();
  });

  it('空き容量不足は、足りない大きさ（必要な大きさ − 今の空き）を GB で出す', () => {
    m.view = failedView(
      'disk-full',
      withUpdate(
        {
          phase: 'failed',
          error: { code: 'disk-full', detail: 'free 1', needBytes: 1.6 * 1024 ** 3 },
        },
        { latest: NEWER, disk: { freeBytes: 0.3 * 1024 ** 3 } },
      ),
    );
    render(<UpdateSection />);
    expect(text('update-error')).toContain(
      '空き容量が足りません（あと約 1.3 GB 必要です）。不要なファイルを消してから、もう一度お試しください。',
    );
    expect(updateReasonText('disk-full', 0.01 * 1024 ** 3)).toContain('約 0.1 GB');
  });

  it('空き容量不足のあと空きが増えていれば、足りない大きさは出さない', () => {
    m.view = failedView(
      'disk-full',
      withUpdate(
        {
          phase: 'failed',
          error: { code: 'disk-full', detail: 'free 1', needBytes: 1.3 * 1024 ** 3 },
        },
        { latest: NEWER },
      ),
    );
    render(<UpdateSection />);
    expect(text('update-error')).toContain(
      '空き容量が足りません。不要なファイルを消してから、もう一度お試しください。',
    );
    expect(updateReasonText('disk-full', 0)).not.toContain('GB');
  });

  it('アプリ側の失敗（sw-failed）でも、もう一度ためすで requestApply を呼ぶ。最新が無ければ今の版で', () => {
    m.view = failedView('sw-failed', status({ current: { version: '2.2.0' } }));
    render(<UpdateSection />);
    expect(screen.queryByTestId('update-error-detail')).toBeNull();
    fireEvent.click(screen.getByTestId('update-retry'));
    expect(m.requestApply).toHaveBeenCalledWith('2.2.0');
  });

  it('配信に前回の失敗が残っていて、入れられる新しい版があるときも失敗を出す', () => {
    setView({
      status: withUpdate(
        {
          phase: 'failed',
          error: { code: 'offline', detail: 'timed out' },
          targetVersion: '2.2.0',
        },
        { latest: NEWER },
      ),
    });
    render(<UpdateSection />);
    expect(text('update-error')).toContain('インターネットにつながっていないか');
    expect(text('update-error-detail')).toBe('timed out');
    // 新しい版が無いなら、古い失敗は出さない
    cleanup();
    setView({
      status: withUpdate({ phase: 'failed', error: { code: 'offline', detail: 'x' } }),
    });
    render(<UpdateSection />);
    expect(screen.queryByTestId('update-error')).toBeNull();
  });
});

describe('更新したあと', () => {
  it('lastApplied の版が今の版なら「○ に更新しました」', () => {
    setView({
      status: status({
        current: { version: '2.2.0' },
        lastApplied: { version: '2.2.0', from: '2.1.0', at: '2026-11-20T01:30:00Z' },
      }),
    });
    render(<UpdateSection />);
    const at = formatDateTime(new Date('2026-11-20T01:30:00Z').getTime());
    expect(text('update-done')).toBe(`2.2.0 に更新しました（${at}）`);
  });

  it('lastApplied が今の版でなければ出さない', () => {
    setView({
      status: status({
        lastApplied: { version: '2.0.5', from: '2.0.4', at: '2026-11-01T00:00:00Z' },
      }),
    });
    render(<UpdateSection />);
    expect(screen.queryByTestId('update-done')).toBeNull();
  });
});

describe('自動の確認と「今すぐ確かめる」', () => {
  it('チェックボックスは設定を映し、押すと setAutoCheck を呼ぶ', async () => {
    render(<UpdateSection />);
    const box = screen.getByTestId('update-autocheck') as HTMLInputElement;
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(true);
    expect(screen.getByTestId('update-section').textContent).toContain(
      '起動したときに、新しい版があるかを自動で確かめる（インターネットにつながっているときだけ）',
    );
    fireEvent.click(box);
    expect(m.setAutoCheck).toHaveBeenCalledWith(false);
    await waitFor(() => expect(m.setAutoCheck).toHaveBeenCalledTimes(1));
  });

  it('オフのときはチェックが外れている。押すとオンにする', () => {
    setView({ status: status({ settings: { autoCheck: false } }) });
    render(<UpdateSection />);
    const box = screen.getByTestId('update-autocheck') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(m.setAutoCheck).toHaveBeenCalledWith(true);
  });

  it('今すぐ確かめる: requestCheck を呼ぶ。確認中は押せない', () => {
    render(<UpdateSection />);
    const btn = screen.getByTestId('update-check-now') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(m.requestCheck).toHaveBeenCalledTimes(1);
    cleanup();
    setView({ status: status({ check: { state: 'checking', at: null, error: null } }) });
    render(<UpdateSection />);
    expect((screen.getByTestId('update-check-now') as HTMLButtonElement).disabled).toBe(true);
  });

  it('GitHub への接続についての注意', () => {
    render(<UpdateSection />);
    expect(screen.getByTestId('update-section').textContent).toContain(
      '更新を確かめるときと取得するときだけ、GitHub（github.com）に接続します。送るのはアプリの名前だけで、記録や個人の情報は送りません。',
    );
  });
});

describe('保護者画面の上の知らせ', () => {
  it('新しい版があれば出す。［くわしく］は「このアプリについて」へ', () => {
    setView({ status: status({ latest: NEWER }) });
    render(<UpdateNotice />);
    expect(text('parent-update-notice')).toContain('新しい版 2.2.0 があります');
    fireEvent.click(screen.getByTestId('parent-update-notice-open'));
    expect(m.navigate).toHaveBeenCalledWith({ name: 'parent', tab: 'about' }, { force: true });
  });

  it('作業中は「アプリを更新しています…」だけ', () => {
    setView({ status: status({ latest: NEWER }), flow: 'sw', swProgress: { done: 1, total: 2 } });
    render(<UpdateNotice />);
    expect(text('parent-update-notice')).toBe('アプリを更新しています…');
    expect(screen.queryByTestId('parent-update-notice-open')).toBeNull();
  });

  it('新しい版が無い・自動では入れられない・窓口が無いときは出さない', () => {
    for (const v of [
      { status: status() },
      { status: status({ latest: { ...NEWER, newer: false } }) },
      { status: status({ latest: { ...NEWER, installable: false, blockedReason: 'schema' } }) },
      { available: false, status: null },
    ] as Partial<UpdaterView>[]) {
      setView(v);
      const { container, unmount } = render(<UpdateNotice />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });
});

describe('このアプリについて・保護者画面への組み込み', () => {
  it('窓口があるとき: 最初の節の次に「アプリの更新」。最初の節の文が変わる', () => {
    setView({ status: status({ latest: NEWER }) });
    render(<AboutTab />);
    expect(text('about-privacy')).toBe(
      '広告・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。外部への通信は、アプリの更新を確かめるときと取得するときだけです（下の「アプリの更新」で自動の確認を止められます）。',
    );
    const sections = [...screen.getByTestId('tab-about').querySelectorAll('section')];
    expect(sections[0]!.querySelector('h2')?.textContent).toBe('このアプリについて');
    expect(sections[1]!.getAttribute('data-testid')).toBe('update-section');
    expect(sections[2]!.querySelector('h2')?.textContent).toBe('オフラインの準備');
  });

  it('窓口があって流れが動いているあいだは、オフラインの準備の「更新する」を隠す', () => {
    m.offline.updateReady = true;
    setView({ flow: 'none' });
    const r = render(<AboutTab />);
    expect(screen.getByTestId('apply-update')).toBeTruthy();
    r.unmount();
    for (const flow of ['server', 'sw', 'reloading', 'packs', 'failed'] as const) {
      setView({ flow, flowError: flow === 'failed' ? 'sw-failed' : null });
      const x = render(<AboutTab />);
      expect(screen.queryByTestId('apply-update')).toBeNull();
      x.unmount();
    }
  });

  describe('ParentApp', () => {
    beforeEach(async () => {
      await db.openStorage();
      await db.deleteAllData();
    });

    it('タブの上に知らせが出る', async () => {
      setView({ status: status({ latest: NEWER }) });
      render(
        <AppStateProvider>
          <ParentApp tab="records" />
        </AppStateProvider>,
      );
      const notice = await screen.findByTestId('parent-update-notice');
      const tabs = screen.getByRole('tablist');
      expect(notice.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice.textContent).toContain('新しい版 2.2.0 があります');
    });

    it('窓口が無ければ知らせは出ない', async () => {
      setView({ available: false, status: null });
      render(
        <AppStateProvider>
          <ParentApp tab="records" />
        </AppStateProvider>,
      );
      await screen.findByRole('tablist');
      expect(screen.queryByTestId('parent-update-notice')).toBeNull();
    });
  });
});
