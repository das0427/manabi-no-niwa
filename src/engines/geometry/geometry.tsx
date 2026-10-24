/**
 * geometry エンジン: 図形。
 *  pick  … 形を見分ける（図の選択肢から選ぶ。1つ／すべて）
 *  draw  … 作図（格子の点をタップして頂点を結ぶ・直線を引く。点は格子に吸着。最初の点をもう一度タップで閉じる）
 *          判定: 同じ頂点の多角形（始点・向きは問わない）、合同、拡大・縮小、線対称・点対称の位置、形の仲間と辺の長さ、
 *          垂直・平行な直線
 *  angle … 角の大きさを分度器で測る（数字キー。許容誤差 既定 ±2度）
 */
import { useState } from 'react';
import { parseNumberInput, RETRY_MESSAGE } from '../../core/answer/number';
import type { ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import type { Figure as FigureData } from '../figure/types';
import { svgPoint, type KitEngineDef, type KitProps } from '../numberline/kit';
import { NumFields, NumKeys, useNumEntry } from '../numberline/NumPad';
import type { Judgement } from '../types';
import {
  isSimple,
  isTranslation,
  lineRelation,
  mostSpecific,
  normalizePolygon,
  onLine,
  reflectPt,
  rotate180,
  sameCycle,
  samePt,
  sameSides,
  shapeClasses,
  SHAPE_NAME,
  similarCycle,
  type Pt,
  type ShapeClass,
} from './shapes';
import './geometry.css';

export type { Pt, ShapeClass } from './shapes';

/** 図の中の形（格子の座標。closed: false なら折れ線・線分） */
export interface GeoShape {
  points: Pt[];
  closed?: boolean;
  /** 頂点の名前（「ア」「A」など。points と同じ順） */
  names?: string[];
  /** 直線として両はしをのばして描く（2点のとき） */
  infinite?: boolean;
}

export interface GeoOption {
  /** 形（座標は自由。枠に合わせて描く） */
  shape?: GeoShape;
  /** または図（Figure） */
  figure?: FigureData;
  label?: RichText;
  correct?: boolean;
  misconception?: string;
}

export type GeoTarget =
  /** この頂点の多角形（始点・回る向きは問わない。辺の途中の点は無視） */
  | { kind: 'exact'; points: Pt[] }
  /** この多角形と合同（位置・向きは問わない。allowFlip: false なら裏返しは別） */
  | { kind: 'congruent'; points: Pt[]; allowFlip?: boolean }
  /** この多角形の ratio 倍の拡大図・縮図（位置・向きは問わない） */
  | { kind: 'similar'; points: Pt[]; ratio: number }
  /** この多角形を直線 axis について線対称の位置に */
  | { kind: 'reflect'; points: Pt[]; axis: [Pt, Pt] }
  /** この多角形を点 center について点対称の位置に */
  | { kind: 'rotate180'; points: Pt[]; center: Pt }
  /** 形の仲間（性質で判定）。sides: 辺の長さ（順不同）。exclusive: より特別な仲間を除く（長方形に正方形を含めない） */
  | { kind: 'shape'; shape: ShapeClass; sides?: number[]; exclusive?: boolean }
  /** 直線 to に垂直／平行な直線（through: この点を通る） */
  | { kind: 'perpendicular' | 'parallel'; to: [Pt, Pt]; through?: Pt };

export type GeoTask =
  | { kind: 'pick'; options: GeoOption[]; multi?: boolean }
  | {
      kind: 'draw';
      /** 格子の大きさ（ます目の数。点は 0〜w, 0〜h） */
      grid: { w: number; h: number };
      /** はじめから描いてある形（写す元・対称の元など） */
      given?: GeoShape[];
      target: GeoTarget;
    }
  | {
      kind: 'angle';
      /** 角の大きさ（度。1〜359） */
      degrees: number;
      /** 1つ目の辺の向き（度。右向きが 0、反時計回り。既定 0） */
      base?: number;
      /** 分度器を重ねて見せる（既定 true） */
      protractor?: boolean;
      /** 許容誤差（度。既定 2） */
      tolerance?: number;
    };

export type GeoMis =
  /** 対称・拡大の問題で、ずらしただけ（同じ向き・同じ大きさ）の形をかいた */
  | 'translated'
  /** 拡大・縮小の問題で、同じ大きさの形をかいた */
  | 'sameSize'
  /** 仲間は合っているが辺の長さが違う */
  | 'wrongSides'
  /** 別の仲間の形をかいた */
  | 'wrongClass'
  /** 垂直と平行を取り違えた */
  | 'swapPerpPar'
  /** 向きは合っているが、決められた点を通らない */
  | 'notThrough'
  /** 分度器の反対側の目盛りを読んだ（180−角） */
  | 'otherScale'
  /** 180度より大きい角で、内側の角（360−角）を答えた */
  | 'reflexComplement';

export interface GeometryItem extends ItemBase {
  engine: 'geometry';
  task: GeoTask;
  misconceptions?: Partial<Record<GeoMis, string>>;
}

/** pick: 選んだ番号、path: 作図の点の列（closed: 閉じたか）、fields: 角の大きさの入力 */
export type GeometryResponse =
  { pick: number[] } | { path: Pt[]; closed: boolean } | { fields: string[] };

// ---- 判定 ----
function targetPolygon(t: GeoTarget): Pt[] | null {
  switch (t.kind) {
    case 'exact':
      return t.points;
    case 'reflect':
      return t.points.map((p) => reflectPt(p, t.axis[0], t.axis[1]));
    case 'rotate180':
      return t.points.map((p) => rotate180(p, t.center));
    default:
      return null;
  }
}

const isLineTarget = (t: GeoTarget) => t.kind === 'perpendicular' || t.kind === 'parallel';

function judgeDraw(
  item: GeometryItem,
  t: Extract<GeoTask, { kind: 'draw' }>,
  path: Pt[],
  closed: boolean,
): Judgement {
  const mis = item.misconceptions ?? {};
  const g = t.target;
  if (isLineTarget(g)) {
    const tg = g as Extract<GeoTarget, { kind: 'perpendicular' | 'parallel' }>;
    if (path.length !== 2 || samePt(path[0]!, path[1]!))
      return { result: 'retry', message: 'てんを 2つ タップして せんを ひいてね' };
    const mine: [Pt, Pt] = [path[0]!, path[1]!];
    const rel = lineRelation(tg.to, mine);
    const relOk = rel === tg.kind;
    if (relOk && (!tg.through || onLine(tg.through, mine))) return { result: 'correct' };
    let m: string | undefined;
    if (relOk) m = mis.notThrough;
    else if (
      (tg.kind === 'perpendicular' && rel === 'parallel') ||
      (tg.kind === 'parallel' && rel === 'perpendicular')
    )
      m = mis.swapPerpPar;
    return { result: 'wrong', misconception: m, mark: true };
  }
  if (!closed || path.length < 3)
    return {
      result: 'retry',
      message: 'さいしょの てんを もういちど タップして かたちを とじてね',
    };
  const poly = normalizePolygon(path);
  if (poly.length < 3 || !isSimple(poly)) return { result: 'wrong', mark: true };
  const want = targetPolygon(g);
  if (want) {
    if (sameCycle(poly, normalizePolygon(want))) return { result: 'correct' };
    const src = (g as { points: Pt[] }).points;
    const m =
      g.kind !== 'exact' && isTranslation(normalizePolygon(src), poly) ? mis.translated : undefined;
    return { result: 'wrong', misconception: m, mark: true };
  }
  if (g.kind === 'congruent') {
    if (similarCycle(normalizePolygon(g.points), poly, 1, g.allowFlip ?? true))
      return { result: 'correct' };
    return { result: 'wrong', mark: true };
  }
  if (g.kind === 'similar') {
    const src = normalizePolygon(g.points);
    if (similarCycle(poly, src, g.ratio * g.ratio)) return { result: 'correct' };
    const m = similarCycle(poly, src, 1) ? mis.sameSize : undefined;
    return { result: 'wrong', misconception: m, mark: true };
  }
  // 形の仲間
  const sg = g as Extract<GeoTarget, { kind: 'shape' }>;
  const cls = shapeClasses(poly);
  const classOk = cls.has(sg.shape) && (!sg.exclusive || mostSpecific(poly) === sg.shape);
  const sidesOk = !sg.sides || sameSides(poly, sg.sides);
  if (classOk && sidesOk) return { result: 'correct' };
  return { result: 'wrong', misconception: classOk ? mis.wrongSides : mis.wrongClass, mark: true };
}

function judgeAngle(
  item: GeometryItem,
  t: Extract<GeoTask, { kind: 'angle' }>,
  fields: string[],
): Judgement {
  const p = parseNumberInput(fields[0] ?? '');
  if (!p) return { result: 'retry', message: RETRY_MESSAGE.unreadable };
  const x = p.value.n / p.value.d;
  const tol = t.tolerance ?? 2;
  const near = (v: number) => Math.abs(x - v) <= tol + 1e-9;
  if (near(t.degrees)) return { result: 'correct' };
  const mis = item.misconceptions ?? {};
  let m: string | undefined;
  if (t.degrees < 180 && near(180 - t.degrees)) m = mis.otherScale;
  else if (t.degrees > 180 && near(360 - t.degrees)) m = mis.reflexComplement;
  return { result: 'wrong', misconception: m, mark: true };
}

export function judgeGeometry(item: GeometryItem, res: GeometryResponse): Judgement {
  const t = item.task;
  if (t.kind === 'pick') {
    if (!('pick' in res)) return { result: 'wrong', mark: [] };
    const correct = t.options.flatMap((o, i) => (o.correct ? [i] : []));
    const a = [...new Set(res.pick)].sort((x, y) => x - y);
    if (!t.multi) {
      const i = a[0];
      if (i === undefined || !t.options[i]) return { result: 'wrong', mark: [] };
      if (t.options[i]!.correct) return { result: 'correct' };
      return { result: 'wrong', misconception: t.options[i]!.misconception, mark: [i] };
    }
    if (a.length === correct.length && a.every((v, i) => v === correct[i]))
      return { result: 'correct' };
    const w = a.find((i) => !t.options[i]?.correct);
    return {
      result: 'wrong',
      misconception: w !== undefined ? t.options[w]?.misconception : undefined,
      mark: w !== undefined ? [w] : [],
    };
  }
  if (t.kind === 'draw') {
    if (!('path' in res)) return { result: 'retry', message: RETRY_MESSAGE.unreadable };
    return judgeDraw(item, t, res.path, res.closed);
  }
  if (!('fields' in res)) return { result: 'retry', message: RETRY_MESSAGE.unreadable };
  return judgeAngle(item, t, res.fields);
}

function inGrid(p: Pt, g: { w: number; h: number }): boolean {
  return (
    Number.isInteger(p[0]) &&
    Number.isInteger(p[1]) &&
    p[0] >= 0 &&
    p[1] >= 0 &&
    p[0] <= g.w &&
    p[1] <= g.h
  );
}

export function checkGeometry(item: GeometryItem): string[] {
  const errs: string[] = [];
  const t = item.task;
  if (t.kind === 'pick') {
    const nCorrect = t.options.filter((o) => o.correct).length;
    if (t.options.length < 2) errs.push('選択肢が2つ未満');
    if (nCorrect === 0) errs.push('正解の選択肢が無い');
    if (!t.multi && nCorrect !== 1) errs.push('1つ選ぶ問題なのに正解が1つではない');
    for (const o of t.options) {
      if (!o.shape && !o.figure && o.label === undefined) errs.push('選択肢に形も図も文も無い');
      if (o.correct && o.misconception) errs.push('正解の選択肢に誤概念IDが付いている');
      if (o.shape && o.shape.points.length < 2) errs.push('選択肢の形の点が2つ未満');
    }
    const keys = t.options.map((o) => JSON.stringify([o.shape?.points, o.figure, o.label]));
    if (new Set(keys).size !== keys.length) errs.push('同じ選択肢が重複している');
    return errs;
  }
  if (t.kind === 'angle') {
    if (!(t.degrees > 0 && t.degrees < 360)) errs.push('角の大きさは 0 より大きく 360 より小さい');
    if ((t.tolerance ?? 2) < 0 || (t.tolerance ?? 2) > 5) errs.push('許容誤差は 0〜5度');
    if (t.degrees > 180 && t.degrees < 180 + 2 * (t.tolerance ?? 2) + 1)
      errs.push('180度に近すぎる（測れない）');
    return errs;
  }
  const g = t.grid;
  if (!(
    Number.isInteger(g.w) &&
    Number.isInteger(g.h) &&
    g.w >= 2 &&
    g.h >= 2 &&
    g.w <= 16 &&
    g.h <= 12
  ))
    errs.push('格子は 2〜16 × 2〜12 ます');
  for (const s of t.given ?? [])
    for (const p of s.points) if (!inGrid(p, g)) errs.push(`はじめの形の点 ${p} が格子の外`);
  const tg = t.target;
  if (tg.kind === 'perpendicular' || tg.kind === 'parallel') {
    if (samePt(tg.to[0], tg.to[1])) errs.push('基準の直線の2点が同じ');
    if (tg.through && !inGrid(tg.through, g)) errs.push('通る点が格子の外');
    if (tg.through && onLine(tg.through, tg.to) && tg.kind === 'parallel')
      errs.push('平行な直線の通る点が基準の直線の上');
    // 格子の上で答えがかけること
    if (!canDrawLine(tg, g)) errs.push('格子の点を結んで答えの直線をかけない');
    return errs;
  }
  if (tg.kind === 'shape') {
    if (tg.shape === 'equilateral-triangle') errs.push('正三角形は方眼の格子の点ではかけない');
    if (tg.sides && tg.sides.some((l) => !(l > 0))) errs.push('辺の長さが 0 以下');
    if (tg.sides && (tg.shape.endsWith('triangle') ? tg.sides.length !== 3 : tg.sides.length !== 4))
      errs.push('辺の数が形と合わない');
    return errs;
  }
  if (!('points' in tg)) return errs;
  const src = normalizePolygon(tg.points);
  if (src.length < 3 || !isSimple(src)) errs.push('元の多角形が3点未満、またはねじれている');
  for (const p of tg.points) if (!inGrid(p, g)) errs.push(`点 ${p} が格子の外`);
  const want = targetPolygon(tg);
  if (want)
    for (const p of want)
      if (!inGrid(p, g)) errs.push(`答えの頂点 ${p} が格子の外（または格子の点でない）`);
  if (tg.kind === 'similar' && !(tg.ratio > 0)) errs.push('拡大の比が 0 以下');
  if (tg.kind === 'similar' && tg.ratio === 1) errs.push('拡大の比が 1（合同の問題にする）');
  return errs;
}

function canDrawLine(
  tg: Extract<GeoTarget, { kind: 'perpendicular' | 'parallel' }>,
  g: { w: number; h: number },
): boolean {
  for (let x1 = 0; x1 <= g.w; x1++)
    for (let y1 = 0; y1 <= g.h; y1++)
      for (let x2 = 0; x2 <= g.w; x2++)
        for (let y2 = 0; y2 <= g.h; y2++) {
          if (x1 === x2 && y1 === y2) continue;
          const l: [Pt, Pt] = [
            [x1, y1],
            [x2, y2],
          ];
          if (lineRelation(tg.to, l) === tg.kind && (!tg.through || onLine(tg.through, l)))
            return true;
        }
  return false;
}

export function geometryAnswerText(item: GeometryItem): RichText {
  const t = item.task;
  if (t.kind === 'pick')
    return t.options
      .map((o, i) => (o.correct ? (o.label ?? `${i + 1}ばん`) : null))
      .filter((x) => x !== null)
      .join('、');
  if (t.kind === 'angle') return `${t.degrees}°`;
  const g = t.target;
  switch (g.kind) {
    case 'shape':
      return g.sides ? `${SHAPE_NAME[g.shape]}（へん ${g.sides.join('・')}）` : SHAPE_NAME[g.shape];
    case 'perpendicular':
      return 'すいちょくな ちょくせん';
    case 'parallel':
      return 'へいこうな ちょくせん';
    default: {
      const ps = targetPolygon(g) ?? g.points;
      return ps.map((p) => `(${p[0]},${p[1]})`).join('→');
    }
  }
}

// ---- 画面 ----
const S = 60;
const M = 30;

/** 直線を格子の範囲いっぱいにのばした両はし */
function extend(a: Pt, b: Pt, g: { w: number; h: number }): [Pt, Pt] {
  const v: Pt = [b[0] - a[0], b[1] - a[1]];
  const ts: number[] = [];
  const add = (t: number) => {
    const x = a[0] + v[0] * t;
    const y = a[1] + v[1] * t;
    if (x >= -1e-9 && x <= g.w + 1e-9 && y >= -1e-9 && y <= g.h + 1e-9) ts.push(t);
  };
  if (v[0] !== 0) {
    add((0 - a[0]) / v[0]);
    add((g.w - a[0]) / v[0]);
  }
  if (v[1] !== 0) {
    add((0 - a[1]) / v[1]);
    add((g.h - a[1]) / v[1]);
  }
  if (ts.length < 2) return [a, b];
  const lo = Math.min(...ts);
  const hi = Math.max(...ts);
  return [
    [a[0] + v[0] * lo, a[1] + v[1] * lo],
    [a[0] + v[0] * hi, a[1] + v[1] * hi],
  ];
}

const P = (p: Pt) => ({ x: M + p[0] * S, y: M + p[1] * S });
const pts = (ps: Pt[]) => ps.map((p) => `${P(p).x},${P(p).y}`).join(' ');

function ShapeSvg({ s, g, cls }: { s: GeoShape; g: { w: number; h: number }; cls: string }) {
  if (s.infinite && s.points.length === 2) {
    const [a, b] = extend(s.points[0]!, s.points[1]!, g);
    return <line x1={P(a).x} y1={P(a).y} x2={P(b).x} y2={P(b).y} className={cls} />;
  }
  return (
    <g>
      {s.closed === false ? (
        <polyline points={pts(s.points)} className={cls} />
      ) : (
        <polygon points={pts(s.points)} className={cls} />
      )}
      {(s.names ?? []).map((nm, i) =>
        s.points[i] ? (
          <text key={i} x={P(s.points[i]!).x - 16} y={P(s.points[i]!).y - 10} className="geo-name">
            {nm}
          </text>
        ) : null,
      )}
    </g>
  );
}

function DrawView({
  item,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GeometryItem, GeometryResponse>) {
  const t = item.task as Extract<GeoTask, { kind: 'draw' }>;
  const g = t.grid;
  const locked = disabled || revealed;
  const line = isLineTarget(t.target);
  const [path, setPath] = useState<Pt[]>([]);
  const [closed, setClosed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const W = g.w * S + 2 * M;
  const H = g.h * S + 2 * M;
  const vb = { x: 0, y: 0, w: W, h: H };
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    const q = svgPoint(e, vb);
    const p: Pt = [
      Math.max(0, Math.min(g.w, Math.round((q.x - M) / S))),
      Math.max(0, Math.min(g.h, Math.round((q.y - M) / S))),
    ];
    setDirty(true);
    if (line) {
      setPath((cur) =>
        cur.length >= 2 ? [p] : cur.length === 1 && samePt(cur[0]!, p) ? cur : [...cur, p],
      );
      return;
    }
    if (closed) return;
    // 最初の点をもう一度タップすると閉じる。同じ点は2度使わない
    if (path.length >= 3 && samePt(path[0]!, p)) setClosed(true);
    else if (!path.some((c) => samePt(c, p))) setPath([...path, p]);
  };
  const undo = () => {
    if (locked) return;
    setDirty(true);
    if (closed) setClosed(false);
    else setPath((cur) => cur.slice(0, -1));
  };
  const clear = () => {
    if (locked) return;
    setDirty(true);
    setPath([]);
    setClosed(false);
  };
  const ready = line ? path.length === 2 : closed;
  const wrong = !!wrongMark && !revealed && !dirty;
  // 正答の例（revealed）
  const tg = t.target;
  const ans: GeoShape | null = revealed
    ? isLineTarget(tg)
      ? null
      : targetPolygon(tg)
        ? { points: targetPolygon(tg)! }
        : null
    : null;
  const dots = [];
  for (let x = 0; x <= g.w; x++)
    for (let y = 0; y <= g.h; y++)
      dots.push(
        <circle key={`${x}-${y}`} cx={M + x * S} cy={M + y * S} r={4} className="geo-dot" />,
      );
  const gridLines = [];
  for (let x = 0; x <= g.w; x++)
    gridLines.push(
      <line
        key={`x${x}`}
        x1={M + x * S}
        y1={M}
        x2={M + x * S}
        y2={M + g.h * S}
        className="geo-grid"
      />,
    );
  for (let y = 0; y <= g.h; y++)
    gridLines.push(
      <line
        key={`y${y}`}
        x1={M}
        y1={M + y * S}
        x2={M + g.w * S}
        y2={M + y * S}
        className="geo-grid"
      />,
    );
  const axis = tg.kind === 'reflect' ? extend(tg.axis[0], tg.axis[1], g) : null;
  return (
    <div className="mk eng-geo">
      <div className="mk__main">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`mk-svg geo-svg${wrong ? ' is-wrong' : ''}`}
          role="img"
          aria-label="てんの ならんだ ほうがんし"
          onClick={tap}
          data-testid="grid"
        >
          <rect x={0} y={0} width={W} height={H} className="mk-hit" />
          {gridLines}
          {(t.given ?? []).map((s, i) => (
            <ShapeSvg key={i} s={s} g={g} cls="geo-given" />
          ))}
          {isLineTarget(tg) ? (
            <ShapeSvg
              s={{ points: (tg as { to: [Pt, Pt] }).to, infinite: true }}
              g={g}
              cls="geo-given geo-given--line"
            />
          ) : null}
          {axis ? (
            <line
              x1={P(axis[0]).x}
              y1={P(axis[0]).y}
              x2={P(axis[1]).x}
              y2={P(axis[1]).y}
              className="geo-axis"
            />
          ) : null}
          {tg.kind === 'rotate180' ? (
            <circle cx={P(tg.center).x} cy={P(tg.center).y} r={9} className="geo-center" />
          ) : null}
          {'through' in tg && tg.through ? (
            <circle cx={P(tg.through).x} cy={P(tg.through).y} r={10} className="geo-center" />
          ) : null}
          {dots}
          {ans ? <ShapeSvg s={ans} g={g} cls="geo-answer" /> : null}
          {line && path.length === 2 ? (
            <ShapeSvg s={{ points: path, infinite: true }} g={g} cls="geo-mine geo-mine--thin" />
          ) : null}
          {path.length >= 2 ? (
            <ShapeSvg
              s={{ points: path, closed }}
              g={g}
              cls={`geo-mine${closed ? ' is-closed' : ''}`}
            />
          ) : null}
          {path.map((p, i) => (
            <circle
              key={i}
              cx={P(p).x}
              cy={P(p).y}
              r={i === 0 && !line ? 14 : 11}
              className={i === 0 && !line ? 'geo-v geo-v--first' : 'geo-v'}
            />
          ))}
        </svg>
      </div>
      <div className="mk__side eng-geo__side">
        <div className="mk-row">
          <button
            type="button"
            className="mk-btn"
            onClick={undo}
            disabled={locked || path.length === 0}
            data-testid="undo"
          >
            ひとつ
            <br />
            もどす
          </button>
          <button
            type="button"
            className="mk-btn"
            onClick={clear}
            disabled={locked || path.length === 0}
            data-testid="clear"
          >
            ぜんぶ
            <br />
            けす
          </button>
        </div>
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          onClick={() => submit({ path, closed })}
          disabled={locked || !ready}
          data-testid="check"
        >
          こたえあわせ
        </button>
      </div>
    </div>
  );
}

/** 角と分度器（中心は角の頂点、0度の線は1つ目の辺にそろえてある） */
function AngleSvg({ t, revealed }: { t: Extract<GeoTask, { kind: 'angle' }>; revealed: boolean }) {
  const R = 200;
  const base = t.base ?? 0;
  const ray = (deg: number, len: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: Math.cos(a) * len, y: -Math.sin(a) * len };
  };
  const r1 = ray(base, 250);
  const r2 = ray(base + t.degrees, 250);
  const arcR = 46;
  const a1 = ray(base, arcR);
  const a2 = ray(base + t.degrees, arcR);
  const large = t.degrees > 180 ? 1 : 0;
  const ticks = [];
  if (t.protractor !== false) {
    for (let d = 0; d <= 180; d++) {
      const len = d % 10 === 0 ? 20 : d % 5 === 0 ? 13 : 7;
      const p1 = ray(base + d, R - len);
      const p2 = ray(base + d, R);
      ticks.push(<line key={d} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="geo-ptick" />);
      if (d % 10 === 0) {
        const o = ray(base + d, R - 34);
        const i = ray(base + d, R - 62);
        ticks.push(
          <text key={`o${d}`} x={o.x} y={o.y + 6} className="geo-plabel">
            {180 - d}
          </text>,
          <text key={`i${d}`} x={i.x} y={i.y + 6} className="geo-plabel geo-plabel--in">
            {d}
          </text>,
        );
      }
    }
  }
  const pb = ray(base, R);
  const pe = ray(base + 180, R);
  // 図の範囲（角の辺と分度器が入る最小の枠）
  const fit = [{ x: 0, y: 0 }, r1, r2];
  if (t.protractor !== false) for (let d = 0; d <= 180; d += 10) fit.push(ray(base + d, R));
  const pad = 30;
  const x0 = Math.min(...fit.map((p) => p.x)) - pad;
  const y0 = Math.min(...fit.map((p) => p.y)) - pad;
  const x1 = Math.max(...fit.map((p) => p.x)) + pad;
  const y1 = Math.max(...fit.map((p) => p.y)) + pad;
  return (
    <svg
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      className="mk-svg geo-angle"
      role="img"
      aria-label="かくと ぶんどき"
    >
      {t.protractor !== false ? (
        <g>
          <path d={`M ${pb.x} ${pb.y} A ${R} ${R} 0 0 0 ${pe.x} ${pe.y} Z`} className="geo-prot" />
          {ticks}
        </g>
      ) : null}
      <path
        d={`M ${a1.x} ${a1.y} A ${arcR} ${arcR} 0 ${large} 0 ${a2.x} ${a2.y}`}
        className="geo-arc"
      />
      <line x1={0} y1={0} x2={r1.x} y2={r1.y} className="geo-ray" />
      <line x1={0} y1={0} x2={r2.x} y2={r2.y} className="geo-ray" />
      <circle r={6} className="geo-pin" />
      {revealed ? (
        <text
          x={ray(base + t.degrees / 2, 90).x}
          y={ray(base + t.degrees / 2, 90).y + 10}
          className="geo-deg"
        >
          {`${t.degrees}°`}
        </text>
      ) : null}
    </svg>
  );
}

