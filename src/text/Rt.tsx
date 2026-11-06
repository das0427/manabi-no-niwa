/**
 * RichText の描画（ふりがな・分数・強調・空欄）。ふりがなを付けるかは
 * プロフィールの設定（furigana）と在籍学年、漢字の配当学年で決める（src/audience/audience.ts showFurigana）。
 */
import { Fragment, type ReactNode } from 'react';
import { showFurigana } from '../audience/audience';
import type { RenderCtx } from '../engines/types';
import { kanjiGrade } from './kanji-grades';
import { parseRich, type Token } from './rich';
import './rt.css';

/** 語の中で一番上の学年の字の学年（配当外があれば null） */
export function wordGrade(base: string): number | null {
  let max = 0;
  for (const ch of base) {
    if (!/[一-鿿㐀-䶿]/.test(ch)) continue;
    const g = kanjiGrade(ch);
    if (g === 7) return null;
    max = Math.max(max, g);
  }
  return max || null;
}

export function rubyVisible(
  tk: Extract<Token, { t: 'ruby' }>,
  ctx: Pick<RenderCtx, 'furigana' | 'learnerGrade'>,
): boolean {
  if (tk.hide) return false;
  return showFurigana(ctx.furigana, wordGrade(tk.base), ctx.learnerGrade);
}

/** 数字＋半角空白＋単位の空白を、表示のときだけ改行しない空白（U+00A0）にする（読み上げ・plainText は変えない） */
export function nbspUnits(s: string): string {
  return s.replace(/(\d) (?=(?:cm|mm|km|kg|mL|dL|m|g|L)(?![A-Za-z])|％|℃|度)/g, '$1 ');
}

const OPENERS = '「『（([【〈《“‘';
const CLOSERS_PUNCT = '」』）)]】〉》”’、。，．！？!?';

/**
 * 空欄の直前の始め括弧と直後の終わり括弧・句読点を、空欄と離さない（nowrap の span で包む）ための分割。
 * 戻り値は [前の部分, 包む部分]（前の）／[包む部分, 後ろの部分]（後ろの）。
 */
export function splitBeforeBlank(s: string): [string, string] {
  let i = s.length;
  while (i > 0 && OPENERS.includes(s[i - 1] as string)) i--;
  return [s.slice(0, i), s.slice(i)];
}
export function splitAfterBlank(s: string): [string, string] {
  let i = 0;
  while (i < s.length && CLOSERS_PUNCT.includes(s[i] as string)) i++;
  return [s.slice(0, i), s.slice(i)];
}

/**
 * RichText の書き方のままの文（空欄の前後で切った断片）から、空欄に付ける端を切り出す（fill の空欄のボタン用）。
 * 括弧・句読点の並び、無ければ隣の1字（空白・書き方の記号・漢字は付けない。漢字はふりがなの親字を切ってしまうため）。
 * 戻り値は [空欄の直後に付ける部分, 残り]（edge: 'head'）／[残り, 空欄の直前に付ける部分]（edge: 'tail'）
 */
export function splitRichEdge(s: string, edge: 'head' | 'tail'): [string, string] {
  const glue = (c: string | undefined) =>
    c !== undefined && /\S/u.test(c) && !'《》[]{}*'.includes(c) && !/[一-鿿㐀-䶿々〆ヶ]/u.test(c);
  const cs = [...s];
  if (edge === 'head') {
    const [h, rest] = splitAfterBlank(s);
    if (h) return [h, rest];
    return glue(cs[0]) && cs[1] !== '《' ? [cs[0]!, cs.slice(1).join('')] : ['', s];
  }
  const [rest, t] = splitBeforeBlank(s);
  if (t) return [rest, t];
  return glue(cs[cs.length - 1]) ? [cs.slice(0, -1).join(''), cs[cs.length - 1]!] : [s, ''];
}

type Ctx = Pick<RenderCtx, 'furigana' | 'learnerGrade'>;

/**
 * 字と違って、前後で改行できてしまう token（空欄の inline-block と、ふりがな付きの ruby）。
 * keep-all（分かち書き）でも「あらいました／□」「お／金を」のように語の途中で折れるので、
 * 隣の字といっしょに nowrap にまとめて、語の中の1字のように扱う（DESINGN.md 17章）
 */
function isGlue(tk: Token | undefined, ctx: Ctx): boolean {
  return tk?.t === 'blank' || (tk?.t === 'ruby' && rubyVisible(tk, ctx));
}

/**
 * 文字の token を [前の token に付ける頭, 本体, 次の token に付ける尻] に分ける。
 * 付けるのは括弧・句読点の並び（頭は終わり括弧・句読点、尻は始め括弧）、無ければ隣の1字（空白は付けない）。
 * 付ける部分は前後の token と同じ nowrap の span に入れる（別の span にすると、span の境目で折れてしまう）
 */
