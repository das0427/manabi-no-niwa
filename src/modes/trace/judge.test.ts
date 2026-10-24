/**
 * なぞりの判定（順序つき追跡。docs/architecture.md 6.3）の単体テスト。
 * 実装より先に書いた。判定幅 r は 3 通り（ひろい 90 / ふつう 65 / せまい 45）すべてで確かめる。
 * 字の形は KanjiVG 由来の実データ（data/kana-strokes.json）を使う。
 */
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../core/util/rng';
import kana from './data/kana-strokes.json';
import {
  countUnused,
  densify,
  judge,
  polylineLength,
  resample,
  TOLERANCE_R,
  type Pt,
  type TraceJudgement,
} from './judge';

// ---- テスト用の部品 ----------------------------------------------------------

const WIDTHS = [TOLERANCE_R.narrow, TOLERANCE_R.normal, TOLERANCE_R.wide] as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 折れ線 poly の弧長の割合 a〜b（0〜1）の区間を、間隔 step で並べた点列にする（a > b なら逆向き） */
function arcPoints(poly: readonly Pt[], a: number, b: number, step = 5): Pt[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + dist(poly[i - 1]!, poly[i]!));
  const total = cum[cum.length - 1]!;
  const at = (d: number): Pt => {
    const dd = Math.max(0, Math.min(total, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < dd) i++;
    const seg = cum[i]! - cum[i - 1]!;
    const t = seg === 0 ? 0 : (dd - cum[i - 1]!) / seg;
    const p = poly[i - 1]!;
    const q = poly[i]!;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const from = a * total;
  const to = b * total;
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(at(from + ((to - from) * i) / n));
  return out;
}

const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] =>
  pts.map((p) => [p[0] + dx, p[1] + dy]);

