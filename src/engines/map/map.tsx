/**
 * map エンジン: 地図（社会: 都道府県・地図記号・方位）。
 *  name    … 印の付いた都道府県の名前を選ぶ
 *  spell   … 印の付いた都道府県の名前を、かなのタイルで入れる（build と同じ操作・判定）
 *  find    … 名前の都道府県を地図でタップ（prefs が2つ以上なら「ぜんぶ」。地方のなかま分け）
 *  region  … 印の付いた都道府県の地方を選ぶ（showRegions で地方の模様と番号の地図）
 *  bearing … 都道府県 from から見た to の方位（八方位／四方位）を、方位の形に並んだ札から選ぶ
 *  symbol  … 地図記号の名前を選ぶ（ask:'name'）／名前の記号を選ぶ（ask:'pick'）
 *  town    … 絵地図で、記号の場所をタップ（dir があれば「from の 北に ある もの」）
 *  compass … 方位じしん: 矢印の方位の名前を選ぶ（ask:'name'）／方位の場所をタップ（ask:'point'）
 * 地図は Natural Earth（パブリックドメイン）を簡略化したもの（japan.ts）。色だけで地方を区別しない（模様と番号）。
 * タップだけで完結する（地図をタップ→札が選ばれる→こたえあわせ）。
 */
import { useId, useState } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText, spokenReading } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { answerTiling, checkBuild, judgeBuild, type BuildItem } from '../build/build';
import { svgPoint, type KitEngineDef, type KitProps, type ViewBox } from '../numberline/kit';
import { TapCard, useMarks } from '../order/shared';
import type { Judgement } from '../types';
import {
  areNeighbors,
  bearingDeg,
  DIR4,
  DIR_NAME,
  dirOf,
  DIRS,
  hitPref,
  INSET_BOX,
  isDir,
  isPrefCode,
  isRegion,
  mirrorEW,
  opposite,
  PREF_BY_CODE,
  prefBearing,
  prefName,
  prefPath,
  PREFS,
  REGION_BY_ID,
  REGIONS,
  viewBoxOf,
  visibleIn,
  type Dir8,
  type MapView,
  type NameStyle,
  type RegionId,
} from './japan';
import { isSymbol, MapSymbol, SYMBOL_NAME, type SymbolId } from './symbols';
import '../numberline/numpad.css';
import './map.css';

export type { Dir8, MapView, NameStyle, RegionId } from './japan';
export type { SymbolId } from './symbols';

/** 絵地図の場所（ます目の座標。左上が [0,0]、右・下へ増える） */
export interface TownPlace {
  symbol: SymbolId;
  at: [number, number];
  /** 記号の下に出す名前（省略時は出さない。記号を読む問題では出さない） */
  label?: RichText;
}

export type MapTask =
  | {
      kind: 'name';
      /** 都道府県コード（1〜47） */
      pref: number;
      /** 選択肢（都道府県コード。pref を含む） */
      options: number[];
      view?: MapView;
      nameStyle?: NameStyle;
    }
  | {
      kind: 'spell';
      pref: number;
      /** かなのタイル（名前のかなと、まぎらわしいもの。2〜12） */
      tiles: string[];
      /** 「けん」「ふ」「と」まで入れる（既定: どちらも正解） */
      withSuffix?: boolean;
      view?: MapView;
      fixedOrder?: boolean;
    }
  | {
      kind: 'find';
      /** タップする都道府県（2つ以上なら全部。順不同） */
      prefs: number[];
      view?: MapView;
      /** 地方の模様と番号を見せる */
      showRegions?: boolean;
    }
  | {
      kind: 'region';
      pref: number;
      /** 選択肢の地方（pref の地方を含む。2〜8） */
      options: RegionId[];
      view?: MapView;
      showRegions?: boolean;
    }
  | {
      kind: 'bearing';
      from: number;
      to: number;
      /** 八方位（既定）か四方位 */
      points?: 4 | 8;
      view?: MapView;
    }
  | {
      kind: 'symbol';
      /** name: 記号を見て名前を選ぶ。pick: 名前を見て記号を選ぶ */
      ask: 'name' | 'pick';
      symbol: SymbolId;
      /** 選択肢（symbol を含む。2〜6） */
      options: SymbolId[];
    }
  | {
      kind: 'town';
      /** ます目の数 [横, 縦]（2〜8） */
      size: [number, number];
      places: TownPlace[];
      /** 道（ます目の座標の折れ線。0.5 刻みも可） */
      roads?: [number, number][][];
      /** 線路（折れ線） */
      rail?: [number, number][];
      /** 方位の基準の場所（places の番号） */
      from?: number;
      dir?: Dir8;
      /** 正答の場所（places の番号） */
      answer: number;
    }
  | {
      kind: 'compass';
      /** name: 矢印の方位の名前を選ぶ。point: 方位の場所をタップ */
      ask: 'name' | 'point';
      dir: Dir8;
      /** 四方位（既定）か八方位 */
      points?: 4 | 8;
      /** point のとき名前を見せておく方位（例 ['n']） */
      given?: Dir8[];
    };

export type MapMis =
  /** となりの都道府県を選んだ */
  | 'neighbor'
  /** 同じ地方の別の都道府県を選んだ */
  | 'sameRegion'
  /** 反対の方位を選んだ */
  | 'opposite'
  /** 東と西を取り違えた（北東 ↔ 北西 など） */
  | 'mirrorEW'
  /** ぜんぶ選ぶ問題で、足りない */
  | 'missing';

