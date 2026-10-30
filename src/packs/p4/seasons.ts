/**
 * p4.env.seasons きせつと しぜん（P2。curriculum-matrix 3.2・4.2。設計: docs/expansion/p2-design/p4.md 2章）。
 * 物の季節の表（THINGS）が唯一の正本。選択肢・箱・別例の正解と、誤りの季節の誤概念（となり／はんたい）はすべてこの表から決める。
 * 地域でぶれやすいもの（いちご・みかん・とんぼ・たんぽぽ・マフラー）は正解に使わない（みかんは別例の誤りだけ）。
 * 同一性キー: pick:物 / find:季節:物 / sort:組。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { SortItem } from '../../engines/sort/sort';
import { choiceItem, ill } from './lib';

/** 番号は sort の箱の番号 */
export const SEASONS = [
  { key: 'spring', label: 'はる', illust: 'p4-spring' },
  { key: 'summer', label: 'なつ', illust: 'p4-summer' },
  { key: 'autumn', label: 'あき', illust: 'p4-autumn' },
  { key: 'winter', label: 'ふゆ', illust: 'p4-winter' },
] as const;

/** 誤りの季節の誤概念: 差(mod 4)が 2 ならはんたい、1 か 3 ならとなり */
export const seasonMisconception = (right: number, wrong: number): string =>
  (wrong - right + 4) % 4 === 2 ? 'season-opposite' : 'season-next';

type Obj = 'nature' | 'life';
export interface Thing {
  id: string;
  obj: Obj;
  name: string;
  illust: string;
  season: number;
  wrongSeason: number;
  prompt: string;
  hint2: string;
  explain: string;
}
const T = (
  id: string,
  obj: Obj,
  name: string,
  illust: string,
  season: number,
  wrongSeason: number,
  prompt: string,
  hint2: string,
  explain: string,
): Thing => ({ id, obj, name, illust, season, wrongSeason, prompt, hint2, explain });