function AngleView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GeometryItem, GeometryResponse>) {
  const t = item.task as Extract<GeoTask, { kind: 'angle' }>;
  const locked = disabled || revealed;
  const entry = useNumEntry(1, locked);
  return (
    <div className="mk eng-geo">
      <div className="mk__main">
        <AngleSvg t={t} revealed={revealed} />
        <NumFields
          entry={entry}
          fields={[{ unit: '°' }]}
          ctx={ctx}
          wrong={!!wrongMark}
          revealed={revealed}
          answers={[String(t.degrees)]}
        />
      </div>
      <NumKeys entry={entry} disabled={locked} onSubmit={() => submit({ fields: entry.vals })} />
    </div>
  );
}

function OptionShape({ s }: { s: GeoShape }) {
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - minX);
  const h = Math.max(1, Math.max(...ys) - minY);
  const k = 100 / Math.max(w, h);
  const ps = s.points.map((p) => `${(p[0] - minX) * k},${(p[1] - minY) * k}`).join(' ');
  return (
    <svg viewBox={`-8 -8 ${w * k + 16} ${h * k + 16}`} className="geo-opt" aria-hidden>
      {s.closed === false ? (
        <polyline points={ps} className="geo-optshape" />
      ) : (
        <polygon points={ps} className="geo-optshape" />
      )}
    </svg>
  );
}