export interface MapItem extends ItemBase {
  engine: 'map';
  task: MapTask;
  /** 自動で見つける誤り → 誤概念ID */
  misconceptions?: Partial<Record<MapMis, string>>;
  /** 決まった誤答（都道府県コード・地方・記号・方位・場所の番号・かなの文字列）→ 誤概念ID */
  wrongAnswers?: { value: string | number; misconception: string }[];
}

/**
 * 答え: value（選んだ都道府県コード・地方・記号・方位・場所の番号）、
 * prefs（タップした都道府県）、tiles（spell の並べたタイルの番号）
 */
export type MapResponse = { value: string | number } | { prefs: number[] } | { tiles: number[] };

// ---- 判定 ----

/** 正答の値（spell・find 以外） */
function answerValue(t: MapTask): string | number | null {
  switch (t.kind) {
    case 'name':
      return t.pref;
    case 'region':
      return PREF_BY_CODE.get(t.pref)?.region ?? null;
    case 'bearing':
      return prefBearing(t.from, t.to, t.points ?? 8)?.dir ?? null;
    case 'symbol':
      return t.symbol;
    case 'town':
      return t.answer;
    case 'compass':
      return t.dir;
    default:
      return null;
  }
}

function spellBuild(item: MapItem, t: Extract<MapTask, { kind: 'spell' }>): BuildItem {
  const p = PREF_BY_CODE.get(t.pref);
  const full = p ? p.yomi + p.suffixYomi : '';
  const values = !p ? [''] : t.withSuffix || !p.suffix ? [full] : [p.yomi, full];
  return {
    id: item.id,
    objective: item.objective,
    level: item.level,
    prompt: item.prompt,
    hints: item.hints,
    explain: item.explain,
    identity: item.identity,
    engine: 'build',
    tiles: t.tiles,
    answer: { kind: 'text', values },
    fixedOrder: t.fixedOrder,
    wrongAnswers: (item.wrongAnswers ?? [])
      .filter((w) => typeof w.value === 'string')
      .map((w) => ({ value: String(w.value), misconception: w.misconception })),
  };
}

function knownWrong(item: MapItem, v: string | number): string | undefined {
  return item.wrongAnswers?.find((w) => w.value === v)?.misconception;
}

/** 方位の自動の誤り */
function dirMis(item: MapItem, want: Dir8, got: Dir8): string | undefined {
  const m = item.misconceptions ?? {};
  if (got === opposite(want)) return m.opposite;
  if (got === mirrorEW(want)) return m.mirrorEW;
  return undefined;
}

/** 都道府県の自動の誤り */
function prefMis(item: MapItem, want: number, got: number): string | undefined {
  const m = item.misconceptions ?? {};
  if (areNeighbors(want, got)) return m.neighbor;
  if (PREF_BY_CODE.get(want)?.region === PREF_BY_CODE.get(got)?.region) return m.sameRegion;
  return undefined;
}

/** 絵地図: 場所 a から見た場所 b の方位 */
function townDir(t: Extract<MapTask, { kind: 'town' }>, a: number, b: number, points: 4 | 8 = 8) {
  const p = t.places[a]?.at;
  const q = t.places[b]?.at;
  if (!p || !q) return null;
  return dirOf(bearingDeg(p, q), points);
}

export function judgeMap(item: MapItem, res: MapResponse): Judgement {
  const t = item.task;
  if (t.kind === 'spell') {
    if (!('tiles' in res)) return { result: 'retry', message: 'タイルを ならべて こたえよう。' };
    return judgeBuild(spellBuild(item, t), res.tiles);
  }
  if (t.kind === 'find') {
    if (!('prefs' in res) || res.prefs.length === 0)
      return { result: 'retry', message: 'ちずを タップして えらんでから こたえあわせ しよう。' };
    const want = new Set(t.prefs);
    const got = [...new Set(res.prefs)];
    const extra = got.filter((c) => !want.has(c));
    if (extra.length === 0 && got.length === want.size) return { result: 'correct' };
    if (extra.length === 0)
      return { result: 'wrong', misconception: item.misconceptions?.missing, mark: [] };
    const first = extra[0]!;
    let m = knownWrong(item, first);
    if (!m && t.prefs.length === 1) m = prefMis(item, t.prefs[0]!, first);
    if (!m && t.prefs.length > 1) m = item.misconceptions?.sameRegion;
    return { result: 'wrong', misconception: m, mark: extra };
  }
  if (!('value' in res)) return { result: 'retry', message: 'えらんでから こたえよう。' };
  const want = answerValue(t);
  const v = res.value;
  if (want !== null && v === want) return { result: 'correct' };
  let m = knownWrong(item, v);
  if (!m) {
    if (t.kind === 'name' && typeof v === 'number') m = prefMis(item, t.pref, v);
    if ((t.kind === 'bearing' || t.kind === 'compass') && isDir(v) && isDir(want))
      m = dirMis(item, want, v);
    if (t.kind === 'town' && typeof v === 'number' && t.from !== undefined && t.dir) {
      const d = townDir(t, t.from, v);
      if (d) m = dirMis(item, t.dir, d.dir);
    }
  }
  return { result: 'wrong', misconception: m, mark: [v] };
}

// ---- 検査 ----

function viewErrors(view: MapView | undefined, codes: number[]): string[] {
  const errs: string[] = [];
  if (view !== undefined && view !== 'japan' && !isRegion(view))
    errs.push(`図の範囲 ${view} が無い`);
  else
    for (const c of codes)
      if (isPrefCode(c) && !visibleIn(c, view))
        errs.push(`都道府県 ${c} が図の範囲 ${view} に入らない`);
  return errs;
}

