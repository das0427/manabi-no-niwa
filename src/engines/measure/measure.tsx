/**
 * measure エンジン: 長さ・かさ・重さを測る。
 *  read … ものさし・ます・はかりの目盛りを読む（答えは量。「□cm□mm」は複数欄）
 *  set  … 目盛りに合わせる（ものさしの上で線の終わり・ますの水の高さ・はかりの針をタップ。最小目盛りへ吸着。
 *         ◀▶ で1目盛りずつ直せる）
 * 量は基準の単位（scale.unit）の値で持ち、有理数で比べる（src/core/answer/number.ts）。
 */
import { useState } from 'react';
import { eq, parseNumberInput, RETRY_MESSAGE, type Rational } from '../../core/answer/number';
import type { ItemBase, RichText } from '../../curriculum/types';
import type { Judgement } from '../types';
import {
  clampInt,
  ratAdd,
  ratDiv,
  ratMul,
  ratSub,
  ratText,
  ratToNumber,
  svgPoint,
  toRational,
  type KitEngineDef,
  type KitProps,
} from '../numberline/kit';
import { NumFields, NumKeys, useNumEntry } from '../numberline/NumPad';
import './measure.css';

export type MeasureInstrument = 'ruler' | 'masu' | 'scale';

export interface MeasureScale {
  /** 基準の単位（値はすべてこの単位: 'mm'・'cm'・'mL'・'dL'・'g' など） */
  unit: string;
  /** 目盛りのはじめ（既定 0） */
  min?: number;
  /** 目盛りのおわり（ます: 1つのますの かさ、はかり: ひとまわりの重さ） */
  max: number;
  /** 最小目盛り（合わせる問題はここへ吸着） */
  minor: number;
  /** 中くらいの目盛りの間隔（例 5mm） */
  mid?: number;
  /** 数字を書く長い目盛りの間隔（例 10mm） */
  major: number;
  /** 書く数字 = 値 ÷ labelFactor（例 mm の目盛りに cm の数字を書く → 10） */
  labelFactor?: number;
  /** 道具に書く単位（既定は unit。labelFactor を使うときは 'cm' など） */
  labelUnit?: string;
}

export interface MeasureField {
  /** 欄の後ろの単位（「cm」「mm」） */
  unit: string;
  /** 1 その単位 = factor 基準単位（基準 mm で cm の欄なら 10） */
  factor: number;
}

export interface MeasureItem extends ItemBase {
  engine: 'measure';
  instrument: MeasureInstrument;
  scale: MeasureScale;
  task: 'read' | 'set';
  /** 正答の量（基準の単位） */
  value: number;
  /** ものさし: 測る物の左はしの位置（既定 = 目盛りのはじめ）。0 でない所から測る問題に */
  from?: number;
  /** ものさしで測る物の形（既定 tape） */
  object?: 'tape' | 'pencil' | 'line';
  /** read: 答えの欄（大きい単位から順に。「□cm□mm」なら [{cm,10},{mm,1}]）。既定は基準の単位1欄 */
  fields?: MeasureField[];
  keys?: 'decimal'[];
  /** set: 許容誤差（基準の単位。既定 0 = 最小目盛りぴったり） */
  tolerance?: number;
  misconceptions?: {
    /** ものさしの はしでなく、物の右はしの目盛りをそのまま読んだ */
    fromEnd?: string;
    /** 「□cm□mm」の欄を取り違えた */
    fieldSwap?: string;
    /** 最小目盛りを 1 とみて数えた（1目盛り 20g を 1g と） */
    minorAsOne?: string;
  };
  /** 決まった誤答の量（基準の単位） → 誤概念 */
  wrongAnswers?: { value: number; misconception: string }[];
}

/** fields: 数字キーの欄、tick: 合わせた目盛りの番号（はじめ から最小目盛りいくつ目か） */
export type MeasureResponse = { fields: string[] } | { tick: number };