/** 点列を「間隔 gap ごとに間引いた」点列にする（速い指の動き。点がまばらになる） */
function sparse(pts: readonly Pt[], gap: number): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (const p of pts) {
    if (dist(p, out[out.length - 1]!) >= gap) out.push(p);
  }
  const last = pts[pts.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** 正しいなぞり 1 本（始点から終点まで） */
const full = (stroke: readonly Pt[], step = 5): Pt[] => arcPoints(stroke, 0, 1, step);

const kanaStrokes = (ch: string): Pt[][] =>
  (kana.chars as unknown as Record<string, { strokes: Pt[][] }>)[ch]!.strokes;

const LINE: Pt[][] = [
  [
    [100, 500],
    [900, 500],
  ],
];
const U: Pt[][] = [
  [
    [200, 200],
    [200, 800],
    [800, 800],
    [800, 200],
  ],
];
const YAMA: Pt[][] = [
  [
    [100, 800],
    [500, 200],
    [900, 800],
  ],
];
const CIRCLE_POINTS: Pt[] = Array.from({ length: 181 }, (_, i) => {
  const a = (i / 180) * Math.PI * 2; // 真上から時計まわり
  return [500 + 350 * Math.sin(a), 500 - 350 * Math.cos(a)] as Pt;
});
const CIRCLE: Pt[][] = [CIRCLE_POINTS];

const arcOf = (j: TraceJudgement, stroke = 0) => j.strokes[stroke]!.arc;
const lineLen = (g: Pt[][], stroke = 0) => polylineLength(resample(g[stroke]!, 10));

// ---- 部品 --------------------------------------------------------------------

describe('resample / densify / polylineLength', () => {
  it('弧長がほぼ等間隔になり、始点と終点を保つ', () => {
    const p = resample(U[0]!, 10);
    expect(p[0]).toEqual([200, 200]);
    expect(p[p.length - 1]).toEqual([800, 200]);
    for (let i = 1; i < p.length; i++) {
      const d = dist(p[i - 1]!, p[i]!);
      expect(d).toBeGreaterThan(5);
      expect(d).toBeLessThanOrEqual(10.5);
    }
  });
  it('densify は間隔 5 以下に補間し、元の点を残す', () => {
    const p = densify(
      [
        [0, 0],
        [40, 0],
        [40, 30],
      ],
      5,
    );
    expect(p).toContainEqual([40, 0]);
    for (let i = 1; i < p.length; i++) expect(dist(p[i - 1]!, p[i]!)).toBeLessThanOrEqual(5.0001);
    expect(polylineLength(p)).toBeCloseTo(70, 5);
  });
  it('重複点があっても壊れない', () => {
    const p = resample(
      [
        [0, 0],
        [0, 0],
        [100, 0],
        [100, 0],
      ],
      10,
    );
    expect(p.length).toBe(11);
  });
});

// ---- 判定 --------------------------------------------------------------------

describe.each(WIDTHS)('順序つき追跡 r=%i', (r) => {
  describe('正しいなぞり', () => {
    const cases: [string, Pt[][]][] = [
      ['まっすぐ', LINE],
      ['U字', U],
      ['山形', YAMA],
      ['まる', CIRCLE],
      ['し', kanaStrokes('し')],
      ['の', kanaStrokes('の')],
      ['る', kanaStrokes('る')],
      ['ろ', kanaStrokes('ろ')],
      ['そ', kanaStrokes('そ')],
      ['て', kanaStrokes('て')],
    ];
    it.each(cases)('%s: 始点から終点まで1本でなぞると完成', (_n, g) => {
      const j = judge(
        g.map((s) => full(s)),
        g,
        r,
      );
      expect(j.complete).toBe(true);
      expect(j.lines.every((l) => l.used)).toBe(true);
    });
    it('2画の字（こ）: 1画目・2画目の順になぞると完成。1画目だけでは完成しない', () => {
      const g = kanaStrokes('こ');
      const first = judge([full(g[0]!)], g, r);
      expect(first.strokes[0]!.complete).toBe(true);
      expect(first.complete).toBe(false);
      expect(first.current).toBe(1);
      const both = judge([full(g[0]!), full(g[1]!)], g, r);
      expect(both.complete).toBe(true);
      expect(both.lines.map((l) => l.stroke)).toEqual([0, 1]);
    });
  });

  describe('r 以内のはみ出し（M8-04）', () => {
    it('お手本から 0.8r ずれたまま平行になぞっても完成する', () => {
      const j = judge([shift(full(LINE[0]!), 0, 0.8 * r)], LINE, r);
      expect(j.complete).toBe(true);
    });
    it('0.7r の波打ち（つよくふるえる指）でも完成する', () => {
      const wavy = full(LINE[0]!).map((p, i) => [p[0], p[1] + 0.7 * r * Math.sin(i / 6)] as Pt);
      expect(judge([wavy], LINE, r).complete).toBe(true);
    });
    it('字でも 0.6r ずれた平行ななぞりで完成する（し）', () => {
      const g = kanaStrokes('し');
      expect(judge([shift(full(g[0]!), 0.6 * r, 0)], g, r).complete).toBe(true);
    });
    it('1.3r ずれたまま（r の外・1.5r の内）は線として使うが、少しも進まない', () => {
      const j = judge([shift(full(LINE[0]!), 0, 1.3 * r)], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]!.used).toBe(true);
      expect(arcOf(j)).toBe(0);
    });
    it('1.6r 以上離れたなぞりは「はみ出しが多い」で使わない', () => {
      const j = judge([shift(full(LINE[0]!), 0, 1.7 * r)], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]!.used).toBe(false);
    });
    it('描いた後で最後だけ外れても、完成までの部分が使われる（完成後の外れは数えない）', () => {
      const line = [
        ...full(LINE[0]!),
        ...arcPoints(
          [
            [900, 500],
            [900, 500 + 6 * r],
          ],
          0,
          1,
        ),
      ];
      expect(judge([line], LINE, r).complete).toBe(true);
    });
  });

  describe('直線の近道（U字・山形）', () => {
    it('U字を始点から終点へ一直線に結んでも完成しない', () => {
      const cut = arcPoints(
        [
          [200, 200],
          [800, 200],
        ],
        0,
        1,
      );
      const j = judge([cut], U, r);
      expect(j.complete).toBe(false);
      expect(arcOf(j)).toBeLessThanOrEqual(3 * r);
      expect(lineLen(U)).toBeGreaterThan(1500);
    });
    it('山形の底を一直線に結んでも完成しない', () => {
      const cut = arcPoints(
        [
          [100, 800],
          [900, 800],
        ],
        0,
        1,
      );
      const j = judge([cut], YAMA, r);
      expect(j.complete).toBe(false);
      expect(arcOf(j)).toBeLessThanOrEqual(3 * r);
    });
    it('U字の曲がり角を斜めに切り取る（角をすっ飛ばす）と、そこから先に進まない', () => {
      const line = [
        ...arcPoints(U[0]!, 0, 0.2),
        ...arcPoints(
          [
            [200, 480],
            [480, 800],
          ],
          0,
          1,
        ),
        ...arcPoints(U[0]!, 0.55, 1),
      ];
      expect(judge([line], U, r).complete).toBe(false);
    });
    it('山形の頂上を切り取って近道しても完成しない', () => {
      const line = [
        ...arcPoints(YAMA[0]!, 0, 0.3),
        ...arcPoints(
          [
            [YAMA[0]![1]![0] - 180, 380],
            [YAMA[0]![1]![0] + 180, 380],
          ],
          0,
          1,
        ),
        ...arcPoints(YAMA[0]!, 0.7, 1),
      ];
      expect(judge([line], YAMA, r).complete).toBe(false);
    });
  });

  describe('ループの中心を横切る線（る・ろ・の の実データ）', () => {
    /** 字の線の a 番目の点から、ループの中心を通って m 番目の点へ直線で抜け、そこから先は正しくなぞる */
    function cutThroughCenter(ch: string, a: number, m: number, b: number): Pt[] {
      const s = resample(kanaStrokes(ch)[0]!, 10);
      const loop = s.slice(a, b + 1);
      const cx = loop.reduce((sum, p) => sum + p[0], 0) / loop.length;
      const cy = loop.reduce((sum, p) => sum + p[1], 0) / loop.length;
      const straight = (from: Pt, to: Pt) => arcPoints([from, to], 0, 1);
      return [
        ...densify(s.slice(0, a + 1), 5),
        ...straight(s[a]!, [cx, cy]),
        ...straight([cx, cy], s[m]!),
        ...densify(s.slice(m), 5),
      ];
    }
    // [字, ループに入る点, 中心を抜けて出る点, ループの終わり]（resample 後の番号）
    const cases: [string, number, number, number][] = [
      ['の', 0, 70, 130],
      ['の', 10, 90, 130],
      ['る', 100, 170, 223],
      ['る', 130, 200, 223],
      ['ろ', 100, 170, 187],
      ['ろ', 120, 180, 187],
    ];
    it.each(cases)('%s: 点%i から中心を通って点%i へ抜けても完成しない', (ch, a, m, b) => {
      const g = kanaStrokes(ch);
      const s = resample(g[0]!, 10);
      const line = cutThroughCenter(ch, Math.min(a, s.length - 2), Math.min(m, s.length - 1), b);
      const j = judge([line], g, r);
      expect(j.complete, `${ch} a=${a} m=${m}`).toBe(false);
    });
    it('の: ループを飛ばして始点からそのまま大きな弧へ進んでも完成しない', () => {
      const g = kanaStrokes('の');
      const s = resample(g[0]!, 10);
      const line = [
        ...densify(s.slice(0, 2), 5),
        ...densify(s.slice(Math.floor(s.length * 0.55)), 5),
      ];
      expect(judge([line], g, r).complete).toBe(false);
    });
  });

  describe('点を打つだけ', () => {
    it('お手本の上に点を一面に打っても、1つも使われず完成しない', () => {
      const dots = arcPoints(LINE[0]!, 0, 1, 20).map((p) => [p, [p[0] + 1, p[1]] as Pt]);
      const j = judge(dots, LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines.every((l) => !l.used && l.reason === 'short')).toBe(true);
      expect(arcOf(j)).toBe(0);
      expect(countUnused(j)).toBe(0);
    });
    it('1点だけの線（タップ）も無視する', () => {
      const j = judge([[[100, 500]]], LINE, r);
      expect(j.lines[0]!.reason).toBe('short');
    });
    it('長さ r/2 未満は無視、r/2 以上は線として扱う（境界）', () => {
      const shortLine: Pt[] = [
        [100, 500],
        [100 + r / 2 - 1, 500],
      ];
      const longLine: Pt[] = [
        [100, 500],
        [100 + r / 2 + 1, 500],
      ];
      expect(judge([shortLine], LINE, r).lines[0]!.reason).toBe('short');
      const j = judge([longLine], LINE, r);
      expect(j.lines[0]!.used).toBe(true);
      expect(arcOf(j)).toBeGreaterThan(0);
    });
  });

  describe('管の中の往復（塗りつぶし）', () => {
    const tubeY = (i: number, amp: number) => 500 + amp * Math.sin(i * 0.9);
    it('始点の近く（1.5r 以内の管）だけで往復しても、先へ進んだ分は 3r 以内で、完成しない', () => {
      const pts: Pt[] = [];
      for (let i = 0; i < 400; i++) {
        const x = 100 + 1.5 * r * (0.5 + 0.5 * Math.sin(i * 0.37));
        pts.push([x, tubeY(i, 1.4 * r)]);
      }
      const j = judge([pts], LINE, r);
      expect(j.complete).toBe(false);
      expect(arcOf(j)).toBeLessThanOrEqual(1.5 * r + r + 1);
    });
    it('管の中を線の途中(中ほど)から往復して塗っても、始点が遠いので使われない', () => {
      const pts: Pt[] = [];
      for (let i = 0; i < 400; i++)
        pts.push([300 + 400 * (0.5 + 0.5 * Math.sin(i * 0.2)), tubeY(i, r)]);
      const j = judge([pts], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]!.reason).toBe('far-start');
    });
    it('管より広く（3r）塗りつぶすと「はみ出しが多い」で使われない', () => {
      const pts: Pt[] = [];
      for (let i = 0; i < 600; i++) {
        const x = 100 + (800 * i) / 600;
        pts.push([x, 500 + 3 * r * Math.sin(i * 0.5)]);
      }
      const j = judge([pts], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]!.used).toBe(false);
      expect(j.lines[0]!.reason).toBe('off-track');
    });
    it('画面いっぱいを塗りつぶすなぐり書きは完成しない（始点から始めても）', () => {
      const pts: Pt[] = [[100, 500]];
      for (let i = 0; i < 40; i++) pts.push([i % 2 === 0 ? 50 : 950, 50 + i * 22]);
      const j = judge([pts], LINE, r);
      expect(j.complete).toBe(false);
    });
    it('[判断] ゆるやかに左右へゆれながら進む線（ゆれ 0.7r・長さはお手本の 1.5 倍ほど）は、順に進んでいるので「正しくなぞったのと同じ」とみなして完成にする', () => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 800; i++) pts.push([100 + i, 500 + 0.7 * r * Math.sin(i / 40)]);
      expect(polylineLength(pts)).toBeLessThan(2 * 800);
      expect(judge([pts], LINE, r).complete).toBe(true);
    });
    it('[判断] 管の中を速く左右に往復しながら進む塗りつぶし（幅 1.4r・長さがお手本の 5 倍を超える）は、順に進んでも完成にしない', () => {
      // 往復の幅が 1.4r（r の外・1.5r の内）なので 40% の規則には当たらない。
      // 先読みだけでは「始点から終点へ順に進んだ」ことになるため、長さの規則（なぐり書き）で止める。
      const pts: Pt[] = [];
      for (let i = 0; i <= 800; i++) pts.push([100 + i, 500 + 1.4 * r * Math.sin(i / 7)]);
      expect(polylineLength(pts)).toBeGreaterThan(5 * 800);
      const j = judge([pts], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]).toMatchObject({ used: false, reason: 'off-track' });
    });
    it('[判断] 全長を何度も往復する線は、最初の一往路で完成する（正しいなぞりと同じ）', () => {
      const forth = full(LINE[0]!);
      const back = [...forth].reverse();
      const j = judge([[...forth, ...back, ...forth, ...back]], LINE, r);
      expect(j.complete).toBe(true);
    });
    it('管の中でも、終点側から始点へ向かう往復だけでは完成しない', () => {
      const back = arcPoints(LINE[0]!, 1, 0);
      expect(judge([back, back, back], LINE, r).complete).toBe(false);
    });
  });

  describe('逆向き', () => {
    it('終点から書いた線は使われない（始点が遠い）', () => {
      const j = judge([arcPoints(LINE[0]!, 1, 0)], LINE, r);
      expect(j.complete).toBe(false);
      expect(j.lines[0]).toMatchObject({ used: false, reason: 'far-start' });
    });
    it('し・U字・山形も逆向きでは完成しない', () => {
      for (const g of [kanaStrokes('し'), U, YAMA]) {
        const j = judge([arcPoints(g[0]!, 1, 0)], g, r);
        expect(j.complete).toBe(false);
        expect(j.lines[0]!.reason).toBe('far-start');
      }
    });
    it('逆向きの線のあとに、正しい向きでなぞり直せば完成する（やり直しを強制しない）', () => {
      const j = judge([arcPoints(LINE[0]!, 1, 0), full(LINE[0]!)], LINE, r);
      expect(j.complete).toBe(true);
      expect(countUnused(j)).toBe(1);
    });
  });

  describe('途中で離して再開（M8-06）', () => {
    it('半分で離し、止まった所の少し手前から再開しても完成する', () => {
      // 指を離した位置より 1.0r 手前に置き直しても続けられる（進み位置は指の r ほど先にある）
      const a = arcPoints(LINE[0]!, 0, 0.5);
      const b = arcPoints(LINE[0]!, (400 - r) / 800, 1);
      const j = judge([a, b], LINE, r);
      expect(j.complete).toBe(true);
      expect(j.lines.every((l) => l.used)).toBe(true);
    });
    it('5回に分けて離して再開しても完成する', () => {
      const parts = [0, 0.2, 0.4, 0.6, 0.8].map((s) =>
        arcPoints(LINE[0]!, Math.max(0, s - 0.05), s + 0.2),
      );
      expect(judge(parts, LINE, r).complete).toBe(true);
    });
    it('止まった所から 1.5r より遠くで再開した線は使われず、進み位置は保たれる', () => {
      const a = arcPoints(LINE[0]!, 0, 0.3);
      const stopped = arcOf(judge([a], LINE, r));
      const far = arcPoints(LINE[0]!, 0.3 + (2.6 * r + 40) / 800, 1);
      const j = judge([a, far], LINE, r);
      expect(j.lines[1]).toMatchObject({ used: false, reason: 'far-start' });
      expect(arcOf(j)).toBe(stopped);
      expect(j.complete).toBe(false);
    });
    it('止まった所から再開する線は、始点（0）からでなくてもよい', () => {
      const a = arcPoints(U[0]!, 0, 0.45);
      const b = arcPoints(U[0]!, 0.45, 1);
      expect(judge([a, b], U, r).complete).toBe(true);
    });
    it('「ひとつ もどす」: 線の列から再計算すると、直前の線を消した状態に戻る', () => {
      const a = arcPoints(LINE[0]!, 0, 0.5);
      const b = arcPoints(LINE[0]!, 0.5, 1);
      const both = judge([a, b], LINE, r);
      const undone = judge([a], LINE, r);
      expect(both.complete).toBe(true);
      expect(undone.complete).toBe(false);
      expect(arcOf(undone)).toBeLessThan(arcOf(both));
      expect(judge([], LINE, r).strokes[0]!.k).toBe(0);
      // 使われなかった線を消すと、進み位置は変わらずに数だけ減る
      const withBad = judge([a, arcPoints(LINE[0]!, 1, 0.9), b], LINE, r);
      expect(withBad.complete).toBe(true);
      expect(countUnused(withBad)).toBe(1);
      expect(countUnused(judge([a, b], LINE, r))).toBe(0);
    });
  });

  describe('速い動き（点の間隔が広い）', () => {
    it.each([40, 60])('間隔 %i 単位の点列でも、まっすぐ・U字・し・まるは完成する', (gap) => {
      for (const g of [LINE, U, kanaStrokes('し'), CIRCLE, kanaStrokes('へ')]) {
        const line = sparse(full(g[0]!), gap);
        expect(polylineLength(line) / line.length).toBeGreaterThan(gap * 0.5);
        const j = judge([line], g, r);
        expect(j.complete, `gap=${gap} len=${line.length}`).toBe(true);
      }
    });
    it('点が2つだけ（始点と終点）の線は近道なので完成しない（U字）', () => {
      expect(
        judge(
          [
            [
              [200, 200],
              [800, 200],
            ],
          ],
          U,
          r,
        ).complete,
      ).toBe(false);
    });
  });

  describe('閉じた形（まる）', () => {
    it('始点の位置に戻る1周で完成する', () => {
      const j = judge([full(CIRCLE_POINTS)], CIRCLE, r);
      expect(j.complete).toBe(true);
    });
    it('逆まわり（始点から反時計まわり）では完成しない', () => {
      const line = [...full(CIRCLE_POINTS)].reverse();
      const j = judge([line], CIRCLE, r);
      expect(j.complete).toBe(false);
      // 逆まわりの1周は始点の少し先まで進むだけ（点の番号で進むので始点＝終点でも曖昧にならない）
      expect(arcOf(j)).toBeLessThanOrEqual(5 * r);
    });
    it('半周でやめると完成しない。始点＝終点でも、始点に触れただけでは完成しない', () => {
      const half = arcPoints(CIRCLE_POINTS, 0, 0.5);
      expect(judge([half], CIRCLE, r).complete).toBe(false);
      const touch = arcPoints(CIRCLE_POINTS, 0, 0.03);
      expect(judge([touch], CIRCLE, r).complete).toBe(false);
    });
    it('円の中心を通る直線（直径）で半周を飛ばしても完成しない', () => {
      const line = [
        ...arcPoints(CIRCLE_POINTS, 0, 0.1),
        ...arcPoints(
          [
            [CIRCLE_POINTS[18]![0], CIRCLE_POINTS[18]![1]],
            [CIRCLE_POINTS[108]![0], CIRCLE_POINTS[108]![1]],
          ],
          0,
          1,
        ),
        ...arcPoints(CIRCLE_POINTS, 0.6, 1),
      ];
      expect(judge([line], CIRCLE, r).complete).toBe(false);
    });
    it('始点と反対側（真下）から書き始めた線は使われない', () => {
      const j = judge([arcPoints(CIRCLE_POINTS, 0.5, 1.0)], CIRCLE, r);
      expect(j.lines[0]!.reason).toBe('far-start');
    });
  });

  describe('2画の字（こ）で順序を守る', () => {
    const g = kanaStrokes('こ');
    it('2画目を先に書いた線は使われない。1画目が終わるまで2画目は進まない', () => {
      const j = judge([full(g[1]!)], g, r);
      expect(j.lines[0]).toMatchObject({ used: false, reason: 'far-start', stroke: 0 });
      expect(j.current).toBe(0);
      expect(j.strokes[1]!.k).toBe(0);
    });
    it('2画目を先に書いてから 1画目・2画目を書くと完成する。使われなかった線は1本', () => {
      const j = judge([full(g[1]!), full(g[0]!), full(g[1]!)], g, r);
      expect(j.complete).toBe(true);
      expect(countUnused(j)).toBe(1);
    });
    it('1画目の途中で2画目を書いても、1画目が完成するまでは2画目に進まない', () => {
      // 0.25 まで: ひろい(90) では こ のはね（内側の幅が r 以下）は大目にみて、半分で完成扱いになるため
      const j = judge([arcPoints(g[0]!, 0, 0.25), full(g[1]!)], g, r);
      expect(j.current).toBe(0);
      expect(j.lines[1]!.used).toBe(false);
    });
    it('完成のあとに書き足した線は「完成後」として数えない', () => {
      const j = judge([full(g[0]!), full(g[1]!), full(g[0]!)], g, r);
      expect(j.complete).toBe(true);
      expect(j.lines[2]!.reason).toBe('finished');
      expect(countUnused(j)).toBe(0);
    });
    it('画のつなぎ: 1本の線で1画目から2画目へ続けて書いても、2画目には進まない（画ごとに離す）', () => {
      const joined = [...full(g[0]!), ...full(g[1]!)];
      const j = judge([joined], g, r);
      expect(j.strokes[0]!.complete).toBe(true);
      expect(j.complete).toBe(false);
    });
  });

  describe('始点の判定（1.5r）', () => {
    it('始点から 1.4r 離れて書き始めても使う。1.6r では使わない', () => {
      const body = arcPoints(LINE[0]!, 0, 1);
      const near = [[100 - 1.4 * r, 500] as Pt, ...body];
      const far = [[100 - 1.6 * r, 500] as Pt, ...body];
      expect(judge([near], LINE, r).lines[0]!.used).toBe(true);
      expect(judge([far], LINE, r).lines[0]).toMatchObject({ used: false, reason: 'far-start' });
    });
    it('始点から書き始めた線は startedAtStart、離れて始めた線は false', () => {
      const a = judge([full(LINE[0]!)], LINE, r);
      expect(a.lines[0]!.startedAtStart).toBe(true);
      const b = judge([shift(full(LINE[0]!), -1.2 * r, 0)], LINE, r);
      expect(b.lines[0]!.used).toBe(true);
      expect(b.lines[0]!.startedAtStart).toBe(false);
    });
  });
});