function codeErrors(codes: number[]): string[] {
  return codes.filter((c) => !isPrefCode(c)).map((c) => `都道府県コード ${c} が無い（1〜47）`);
}

function optionErrors<T>(options: T[], answer: T, min: number, max: number): string[] {
  const errs: string[] = [];
  if (options.length < min || options.length > max) errs.push(`選択肢は${min}〜${max}個`);
  if (options.filter((o) => o === answer).length !== 1) errs.push('選択肢に正答がちょうど1つ無い');
  if (new Set(options).size !== options.length) errs.push('同じ選択肢が重複している');
  return errs;
}

export function checkMap(item: MapItem): string[] {
  const t = item.task;
  const errs: string[] = [];
  const want = answerValue(t);
  switch (t.kind) {
    case 'name':
      errs.push(...codeErrors([t.pref, ...t.options]), ...viewErrors(t.view, [t.pref]));
      errs.push(...optionErrors(t.options, t.pref, 2, 6));
      break;
    case 'spell': {
      errs.push(...codeErrors([t.pref]), ...viewErrors(t.view, [t.pref]));
      if (isPrefCode(t.pref)) {
        const b = spellBuild(item, t);
        errs.push(...checkBuild(b));
        if (!answerTiling(b)) errs.push('タイルで名前が作れない');
      }
      break;
    }
    case 'find':
      if (t.prefs.length === 0) errs.push('タップする都道府県が無い');
      if (new Set(t.prefs).size !== t.prefs.length) errs.push('タップする都道府県が重複している');
      errs.push(...codeErrors(t.prefs), ...viewErrors(t.view, t.prefs));
      break;
    case 'region':
      errs.push(...codeErrors([t.pref]), ...viewErrors(t.view, [t.pref]));
      if (t.options.some((r) => !isRegion(r))) errs.push('選択肢に無い地方がある');
      if (want !== null) errs.push(...optionErrors<string>(t.options, String(want), 2, 8));
      break;
    case 'bearing': {
      errs.push(...codeErrors([t.from, t.to]), ...viewErrors(t.view, [t.from, t.to]));
      if (t.from === t.to) errs.push('基準と答えの都道府県が同じ');
      for (const c of [t.from, t.to])
        if (PREF_BY_CODE.get(c)?.inInset.every(Boolean))
          errs.push(`都道府県 ${c} は囲みの中にあり、方位を測れない`);
      const b = prefBearing(t.from, t.to, t.points ?? 8);
      if (b && b.margin < (t.points === 4 ? 12 : 7))
        errs.push(`方位が境目に近く、あいまい（境目まで ${b.margin.toFixed(1)}度）`);
      break;
    }
    case 'symbol':
      if (!isSymbol(t.symbol) || t.options.some((s) => !isSymbol(s)))
        errs.push('無い地図記号がある');
      errs.push(...optionErrors(t.options, t.symbol, 2, 6));
      break;
    case 'town': {
      const [w, h] = t.size;
      if (!(Number.isInteger(w) && Number.isInteger(h) && w >= 2 && h >= 2 && w <= 8 && h <= 8))
        errs.push('絵地図は 2〜8 × 2〜8 ます');
      const keys = new Set<string>();
      t.places.forEach((p, i) => {
        if (!isSymbol(p.symbol)) errs.push(`場所${i} の記号 ${p.symbol} が無い`);
        const [x, y] = p.at;
        if (!(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h))
          errs.push(`場所${i} が絵地図の外`);
        const k = `${x},${y}`;
        if (keys.has(k)) errs.push(`場所${i} が別の場所と重なる`);
        keys.add(k);
      });
      if (!t.places[t.answer]) errs.push('正答の場所が無い');
      if ((t.from === undefined) !== (t.dir === undefined))
        errs.push('from と dir は両方書く（または両方書かない）');
      if (t.from !== undefined && t.dir) {
        if (!t.places[t.from]) errs.push('基準の場所が無い');
        if (t.from === t.answer) errs.push('基準と答えの場所が同じ');
        const d = townDir(t, t.from, t.answer);
        if (d && d.dir !== t.dir) errs.push(`答えの場所が基準から ${t.dir} に無い（${d.dir}）`);
        else if (d && d.margin < 5) errs.push('答えの場所の方位が境目に近い');
        const others = t.places.filter(
          (_, i) => i !== t.from && i !== t.answer && townDir(t, t.from!, i)?.dir === t.dir,
        );
        if (others.length) errs.push(`基準から ${t.dir} に場所が2つ以上ある（答えが一意でない）`);
      } else {
        const sym = t.places[t.answer]?.symbol;
        if (t.places.filter((p) => p.symbol === sym).length !== 1)
          errs.push('答えの記号が絵地図に2つ以上ある');
      }
      break;
    }
    case 'compass': {
      const pts = t.points ?? 4;
      if (pts !== 4 && pts !== 8) errs.push('points は 4 か 8');
      if (!isDir(t.dir)) errs.push(`方位 ${t.dir} が無い`);
      if (pts === 4 && !DIR4.includes(t.dir)) errs.push('四方位の問題に八方位の答え');
      if (t.ask === 'point' && (t.given ?? []).includes(t.dir))
        errs.push('答えの方位の名前を見せている');
      break;
    }
  }
  for (const w of item.wrongAnswers ?? []) {
    if (!w.misconception) errs.push(`誤答の例 ${w.value} に誤概念IDが無い`);
    if (t.kind !== 'spell' && t.kind !== 'find' && w.value === want)
      errs.push(`誤答の例 ${w.value} が正答と同じ`);
    if (t.kind === 'find' && typeof w.value === 'number' && t.prefs.includes(w.value))
      errs.push(`誤答の例 ${w.value} が正答に含まれる`);
  }
  return errs;
}