// ---- 計算 ----
interface Sc {
  min: Rational;
  minor: Rational;
  n: number;
}
function scOf(s: MeasureScale): Sc | null {
  const min = toRational(s.min ?? 0);
  const max = toRational(s.max);
  const minor = toRational(s.minor);
  if (!min || !max || !minor || minor.n <= 0) return null;
  const k = ratDiv(ratSub(max, min), minor);
  if (k.d !== 1 || k.n <= 0) return null;
  return { min, minor, n: k.n };
}
function tickValue(sc: Sc, i: number): Rational {
  return ratAdd(sc.min, ratMul(sc.minor, { n: i, d: 1 }));
}
function fromOf(item: MeasureItem): Rational {
  return toRational(item.from ?? item.scale.min ?? 0)!;
}
function fieldsOf(item: MeasureItem): MeasureField[] {
  return item.fields ?? [{ unit: item.scale.unit, factor: 1 }];
}
/** 量を欄に分ける（大きい単位から。最後の欄は小数になりうる） */
function splitValue(v: Rational, fields: MeasureField[]): Rational[] {
  const out: Rational[] = [];
  let rest = v;
  fields.forEach((f, i) => {
    const fr = toRational(f.factor)!;
    const q = ratDiv(rest, fr);
    if (i === fields.length - 1) out.push(q);
    else {
      const whole = Math.floor(ratToNumber(q) + 1e-9);
      out.push({ n: whole, d: 1 });
      rest = ratSub(rest, ratMul({ n: whole, d: 1 }, fr));
    }
  });
  return out;
}

function misOf(item: MeasureItem, got: Rational, parts?: Rational[]): string | undefined {
  const known = item.wrongAnswers?.find((w) => {
    const r = toRational(w.value);
    return r !== null && eq(r, got);
  });
  if (known) return known.misconception;
  const want = toRational(item.value)!;
  const mis = item.misconceptions ?? {};
  const from = toRational(item.from ?? item.scale.min ?? 0)!;
  if (mis.fromEnd && from.n !== 0 && eq(got, ratAdd(from, want))) return mis.fromEnd;
  const fs = fieldsOf(item);
  if (mis.fieldSwap && parts && fs.length === 2) {
    const c = splitValue(want, fs);
    if (eq(parts[0]!, c[1]!) && eq(parts[1]!, c[0]!)) return mis.fieldSwap;
  }
  const minor = toRational(item.scale.minor)!;
  if (mis.minorAsOne && !eq(minor, { n: 1, d: 1 })) {
    // 読む: 目盛りの数をそのまま量とした ／ 合わせる: 量の数だけ目盛りを進めた
    const k = ratDiv(want, minor);
    if (item.task === 'read' && k.d === 1 && eq(got, k)) return mis.minorAsOne;
    if (item.task === 'set' && eq(got, ratMul(want, minor))) return mis.minorAsOne;
  }
  return undefined;
}

export function judgeMeasure(item: MeasureItem, res: MeasureResponse): Judgement {
  const want = toRational(item.value);
  const sc = scOf(item.scale);
  if (!want || !sc) return { result: 'wrong', mark: true };
  if (item.task === 'read') {
    if (!('fields' in res)) return { result: 'retry', message: RETRY_MESSAGE.unreadable };
    const fs = fieldsOf(item);
    const parts: Rational[] = [];
    for (let i = 0; i < fs.length; i++) {
      const p = parseNumberInput(res.fields[i] ?? '');
      if (!p || p.value.n < 0) return { result: 'retry', message: RETRY_MESSAGE.unreadable };
      // 分数は量の答えにしない（形式の違い）
      if (p.form === 'fraction' || p.form === 'mixed')
        return { result: 'retry', message: RETRY_MESSAGE.form };
      parts.push(p.value);
    }
    let total: Rational = { n: 0, d: 1 };
    fs.forEach((f, i) => (total = ratAdd(total, ratMul(parts[i]!, toRational(f.factor)!))));
    if (eq(total, want)) {
      // 値は合っている。「2cm15mm」のように欄の分け方が違うときは もう一度
      const canon = splitValue(want, fs);
      if (parts.every((p, i) => eq(p, canon[i]!))) return { result: 'correct' };
      return { result: 'retry', message: RETRY_MESSAGE.form };
    }
    return { result: 'wrong', misconception: misOf(item, total, parts), mark: true };
  }
  if (!('tick' in res) || !Number.isInteger(res.tick) || res.tick < 0 || res.tick > sc.n)
    return { result: 'retry', message: 'めもりの ところを タップしてね' };
  // 測った量 = 合わせた目盛り − 測りはじめ（ものさしの左はし。ます・はかりは目盛りのはじめ）
  const got = ratSub(tickValue(sc, res.tick), fromOf(item));
  const tol = item.tolerance ?? 0;
  if (Math.abs(ratToNumber(ratSub(got, want))) <= tol + 1e-9) return { result: 'correct' };
  return { result: 'wrong', misconception: misOf(item, got), mark: res.tick };
}

