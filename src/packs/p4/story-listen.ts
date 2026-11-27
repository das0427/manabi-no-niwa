/**
 * p4.ja.story-listen おはなしを きいて（P2。curriculum-matrix 3.2・4.2。設計: docs/expansion/p2-design/p4.md 1章）。
 * 短い自作のおはなし（2〜3ぶん）を聞いて、だれ・なに・つぎ を答える。本文はすべて自作（既存の絵本の筋と重ねない）。
 * 同一性キー: 本文 × 設問（who:本文 / what:本文 / next:本文、別例 who-all:本文 / scene:本文 / next-pic:名前）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { ListenItem } from '../../engines/listen/listen';
import { choiceItem, ill, listenItem, mix } from './lib';

/** 絵つきの選択肢の元（label は選択肢に出す名） */
interface Pick {
  label: string;
  illust: string;
  mis?: string;
}
const R = (label: string, illust: string, mis?: string): Pick =>
  mis ? { label, illust, mis } : { label, illust };

interface Q {
  /** 設問の文 */
  q: string;
  /** ヒント2段めで「」に入れる本文の言葉 */
  focus: string;
  right: Pick;
  wrong: [Pick, Pick];
  explain: string;
}
interface Story {
  id: string;
  title: string;
  level: 0 | 1;
  lines: string[];
  who?: Q;
  what?: Q;
}

const NIS = 'not-in-story';
const OTH = 'other-role';

