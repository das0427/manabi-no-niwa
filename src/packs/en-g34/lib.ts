/**
 * en-g34（外国語活動 3・4年）の共通の部品。パックは他のパックを import しないので、en-g56 にも同じ形の部品がある。
 *
 * 英語の音声: listen の音声は key 必須（engines.md）。key は `en/<packId>.<種類>.<語のスラッグ>`。
 *   mp3 は scripts/voice/generate_en.py（Kokoro, af_heart）が public/audio/en/<packId>.<種類>.<スラッグ>.mp3 に書く
 *   （generate_en.py の key は `/` を使えないので、`en/` を除いた部分が台本の key）。
 *   台本（key → 英文）は voice.ts の englishScript() が問題データから作り、script-en.json に書き出してある。
 *
 * 問題文・ヒント・解説は日本語だけで書く（問題文は日本語の音声で読み上げるため、英語を入れない）。
 * 英語は 音声・選択肢・図（kind 'text'）に置く。
 */
import type { ChoiceOption, ListenItem, RichText } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';

export const PACK = 'en-g34';

export interface EnSound {
  text: string;
  key: string;
}

/** 英文 → キーに使える形（a-z 0-9 -） */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 英語の音声（cat は種類: abc・word・phrase など） */
export function en(cat: string, text: string): EnSound {
  return { text, key: `en/${PACK}.${cat}.${slugOf(text)}` };
}

export interface ListenSpec {
  id: string;
  objective: string;
  level: number;
  prompt: RichText;
  audio: EnSound | EnSound[];
  gapMs?: number;
  options: ChoiceOption[];
  hints: [RichText, RichText, RichText];
  explain: RichText;
  explainFigure?: Figure;
  identity: string;
  alt?: boolean;
  fixedOrder?: boolean;
  layout?: 'row' | 'grid' | 'column';
}

export function listen(s: ListenSpec): ListenItem {
  return {
    engine: 'listen',
    id: s.id,
    objective: s.objective,
    level: s.level,
    prompt: s.prompt,
    audio: s.audio,
    ...(s.gapMs !== undefined ? { gapMs: s.gapMs } : {}),
    options: s.options,
    hints: s.hints,
    explain: s.explain,
    ...(s.explainFigure ? { explainFigure: s.explainFigure } : {}),
    identity: s.identity,
    ...(s.alt ? { alt: true } : {}),
    ...(s.fixedOrder ? { fixedOrder: true } : {}),
    ...(s.layout ? { layout: s.layout } : {}),
  };
}

/** 英文を大きく見せる図（解説で、聞いた英語を文字で確かめる） */
export const enText = (text: string, size: 'm' | 'l' | 'xl' = 'l'): Figure => ({
  kind: 'text',
  text,
  size,
});

/** list の i 番から順に、条件に合うものを n 個（決まった並びで選ぶ。手作りの問題を表から作るため） */
export function pickOthers<T>(list: T[], i: number, n: number, ok: (x: T) => boolean): T[] {
  const out: T[] = [];
  for (let k = 1; k < list.length && out.length < n; k++) {
    const x = list[(i + k * 3) % list.length]!;
    if (ok(x) && !out.includes(x)) out.push(x);
  }
  for (let k = 1; k < list.length && out.length < n; k++) {
    const x = list[(i + k) % list.length]!;
    if (ok(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

/** 「1ばんめ」「2ばんめ」… の選択肢（順に聞いた音から選ぶ） */
export function ordinalOptions(
  n: number,
  correct: number,
  mis: (i: number) => string,
): ChoiceOption[] {
  return Array.from({ length: n }, (_, i) =>
    i === correct
      ? { label: `${i + 1}ばんめ`, correct: true }
      : { label: `${i + 1}ばんめ`, misconception: mis(i) },
  );
}
