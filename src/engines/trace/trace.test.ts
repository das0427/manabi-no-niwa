// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { judge as v1Judge, type Pt } from '../../modes/trace/judge';
import { loadGuide, normalizeStrokes, strokeSetOf } from './strokes';
import {
  checkTrace,
  classifyMiss,
  judgeTrace,
  TRACE_R,
  traceTolerance,
  type TraceItem,
} from './trace';
import { TRACE_SAMPLES } from './trace.samples';

const DATA = fileURLToPath(new URL('../../packs/_data/strokes/', import.meta.url));
const loadSet = (name: string) =>
  (
    JSON.parse(readFileSync(join(DATA, `${name}.json`), 'utf-8')) as {
      chars: Record<string, { strokes: number[][][] }>;
    }
  ).chars;

const item = (over: Partial<TraceItem> = {}): TraceItem => ({
  id: 't',
  engine: 'trace',
  objective: 'o',
  level: 0,
  prompt: 'かこう',
  char: '木',
  mode: 'trace',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
  misconceptionIds: { order: 'm-order', direction: 'm-dir' },
  ...over,
});

describe('trace: 書き順データの引き方', () => {
  it('字の集合', () => {
    expect(strokeSetOf('し')).toBe('kana');
    expect(strokeSetOf('ア')).toBe('kana');
    expect(strokeSetOf('ー')).toBe('kana');
    expect(strokeSetOf('木')).toBe('kanji-g1');
    expect(strokeSetOf('鏡')).toBe('kanji-g4');
    expect(strokeSetOf('論')).toBe('kanji-g6');
    expect(strokeSetOf('A')).toBeNull();
    expect(strokeSetOf('a')).toBeNull();
    expect(strokeSetOf('ab')).toBeNull();
  });
  it('遅延で読み、中央にそろえる（木 = 4画）', async () => {
    const g = await loadGuide('木');
    expect(g?.length).toBe(4);
    const xs = g!.flat().map((p) => p[0]);
    expect(Math.round((Math.min(...xs) + Math.max(...xs)) / 2)).toBe(500);
    expect(await loadGuide('A')).toBeNull();
  });
});

describe('trace: 判定幅（年齢・字の種類）', () => {
  it('幼児は v1 と同じ ひろい、小学生のかなと 2〜6年の漢字は 75、1年の漢字は 90', () => {
    expect(traceTolerance({ char: 'し' }, true)).toBe(90);
    expect(traceTolerance({ char: 'し' }, false)).toBe(TRACE_R.kana);
    expect(traceTolerance({ char: '木' }, false)).toBe(90);
    expect(traceTolerance({ char: '鏡' }, false)).toBe(75);
    expect(traceTolerance({ char: '鏡', tolerance: 60 }, false)).toBe(60);
  });
});

describe('trace: 判定', () => {
  it('なぞり終えた線なら正解。足りなければ「もう一度」', async () => {
    const guide = (await loadGuide('木'))!;
    const r = 90;
    expect(judgeTrace(item(), { kind: 'done', trace: { lines: guide, guide, r } })).toEqual({
      result: 'correct',
    });
    expect(
      judgeTrace(item(), { kind: 'done', trace: { lines: guide.slice(0, 3), guide, r } }).result,
    ).toBe('retry');
    expect(judgeTrace(item(), { kind: 'done' }).result).toBe('retry');
  });
  it('trace-free はなぞりと自由書きの両方が要る。free は自由書きだけ（採点しない）', async () => {
    const guide = (await loadGuide('木'))!;
    const free = {
      lines: [{ c: 'ink' as const, p: [[1, 1] as [number, number]] }],
      self: 'similar' as const,
      again: 0,
    };
    const tf = item({ mode: 'trace-free' });
    expect(judgeTrace(tf, { kind: 'done', trace: { lines: guide, guide, r: 90 } }).result).toBe(
      'retry',
    );
    expect(
      judgeTrace(tf, { kind: 'done', trace: { lines: guide, guide, r: 90 }, free }).result,
    ).toBe('correct');
    const f = item({ char: 'A', mode: 'free', misconceptionIds: undefined });
    expect(judgeTrace(f, { kind: 'done', free }).result).toBe('correct');
    expect(judgeTrace(f, { kind: 'done', free: { ...free, lines: [] } }).result).toBe('retry');
  });
  it('書き順の違い: 2画目から書いた線 → order の誤概念', async () => {
    const guide = (await loadGuide('木'))!;
    const lines = [guide[1]!, guide[1]!, guide[1]!];
    const j = judgeTrace(item(), { kind: 'miss', lines, guide, r: 90 });
    expect(j).toMatchObject({ result: 'wrong', misconception: 'm-order' });
  });
  it('向きの違い: 1画目を終わりから書いた線 → direction の誤概念', async () => {
    const guide = (await loadGuide('木'))!;
    const rev = [...guide[0]!].reverse();
    const j = judgeTrace(item(), { kind: 'miss', lines: [rev, rev, rev], guide, r: 90 });
    expect(j).toMatchObject({ result: 'wrong', misconception: 'm-dir' });
  });
  it('どちらでもない線は誤概念なし', async () => {
    const guide = (await loadGuide('木'))!;
    const far: Pt[] = [
      [950, 950],
      [990, 990],
      [990, 900],
    ];
    expect(classifyMiss({ lines: [far, far, far], guide, r: 90 }).kind).toBeNull();
    expect(
      judgeTrace(item(), { kind: 'miss', lines: [far, far, far], guide, r: 90 }),
    ).toMatchObject({
      result: 'wrong',
      misconception: undefined,
    });
  });
});

