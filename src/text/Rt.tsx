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
  if (isGlue(ts[i + 1], ctx)) {
    [body, tail] = splitBeforeBlank(body);
    if (!tail && /\S$/u.test(body)) {
      const cs = [...body];
      [body, tail] = [cs.slice(0, -1).join(''), cs[cs.length - 1]!];
    }
  }
  return [head, body, tail];
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
      case 'text':
        return <Fragment key={k}>{textParts(ts, i, ctx)[1]}</Fragment>;
      case 'ruby':
        // ふりがなを出さない語（isGlue でない）
        return <Fragment key={k}>{tk.base}</Fragment>;
      case 'frac':
        return (
          <span key={k} className="rt-frac-wrap">
            {tk.whole !== undefined ? <span className="rt-frac-whole">{tk.whole}</span> : null}
            <span
              className="rt-frac"
              role="math"
              aria-label={`${tk.whole !== undefined ? `${tk.whole}と` : ''}${tk.den}ぶんの${tk.num}`}
            >
              <span className="rt-frac__num">{tk.num}</span>
              <span className="rt-frac__den">{tk.den}</span>
            </span>
          </span>
        );
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
