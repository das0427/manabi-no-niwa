import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackProgress, PackStatus } from './packs';

const progress = vi.hoisted(() => new Map<string, PackProgress>());
vi.mock('./packs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./packs')>()),
  getPackProgress: (id: string) => progress.get(id) ?? null,
}));

const { setupView, summarizeSetup } = await import('./setup');

afterEach(() => progress.clear());

const READY = { status: 'ready', progress: null } as const;

const st = (packId: string, state: PackStatus['state'], bytes = 100): PackStatus => ({
  packId,
  state,
  bytes,
  fileCount: 1,
  hash: 'h',
  downloaded: null,
});

describe('summarizeSetup（初回準備の2段階: コア → 既定パック）', () => {
  it('コアの準備中は core。コアの進み具合を返す', () => {
    const s = summarizeSetup(
      { status: 'installing', progress: { done: 3, total: 10 } },
      ['g3-sansu'],
      null,
    );
    expect(s).toMatchObject({
      stage: 'core',
      progress: { done: 3, total: 10 },
      missing: ['g3-sansu'],
    });
  });

  it('コアがそろっても、既定パックがそろうまで準備完了にしない', () => {
    const s = summarizeSetup(
      { status: 'ready', progress: null },
      ['g3-sansu', 'g3-kokugo'],
      [st('g3-sansu', 'ready'), st('g3-kokugo', 'not-downloaded', 250)],
    );
    expect(s).toMatchObject({
      stage: 'packs',
      missing: ['g3-kokugo'],
      progress: { done: 0, total: 250 },
    });
    expect(s.failures).toEqual([]);
  });

  it('版の古いパックも「そろっていない」', () => {
    const s = summarizeSetup(
      { status: 'ready', progress: null },
      ['g3-sansu'],
      [st('g3-sansu', 'outdated')],
    );
    expect(s.stage).toBe('packs');
  });

  it('両方そろえば ready。幼児（既定パックなし）はコアだけで ready', () => {
    expect(
      summarizeSetup({ status: 'ready', progress: null }, ['g3-sansu'], [st('g3-sansu', 'ready')])
        .stage,
    ).toBe('ready');
    expect(summarizeSetup({ status: 'ready', progress: null }, [], null).stage).toBe('ready');
  });

  it('状態の読み込み前は失敗扱いにしない。packs.json が読めなければ unavailable の失敗', () => {
    expect(
      summarizeSetup({ status: 'ready', progress: null }, ['g3-sansu'], null).failures,
    ).toEqual([]);
    expect(
      summarizeSetup(
        { status: 'ready', progress: null },
        ['g3-sansu'],
        [st('g3-sansu', 'unavailable')],
      ).failures,
    ).toEqual([{ packId: 'g3-sansu', reason: 'unavailable' }]);
  });

  it('オフライン準備ができない環境は ready（unsupported）、コアの失敗は error', () => {
    expect(
      summarizeSetup({ status: 'unsupported', progress: null }, ['g3-sansu'], null),
    ).toMatchObject({
      stage: 'ready',
      unsupported: true,
    });
    expect(summarizeSetup({ status: 'error', progress: null }, ['g3-sansu'], null).stage).toBe(
      'error',
    );
  });

  it('取得中の進み具合。planned を渡すと、取得し終えたパックの分も数える（割合が戻らない）', () => {
    progress.set('g3-ja', {
      packId: 'g3-ja',
      doneFiles: 1,
      totalFiles: 4,
      doneBytes: 50,
      totalBytes: 200,
    });
    const s = summarizeSetup(
      READY,
      ['g3-math', 'g3-ja', 'kanji-g34'],
      [st('g3-math', 'ready', 100), st('g3-ja', 'not-downloaded', 200), st('kanji-g34', 'ready')],
      [],
      ['g3-math', 'g3-ja'],
    );
    expect(s).toMatchObject({
      stage: 'packs',
      missing: ['g3-ja'],
      downloading: true,
      checking: false,
      progress: { done: 150, total: 300 },
    });
  });

  it('版の古いパックは outdated に挙げる。そろったパックの古い失敗は出さない', () => {
    const s = summarizeSetup(
      READY,
      ['g3-math', 'g3-ja'],
      [st('g3-math', 'ready'), st('g3-ja', 'outdated')],
      [
        { packId: 'g3-math', reason: 'offline' },
        { packId: 'g3-ja', reason: 'not-found' },
      ],
    );
    expect(s.outdated).toEqual(['g3-ja']);
    expect(s.failures).toEqual([{ packId: 'g3-ja', reason: 'not-found' }]);
  });

  it('コアがそろって状態を読む前は checking', () => {
    expect(summarizeSetup(READY, ['g3-math'], null).checking).toBe(true);
  });
});

describe('setupView（起動画面で子供に見せる形）', () => {
  const statuses = [st('g3-math', 'not-downloaded', 100), st('g3-ja', 'outdated', 100)];

  it('コアの準備中・読み込み中・完了・既定パックなしは出さない', () => {
    expect(
      setupView(summarizeSetup({ status: 'installing', progress: null }, ['g3-math'], null)),
    ).toEqual({ kind: 'hidden' });
    expect(setupView(summarizeSetup(READY, ['g3-math'], null))).toEqual({ kind: 'hidden' });
    expect(setupView(summarizeSetup(READY, [], null))).toEqual({ kind: 'hidden' });
    expect(setupView(summarizeSetup(READY, ['g3-math'], [st('g3-math', 'ready')]))).toEqual({
      kind: 'hidden',
    });
  });

  it('取得中は割合（そろうまで 100 にしない）。版が古いものを含めば renewing', () => {
    progress.set('g3-math', {
      packId: 'g3-math',
      doneFiles: 9,
      totalFiles: 9,
      doneBytes: 100,
      totalBytes: 100,
    });
    expect(setupView(summarizeSetup(READY, ['g3-math'], [statuses[0]!]))).toEqual({
      kind: 'preparing',
      percent: 99,
      renewing: false,
    });
    progress.clear();
    expect(setupView(summarizeSetup(READY, ['g3-math', 'g3-ja'], statuses))).toEqual({
      kind: 'preparing',
      percent: 0,
      renewing: true,
    });
  });

  it('失敗して止まっていれば failed。理由がすべてオフラインなら offline', () => {
    expect(
      setupView(
        summarizeSetup(READY, ['g3-math', 'g3-ja'], statuses, [
          { packId: 'g3-math', reason: 'offline' },
          { packId: 'g3-ja', reason: 'offline' },
        ]),
      ),
    ).toEqual({ kind: 'failed', offline: true });
    expect(
      setupView(
        summarizeSetup(READY, ['g3-math', 'g3-ja'], statuses, [
          { packId: 'g3-math', reason: 'offline' },
          { packId: 'g3-ja', reason: 'quota' },
        ]),
      ),
    ).toEqual({ kind: 'failed', offline: false });
  });

  it('失敗があっても、取得し直している最中は preparing', () => {
    progress.set('g3-ja', {
      packId: 'g3-ja',
      doneFiles: 0,
      totalFiles: 1,
      doneBytes: 0,
      totalBytes: 100,
    });
    expect(
      setupView(
        summarizeSetup(READY, ['g3-math', 'g3-ja'], statuses, [
          { packId: 'g3-math', reason: 'offline' },
        ]),
      ).kind,
    ).toBe('preparing');
  });
});