export const THINGS: Thing[] = [
  T(
    'cherry',
    'nature',
    'さくら',
    'life-cherry',
    0,
    2,
    'さくらの はなが さくのは どの きせつ？',
    'さむい ふゆが おわって、あたたかく なる ころだよ。',
    'さくらは、あたたかい はるに さくね。',
  ),
  T(
    'tulip',
    'nature',
    'チューリップ',
    'p4-tulip',
    0,
    3,
    'チューリップが さくのは どの きせつ？',
    'あたたかく なって、はなが たくさん さく ころだよ。',
    'チューリップは、はるに さく ことが おおいね。',
  ),
  T(
    'sunflower',
    'nature',
    'ひまわり',
    'p4-sunflower',
    1,
    3,
    'ひまわりが さくのは どの きせつ？',
    'おひさまが ぎらぎら あつい ころだよ。',
    'ひまわりは、あつい なつに さくね。',
  ),
  T(
    'cicada',
    'nature',
    'せみ',
    'p4-cicada',
    1,
    0,
    'せみが なくのは どの きせつ？',
    'みんみん なく、あつい ころだよ。',
    'せみは、あつい なつに なくね。',
  ),
  T(
    'redleaf',
    'nature',
    'もみじ',
    'life-redleaf',
    2,
    0,
    'はっぱが あかや きいろに なるのは どの きせつ？',
    'あつさが おわって、すずしく なる ころだよ。',
    'はっぱの いろが かわるのは、すずしい あきだね。',
  ),
  T(
    'acorn',
    'nature',
    'どんぐり',
    'p4-acorn',
    2,
    1,
    'どんぐりが おちて くるのは どの きせつ？',
    'すずしく なって、きの みが おちる ころだよ。',
    'どんぐりは、あきに おちて くるね。',
  ),
  T(
    'snow',
    'nature',
    'ゆき',
    'life-snowflake',
    3,
    1,
    'ゆきが ふるのは どの きせつ？',
    'いちばん さむい ころだよ。',
    'ゆきは、さむい ふゆに ふるね。',
  ),
  T(
    'ice',
    'nature',
    'こおり',
    'p4-ice',
    3,
    2,
    'いけの みずが こおるのは どの きせつ？',
    'いきが しろく なるほど さむい ころだよ。',
    'みずが こおるのは、さむい ふゆだね。',
  ),
  T(
    'carp',
    'life',
    'こいのぼり',
    'p4-carp-streamer',
    0,
    2,
    'こいのぼりを あげるのは どの きせつ？',
    'あたたかい ころの、こどもの ひの ころだよ。',
    'こいのぼりは、はるの おわりごろに あげるね。',
  ),
  T(
    'bamboo',
    'life',
    'たけのこ',
    'p4-bamboo-shoot',
    0,
    2,
    'たけのこを ほるのは どの きせつ？',
    'あたたかく なって、つちから めが でる ころだよ。',
    'たけのこは、はるに つちから でて くるね。',
  ),
  T(
    'swimring',
    'life',
    'うきわ',
    'life-swimring',
    1,
    3,
    'うきわで みずあそびを するのは どの きせつ？',
    'あつくて、みずに はいると きもちが いい ころだよ。',
    'うきわで あそぶのは、あつい なつだね。',
  ),
  T(
    'watermelon',
    'life',
    'すいか',
    'watermelon',
    1,
    2,
    'すいかが おいしいのは どの きせつ？',
    'あつい ひに、つめたく ひやして たべるよ。',
    'すいかは、あつい なつに おいしいね。',
  ),
  T(
    'kakigori',
    'life',
    'かきごおり',
    'p4-shaved-ice',
    1,
    3,
    'かきごおりを たべたく なるのは どの きせつ？',
    'あつい ひに たべる、つめたい おやつだよ。',
    'かきごおりは、あつい なつに たべたく なるね。',
  ),
  T(
    'potato',
    'life',
    'さつまいも',
    'p4-sweet-potato',
    2,
    0,
    'さつまいもを ほるのは どの きせつ？',
    'すずしく なって、はたけで たくさん とれる ころだよ。',
    'さつまいもは、あきに ほるね。',
  ),
  T(
    'chestnut',
    'life',
    'くり',
    'p4-chestnut',
    2,
    1,
    'くりが おちて くるのは どの きせつ？',
    'いがいがの なかに みが ある。すずしい ころだよ。',
    'くりは、あきに おちて くるね。',
  ),
  T(
    'snowman',
    'life',
    'ゆきだるま',
    'life-snowman',
    3,
    1,
    'ゆきだるまを つくるのは どの きせつ？',
    'ゆきが つもる、さむい ころだよ。',
    'ゆきだるまは、ゆきが ふる ふゆに つくるね。',
  ),
  T(
    'mittens',
    'life',
    'てぶくろ',
    'p4-mittens',
    3,
    1,
    'てぶくろを するのは どの きせつ？',
    'てが つめたく なる、さむい ころだよ。',
    'てぶくろは、さむい ふゆに つかうね。',
  ),
];
export const thing = (id: string): Thing => THINGS.find((t) => t.id === id)!;

const seasonOpt = (n: number) => ({ label: SEASONS[n]!.label, figure: ill(SEASONS[n]!.illust) });

function pickItem(t: Thing): ChoiceItem {
  const id = `pick:${t.id}`;
  return choiceItem({
    id,
    objective: t.obj,
    level: 0,
    prompt: t.prompt,
    figure: ill(t.illust),
    layout: 'row',
    hints: ['その ころは、あたたかい？ あつい？ すずしい？ さむい？', t.hint2],
    explain: t.explain,
    identity: id,
    correct: seasonOpt(t.season),
    wrong: [
      { ...seasonOpt(t.wrongSeason), misconception: seasonMisconception(t.season, t.wrongSeason) },
    ],
  });
}