describe('trace: 検査', () => {
  it('見本は誤りなし', () => {
    for (const s of TRACE_SAMPLES) expect(checkTrace(s), s.id).toEqual([]);
  });
  it('書き順データが無い字は free だけ', () => {
    expect(checkTrace(item({ char: 'A', misconceptionIds: undefined })).join()).toMatch(
      /free だけ/,
    );
    expect(checkTrace(item({ char: 'A', mode: 'free', misconceptionIds: undefined }))).toEqual([]);
    // データを直接持たせればなぞれる
    expect(
      checkTrace(
        item({
          char: 'A',
          strokes: [
            [
              [500, 100],
              [200, 900],
            ],
          ],
          misconceptionIds: undefined,
        }),
      ),
    ).toEqual([]);
  });
  it('字は1字・点の範囲・判定幅の範囲・採点しない問題に誤概念を付けない', () => {
    expect(checkTrace(item({ char: '木木' })).join()).toMatch(/1字/);
    expect(checkTrace(item({ strokes: [[[0, 0]]] })).join()).toMatch(/2つ未満/);
    expect(
      checkTrace(
        item({
          strokes: [
            [
              [0, 0],
              [1200, 0],
            ],
          ],
        }),
      ).join(),
    ).toMatch(/外の点/);
    expect(checkTrace(item({ tolerance: 10 })).join()).toMatch(/tolerance/);
    expect(checkTrace(item({ mode: 'free' })).join()).toMatch(/誤概念ID/);
  });
});

/**
 * 判定幅の根拠の回帰テスト（全字の模擬入力の縮小版）。各集合から 40 字:
 * - 正しい順にお手本どおりなぞる → 完成する
 * - 順序違い（s 画まで書いて s+1 画を書く）→ その画を完成扱いにしない
 */
describe('trace: 判定幅の根拠（模擬入力）', () => {
  for (const [set, preschool] of [
    ['kana', true],
    ['kana', false],
    ['kanji-g1', false],
    ['kanji-g3', false],
    ['kanji-g6', false],
  ] as const) {
    it(`${set}${preschool ? '（幼児）' : ''}`, () => {
      const chars = Object.entries(loadSet(set))
        .filter((_, i) => i % 5 === 0)
        .slice(0, 40);
      let wrongDone = 0;
      let wrongTried = 0;
      for (const [ch, v] of chars) {
        const g = normalizeStrokes(v.strokes);
        const r = traceTolerance({ char: ch }, preschool);
        expect(v1Judge(g, g, r).complete, ch).toBe(true);
        for (let s = 0; s + 1 < g.length; s++) {
          const j = v1Judge([...g.slice(0, s), g[s + 1]!], g, r);
          wrongTried++;
          if (j.lines[j.lines.length - 1]!.completedStroke) wrongDone++;
        }
      }
      // 幼児のかなは v1 と同じ ひろい（濁点などで少しある）。小学生は 1% 未満
      expect(wrongDone / Math.max(1, wrongTried)).toBeLessThan(preschool ? 0.05 : 0.01);
    });
  }
});