// ---- 迷路: 通路の半幅を r に固定する ------------------------------------------

describe('迷路（通路の中心線がお手本。r は通路の半幅）', () => {
  const R = 75;
  // 4×4 の格子（ピッチ 250）の蛇行
  const ROUTE: Pt[][] = [
    [
      [125, 125],
      [875, 125],
      [875, 375],
      [125, 375],
      [125, 625],
      [875, 625],
    ],
  ];
  it('通路をたどれば完成', () => {
    expect(judge([full(ROUTE[0]!)], ROUTE, R).complete).toBe(true);
  });
  it('壁をつっきる近道では完成しない（折り返しの隣の通路へ飛ぶ）', () => {
    const line = [
      ...arcPoints(ROUTE[0]!, 0, 0.25),
      ...arcPoints(
        [
          [600, 125],
          [600, 375],
        ],
        0,
        1,
      ),
      ...arcPoints(ROUTE[0]!, 0.4, 1),
    ];
    expect(judge([line], ROUTE, R).complete).toBe(false);
  });
  it('行き止まりに入って戻ってくる寄り道があっても完成する', () => {
    const toDeadEnd = arcPoints(
      [
        [500, 125],
        [500, 250],
        [500, 125],
      ],
      0,
      1,
    );
    const line = [...arcPoints(ROUTE[0]!, 0, 0.14), ...toDeadEnd, ...arcPoints(ROUTE[0]!, 0.14, 1)];
    expect(judge([line], ROUTE, R).complete).toBe(true);
  });
});

