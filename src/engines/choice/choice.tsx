/**
 * choice エンジン: 選択肢から選ぶ（1つ、またはすべて選ぶ）。
 * 1つ選ぶ問題はタップでそのまま答える（v1 と同じ）。すべて選ぶ問題は「こたえあわせ」で答える。
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { ChoiceItem, RichText } from '../../curriculum/types';
import { displayOrder as sharedOrder, displayPosition } from '../shared/order';
import { Rt } from '../../text/Rt';
import { plainText, spacedLabel } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import { observeResize } from '../figure/svgText';
import type { EngineDef, EngineProps, Judgement, RenderCtx } from '../types';
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

/**
 * 絵の札の高さの上限の手がかり（V2 2）: 選択肢の列より上に積まれるものの高さ（px）を --pics-above に、
 * 札のうち絵の下にある分（ラベルの行・札の余白・間隔。いちばん大きい札）を --pics-below に書く。
 * 上は、列から作業領域（.unit__work）まで親をたどり、縦に積む親（flex の column・block）で、前の兄弟の高さ＋間隔と、
 * 親の上の余白を足す。横に並べる親（左の列）は数えない。--work-h（作業領域の高さ）は UnitRunner が書く。
 * ラベルが2行になる札（「はな（くさばな）」）は、行の数のぶん --pics-below が大きくなる（推測でなく測る）。
 */
export function usePicsGeometry(listRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return undefined;
    const work = list.closest('.unit__work');
    if (!work) return undefined;
    const watch: Element[] = [work, ...Array.from(list.children)];
    const put = (name: string, px: number) => {
      const v = `${Math.round(px)}px`;
      if (list.style.getPropertyValue(name) !== v) list.style.setProperty(name, v);
    };
    const measure = () => {
      let above = 0;
      for (let el: HTMLElement = list; el !== work && el.parentElement; el = el.parentElement) {
        const parent = el.parentElement as HTMLElement;
        const st = getComputedStyle(parent);
        const stacked = !(st.display.includes('flex') && st.flexDirection.startsWith('row'));
        if (!stacked) continue;
        const gap = parseFloat(st.rowGap) || 0;
        above += parseFloat(st.paddingTop) || 0;
        for (let s = parent.firstElementChild; s && s !== el; s = s.nextElementSibling) {
          const pos = getComputedStyle(s).position;
          if (pos === 'absolute' || pos === 'fixed') continue;
          if (!watch.includes(s)) watch.push(s);
          above += (s as HTMLElement).offsetHeight + gap;
        }
        if (parent === work) break;
      }
      put('--pics-above', above);
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
      put('--pics-below', below);
    };
    measure();
    return observeResize([...watch], measure);
  }, [listRef, enabled]);
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
  usePicsGeometry(listRef, pics.className !== '' || traits.caption);
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
                style={wc.style}
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