export function checkMeasure(item: MeasureItem): string[] {
  const errs: string[] = [];
  const sc = scOf(item.scale);
  if (!sc) {
    errs.push('目盛りの min・max・minor が読めない、または (max−min) が最小目盛りで割り切れない');
    return errs;
  }
  if (sc.n > 400) errs.push(`目盛りが多すぎる（${sc.n}。400まで）`);
  const onGrid = (x: number) => {
    const r = toRational(x);
    return !!r && ratDiv(ratSub(r, sc.min), sc.minor).d === 1;
  };
  if (!onGrid(item.scale.major)) errs.push('長い目盛りの間隔が最小目盛りの倍数でない');
  if (item.scale.mid !== undefined && !onGrid(item.scale.mid))
    errs.push('中くらいの目盛りの間隔が最小目盛りの倍数でない');
  const want = toRational(item.value);
  if (!want || want.n <= 0) {
    errs.push('正答の量が読めない、または 0 以下');
    return errs;
  }
  const max = toRational(item.scale.max)!;
  const min = sc.min;
  const from = toRational(item.from ?? item.scale.min ?? 0)!;
  if (item.instrument === 'ruler') {
    if (ratToNumber(ratAdd(from, want)) > ratToNumber(max) + 1e-9)
      errs.push('測る物が ものさしから はみ出す');
    if (ratToNumber(from) < ratToNumber(min) - 1e-9) errs.push('測る物の左はしが目盛りの外');
    if (!onGrid(ratToNumber(from))) errs.push('測る物の左はしが目盛りの上にない');
  }
  if (item.instrument === 'scale' && ratToNumber(want) > ratToNumber(max) + 1e-9)
    errs.push('重さが はかりの ひとまわりを こえる');
  if (
    item.instrument === 'masu' &&
    item.task === 'set' &&
    ratToNumber(want) > ratToNumber(max) + 1e-9
  )
    errs.push('合わせる かさが ます1つを こえる');
  if (
    item.instrument === 'masu' &&
    item.task === 'read' &&
    ratToNumber(want) / ratToNumber(max) > 6
  )
    errs.push('ますが 6こを こえる');
  if (item.task === 'read' || (item.tolerance ?? 0) < ratToNumber(sc.minor) / 2) {
    // 読む問題・ぴったり合わせる問題は、正答が目盛りの上にあること
    const k = ratDiv(
      ratSub(item.instrument === 'masu' ? modCap(want, max, min) : want, min),
      sc.minor,
    );
    if (k.d !== 1) errs.push('正答の量が目盛りの上にない');
  }
  if (item.task === 'read') {
    const fs = fieldsOf(item);
    if (fs.length === 0) errs.push('答えの欄が無い');
    for (let i = 1; i < fs.length; i++)
      if (!(fs[i]!.factor < fs[i - 1]!.factor)) errs.push('欄は大きい単位から順に並べる');
    const parts = splitValue(want, fs);
    const last = parts[parts.length - 1]!;
    if (last.d !== 1 && !item.keys?.includes('decimal'))
      errs.push('小数の答えなのに小数点キーが無い');
    if (fs.length === 1 && fs[0]!.unit !== item.scale.unit && fs[0]!.factor === 1)
      errs.push('欄の単位が基準の単位と違うのに factor が 1');
  }
  for (const w of item.wrongAnswers ?? []) {
    const r = toRational(w.value);
    if (!r) errs.push(`誤答の例 ${w.value} が読めない`);
    else if (eq(r, want)) errs.push(`誤答の例 ${w.value} が正答と同じ`);
  }
  return errs;
}

/** ますを何はいも使うときの、最後のますの かさ */
function modCap(v: Rational, max: Rational, min: Rational): Rational {
  const cap = ratSub(max, min);
  const k = Math.floor(ratToNumber(ratDiv(v, cap)) - 1e-9);
  return k > 0 ? ratSub(v, ratMul(cap, { n: k, d: 1 })) : v;
}

export function measureAnswerText(item: MeasureItem): RichText {
  const want = toRational(item.value);
  if (!want) return '';
  if (item.task === 'set') return `${ratText(want, 'decimal')}${item.scale.unit}`;
  const fs = fieldsOf(item);
  const parts = splitValue(want, fs);
  return fs
    .map((f, i) => ({ f, p: parts[i]! }))
    .filter(({ p }) => fs.length === 1 || p.n !== 0)
    .map(({ f, p }) => `${ratText(p, 'decimal')}${f.unit}`)
    .join('');
}

