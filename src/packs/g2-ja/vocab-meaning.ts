/**
 * g2.ja.vocab-meaning にた いみ・はんたいの いみ・ようすを あらわす ことば（curriculum-matrix 3.5）。
 *
 * 同一性キー: 反対語は「組の集合」、似た意味・様子の言葉は「語（と文）」ごと。
 */
import type { ChoiceItem, FillItem, Item, MatchItem, UnitSpec } from '../../curriculum/types';
import { opts, REVISED } from './util';

// ---- 1. はんたいの いみ ----
interface Group {
  pairs: [string, string][];
  distractor: string;
  /** まぎらわしい札と結びがちな左の番号 */
  wrongLeft: number;
  mis: 'other-dimension' | 'similar-for-opposite';
}
const GROUPS: Group[] = [
  {
    pairs: [
      ['おおきい', 'ちいさい'],
      ['おもい', 'かるい'],
      ['ながい', 'みじかい'],
    ],
    distractor: 'ひくい',
    wrongLeft: 2,
    mis: 'other-dimension',
  },
  {
    pairs: [
      ['たかい', 'ひくい'],
      ['ふとい', 'ほそい'],
      ['ひろい', 'せまい'],
    ],
    distractor: 'みじかい',
    wrongLeft: 0,
    mis: 'other-dimension',
  },
  {
    pairs: [
      ['はやい', 'おそい'],
      ['あかるい', 'くらい'],
      ['つよい', 'よわい'],
    ],
    distractor: 'すばやい',
    wrongLeft: 0,
    mis: 'similar-for-opposite',
  },
  {
    pairs: [
      ['ふかい', 'あさい'],
      ['おおい', 'すくない'],
      ['あたらしい', 'ふるい'],
    ],
    distractor: 'ちいさい',
    wrongLeft: 1,
    mis: 'other-dimension',
  },
  {
    pairs: [
      ['あつい', 'つめたい'],
      ['とおい', 'ちかい'],
      ['かたい', 'やわらかい'],
    ],
    distractor: 'さむい',
    wrongLeft: 0,
    mis: 'other-dimension',
  },
  {
    pairs: [
      ['うえ', 'した'],
      ['まえ', 'うしろ'],
      ['みぎ', 'ひだり'],
    ],
    distractor: 'よこ',
    wrongLeft: 1,
    mis: 'other-dimension',
  },
  {
    pairs: [
      ['はいる', 'でる'],
      ['のぼる', 'おりる'],
      ['あける', 'しめる'],
    ],
    distractor: 'あがる',
    wrongLeft: 1,
    mis: 'similar-for-opposite',
  },
  {
    pairs: [
      ['かつ', 'まける'],
      ['ひる', 'よる'],
      ['はじめ', 'おわり'],
    ],
    distractor: 'あさ',
    wrongLeft: 1,
    mis: 'other-dimension',
  },
];

function hantaiItem(g: Group, i: number): MatchItem {
  const [a, b, c] = g.pairs;
  return {
    engine: 'match',
    id: `hantai:${i}`,
    objective: 'hantai',
    level: 0,
    prompt: 'はんたいの いみの ことばを せんで むすぼう。',
    left: g.pairs.map(([l]) => ({ label: l })),
    right: [...g.pairs.map(([, r]) => ({ label: r })), { label: g.distractor }],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrongPairs: [{ pair: [g.wrongLeft, 3], misconception: g.mis }],
    hints: [
      'うえの ことばを ひとつずつ、こえに だして よもう。',
      `「${a![0]}」の はんたいは どんな ようすかな。`,
      'にて いる ことばや、くらべる ことが ちがう ことばに ちゅういしよう。',
    ],
    explain: `「${a![0]}」と「${a![1]}」、「${b![0]}」と「${b![1]}」、「${c![0]}」と「${c![1]}」が はんたいの いみです。`,
    identity: `hantai:${g.pairs.map((p) => p.join('-')).join('/')}`,
  };
}

