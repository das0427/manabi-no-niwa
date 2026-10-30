/**
 * p23.ja.picture-book えほん（curriculum-matrix 3.1。設計書 docs/expansion/p2-design/p23.md 5章）。
 * 本アプリのオリジナルの短いお話を聞いて えらぶ。L2（段階0）: でて きた どうぶつを ゆびさし（2択）。
 * L3（段階1）: だれが なにを したか（3択）。別例: 名前を言わず 様子のことばで聞く。
 * お話の文は 文ごとに1つの音声（gapMs 700）。図は表紙の絵だけ（話の中身の絵は答えが見えるので出さない）。
 * 同一性キー: お話 ＋ 問い方。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, listenItem } from './lib';

interface Thing {
  label: string;
  illust: string;
}
const T = (label: string, illust: string): Thing => ({ label, illust });

interface Story {
  n: string;
  text: string[];
  who: Thing;
  whoWrong: Thing;
  ask: string;
  right: Thing;
  otherRole: Thing;
  notIn: Thing;
  /** ヒントの人物（〜さん） */
  actor: string;
  /** ヒント2 を人物の形で言えないときの文（S5: とんだのは だれかの もの では なく かぜの ところ） */
  hint2?: string;
  explain: string;
}

const STORIES: Story[] = [
  {
    n: 'S1',
    text: [
      'くまさんが りんごを もって、のはらに いったよ。',
      'うさぎさんは にんじんを もって きたよ。',
      'ふたりで いただきます。おいしいね。',
    ],
    who: T('くま', 'bear'),
    whoWrong: T('バス', 'bus-yellow'),
    ask: 'くまさんが もって いったのは どれ？',
    right: T('りんご', 'apple'),
    otherRole: T('にんじん', 'carrot'),
    notIn: T('バナナ', 'banana'),
    actor: 'くま',
    explain: 'くまさんは りんごを もって いったね。',
  },
  {
    n: 'S2',
    text: [
      'あめが ふって きたよ。',
      'ねこさんは かさを さして、いぬさんは ぼうしを かぶったよ。',
      'ふたりで みずたまりを ぴょん。',
    ],
    who: T('ねこ', 'cat'),
    whoWrong: T('ひこうき', 'airplane'),
    ask: 'ねこさんが つかったのは どれ？',
    right: T('かさ', 'umbrella'),
    otherRole: T('ぼうし', 'p23-hat'),
    notIn: T('ボール', 'ball'),
    actor: 'ねこ',
    explain: 'ねこさんは かさを さしたね。',
  },
  {
    n: 'S3',
    text: [
      'ぞうさんが すいかを ごろごろ はこんで きたよ。',
      'さるさんは バナナを もって きたよ。',
      'みんなで わけて たべたよ。',
    ],
    who: T('ぞう', 'elephant'),
    whoWrong: T('くるま', 'car-red'),
    ask: 'ぞうさんが はこんで きたのは どれ？',
    right: T('すいか', 'watermelon'),
    otherRole: T('バナナ', 'banana'),
    notIn: T('みかん', 'mikan'),
    actor: 'ぞう',
    explain: 'ぞうさんは すいかを はこんで きたね。',
  },
  {
    n: 'S4',
    text: [
      'ひよこさんが パンやさんに いったよ。',
      'ひよこさんは パンを ひとつ かったよ。',
      'かえりに ぶたさんから おにぎりを もらったよ。',
    ],
    who: T('ひよこ', 'chick'),
    whoWrong: T('でんしゃ', 'train'),
    ask: 'ひよこさんが かったのは どれ？',
    right: T('パン', 'bread'),
    otherRole: T('おにぎり', 'onigiri'),
    notIn: T('いちご', 'strawberry'),
    actor: 'ひよこ',
    explain: 'ひよこさんは パンを かったね。',
  },
  {
    n: 'S5',
    text: [
      'きつねさんが ぼうしを かぶって、くつを はいて おでかけ。',
      'かぜが ぴゅーっと ふいて、ぼうしが とんで いったよ。',
      'とりさんが ぼうしを ひろって きて くれたよ。',
    ],
    who: T('きつね', 'fox'),
    whoWrong: T('ふね', 'ship'),
    ask: 'とんで いったのは どれ？',
    right: T('ぼうし', 'p23-hat'),
    otherRole: T('くつ', 'p23-shoe'),
    notIn: T('かさ', 'umbrella'),
    actor: 'きつね',
    hint2: 'かぜが ぴゅーっと ふいた ところを よく きいてね。',
    explain: 'とんで いったのは ぼうしだね。',
  },
  {
    n: 'S6',
    text: [
      'うしさんと ひつじさんが やまに のぼったよ。',
      'うしさんの おべんとうは おにぎり。',
      'ひつじさんの おべんとうは いちごだったよ。',
    ],
    who: T('うし', 'cow'),
    whoWrong: T('じてんしゃ', 'bicycle'),
    ask: 'うしさんの おべんとうは どれ？',
    right: T('おにぎり', 'onigiri'),
    otherRole: T('いちご', 'strawberry'),
    notIn: T('トマト', 'tomato'),
    actor: 'うし',
    explain: 'うしさんの おべんとうは おにぎりだね。',
  },
  {
    n: 'S7',
    text: [
      'かめさんは のどが からから。',
      'あひるさんが コップに みずを いれて くれたよ。',
      'かめさんは おれいに みかんを あげたよ。',
    ],
    who: T('かめ', 'turtle'),
    whoWrong: T('かさ', 'umbrella'),
    ask: 'かめさんが あげたのは どれ？',
    right: T('みかん', 'mikan'),
    otherRole: T('コップ', 'p23-cup'),
    notIn: T('もも', 'peach'),
    actor: 'かめ',
    explain: 'かめさんは おれいに みかんを あげたね。',
  },
  {
    n: 'S8',
    text: [
      'よるに なったよ。さるさんは もう ねむい。',
      'ぶたさんが えほんを よんで くれたよ。',
      'とけいが ちくたく。おやすみなさい。',
    ],
    who: T('さる', 'monkey'),
    whoWrong: T('くるま', 'car-red'),
    ask: 'ぶたさんが よんで くれたのは どれ？',
    right: T('えほん', 'p23-book'),
    otherRole: T('とけい', 'p23-clock'),
    notIn: T('ボール', 'ball'),
    actor: 'ぶた',
    explain: 'ぶたさんは えほんを よんで くれたね。',
  },
];