function textParts(ts: Token[], i: number, ctx: Ctx): [string, string, string] {
  const tk = ts[i];
  if (tk?.t !== 'text') return ['', '', ''];
  let head = '';
  let body = nbspUnits(tk.s);
  let tail = '';
  if (isGlue(ts[i - 1], ctx)) {
    [head, body] = splitAfterBlank(body);
    if (!head && /^\S/u.test(body)) [head, body] = [[...body][0]!, [...body].slice(1).join('')];
  }
  // 分数のすぐ後ろの仮名（空白まで）は分数と離さない（「□／は」）
  if (ts[i - 1]?.t === 'frac') {
    const m = KANA_RUN.exec(body);
    if (m && [...m[0]].length <= FRAC_RUN_MAX) [head, body] = [m[0], body.slice(m[0].length)];
  }
  if (isGlue(ts[i + 1], ctx)) {
    // 式の演算子と空白（「＝ {{}}」「÷ {{}}」）は空欄と離さない
    const op = /[＋−×÷＝][ \u3000]+$/u.exec(body);
    if (op) {
      tail = op[0];
      body = body.slice(0, op.index);
    } else {
      [body, tail] = splitBeforeBlank(body);
      if (!tail && /\S$/u.test(body)) {
        const cs = [...body];
        [body, tail] = [cs.slice(0, -1).join(''), cs[cs.length - 1]!];
      }
    }
    // まとまりの先頭が行頭禁則の字（「…のに／、{{}}」の「、」）なら、さらに前の1字も含める
    while (tail && LINE_START_NG.test(tail) && /\S$/u.test(body)) {
      const cs = [...body];
      [body, tail] = [cs.slice(0, -1).join(''), cs[cs.length - 1]! + tail];
    }
  }
  return [head, body, tail];
}

/** 行頭に置かない字（句読点・終わり括弧・長音・小さい仮名）。nobr のまとまりの先頭がこれなら、さらに前の1字を含める */
const LINE_START_NG = /^[、。，．」』）)〕\]】ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/u;

/** 記号・分数のすぐ後ろの仮名（空白・句読点・数字の前まで）。後ろの終わり括弧・句読点は別に付ける */
const KANA_RUN = /^[ぁ-ゖァ-ヺー]+(?=$|[\s、。，．！？!?」』）)\d])/u;
const FRAC_RUN_MAX = 8;
/** 記号（○●□■△▲◎×〜…）＋仮名の最大字数（12 字を超えるまとまりは作らない） */
const SYMBOL_MAX = 12;
const SYMBOL_RE = String.raw`(?<sym>[○●□■△▲◎×〜…][ぁ-ゖァ-ヺー]+(?=$|[\s、。，．！？!?」』）)\d]))`;
/** 演算子＋空白＋後ろの1つの数・□（「＝ □」「÷ 2」） */
const OP_RE = String.raw`(?<op>[＋−×÷＝][ \u3000]*(?:\d+(?:[.,]\d+)*|□))`;
const NOBR_MAX = 10;
/** 1字の並びの上限（回文の「た・け・や・ぶ・や・け・た」は13字。解説の1行は20字ほど） */
const NOBR_MAX_DOTS = 15;
const PUNCT_BRACKET = OPENERS + CLOSERS_PUNCT;
const EXPR_CH = /^[＋−×÷＝＜＞=<>+()（）□]$/u;
/** 式に使う字の並び（数字は小数・桁区切りの . , を含めて1つにする） */
const EXPR = String.raw`(?:\d+(?:[.,]\d+)*|[＋−×÷＝＜＞=<>+()（）□])+`;
/** 1字ずつ「・」でつないだ並び（き・つ・つ・き）。前後が語の続きでないものだけ */
const BOUND = String.raw`[\s、。，．！？!?「」『』（）()\[\]【】〈〉《》“”‘’]`;
const NOBR_RE = new RegExp(
  String.raw`(?<=^|${BOUND})[^\s・]・(?:[^\s・]・)*[^\s・](?=$|${BOUND})|${SYMBOL_RE}|${OP_RE}|${EXPR}`,
  'gu',
);

/**
 * 表示だけの nowrap の単位を .rt-nobr で包む（読み上げ・plainText は変えない。DESINGN.md 17章）。
 *  - 数字の並び＋直後の1字（「1字」「4音」「7こ」「60分」。空白・句読点・括弧・数字・英字は付けない）
 *  - 空白を含まない式（数字・＋−×÷＝＜＞・括弧・□ の3字以上。「10＋4＝14」）
 *  - 1字ずつ「・」でつないだ並び（「き・つ・つ・き」）
 * 前の始め括弧・後ろの終わり括弧と句読点も包む。10字（「・」の並びは15字。括弧は数えない）を超えるものは包まない（行より長い nowrap ではみ出すため）
 */
