/**
 * 漢字の読み問題の生成器（g1.ja.kanji-read-g1・g2.ja.kanji-read-g2 で共用）。
 *
 * 字のデータ表（table.ts）から、1つの「字＋読み＋語例（または文）」を定義域から均等に選び、形式を段階で決めて作る。
 *   wc … 語の中で読む（選ぶ）            objective 'word'
 *   wb … 語の中で読む（かなタイルで作る）    objective 'word'     alt
 *   sc … 文の中で読む（選ぶ）            objective 'sentence'
 *   sf … 文の中で読む（文の空欄に入れる）   objective 'sentence' alt
 *   pc … 同じ字の別の読み（ことばを選ぶ）   objective 'compare'
 *   pf … 同じ字の別の読み（2つの空欄）     objective 'compare'  alt
 * 同一性キーは「字|読み|語例（または文）」（curriculum-matrix 1.4）。形式が違っても同じ語例は同じキー。
 *
 * 音声の漏れを避けるため、問う語・文は問題文（prompt）に入れず図（figure）に出す
 * （prompt は自動で読み上げられ、《!よみ》の読みも読んでしまうため）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, GenerateContext, Item } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import type { FillItem } from '../../engines/fill/fill';
import { poolOf, readingOptions, readingWrongs, type ReadMis } from './shared';
import { identityOf, moras, type KanjiEntry, type Occurrence } from './table';

type Form = 'wc' | 'wb' | 'sc' | 'sf' | 'pc' | 'pf';

/** 段階ごとの形式の割合 */
const WEIGHTS: [Form, number][][] = [
  [
    ['wc', 72],
    ['wb', 28],
  ],
  [
    ['sc', 38],
    ['sf', 20],
    ['wc', 22],
    ['wb', 20],
  ],
  [
    ['pc', 32],
    ['pf', 18],
    ['sc', 20],
    ['sf', 14],
    ['wc', 8],
    ['wb', 8],
  ],
];

/** 段階ごとの選択肢の数（誤答の数 + 1）。ux-by-age: 小1・小2は3〜4 */
const OPTION_COUNT = [3, 4, 4];

interface WordSlot {
  entry: KanjiEntry;
  occ: Occurrence;
}
interface PairSlot extends WordSlot {
  /** この語と読みが違う、同じ字の語 */
  foils: Occurrence[];
}

export interface ReadModel {
  words: WordSlot[];
  sents: WordSlot[];
  pairs: PairSlot[];
  /** 異なる問題（同一性キー）の総数 */
  domainSize: number;
  generate(ctx: GenerateContext): Item;
}

const pickWeighted = (rng: Rng, table: [Form, number][]): Form => {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [f, w] of table) {
    r -= w;
    if (r < 0) return f;
  }
  return table[0]![0];
};

const FIGURE_SIZE = { word: 'xl', sentence: 'l' } as const;

/** かなタイルに足すものが他に無いときの、予備のタイル */
const SPARE_TILES = ['し', 'の', 'ま', 'と', 'か', 'り'];

const kana1 = (part: string) => moras(part)[0] ?? part;

/** ヒント③（途中まで）: 語ならぜんたいの読みの ○ 版、文なら最初の1字 */
function lastHint(occ: Occurrence, isWord: boolean): string {
  if (isWord) return `ことばぜんたいは 「${occ.masked}」と よむよ。`;
  return moras(occ.part).length >= 2
    ? `さいしょの もじは 「${kana1(occ.part)}」だよ。`
    : 'ひらがなで 1もじだよ。';
}

function explainOf(entry: KanjiEntry, occ: Occurrence, isWord: boolean): string {
  const target = `${entry.ch}《${occ.part}》`;
  const okuri = occ.okuri ? `「${occ.okuri}」は おくりがなだから、よみには いれないよ。` : '';
  return isWord
    ? `「${occ.shown}」は 「${occ.whole}」と よむよ。${target}は ここでは 「${occ.part}」。${okuri}`
    : `${occ.shown}\nこの ぶんでは ${target}を 「${occ.part}」と よむよ。${okuri}`;
}