const STORIES: Story[] = [
  // ---- 2ぶんの おはなし（1もん） ----
  {
    id: 'sanpo',
    title: 'さんぽ',
    level: 0,
    lines: ['うさぎが さんぽを して いました。', 'いけの そばで、あひるに あいました。'],
    who: {
      q: 'うさぎが あったのは だれ？',
      focus: 'あいました',
      right: R('あひる', 'p23-duck'),
      wrong: [R('うさぎ', 'rabbit', OTH), R('ひよこ', 'chick', NIS)],
      explain: 'あひるだね。「あひるに あいました」と いって いたね。',
    },
  },
  {
    id: 'kaimono',
    title: 'おかいもの',
    level: 0,
    lines: ['ねこが おみせに いきました。', 'ねこは、たまごを かいました。'],
    what: {
      q: 'ねこが かったのは なに？',
      focus: 'かいました',
      right: R('たまご', 'egg'),
      wrong: [R('パン', 'bread', NIS), R('トマト', 'tomato', NIS)],
      explain: 'たまごだね。「たまごを かいました」と いって いたね。',
    },
  },
  {
    id: 'hirune',
    title: 'おひるね',
    level: 0,
    lines: ['ひつじが、きの したで ねて いました。', 'そこへ、ことりが とんで きました。'],
    who: {
      q: 'とんで きたのは だれ？',
      focus: 'とんで きました',
      right: R('ことり', 'bird'),
      wrong: [R('ひつじ', 'p23-sheep', OTH), R('ひよこ', 'chick', NIS)],
      explain: 'ことりだね。ひつじは ねて いたね。',
    },
  },
  {
    id: 'niwa',
    title: 'にわ',
    level: 0,
    lines: ['さるが にわを あるいて いました。', 'すると、きれいな はなが さいて いました。'],
    what: {
      q: 'にわに さいて いたのは なに？',
      focus: 'さいて いました',
      right: R('はな', 'flower'),
      wrong: [R('きのこ', 'life-mushroom', NIS), R('はっぱ', 'leaf', NIS)],
      explain: 'はなだね。「きれいな はなが さいて いました」と いって いたね。',
    },
  },
  {
    id: 'yama',
    title: 'やま',
    level: 0,
    lines: ['くまが やまに のぼりました。', 'てっぺんで、きつねが てを ふりました。'],
    who: {
      q: 'てを ふったのは だれ？',
      focus: 'てを ふりました',
      right: R('きつね', 'fox'),
      wrong: [R('くま', 'bear', OTH), R('いぬ', 'dog', NIS)],
      explain: 'きつねだね。くまは やまに のぼったね。',
    },
  },
  {
    id: 'oyatsu',
    title: 'おやつ',
    level: 0,
    lines: ['おやつの じかんです。', 'かめは、ももを たべました。'],
    what: {
      q: 'かめが たべたのは なに？',
      focus: 'たべました',
      right: R('もも', 'peach'),
      wrong: [R('いちご', 'strawberry', NIS), R('りんご', 'apple', NIS)],
      explain: 'ももだね。「ももを たべました」と いって いたね。',
    },
  },
  {
    id: 'densha',
    title: 'でんしゃ',
    level: 0,
    lines: ['いぬが でんしゃに のりました。', 'となりに、うさぎが すわりました。'],
    who: {
      q: 'となりに すわったのは だれ？',
      focus: 'すわりました',
      right: R('うさぎ', 'rabbit'),
      wrong: [R('いぬ', 'dog', OTH), R('ねこ', 'cat', NIS)],
      explain: 'うさぎだね。いぬの となりに すわったね。',
    },
  },
  {
    id: 'ame',
    title: 'あめ',
    level: 0,
    lines: ['あめが ふって きました。', 'うしは、かさを さして あるきました。'],
    what: {
      q: 'うしが さしたのは なに？',
      focus: 'さして あるきました',
      right: R('かさ', 'umbrella'),
      wrong: [R('ぼうし', 'p23-hat', NIS), R('はっぱ', 'leaf', NIS)],
      explain: 'かさだね。あめの ひは かさを さすね。',
    },
  },
  // ---- 3ぶんの おはなし（2もん） ----
  {
    id: 'omiyage',
    title: 'くまの おみやげ',
    level: 1,
    lines: [
      'うさぎの いえに、くまが あそびに きました。',
      'くまは、かごに りんごを いれて もって きました。',
      'ふたりで、りんごを たべました。',
    ],
    who: {
      q: 'あそびに きたのは だれ？',
      focus: 'あそびに きました',
      right: R('くま', 'bear'),
      wrong: [R('うさぎ', 'rabbit', OTH), R('さる', 'monkey', NIS)],
      explain: 'くまだね。うさぎの いえに あそびに きたね。',
    },
    what: {
      q: 'くまが もって きたのは なに？',
      focus: 'もって きました',
      right: R('りんご', 'apple'),
      wrong: [R('バナナ', 'banana', NIS), R('みかん', 'mikan', NIS)],
      explain: 'りんごだね。かごに いれて もって きたね。',
    },
  },
  {
    id: 'kaze',
    title: 'かぜの ひ',
    level: 1,
    lines: [
      'かぜが びゅうっと ふきました。',
      'ひよこの ぼうしが とんで、きの えだに ひっかかりました。',
      'さるが きに のぼって、ぼうしを とって くれました。',
    ],
    who: {
      q: 'きに のぼったのは だれ？',
      focus: 'きに のぼって',
      right: R('さる', 'monkey'),
      wrong: [R('ひよこ', 'chick', OTH), R('ぞう', 'elephant', NIS)],
      explain: 'さるだね。きに のぼって、ぼうしを とって くれたね。',
    },
    what: {
      q: 'とんで いったのは なに？',
      focus: 'とんで',
      right: R('ぼうし', 'p23-hat'),
      wrong: [R('くつ', 'p23-shoe', NIS), R('かさ', 'umbrella', NIS)],
      explain: 'ぼうしだね。かぜで とんで いったね。',
    },
  },
  {
    id: 'hatake',
    title: 'ぶたの はたけ',
    level: 1,
    lines: [
      'ぶたが はたけで、トマトを そだてて いました。',
      'まいにち みずを やると、トマトが あかく なりました。',
      'ぶたは、トマトを あひるに あげました。',
    ],
    who: {
      q: 'トマトを もらったのは だれ？',
      focus: 'あげました',
      right: R('あひる', 'p23-duck'),
      wrong: [R('ぶた', 'p23-pig', OTH), R('うし', 'cow', NIS)],
      explain: 'あひるだね。ぶたが あひるに あげたね。',
    },
    what: {
      q: 'ぶたが そだてて いたのは なに？',
      focus: 'そだてて いました',
      right: R('トマト', 'tomato'),
      wrong: [R('なす', 'eggplant', NIS), R('きゅうり', 'cucumber', NIS)],
      explain: 'トマトだね。みずを やると あかく なったね。',
    },
  },
  {
    id: 'yoru',
    title: 'しずかな よる',
    level: 1,
    lines: [
      'よるに なりました。',
      'ひつじが、ふとんで えほんを よんで いました。',
      'そこへ ねこが きて、「いっしょに よもう」と いいました。',
    ],
    who: {
      q: 'あとから きたのは だれ？',
      focus: 'そこへ',
      right: R('ねこ', 'cat'),
      wrong: [R('ひつじ', 'p23-sheep', OTH), R('いぬ', 'dog', NIS)],
      explain: 'ねこだね。「いっしょに よもう」と いったね。',
    },
    what: {
      q: 'ひつじが よんで いたのは なに？',
      focus: 'よんで いました',
      right: R('えほん', 'p23-book'),
      wrong: [R('えんぴつ', 'pencil', NIS), R('ボール', 'ball', NIS)],
      explain: 'えほんだね。ふとんで よんで いたね。',
    },
  },
  {
    id: 'yuki',
    title: 'しろい にわ',
    level: 1,
    lines: [
      'ゆきが たくさん つもりました。',
      'いぬと ねこは、そとで ゆきだるまを つくりました。',
      'さいごに、いぬが ゆきだるまに ぼうしを かぶせました。',
    ],
    who: {
      q: 'ぼうしを かぶせたのは だれ？',
      focus: 'かぶせました',
      right: R('いぬ', 'dog'),
      wrong: [R('ねこ', 'cat', OTH), R('くま', 'bear', NIS)],
      explain: 'いぬだね。さいごに ぼうしを かぶせたね。',
    },
    what: {
      q: 'ふたりが つくったのは なに？',
      focus: 'つくりました',
      right: R('ゆきだるま', 'life-snowman'),
      wrong: [R('ケーキ', 'p5-cake', NIS), R('ボール', 'ball', NIS)],
      explain: 'ゆきだるまだね。ゆきで つくったね。',
    },
  },
  {
    id: 'umi',
    title: 'うしの おでかけ',
    level: 1,
    lines: [
      'うしが バスに のって、うみへ いきました。',
      'うみで、たこが かおを だしました。',
      'うしと たこは、すなはまで ボールあそびを しました。',
    ],
    who: {
      q: 'うみで あったのは だれ？',
      focus: 'かおを だしました',
      right: R('たこ', 'octopus'),
      wrong: [R('うし', 'cow', OTH), R('かめ', 'turtle', NIS)],
      explain: 'たこだね。うみで かおを だしたね。',
    },
    what: {
      q: 'うしが のったのは なに？',
      focus: 'のって',
      right: R('バス', 'bus-yellow'),
      wrong: [R('でんしゃ', 'train', NIS), R('ひこうき', 'airplane', NIS)],
      explain: 'バスだね。バスに のって うみへ いったね。',
    },
  },
];

