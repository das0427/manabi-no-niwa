import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStateValue } from '../app/AppState';
import { audio } from '../core/audio/index';
import { defaultSettings, type ChildSettings, type Profile } from '../core/types';
import type { ChoiceItem, UnitSpec } from '../curriculum/types';
import { PACK_UNAVAILABLE_PARENT_TEXT, PackUnavailableError } from '../packs/loader';

/**
 * 単元の枠（UnitRunner.tsx）の使いやすさの直し（FX01・FX10・FX12）。
 * アプリの状態と画面遷移は偽物にし、保存は本物（fake-indexeddb）を使う。
 * 操作の流れの全体は e2e/ux-f1.spec.ts。
 */
const h = vi.hoisted(() => ({
  app: {} as unknown,
  navigate: vi.fn(),
  loadPack: vi.fn(),
}));
vi.mock('../app/AppState', () => ({ useApp: () => h.app }));
vi.mock('../app/router', () => ({ navigate: h.navigate }));
vi.mock('../packs/loader', async (orig) => ({
  ...(await orig<typeof import('../packs/loader')>()),
  loadPack: h.loadPack,
}));
// 目安の判定はふだんは本物。判定に失敗したときの試験だけ、1回だけ失敗させる
vi.mock('../core/session/sessionTime', async (orig) => {
  const m = await orig<typeof import('../core/session/sessionTime')>();
  return { ...m, isSessionTimeUp: vi.fn(m.isSessionTimeUp) };
});

import { isSessionTimeUp } from '../core/session/sessionTime';
import * as db from '../core/storage/index';
import { UnitRound, UnitRunner } from './UnitRunner';

const PID = 'p-test';
const profile: Profile = {
  id: PID,
  name: 'こども',
  avatar: 'rabbit',
  createdAt: 0,
  audience: 'p4',
};

function setApp(settings: Partial<ChildSettings> = {}) {
  h.app = {
    ready: true,
    profile,
    settings: { ...defaultSettings(PID, 'p4'), ...settings },
    favorites: [],
  } as unknown as AppStateValue;
  return h.app as AppStateValue;
}

const choice = (id: string): ChoiceItem => ({
  engine: 'choice',
  id,
  objective: 'o1',
  level: 0,
  prompt: `もんだい ${id}`,
  hints: ['ヒント1', 'ヒント2'],
  explain: `かいせつ ${id}`,
  identity: id,
  options: [{ label: 'あ', correct: true }, { label: 'い' }],
  fixedOrder: true,
});

const unit: UnitSpec = {
  id: 'p4.env.fx-test',
  title: 'テスト',
  stage: 'p4',
  subject: 'env',
  domain: 'x',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'rabbit',
  prereq: [],
  objectives: [{ id: 'o1', title: 'o' }],
  misconceptions: [],
  levels: [{ label: 'L0', chance: 0.25 }],
  intro: [],
  source: { kind: 'items', items: [choice('a'), choice('b')] },
  review: 'none',
  roundSize: 2,
  basis: '',
  revised: '2026-11-07',
};

function renderRound(settings: Partial<ChildSettings> = {}) {
  const app = setApp(settings);
  return render(
    <UnitRound
      unit={unit}
      packId="fx-test"
      progress={db.emptyUnitProgress(PID, unit.id)}
      review={false}
      resume={null}
      settings={app.settings!}
      profile={profile}
      onAgain={vi.fn()}
      onHome={vi.fn()}
    />,
  );
}

const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const phase = () => document.querySelector('.unit')?.getAttribute('data-phase');
const index = () => document.querySelector('.unit')?.getAttribute('data-index');

/** きょう 15:00（端末の時刻）。回の記録の「きょう」をこれで決める */
const NOW = new Date(2026, 10, 7, 15, 0, 0).getTime();

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
  vi.spyOn(audio, 'play').mockResolvedValue(undefined as never);
  vi.spyOn(audio, 'sfx').mockImplementation(() => undefined as never);
  vi.spyOn(audio, 'stop').mockImplementation(() => undefined as never);
  h.navigate.mockClear();
  h.loadPack.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 1問を「ヒントを出しきる → つぎへ（こたえを みる）」で解説まで進める */
