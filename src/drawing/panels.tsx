/**
 * はんこ・図形の「えらぶ板」（DESINGN.md 19章、X-ST-02/04、X-SH-02）。
 * 絵柄を選んだだけではキャンバスに置かない（X-DR-06）。「これに する」で板を閉じ、キャンバスをタップで置く。
 */
import { Illust } from '../illust/Illust';
import { DrawIcon, ShapeIcon } from './icons';
import { SHAPE_KINDS, type ShapeKind } from './model';
import { STAMPS, STAMP_CATEGORIES, getStamp, svgUrl } from './stamps';
import { SHAPE_STROKES, STAMP_SIZES, type DrawColor } from './tools';

export interface StampChoice {
  id: string;
  sizeIdx: number;
  rotation: number;
  flipX: boolean;
}

export interface ShapeChoice {
  kind: ShapeKind;
  filled: boolean;
  strokeIdx: number;
  colorId: string;
}

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: 'まる',
  ellipse: 'だえん',
  triangle: 'さんかく',
  rect: 'しかく',
  star: 'ほし',
  heart: 'ハート',
  line: 'せん',
};

const SIZE_NAMES = ['ちいさく', 'ふつう', 'おおきく'];

/** 選んだはんこの見本（選んだ大きさ・向きで表示。hover に頼らない: X-ST-04） */
export function StampPreview({ choice, box }: { choice: StampChoice; box: number }) {
  const s = getStamp(choice.id);
  if (!s) return null;
  const px = (STAMP_SIZES[choice.sizeIdx]! / STAMP_SIZES[2]!) * box;
  return (
    <div
      className="draw-stamp-preview"
      style={{ width: box, height: box }}
      data-testid="stamp-preview"
    >
      <img
        src={svgUrl(s.svg)}
        alt={s.label}
        draggable={false}
        style={{
          width: px,
          height: px,
          transform: `rotate(${choice.rotation}deg) scaleX(${choice.flipX ? -1 : 1})`,
        }}
        data-size={choice.sizeIdx}
        data-rotation={choice.rotation}
        data-flip={choice.flipX ? '1' : '0'}
      />
    </div>
  );
}

/** 押す前の大きさ・まわす・はんてん（X-ST-05） */
export function StampAdjust({
  choice,
  onChange,
  compact,
  testPrefix = 'stamp',
}: {
  choice: StampChoice;
  onChange(c: StampChoice): void;
  compact?: boolean;
  testPrefix?: string;
}) {
  return (
    <div className={`draw-adjust ${compact ? 'draw-adjust--compact' : ''}`}>
      {STAMP_SIZES.map((_, i) => (
        <button
          key={i}
          type="button"
          className={`tap tap--white draw-size ${choice.sizeIdx === i ? 'is-selected' : ''}`}
          aria-label={SIZE_NAMES[i]}
          aria-pressed={choice.sizeIdx === i}
          data-testid={`${testPrefix}-size-${i}`}
          onClick={() => onChange({ ...choice, sizeIdx: i })}
        >
          <span
            className="draw-size__dot"
            style={{ width: `${30 + i * 25}%`, height: `${30 + i * 25}%` }}
          />
        </button>
      ))}
      <button
        type="button"
        className="tap tap--wood"
        aria-label="まわす"
        data-testid={`${testPrefix}-rotate`}
        onClick={() => onChange({ ...choice, rotation: (choice.rotation + 45) % 360 })}
      >
        <Illust id="rotate" className="tap__icon" decorative />
      </button>
      <button
        type="button"
        className="tap tap--wood"
        aria-label="はんてん"
        data-testid={`${testPrefix}-flip`}
        onClick={() => onChange({ ...choice, flipX: !choice.flipX })}
      >
        <DrawIcon id="flip" className="tap__icon" />
      </button>
    </div>
  );
}