// ---- 画面 ----
function labelOf(item: MeasureItem, v: Rational): string {
  const f = toRational(item.scale.labelFactor ?? 1)!;
  return ratText(ratDiv(v, f), 'decimal');
}
function tickKind(item: MeasureItem, sc: Sc, i: number): 'major' | 'mid' | 'minor' {
  const off = ratMul(sc.minor, { n: i, d: 1 });
  const isMul = (step: number | undefined) => {
    if (step === undefined) return false;
    const s = toRational(step);
    return !!s && ratDiv(off, s).d === 1;
  };
  if (isMul(item.scale.major)) return 'major';
  if (isMul(item.scale.mid)) return 'mid';
  return 'minor';
}
function tickOfValue(sc: Sc, v: Rational): number {
  return Math.round(ratToNumber(ratDiv(ratSub(v, sc.min), sc.minor)));
}

interface InstrProps {
  item: MeasureItem;
  sc: Sc;
  /** 子が合わせた目盛り（set）。read は null */
  tick: number | null;
  wrong: boolean;
  /** 正答の目盛り（revealed の set） */
  answerTick: number | null;
  onTap?: (tick: number) => void;
}

function Ruler({ item, sc, tick, wrong, answerTick, onTap }: InstrProps) {
  const W = 1000;
  const H = 230;
  const L = 40;
  const X = (i: number) => L + (i / sc.n) * (W - L * 2);
  const vb = { x: 0, y: 0, w: W, h: H };
  const fromTick = tickOfValue(sc, toRational(item.from ?? item.scale.min ?? 0)!);
  const endTick =
    item.task === 'read'
      ? fromTick + tickOfValue(sc, ratAdd(sc.min, toRational(item.value)!))
      : tick;
  const ticks = [];
  for (let i = 0; i <= sc.n; i++) {
    const k = tickKind(item, sc, i);
    const len = k === 'major' ? 38 : k === 'mid' ? 26 : 15;
    ticks.push(
      <line
        key={i}
        x1={X(i)}
        y1={110}
        x2={X(i)}
        y2={110 + len}
        className={`ms-tick ms-tick--${k}`}
      />,
    );
    if (k === 'major')
      ticks.push(
        <text key={`l${i}`} x={X(i)} y={186} className="ms-label">
          {labelOf(item, tickValue(sc, i))}
        </text>,
      );
  }
  const obj = item.object ?? 'tape';
  const objShape = (a: number, b: number) =>
    obj === 'line' ? (
      <line x1={X(a)} y1={80} x2={X(b)} y2={80} className="ms-objline" />
    ) : obj === 'pencil' ? (
      <path
        d={`M ${X(a)} 62 H ${X(b) - 34} L ${X(b)} 80 L ${X(b) - 34} 98 H ${X(a)} Z`}
        className="ms-obj"
      />
    ) : (
      <rect x={X(a)} y={62} width={Math.max(2, X(b) - X(a))} height={36} className="ms-obj" />
    );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`mk-svg ms-ruler${wrong ? ' is-wrong' : ''}`}
      role="img"
      aria-label="ものさし"
      data-testid="instrument"
      onClick={
        onTap
          ? (e) => onTap(clampInt(((svgPoint(e, vb).x - L) / (W - L * 2)) * sc.n, 0, sc.n))
          : undefined
      }
    >
      {onTap ? <rect x={0} y={0} width={W} height={H} className="mk-hit" /> : null}
      <rect x={L - 24} y={108} width={W - 2 * L + 48} height={100} rx={8} className="ms-body" />
      {ticks}
      <text x={W - L + 4} y={222} className="ms-unit">
        {item.scale.labelUnit ?? item.scale.unit}
      </text>
      {endTick !== null && endTick !== undefined ? objShape(fromTick, endTick) : null}
      {item.task === 'set' && tick !== null ? (
        <line
          x1={X(tick)}
          y1={50}
          x2={X(tick)}
          y2={110}
          className={`ms-pointer${wrong ? ' is-wrong' : ''}`}
        />
      ) : null}
      {answerTick !== null && answerTick !== tick ? (
        <line x1={X(answerTick)} y1={40} x2={X(answerTick)} y2={150} className="ms-ghost" />
      ) : null}
    </svg>
  );
}