/** sort の組 */
export const SORTS: { id: string; obj: Obj; cards: string[] }[] = [
  { id: 'n1', obj: 'nature', cards: ['cherry', 'sunflower', 'redleaf', 'snow'] },
  { id: 'n2', obj: 'nature', cards: ['tulip', 'cicada', 'acorn', 'ice'] },
  {
    id: 'n3',
    obj: 'nature',
    cards: ['cherry', 'tulip', 'sunflower', 'cicada', 'redleaf', 'acorn', 'snow', 'ice'],
  },
  { id: 'l1', obj: 'life', cards: ['carp', 'swimring', 'potato', 'mittens'] },
  { id: 'l2', obj: 'life', cards: ['bamboo', 'watermelon', 'chestnut', 'snowman'] },
  {
    id: 'l3',
    obj: 'life',
    cards: ['carp', 'bamboo', 'swimring', 'kakigori', 'potato', 'chestnut', 'snowman', 'mittens'],
  },
];

function sortItem(g: (typeof SORTS)[number]): SortItem {
  const id = `sort:${g.id}`;
  const things = g.cards.map(thing);
  const parts = SEASONS.map((s, n) => {
    const names = things.filter((t) => t.season === n).map((t) => t.name);
    return `${s.label}は ${names.join('と ')}`;
  });
  return {
    engine: 'sort',
    id,
    objective: g.obj,
    level: 1,
    prompt: 'きせつごとに わけよう。',
    boxes: SEASONS.map((s) => ({ label: s.label, figure: ill(s.illust) })),
    cards: things.map((t) => ({
      label: t.name,
      figure: ill(t.illust),
      box: t.season,
      wrongBoxes: [0, 1, 2, 3]
        .filter((b) => b !== t.season)
        .map((b) => ({ box: b, misconception: seasonMisconception(t.season, b) })),
    })),
    hints: [
      'ひとつずつ、いつ みられるか かんがえよう。',
      'わかる ものから いれよう。あつい なつと さむい ふゆは どれかな。',
    ],
    explain: `${parts.join('、')}。`,
    identity: id,
  };
}

/** 別例: 季節 → 絵を選ぶ。誤りの物は THINGS の物か、この問題だけの物（みかん: ふゆ） */
interface Find {
  season: number;
  right: string;
  wrong: string | { name: string; illust: string; season: number };
  obj: Obj;
  prompt: string;
  hint1: string;
  hint2: string;
  explain: string;
}
export const FINDS: Find[] = [
  {
    season: 0,
    right: 'tulip',
    wrong: 'sunflower',
    obj: 'nature',
    prompt: 'はるに さく はなは どっち？',
    hint1: 'はるは あたたかい ころだね。',
    hint2: 'あつい ころに さく はなでは ないよ。',
    explain: 'チューリップは はるに さくね。ひまわりは なつだよ。',
  },
  {
    season: 1,
    right: 'cicada',
    wrong: 'acorn',
    obj: 'nature',
    prompt: 'なつに みられるのは どっち？',
    hint1: 'なつは あつい ころだね。',
    hint2: 'あつい ころに なく ものを さがそう。',
    explain: 'せみは なつに なくね。どんぐりは あきだよ。',
  },
  {
    season: 2,
    right: 'redleaf',
    wrong: 'cherry',
    obj: 'nature',
    prompt: 'あきに みられるのは どっち？',
    hint1: 'あきは すずしい ころだね。',
    hint2: 'はっぱの いろが かわる ころだよ。',
    explain: 'もみじは あきだね。さくらは はるだよ。',
  },
  {
    season: 3,
    right: 'ice',
    wrong: 'sunflower',
    obj: 'nature',
    prompt: 'ふゆに みられるのは どっち？',
    hint1: 'ふゆは さむい ころだね。',
    hint2: 'さむいと できる ものを さがそう。',
    explain: 'こおりは さむい ふゆに できるね。',
  },
  {
    season: 3,
    right: 'mittens',
    wrong: 'swimring',
    obj: 'life',
    prompt: 'ふゆに つかう ものは どっち？',
    hint1: 'ふゆは さむい ころだね。',
    hint2: 'さむい ときに つかう ものを さがそう。',
    explain: 'てぶくろは ふゆに つかうね。うきわは なつだよ。',
  },
  {
    season: 1,
    right: 'kakigori',
    wrong: { name: 'みかん', illust: 'mikan', season: 3 },
    obj: 'life',
    prompt: 'なつに たべたく なるのは どっち？',
    hint1: 'なつは あつい ころだね。',
    hint2: 'つめたい ものを さがそう。',
    explain: 'かきごおりは あつい なつに たべたく なるね。',
  },
  {
    season: 2,
    right: 'potato',
    wrong: 'bamboo',
    obj: 'life',
    prompt: 'あきに ほるのは どっち？',
    hint1: 'あきは すずしい ころだね。',
    hint2: 'はたけで とれる ものだよ。',
    explain: 'さつまいもは あきに ほるね。たけのこは はるだよ。',
  },
  {
    season: 0,
    right: 'carp',
    wrong: 'snowman',
    obj: 'life',
    prompt: 'はるに みられるのは どっち？',
    hint1: 'はるは あたたかい ころだね。',
    hint2: 'こどもの ひの ころに みられる ものだよ。',
    explain: 'こいのぼりは はるに あげるね。ゆきだるまは ふゆだよ。',
  },
];