/** つぎ どう なる？（level 2。q はすべて同じ） */
interface Next {
  id: string;
  title: string;
  lines: string[];
  right: Pick;
  wrong: [Pick, Pick];
  cue: string;
  explain: string;
}
const NEXTS: Next[] = [
  {
    id: 'tane',
    title: 'たね',
    lines: ['うさぎが、にわに たねを まきました。', 'まいにち、みずを やりました。'],
    right: R('めが でる', 'life-sprout'),
    wrong: [R('たねを まく', 'life-seed', 'next-back'), R('いしに なる', 'rock', 'next-unrelated')],
    cue: 'たねに みずを やると、どう なるかな。',
    explain: 'めが でて くるね。たねに みずを やると、めが でるよ。',
  },
  {
    id: 'kakekko',
    title: 'かけっこ',
    lines: ['いぬは、たくさん はしりました。', 'のどが からからです。'],
    right: R('みずを のむ', 'p23-cup'),
    wrong: [
      R('えを かく', 'pencil', 'next-unrelated'),
      R('はを みがく', 'p23-toothbrush', 'next-unrelated'),
    ],
    cue: 'のどが からからの ときは、どう したいかな。',
    explain: 'みずを のむね。のどが かわいたからね。',
  },
  {
    id: 'doronko',
    title: 'どろんこ',
    lines: [
      'くまは、どろんこ あそびを しました。',
      'てが どろだらけです。',
      'これから おやつを たべます。',
    ],
    right: R('てを あらう', 'p23-soap'),
    wrong: [R('ねる', 'p23-pillow', 'next-unrelated'), R('えを かく', 'pencil', 'next-unrelated')],
    cue: 'よごれた てで たべても いいかな。',
    explain: 'てを あらうね。きれいな てで おやつを たべよう。',
  },
  {
    id: 'akubi',
    title: 'よる',
    lines: ['よるに なりました。', 'ひよこは、おおきな あくびを しました。'],
    right: R('ねる', 'p23-pillow'),
    wrong: [
      R('そとで あそぶ', 'ball', 'next-unrelated'),
      R('うみで およぐ', 'life-swimring', 'next-unrelated'),
    ],
    cue: 'あくびが でるのは どんな ときかな。',
    explain: 'ねるね。よるで、ねむく なったからね。',
  },
  {
    id: 'odekake',
    title: 'おでかけ',
    lines: [
      'ぶたが でかけようと すると、あめが ふって きました。',
      'ぶたは、かさを もって きました。',
    ],
    right: R('かさを さす', 'umbrella'),
    wrong: [
      R('うきわで およぐ', 'life-swimring', 'next-unrelated'),
      R('ねる', 'p23-pillow', 'next-unrelated'),
    ],
    cue: 'あめの ひに かさを もって、どう するかな。',
    explain: 'かさを さして でかけるね。',
  },
  {
    id: 'onaka',
    title: 'おなか',
    lines: ['さるの おなかが、ぐうっと なりました。', 'テーブルに、バナナが あります。'],
    right: R('バナナを たべる', 'banana'),
    wrong: [
      R('はを みがく', 'p23-toothbrush', 'next-unrelated'),
      R('ねる', 'p23-pillow', 'next-unrelated'),
    ],
    cue: 'おなかが なるのは どんな ときかな。',
    explain: 'バナナを たべるね。おなかが すいて いたからね。',
  },
  {
    id: 'ball',
    title: 'ぽーん',
    lines: ['ねこが、ボールを ぽーんと うえに なげました。', 'ボールは、たかく あがりました。'],
    right: R('おちて くる', 'ball'),
    wrong: [
      R('うちゅうへ いく', 'p5-rocket', 'next-unrelated'),
      R('ほしに なる', 'p23-star', 'next-unrelated'),
    ],
    cue: 'うえに なげた ものは、そのあと どう なるかな。',
    explain: 'ボールは おちて くるね。なげた ものは したに おちるよ。',
  },
];

