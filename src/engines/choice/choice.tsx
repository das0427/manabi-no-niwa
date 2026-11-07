/**
 * choice エンジン: 選択肢から選ぶ（1つ、またはすべて選ぶ）。
 * 1つ選ぶ問題はタップでそのまま答える（v1 と同じ）。すべて選ぶ問題は「こたえあわせ」で答える。
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { ChoiceItem, RichText } from '../../curriculum/types';
import { displayOrder as sharedOrder, displayPosition } from '../shared/order';
import { Rt } from '../../text/Rt';
import { plainText, spacedLabel } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import { observeResize } from '../figure/svgText';
import type { EngineDef, EngineProps, Judgement, RenderCtx } from '../types';
import {
  cardWidths,
  chooseArrange,
  isCounting,
  picSpecsOf,
  solveFit,
  SHADOW_U,
  type PicSpec,
  type PicsArrange,
  type PicsCard,
  type PicsEnv,
  type PicsOption,
} from './pics';
import './choice.css';

/** 答え: 選んだ選択肢の番号（multi は複数） */
export type ChoiceResponse = number[];

/**
 * 区分の上限（ux.maxChoices）で選択肢を減らすときに出す選択肢の番号（元の番号・元の順）。
 * 正解は必ず残し、誤りの選択肢を前から上限まで残す（位置で切ると正解が消えることがある: コードレビュー #3）。
 */
export function visibleOptionIndices(
  options: readonly { correct?: boolean }[],
  max: number,
): number[] {
  const limit = Math.max(2, max);
  if (options.length <= limit) return options.map((_, i) => i);
  const correct = options.flatMap((o, i) => (o.correct ? [i] : []));
  const wrong = options.flatMap((o, i) => (o.correct ? [] : [i]));
  const keep = new Set([...correct, ...wrong.slice(0, Math.max(0, limit - correct.length))]);
  return options.flatMap((_, i) => (keep.has(i) ? [i] : []));
}

/**
 * 選択肢の並び（text-layout-fixes S3）。
 * 文字だけの選択肢が4つ以上→2列のグリッド／問題に図がある・全部8字以下→横一列／
 * column は「1つでも16字超かつ3つ以下」のときだけ。それ以外は指定（無ければ row）。
 * 絵・図の選択肢が混じるときは指定を尊重する（寸法が文字だけの札と違うため）。
 */
/** 絵・図の選択肢に添える文字が「無い、または 4字以下」（絵が主役） */
const figureOnly = (label: string | undefined) =>
  label === undefined || [...plainText(label)].length <= 4;

export function autoLayout(
  options: readonly { label?: string; figure?: unknown }[],
  declared: 'row' | 'grid' | 'column' | undefined,
  hasFigure: boolean,
): 'row' | 'grid' | 'column' {
  const textOnly = options.every((o) => o.figure === undefined && o.label !== undefined);
  if (!textOnly) {
    // 絵・図だけの選択肢（label が無い、または 4字以下）は、パックが column を指定しても横一列にする
    // （縦に並べると3つ目が舞台の下や吹き出しの下に出る。g1.math.numbers-10/4）。入らない分は絵を縮める（choice.css）
    if (
      declared === 'column' &&
      options.every((o) => o.figure !== undefined && figureOnly(o.label))
    )
      return 'row';
    return declared ?? 'row';
  }
  if (declared === 'grid') return 'grid';
  const lens = options.map((o) => [...plainText(o.label ?? '')].length);
  if (options.length >= 4) return hasFigure && lens.every((n) => n <= 8) ? 'row' : 'grid';
  if (hasFigure || lens.every((n) => n <= 8)) return 'row';
  if (lens.some((n) => n > 16)) return 'column';
  return declared === 'column' ? 'row' : (declared ?? 'row');
}

/**
 * 選択肢の文字・並びの目印（text-layout-fixes T3）。
 * long: 文字だけの選択肢で、いちばん長いラベルが12字を超える（ラベルを問題文と同じ大きさ・左そろえ・行間1.5にする）。
 * caption: 絵・図に5字以上の文が付く選択肢が4つ以下で横一列（折り返さず各 1/n の幅に分け、文は札の中で折る）。
 */
