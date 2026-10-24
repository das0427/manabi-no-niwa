/**
 * g6.en.places まちの しょうかいを 聞《き》いて・読《よ》んで わかる（curriculum-matrix 3.9。外56 聞く・読む）。
 *   段階0: 聞く（We have a 〜. / We don't have a 〜.）
 *   段階1: 読む（しょうかいの 文を 読んで 絵・いみを えらぶ）
 *   段階2: 2つの しょうかいを くらべる
 * まちは 架空（きたまち・みなみまち）。国の 文化を 決めつける 文は 入れない。
 * 読む問題は choice（英文を 図に 出す）で作った（reading エンジンは本文が日本語の段落を前提にした設問の形なので、
 * 1〜3文の 英文には choice の方が 画面が 簡潔。統括の判断で reading に 移せる）。
 * 同一性キー: 形式 × 英文。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, pickOthers, slugOf } from './lib';

interface Place {
  w: string;
  ja: string;
  il?: string;
}
const PLACES: Place[] = [
  { w: 'park', ja: 'こうえん', il: 'ball' },
  { w: 'library', ja: 'としょかん', il: 'life-library' },
  { w: 'station', ja: 'えき', il: 'life-station' },
  { w: 'hospital', ja: 'びょういん', il: 'life-hospital' },
  { w: 'zoo', ja: 'どうぶつえん', il: 'elephant' },
  { w: 'aquarium', ja: 'すいぞくかん', il: 'octopus' },
  { w: 'museum', ja: 'はくぶつかん' },
  { w: 'stadium', ja: 'スタジアム' },
  { w: 'river', ja: 'かわ' },
  { w: 'mountain', ja: 'やま', il: 'tree' },
  { w: 'beach', ja: 'すなはま' },
  { w: 'bakery', ja: 'パンや', il: 'life-bakery' },
  { w: 'flower shop', ja: 'はなや', il: 'life-flowershop' },
  { w: 'fire station', ja: 'しょうぼうしょ', il: 'life-firestation' },
];

const art = (w: string) => (/^[aeiou]/.test(w) ? 'an' : 'a');
const placeOpt = (p: Place): ChoiceOption => ({
  ...(p.il ? { figure: { kind: 'illust', id: p.il } as Figure } : {}),
  label: p.ja,
});
const P = (w: string) => PLACES.find((p) => p.w === w)!;

/** 形容詞（まちの しょうかいで よく つかう） */
const ADJ = [
  'big',
  'beautiful',
  'new',
  'old',
  'nice',
  'famous',
  'small',
  'big',
  'long',
  'tall',
  'nice',
  'new',
  'pretty',
  'old',
];

function hearItems(): Item[] {
  const out: Item[] = [];
  PLACES.forEach((p, i) => {
    const text = `We have ${art(ADJ[i]!)} ${ADJ[i]} ${p.w}.`;
    const others = pickOthers(PLACES, i, 2, (q) => q !== p);
    out.push(
      listen({
        id: `have:${slugOf(p.w)}`,
        objective: 'hear',
        level: 0,
        prompt: 'まちの しょうかいを 聞《き》こう。この まちに ある ものは どれ？',
        audio: en('town', text),
        options: [
          { ...placeOpt(p), correct: true },
          ...others.map((q) => ({ ...placeOpt(q), misconception: 'word-mix' })),
        ],
        hints: [
          'はじめの 2つの ことばは「わたしたちの まちには 〜が ある」の いみだよ。',
          'まんなかの ことばは ようす（おおきい・あたらしい など）だよ。',
          'さいごの ほうの ことばが、ばしょの なまえだよ。2つの ことばで 1つの ばしょを いう ことも あるよ。',
        ],
        explain: `この まちには ${p.ja}が あります。`,
        explainFigure: enText(text),
        identity: `have:${text}`,
      }),
    );
  });
  // 別例: ある ものと ない ものを 聞きわける
  const NOT: [string, string, string][] = [
    ['library', 'zoo', 'park'],
    ['park', 'aquarium', 'station'],
    ['station', 'stadium', 'hospital'],
    ['river', 'beach', 'mountain'],
    ['bakery', 'museum', 'flower shop'],
    ['hospital', 'fire station', 'library'],
  ];
  for (const [yes, no, other] of NOT) {
    const text = `We have ${art(yes)} ${yes}, but we don't have ${art(no)} ${no}.`;
    out.push(
      listen({
        id: `not:${slugOf(yes)}-${slugOf(no)}`,
        objective: 'hear',
        level: 1,
        prompt: 'まちの しょうかいを 聞《き》こう。この まちに ない ものは どれ？',
        audio: en('town', text),
        options: [
          { ...placeOpt(P(no)), correct: true },
          { ...placeOpt(P(yes)), misconception: 'have-not' },
          { ...placeOpt(P(other)), misconception: 'not-said' },
        ],
        hints: [
          '文《ぶん》の まえの ほうは「ある」、うしろの ほうは「ない」と いって いるよ。',
          'うしろの ほうの さいごの ことばを 聞《き》こう。',
          'しょうかいに 出《で》て こない ばしょは こたえでは ないよ。',
        ],
        explain: `${P(yes).ja}は あるけれど、${P(no).ja}は ありません。`,
        explainFigure: enText(text, 'm'),
        identity: `not:${text}`,
        alt: true,
      }),
    );
  }
  return out;
}