const opt = (t: Thing) => ({ label: t.label, figure: ill(t.illust) });
const GAP_MS = 700;
const COVER_ID = 'p23-book';
/** 図は表紙の絵。ただし えほん が選択肢にあるときは出さない（図と同じ絵の選択肢が手がかりに なるため） */
const cover = (ts: Thing[]) =>
  ts.some((t) => t.illust === COVER_ID) ? {} : { figure: ill(COVER_ID) };

function whoItem(s: Story): Item {
  const id = `who:${s.n}`;
  return listenItem({
    id,
    identity: id,
    objective: 'who',
    level: 0,
    prompt: 'きいてね。でて きたのは どっち？',
    audio: s.text.map((text) => ({ text })),
    gapMs: GAP_MS,
    ...cover([s.who, s.whoWrong]),
    hints: ['もういちど おはなしを きいて みよう。', 'だれが でて きたか、ゆっくり おもいだそう。'],
    explain: `${s.who.label}さんが でて きたね。`,
    correct: opt(s.who),
    wrong: [{ ...opt(s.whoWrong), misconception: 'not-in-story' }],
  });
}

function thingItem(s: Story): Item {
  const id = `thing:${s.n}`;
  return listenItem({
    id,
    identity: id,
    objective: 'thing',
    level: 1,
    prompt: s.ask,
    audio: s.text.map((text) => ({ text })),
    gapMs: GAP_MS,
    ...cover([s.right, s.otherRole, s.notIn]),
    hints: [
      'もういちど おはなしを きいて みよう。',
      s.hint2 ?? `${s.actor}さんが でて くる ところを よく きいてね。`,
    ],
    explain: s.explain,
    correct: opt(s.right),
    wrong: [
      { ...opt(s.otherRole), misconception: 'other-role' },
      { ...opt(s.notIn), misconception: 'not-in-story' },
    ],
  });
}

