/**
 * 絵のまとまり（皿）と式の数字を描く。配置は layout.ts。まとまりと数字は同じ列に置く。
 */
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { EAT_SHIFT, type Layout } from './layout';
import type { MathItem } from './logic';
import { u } from './types';

interface Props {
  layout: Layout;
  item: MathItem;
  /** 「たべた」絵に印を付ける（C）。 */
  eaten: boolean;
  /** 「たべた」絵を皿の外へ動かす（動きを減らす設定では false） */
  moveEaten: boolean;
  /** 絵の通し番号 → 付いた番号（0 は未） */
  numbers: readonly number[];
  /** 数えられない間（実演中・正解のあと） */
  locked: boolean;
  /** 注目する皿（ヒント2） */
  hintPlates: readonly string[];
  /** 正解のあと、？ の代わりに出す答え */
  answer: number | null;
  onPic: (i: number) => void;
}

export function Board({
  layout,
  item,
  eaten,
  moveEaten,
  numbers,
  locked,
  hintPlates,
  answer,
  onPic,
}: Props) {
  const label = vocab(item).label;
  return (
    <>
      {layout.plates.map((pl) => (
        <div
          key={pl.id}
          className={[
            'math-plate',
            pl.empty ? 'math-plate--empty' : '',
            pl.area ? 'math-plate--area' : '',
            hintPlates.includes(pl.id) ? 'is-hint' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: u(pl.x), top: u(pl.y), width: u(pl.w), height: u(pl.h) }}
          data-testid={`plate-${pl.id}`}
        />
      ))}

      {eaten && layout.eatBox ? (
        <div
          className="math-eatbox"
          style={{
            left: u(moveEaten ? layout.eatBox.x : layout.eatBox.x - EAT_SHIFT),
            top: u(layout.eatBox.y),
            width: u(layout.eatBox.w),
            height: u(layout.eatBox.h),
          }}
          data-testid="eat-box"
        />
      ) : null}

      {layout.syms.map((sy, k) => (
        <span
          key={k}
          className={`math-sym ${sy.small ? 'math-sym--small' : ''}`}
          style={{ left: u(sy.x), top: u(sy.y), width: u(sy.w), height: u(sy.h) }}
        >
          {sy.text}
        </span>
      ))}

      {layout.pics.map((pic) => {
        const isEaten = pic.eaten && eaten;
        const moved = isEaten && moveEaten && pic.ex !== undefined && pic.ey !== undefined;
        const n = numbers[pic.i] ?? 0;
        return (
          <button
            key={pic.i}
            type="button"
            className={['math-pic', isEaten ? 'math-pic--eaten' : ''].filter(Boolean).join(' ')}
            style={{
              left: u(moved ? pic.ex! : pic.x),
              top: u(moved ? pic.ey! : pic.y),
              width: u(layout.size),
              height: u(layout.size),
            }}
            aria-label={isEaten ? `${label} たべた` : `${label} ${n > 0 ? n : ''}`.trim()}
            disabled={locked || isEaten}
            onClick={() => onPic(pic.i)}
            data-testid={`pic-${pic.i}`}
            data-num={n > 0 ? n : undefined}
            data-eaten={isEaten ? '1' : undefined}
          >
            <Illust id={item} className="math-pic__img" decorative />
            {n > 0 ? (
              <span className="math-pic__num" data-testid={`pic-num-${pic.i}`}>
                {n}
              </span>
            ) : null}
          </button>
        );
      })}

      {layout.numY !== null
        ? layout.cells.map((c, k) => {
            const isAns = c.token.role === 'ans';
            const text = isAns && answer !== null ? String(answer) : c.token.text;
            return (
              <span
                key={k}
                className={[
                  'math-cell',
                  `math-cell--${c.token.role}`,
                  isAns && answer !== null ? 'math-cell--solved' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: u(c.x),
                  top: u(layout.numY!),
                  width: u(c.w),
                  height: u(layout.numH),
                  fontSize: u(layout.numFont),
                }}
                data-testid={`cell-${c.token.role}`}
              >
                {text}
              </span>
            );
          })
        : null}
    </>
  );
}