function toExplainBySkip() {
  click('hint-button');
  click('hint-button');
  click('next-button');
  expect(phase()).toBe('explain');
}

describe('FX01: 解説の板が出てから 700ms は「つぎへ」を受け付けない', () => {
  it.each([100, 150, 250, 400])(
    'こたえを みる → %ims 後にもう一度押しても、解説の板は残る。700ms たてば進める',
    (gap) => {
      renderRound({ support: { ...defaultSettings(PID, 'p4').support, readAloud: 'off' } });
      toExplainBySkip();
      const explain = screen.getByTestId('explain').textContent;
      vi.setSystemTime(Date.now() + gap);
      click('next-button');
      // 解説の板（と、その問題の番号）のまま。次の問題へ飛んでいない
      expect(phase()).toBe('explain');
      expect(index()).toBe('0');
      expect(screen.getByTestId('explain').textContent).toBe(explain);
      vi.setSystemTime(Date.now() + 700 - gap);
      click('next-button');
      expect(phase()).toBe('question');
      expect(index()).toBe('1');
    },
  );

  it('正解のあとも同じ（解説の板が出た直後の「つぎへ」は無反応。700ms で進む）', () => {
    renderRound();
    click('opt-0');
    expect(phase()).toBe('explain');
    click('next-button');
    expect(phase()).toBe('explain');
    act(() => void vi.setSystemTime(Date.now() + 699));
    click('next-button');
    expect(phase()).toBe('explain');
    act(() => void vi.setSystemTime(Date.now() + 1));
    click('next-button');
    expect(phase()).toBe('question');
    expect(index()).toBe('1');
  });

  it('次の問題の解説の板でも、あらためて 700ms 数える（前の問題の時刻を引きずらない）', () => {
    renderRound();
    click('opt-0');
    act(() => void vi.setSystemTime(Date.now() + 700));
    click('next-button');
    expect(index()).toBe('1');
    // 2問目の解説
    act(() => void vi.setSystemTime(Date.now() + 5000));
    click('opt-0');
    expect(phase()).toBe('explain');
    click('next-button');
    expect(phase()).toBe('explain');
  });

  it('「つぎへ」の見た目は変えない（押せない間も disabled にしない）', () => {
    renderRound();
    click('opt-0');
    const btn = screen.getByTestId('next-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('FX10: 目安を超えたあとの単元の完了で「きょうは ここまでに しよう」', () => {
  const MIN = 60_000;
  const round = (minutes: number) =>
    db.addRound({
      profileId: PID,
      modeId: 'math',
      variantId: 'add',
      startedAt: new Date(2026, 10, 7, 9, 0, 0).getTime(),
      endedAt: new Date(2026, 10, 7, 9, 0, 0).getTime() + minutes * MIN,
      count: 4,
      completed: true,
    });

  /** 2問を最後まで進めて、完了画面の判定が済むのを待つ */
  async function finishRound() {
    toExplainBySkip();
    act(() => void vi.setSystemTime(Date.now() + 700));
    click('next-button');
    toExplainBySkip();
    act(() => void vi.setSystemTime(Date.now() + 700));
    click('next-button');
    await waitFor(() => expect(screen.getByTestId('unit-done')).toBeTruthy());
  }

  it('きょうの回の合計が目安以上なら、合図を出して「もういちど」を出さない（おうち は残る）', async () => {
    await round(6);
    renderRound({ sessionMinutes: 5 });
    await finishRound();
    expect(screen.getByTestId('unit-done-timeup').textContent).toBe('きょうは ここまでに しよう');
    expect(screen.queryByTestId('again-button')).toBeNull();
    expect(screen.getByTestId('done-home-button')).toBeTruthy();
    // 声は v1 と同じ既存の声（app.timeup）
    expect(audio.play).toHaveBeenCalledWith('app.timeup');
  });

  it('目安に届いていなければ出さない（「もういちど」が残る）', async () => {
    await round(2);
    renderRound({ sessionMinutes: 5 });
    await finishRound();
    expect(screen.queryByTestId('unit-done-timeup')).toBeNull();
    expect(screen.getByTestId('again-button')).toBeTruthy();
    expect(audio.play).not.toHaveBeenCalledWith('app.timeup');
  });

  it('目安が 0（なし）なら、たくさん遊んでいても出さない', async () => {
    await round(120);
    renderRound({ sessionMinutes: 0 });
    await finishRound();
    expect(screen.queryByTestId('unit-done-timeup')).toBeNull();
    expect(screen.getByTestId('again-button')).toBeTruthy();
  });

  it('この回の長さも数える（回の記録を書いたあとで判定する）', async () => {
    // いまの回: 12 分前に始めて、いま終わる → 目安 10 分を超える
    renderRound({ sessionMinutes: 10 });
    act(() => void vi.setSystemTime(Date.now() + 12 * MIN));
    await finishRound();
    expect(screen.getByTestId('unit-done-timeup')).toBeTruthy();
    expect(screen.queryByTestId('again-button')).toBeNull();
  });

  it('読み上げを切っている設定では、文字だけで合図を出す（声は鳴らさない）', async () => {
    await round(6);
    renderRound({
      sessionMinutes: 5,
      support: { ...defaultSettings(PID, 'p4').support, readAloud: 'off' },
    });
    await finishRound();
    expect(screen.getByTestId('unit-done-timeup')).toBeTruthy();
    expect(audio.play).not.toHaveBeenCalledWith('app.timeup');
  });

  it('判定が済むまでは完了画面を出さない（「もういちど」が一瞬出て消えない）', async () => {
    await round(6);
    renderRound({ sessionMinutes: 5 });
    toExplainBySkip();
    act(() => void vi.setSystemTime(Date.now() + 700));
    click('next-button');
    toExplainBySkip();
    act(() => void vi.setSystemTime(Date.now() + 700));
    click('next-button');
    // 完了になった直後の同期の描画には、押せる札が無い
    expect(screen.queryByTestId('again-button')).toBeNull();
    expect(screen.queryByTestId('unit-done')).toBeNull();
    // ただし空の画面にはしない: 上の帯の おうち は残る（保存が遅い端末でも戻れる）
    expect(
      screen.getByTestId('unit-done-pending').querySelector('[data-testid="home-button"]'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('unit-done')).toBeTruthy());
  });

  it('判定に失敗しても完了画面は出る（合図なし・もういちど と おうち あり。待ちの画面で止まらない）', async () => {
    vi.mocked(isSessionTimeUp).mockRejectedValueOnce(new Error('読めなかった'));
    await round(6);
    renderRound({ sessionMinutes: 5 });
    await finishRound();
    expect(screen.queryByTestId('unit-done-timeup')).toBeNull();
    expect(screen.getByTestId('again-button')).toBeTruthy();
    expect(screen.getByTestId('done-home-button')).toBeTruthy();
    expect(audio.play).not.toHaveBeenCalledWith('app.timeup');
  });
});

describe('FX12: 教材の無い単元の画面に保護者向けの説明が出る', () => {
  const open = async () => {
    setApp();
    render(<UnitRunner unitId="g3.math.mult-1digit" />);
    await waitFor(() => expect(screen.getByTestId('unit-error')).toBeTruthy());
  };

  it.each(['not-downloaded', 'outdated', 'offline'] as const)(
    '%s: 子供向けの1文のほかに、保護者向けの説明を出す',
    async (reason) => {
      h.loadPack.mockRejectedValue(new PackUnavailableError('g3-math', reason));
      await open();
      const parent = screen.getByTestId('unit-error-parent');
      expect(parent.textContent).toBe(PACK_UNAVAILABLE_PARENT_TEXT[reason]);
      // 子供向けの1文は残る。保護者向けの説明は子供向けの札の中ではなく、同じ枠の中の別の段落
      expect(screen.getByTestId('unit-error').querySelectorAll('.center-col p')).toHaveLength(2);
      expect(parent.classList.contains('unit__parent-note')).toBe(true);
    },
  );

  it('教材の問題ではない読み込みの失敗（単元が見つからない等）には出さない', async () => {
    h.loadPack.mockRejectedValue(new Error('unit not in pack'));
    await open();
    expect(screen.queryByTestId('unit-error-parent')).toBeNull();
    expect(screen.getByTestId('unit-error').textContent).toContain('いまは ひらけないよ');
  });
});