export function StampPanel({
  choice,
  category,
  onCategory,
  onChange,
  onClose,
  boxPx,
}: {
  choice: StampChoice;
  category: string;
  onCategory(c: string): void;
  onChange(c: StampChoice): void;
  onClose(): void;
  boxPx: number;
}) {
  const list = STAMPS.filter((s) => s.category === category);
  return (
    <div
      className="draw-panel"
      role="dialog"
      aria-label="はんこを えらぶ"
      data-testid="stamp-panel"
    >
      <div className="draw-tabs" role="tablist">
        {STAMP_CATEGORIES.map((c) => {
          const icon = getStamp(c.icon);
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === category}
              className={`draw-tab ${c.id === category ? 'is-selected' : ''}`}
              data-testid={`stamp-tab-${c.id}`}
              onClick={() => onCategory(c.id)}
            >
              {icon ? (
                <img src={svgUrl(icon.svg)} alt="" draggable={false} className="draw-tab__icon" />
              ) : null}
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
      <div className="draw-panel__body">
        <div className="draw-stamp-grid" role="list">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              className={`draw-stamp-cell ${choice.id === s.id ? 'is-selected' : ''}`}
              aria-label={s.label}
              aria-pressed={choice.id === s.id}
              data-testid={`stamp-${s.id}`}
              onClick={() => onChange({ ...choice, id: s.id })}
            >
              <img src={svgUrl(s.svg)} alt="" draggable={false} />
            </button>
          ))}
        </div>
        <div className="draw-panel__side">
          <StampPreview choice={choice} box={boxPx} />
          <StampAdjust choice={choice} onChange={onChange} />
          <button
            type="button"
            className="tap tap--main draw-panel__ok"
            aria-label="これに する"
            data-testid="panel-ok"
            onClick={onClose}
          >
            これに する
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShapePanel({
  choice,
  colors,
  onChange,
  onClose,
}: {
  choice: ShapeChoice;
  colors: DrawColor[];
  onChange(c: ShapeChoice): void;
  onClose(): void;
}) {
  const color = colors.find((c) => c.id === choice.colorId) ?? colors[0]!;
  return (
    <div
      className="draw-panel"
      role="dialog"
      aria-label="ずけいを えらぶ"
      data-testid="shape-panel"
    >
      <div className="draw-panel__body">
        <div className="draw-shape-col">
          <div className="draw-shape-grid">
            {SHAPE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`tap tap--white draw-shape-btn ${choice.kind === k ? 'is-selected' : ''}`}
                aria-label={SHAPE_NAMES[k]}
                aria-pressed={choice.kind === k}
                data-testid={`shape-${k}`}
                onClick={() => onChange({ ...choice, kind: k })}
              >
                <ShapeIcon
                  shape={k}
                  filled={choice.filled}
                  color={color.hex}
                  className="tap__icon"
                />
              </button>
            ))}
          </div>
          <div className="draw-row">
            <button
              type="button"
              className={`tap tap--white ${!choice.filled ? 'is-selected' : ''}`}
              aria-label="ふち だけ"
              aria-pressed={!choice.filled}
              data-testid="shape-outline"
              onClick={() => onChange({ ...choice, filled: false })}
            >
              <DrawIcon id="outline" className="tap__icon" />
            </button>
            <button
              type="button"
              className={`tap tap--white ${choice.filled ? 'is-selected' : ''}`}
              aria-label="なかも ぬる"
              aria-pressed={choice.filled}
              data-testid="shape-filled"
              onClick={() => onChange({ ...choice, filled: true })}
            >
              <DrawIcon id="filled" className="tap__icon" />
            </button>
            {SHAPE_STROKES.map((w, i) => (
              <button
                key={w}
                type="button"
                className={`tap tap--white draw-width ${choice.strokeIdx === i ? 'is-selected' : ''}`}
                aria-label={['ほそい ふち', 'ふつうの ふち', 'ふとい ふち'][i]}
                aria-pressed={choice.strokeIdx === i}
                data-testid={`shape-stroke-${i}`}
                onClick={() => onChange({ ...choice, strokeIdx: i })}
              >
                <span
                  className="draw-width__bar"
                  style={{ height: `calc(var(--u) * ${0.4 + i * 0.7})` }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="draw-panel__side">
          <div className="draw-colors draw-colors--panel">
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`draw-color ${c.id === choice.colorId ? 'is-selected' : ''}`}
                style={{ background: c.hex }}
                aria-label={c.name}
                aria-pressed={c.id === choice.colorId}
                data-testid={`shape-color-${c.id}`}
                onClick={() => onChange({ ...choice, colorId: c.id })}
              />
            ))}
          </div>
          <button
            type="button"
            className="tap tap--main draw-panel__ok"
            aria-label="これに する"
            data-testid="panel-ok"
            onClick={onClose}
          >
            これに する
          </button>
        </div>
      </div>
    </div>
  );
}
