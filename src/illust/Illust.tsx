import { getIllust } from './registry';

interface Props {
  id: string;
  /** 読み上げ用の名前を上書き（装飾として扱うなら decorative） */
  label?: string;
  decorative?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** オリジナル SVG イラストを描く。未登録・draft の ID は開発時に目立つ枠を出す */
export function Illust({ id, label, decorative, className, style }: Props) {
  const def = getIllust(id);
  const usable = def && (def.status === 'final' || import.meta.env.DEV);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (label ?? def?.label ?? id)}
      focusable="false"
      data-illust={id}
    >
      {usable ? (
        def.draw()
      ) : (
        <rect x="4" y="4" width="92" height="92" fill="none" stroke="#c00" strokeDasharray="6 4" />
      )}
    </svg>
  );
}
