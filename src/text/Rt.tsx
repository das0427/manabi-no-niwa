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

function renderTokens(
  ts: Token[],
  ctx: Pick<RenderCtx, 'furigana' | 'learnerGrade'>,
  key = '',
): ReactNode[] {
  return ts.map((tk, i) => {
    const k = `${key}${i}`;
    switch (tk.t) {
      case 'text':
        return <Fragment key={k}>{tk.s}</Fragment>;
      case 'ruby':
        return rubyVisible(tk, ctx) ? (
          <ruby key={k}>
            {tk.base}
            <rt>{tk.reading}</rt>
          </ruby>
        ) : (
          <Fragment key={k}>{tk.base}</Fragment>
        );
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
        return <span key={k} className="rt-blank" aria-label="あいている ところ" />;
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
