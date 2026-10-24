import { describe, expect, it } from 'vitest';
import { initialQuestion } from '../../core/session/questionFlow';
import { defaultSettings } from '../../core/types';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import { voiceText, voiceYomi } from '../../voice/types';
import kana from './data/kana-strokes.json';
import {
  itemsForLevel,
  LETTER_VOICE_IDS,
  MAZE_HALF_WIDTH,
  TRACE_ITEMS,
  type TraceItem,
} from './content';
import { densify, judge, polylineLength, TOLERANCE_R, type Pt } from './judge';
import {
  isTraceWorkData,
  isWrongStep,
  parseDraft,
  pickRound,
  pointerKind,
  praiseOf,
  simplifyLine,
  toleranceFor,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const COUNTS = [6, 6, 6, 4, 6, 5, 4];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 判定幅 r のリスト。迷路は通路の半幅に固定 */
const rsOf = (item: TraceItem): number[] =>
  item.kind === 'maze'
    ? [MAZE_HALF_WIDTH]
    : [TOLERANCE_R.narrow, TOLERANCE_R.normal, TOLERANCE_R.wide];

/** 画 s を弧長 step ごとに歩いた点列。reverse なら終点から */
function walk(stroke: readonly Pt[], step: number, reverse = false): Pt[] {
  const pts = reverse ? [...stroke].reverse() : [...stroke];
  const out: Pt[] = [pts[0]!];
  let carried = 0;
  for (let i = 1; i < pts.length; i++) {
    carried += dist(pts[i - 1]!, pts[i]!);
    if (carried >= step) {
      out.push(pts[i]!);
      carried = 0;
    }
  }
  const last = pts[pts.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

describe('教材の数と形（learning-design.md 8章）', () => {
  it('段階ごとの教材数 T1 6 / T2 6 / T3 6 / T4 4 / T5 6 / T6 5 / T7 4', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((l) => itemsForLevel(l).length)).toEqual(COUNTS);
    expect(TRACE_ITEMS.length).toBe(COUNTS.reduce((a, b) => a + b, 0));
  });
  it('ID は重複せず、半角英数字とハイフンだけ', () => {
    const ids = TRACE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it.each(TRACE_ITEMS.map((i) => [i.id, i] as const))(
    '%s: 点列は 0〜1000 の中で、間隔が約 10',
    (_id, item) => {
      expect(item.strokes.length).toBeGreaterThan(0);
      for (const s of item.strokes) {
        expect(s.length).toBeGreaterThan(5);
        for (const p of s) {
          expect(p[0]).toBeGreaterThanOrEqual(0);
          expect(p[0]).toBeLessThanOrEqual(1000);
          expect(p[1]).toBeGreaterThanOrEqual(0);
          expect(p[1]).toBeLessThanOrEqual(1000);
        }
        for (let i = 1; i < s.length; i++) {
          const d = dist(s[i - 1]!, s[i]!);
          // 急な折り返し（そ・る・ろ の角）では、弧長 10 でも直線距離は短くなる
          expect(d).toBeGreaterThan(1);
          expect(d).toBeLessThanOrEqual(10.6);
        }
      }
    },
  );
  it('段階・種類の対応: T1〜T3 は線と形、T4 は迷路、T5〜T7 は字', () => {
    for (const i of TRACE_ITEMS) {
      if (i.level <= 2) expect(['line', 'shape']).toContain(i.kind);
      else if (i.level === 3) expect(i.kind).toBe('maze');
      else expect(i.kind).toBe('letter');
    }
  });
  it('字: 画数が書き順データと同じ。T5 は1画、T6 は2画（ち は2画）、T7 は1画', () => {
    const chars = kana.chars as unknown as Record<string, { strokes: unknown[] }>;
    for (const i of TRACE_ITEMS.filter((x) => x.kind === 'letter')) {
      expect(i.strokes.length).toBe(chars[i.char!]!.strokes.length);
      if (i.level === 4) expect(i.strokes.length).toBe(1);
      if (i.level === 5) expect(i.strokes.length).toBe(2);
      if (i.level === 6) expect(i.strokes.length).toBe(1);
    }
    expect(itemsForLevel(4).map((i) => i.char)).toEqual([...'しくつへのて']);
    expect(itemsForLevel(5).map((i) => i.char)).toEqual([...'こいりうち']);
    expect(itemsForLevel(6).map((i) => i.char)).toEqual([...'そるろひ']);
  });
  it('字は正方形の中央にそろい、はみ出さない', () => {
    for (const i of TRACE_ITEMS.filter((x) => x.kind === 'letter')) {
      const xs = i.strokes.flatMap((s) => s.map((p) => p[0]));
      const ys = i.strokes.flatMap((s) => s.map((p) => p[1]));
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(500, -1);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(500, -1);
      expect(Math.min(...xs)).toBeGreaterThan(60);
      expect(Math.max(...xs)).toBeLessThan(940);
      expect(Math.min(...ys)).toBeGreaterThan(60);
      expect(Math.max(...ys)).toBeLessThan(940);
    }
  });
  it('字の音声キーが台本にある（trace.letter.*）', () => {
    for (const v of LETTER_VOICE_IDS) expect(VOICE_CATALOG[`trace.letter.${v}`], v).toBeDefined();
    expect(LETTER_VOICE_IDS.length).toBe(15);
    // 台本側の字の ID が content.ts と過不足なく一致する
    const inCatalog = Object.keys(VOICE_CATALOG).filter((k) => k.startsWith('trace.letter.'));
    expect(inCatalog.sort()).toEqual(LETTER_VOICE_IDS.map((v) => `trace.letter.${v}`).sort());
    // 読み上げる文は「<字>を なぞろう」で、その字が教材の字と一致する
    for (const i of TRACE_ITEMS.filter((x) => x.kind === 'letter')) {
      const e = VOICE_CATALOG[`trace.letter.${i.voiceId}`]!;
      expect(voiceText(e)).toBe(`${i.char}を なぞろう`);
      // 読みは字だけカタカナ（「へ」が助詞の「え」と読まれないように）
      const kata = String.fromCharCode(i.char!.charCodeAt(0) + 0x60);
      expect(voiceYomi(e)).toBe(`${kata}を なぞろう`);
    }
  });
  it('迷路: 通路の中心線が盤面内に収まり、行き止まりは本道から壁の厚み以上離れる', () => {
    for (const m of itemsForLevel(3)) {
      expect(m.halfWidth).toBe(MAZE_HALF_WIDTH);
      expect(m.corridors!.length).toBeGreaterThanOrEqual(2);
      const route = m.strokes[0]!;
      for (const c of m.corridors!) {
        for (const p of c) {
          expect(p[0] - MAZE_HALF_WIDTH).toBeGreaterThanOrEqual(0);
          expect(p[0] + MAZE_HALF_WIDTH).toBeLessThanOrEqual(1000);
          expect(p[1] - MAZE_HALF_WIDTH).toBeGreaterThanOrEqual(0);
          expect(p[1] + MAZE_HALF_WIDTH).toBeLessThanOrEqual(1000);
        }
      }
      for (const stub of m.corridors!.slice(1)) {
        const end = stub[stub.length - 1]!;
        let best = Infinity;
        for (let i = 1; i < route.length; i++)
          best = Math.min(best, distToSegment(end, route[i - 1]!, route[i]!));
        // 本道と行き止まりの先が壁（厚み 100）をはさんで別の通路になる: 中心線の間隔 ≥ 通路の幅 150 + 壁 100
        expect(best, `${m.id} 行き止まりの先`).toBeGreaterThanOrEqual(249);
      }
    }
  });
});

describe('pickRound（seed 1..200 × 全段階 × 回の大きさ 2〜4）', () => {
  for (let level = 0; level < 7; level++) {
    for (const count of [2, 3, 4]) {
      it(`T${level + 1} count=${count}`, () => {
        for (const seed of SEEDS) {
          const ctx = `level=${level} count=${count} seed=${seed}`;
          const round = pickRound(level, seed, count);
          expect(round, ctx).toHaveLength(count);
          expect(new Set(round.map((i) => i.id)).size, ctx).toBe(count);
          for (const i of round) expect(i.level, ctx).toBe(level);
          expect(
            pickRound(level, seed, count).map((i) => i.id),
            ctx,
          ).toEqual(round.map((i) => i.id));
        }
      });
    }
  }
  it('seed を変えると題の並びが変わる（偏らない）', () => {
    const firsts = new Set(SEEDS.map((s) => pickRound(0, s, 3)[0]!.id));
    expect(firsts.size).toBeGreaterThanOrEqual(5);
  });
});

describe('判定幅・入力種別', () => {
  it('入力種別: touch / pen はそのまま、不明な値や mouse はマウス扱い', () => {
    expect(pointerKind('touch')).toBe('touch');
    expect(pointerKind('pen')).toBe('pen');
    expect(pointerKind('mouse')).toBe('mouse');
    expect(pointerKind('')).toBe('mouse');
  });
  it('設定の判定幅を入力種別ごとに使い、迷路は通路の半幅に固定', () => {
    const s = defaultSettings('p');
    s.traceTolerance = { touch: 'wide', pen: 'normal', mouse: 'narrow' };
    const line = itemsForLevel(0)[0]!;
    expect(toleranceFor(line, 'touch', s)).toBe(90);
    expect(toleranceFor(line, 'pen', s)).toBe(65);
    expect(toleranceFor(line, 'mouse', s)).toBe(45);
    const m = itemsForLevel(3)[0]!;
    for (const k of ['touch', 'pen', 'mouse'] as const)
      expect(toleranceFor(m, k, s)).toBe(MAZE_HALF_WIDTH);
  });
  it('初期値は指・ペン・マウスすべて「ひろい」（設計レビュー #22）', () => {
    expect(defaultSettings('p').traceTolerance).toEqual({
      touch: 'wide',
      pen: 'wide',
      mouse: 'wide',
    });
  });
});

describe('誤答の数え方・声かけ・保存', () => {
  it('使えなかった線 3, 6, 9 本目で誤答を数える', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(isWrongStep)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      true,
      true,
    ]);
  });
  it('声かけは観測した行動だけ', () => {
    expect(praiseOf([{ skipped: false, fromStart: true }])).toBe('praise.start-point');
    expect(
      praiseOf([
        { skipped: false, fromStart: true },
        { skipped: false, fromStart: false },
      ]),
    ).toBe('praise.traced');
    expect(
      praiseOf([
        { skipped: true, fromStart: false },
        { skipped: false, fromStart: true },
      ]),
    ).toBe('praise.start-point');
    expect(praiseOf([{ skipped: true, fromStart: false }])).toBe('praise.finished');
    expect(praiseOf([])).toBe('praise.finished');
  });
  it('simplifyLine: 整数化・範囲内・近い点を間引く・終点を残す', () => {
    const pts: Pt[] = [
      [10.4, 20.6],
      [11, 21],
      [12, 22],
      [-5, 1200],
      [500.2, 500.2],
      [500.9, 500.4],
    ];
    const s = simplifyLine(pts);
    for (const p of s) {
      expect(Number.isInteger(p[0]) && Number.isInteger(p[1])).toBe(true);
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[1]).toBeLessThanOrEqual(1000);
    }
    expect(s[0]).toEqual([10, 21]);
    expect(s[s.length - 1]).toEqual([501, 500]);
    expect(s.length).toBeLessThan(pts.length);
    expect(simplifyLine([])).toEqual([]);
  });
  it('simplifyLine した線でも、同じ判定になる（保存→再表示で壊れない）', () => {
    const item = itemsForLevel(0)[0]!;
    const raw = densify(walk(item.strokes[0]!, 5), 5);
    expect(judge([simplifyLine(raw)], item.strokes, 65).complete).toBe(true);
  });
  it('parseDraft: 正しい形は戻し、古い・壊れたデータや範囲外の題は null', () => {
    const ok = {
      index: 1,
      lines: [
        {
          p: [
            [1, 2],
            [3, 4],
          ],
          k: 'touch',
        },
      ],
      q: initialQuestion(),
      unused: 2,
      opIssue: true,
      done: [{ guideId: 'a', strokes: [], skipped: false, fromStart: true }],
      kind: 'pen',
    };
    const d = parseDraft(ok, 3)!;
    expect(d.index).toBe(1);
    expect(d.lines[0]!.k).toBe('touch');
    expect(d.unused).toBe(2);
    expect(d.opIssue).toBe(true);
    expect(d.kind).toBe('pen');
    expect(parseDraft({ ...ok, kind: 'x' }, 3)!.kind).toBe('mouse');
    expect(parseDraft({ ...ok, index: 3 }, 3)).toBeNull();
    expect(parseDraft({ ...ok, index: -1 }, 3)).toBeNull();
    expect(parseDraft({ ...ok, lines: [{ p: [['a', 2]], k: 'touch' }] }, 3)).toBeNull();
    expect(parseDraft({ ...ok, q: null }, 3)).toBeNull();
    expect(parseDraft(null, 3)).toBeNull();
    expect(parseDraft('x', 3)).toBeNull();
    expect(parseDraft({}, 3)).toBeNull();
  });
  it('isTraceWorkData', () => {
    expect(isTraceWorkData({ guideId: 'x', strokes: [[[1, 2]]] })).toBe(true);
    expect(isTraceWorkData({ guideId: 1, strokes: [] })).toBe(false);
    expect(isTraceWorkData({ guideId: 'x', strokes: [[['a', 2]]] })).toBe(false);
    expect(isTraceWorkData(null)).toBe(false);
  });
});