// ---- 正答の文 ----

const prefLabel = (c: number, style?: NameStyle) => prefName(c, style === 'kanji' ? 'ruby' : style);

export function mapAnswerText(item: MapItem): RichText {
  const t = item.task;
  switch (t.kind) {
    case 'name':
      return prefLabel(t.pref, t.nameStyle);
    case 'spell': {
      const p = PREF_BY_CODE.get(t.pref);
      return p ? (t.withSuffix || !p.suffix ? p.yomi + p.suffixYomi : p.yomi) : '';
    }
    case 'find':
      return t.prefs.map((c) => prefName(c)).join('、');
    case 'region': {
      const r = PREF_BY_CODE.get(t.pref)?.region;
      return r ? REGION_BY_ID[r].name : '';
    }
    case 'bearing': {
      const d = prefBearing(t.from, t.to, t.points ?? 8);
      return d ? DIR_NAME[d.dir] : '';
    }
    case 'symbol':
      return SYMBOL_NAME[t.symbol];
    case 'town': {
      const p = t.places[t.answer];
      return p ? (p.label ?? SYMBOL_NAME[p.symbol]) : '';
    }
    case 'compass':
      return DIR_NAME[t.dir];
  }
}

/** 問題データの中の、子供に見せる文（よみの検査用） */
export function mapTexts(item: MapItem): RichText[] {
  const t = item.task;
  if (t.kind === 'town') return t.places.flatMap((p) => (p.label ? [p.label] : []));
  return [];
}

// ---- 画面 ----

type View = KitProps<MapItem, MapResponse>;

/** 地図の模様（地方を色だけで区別しない） */
function Patterns({ uid, s }: { uid: string; s: number }) {
  const line = (d: string) => <path d={d} className="map-patline" />;
  const pat = (id: RegionId, body: React.ReactNode) => (
    <pattern key={id} id={`${uid}-${id}`} width={s} height={s} patternUnits="userSpaceOnUse">
      {body}
    </pattern>
  );
  return (
    <defs>
      {pat('hokkaido', <circle cx={s / 2} cy={s / 2} r={s * 0.16} className="map-patdot" />)}
      {pat('tohoku', line(`M0 ${s} L${s} 0`))}
      {pat('kanto', line(`M0 ${s / 2} L${s} ${s / 2}`))}
      {pat('chubu', line(`M${s / 2} 0 L${s / 2} ${s}`))}
      {pat('kinki', line(`M0 0 L${s} ${s}`))}
      {pat('chugoku', line(`M0 ${s / 2} L${s} ${s / 2} M${s / 2} 0 L${s / 2} ${s}`))}
      {pat('shikoku', line(`M0 0 L${s} ${s} M0 ${s} L${s} 0`))}
      {pat('kyushu', <circle cx={s / 2} cy={s / 2} r={s * 0.28} className="map-patring" />)}
    </defs>
  );
}

/** 地方の見本（模様と番号）。札の中に出す */
function RegionSwatch({ id }: { id: RegionId }) {
  const uid = useId().replace(/:/g, '');
  const r = REGION_BY_ID[id];
  return (
    <svg viewBox="0 0 60 40" className="map-swatch" aria-hidden>
      <Patterns uid={uid} s={12} />
      <rect x={2} y={2} width={56} height={36} rx={6} className={`map-reg map-reg--${id}`} />
      <rect
        x={2}
        y={2}
        width={56}
        height={36}
        rx={6}
        fill={`url(#${uid}-${id})`}
        className="map-patfill"
      />
      <circle cx={30} cy={20} r={13} className="map-badge" />
      <text x={30} y={26} className="map-badge__no">
        {r.no}
      </text>
    </svg>
  );
}

interface MapMarks {
  /** 印を付ける（答えを聞かれている）都道府県 */
  target?: number[];
  /** 子が選んでいる */
  selected?: number[];
  /** 正答を見せる */
  answer?: number[];
  /** 誤りの印 */
  wrong?: number[];
  /** 名前を地図に書く都道府県 */
  names?: number[];
}

