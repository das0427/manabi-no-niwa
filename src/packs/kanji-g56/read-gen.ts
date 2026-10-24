/**
 * 漢字の読み問題の生成器（g5.ja.kanji-read-g5・g6.ja.kanji-read-g6 で共用）。kanji-g34 の read-gen.ts を元に、
 * 都道府県名の形を外し、熟語の読み（音読みが中心）を扱う。
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
 * 問題文・ヒント・解説の漢字は3年までの配当字だけ（3・4年どちらの単元でも使えるように）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, GenerateContext, Item } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import type { FillItem } from '../../engines/fill/fill';
import { poolOf, readingOptions, readingWrongs, type ReadMis } from './shared';
import { identityOf, moras, type KanjiEntry, type Occurrence } from './table';

type Form = 'wc' | 'wb' | 'sc' | 'sf' | 'pc' | 'pf';

export interface ReadConfig {
  /** 単元の学年（選択肢に使う字の上限） */
  grade: 5 | 6;
  entries: KanjiEntry[];
  /** 段階ごとの形式の割合 */
  weights: [Form, number][][];
}

/** 選択肢の数。ux-by-age: 小3・小4は4（入力あり） */
const OPTION_COUNT = 4;

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
  if (isWord) return `ことば全《ぜん》体《たい》は「${occ.masked}」と読《よ》むよ。`;
  return moras(occ.part).length >= 2
    ? `はじめの文《も》字《じ》は「${kana1(occ.part)}」だよ。`
    : 'ひらがなで1文《も》字《じ》だよ。';
}

function explainOf(entry: KanjiEntry, occ: Occurrence, isWord: boolean): string {
  const target = `${entry.ch}《${occ.part}》`;
  const okuri = occ.okuri
    ? `「${occ.okuri}」は送《おく》りがなだから、読《よ》みには入《い》れないよ。`
    : '';
  return isWord
    ? `「${occ.shown}」は「${occ.whole}」と読《よ》むよ。${target}はここでは「${occ.part}」。${okuri}`
    : `${occ.shown}\nこの文《ぶん》では${target}を「${occ.part}」と読《よ》むよ。${okuri}`;
}

export function makeReadModel(cfg: ReadConfig): ReadModel {
  const pool = poolOf(cfg.grade);
  const words: WordSlot[] = cfg.entries.flatMap((entry) =>
    entry.words.map((occ) => ({ entry, occ })),
  );
  const sents: WordSlot[] = cfg.entries.map((entry) => ({ entry, occ: entry.sentence }));
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
          '太《ふと》い字《じ》をよく見《み》よう。',
          'この字《じ》を使《つか》うことばを思《おも》い出《だ》してみよう。',
          lastHint(occ, true),
        ]
      : [
          '太《ふと》い字《じ》を見《み》よう。まわりのふりがなもヒントだよ。',
          'ことば全《ぜん》体《たい》を声《こえ》に出《だ》して読《よ》んでみよう。',
          lastHint(occ, true),
        ];
  };
  const hintsSent = (occ: Occurrence): string[] => [
    '文《ぶん》をおわりまで読《よ》んでみよう。',
    '太《ふと》い字《じ》を使《つか》ったことばを思《おも》い出《だ》してみよう。',
    lastHint(occ, false),
  ];

  const nWrong = OPTION_COUNT - 1;

  function choiceOf(
    slot: WordSlot,
    level: number,
    rng: Rng,
    isWord: boolean,
    objective: string,
  ): ChoiceItem {
    const { entry, occ } = slot;
    const wrongs = readingWrongs(entry, occ, rng, pool, nWrong);
    return {
      engine: 'choice',
      id: `${isWord ? 'wc' : 'sc'}:${identityOf(entry, occ)}`,
      prompt: '太《ふと》い字《じ》の読《よ》みはどれ？',
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
      prompt: '太《ふと》い字《じ》の読《よ》みを、ひらがなで作《つく》ろう。',
      hints: [
        '太《ふと》い字《じ》の読《よ》みを思《おも》い出《だ》そう。',
        'かなのタイルをならべて読《よ》みを作《つく》るよ。いらないタイルもあるよ。',
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
    const wrongs = readingWrongs(entry, occ, rng, pool, nWrong);
    const options = readingOptions(rng, occ.part, wrongs).map((o) => o.label);
    return {
      engine: 'fill',
      id: `sf:${identityOf(entry, occ)}`,
      prompt: '太《ふと》い字《じ》の読《よ》みを入《い》れよう。',
      text: '太《ふと》い字《じ》は「{{}}」と読《よ》む。',
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
    // 正解のことば + 読みが違う同じ字のことば（読みごとに1つ）。最大3つ
    const byPart = new Map<string, Occurrence>();
    for (const f of rng.shuffle(slot.foils)) if (!byPart.has(f.part)) byPart.set(f.part, f);
    const foils = [...byPart.values()].slice(0, nWrong);
    const options = rng.shuffle([
      { label: occ.bold, correct: true as const },
      ...foils.map((f) => ({ label: f.bold, misconception: 'on-kun' as const })),
    ]);
    return {
      engine: 'choice',
      id: `pc:${identityOf(entry, occ)}`,
      prompt: `太《ふと》い字《じ》が「${occ.part}」と読《よ》めることばはどれ？`,
      hints: [
        'ことばをよく見《み》よう。同《おな》じ字《じ》でも、ことばで読《よ》み方《かた》がちがうよ。',
        '一《ひと》つずつ声《こえ》に出《だ》して読《よ》んでみよう。',
        `太《ふと》い字《じ》を「${occ.part}」と読《よ》んで、ことばになるかたしかめよう。`,
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
      ...decoy.slice(0, nWrong - 1).map((w) => w.value),
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
      prompt: '同《おな》じ字《じ》でも、ことばで読《よ》み方《かた》がちがうよ。',
      text: '上《うえ》のことばは「{{}}」、下《した》のことばは「{{}}」と読《よ》む。',
      options,
      blanks: [
        { answers: [first.part], wrong: wrongFor(first, second) },
        { answers: [second.part], wrong: wrongFor(second, first) },
      ],
      hints: [
        '太《ふと》い字《じ》をよく見《み》よう。ことばは二《ふた》つあるよ。',
        '一《ひと》つずつ声《こえ》に出《だ》して読《よ》んでみよう。',
        `一《ひと》つは「${first.masked}」、もう一《ひと》つは「${second.masked}」と読《よ》むよ。`,
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
      explain: `「${first.shown}」は「${first.whole}」、「${second.shown}」は「${second.whole}」。同《おな》じ字《じ》でも、ことばで読《よ》み方《かた》がかわるんだね。`,
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
    const lv = Math.min(level, cfg.weights.length - 1);
    const form = pickWeighted(rng, cfg.weights[lv]!);
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