function Masu({ item, sc, tick, wrong, answerTick, onTap }: InstrProps) {
  const cap = sc.n;
  const BW = 150;
  const BH = 300;
  const TOP = 20;
  const Y = (i: number) => TOP + BH - (i / cap) * BH;
  // 読む問題: 何はいぶんか（いっぱいの ますと、最後の ます）
  const levels: number[] = [];
  if (item.task === 'read') {
    let rest = tickOfValue(sc, ratAdd(sc.min, toRational(item.value)!));
    while (rest > cap) {
      levels.push(cap);
      rest -= cap;
    }
    levels.push(rest);
  } else levels.push(tick ?? 0);
  const gap = 90;
  const W = levels.length * (BW + gap) + 20;
  const H = BH + TOP + 40;
  const vb = { x: 0, y: 0, w: W, h: H };
  const lastX = (levels.length - 1) * (BW + gap) + 70;
  const ticksFor = (x0: number) => {
    const out = [];
    for (let i = 0; i <= cap; i++) {
      const k = tickKind(item, sc, i);
      const len = k === 'major' ? 40 : k === 'mid' ? 28 : 16;
      out.push(
        <line
          key={i}
          x1={x0 + BW - len}
          y1={Y(i)}
          x2={x0 + BW}
          y2={Y(i)}
          className={`ms-tick ms-tick--${k}`}
        />,
      );
      if (k === 'major' && i > 0)
        out.push(
          <text key={`l${i}`} x={x0 - 8} y={Y(i) + 9} className="ms-label ms-label--left">
            {labelOf(item, tickValue(sc, i))}
          </text>,
        );
    }
    return out;
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`mk-svg ms-masu${wrong ? ' is-wrong' : ''}`}
      role="img"
      aria-label="ます"
      data-testid="instrument"
      onClick={
        onTap
          ? (e) => {
              const p = svgPoint(e, vb);
              onTap(clampInt(((TOP + BH - p.y) / BH) * cap, 0, cap));
            }
          : undefined
      }
    >
      {onTap ? <rect x={0} y={0} width={W} height={H} className="mk-hit" /> : null}
      {levels.map((lv, k) => {
        const x0 = k * (BW + gap) + 70;
        return (
          <g key={k}>
            {lv > 0 ? (
              <rect x={x0} y={Y(lv)} width={BW} height={Y(0) - Y(lv)} className="ms-water" />
            ) : null}
            {lv > 0 ? (
              <line x1={x0} y1={Y(lv)} x2={x0 + BW} y2={Y(lv)} className="ms-surface" />
            ) : null}
            {ticksFor(x0)}
            <path
              d={`M ${x0} ${TOP - 6} V ${TOP + BH} H ${x0 + BW} V ${TOP - 6}`}
              className="ms-cup"
            />
          </g>
        );
      })}
      <text x={W - 6} y={H - 6} className="ms-unit">
        {item.scale.labelUnit ?? item.scale.unit}
      </text>
      {answerTick !== null && answerTick !== tick ? (
        <line
          x1={lastX - 14}
          y1={Y(answerTick)}
          x2={lastX + BW + 14}
          y2={Y(answerTick)}
          className="ms-ghost"
        />
      ) : null}
    </svg>
  );
}

function Dial({ item, sc, tick, wrong, answerTick, onTap }: InstrProps) {
  const R = 120;
  const vb = { x: -160, y: -170, w: 320, h: 330 };
  const A = (i: number) => (i / sc.n) * 360;
  const P = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  };
  const ticks = [];
  for (let i = 0; i < sc.n; i++) {
    const k = tickKind(item, sc, i);
    const len = k === 'major' ? 22 : k === 'mid' ? 15 : 8;
    const a = P(A(i), R - len);
    const b = P(A(i), R);
    ticks.push(
      <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`ms-tick ms-tick--${k}`} />,
    );
    if (k === 'major') {
      const t = P(A(i), R - 44);
      ticks.push(
        <text key={`l${i}`} x={t.x} y={t.y + 8} className="ms-label ms-label--dial">
          {labelOf(item, tickValue(sc, i))}
        </text>,
      );
    }
  }
  const needleTick =
    item.task === 'read' ? tickOfValue(sc, ratAdd(sc.min, toRational(item.value)!)) : (tick ?? 0);
  const nd = P(A(needleTick), R - 6);
  const gh = answerTick !== null && answerTick !== tick ? P(A(answerTick), R - 6) : null;
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={`mk-svg ms-dial${wrong ? ' is-wrong' : ''}`}
      role="img"
      aria-label="はかり"
      data-testid="instrument"
      onClick={
        onTap
          ? (e) => {
              const p = svgPoint(e, vb);
              const deg = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 90 + 360) % 360;
              onTap(Math.round((deg / 360) * sc.n) % sc.n);
            }
          : undefined
      }
    >
      <rect x={-110} y={-166} width={220} height={22} rx={6} className="ms-plate" />
      <circle r={R + 14} className="ms-dialbody" />
      {onTap ? <circle r={R + 30} className="mk-hit" /> : null}
      <circle r={R} className="ms-face" />
      {ticks}
      {gh ? <line x1={0} y1={0} x2={gh.x} y2={gh.y} className="ms-ghost" /> : null}
      <line x1={0} y1={0} x2={nd.x} y2={nd.y} className={`ms-needle${wrong ? ' is-wrong' : ''}`} />
      <circle r={8} className="ms-pin" />
      <text x={0} y={44} className="ms-unit ms-unit--dial">
        {item.scale.labelUnit ?? item.scale.unit}
      </text>
    </svg>
  );
}