function JapanMap({
  view = 'japan',
  showRegions,
  marks,
  onTap,
  label,
}: {
  view?: MapView;
  showRegions?: boolean;
  marks: MapMarks;
  onTap?: (code: number) => void;
  label: string;
}) {
  const uid = useId().replace(/:/g, '');
  const vb = viewBoxOf(view);
  const vbx: ViewBox = vb;
  const s = vb.w * 0.022;
  const has = (k: keyof MapMarks, c: number) => (marks[k] ?? []).includes(c);
  const pinR = vb.w * 0.011;
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onTap) return;
    const q = svgPoint(e, vbx);
    const c = hitPref(q.x, q.y, view);
    if (c !== null) onTap(c);
  };
  const regionFocus = view !== 'japan' ? view : null;
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={`mk-svg map-svg${onTap ? ' is-tappable' : ''}`}
      role="img"
      aria-label={label}
      onClick={tap}
      data-testid="map"
    >
      {showRegions ? <Patterns uid={uid} s={s} /> : null}
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="map-sea" />
      {view === 'japan' ? (
        <rect
          x={INSET_BOX.x}
          y={INSET_BOX.y}
          width={INSET_BOX.w}
          height={INSET_BOX.h}
          className="map-inset"
        />
      ) : null}
      {PREFS.map((p) => {
        const d = prefPath(p);
        const cls = [
          'map-pref',
          showRegions ? `map-reg map-reg--${p.region}` : '',
          regionFocus && p.region !== regionFocus ? 'is-dim' : '',
          has('target', p.code) || has('answer', p.code) ? 'is-target' : '',
          has('selected', p.code) ? 'is-selected' : '',
          has('wrong', p.code) ? 'is-wrong' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g key={p.code} data-pref={p.code}>
            <path d={d} className={cls} fillRule="evenodd" />
            {showRegions ? (
              <path
                d={d}
                fill={`url(#${uid}-${p.region})`}
                className="map-patfill"
                fillRule="evenodd"
              />
            ) : null}
          </g>
        );
      })}
      {showRegions
        ? REGIONS.map((r) => {
            const a = PREF_BY_CODE.get(r.anchor)!;
            return (
              <g key={r.id} className="map-regno">
                <circle cx={a.label[0]} cy={a.label[1]} r={vb.w * 0.034} className="map-badge" />
                <text
                  x={a.label[0]}
                  y={a.label[1] + vb.w * 0.015}
                  className="map-badge__no"
                  style={{ fontSize: vb.w * 0.044 }}
                >
                  {r.no}
                </text>
              </g>
            );
          })
        : null}
      {PREFS.map((p) => {
        const [x, y] = p.label;
        const out = [];
        if (has('target', p.code) || has('answer', p.code))
          out.push(
            <g key="t" className="map-pin">
              <circle cx={x} cy={y} r={pinR * 1.5} className="map-pin__ring" />
              <circle cx={x} cy={y} r={pinR * 0.6} className="map-pin__dot" />
            </g>,
          );
        if (has('selected', p.code))
          out.push(<circle key="s" cx={x} cy={y} r={pinR} className="map-sel" />);
        if (has('wrong', p.code))
          out.push(
            <text
              key="w"
              x={x}
              y={y + vb.w * 0.014}
              className="map-wrongmark"
              style={{ fontSize: vb.w * 0.04 }}
            >
              ？
            </text>,
          );
        if (has('names', p.code))
          out.push(
            <text
              key="n"
              x={x}
              y={y - pinR * 2.2}
              className="map-name"
              style={{ fontSize: vb.w * 0.036 }}
            >
              {plainText(prefName(p.code, 'kana'))}
            </text>,
          );
        return out.length ? <g key={p.code}>{out}</g> : null;
      })}
      <NorthArrow x={vb.x + vb.w * 0.92} y={vb.y + vb.h * 0.82} s={vb.w * 0.05} />
    </svg>
  );
}

/** 方位記号（北の矢印） */
function NorthArrow({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g className="map-north" aria-hidden>
      <path
        d={`M${x} ${y - s} L${x + s * 0.45} ${y + s * 0.6} L${x} ${y + s * 0.25} L${x - s * 0.45} ${y + s * 0.6} Z`}
      />
      <text x={x} y={y - s * 1.15} style={{ fontSize: s * 0.8 }} className="map-north__label">
        きた
      </text>
    </g>
  );
}

function OptionsColumn<T extends string | number>({
  options,
  render,
  name,
  answer,
  wrongMark,
  revealed,
  disabled,
  onPick,
  ctx,
  grid,
}: {
  options: T[];
  render: (v: T) => React.ReactNode;
  name: (v: T) => string;
  answer: T | null;
  wrongMark: unknown;
  revealed: boolean;
  disabled: boolean;
  onPick: (v: T) => void;
  ctx: View['ctx'];
  grid?: boolean;
}) {
  const wrong = Array.isArray(wrongMark) ? (wrongMark as unknown[]) : [];
  const max = Math.max(2, ctx.ux.maxChoices);
  const shown =
    options.length <= max
      ? options
      : [answer as T, ...options.filter((o) => o !== answer)].slice(0, max);
  const ordered = options.filter((o) => shown.includes(o));
  const stateOf = (v: T): TapState => {
    if (revealed && v === answer) return 'correct';
    if (wrong.includes(v)) return 'wrong';
    return null;
  };
  return (
    <div className={`map-options${grid ? ' map-options--grid' : ''}`}>
      {ordered.map((v, i) => (
        <Choice
          key={String(v)}
          label={name(v)}
          state={stateOf(v)}
          disabled={disabled || revealed}
          onPress={() => onPick(v)}
          testId={`opt-${i}`}
          className="map-opt"
        >
          {render(v)}
        </Choice>
      ))}
    </div>
  );
}