function PickView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GeometryItem, GeometryResponse>) {
  const t = item.task as Extract<GeoTask, { kind: 'pick' }>;
  const [picked, setPicked] = useState<number[]>([]);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const stateOf = (i: number): TapState => {
    if (revealed && t.options[i]!.correct) return 'correct';
    if (wrong.has(i)) return 'wrong';
    if (t.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (disabled || revealed) return;
    if (!t.multi) submit({ pick: [i] });
    else setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  return (
    <div className="eng-geo eng-geo--pick">
      <div className="eng-geo__options">
        {t.options.map((o, i) => (
          <Choice
            key={i}
            label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばんの かたち`}
            state={stateOf(i)}
            disabled={disabled || revealed}
            onPress={() => press(i)}
            testId={`opt-${i}`}
            className="eng-geo__opt"
          >
            {o.shape ? <OptionShape s={o.shape} /> : null}
            {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
            {o.label !== undefined ? (
              <span className="eng-geo__optlabel">
                <Rt text={o.label} ctx={ctx} />
              </span>
            ) : null}
          </Choice>
        ))}
      </div>
      {t.multi && !revealed ? (
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          disabled={disabled || picked.length === 0}
          onClick={() => submit({ pick: picked })}
          data-testid="check"
        >
          こたえあわせ
        </button>
      ) : null}
    </div>
  );
}

function GeometryView(props: KitProps<GeometryItem, GeometryResponse>) {
  const k = props.item.task.kind;
  if (k === 'pick') return <PickView {...props} />;
  if (k === 'draw') return <DrawView {...props} />;
  return <AngleView {...props} />;
}

/** 問題データの中の、子供に見せる文（よみの検査用。qa.ts の textsOf に加える） */
export function geometryTexts(item: GeometryItem): RichText[] {
  const t = item.task;
  const out: RichText[] = [];
  if (t.kind === 'pick') for (const o of t.options) if (o.label) out.push(o.label);
  if (t.kind === 'draw') for (const s of t.given ?? []) out.push(...(s.names ?? []));
  return out;
}

export const geometryEngine: KitEngineDef<GeometryItem, GeometryResponse> = {
  id: 'geometry',
  Component: GeometryView,
  judge: judgeGeometry,
  check: checkGeometry,
  answerText: geometryAnswerText,
};