export function wrapNobr(s: string, key = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of s.matchAll(NOBR_RE)) {
    let end = m.index + m[0].length;
    if (/\d$/.test(m[0]) && !m[0].includes('・')) {
      const next = [...s.slice(end)][0];
      if (
        next !== undefined &&
        !/[\s\dA-Za-z]/u.test(next) &&
        !PUNCT_BRACKET.includes(next) &&
        !EXPR_CH.test(next)
      )
        end += next.length;
    }
    const piece = s.slice(m.index, end);
    const len = [...piece].length;
    if (m.groups?.sym !== undefined || m.groups?.op !== undefined) {
      if (len > (m.groups.sym !== undefined ? SYMBOL_MAX : NOBR_MAX)) continue;
    } else if (
      len > (m[0].includes('・') ? NOBR_MAX_DOTS : NOBR_MAX) ||
      len < 2 ||
      (len < 3 && end === m.index + m[0].length)
    )
      continue;
    // 直前の始め括弧・直後の終わり括弧と句読点も同じ nowrap に入れる（「／た・け・や・ぶ」と行末に始め括弧が残らないように）
    let from = m.index;
    while (from > last && OPENERS.includes(s[from - 1] as string)) from--;
    while (end < s.length && CLOSERS_PUNCT.includes(s[end] as string)) end++;
    if (from > last) out.push(s.slice(last, from));
    out.push(
      <span key={`${key}n${n++}`} className="rt-nobr">
        {s.slice(from, end)}
      </span>,
    );
    last = end;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.length ? out : [s];
}

function renderGlue(tk: Token, k: string): ReactNode {
  if (tk.t === 'blank') return <span key={k} className="rt-blank" aria-label="あいている ところ" />;
  if (tk.t === 'ruby')
    return (
      <ruby key={k}>
        {tk.base}
        <rt>{tk.reading}</rt>
      </ruby>
    );
  return null;
}

const SYMBOL_LABEL: Record<string, string> = { '□': 'しかく', '○': 'まる', '△': 'さんかく' };
const fracPartLabel = (x: number | string) =>
  typeof x === 'number' ? String(x) : (SYMBOL_LABEL[x] ?? x);
/** 分子・分母。記号（□○△）は空欄の □ と同じ大きさ（1em 角）の枠に入れる */
const fracPart = (x: number | string) =>
  typeof x === 'number' ? x : <span className="rt-frac__sym">{x}</span>;

function renderTokens(ts: Token[], ctx: Ctx, key = ''): ReactNode[] {
  return ts.map((tk, i) => {
    const k = `${key}${i}`;
    // 続けて並ぶ空欄・ruby は、先頭の token がまとめて描く
    if (isGlue(tk, ctx)) {
      if (isGlue(ts[i - 1], ctx)) return null;
      let j = i;
      while (isGlue(ts[j + 1], ctx)) j++;
      const before = textParts(ts, i - 1, ctx)[2];
      const after = textParts(ts, j + 1, ctx)[0];
      const run = ts.slice(i, j + 1).map((t, m) => renderGlue(t, `${k}-${m}`));
      return before || after || run.length > 1 ? (
        <span key={k} className="rt-nobr">
          {before}
          {run}
          {after}
        </span>
      ) : (
        <Fragment key={k}>{run}</Fragment>
      );
    }
    switch (tk.t) {
      case 'text': {
        let body = textParts(ts, i, ctx)[1];
        // ふりがなを出さない語が続くときは、数字の並びを語の頭の1字と離さない（下の ruby で包む）
        const next = ts[i + 1];
        if (next?.t === 'ruby' && !isGlue(next, ctx)) body = body.replace(/\d+$/, '');
        return <Fragment key={k}>{wrapNobr(body, k)}</Fragment>;
      }
      case 'ruby': {
        // ふりがなを出さない語（isGlue でない）。直前が数字なら、数字の並びと語の頭の1字を1つの nowrap にする
        const prev = ts[i - 1];
        const digits =
          prev?.t === 'text' ? /\d+$/.exec(textParts(ts, i - 1, ctx)[1])?.[0] : undefined;
        if (digits) {
          const [first, ...rest] = [...tk.base];
          return (
            <Fragment key={k}>
              <span className="rt-nobr">
                {digits}
                {first}
              </span>
              {rest.join('')}
            </Fragment>
          );
        }
        return <Fragment key={k}>{tk.base}</Fragment>;
      }
      case 'frac': {
        const after = textParts(ts, i + 1, ctx)[0];
        const fr = (
          <span key={after ? undefined : k} className="rt-frac-wrap">
            {tk.whole !== undefined ? <span className="rt-frac-whole">{tk.whole}</span> : null}
            <span
              className="rt-frac"
              role="math"
              aria-label={`${tk.whole !== undefined ? `${tk.whole}と` : ''}${fracPartLabel(tk.den)}ぶんの${fracPartLabel(tk.num)}`}
            >
              <span className="rt-frac__num">{fracPart(tk.num)}</span>
              <span className="rt-frac__den">{fracPart(tk.den)}</span>
            </span>
          </span>
        );
        return after ? (
          <span key={k} className="rt-nobr">
            {fr}
            {after}
          </span>
        ) : (
          fr
        );
      }
      case 'strong':
        return (
          <strong key={k} className="rt-strong">
            {renderTokens(tk.children, ctx, `${k}-`)}
          </strong>
        );
      case 'blank':
        return null;
    }
  });
}

export function Rt({
  text,
  ctx,
  className,
}: {
  text: string;
  ctx: Pick<RenderCtx, 'furigana' | 'learnerGrade'>;
  className?: string;
}) {
  return (
    <span className={['rt', className ?? ''].join(' ')}>{renderTokens(parseRich(text), ctx)}</span>
  );
}