/** 選択肢の並び（item.id から決まる混ぜ方） */
function mixed<T>(id: string, xs: T[]): T[] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function PickView({ item, ctx, revealed, wrongMark, disabled, submit }: View) {
  const t = item.task;
  const answer = answerValue(t);
  const locked = disabled || revealed;
  const pick = (v: string | number) => {
    if (!locked) submit({ value: v });
  };
  let main: React.ReactNode = null;
  let options: React.ReactNode = null;
  if (t.kind === 'name' || t.kind === 'region') {
    main = (
      <JapanMap
        view={t.view}
        showRegions={t.kind === 'region' && t.showRegions}
        marks={{ target: [t.pref] }}
        label="しるしの ついた ところが ある ちず"
      />
    );
    options =
      t.kind === 'name' ? (
        <OptionsColumn<number>
          options={mixed(item.id, t.options)}
          render={(c) => (
            <span className="map-opt__text">
              <Rt text={prefLabel(c, t.nameStyle)} ctx={ctx} />
            </span>
          )}
          name={(c) => plainText(prefName(c, 'kana'))}
          answer={t.pref}
          wrongMark={wrongMark}
          revealed={revealed}
          disabled={disabled}
          onPick={pick}
          ctx={ctx}
        />
      ) : (
        <OptionsColumn<RegionId>
          options={
            t.showRegions
              ? REGIONS.map((r) => r.id).filter((r) => t.options.includes(r))
              : mixed(item.id, t.options)
          }
          render={(r) => (
            <span className="map-opt__region">
              {t.showRegions ? <RegionSwatch id={r} /> : null}
              <span className="map-opt__text">
                <Rt text={REGION_BY_ID[r].name} ctx={ctx} />
              </span>
            </span>
          )}
          name={(r) => plainText(REGION_BY_ID[r].name)}
          answer={answer as RegionId}
          wrongMark={wrongMark}
          revealed={revealed}
          disabled={disabled}
          onPick={pick}
          ctx={ctx}
          grid={t.options.length > 4}
        />
      );
  } else if (t.kind === 'symbol') {
    if (t.ask === 'name') {
      main = (
        <div className="map-bigsym" role="img" aria-label="ちずきごう">
          <MapSymbol id={t.symbol} className="map-bigsym__svg" />
        </div>
      );
      options = (
        <OptionsColumn<SymbolId>
          options={mixed(item.id, t.options)}
          render={(s) => (
            <span className="map-opt__text">
              <Rt text={SYMBOL_NAME[s]} ctx={ctx} />
            </span>
          )}
          name={(s) => plainText(SYMBOL_NAME[s])}
          answer={t.symbol}
          wrongMark={wrongMark}
          revealed={revealed}
          disabled={disabled}
          onPick={pick}
          ctx={ctx}
        />
      );
    } else {
      return (
        <div className="map-symgrid">
          <OptionsColumn<SymbolId>
            options={mixed(item.id, t.options)}
            render={(s) => <MapSymbol id={s} className="map-optsym" />}
            name={(_s) => 'ちずきごう'}
            answer={t.symbol}
            wrongMark={wrongMark}
            revealed={revealed}
            disabled={disabled}
            onPick={pick}
            ctx={ctx}
            grid
          />
        </div>
      );
    }
  } else if (t.kind === 'bearing') {
    main = (
      <JapanMap
        view={t.view}
        marks={{ target: [t.from, t.to], names: [t.from, t.to] }}
        label="ふたつの ところに しるしの ある ちず"
      />
    );
    options = (
      <DirPad
        points={t.points ?? 8}
        labelled
        answer={answer as Dir8}
        wrongMark={wrongMark}
        revealed={revealed}
        disabled={disabled}
        onPick={pick}
        ctx={ctx}
      />
    );
  } else if (t.kind === 'compass') {
    const pts = t.points ?? 4;
    if (t.ask === 'name') {
      main = <CompassRose dir={t.dir} />;
      options = (
        <OptionsColumn<Dir8>
          options={pts === 8 ? [...DIRS] : [...DIR4]}
          render={(d) => (
            <span className="map-opt__text">
              <Rt text={DIR_NAME[d]} ctx={ctx} />
            </span>
          )}
          name={(d) => plainText(DIR_NAME[d])}
          answer={t.dir}
          wrongMark={wrongMark}
          revealed={revealed}
          disabled={disabled}
          onPick={pick}
          ctx={{ ...ctx, ux: { ...ctx.ux, maxChoices: 8 } }}
          grid
        />
      );
    } else {
      return (
        <div className="map-compass-only">
          <DirPad
            points={pts}
            labelled={false}
            given={t.given ?? []}
            answer={t.dir}
            wrongMark={wrongMark}
            revealed={revealed}
            disabled={disabled}
            onPick={pick}
            ctx={ctx}
          />
        </div>
      );
    }
  }
  return (
    <div className="mk eng-map">
      <div className="mk__main">{main}</div>
      <div className="mk__side eng-map__side">{options}</div>
    </div>
  );
}

/** 方位の矢印（ask:'name'） */
function CompassRose({ dir }: { dir: Dir8 }) {
  const a = (DIRS.indexOf(dir) * 45 * Math.PI) / 180;
  const R = 80;
  const tip = { x: Math.sin(a) * R, y: -Math.cos(a) * R };
  const back = { x: -Math.sin(a) * 20, y: Math.cos(a) * 20 };
  const side = { x: Math.cos(a) * 16, y: Math.sin(a) * 16 };
  return (
    <svg
      viewBox="-110 -110 220 220"
      className="mk-svg map-rose"
      role="img"
      aria-label="ほういの やじるし"
    >
      <circle r={96} className="map-rose__ring" />
      {DIRS.map((d, i) => {
        const b = (i * 45 * Math.PI) / 180;
        const len = i % 2 === 0 ? 96 : 70;
        return (
          <line
            key={d}
            x1={0}
            y1={0}
            x2={Math.sin(b) * len}
            y2={-Math.cos(b) * len}
            className={i % 2 === 0 ? 'map-rose__spoke' : 'map-rose__spoke map-rose__spoke--minor'}
          />
        );
      })}
      <text x={0} y={-100} className="map-rose__n">
        きた
      </text>
      <path
        d={`M${tip.x} ${tip.y} L${back.x + side.x} ${back.y + side.y} L${back.x - side.x} ${back.y - side.y} Z`}
        className="map-rose__arrow"
      />
      <circle r={8} className="map-rose__pin" />
    </svg>
  );
}

