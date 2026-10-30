/**
 * en-pre（幼児向けの英語）の共通の部品。パックは他のパックを import しないので、en-g34 と同じ形の部品をここに書く。
 * 設計: docs/expansion/p2-design/preschool-english.md
 *
 * 英語の音声: listen の音声は key 必須。key は `en/en-pre.<種類>.<語のスラッグ>`。
 *   mp3 は scripts/voice/generate_en.py（Kokoro, af_heart）が public/audio/en/en-pre.<種類>.<スラッグ>.mp3 に書く
 *   （generate_en.py の key は `/` を使えないので、`en/` を除いた部分が台本の key）。
 *   台本（key → 英文）は voice.ts の englishScript() が問題データから作り、script-en.json に書き出してある。
 *
 * 画面の文字は日本語（ひらがな）だけ。英語は音声だけ（DESINGN 4章）。問題文・ヒント・解説・選択肢の label に英字を入れない。
 * 台本の書き方（7.2）: 単語は先頭を大文字にして句点（Dog.）、数は単語、同じ語を2回聞かせるのは同じ mp3 を2回鳴らす。
 */
import { createRng, hashSeed } from '../../core/util/rng';
import type { ChoiceOption, ListenItem, RichText, StageId, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { ListenSound } from '../../engines/listen/listen';

export const PACK = 'en-pre';

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

/** 英語の音声（cat は種類: word・it・where・cmd・lets・touch・color・itis・num・np・hello・feel・book・shop・reply） */
export function en(cat: string, text: string): EnSound {
  return { text, key: `en/${PACK}.${cat}.${slugOf(text)}` };
}

/** 決まった key の英語の音声（絵本のページなど、スラッグを自分で決めるもの） */
export function enKey(cat: string, slug: string, text: string): EnSound {
  return { text, key: `en/${PACK}.${cat}.${slug}` };
}

export const ill = (id: string, count?: number): Figure =>
  count === undefined ? { kind: 'illust', id } : { kind: 'illust', id, count };

/** id から決まる順に混ぜる（選択肢は画面で並べ替えないため、正解の位置の癖を作らない） */
export function mix<T>(key: string, xs: readonly T[]): T[] {
  return createRng(hashSeed(PACK, key)).shuffle(xs);
}

/** 決まった順に、自分以外から n 個 */
export function pickN<T>(key: string, xs: readonly T[], n: number): T[] {
  return mix(key, xs).slice(0, n);
}

// ---- 問題の組み立て ----

/** 幼児の英語のヒント（2段。どちらも答えを言わない。押すと日本語で読んだ後に英語をもう一度鳴らす） */
export const HINTS: [RichText, RichText] = [
  'もういちど よく きいてね。',
  'おうちの ひとと いっしょに、まねして いって みよう。',
];
/** からだを動かす遊びのヒント */
export const HINTS_MOVE: [RichText, RichText] = [
  'もういちど よく きいてね。',
  'おうちの ひとと いっしょに、うごきながら きいて みよう。',
];

/** 同じ語を2回（間 700ms） */
export const twice = (s: EnSound): EnSound[] => [s, s];

/** 選択肢の図・名前・名前を返す音声 */
export function opt(
  o: {
    label: RichText;
    figure: Figure;
    sound: EnSound | ListenSound;
  },
  extra: { correct?: true; misconception?: string },
): ChoiceOption {
  return { label: o.label, figure: o.figure, sound: o.sound, ...extra };
}

export interface ListenSpec {
  id: string;
  objective: string;
  level: number;
  prompt: RichText;
  audio: ListenSound[];
  gapMs?: number;
  figure?: Figure;
  /** 正解を1つ含む選択肢（混ぜる前） */
  options: ChoiceOption[];
  hints?: [RichText, RichText];
  explain: RichText;
  explainFigure?: Figure;
  identity: string;
  alt?: boolean;
  revealAudio?: ListenSound[];
}

/**
 * 幼児の英語の listen の問題。すべて nameBack（触った物の名前を返す）・replay（不正解とヒントの後に聞き直す）・
 * hideTranscript（答えの表示で英字を出さない）。選択肢は id から決まる順に混ぜる。
 */
export function listen(s: ListenSpec): ListenItem {
  return {
    engine: 'listen',
    id: s.id,
    objective: s.objective,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    audio: s.audio,
    gapMs: s.gapMs ?? 700,
    options: mix(s.id, s.options),
    hints: s.hints ?? HINTS,
    explain: s.explain,
    ...(s.explainFigure ? { explainFigure: s.explainFigure } : {}),
    identity: s.identity,
    ...(s.alt ? { alt: true } : {}),
    hideTranscript: true,
    nameBack: true,
    replay: { afterWrong: true, onHint: true },
    ...(s.revealAudio ? { revealAudio: s.revealAudio } : {}),
  };
}

// ---- 単元の共通の項目 ----

/** 根拠（全単元共通。設計書 5章） */
export const BASIS =
  '幼稚園教育要領 言葉（言葉の響きやリズム）・環境（異なる文化に触れる）、保育所保育指針（文化の違いを認める）。小学校 外国語活動（3・4年）『聞くこと』へ接続（慣れ親しむ）。本アプリの案';

/** 単元の共通の項目（教科 en・種別 遊・復習なし・穏やかな判定）。最初は partial（音声の全件試聴の後に ready: 設計書 7.4） */
export function preUnit(
  u: Omit<
    UnitSpec,
    | 'subject'
    | 'domain'
    | 'kind'
    | 'priority'
    | 'status'
    | 'prereq'
    | 'review'
    | 'basis'
    | 'gradeIsAppProposal'
    | 'revised'
    | 'gentleJudgement'
    | 'stage'
  > & {
    stage: Extract<StageId, 'p23' | 'p4' | 'p5'>;
    prereq?: string[];
    status?: UnitSpec['status'];
  },
): UnitSpec {
  const { prereq, status, ...rest } = u;
  return {
    subject: 'en',
    domain: 'en',
    kind: 'play',
    priority: 'P1',
    status: status ?? 'partial',
    prereq: prereq ?? [],
    review: 'none',
    basis: BASIS,
    gradeIsAppProposal: true,
    revised: '2026-10-30',
    gentleJudgement: true,
    ...rest,
  };
}

/** おてほん（導入）の2場面（設計書 2.2）。1つめの図はその単元の代表の絵 */
export const intro = (
  fig: Figure,
  text = 'えいごの ことばを きいて、えを えらぶ あそびだよ。',
): UnitSpec['intro'] => [
  { text, figure: fig },
  { text: 'おうちの ひとと いっしょに、まねして いって みよう。', figure: ill('enpre-icon') },
];