interface Feature {
  n: string;
  obj: 'who' | 'thing';
  text: string[];
  right: Thing;
  wrong: [Thing, Thing];
  clue: string;
  explain: string;
}
const FEATURES: Feature[] = [
  {
    n: 'A1',
    obj: 'who',
    text: ['ながい はなの おおきな どうぶつが きたよ。', 'はなで みずを ぴゅーっと かけたよ。'],
    right: T('ぞう', 'elephant'),
    wrong: [T('うさぎ', 'rabbit'), T('くま', 'bear')],
    clue: 'ながい はな',
    explain: 'ながい はなの ぞうさんだったね。',
  },
  {
    n: 'A2',
    obj: 'who',
    text: ['ながい みみの どうぶつが きたよ。', 'ぴょんぴょん はねて、にんじんを たべたよ。'],
    right: T('うさぎ', 'rabbit'),
    wrong: [T('ねこ', 'cat'), T('ぞう', 'elephant')],
    clue: 'ながい みみ',
    explain: 'ながい みみの うさぎさんだったね。',
  },
  {
    n: 'A3',
    obj: 'who',
    text: [
      'せなかに まるい こうらの ある どうぶつが きたよ。',
      'ゆっくり ゆっくり あるいて きたよ。',
    ],
    right: T('かめ', 'turtle'),
    wrong: [T('かえる', 'frog'), T('いぬ', 'dog')],
    clue: 'まるい こうら',
    explain: 'まるい こうらの かめさんだったね。',
  },
  {
    n: 'A4',
    obj: 'who',
    text: ['きいろくて ちいさい とりの こが きたよ。', 'ぴよぴよと ないたよ。'],
    right: T('ひよこ', 'chick'),
    wrong: [T('あひる', 'p23-duck'), T('ぶた', 'p23-pig')],
    clue: 'ぴよぴよ',
    explain: 'ぴよぴよと なく ひよこさんだったね。',
  },
  {
    n: 'B1',
    obj: 'thing',
    text: ['うさぎさんが くだものを みつけたよ。', 'あかくて まるい くだものだよ。'],
    right: T('りんご', 'apple'),
    wrong: [T('バナナ', 'banana'), T('パン', 'bread')],
    clue: 'あかくて まるい',
    explain: 'あかくて まるい りんごだったね。',
  },
  {
    n: 'B2',
    obj: 'thing',
    text: [
      'いぬさんが あめの ひに つかう ものを もって きたよ。',
      'ひらくと まるい やねみたいに なるよ。',
    ],
    right: T('かさ', 'umbrella'),
    wrong: [T('ボール', 'ball'), T('くつ', 'p23-shoe')],
    clue: 'あめの ひに つかう',
    explain: 'あめの ひに つかう かさだったね。',
  },
  {
    n: 'B3',
    obj: 'thing',
    text: ['くまさんが くだものを たべたよ。', 'ながくて きいろい くだものだよ。'],
    right: T('バナナ', 'banana'),
    wrong: [T('りんご', 'apple'), T('みかん', 'mikan')],
    clue: 'ながくて きいろい',
    explain: 'ながくて きいろい バナナだったね。',
  },
  {
    n: 'B4',
    obj: 'thing',
    text: ['ねこさんが まるい もので あそんだよ。', 'ころころ ころがる ものだよ。'],
    right: T('ボール', 'ball'),
    wrong: [T('かさ', 'umbrella'), T('えほん', 'p23-book')],
    clue: 'ころころ ころがる',
    explain: 'ころころ ころがる ボールだったね。',
  },
];

function featureItem(f: Feature): Item {
  const id = `${f.obj}-feature:${f.n}`;
  return listenItem({
    id,
    identity: id,
    objective: f.obj,
    level: 1,
    alt: true,
    prompt: f.obj === 'who' ? 'きいてね。きたのは だれ？' : 'きいてね。どれの ことかな？',
    audio: f.text.map((text) => ({ text })),
    gapMs: GAP_MS,
    ...cover([f.right, ...f.wrong]),
    hints: ['もういちど おはなしを きいて みよう。', `「${f.clue}」の ところを おもいだそう。`],
    explain: f.explain,
    correct: opt(f.right),
    wrong: f.wrong.map((w) => ({ ...opt(w), misconception: 'feature' })),
  });
}

function build(): Item[] {
  return [...STORIES.map(whoItem), ...STORIES.map(thingItem), ...FEATURES.map(featureItem)];
}

export const pictureBook: UnitSpec = {
  id: 'p23.ja.picture-book',
  title: 'えほん',
  stage: 'p23',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-book',
  prereq: [],
  objectives: [
    { id: 'who', title: 'おはなしに でて きた どうぶつが わかる' },
    { id: 'thing', title: 'だれが なにを したか わかる' },
  ],
  misconceptions: [
    {
      id: 'not-in-story',
      explain:
        'おはなしに でて きたと かんがえたのかな。これは でて こなかったよ。もういちど きいて みよう。',
    },
    {
      id: 'other-role',
      explain:
        'おはなしに でて きたね。でも、きかれたのは べつの ところだよ。だれが なにを したか きいて みよう。',
    },
    {
      id: 'feature',
      explain:
        'なまえが でて こなかったから まよったのかな。「ながい」「まるい」のような ようすの ことばを おもいだそう。',
    },
  ],
  levels: [
    { label: '2さいの だんかい: おはなしを きいて ゆびさし（2つから）', chance: 0.5 },
    { label: '3さいの だんかい: だれが なにを したか（3つから）', chance: 1 / 3 },
  ],
  intro: [{ text: 'おはなしを きいて、でて きた ものを さがそう。', figure: ill(COVER_ID) }],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '保育所保育指針 1歳以上3歳未満児 言葉（絵本や紙芝居を楽しむ）、curriculum-matrix 3.1（L2 は「聞くだけ」の代わりに やさしい ゆびさし: 設計書 p23.md 0.5）',
  revised: '2026-10-30',
};