/** 方位の形に並んだ札（3×3。まん中は方位の印） */
function DirPad({
  points,
  labelled,
  given = [],
  answer,
  wrongMark,
  revealed,
  disabled,
  onPick,
  ctx,
}: {
  points: 4 | 8;
  /** 札に方位の名前を書く（bearing）。false なら given の方位だけ名前を書く（compass point） */
  labelled: boolean;
  given?: Dir8[];
  answer: Dir8 | null;
  wrongMark: unknown;
  revealed: boolean;
  disabled: boolean;
  onPick: (d: Dir8) => void;
  ctx: View['ctx'];
}) {
  const wrong = Array.isArray(wrongMark) ? (wrongMark as unknown[]) : [];
  const layout: (Dir8 | null)[] = ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se'];
  const POS = [
    'ひだりうえ',
    'うえ',
    'みぎうえ',
    'ひだり',
    '',
    'みぎ',
    'ひだりした',
    'した',
    'みぎした',
  ];
  return (
    <div className="map-dirpad" role="group" aria-label="ほうい">
      {layout.map((d, i) => {
        if (d === null)
          return (
            <span key="c" className="map-dirpad__center" aria-hidden>
              <svg viewBox="-50 -50 100 100">
                <line x1={0} y1={-40} x2={0} y2={40} className="map-rose__spoke" />
                <line x1={-40} y1={0} x2={40} y2={0} className="map-rose__spoke" />
                <circle r={7} className="map-rose__pin" />
              </svg>
            </span>
          );
        if (points === 4 && !DIR4.includes(d)) return <span key={d} />;
        const showName = labelled || given.includes(d) || (revealed && d === answer);
        const state: TapState =
          revealed && d === answer ? 'correct' : wrong.includes(d) ? 'wrong' : null;
        const isGiven = !labelled && given.includes(d);
        return (
          <Choice
            key={d}
            label={showName ? plainText(DIR_NAME[d]) : `${POS[i]}の ふだ`}
            state={state}
            disabled={disabled || revealed || isGiven}
            onPress={() => onPick(d)}
            testId={`dir-${d}`}
            className={`map-dir${isGiven ? ' is-given' : ''}`}
          >
            {showName ? (
              <span className="map-dir__text">
                <Rt text={DIR_NAME[d]} ctx={ctx} />
              </span>
            ) : null}
          </Choice>
        );
      })}
    </div>
  );
}