const opt = (p: Pick, correct = false): ChoiceOption => ({
  label: p.label,
  figure: ill(p.illust),
  ...(correct ? { correct: true } : p.mis ? { misconception: p.mis } : {}),
});
const sounds = (lines: string[]) => lines.map((text) => ({ text }));
const find = (id: string): Story => STORIES.find((s) => s.id === id)!;

/** だれ・なに（練習） */
function qaItem(kind: 'who' | 'what', s: Story): ListenItem {
  const q = s[kind]!;
  const id = `${kind}:${s.id}`;
  return listenItem({
    id,
    objective: kind,
    level: s.level,
    prompt: `「${s.title}」。${q.q}`,
    audio: sounds(s.lines),
    gapMs: 700,
    hints: ['もういちど おはなしを きこう。', `「${q.focus}」の ところを おもいだそう。`],
    explain: q.explain,
    identity: id,
    correct: { label: q.right.label, figure: ill(q.right.illust) },
    wrong: q.wrong.map((w) => opt(w)),
  }) as ListenItem;
}

function nextItem(n: Next): ListenItem {
  const id = `next:${n.id}`;
  return listenItem({
    id,
    objective: 'next',
    level: 2,
    prompt: `「${n.title}」。つぎは どう なるかな？`,
    audio: sounds(n.lines),
    gapMs: 700,
    hints: ['おはなしで なにが あったか おもいだそう。', n.cue],
    explain: n.explain,
    identity: id,
    correct: { label: n.right.label, figure: ill(n.right.illust) },
    wrong: n.wrong.map((w) => opt(w)),
  }) as ListenItem;
}