describe('全教材 × 判定幅: お手本どおりになぞって完成し、近道・逆向きでは完成しない', () => {
  for (const item of TRACE_ITEMS) {
    for (const r of rsOf(item)) {
      const name = `${item.id} r=${r}`;
      it(`${name}: 画を順になぞると完成（点が密・疎・ずれあり）`, () => {
        for (const [step, off] of [
          [5, 0],
          [40, 0],
          [5, 0.5 * r],
          [5, -0.5 * r],
          [40, 0.4 * r],
        ] as const) {
          const lines = item.strokes.map((s) =>
            walk(s, step).map((p) => [p[0] + off * 0.7, p[1] - off * 0.7] as Pt),
          );
          const j = judge(lines, item.strokes, r);
          expect(j.complete, `${name} step=${step} off=${off}`).toBe(true);
          expect(j.lines.every((l) => l.used)).toBe(true);
        }
      });
      it(`${name}: 各画を逆向きに書いても完成しない`, () => {
        for (let s = 0; s < item.strokes.length; s++) {
          // 前の画までは正しく書いて、その画だけ逆向き
          const lines = [
            ...item.strokes.slice(0, s).map((x) => walk(x, 5)),
            walk(item.strokes[s]!, 5, true),
          ];
          const j = judge(lines, item.strokes, r);
          expect(j.complete, `${name} 画${s + 1}`).toBe(false);
          const st = item.strokes[s]!;
          // 閉じた形（始点＝終点）は逆向きでも始点から始まるので線としては使うが、完成はしない
          if (dist(st[0]!, st[st.length - 1]!) > 3 * r) {
            expect(j.lines[lines.length - 1]!.used, `${name} 画${s + 1} 逆向きの線は使わない`).toBe(
              false,
            );
          }
        }
      });
      it(`${name}: 始点から終点への一直線（近道）では完成しない`, () => {
        for (const s of item.strokes) {
          const a = s[0]!;
          const b = s[s.length - 1]!;
          if (dist(a, b) < 3 * r) continue; // 閉じた形は始点＝終点（直線にならない）
          const maxDev = Math.max(...s.map((p) => distToSegment(p, a, b)));
          if (maxDev <= 1.6 * r) continue; // ゆるい曲線は直線でも許容の範囲（少し外れても書ける）
          const prior = item.strokes.slice(0, item.strokes.indexOf(s)).map((x) => walk(x, 5));
          const j = judge([...prior, densify([a, b], 5)], item.strokes, r);
          expect(j.complete, `${name}`).toBe(false);
        }
      });
      if (item.vertices && item.vertices.length >= 3) {
        const v = item.vertices;
        it(`${name}: 折れ線の角を1つ飛ばす近道では完成しない`, () => {
          for (let i = 1; i < v.length - 1; i++) {
            const d = distToSegment(v[i]!, v[i - 1]!, v[i + 1]!);
            if (d <= 1.6 * r) continue; // 角が浅い（許容の範囲）
            const cut = v.filter((_, k) => k !== i);
            const j = judge([densify(cut, 5)], item.strokes, r);
            expect(j.complete, `${name} 角${i}を飛ばす`).toBe(false);
          }
        });
      }
    }
  }
  it('近道・角飛ばしのテストが実際に何本か実行されている（空振りでない）', () => {
    let chords = 0;
    let corners = 0;
    for (const item of TRACE_ITEMS) {
      for (const r of rsOf(item)) {
        for (const s of item.strokes) {
          const a = s[0]!;
          const b = s[s.length - 1]!;
          if (dist(a, b) >= 3 * r && Math.max(...s.map((p) => distToSegment(p, a, b))) > 1.6 * r)
            chords++;
        }
        const v = item.vertices;
        if (v) {
          for (let i = 1; i < v.length - 1; i++) {
            if (distToSegment(v[i]!, v[i - 1]!, v[i + 1]!) > 1.6 * r) corners++;
          }
        }
      }
    }
    expect(chords).toBeGreaterThan(30);
    expect(corners).toBeGreaterThan(40);
  });
  it('お手本の長さ: T1 は短い直線、T2 は長い', () => {
    const len = (i: TraceItem) => polylineLength(i.strokes[0]!);
    for (const i of itemsForLevel(0)) expect(len(i)).toBeLessThanOrEqual(850);
    for (const i of itemsForLevel(1)) expect(len(i)).toBeGreaterThanOrEqual(800);
  });
});
