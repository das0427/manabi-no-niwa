import { describe, expect, it } from 'vitest';
import type { PackStatus } from './packs';
import { summarizeSetup } from './setup';

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
});
