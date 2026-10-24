/**
 * 内容レビュー（decompose・prefecture-finder・draw-shapes・polygon・sensor・efficient）の再発防止テスト。
 * 問題の 正解・誤りを、命令を じっさいに 動かして（タートルの軌跡・格子の実行器）たしかめる。
 */
import { describe, expect, it } from 'vitest';
import type { ChoiceItem, Item, NumberItem, ProgramItem, UnitSpec } from '../../curriculum/types';
import { cardCount as engineCardCount, run as engineRun } from '../../engines/program/world';
import { plainText } from '../../text/rich';
import { decompose } from './decompose';
import { drawShapes } from './draw-shapes';
import { efficient } from './efficient';
import { F, L, R, rep, type Cmd } from './kit';
import { polygon } from './polygon';
import { prefectureFinder } from './prefecture-finder';
import { sensor } from './sensor';
import { FW, repeatSteps, TR, trace, type TStep } from './turtle';

const MINE: UnitSpec[] = [decompose, prefectureFinder, drawShapes, polygon, sensor, efficient];
const itemsOf = (u: UnitSpec): Item[] => (u.source.kind === 'items' ? u.source.items : []);
const byId = (u: UnitSpec, id: string) => {
  const it = itemsOf(u).find((x) => x.id === id);
  if (!it) throw new Error(`no item ${id}`);
  return it;
};

// ---- タートル ----

/** 「「すすむ 3、みぎに 90ど」を 4かい くりかえす」→ 命令の列（読めなければ null） */
function parseRep(text: string): TStep[] | null {
  const m = /^「(.+)」を (\d+)かい くりかえす$/.exec(plainText(text).trim());
  if (!m) return null;
  const body: TStep[] = [];
  for (const part of m[1]!.split('、')) {
    const f = /^すすむ (\d+)$/.exec(part);
    const t = /^みぎに (\d+)ど$/.exec(part);
    if (f) body.push(FW(Number(f[1])));
    else if (t) body.push(TR(Number(t[1])));
    else return null;
  }
  return repeatSteps(Number(m[2]), ...body);
}