function FindView({ item, revealed, wrongMark, disabled, submit }: View) {
  const t = item.task as Extract<MapTask, { kind: 'find' }>;
  const multi = t.prefs.length > 1;
  const locked = disabled || revealed;
  const [picked, setPicked] = useState<number[]>([]);
  const [markRef, setMarkRef] = useState<unknown>(null);
  const wrong =
    !revealed && Array.isArray(wrongMark) && markRef !== wrongMark ? (wrongMark as number[]) : [];
  const tap = (c: number) => {
    if (locked) return;
    setMarkRef(wrongMark);
    setPicked((p) => (multi ? (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]) : [c]));
  };
  return (
    <div className="mk eng-map">
      <div className="mk__main">
        <JapanMap
          view={t.view}
          showRegions={t.showRegions}
          marks={{ selected: revealed ? [] : picked, answer: revealed ? t.prefs : [], wrong }}
          onTap={locked ? undefined : tap}
          label="にほんの ちず。ばしょを タップして えらぶ"
        />
      </div>
      {!revealed ? (
        <div className="mk__side eng-map__side">
          <p className="map-count" aria-live="polite">
            {multi
              ? `えらんだ かず ${picked.length}`
              : picked.length
                ? 'えらんだよ'
                : 'ちずを タップ'}
          </p>
          <button
            type="button"
            className="mk-btn"
            onClick={() => {
              if (locked) return;
              setMarkRef(wrongMark);
              setPicked([]);
            }}
            disabled={locked || picked.length === 0}
            data-testid="clear"
          >
            ぜんぶ
            <br />
            けす
          </button>
          <button
            type="button"
            className="mk-btn mk-btn--ok"
            onClick={() => submit({ prefs: picked })}
            disabled={locked || picked.length === 0}
            data-testid="check"
          >
            こたえあわせ
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SpellView({ item, ctx, revealed, wrongMark, disabled, submit }: View) {
  const t = item.task as Extract<MapTask, { kind: 'spell' }>;
  const b = spellBuild(item, t);
  const tiling = answerTiling(b) ?? [];
  const order = t.fixedOrder
    ? t.tiles.map((_, i) => i)
    : mixed(
        item.id,
        t.tiles.map((_, i) => i),
      );
  const [placed, setPlaced] = useState<number[]>([]);
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const locked = disabled || revealed;
  const row = revealed ? tiling : placed;
  const empties = revealed ? 0 : Math.max(0, tiling.length - placed.length);
  return (
    <div className="mk eng-map">
      <div className="mk__main">
        <JapanMap
          view={t.view}
          marks={{ target: [t.pref] }}
          label="しるしの ついた ところが ある ちず"
        />
      </div>
      <div className="mk__side eng-map__side eng-map__spell">
        <div className="map-spell__row" role="group" aria-label="こたえ">
          {row.map((i, pos) => (
            <TapCard
              key={`${pos}-${i}`}
              card={{ label: t.tiles[i]! }}
              ctx={ctx}
              state={revealed ? 'correct' : marks.has(pos) ? 'wrong' : null}
              disabled={locked}
              onPress={() => {
                if (locked) return;
                setPlaced(placed.filter((_, p) => p !== pos));
                marks.clear(...Array.from({ length: placed.length - pos }, (_, k) => pos + k));
              }}
              testId={`placed-${pos}`}
              className="map-tile"
            />
          ))}
          {Array.from({ length: empties }, (_, k) => (
            <span
              key={`e${k}`}
              className={`tk-slot map-slot${k === 0 ? ' is-next' : ''}`}
              aria-hidden
            />
          ))}
        </div>
        {!revealed ? (
          <div className="map-spell__pool" role="group" aria-label="ならべる もじ">
            {order.map((i) =>
              placed.includes(i) ? (
                <span key={i} className="tk-slot map-slot" aria-hidden />
              ) : (
                <TapCard
                  key={i}
                  card={{ label: t.tiles[i]! }}
                  ctx={ctx}
                  disabled={locked}
                  onPress={() => {
                    if (locked) return;
                    setPlaced([...placed, i]);
                    marks.clear(placed.length);
                  }}
                  testId={`tile-${i}`}
                  className="map-tile"
                />
              ),
            )}
          </div>
        ) : null}
        {!revealed ? (
          <button
            type="button"
            className="mk-btn mk-btn--ok"
            onClick={() => submit({ tiles: placed })}
            disabled={locked || placed.length === 0}
            data-testid="check"
          >
            こたえあわせ
          </button>
        ) : null}
      </div>
    </div>
  );
}

const CELL = 100;
function TownView({ item, revealed, wrongMark, disabled, submit }: View) {
  const t = item.task as Extract<MapTask, { kind: 'town' }>;
  const [w, h] = t.size;
  const locked = disabled || revealed;
  const [picked, setPicked] = useState<number | null>(null);
  const [markRef, setMarkRef] = useState<unknown>(null);
  const wrong =
    !revealed && Array.isArray(wrongMark) && markRef !== wrongMark ? (wrongMark as unknown[]) : [];
  const W = w * CELL;
  const H = h * CELL;
  const pad = 40;
  const vb: ViewBox = { x: -pad, y: -pad, w: W + 2 * pad, h: H + 2 * pad };
  const C = (p: [number, number]) => ({ x: (p[0] + 0.5) * CELL, y: (p[1] + 0.5) * CELL });
  const line = (ps: [number, number][]) => ps.map((p) => `${C(p).x},${C(p).y}`).join(' ');
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    const q = svgPoint(e, vb);
    let best: { i: number; d: number } | null = null;
    t.places.forEach((p, i) => {
      const c = C(p.at);
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (d <= CELL * 0.6 && (!best || d < best.d)) best = { i, d };
    });
    if (best === null) return;
    setMarkRef(wrongMark);
    setPicked((best as { i: number }).i);
  };
  return (
    <div className="mk eng-map">
      <div className="mk__main">
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="mk-svg map-town"
          role="img"
          aria-label="まちの ちず。きごうを タップして えらぶ"
          onClick={tap}
          data-testid="town"
        >
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="map-town__bg" />
          {(t.roads ?? []).map((r, i) => (
            <polyline key={i} points={line(r)} className="map-road" />
          ))}
          {t.rail ? (
            <g>
              <polyline points={line(t.rail)} className="map-rail" />
              <polyline points={line(t.rail)} className="map-rail__dash" />
            </g>
          ) : null}
          {t.places.map((p, i) => {
            const c = C(p.at);
            const isAns = revealed && i === t.answer;
            const isSel = !revealed && picked === i;
            const isWrong = wrong.includes(i);
            return (
              <g key={i} data-place={i}>
                {i === t.from ? (
                  <rect
                    x={c.x - CELL * 0.48}
                    y={c.y - CELL * 0.48}
                    width={CELL * 0.96}
                    height={CELL * 0.96}
                    rx={14}
                    className="map-town__from"
                  />
                ) : null}
                {isSel || isAns ? (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={CELL * 0.46}
                    className={isAns ? 'map-town__ans' : 'map-sel'}
                  />
                ) : null}
                <MapSymbol id={p.symbol} x={c.x} y={c.y} size={CELL * 0.62} />
                {p.label ? (
                  <text x={c.x} y={c.y + CELL * 0.48} className="map-town__label">
                    {spokenReading(p.label)}
                  </text>
                ) : null}
                {isWrong ? (
                  <text
                    x={c.x + CELL * 0.34}
                    y={c.y - CELL * 0.2}
                    className="map-wrongmark"
                    style={{ fontSize: 34 }}
                  >
                    ？
                  </text>
                ) : null}
              </g>
            );
          })}
          <NorthArrow x={W + pad * 0.2} y={-pad * 0.1 + 50} s={26} />
        </svg>
      </div>
      {!revealed ? (
        <div className="mk__side eng-map__side">
          <p className="map-count">{picked !== null ? 'えらんだよ' : 'きごうを タップ'}</p>
          <button
            type="button"
            className="mk-btn mk-btn--ok"
            onClick={() => picked !== null && submit({ value: picked })}
            disabled={locked || picked === null}
            data-testid="check"
          >
            こたえあわせ
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MapView(props: View) {
  const k = props.item.task.kind;
  if (k === 'find') return <FindView {...props} />;
  if (k === 'spell') return <SpellView {...props} />;
  if (k === 'town') return <TownView {...props} />;
  return <PickView {...props} />;
}

export const mapEngine: KitEngineDef<MapItem, MapResponse> = {
  id: 'map',
  Component: MapView,
  judge: judgeMap,
  check: checkMap,
  answerText: mapAnswerText,
};