export function optionTraits(
  options: readonly { label?: string; figure?: unknown }[],
  layout: 'row' | 'grid' | 'column',
  isPics: boolean,
): { long: boolean; caption: boolean; row4: boolean } {
  const len = (o: { label?: string }) => [...plainText(o.label ?? '')].length;
  const textOnly =
    options.length > 0 && options.every((o) => o.figure === undefined && o.label !== undefined);
  const long = textOnly && options.some((o) => len(o) > 12);
  const caption =
    !isPics &&
    layout === 'row' &&
    options.length >= 2 &&
    options.length <= 4 &&
    options.some((o) => o.figure !== undefined && len(o) >= 5);
  // 文字だけの選択肢が4つで、いちばん長いラベルが9字以下: 2×2 の格子でなく横1行（V2 3。g6.soc.world/0）
  const row4 =
    textOnly &&
    !long &&
    options.length === 4 &&
    layout !== 'column' &&
    options.every((o) => len(o) <= 9);
  return { long, caption, row4 };
}

/** 語のラベルの種類（V2 1）。word: 空白なし8字以下／phrase: 空白で区切った短い句／paren: 「はな（くさばな）」 */
export interface WordTrait {
  kind: 'word' | 'phrase' | 'paren';
  /** 札の幅を決める字数（word は全体、paren は前＋括弧の全体（入らなければ括弧の前で折る）、phrase は 7字までなら空白を含めた全体、それより長ければ2行に入る最小の幅（最長の語以上）。入らなければ空白で折る） */
  len: number;
}

const WORD_MAX = 8;
const PHRASE_MAX = 14;
const PHRASE_ONE_LINE = 7;

/**
 * 語の途中で折らないラベルか。一語（空白なし・8字以下）／空白で区切った短い句（各語8字以下・全体14字以下）／
 * 括弧で読みを足した語（前も括弧も8字以下・全体14字以下）。それ以外（文）は null で、今までどおり折り返す。
 * wordMax は一語の字数の上限（横1行の data-row4 の列だけ 9。g6.soc.world/0 の「オーストラリア大陸」）
 */