export function makeReadModel(grade: 1 | 2, entries: KanjiEntry[]): ReadModel {
  const pool = poolOf(grade);
  const words: WordSlot[] = entries.flatMap((entry) => entry.words.map((occ) => ({ entry, occ })));
  const sents: WordSlot[] = entries.map((entry) => ({ entry, occ: entry.sentence }));
  const pairs: PairSlot[] = words.flatMap((w) => {
    const foils = w.entry.words.filter((x) => x.part !== w.occ.part);
    return foils.length > 0 ? [{ ...w, foils }] : [];
  });

  const base = (
    entry: KanjiEntry,
    occ: Occurrence,
    level: number,
    objective: string,
    isWord: boolean,
    alt: boolean,
  ) => ({
    objective,
    level,
    figure: {
      kind: 'text' as const,
      text: occ.bold,
      size: isWord ? FIGURE_SIZE.word : FIGURE_SIZE.sentence,
    },
    explain: explainOf(entry, occ, isWord),
    explainFigure: { kind: 'text' as const, text: occ.shown, size: 'l' as const },
    identity: identityOf(entry, occ),
    ...(alt ? { alt: true as const } : {}),
  });

  const hintsWord = (entry: KanjiEntry, occ: Occurrence): string[] => {
    const single = occ.plain === entry.ch;
    return single
      ? [
          'ふとい じを よく みよう。',
          'この じを つかう ことばを おもいだして みよう。',
          lastHint(occ, true),
        ]
      : [
          'ふとい じを みよう。まわりの よみがなも ヒントだよ。',
          'ことばぜんたいを こえに だして よんで みよう。',
          lastHint(occ, true),
        ];
  };
  const hintsSent = (occ: Occurrence): string[] => [
    'ぶんを さいごまで よんで みよう。',
    'ふとい じを つかった ことばを おもいだして みよう。',
    lastHint(occ, false),
  ];

  const nWrong = (level: number) => OPTION_COUNT[Math.min(level, OPTION_COUNT.length - 1)]! - 1;

  function choiceOf(
    slot: WordSlot,
    level: number,
    rng: Rng,
    isWord: boolean,
    objective: string,
  ): ChoiceItem {
    const { entry, occ } = slot;
    const wrongs = readingWrongs(entry, occ, rng, pool, nWrong(level));
    return {
      engine: 'choice',
      id: `${isWord ? 'wc' : 'sc'}:${identityOf(entry, occ)}`,
      prompt: 'ふとい じだけの よみは どれ？',
      hints: isWord ? hintsWord(entry, occ) : hintsSent(occ),
      options: readingOptions(rng, occ.part, wrongs),
      layout: 'row',
      ...base(entry, occ, level, objective, isWord, false),
    };
  }

  function buildOf(slot: WordSlot, level: number, rng: Rng): BuildItem {
    const { entry, occ } = slot;
    const wrongs = readingWrongs(entry, occ, rng, pool, 1);
    // タイル: 正解の拍 + まぎらわしい読みの拍（同じ拍が重なっても1枚ずつ）。12枚まで
    const answerTiles = moras(occ.part);
    const decoy = wrongs[0] ? moras(wrongs[0].value) : [];
    const extra: string[] = [];
    // 正解に無い拍だけを足す（正解にある拍を足すと、同じ字のタイルが2枚になって紛らわしい）
    const addExtra = (m: string | undefined) => {
      if (m && !answerTiles.includes(m) && !extra.includes(m)) extra.push(m);
    };
    for (const m of decoy) addExtra(m);
    // 送り仮名の最初の拍も足す（「おおき」のように送り仮名まで読んでしまう誤りを、実際に作れるように）
    if (occ.okuri) addExtra(moras(occ.okuri)[0]);
    if (extra.length === 0) {
      const spare = SPARE_TILES.find((m) => !answerTiles.includes(m));
      if (spare) extra.push(spare);
    }
    const tiles = [...answerTiles, ...extra].slice(0, 12);
    const wrongAnswers = [
      ...wrongs,
      ...(occ.okuri
        ? [{ value: occ.part + occ.okuri[0]!, misconception: 'okurigana-edge' as ReadMis }]
        : []),
    ].filter((w, i, a) => a.findIndex((x) => x.value === w.value) === i);
    return {
      engine: 'build',
      id: `wb:${identityOf(entry, occ)}`,
      prompt: 'ふとい じだけの よみを ひらがなで つくろう。',
      hints: [
        'ふとい じの よみを おもいだそう。',
        'かなの タイルを ならべて よみを つくるよ。いらない タイルも あるよ。',
        lastHint(occ, false),
      ],
      tiles,
      answer: { kind: 'text', values: [occ.part] },
      wrongAnswers,
      ...base(entry, occ, level, 'word', true, true),
    };
  }

  function fillOf(slot: WordSlot, level: number, rng: Rng): FillItem {
    const { entry, occ } = slot;
    const wrongs = readingWrongs(entry, occ, rng, pool, nWrong(level));
    const options = readingOptions(rng, occ.part, wrongs).map((o) => o.label);
    return {
      engine: 'fill',
      id: `sf:${identityOf(entry, occ)}`,
      prompt: 'ふとい じだけの よみを いれよう。',
      text: 'ふとい じだけは 「{{}}」と よむ。',
      options,
      blanks: [
        {
          answers: [occ.part],
          wrong: wrongs.map((w) => ({ value: w.value, misconception: w.misconception })),
        },
      ],
      hints: hintsSent(occ),
      ...base(entry, occ, level, 'sentence', false, true),
    };
  }

  function pairChoiceOf(slot: PairSlot, level: number, rng: Rng): ChoiceItem {
    const { entry, occ } = slot;
    // 正解のことば + 読みが違う同じ字のことば（読みごとに1つ）。最大4つ
    const byPart = new Map<string, Occurrence>();
    for (const f of rng.shuffle(slot.foils)) if (!byPart.has(f.part)) byPart.set(f.part, f);
    const foils = [...byPart.values()].slice(0, nWrong(level));
    const options = rng.shuffle([
      { label: occ.bold, correct: true as const },
      ...foils.map((f) => ({ label: f.bold, misconception: 'on-kun' as const })),
    ]);
    return {
      engine: 'choice',
      id: `pc:${identityOf(entry, occ)}`,
      prompt: `ふとい じが 「${occ.part}」と よめる ことばは どれ？`,
      hints: [
        'ことばを よく みよう。おなじ じでも、ことばで よみが ちがうよ。',
        'ひとつずつ こえに だして よんで みよう。',
        `ふとい じを 「${occ.part}」と よんで、ことばに なるか たしかめよう。`,
      ],
      options,
      layout: 'row',
      ...base(entry, occ, level, 'compare', true, false),
      // 図は使わない（選択肢に語を出す）
      figure: undefined,
      explainFigure: { kind: 'text', text: occ.shown, size: 'l' },
    };
  }

  function pairFillOf(slot: PairSlot, level: number, rng: Rng): FillItem {
    const { entry, occ } = slot;
    const foil = rng.pick(slot.foils);
    const [first, second] = rng.next() < 0.5 ? [occ, foil] : [foil, occ];
    const decoy = readingWrongs(entry, occ, rng, pool, 3).filter(
      (w) => w.value !== first.part && w.value !== second.part,
    );
    const options = rng.shuffle([
      first.part,
      second.part,
      ...decoy.slice(0, nWrong(level) - 1).map((w) => w.value),
    ]);
    const wrongFor = (own: Occurrence, other: Occurrence) =>
      [
        { value: other.part, misconception: 'on-kun' as const },
        ...decoy.map((w) => ({ value: w.value, misconception: w.misconception })),
      ].filter(
        (w, i, a) =>
          w.value !== own.part &&
          a.findIndex((x) => x.value === w.value) === i &&
          options.includes(w.value),
      );
    return {
      engine: 'fill',
      id: `pf:${identityOf(entry, occ)}`,
      prompt: 'おなじ じでも、ことばで よみが ちがうよ。',
      text: 'うえの ことばは 「{{}}」、したの ことばは 「{{}}」と よむ。',
      options,
      blanks: [
        { answers: [first.part], wrong: wrongFor(first, second) },
        { answers: [second.part], wrong: wrongFor(second, first) },
      ],
      hints: [
        'ふとい じを よく みよう。ことばは ふたつ あるよ。',
        'ひとつずつ こえに だして よんで みよう。',
        `ひとつは 「${first.masked}」、もうひとつは 「${second.masked}」と よむよ。`,
      ],
      figure: {
        kind: 'column',
        items: [
          { kind: 'text', text: first.bold, size: 'xl' },
          { kind: 'text', text: second.bold, size: 'xl' },
        ],
        gap: 8,
      },
      objective: 'compare',
      level,
      explain: `「${first.shown}」は 「${first.whole}」、「${second.shown}」は 「${second.whole}」。おなじ じでも、ことばで よみが かわるんだね。`,
      explainFigure: {
        kind: 'column',
        items: [
          { kind: 'text', text: first.shown, size: 'l' },
          { kind: 'text', text: second.shown, size: 'l' },
        ],
      },
      identity: identityOf(entry, occ),
      alt: true,
    };
  }

  function generate({ level, rng }: GenerateContext): Item {
    const lv = Math.min(level, WEIGHTS.length - 1);
    const form = pickWeighted(rng, WEIGHTS[lv]!);
    switch (form) {
      case 'wc':
        return choiceOf(rng.pick(words), lv, rng, true, 'word');
      case 'wb':
        return buildOf(rng.pick(words), lv, rng);
      case 'sc':
        return choiceOf(rng.pick(sents), lv, rng, false, 'sentence');
      case 'sf':
        return fillOf(rng.pick(sents), lv, rng);
      case 'pc':
        return pairChoiceOf(rng.pick(pairs), lv, rng);
      case 'pf':
        return pairFillOf(rng.pick(pairs), lv, rng);
    }
  }

  return {
    words,
    sents,
    pairs,
    domainSize: words.length + sents.length,
    generate,
  };
}
