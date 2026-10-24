/** もんだい・じゆう で共通の部品（道具の札、うさぎの見せ方） */
import { Illust } from '../../illust/Illust';
import { Tap } from '../../ui/Tap';
import { findCell, type Board, type Pos, type Tool } from './board';
import { ToolGlyph } from './draw';
import type { RabbitView } from './RoadBoard';
import type { WalkState } from './useWalker';

interface ToolDef {
  id: Tool;
  label: string;
}

export const PUZZLE_TOOLS: ToolDef[] = [
  { id: 'straight', label: 'まっすぐ' },
  { id: 'corner', label: 'まがりかど' },
  { id: 'erase', label: 'けす' },
];

export const FREE_TOOLS: ToolDef[] = [
  { id: 'straight', label: 'まっすぐ' },
  { id: 'corner', label: 'まがりかど' },
  { id: 'tee', label: 'わかれみち' },
  { id: 'erase', label: 'けす' },
];

export function Toolbar({
  tools,
  tool,
  disabled,
  onPick,
}: {
  tools: ToolDef[];
  tool: Tool;
  disabled?: boolean;
  onPick: (t: Tool) => void;
}) {
  return (
    <div className="road-tools" role="group" aria-label="みちの どうぐ">
      {tools.map((t) => (
        <Tap
          key={t.id}
          label={t.label}
          className="road-tool"
          variant="wood"
          state={tool === t.id ? 'selected' : null}
          disabled={disabled}
          onPress={() => onPick(t.id)}
          testId={`tool-${t.id}`}
          text={
            <>
              {t.id === 'erase' ? (
                <Illust id="eraser" className="road-tool__icon" decorative />
              ) : (
                <ToolGlyph kind={t.id} className="road-tool__icon" />
              )}
              <span className="road-tool__label">{t.label}</span>
            </>
          }
        />
      ))}
    </div>
  );
}

/** 歩いている途中・歩き終わりのうさぎの位置と向き（歩いていなければスタートのマス） */
export function rabbitView(board: Board, walk: WalkState | null): RabbitView {
  const start: Pos = findCell(board, 'start') ?? { r: 0, c: 0 };
  if (!walk) return { pos: start, flip: false };
  const pos = walk.path[walk.step] ?? start;
  let flip = false;
  for (let i = walk.step; i >= 1; i--) {
    const a = walk.path[i]!;
    const b = walk.path[i - 1]!;
    if (a.c !== b.c) {
      flip = a.c < b.c;
      break;
    }
  }
  return { pos, flip };
}

/** ヒントの吹き出し（盤面の右。短い文を区切りのよい所で折り返す） */
export const BUBBLE_STYLE = {
  left: 'calc(var(--u) * 73.5)',
  top: 'calc(var(--u) * 3)',
  maxWidth: 'calc(var(--u) * 25)',
  fontSize: 'var(--text-small)',
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
} as const;

/** 盤面の大きさに合わせた1マスの大きさ（u）。4×3 は大きめ、5×4 は9u前後 */
export const cellUFor = (board: Board): number => (board.cols <= 4 ? 10.5 : 8.8);