function Instrument(p: InstrProps) {
  switch (p.item.instrument) {
    case 'ruler':
      return <Ruler {...p} />;
    case 'masu':
      return <Masu {...p} />;
    case 'scale':
      return <Dial {...p} />;
  }
}

function MeasureView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<MeasureItem, MeasureResponse>) {
  const sc = scOf(item.scale);
  const locked = disabled || revealed;
  const fs = fieldsOf(item);
  const entry = useNumEntry(fs.length, locked);
  const [tick, setTick] = useState<number | null>(null);
  if (!sc) return null;
  const cls = `mk eng-measure eng-measure--${item.instrument}`;
  if (item.task === 'read') {
    const want = toRational(item.value)!;
    const parts = splitValue(want, fs);
    return (
      <div className={cls}>
        <div className="mk__main">
          <Instrument item={item} sc={sc} tick={null} wrong={false} answerTick={null} />
          <NumFields
            entry={entry}
            fields={fs.map((f) => ({ unit: f.unit }))}
            ctx={ctx}
            wrong={!!wrongMark}
            revealed={revealed}
            answers={parts.map((p) => ratText(p, 'decimal'))}
          />
        </div>
        <NumKeys
          entry={entry}
          keys={item.keys}
          disabled={locked}
          onSubmit={() => submit({ fields: entry.vals })}
        />
      </div>
    );
  }
  const want = toRational(item.value)!;
  const answerTick = revealed ? tickOfValue(sc, ratAdd(fromOf(item), want)) : null;
  const wrongNow = typeof wrongMark === 'number' && wrongMark === tick && !revealed;
  const move = (d: number) => {
    if (locked) return;
    setTick((t) => {
      const next = (t ?? tickOfValue(sc, toRational(item.from ?? item.scale.min ?? 0)!)) + d;
      return item.instrument === 'scale' ? ((next % sc.n) + sc.n) % sc.n : clampInt(next, 0, sc.n);
    });
  };
  const vertical = item.instrument === 'masu';
  return (
    <div className={cls}>
      <div className="mk__main">
        <Instrument
          item={item}
          sc={sc}
          tick={tick}
          wrong={wrongNow}
          answerTick={answerTick}
          onTap={locked ? undefined : setTick}
        />
      </div>
      <div className="mk__side eng-measure__side">
        <div className="mk-row">
          <button
            type="button"
            className="mk-btn"
            onClick={() => move(-1)}
            disabled={locked}
            aria-label="ひとめもり へらす"
            data-testid="nudge-minus"
          >
            {vertical ? '▼' : '◀'}
          </button>
          <button
            type="button"
            className="mk-btn"
            onClick={() => move(1)}
            disabled={locked}
            aria-label="ひとめもり ふやす"
            data-testid="nudge-plus"
          >
            {vertical ? '▲' : '▶'}
          </button>
        </div>
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          onClick={() => tick !== null && submit({ tick })}
          disabled={locked || tick === null}
          data-testid="check"
        >
          こたえあわせ
        </button>
      </div>
    </div>
  );
}

export const measureEngine: KitEngineDef<MeasureItem, MeasureResponse> = {
  id: 'measure',
  Component: MeasureView,
  judge: judgeMeasure,
  check: checkMeasure,
  answerText: measureAnswerText,
};