/** 別例: 文の中に入れる。[文, 正解, ちがう物差し, 同じ語] */
const HANTAI_ALT: [string, string, string, string][] = [
  ['この にもつは おもい。あの にもつは {{}}。', 'かるい', 'ちいさい', 'おもい'],
  ['きりんの くびは ながい。うさぎの しっぽは {{}}。', 'みじかい', 'ひくい', 'ながい'],
  ['ひるは あかるい。よるは {{}}。', 'くらい', 'よわい', 'あかるい'],
  ['かめは あるくのが おそい。うさぎは {{}}。', 'はやい', 'つよい', 'おそい'],
  ['うみは ふかい。みずたまりは {{}}。', 'あさい', 'ひくい', 'ふかい'],
  ['へやに はいる。へやから {{}}。', 'でる', 'あける', 'はいる'],
];

function hantaiAlt([t, ok, other, same]: (typeof HANTAI_ALT)[number]): FillItem {
  return {
    engine: 'fill',
    id: `hantai-alt:${ok}`,
    objective: 'hantai',
    level: 0,
    alt: true,
    prompt: 'はんたいの いみの ことばを いれよう。',
    text: t,
    options: [ok, other, same],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: other, misconception: 'other-dimension' },
          { value: same, misconception: 'same-word' },
        ],
      },
    ],
    hints: [
      'まえの ぶんと あとの ぶんで、くらべて いるね。',
      `「${same}」と はんたいの ようすを かんがえよう。`,
      'なにを くらべて いるのか（おもさ・ながさ など）に きを つけよう。',
    ],
    explain: `「${same}」の はんたいは「${ok}」です。`,
    identity: `hantai-alt:${ok}`,
  };
}

// ---- 2. にた いみ ----
/** [語, 似た語, 反対の語, 関係はあるが似ていない語] */
const NITERU: [string, string, string, string][] = [
  ['すこし', 'ちょっと', 'たくさん', 'ちいさい'],
  ['たくさん', 'いっぱい', 'すこし', 'おおきい'],
  ['はじめ', 'さいしょ', 'おわり', 'まえ'],
  ['おわり', 'さいご', 'はじめ', 'うしろ'],
  ['きれい', 'うつくしい', 'きたない', 'あかるい'],
  ['しずか', 'ひっそり', 'にぎやか', 'くらい'],
  ['とつぜん', 'きゅうに', 'ゆっくり', 'はやく'],
  ['あした', 'あす', 'きのう', 'きょう'],
  ['とても', 'すごく', 'すこし', 'おおきく'],
  ['いう', 'はなす', 'きく', 'かく'],
];

function niteruItem([w, sim, opp, rel]: (typeof NITERU)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `niteru:${w}`,
    objective: 'niteru',
    level: 1,
    prompt: `「${w}」と にた いみの ことばは どれ？`,
    options: opts(sim, [
      [opp, 'opposite-for-similar'],
      [rel, 'related-not-similar'],
    ]),
    hints: [
      `「${w}」を つかった ぶんを おもいうかべよう。`,
      `その ぶんの「${w}」の かわりに いれても、いみが かわらない ことばを さがそう。`,
      'はんたいの いみの ことばは ちがうよ。',
    ],
    explain: `「${w}」と「${sim}」は にた いみです。「${opp}」は はんたいの いみです。`,
    identity: `niteru:${w}`,
  };
}

/** 別例: 文の中に入れる。[文, もとの語, 正解, 反対, 関係] */
const NITERU_ALT: [string, string, string, string, string][] = [
  ['おかしを {{}} もらった。', 'たくさん', 'いっぱい', 'すこし', 'おおきい'],
  ['{{}} あめが ふって きた。', 'とつぜん', 'きゅうに', 'ゆっくり', 'はやく'],
  ['よるの まちは {{}}と して いた。', 'しずか', 'ひっそり', 'にぎやか', 'くらい'],
  ['ぼくは ねこが {{}} すきだ。', 'すごく', 'とても', 'すこし', 'おおきく'],
  ['えいがを {{}}から みた。', 'さいしょ', 'はじめ', 'おわり', 'つぎ'],
  ['ともだちの はなしに {{}}。', 'びっくりした', 'おどろいた', 'おちついた', 'わらった'],
];