/** 別例: でて きたのを ぜんぶ えらぶ */
const WHO_ALL: [string, [Pick, Pick], [Pick, Pick]][] = [
  [
    'omiyage',
    [R('くま', 'bear'), R('うさぎ', 'rabbit')],
    [R('さる', 'monkey'), R('きつね', 'fox')],
  ],
  [
    'hatake',
    [R('ぶた', 'p23-pig'), R('あひる', 'p23-duck')],
    [R('うし', 'cow'), R('ひつじ', 'p23-sheep')],
  ],
  ['yuki', [R('いぬ', 'dog'), R('ねこ', 'cat')], [R('くま', 'bear'), R('うさぎ', 'rabbit')]],
];
function whoAllItem(sid: string, rights: [Pick, Pick], wrongs: [Pick, Pick]): ListenItem {
  const s = find(sid);
  const id = `who-all:${sid}`;
  return {
    engine: 'listen',
    id,
    objective: 'who',
    level: 1,
    alt: true,
    multi: true,
    prompt: `「${s.title}」。でて きたのを ぜんぶ えらぼう。`,
    audio: sounds(s.lines),
    gapMs: 700,
    hints: ['もういちど おはなしを きこう。', 'でて きた どうぶつは ふたり だよ。'],
    explain: `${rights[0].label}と ${rights[1].label}が でて きたね。`,
    identity: id,
    options: mix(id, [
      ...rights.map((r) => opt(r, true)),
      ...wrongs.map((w) => opt({ ...w, mis: NIS })),
    ]),
  };
}

/** 別例: だれ＋なに の えを えらぶ */
interface Scene {
  sid: string;
  prompt: string;
  right: [string, string, string, string];
  wrong: [[string, string, string, string, string], [string, string, string, string, string]];
  cue: string;
  explain: string;
}
const SCENES: Scene[] = [
  {
    sid: 'kaimono',
    prompt: 'おはなしに あう えは どれ？',
    right: ['ねこと たまご', 'cat', 'egg', ''],
    wrong: [
      ['ねこと パン', 'cat', 'bread', NIS, ''],
      ['いぬと たまご', 'dog', 'egg', NIS, ''],
    ],
    cue: 'だれが、なにを かったかな。',
    explain: 'ねこが たまごを かったね。',
  },
  {
    sid: 'kaze',
    prompt: 'ぼうしを とった ところは どれ？',
    right: ['さると ぼうし', 'monkey', 'p23-hat', ''],
    wrong: [
      ['ひよこと ぼうし', 'chick', 'p23-hat', OTH, ''],
      ['さると くつ', 'monkey', 'p23-shoe', NIS, ''],
    ],
    cue: 'だれが きに のぼったかな。',
    explain: 'さるが ぼうしを とって くれたね。',
  },
  {
    sid: 'hatake',
    prompt: 'おはなしに あう えは どれ？',
    right: ['ぶたと トマト', 'p23-pig', 'tomato', ''],
    wrong: [
      ['ぶたと なす', 'p23-pig', 'eggplant', NIS, ''],
      ['うしと トマト', 'cow', 'tomato', NIS, ''],
    ],
    cue: 'だれが、なにを そだてたかな。',
    explain: 'ぶたが トマトを そだてたね。',
  },
];
function sceneItem(c: Scene): ListenItem {
  const s = find(c.sid);
  const id = `scene:${c.sid}`;
  const row = (a: string, b: string) => ({ kind: 'row' as const, items: [ill(a), ill(b)] });
  return listenItem({
    id,
    objective: 'what',
    level: s.level,
    alt: true,
    prompt: `「${s.title}」。${c.prompt}`,
    audio: sounds(s.lines),
    gapMs: 700,
    hints: ['もういちど おはなしを きこう。', c.cue],
    explain: c.explain,
    identity: id,
    correct: { label: c.right[0], figure: row(c.right[1], c.right[2]) },
    wrong: c.wrong.map(([label, a, b, mis]) => ({
      label,
      figure: row(a, b),
      misconception: mis,
    })),
  }) as ListenItem;
}