// ---- でたらめななぐり書き（乱数は固定の seed。再現できる）-------------------------

describe.each(WIDTHS)('でたらめななぐり書き r=%i', (r) => {
  const guides: [string, Pt[][]][] = [
    ['U字', U],
    ['山形', YAMA],
    ['まる', CIRCLE],
    ['し', kanaStrokes('し')],
    ['る', kanaStrokes('る')],
    ['の', kanaStrokes('の')],
    ['こ', kanaStrokes('こ')],
  ];
  it.each(guides)(
    '%s: 盤面いっぱいの乱数の線（1本が盤面の約 5 周分）が 150 回中、偶然に完成する割合は 3% 以下',
    (name, g) => {
      // 乱数の歩きがたまたまお手本をたどり切ることは、ひろい(90)のやさしい形（し・山形）でまれにある。
      // 実測（3000 回）: 山形 0.2%、し 0.8%、そのほかの形・ふつう以下の判定幅では 0。
      const rng = createRng(hashSeed('scribble', r, name));
      const N = 150;
      let hits = 0;
      for (let n = 0; n < N; n++) {
        const lines: Pt[][] = [];
        for (let k = 0; k < 2; k++) {
          const start = g[0]![0]!;
          const pts: Pt[] = [
            rng.next() < 0.5 ? [start[0], start[1]] : [rng.next() * 1000, rng.next() * 1000],
          ];
          let ang = rng.next() * Math.PI * 2;
          for (let i = 0; i < 160; i++) {
            ang += (rng.next() - 0.5) * 1.6;
            const last = pts[pts.length - 1]!;
            const x = Math.max(0, Math.min(1000, last[0] + Math.cos(ang) * 30));
            const y = Math.max(0, Math.min(1000, last[1] + Math.sin(ang) * 30));
            pts.push([x, y]);
          }
          lines.push(pts);
        }
        if (judge(lines, g, r).complete) hits++;
      }
      expect(hits / N).toBeLessThanOrEqual(0.03);
    },
  );
});
