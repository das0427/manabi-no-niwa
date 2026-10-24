import type { CSSProperties } from 'react';

/** ヒントや声かけの吹き出し。音声と同じ文を出す（読めなくても声で分かる） */
export function Bubble({ text, style }: { text: string | null; style?: CSSProperties }) {
  if (!text) return null;
  return (
    <div className="bubble" role="status" aria-live="polite" style={style}>
      {text}
    </div>
  );
}