/** 読む: 1〜2文の しょうかい */
const READ: {
  text: string;
  ask: string;
  right: string;
  rightIl?: string;
  wrong: [string, string];
  mis: [string, string];
}[] = [
  {
    text: 'We have a big park.',
    ask: 'この まちに ある ものは？',
    right: 'park',
    wrong: ['zoo', 'station'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: 'We have a new library.',
    ask: 'この まちに ある ものは？',
    right: 'library',
    wrong: ['hospital', 'museum'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: 'We have a beautiful river.',
    ask: 'この まちに ある ものは？',
    right: 'river',
    wrong: ['mountain', 'beach'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: 'We have an aquarium. You can see many fish.',
    ask: 'この まちに ある ものは？',
    right: 'aquarium',
    wrong: ['zoo', 'park'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: "We don't have a zoo. But we have a nice park.",
    ask: 'この まちに ある ものは？',
    right: 'park',
    wrong: ['zoo', 'stadium'],
    mis: ['have-not', 'not-said'],
  },
  {
    text: 'We have a big stadium. You can watch baseball.',
    ask: 'この まちに ある ものは？',
    right: 'stadium',
    wrong: ['museum', 'library'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: 'We have an old museum. It is famous.',
    ask: 'この まちに ある ものは？',
    right: 'museum',
    wrong: ['hospital', 'station'],
    mis: ['word-mix', 'word-mix'],
  },
  {
    text: "We have a station. We don't have a hospital.",
    ask: 'この まちに ない ものは？',
    right: 'hospital',
    wrong: ['station', 'park'],
    mis: ['have-not', 'not-said'],
  },
];

function readItems(): Item[] {
  const out: Item[] = [];
  READ.forEach((r, i) => {
    out.push({
      engine: 'choice',
      id: `read:${i}`,
      objective: 'read',
      level: 1,
      prompt: `まちの しょうかいを 読《よ》もう。${r.ask}`,
      figure: enText(r.text, 'l'),
      options: [
        { ...placeOpt(P(r.right)), correct: true },
        { ...placeOpt(P(r.wrong[0])), misconception: r.mis[0] },
        { ...placeOpt(P(r.wrong[1])), misconception: r.mis[1] },
      ],
      hints: [
        'はじめの 2つの ことばは「わたしたちの まちには 〜が ある」の いみだよ。',
        '「ない」を あらわす ことばが あるか 見《み》よう。',
        'ばしょの なまえは、文《ぶん》の さいごの ほうに あるよ。',
      ],
      explain: `答《こた》えは ${P(r.right).ja}です。`,
      identity: `read:${r.text}`,
    });
  });
  // 別例: 読んで、いみを えらぶ（ようすの ことばも 読む）
  const MEAN: { text: string; right: string; wrong: [string, string]; mis: [string, string] }[] = [
    {
      text: 'We have a big park.',
      right: 'おおきな こうえんが ある',
      wrong: ['ちいさな こうえんが ある', 'おおきな こうえんは ない'],
      mis: ['adj-mix', 'have-not'],
    },
    {
      text: 'We have an old museum.',
      right: 'ふるい はくぶつかんが ある',
      wrong: ['あたらしい はくぶつかんが ある', 'ふるい びょういんが ある'],
      mis: ['adj-mix', 'word-mix'],
    },
    {
      text: "We don't have a beach.",
      right: 'すなはまは ない',
      wrong: ['すなはまが ある', 'かわは ない'],
      mis: ['have-not', 'word-mix'],
    },
    {
      text: 'Our town is famous for apples.',
      right: 'りんごで ゆうめいな まち',
      wrong: ['りんごが すきな まち', 'りんごが ない まち'],
      mis: ['adj-mix', 'have-not'],
    },
  ];
  MEAN.forEach((m, i) => {
    out.push({
      engine: 'choice',
      id: `mean:${i}`,
      objective: 'read',
      level: 1,
      prompt: 'しょうかいの 文《ぶん》を 読《よ》もう。いみに あうのは どれ？',
      figure: enText(m.text, 'l'),
      options: [
        { label: m.right, correct: true },
        { label: m.wrong[0], misconception: m.mis[0] },
        { label: m.wrong[1], misconception: m.mis[1] },
      ],
      layout: 'column',
      hints: [
        '文《ぶん》の はじめから 1つずつ 読《よ》もう。',
        'ようすを あらわす ことばに ちゅうもく しよう。',
        '「ある」「ない」の どちらかも たしかめよう。',
      ],
      explain: `「${m.right}」と いう いみです。`,
      identity: `mean:${m.text}`,
      alt: true,
    });
  });
  return out;
}

/** 2つの まちの しょうかいを くらべる */
const TOWNS: {
  a: string[];
  b: string[];
  ask: string;
  right: string;
  wrong: [string, string];
  mis: [string, string];
}[] = [
  {
    a: ['zoo', 'park'],
    b: ['library', 'park'],
    ask: 'どちらの まちにも ある ものは？',
    right: 'park',
    wrong: ['zoo', 'library'],
    mis: ['one-town', 'one-town'],
  },
  {
    a: ['station', 'museum'],
    b: ['station', 'stadium'],
    ask: 'どちらの まちにも ある ものは？',
    right: 'station',
    wrong: ['museum', 'stadium'],
    mis: ['one-town', 'one-town'],
  },
  {
    a: ['river', 'bakery'],
    b: ['mountain', 'bakery'],
    ask: 'きたまちに だけ ある ものは？',
    right: 'river',
    wrong: ['mountain', 'bakery'],
    mis: ['other-town', 'both-town'],
  },
  {
    a: ['aquarium', 'hospital'],
    b: ['zoo', 'hospital'],
    ask: 'みなみまちに だけ ある ものは？',
    right: 'zoo',
    wrong: ['aquarium', 'hospital'],
    mis: ['other-town', 'both-town'],
  },
  {
    a: ['library', 'beach'],
    b: ['library', 'flower shop'],
    ask: 'どちらの まちにも ある ものは？',
    right: 'library',
    wrong: ['beach', 'flower shop'],
    mis: ['one-town', 'one-town'],
  },
  {
    a: ['park', 'fire station'],
    b: ['museum', 'fire station'],
    ask: 'きたまちに だけ ある ものは？',
    right: 'park',
    wrong: ['museum', 'fire station'],
    mis: ['other-town', 'both-town'],
  },
];

const townText = (list: string[]) => list.map((w) => `We have ${art(w)} ${w}.`).join(' ');

function compareItems(): Item[] {
  const out: Item[] = [];
  TOWNS.forEach((t, i) => {
    const ta = townText(t.a);
    const tb = townText(t.b);
    out.push({
      engine: 'choice',
      id: `compare:${i}`,
      objective: 'compare',
      level: 2,
      prompt: `2つの まち（きたまち・みなみまち）の しょうかいを 読《よ》もう。${t.ask}`,
      figure: {
        kind: 'table',
        header: ['まち', 'しょうかい'],
        rows: [
          ['きたまち', ta],
          ['みなみまち', tb],
        ],
      },
      options: [
        { ...placeOpt(P(t.right)), correct: true },
        { ...placeOpt(P(t.wrong[0])), misconception: t.mis[0] },
        { ...placeOpt(P(t.wrong[1])), misconception: t.mis[1] },
      ],
      hints: [
        'きたまちに ある ものを 2つ さがそう。',
        'みなみまちに ある ものを 2つ さがそう。',
        '2つの まちの ばしょを ならべて くらべよう。',
      ],
      explain: `きたまちには ${t.a.map((w) => P(w).ja).join('と ')}、みなみまちには ${t.b.map((w) => P(w).ja).join('と ')}が あります。こたえは ${P(t.right).ja}です。`,
      identity: `compare:${ta}|${tb}|${t.ask}`,
    });
  });
  // 別例: 2人の しょうかいを 聞いて くらべる
  TOWNS.slice(0, 4).forEach((t, i) => {
    const ta = townText(t.a);
    const tb = townText(t.b);
    const askJa = t.ask.startsWith('きたまち')
      ? '1人《ひとり》めの まちに だけ ある ものは？'
      : t.ask.startsWith('みなみまち')
        ? '2人《ふたり》めの まちに だけ ある ものは？'
        : '2人《ふたり》の まちの どちらにも ある ものは？';
    out.push(
      listen({
        id: `compare-hear:${i}`,
        objective: 'compare',
        level: 2,
        prompt: `2人《ふたり》が じぶんの まちを しょうかいするよ。${askJa}`,
        audio: [en('town', ta), en('town', tb)],
        gapMs: 1000,
        options: [
          { ...placeOpt(P(t.right)), correct: true },
          { ...placeOpt(P(t.wrong[0])), misconception: t.mis[0] },
          { ...placeOpt(P(t.wrong[1])), misconception: t.mis[1] },
        ],
        hints: [
          '1人《ひとり》めの まちに ある ものを 2つ 聞《き》きとろう。',
          '2人《ふたり》めの まちに ある ものを 2つ 聞《き》きとろう。',
          '2つの まちを くらべよう。',
        ],
        explain: `1人《ひとり》めの まちには ${t.a.map((w) => P(w).ja).join('と ')}、2人《ふたり》めの まちには ${t.b.map((w) => P(w).ja).join('と ')}が あります。`,
        explainFigure: { kind: 'column', items: [enText(ta, 'm'), enText(tb, 'm')] },
        identity: `compare-hear:${ta}|${tb}|${t.ask}`,
        alt: true,
      }),
    );
  });
  return out;
}

export const places: UnitSpec = {
  id: 'g6.en.places',
  title: 'まちの しょうかい',
  stage: 'g6',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'house',
  prereq: ['g5.en.read-words'],
  objectives: [
    { id: 'hear', title: 'まちの しょうかいを 聞《き》いて わかる' },
    { id: 'read', title: 'まちの しょうかいを 読《よ》んで わかる' },
    { id: 'compare', title: '2つの しょうかいを くらべる' },
  ],
  misconceptions: [
    {
      id: 'word-mix',
      explain:
        'ほかの ばしょの ことばと とりちがえたのかな。ばしょの なまえを もういちど たしかめよう。',
    },
    {
      id: 'have-not',
      explain:
        '「ある」と「ない」を とりちがえたのかな。「ない」を あらわす ことばが あるか よく たしかめよう。',
    },
    { id: 'not-said', explain: 'しょうかいに 出《で》て こない ばしょを えらんだのかな。' },
    {
      id: 'adj-mix',
      explain:
        'ようすを あらわす ことばを とりちがえたのかな。ばしょの まえの ことばを たしかめよう。',
    },
    {
      id: 'one-town',
      explain:
        'かたほうの まちに しか ない ものを えらんだのかな。2つの まちの りょうほうを たしかめよう。',
    },
    {
      id: 'other-town',
      explain:
        'もう1つの まちの ものと とりちがえたのかな。どちらの まちの 話《はなし》か たしかめよう。',
    },
    {
      id: 'both-town',
      explain: 'それは どちらの まちにも ある ものだね。「だけ」に 気《き》を つけよう。',
    },
  ],
  levels: [
    { label: '聞《き》いて わかる', chance: 0.05 },
    { label: '読《よ》んで わかる', chance: 0.05 },
    { label: '2つを くらべる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'じぶんの まちを しょうかいする ときは、こんな 文《ぶん》を つかうよ。「わたしたちの まちには おおきな こうえんが あります」。',
      figure: enText('We have a big park.', 'xl'),
    },
    {
      text: 'ない ものを いう ときは、こう いうよ。「どうぶつえんは ありません」。',
      figure: enText("We don't have a zoo.", 'xl'),
    },
  ],
  source: { kind: 'items', items: [...hearItems(), ...readItems(), ...compareItems()] },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと・読むこと（身近で簡単な事柄について、具体的な情報を聞き取る。語句や表現の意味が分かる）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