function niteruAlt([t, w, ok, opp, rel]: (typeof NITERU_ALT)[number]): FillItem {
  return {
    engine: 'fill',
    id: `niteru-alt:${ok}`,
    objective: 'niteru',
    level: 1,
    alt: true,
    prompt: `「${w}」と にた いみの ことばを いれよう。`,
    text: t,
    options: [ok, opp, rel],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: opp, misconception: 'opposite-for-similar' },
          { value: rel, misconception: 'related-not-similar' },
        ],
      },
    ],
    hints: [
      `あいて いる ところに「${w}」を いれて よんで みよう。`,
      'おなじ いみに なる ことばを えらぶよ。',
      'はんたいの いみに ならないか たしかめよう。',
    ],
    explain: `「${w}」と にた いみの「${ok}」が はいります。`,
    identity: `niteru-alt:${ok}`,
  };
}

// ---- 3. ようすを あらわす ことば ----
/** [文, 正解, 合わない語1, 合わない語2] */
const YOUSU: [string, string, string, string][] = [
  ['うさぎが {{}} はねる。', 'ぴょんぴょん', 'のしのし', 'ざあざあ'],
  ['ぞうが {{}} あるく。', 'のしのし', 'ぴょんぴょん', 'きらきら'],
  ['あかちゃんが {{}} あるく。', 'よちよち', 'どしんどしん', 'ざあざあ'],
  ['ほしが {{}} ひかる。', 'きらきら', 'ころころ', 'ぐっすり'],
  ['あめが {{}} ふる。', 'ざあざあ', 'にこにこ', 'ぴょんぴょん'],
  ['ボールが {{}} ころがる。', 'ころころ', 'ぐっすり', 'ふわふわ'],
  ['よる {{}} ねむる。', 'ぐっすり', 'ぴかぴか', 'よちよち'],
  ['ともだちが {{}} わらう。', 'にこにこ', 'ざあざあ', 'のしのし'],
  ['くもが {{}} うかぶ。', 'ふわふわ', 'どしんどしん', 'ぐっすり'],
  ['こおりの うえで {{}} すべる。', 'つるつる', 'ふわふわ', 'にこにこ'],
  ['あめに ぬれて {{}}に なった。', 'びしょびしょ', 'ぴかぴか', 'ころころ'],
  ['おなかが {{}}だ。', 'ぺこぺこ', 'きらきら', 'ぴょんぴょん'],
  ['くつを みがいて {{}}に した。', 'ぴかぴか', 'びしょびしょ', 'ぺこぺこ'],
  ['はるの ひは {{}} あたたかい。', 'ぽかぽか', 'ざあざあ', 'よちよち'],
];

function yousuItem([t, ok, w1, w2]: (typeof YOUSU)[number]): FillItem {
  return {
    engine: 'fill',
    id: `yousu:${ok}`,
    objective: 'yousu',
    level: 2,
    prompt: 'ようすに あう ことばを いれよう。',
    text: t,
    options: [ok, w1, w2],
    blanks: [
      {
        answers: [ok],
        wrong: [
          { value: w1, misconception: 'yousu-mismatch' },
          { value: w2, misconception: 'yousu-mismatch' },
        ],
      },
    ],
    hints: [
      'だれが（なにが）、なにを して いるかな。',
      'その ようすを あたまに おもいうかべよう。',
      'えらんだ ことばを いれて、こえに だして よんで みよう。',
    ],
    explain: `${t.replace('{{}}', `**${ok}**`)} ${ok}は その ようすを あらわす ことばです。`,
    identity: `yousu:${ok}`,
  };
}