/** かいた線の集まり（向き・順を問わない） */
function segments(steps: readonly TStep[]): string {
  // -0 を 0 に そろえた「x,y」の文字
  const p = trace(steps).pts.map(
    ([x, y]) => `${Math.round(x * 1000) / 1000 + 0},${Math.round(y * 1000) / 1000 + 0}`,
  );
  const segs: string[] = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    segs.push(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return [...new Set(segs)].sort().join(' ');
}

/** 選択肢の文（番号だけのボタンなら、問題文の「1：…」の行） */
function optionText(it: ChoiceItem, label: string): string {
  if (/^\d$/.test(label)) {
    const line = it.prompt.split('\n').find((l) => l.startsWith(`${label}：`));
    return line ? line.slice(label.length + 1) : label;
  }
  return label;
}

describe('命令で図形をかく（draw-shapes・polygon）', () => {
  const choices = [...itemsOf(drawShapes), ...itemsOf(polygon)].filter(
    (it): it is ChoiceItem => it.engine === 'choice',
  );

  it('命令の文を選ぶ問題: 正解は とじた図形、誤りは 正解と ちがう図形をかく', () => {
    let checked = 0;
    for (const it of choices) {
      const parsed = it.options.map((o) => ({
        o,
        s: o.label ? parseRep(optionText(it, o.label)) : null,
      }));
      const right = parsed.find((p) => p.o.correct);
      if (!right?.s) continue;
      checked++;
      const tr = trace(right.s);
      // 「〜に ならない／とじない」を問う問題は ない前提（あれば ここで わかる）
      expect(tr.closed, `${it.id}: 正解の命令で 図形が とじない`).toBe(true);
      expect(Math.abs(tr.turned) % 360, `${it.id}: 正解で 1しゅう まわらない`).toBe(0);
      for (const w of parsed.filter((p) => !p.o.correct && p.s))
        expect(segments(w.s!), `${it.id}: 誤り「${w.o.label}」が 正解と 同じ図形`).not.toBe(
          segments(right.s),
        );
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('rc-4: 正解は 正方形（4つの へんが 同じ）、誤りは 正方形でない長方形', () => {
    const it = byId(drawShapes, 'rc-4') as ChoiceItem;
    for (const o of it.options) {
      const s = parseRep(optionText(it, o.label!))!;
      const lens = s.filter((x): x is { f: number } => 'f' in x).map((x) => x.f);
      expect(trace(s).closed).toBe(true);
      expect(new Set(lens).size === 1, `${it.id}: ${o.label}`).toBe(!!o.correct);
    }
  });

  it('正多角形: 回る角度の答え × 回数 ＝ 360 で、その命令で とじる', () => {
    const nums = itemsOf(polygon).filter((it): it is NumberItem => it.engine === 'number');
    let checked = 0;
    for (const it of nums) {
      const ans = it.fields[0]!.answer;
      if (ans.kind !== 'int') continue;
      const v = ans.value;
      const p = plainText(it.prompt);
      const turn = /みぎに (\d+)ど/.exec(p);
      let n: number;
      let d: number;
      if (it.id.startsWith('ta-')) {
        // 回る角度を答える: 正 n 角形の n は かどの数（答え × n ＝ 360）
        d = v;
        n = 360 / v;
      } else if (turn && /なんかい/.test(p)) {
        d = Number(turn[1]);
        n = v;
      } else continue;
      checked++;
      expect(Number.isInteger(n), it.id).toBe(true);
      expect(n * d, it.id).toBe(360);
      const tr = trace(repeatSteps(n, FW(1), TR(d)));
      expect(tr.closed && tr.turned === 360, it.id).toBe(true);
      for (const w of it.wrongAnswers ?? []) expect(Number(w.value), it.id).not.toBe(v);
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });
});

// ---- 格子の手順 ----

describe('格子の手順（program・landing）', () => {
  const progs = MINE.flatMap(itemsOf).filter((it): it is ProgramItem => it.engine === 'program');
  const worldOf = (it: ProgramItem) => ({
    w: it.grid.w,
    h: it.grid.h,
    walls: it.grid.walls,
    start: it.start,
    goal: it.goal,
  });

  it('正答の例は エンジンの実行器で ゴールに着き、札の数の上限を こえない', () => {
    expect(progs.length).toBeGreaterThan(20);
    for (const it of progs) {
      expect(engineRun(worldOf(it), it.solution).outcome, it.id).toBe('goal');
      if (it.maxCards !== undefined)
        expect(engineCardCount(it.solution), it.id).toBeLessThanOrEqual(it.maxCards);
      if (it.initial)
        expect(engineRun(worldOf(it), it.initial).outcome, `${it.id}: なおす前で着く`).not.toBe(
          'goal',
        );
    }
  });

  it('センサーの ロボット: 「もし かべなら まがる、すすむ」の ずっと くりかえす（4まい）でも 正解', () => {
    for (const it of progs.filter((p) => p.id.startsWith('change-'))) {
      const turn = JSON.stringify(it.solution).includes('turnLeft') ? L : R;
      const alt: Cmd[] = [rep('goal', { op: 'if', cond: 'wall-ahead', body: [turn] }, F)];
      expect(engineRun(worldOf(it), alt).outcome, it.id).toBe('goal');
      expect(engineCardCount(alt)).toBeLessThanOrEqual(it.maxCards!);
    }
  });

  it('つなげた手順の「どこに つく」: みぎ・ひだりの とりちがえに「つなぎめの むき忘れ」を つけない', () => {
    for (const it of itemsOf(decompose).filter((x) => x.id.startsWith('join-alt-')) as ChoiceItem[])
      for (const o of it.options) expect(o.misconception, it.id).not.toBe('forget-turn');
  });
});

// ---- efficient: 短い書き方 ----

/** cmdText の文（「くりかえす 2かい（すすむ、みぎを むく）」）→ 命令の列 */
function parseCmds(s: string): Cmd[] {
  const out: Cmd[] = [];
  let i = 0;
  const name: Record<string, Cmd> = { すすむ: F, 'みぎを むく': R, 'ひだりを むく': L };
  const parseList = (): Cmd[] => {
    const list: Cmd[] = [];
    while (i < s.length && s[i] !== '）') {
      if (s.startsWith('、', i)) {
        i++;
        continue;
      }
      const m = /^くりかえす (\d+)かい（/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const body = parseList();
        i++; // ）
        list.push(rep(Number(m[1]), ...body));
        continue;
      }
      const k = Object.keys(name).find((n) => s.startsWith(n, i));
      if (!k) throw new Error(`読めない: ${s.slice(i)}`);
      list.push(name[k]!);
      i += k.length;
    }
    return list;
  };
  out.push(...parseList());
  return out;
}
const flatOps = (p: readonly Cmd[]): string[] =>
  p.flatMap((c) =>
    c.op === 'repeat'
      ? Array.from({ length: c.times as number }, () => flatOps(c.body)).flat()
      : [c.op],
  );

/** くりかえしを 1だんだけ つかった いちばん少ない札の数（周期で まとめる・まとめない） */
function bestOneLevel(ops: string[]): number {
  let best = ops.length;
  for (let p = 1; p < ops.length; p++) {
    if (ops.length % p) continue;
    if (ops.every((o, i) => o === ops[i % p])) best = Math.min(best, 1 + p);
  }
  return best;
}

describe('よりよい手順（efficient）', () => {
  it('「おなじ うごきの いちばん みじかい てじゅん」の正解は、もとの手順と同じ動きで、1だんの くりかえしより 長くない', () => {
    const eqs = itemsOf(efficient).filter((x) => x.id.startsWith('cards-alt-')) as ChoiceItem[];
    expect(eqs.length).toBe(3);
    for (const it of eqs) {
      const given = it.figure && 'label' in it.figure ? String(it.figure.label) : '';
      const long = parseCmds(given.replace(/^もとの てじゅん: /, ''));
      const right = it.options.find((o) => o.correct)!;
      const rLabel = String((right.figure as { label: string }).label).replace(
        /^.の てじゅん: /,
        '',
      );
      const rp = parseCmds(rLabel);
      expect(flatOps(rp).join(), it.id).toBe(flatOps(long).join());
      expect(engineCardCount(rp), it.id).toBeLessThanOrEqual(bestOneLevel(flatOps(long)));
    }
  });

  it('数の問題の 誤りの数は かさならず、正答と ちがう', () => {
    for (const u of MINE)
      for (const it of itemsOf(u).filter((x): x is NumberItem => x.engine === 'number')) {
        const vals = (it.wrongAnswers ?? []).map((w) => w.value);
        expect(new Set(vals).size, it.id).toBe(vals.length);
        const a = it.fields[0]!.answer;
        if (a.kind === 'int') expect(vals, it.id).not.toContain(String(a.value));
      }
  });
});

// ---- 県をみつける ----

describe('県をみつける しつもん（prefecture-finder）', () => {
  /** ふだに出る県（ひらがな）と、事実（海に面する・県庁所在地と同名・本州） */
  const REAL: Record<string, [boolean, boolean, boolean]> = {
    えひめ: [true, false, false], // 県庁は松山市・四国
    あおもり: [true, true, true],
    とちぎ: [false, false, true], // 宇都宮市
    ながの: [false, true, true],
    あいち: [true, false, true], // 名古屋市
    なら: [false, true, true],
    ひょうご: [true, false, true], // 神戸市
    おきなわ: [true, false, false], // 那覇市
    やまなし: [false, false, true], // 甲府市
    ふくおか: [true, true, false],
  };

  it('ふだの ○× は 事実どおり（北海道は「県」でないので出さない）', () => {
    const all = JSON.stringify(prefectureFinder);
    expect(all).not.toContain('ほっかいどう');
    for (const it of itemsOf(prefectureFinder).filter((x) =>
      x.id.startsWith('narrow-n'),
    ) as ChoiceItem[])
      for (const o of it.options) {
        const facts = REAL[o.label!];
        expect(facts, o.label).toBeDefined();
        // ふだの図: A・B・C の順に ○（circle）か ×（path）
        const marks = [
          ...String((o.figure as { markup: string }).markup).matchAll(/<(circle|path) /g),
        ].map((m) => m[1] === 'circle');
        expect(marks, `${it.id} ${o.label}`).toEqual(facts);
      }
  });

  it('「もう みつかった？」: 答えが かたよらず、誤概念が 向きどおり', () => {
    const items = itemsOf(prefectureFinder).filter((x) =>
      x.id.startsWith('fewer-alt-'),
    ) as ChoiceItem[];
    const answers = new Set(items.map((it) => it.options.find((o) => o.correct)!.label));
    expect(answers.size).toBe(2);
    for (const it of items)
      for (const o of it.options.filter((x) => !x.correct))
        expect(o.misconception, it.id).toBe(o.label === 'みつかった' ? 'not-enough' : 'too-many-q');
  });
});