/** 別例: えの おはなしで つぎを えらぶ */
const NEXT_PIC: {
  id: string;
  pair: [string, string];
  right: Pick;
  wrong: [Pick, Pick];
  cue: string;
  explain: string;
}[] = [
  {
    id: 'bud',
    pair: ['life-sprout', 'life-bud'],
    right: R('はなが さく', 'flower'),
    wrong: [
      R('たねに もどる', 'life-seed', 'next-back'),
      R('いしに なる', 'rock', 'next-unrelated'),
    ],
    cue: 'めが でて、つぼみに なったよ。',
    explain: 'はなが さくね。め → つぼみ → はな の じゅんだよ。',
  },
  {
    id: 'melt',
    pair: ['p5-icecream', 'p5-sun'],
    right: R('とける', 'p4-melted'),
    wrong: [
      R('ゆきだるまに なる', 'life-snowman', 'next-unrelated'),
      R('ケーキに なる', 'p5-cake', 'next-unrelated'),
    ],
    cue: 'アイスを あつい ところに おくと どう なるかな。',
    explain: 'とけるね。アイスは あついと とけて しまうよ。',
  },
  {
    id: 'hatch',
    pair: ['egg', 'p4-egg-crack'],
    right: R('ひよこが でる', 'chick'),
    wrong: [
      R('もとの たまご', 'egg', 'next-back'),
      R('おにぎりに なる', 'onigiri', 'next-unrelated'),
    ],
    cue: 'たまごに ひびが はいったよ。',
    explain: 'ひよこが でて くるね。',
  },
];
function nextPicItem(n: (typeof NEXT_PIC)[number]): Item {
  const id = `next-pic:${n.id}`;
  return choiceItem({
    id,
    objective: 'next',
    level: 2,
    alt: true,
    prompt: 'えの おはなし。つぎは どう なる？',
    figure: { kind: 'row', items: n.pair.map((p) => ill(p)) },
    hints: ['ひだりの えから じゅんに みよう。', n.cue],
    explain: n.explain,
    identity: id,
    layout: 'row',
    correct: { label: n.right.label, figure: ill(n.right.illust) },
    wrong: n.wrong.map((w) => opt(w)),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const s of STORIES.filter((x) => x.level === 0))
    items.push(qaItem(s.who ? 'who' : 'what', s));
  for (const s of STORIES.filter((x) => x.level === 1)) {
    items.push(qaItem('who', s));
    items.push(qaItem('what', s));
  }
  for (const n of NEXTS) items.push(nextItem(n));
  for (const w of WHO_ALL) items.push(whoAllItem(...w));
  for (const c of SCENES) items.push(sceneItem(c));
  for (const n of NEXT_PIC) items.push(nextPicItem(n));
  return items;
}

export const storyListen: UnitSpec = {
  id: 'p4.ja.story-listen',
  title: 'おはなしを きいて',
  stage: 'p4',
  subject: 'ja',
  domain: 'play',
  kind: 'reading',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-book',
  prereq: ['p23.ja.word-listen'],
  objectives: [
    { id: 'who', title: 'だれが でて きたか・だれが したか' },
    { id: 'what', title: 'なにが でて きたか' },
    { id: 'next', title: 'つぎ どう なるか' },
  ],
  misconceptions: [
    {
      id: 'not-in-story',
      explain:
        'おはなしに でて きたと おもったのかな。もういちど きいて、でて きた ものを さがそう。',
    },
    {
      id: 'other-role',
      explain:
        'でて きたけれど、ちがう ことを した ほうだと かんがえたのかな。だれが なにを したか きこう。',
    },
    {
      id: 'next-back',
      explain: 'もう おわった ことを えらんだのかな。その あと どう なるか かんがえよう。',
    },
    {
      id: 'next-unrelated',
      explain: 'おはなしと つながらない ことだと おもうよ。なにが あったから、どう なるかな。',
    },
  ],
  levels: [
    { label: '2ぶんの おはなし（1もん）', chance: 1 / 3 },
    { label: '3ぶんの おはなし（2もん）', chance: 1 / 3 },
    { label: 'つぎ どう なる？', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'おはなしを よく きいてね。だれが でて きたかな。なにが あったかな。',
      figure: ill('p23-book'),
    },
    { text: 'わからない ときは、もういちど きいて いいよ。', figure: ill('listen') },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '幼稚園教育要領 第2章 言葉 内容(9)（絵本や物語などに親しみ、興味をもって聞き、想像をする楽しさを味わう）・(4)（人の話を注意して聞く）、curriculum-matrix 3.2・4.2、小学校国語 第1・2学年 C 読むこと へ接続',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