/** 別例: 語に合う様子を選ぶ。[語, 正解, 誤り1, 誤り2] */
const YOUSU_ALT: [string, string, string, string][] = [
  ['きらきら', 'ほしが ひかる', 'ぞうが あるく', 'あめが ふる'],
  ['のしのし', 'ぞうが あるく', 'うさぎが はねる', 'ほしが ひかる'],
  ['よちよち', 'あかちゃんが あるく', 'くもが うかぶ', 'ボールが とぶ'],
  ['ふわふわ', 'くもが うかぶ', 'いしが おちる', 'ぞうが あるく'],
  ['ざあざあ', 'あめが ふる', 'ほしが ひかる', 'ねこが ねむる'],
  ['ぐっすり', 'ねこが ねむる', 'いぬが はしる', 'とりが なく'],
];

function yousuAlt([w, ok, w1, w2]: (typeof YOUSU_ALT)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `yousu-alt:${w}`,
    objective: 'yousu',
    level: 2,
    alt: true,
    prompt: `「${w}」が あう ようすは どれ？`,
    options: opts(ok, [
      [w1, 'yousu-mismatch'],
      [w2, 'yousu-mismatch'],
    ]),
    hints: [
      `「${w}」を こえに だして いって みよう。`,
      'それぞれの ようすを あたまに おもいうかべよう。',
      `「${w}」を まえに つけて よんで、しぜんな ものを さがそう。`,
    ],
    explain: `「${w} ${ok.split(' ')[1]}」の ように いいます。`,
    identity: `yousu-alt:${w}`,
  };
}

const items: Item[] = [
  ...GROUPS.map(hantaiItem),
  ...HANTAI_ALT.map(hantaiAlt),
  ...NITERU.map(niteruItem),
  ...NITERU_ALT.map(niteruAlt),
  ...YOUSU.map(yousuItem),
  ...YOUSU_ALT.map(yousuAlt),
];

export const vocabMeaning: UnitSpec = {
  id: 'g2.ja.vocab-meaning',
  title: 'にた いみ・はんたいの いみ',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.vocab-groups'],
  objectives: [
    { id: 'hantai', title: 'はんたいの いみの ことば' },
    { id: 'niteru', title: 'にた いみの ことば' },
    { id: 'yousu', title: 'ようすを あらわす ことば' },
  ],
  misconceptions: [
    {
      id: 'other-dimension',
      explain:
        'くらべて いる ことが ちがう ことばを えらんだのかな。「ながい」の はんたいは ながさを くらべる「みじかい」だよ。',
    },
    {
      id: 'similar-for-opposite',
      explain: 'にた いみの ことばを えらんだのかな。はんたいの いみの ことばを さがそう。',
    },
    {
      id: 'same-word',
      explain:
        'まえの ぶんと おなじ ことばを えらんだのかな。くらべて いるので、はんたいの ようすだよ。',
    },
    {
      id: 'opposite-for-similar',
      explain:
        'はんたいの いみの ことばを えらんだのかな。にた いみは、いれかえても いみが かわらない ことばだよ。',
    },
    {
      id: 'related-not-similar',
      explain:
        'かんけいは あるけれど、いみが ちがう ことばを えらんだのかな。ぶんに いれて、おなじ いみに なるか たしかめよう。',
    },
    {
      id: 'yousu-mismatch',
      explain:
        'ようすが あわない ことばを えらんだのかな。その ようすを あたまに おもいうかべて みよう。',
    },
  ],
  levels: [
    { label: 'はんたいの いみ', chance: 0.05 },
    { label: 'にた いみ', chance: 0.05 },
    { label: 'ようすを あらわす ことば', chance: 0.05 },
  ],
  intro: [
    {
      text: '「おおきい」と「ちいさい」の ように、はんたいの いみの ことばが あります。',
      figure: { kind: 'text', text: 'おおきい ⇔ ちいさい', size: 'xl' },
    },
    {
      text: '「すこし」と「ちょっと」の ように、にた いみの ことばも あります。ぶんに いれかえても いみが かわりません。',
    },
    {
      text: '「ぴょんぴょん はねる」「きらきら ひかる」の ように、ようすを あらわす ことばも あります。',
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(1)オ（身近なことを表す語句の量を増し、話や文章の中で使うとともに、言葉には意味による語句のまとまりがあることに気付き、語彙を豊かにすること）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