function findItem(f: Find): ChoiceItem {
  const right = thing(f.right);
  const w = typeof f.wrong === 'string' ? thing(f.wrong) : f.wrong;
  const id = `find:${SEASONS[f.season]!.key}:${f.right}`;
  return choiceItem({
    id,
    objective: f.obj,
    level: 0,
    alt: true,
    prompt: f.prompt,
    figure: ill(SEASONS[f.season]!.illust),
    layout: 'row',
    hints: [f.hint1, f.hint2],
    explain: f.explain,
    identity: id,
    correct: { label: right.name, figure: ill(right.illust) },
    wrong: [
      {
        label: w.name,
        figure: ill(w.illust),
        misconception: seasonMisconception(f.season, w.season),
      },
    ],
  });
}

function build(): Item[] {
  return [...THINGS.map(pickItem), ...SORTS.map(sortItem), ...FINDS.map(findItem)];
}

export const seasons: UnitSpec = {
  id: 'p4.env.seasons',
  title: 'きせつと しぜん',
  stage: 'p4',
  subject: 'env',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'life-cherry',
  prereq: [],
  objectives: [
    { id: 'nature', title: 'きせつの しぜん（はな・むし・き・てんき）' },
    { id: 'life', title: 'きせつの くらし（たべもの・あそび・きるもの）' },
  ],
  misconceptions: [
    {
      id: 'season-next',
      explain: 'となりの きせつと まざったのかな。いちばん よく みられる きせつを かんがえよう。',
    },
    {
      id: 'season-opposite',
      explain:
        'はんたいの きせつと かんがえたのかな。あたたかい・あつい・すずしい・さむい の どの ころか おもいだそう。',
    },
  ],
  levels: [
    { label: '2つから えらぶ', chance: 0.5 },
    { label: '4つの きせつに わける', chance: 1 / 24 },
  ],
  intro: [
    {
      text: 'きせつは、はる・なつ・あき・ふゆ。あたたかい、あつい、すずしい、さむい と かわるよ。',
      figure: {
        kind: 'row',
        items: SEASONS.map((s) => ill(s.illust)),
      },
    },
    {
      text: 'すんで いる ところに よって ちがう ことも あるよ。ここでは よく ある れいで かんがえよう。',
      figure: ill('life-cherry'),
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '幼稚園教育要領 第2章 環境 内容(3)（季節により自然や人間の生活に変化のあることに気付く）・(4)（自然などの身近な事象に関心をもつ）、curriculum-matrix 3.2・4.2。季節の例は一般的な例（地域により違う）',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
