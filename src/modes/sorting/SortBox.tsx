import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { isColor, labelOf, repOf, type BoxValue, type SortPic } from './logic';

interface Props {
  value: BoxValue;
  /** 盤面の全部の絵（代表の絵が盤面の絵と重ならないようにする） */
  allPics: readonly SortPic[];
  /** 箱に入っている絵 */
  contents: readonly SortPic[];
  hint?: boolean;
  /** false なら見せるだけ（完了画面） */
  interactive?: boolean;
  size?: 'normal' | 'small';
  onBox?: () => void;
  onPic?: (pic: SortPic) => void;
  picHint?: SortPic | null;
}

/** 分けた先の箱。色の箱は色見本＋色名＋代表の絵、種類の箱は代表の絵＋名前（色だけで区別させない） */
export function SortBox({
  value,
  allPics,
  contents,
  hint,
  interactive = true,
  size = 'normal',
  onBox,
  onPic,
  picHint,
}: Props) {
  const color = isColor(value);
  return (
    <div
      className={`sort-box sort-box--${size} ${color ? `sort-box--${value}` : ''} ${hint ? 'is-hint' : ''}`}
      data-testid={interactive ? `box-${value}` : undefined}
    >
      {interactive ? (
        <button
          type="button"
          className="sort-box__hit"
          aria-label={`${labelOf(value)}の はこ`}
          onClick={onBox}
          data-testid={`box-hit-${value}`}
        />
      ) : null}
      <div className="sort-box__head">
        {color ? (
          <span className={`sort-box__swatch sort-box__swatch--${value}`} aria-hidden />
        ) : null}
        <span className="sort-box__name">{labelOf(value)}</span>
        <Illust id={repOf(value, allPics)} className="sort-box__rep" decorative />
      </div>
      <div className="sort-box__body">
        {contents.map((pic) =>
          interactive ? (
            <button
              key={pic}
              type="button"
              className={`sort-pic sort-pic--in ${picHint === pic ? 'is-hint' : ''}`}
              aria-label={`${vocab(pic).label}を もどす`}
              onClick={() => onPic?.(pic)}
              data-testid={`placed-${pic}`}
            >
              <Illust id={pic} className="sort-pic__img" decorative />
            </button>
          ) : (
            <span key={pic} className="sort-pic sort-pic--in sort-pic--static">
              <Illust id={pic} className="sort-pic__img" decorative />
            </span>
          ),
        )}
      </div>
    </div>
  );
}