export function wordTrait(label: string | undefined, wordMax = WORD_MAX): WordTrait | null {
  if (label === undefined) return null;
  const t = plainText(label).trim();
  const n = [...t].length;
  if (n === 0 || n > PHRASE_MAX) return null;
  const words = t.split(/\s+/u);
  const lens = words.map((w) => [...w].length);
  if (words.length === 1) {
    const m = /^([^（(]+)([（(].*[）)])$/u.exec(t);
    if (m) {
      const a = [...m[1]!].length;
      const b = [...m[2]!].length;
      return a <= wordMax && b <= wordMax ? { kind: 'paren', len: a + b } : null;
    }
    return n <= wordMax ? { kind: 'word', len: n } : null;
  }
  if (!lens.every((l) => l <= wordMax)) return null;
  // 短い句（7字まで）は1行に入る幅にする。それより長い句は2行に入る最小の幅にする（phraseTwoLineLen）
  return { kind: 'phrase', len: n <= PHRASE_ONE_LINE ? n : phraseTwoLineLen(lens) };
}

/**
 * 語の字数の並び（間は空白1字）を2行に分けるとき、長いほうの行の字数が最小になる切れ目の、その字数。
 * 最長の語より小さくならない。3行以上にはしない（「東の 空の ひくい 所」→ 5。W2）
 */
function phraseTwoLineLen(lens: number[]): number {
  let best = Infinity;
  for (let i = 1; i < lens.length; i++) {
    const a = lens.slice(0, i).reduce((x, y) => x + y, 0) + (i - 1);
    const b = lens.slice(i).reduce((x, y) => x + y, 0) + (lens.length - i - 1);
    best = Math.min(best, Math.max(a, b));
  }
  return Math.max(best, ...lens);
}

/** 括弧で読みを足したラベルを、括弧の前までと括弧からに分ける（書き方の記号は切らない側で分ける） */
export function splitParen(label: string): [string, string] {
  const i = label.search(/[（(]/u);
  return i <= 0 ? [label, ''] : [label.slice(0, i), label.slice(i)];
}

/** 選択肢のラベル（choice・listen・reading 共通）。語のラベルは data-word と --len を付ける（choice.css） */
export function OptionLabel({
  label,
  ctx,
  className,
  word,
}: {
  label: RichText;
  ctx: RenderCtx;
  className: string;
  word: WordTrait | null;
}) {
  if (!word) {
    return (
      <span className={className} data-spaced={spacedLabel(label) ? '' : undefined}>
        <Rt text={label} ctx={ctx} />
      </span>
    );
  }
  if (word.kind === 'paren') {
    const [head, paren] = splitParen(label);
    return (
      <span className={className} data-word="paren">
        <Rt text={head} ctx={ctx} />
        <span className="opt-nobr">
          <Rt text={paren} ctx={ctx} />
        </span>
      </span>
    );
  }
  return (
    <span className={className} data-word={word.kind}>
      <Rt text={label} ctx={ctx} />
    </span>
  );
}

/** 語のラベルを持つ札に付ける、クラスと --len（札の幅の基準。choice.css の container 単位に使う） */
export function wordCardProps(word: WordTrait | null): { cls: string; style?: CSSProperties } {
  return word ? { cls: ' has-word', style: { '--len': word.len } as CSSProperties } : { cls: '' };
}

/** 測るための箱: 要素の中に置いた箱の幅（px）。CSS の式（var(--u) など）を px にする */
function pxOf(host: HTMLElement, expr: string): number {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${expr}`;
  host.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

/**
 * 絵だけの札の列で、絵の大きさと札の幅・並べ方を測って決める（text-layout-fixes 第7回 X2）。
 * specs は 並べる札（表示の順）の絵。ear は聞く問題の「きく」の札（今の場所 at・左に置くときに取る幅 side（u）・
 * 場所を選んでよいか free・決めた場所を伝える onChange）。
 */
export interface PicsFit {
  specs: readonly PicSpec[];
  ear?: {
    at: 'top' | 'left';
    side: number;
    free: boolean;
    onChange(at: 'top' | 'left'): void;
  };
}

/** 絵の札の列が変わったか（問題・選択肢・きく札の取る幅が変わったら測り直す。選んだ並べ方は捨てる） */
const picsSig = (fit: PicsFit | null | undefined): string =>
  fit
    ? `${fit.specs.map((s) => `${s.groups.map((g) => g.n).join('+')}/${s.gap}`).join(',')}|${
        fit.ear ? `${fit.ear.side}${fit.ear.free ? 'f' : 'x'}` : ''
      }`
    : '';

/**
 * 絵の札の高さの上限の手がかり（V2 2）: 選択肢の列より上に積まれるものの高さ（px）を --pics-above に、
 * 札のうち絵の下にある分（ラベルの行・札の余白・間隔。いちばん大きい札）を --pics-below に書く。
 * 上は、列から作業領域（.unit__work）まで親をたどり、縦に積む親（flex の column・block）で、前の兄弟の高さ＋間隔と、
 * 親の上の余白を足す。横に並べる親（左の列）は数えない。--work-h（作業領域の高さ）は UnitRunner が書く。
 * ラベルが2行になる札（「はな（くさばな）」）は、行の数のぶん --pics-below が大きくなる（推測でなく測る）。
 *
 * fit を渡すと（絵だけの札の列。第7回 X2）、さらに次を測って決め、戻り値と CSS に書く。
 * - 札ごとの 1 行の絵の数 r・行の数 k・札の余白・ラベルの高さから、幅の合計が列に、並べた高さが作業領域に収まる最大の
 *   絵の大きさ s（上限 15u）を --pic-max に、札の幅を札ごとに --card-w に書く（pics.ts の solveS）。
 * - 4 つの選択肢は、1 段／2×2（聞く問題は「きく」の札が上／左も）の s を比べ、最大の並べ方にする（chooseArrange）。
 *   決めた 1 段／2×2 は戻り値（data-arr="grid"）、「きく」の札の場所は fit.ear.onChange で伝える。
 * 並べ方が変わるときは、書かずに状態だけ変えて、描き直したあとの測り直しで書く（描く前の寸法を残さない）。
 * 測る前（描いた直後）は choice.css の式（--pic-w）の初めの値のまま。
 */
export function usePicsGeometry(
  listRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  fit?: PicsFit | null,
): 'row' | 'grid' {
  const sig = picsSig(fit);
  const [picked, setPicked] = useState<{ sig: string; shape: 'row' | 'grid' } | null>(null);
  const shape = picked && picked.sig === sig ? picked.shape : 'row';
  const earAt = fit?.ear?.at;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return undefined;
    const work = list.closest('.unit__work');
    if (!work) return undefined;
    const watch: Element[] = [work, ...Array.from(list.children)];
    const put = (el: HTMLElement, name: string, value: string) => {
      if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
    };
    const putPx = (name: string, px: number) => put(list, name, `${Math.round(px)}px`);
    const measure = () => {
      let above = 0;
      // 作業領域がスクロールの枠のときの上の余白（UnitRunner が data-scroll-region と一緒に付ける）は、列より上のものではない
      let aboveFit = 0;
      for (let el: HTMLElement = list; el !== work && el.parentElement; el = el.parentElement) {
        const parent = el.parentElement as HTMLElement;
        const st = getComputedStyle(parent);
        // 横に並べる親は数えない: flex の row、2 列以上の grid（作業領域の横並び data-layout="side"。図は左の列）
        const stacked = !(
          (st.display.includes('flex') && st.flexDirection.startsWith('row')) ||
          (st.display.includes('grid') && st.gridTemplateColumns.trim().split(/\s+/).length > 1)
        );
        if (!stacked) continue;
        const gap = parseFloat(st.rowGap) || 0;
        const pad = parseFloat(st.paddingTop) || 0;
        above += pad;
        if (!(parent === work && work.hasAttribute('data-scroll-region'))) aboveFit += pad;
        for (let s = parent.firstElementChild; s && s !== el; s = s.nextElementSibling) {
          const pos = getComputedStyle(s).position;
          if (pos === 'absolute' || pos === 'fixed') continue;
          if (!watch.includes(s)) watch.push(s);
          above += (s as HTMLElement).offsetHeight + gap;
          aboveFit += (s as HTMLElement).offsetHeight + gap;
        }
        if (parent === work) break;
      }
      putPx('--pics-above', above);
      let below = 0;
      for (const card of Array.from(list.children) as HTMLElement[]) {
        const cs = getComputedStyle(card);
        const label = card.querySelector<HTMLElement>('[class$="__label"]');
        const edge =
          (parseFloat(cs.paddingTop) || 0) +
          (parseFloat(cs.paddingBottom) || 0) +
          (parseFloat(cs.borderTopWidth) || 0) +
          (parseFloat(cs.borderBottomWidth) || 0);
        below = Math.max(
          below,
          edge + (label ? label.offsetHeight + (parseFloat(cs.rowGap) || 0) : 0),
        );
      }
      putPx('--pics-below', below);
      if (fit) place(fit, aboveFit);
    };
    /** 札の寸法を測り、並べ方と絵の大きさ・札の幅を決めて書く（描き直しが要るときは状態だけ変えて戻る） */
    const place = (f: PicsFit, above: number) => {
      const cards = Array.from(list.children) as HTMLElement[];
      if (cards.length !== f.specs.length) return;
      // 寸法は、作業領域の縮み（--fit）を 1 に戻した値（--u0 の単位）で決める。--fit が 1 より小さいときの測った値（余白・ラベルの高さ）
      // を g 倍して戻す。--work-h・--pics-col-w（--u0 の単位）は縮まない。縮んだ値のまま使うと、空きが広く見えて絵が大きくなり、
      // 入らなくて --fit がさらに縮む行き来になり、作業領域がスクロールの枠のまま戻らなかった（画面サイズを往復したとき）
      const u = pxOf(list, 'var(--u0, var(--u))');
      const uNow = pxOf(list, 'var(--u)');
      const g = uNow > 0 ? u / uNow : 1;
      // 列の幅: CSS の既定（--pics-col-w。作業領域の 88u・90u）と、置き場の幅（図を左に置く横並びでは右の列だけ）の小さいほう
      const box = list.closest<HTMLElement>('.eng-listen, .eng-choice');
      const boxW = box
        ? box.clientWidth +
          (work.hasAttribute('data-scroll-region')
            ? parseFloat(getComputedStyle(work).paddingRight) || 0
            : 0)
        : Infinity;
      const colW = Math.min(pxOf(list, 'var(--pics-col-w)'), boxW);
      // 測れない（隠れている・寸法の無い環境）ときは CSS の式に任せる
      if (!(u > 0) || !(colW > 0)) return;
      const cs = getComputedStyle(list);
      const group = list.querySelector<HTMLElement>('.fig-illust__group');
      const picGap =
        ((group ? parseFloat(getComputedStyle(group).columnGap) : NaN) || 0.6 * uNow) * g;
      const workH =
        parseFloat(getComputedStyle(list).getPropertyValue('--work-h')) ||
        (work as HTMLElement).clientHeight ||
        Infinity;
      const geo: PicsCard[] = cards.map((card, i) => {
        const st = getComputedStyle(card);
        const label = card.querySelector<HTMLElement>('[class$="__label"]');
        const edgeY =
          (parseFloat(st.paddingTop) || 0) +
          (parseFloat(st.paddingBottom) || 0) +
          (parseFloat(st.borderTopWidth) || 0) +
          (parseFloat(st.borderBottomWidth) || 0);
        return {
          ...f.specs[i]!,
          minW: card.classList.contains('has-word') ? pxOf(card, 'var(--word-min-w)') * g : 0,
          padX:
            ((parseFloat(st.paddingLeft) || 0) +
              (parseFloat(st.paddingRight) || 0) +
              (parseFloat(st.borderLeftWidth) || 0) +
              (parseFloat(st.borderRightWidth) || 0)) *
            g,
          minH: (parseFloat(st.minHeight) || 0) * g,
          below: (edgeY + (label ? label.offsetHeight + (parseFloat(st.rowGap) || 0) : 0)) * g,
        };
      });
      const ear = f.ear;
      const earTopH = ear ? pxOf(list, 'var(--ear-top-h, 0px)') * g : 0;
      // 「きく」の札が上の分（--ear-top-h）を除いた、列より上のもの
      const aboveBase = Math.max(0, above * g - (ear?.at === 'top' ? earTopH : 0));
      const aboveNow = above * g;
      /** 並べ方 e（「きく」の札の場所）で札を並べられる寸法 */
      const envFor = (e: 'top' | 'left' | undefined): PicsEnv => ({
        width: colW - (e === 'left' && ear ? ear.side * u : 0),
        height: workH - (ear ? aboveBase + (e === 'top' ? earTopH : 0) : aboveNow) - SHADOW_U * u,
        gapX: (parseFloat(cs.columnGap) || 0) * g,
        gapY: (parseFloat(cs.rowGap) || 0) * g,
        picGap,
        u,
      });
      const ears: ('top' | 'left' | undefined)[] = !ear
        ? [undefined]
        : ear.free
          ? [ear.at, ear.at === 'top' ? 'left' : 'top']
          : [ear.at];
      const other = shape === 'row' ? 'grid' : 'row';
      const shapes: ('row' | 'grid')[] = cards.length === 4 ? [shape, other] : ['row'];
      const options: PicsOption[] = [];
      for (const e of ears)
        for (const sh of shapes)
          options.push({ shape: sh, ear: e, ...solveFit(geo, sh, envFor(e)) });
      const now: PicsArrange = { shape, ear: ear?.at };
      const best = chooseArrange(options, now, Math.max(...geo.map((c) => c.cap)) * u);
      const earMoves = best.ear !== undefined && best.ear !== ear?.at;
      if (best.shape !== shape || earMoves) {
        if (best.shape !== shape) setPicked({ sig, shape: best.shape });
        if (earMoves) ear?.onChange(best.ear!);
        return;
      }
      // 選んだ並べ方で、絵の大きさと札の幅を書く（--pic-floor は 0: s が下限より小さくても s のまま描く。下限に合わせて
      // 大きくすると作業領域がスクロールの枠になり、札が隠れる。数える絵の下限 4u は検査 small-figure が見る。pics.ts）
      put(list, '--pic-max', `${(Math.floor(best.s * 100) / 100).toFixed(2)}px`);
      put(list, '--pic-floor', '0px');
      cardWidths(geo, best.s, envFor(best.ear)).forEach((w, i) =>
        put(cards[i]!, '--card-w', `${w.toFixed(1)}px`),
      );
    };
    measure();
    return observeResize([...watch], measure);
    // fit の中身は sig（と ear.at・shape）が変わるたびに測り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef, enabled, sig, shape, earAt]);
  return shape;
}

/** 図 1 つに並ぶ絵の数（横幅の見積り用。絵以外の図は 1） */
function picCount(fig: unknown): number {
  const f = fig as { kind?: string; count?: number; items?: unknown[] } | undefined;
  if (!f || typeof f !== 'object') return 1;
  if (f.kind === 'illust') {
    const n = f.count ?? 1;
    return n > 10 ? 5 : Math.max(1, n);
  }
  if (f.kind === 'row' && Array.isArray(f.items))
    return Math.max(
      1,
      f.items.reduce<number>((a, x) => a + picCount(x), 0),
    );
  return 1;
}

/**
 * 絵・図だけの選択肢を横一列に並べるときの、絵の縮みの手がかり（text-layout-fixes R3）。
 * 並べる数 --pics-n と、全部の選択肢の絵の合計 --pics-total を CSS に渡す。
 * CSS は「絵 ≤ min(既定, (作業領域の幅 − 間隔・余白) ÷ 絵の合計)」に縮める（既定のままで入るときは変わらない）。
 */
export function picsProps(
  options: readonly { label?: string; figure?: unknown }[],
  layout: 'row' | 'grid' | 'column',
  /** 選択肢の列の横に並ぶものの幅（u。聞く問題で「きく」の札を左に置くとき）。既定 0 */
  side = 0,
): { className: string; style?: CSSProperties } {
  // 絵・図だけ（文字が無い、または 4字以下）の選択肢。長い文字が付くときは縮めず、今までどおり折り返す
  if (
    layout !== 'row' ||
    options.length === 0 ||
    !options.every((o) => o.figure !== undefined && figureOnly(o.label))
  )
    return { className: '' };
  const total = options.reduce((a, o) => a + picCount(o.figure), 0);
  return {
    className: ' is-pics',
    style: {
      '--pics-n': options.length,
      '--pics-total': total,
      '--pics-side': side,
      // 1つの選択肢に絵が複数（数えるりんご）は、絵1つの下限（10u）を当てない（札から絵がはみ出す）
      ...(total > options.length ? { '--pic-floor': '0px' } : {}),
    } as CSSProperties,
  };
}

/**
 * 聞く問題で、選択肢に絵・図があるとき「きく」の札を上の段（補助の寸法）に置くか。
 * 絵・図が3つ以下で1つに1つずつ（時計・図1つ）なら左の列のまま（上の段に置くと縦が足りず、時計が縮んで数字が重なる。
 * g4.en.time-days/14）。4つ以上・1つの中に絵が複数（数えるねこ・色のボールと物）は上の段（左の列だと横が足りない）
 */
export function earOnTop(options: readonly { figure?: unknown }[]): boolean {
  if (!options.some((o) => o.figure !== undefined)) return false;
  const all = options.every((o) => o.figure !== undefined);
  const total = options.reduce((a, o) => a + (o.figure !== undefined ? picCount(o.figure) : 0), 0);
  return !(all && options.length <= 3 && total === options.length);
}

/**
 * 絵だけの札の列（is-pics）で、全部の選択肢が絵だけの図（pics.ts の picSpecsOf）なら、絵の大きさと札の幅・並べ方を
 * 測って決める対象（第7回 X2）。時計・図・表などが混じる列は null（今までどおり choice.css の式に任せる）。
 */
export function picsFitOf(
  options: readonly { figure?: unknown }[],
  isPics: boolean,
  ear?: NonNullable<PicsFit['ear']>,
): PicsFit | null {
  if (!isPics) return null;
  const specs = picSpecsOf(options);
  return specs ? { specs, ear } : null;
}

/** 絵の札の列に付ける目印。data-fit: 寸法を測る列／data-count: 数える札（5 こずつの行）／data-arr: 2×2 */
export const picsAttrs = (fit: PicsFit | null, shape: 'row' | 'grid') => ({
  'data-fit': fit ? '' : undefined,
  'data-count': fit && isCounting(fit.specs) ? '' : undefined,
  'data-arr': fit && shape === 'grid' ? 'grid' : undefined,
});

/** 絵の札に付ける、絵 1 つの既定の大きさ（--pic-cap。数える札の 1 行の幅を決める。choice.css） */
export const picCapStyle = (
  fit: PicsFit | null,
  pos: number,
  base?: CSSProperties,
): CSSProperties | undefined =>
  fit
    ? ({ ...base, '--pic-cap': `calc(var(--u) * ${fit.specs[pos]!.minCap})` } as CSSProperties)
    : base;

const labelsOf = (item: Pick<ChoiceItem, 'options'>) =>
  item.options.map((o) => (typeof o.label === 'string' ? o.label : undefined));

/** 選択肢を並べる順（元の番号）。規則は engines/shared/order.ts */
export function displayOrder(
  item: Pick<ChoiceItem, 'id' | 'fixedOrder' | 'options'> &
    Partial<Pick<ChoiceItem, 'prompt' | 'hints' | 'explain'>>,
  shown: number[],
): number[] {
  return sharedOrder(item, shown, labelsOf(item));
}

export function judgeChoice(item: ChoiceItem, picked: ChoiceResponse): Judgement {
  const correct = item.options.flatMap((o, i) => (o.correct ? [i] : []));
  if (item.multi) {
    const a = [...new Set(picked)].sort((x, y) => x - y);
    if (a.length === correct.length && a.every((v, i) => v === correct[i]))
      return { result: 'correct' };
    // 最初に見つかった誤りの選択肢の誤概念
    const wrongPick = a.find((i) => !item.options[i]?.correct);
    return {
      result: 'wrong',
      misconception: wrongPick !== undefined ? item.options[wrongPick]?.misconception : undefined,
      mark: wrongPick !== undefined ? [wrongPick] : [],
    };
  }
  const i = picked[0];
  if (i === undefined || !item.options[i]) return { result: 'wrong', mark: [] };
  if (item.options[i]!.correct) return { result: 'correct' };
  return { result: 'wrong', misconception: item.options[i]!.misconception, mark: [i] };
}

export function checkChoice(item: ChoiceItem): string[] {
  const errs: string[] = [];
  const nCorrect = item.options.filter((o) => o.correct).length;
  if (item.options.length < 2) errs.push('選択肢が2つ未満');
  if (nCorrect === 0) errs.push('正解の選択肢が無い');
  if (!item.multi && nCorrect !== 1) errs.push('1つ選ぶ問題なのに正解が1つではない');
  const labels = item.options.map((o) =>
    o.label !== undefined ? plainText(o.label) : JSON.stringify(o.figure),
  );
  if (new Set(labels).size !== labels.length) errs.push('同じ選択肢が重複している');
  for (const o of item.options) {
    if (o.label === undefined && o.figure === undefined) errs.push('選択肢に文も図も無い');
    if (o.correct && o.misconception) errs.push('正解の選択肢に誤概念IDが付いている');
  }
  return errs;
}

function ChoiceView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: EngineProps<ChoiceItem, ChoiceResponse>) {
  const [picked, setPicked] = useState<number[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const shown = displayOrder(
    item,
    visibleOptionIndices(item.options, item.multi ? item.options.length : ctx.ux.maxChoices),
  );
  const stateOf = (i: number): TapState => {
    const o = item.options[i]!;
    if (revealed && o.correct) return 'correct';
    if (wrong.has(i)) return 'wrong';
    if (item.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (disabled || revealed) return;
    if (!item.multi) {
      submit([i]);
      return;
    }
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  const layout = autoLayout(
    shown.map((i) => ({
      label: typeof item.options[i]!.label === 'string' ? item.options[i]!.label : undefined,
      figure: item.options[i]!.figure,
    })),
    item.layout,
    item.figure !== undefined,
  );
  const pics = picsProps(
    shown.map((i) => ({
      label: typeof item.options[i]!.label === 'string' ? item.options[i]!.label : undefined,
      figure: item.options[i]!.figure,
    })),
    layout,
  );
  const traits = optionTraits(
    shown.map((i) => ({
      label: typeof item.options[i]!.label === 'string' ? item.options[i]!.label : undefined,
      figure: item.options[i]!.figure,
    })),
    layout,
    pics.className !== '',
  );
  const fit = picsFitOf(
    shown.map((i) => ({ figure: item.options[i]!.figure })),
    pics.className !== '',
  );
  const shape = usePicsGeometry(listRef, pics.className !== '' || traits.caption, fit);
  const hasLabel = shown.some((i) => item.options[i]!.label !== undefined);
  return (
    <div className="eng-choice">
      <div
        ref={listRef}
        className={`eng-choice__options eng-choice__options--${layout}${pics.className}${traits.caption ? ' is-caption' : ''}`}
        style={
          pics.className
            ? ({ ...pics.style, '--pics-label': hasLabel ? 1 : 0 } as CSSProperties)
            : pics.style
        }
        data-long={traits.long ? '' : undefined}
        data-row4={traits.row4 ? '' : undefined}
        {...picsAttrs(fit, shape)}
      >
        {shown
          .map((i) => ({ o: item.options[i]!, i }))
          .map(({ o, i }, pos) => {
            const word = traits.long
              ? null
              : wordTrait(typeof o.label === 'string' ? o.label : undefined, traits.row4 ? 9 : 8);
            const wc = wordCardProps(word);
            return (
              <Choice
                key={i}
                label={o.label !== undefined ? plainText(o.label) : `${pos + 1}ばん`}
                state={stateOf(i)}
                disabled={disabled || revealed}
                onPress={() => press(i)}
                testId={`opt-${i}`}
                className={`eng-choice__opt${o.figure ? '' : ' eng-choice__opt--text'}${wc.cls}`}
                style={picCapStyle(fit, pos, wc.style)}
              >
                {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
                {o.label !== undefined ? (
                  <OptionLabel
                    label={o.label}
                    ctx={ctx}
                    className="eng-choice__label"
                    word={word}
                  />
                ) : null}
              </Choice>
            );
          })}
      </div>
      {item.multi && !revealed ? (
        <button
          type="button"
          className="tap tap--main eng-check"
          disabled={disabled || picked.length === 0}
          onClick={() => submit(picked)}
          data-testid="check"
        >
          こたえあわせ
        </button>
      ) : null}
    </div>
  );
}

export const choiceEngine: EngineDef<ChoiceItem, ChoiceResponse> = {
  id: 'choice',
  Component: ChoiceView,
  judge: judgeChoice,
  check: checkChoice,
  answerText: (item) =>
    item.options
      .flatMap((o, i) =>
        o.correct
          ? [o.label ?? `${displayPosition(item, item.options.length, i, labelsOf(item))}ばん`]
          : [],
      )
      .join('、'),
};
