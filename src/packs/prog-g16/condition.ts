/**
 * g1.prog.condition もしも: 条件で行動を分ける（curriculum-matrix 3.4、手引: 分岐）。
 *
 * 到達項目:
 *   if-daily … 「もし ○○なら △△する」を生活の場面で使う（choice）。別例 = 条件と行動を線でむすぶ（match）
 *   if-else  … 「もし ○○なら △△、そうでなければ □□」から行動を決める（choice）。別例 = 条件で分ける（sort）
 *   if-read  … 「もし」の札を読んで、ゴールに着くように直す（program: 条件か動きが違う列を直す）。
 *              別例 = 「もし」の札を使った手順でどこに着くかを選ぶ（choice）
 * 同一性キー: 問題の id。
 * program エンジンは1つの地図でしか確かめないので、「もし」の札を必ず使わせることはできない。
 * そこで if-read は、条件か動きを1か所まちがえた列を最初から並べ、読んで直す形にした。
 */
import type { ChoiceItem, Item, MatchItem, SortItem, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  choiceItem,
  F,
  gridFigure,
  iff,
  landingItem,
  layout,
  L,
  puzzle,
  R,
  times,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';

const MIS: ProgMis = { bump: 'bump', short: 'short', turn: 'turn' };

// ---- if-daily ----
type Q = {
  id: string;
  level: number;
  prompt: string;
  right: string;
  wrongs: [string, string][];
  hints: [string, string, string];
  explain: string;
};
const DAILY: Q[] = [
  {
    id: 'ame',
    level: 0,
    prompt: 'もし あめが ふって いたら、そとへ でる ときに どうするかな。',
    right: 'かさを さす',
    wrongs: [
      ['かさを もたずに いく', 'cond-reverse'],
      ['ぼうしだけ かぶる', 'cond-ignore'],
    ],
    hints: [
      '「もし」の あとに かいて ある ことが、いまの ようすに あうか みよう。',
      'あめの ひに ぬれないように する ものは なにかな。',
      'あめが ふって いるとき、からだや かみが ぬれないように てに もつ ものだよ。',
    ],
    explain: '「もし あめなら かさを さす」。あめが ふって いるから、かさを さすよ。',
  },
  {
    id: 'shingou',
    level: 0,
    prompt: 'もし しんごうが あかなら、どうするかな。',
    right: 'とまる',
    wrongs: [
      ['いそいで わたる', 'cond-reverse'],
      ['まわりを みないで すすむ', 'cond-ignore'],
    ],
    hints: [
      'あかい しんごうは、なにを あらわして いるかな。',
      'くるまが とおる みちで、あかは だいじな あいずだよ。',
      'あかい ときは、あしを どう するか かんがえよう。',
    ],
    explain: '「もし しんごうが あかなら とまる」。あかい ときは とまって まつ きまりだよ。',
  },
  {
    id: 'korobu',
    level: 0,
    prompt: 'もし ともだちが ころんで ないて いたら、どうするかな。',
    right: '「だいじょうぶ？」と こえを かける',
    wrongs: [
      ['みなかった ことに する', 'cond-ignore'],
      ['わらって とおりすぎる', 'cond-reverse'],
    ],
    hints: [
      'ともだちが いま どんな ようすか みてみよう。',
      'こまっている ともだちには、やさしい ことばが うれしいね。',
      'ちかくに おとなが いたら、いっしょに よんでも いいよ。',
    ],
    explain:
      '「もし ともだちが ないて いたら こえを かける」。こまっている ともだちには、まず こえを かけて あげよう。',
  },
  {
    id: 'te',
    level: 1,
    prompt: 'もし てが よごれて いたら、ごはんの まえに どうするかな。',
    right: 'てを あらう',
    wrongs: [
      ['そのまま たべる', 'cond-ignore'],
      ['てを ポケットに いれる', 'cond-reverse'],
    ],
    hints: [
      'てが よごれて いるか、どうかを まず たしかめよう。',
      'よごれた てで たべると、おなかが いたく なる ことが あるよ。',
      'みずと せっけんを つかう ことだよ。',
    ],
    explain: '「もし てが よごれて いたら あらう」。よごれた てで たべない ために、てを あらうよ。',
  },
  {
    id: 'gomi',
    level: 1,
    prompt: 'もし ちいさな ごみが おちて いたら、どうするかな。',
    right: 'ひろって ごみばこに すてる',
    wrongs: [
      ['そのまま ふんで いく', 'cond-ignore'],
      ['もっと ちらかす', 'cond-reverse'],
    ],
    hints: [
      'おちて いるものが ごみか どうか みてみよう。',
      'ごみは、すてる ばしょが きまって いるよ。',
      'ひろったら どこへ いれるかな。',
    ],
    explain: '「もし ごみが おちて いたら ごみばこに すてる」。みんなの ばしょが きれいに なるよ。',
  },
  {
    id: 'denki',
    level: 1,
    prompt: 'もし だれも いない へやの でんきが ついて いたら、どうするかな。',
    right: 'でんきを けす',
    wrongs: [
      ['つけたままに する', 'cond-ignore'],
      ['もっと あかるく する', 'cond-reverse'],
    ],
    hints: [
      'へやに ひとが いるか、いないか みてみよう。',
      'つかって いない でんきは、むだに ひかっているね。',
      'スイッチを どうするかな。',
    ],
    explain: '「もし だれも いない なら でんきを けす」。つかって いない でんきは けして おこう。',
  },
  {
    id: 'sensei',
    level: 2,
    prompt: 'もし せんせいが「あつまって」と よんだら、どうするかな。',
    right: 'せんせいの ところへ いく',
    wrongs: [
      ['そのまま あそびつづける', 'cond-ignore'],
      ['はんたいへ はしる', 'cond-reverse'],
    ],
    hints: [
      'せんせいが なにを いったか きこう。',
      'よばれたら、まず だれの ほうを むくかな。',
      'あつまる ばしょは どこかな。',
    ],
    explain: '「もし せんせいが よんだら ちかくへ いく」。よばれたら、せんせいの ところへ あつまるよ。',
  },
];

const dailyItems = DAILY.map((q) =>
  choiceItem({
    id: `daily-${q.id}`,
    obj: 'if-daily',
    level: q.level,
    prompt: q.prompt,
    right: q.right,
    wrongs: q.wrongs,
    layout: 'column',
    hints: q.hints,
    explain: q.explain,
  }),
);

// 別例: 条件と行動をむすぶ
interface Mt {
  id: string;
  level: number;
  prompt: string;
  left: string[];
  right: string[];
  pairs: [number, number][];
  wrong: { pair: [number, number]; misconception: string }[];
  hints: [string, string, string];
  explain: string;
}
const MATCHES: Mt[] = [
  {
    id: 'weather',
    level: 0,
    prompt: 'もし ○○なら、△△。ただしい くみあわせを せんで むすぼう。',
    left: ['あめの ひ', 'あつい ひ', 'さむい ひ'],
    right: ['かさを さす', 'ぼうしを かぶる', 'てぶくろを する', 'ながぐつを ぬぐ'],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrong: [
      { pair: [1, 2], misconception: 'cond-reverse' },
      { pair: [2, 1], misconception: 'cond-reverse' },
    ],
    hints: [
      'ひだりの ひを ひとつ えらんで、どんな ようすか おもいうかべよう。',
      'そのとき、からだを まもる ものは なにかな。',
      'あつい ひは ひざしから あたまを まもる、さむい ひは てが つめたく なるね。',
    ],
    explain:
      'あめの ひは かさ、あつい ひは ぼうし、さむい ひは てぶくろ。そのひの ようすに あわせて えらぶよ。',
  },
  {
    id: 'road',
    level: 1,
    prompt: 'もし ○○なら、△△。ただしい くみあわせを せんで むすぼう。',
    left: ['しんごうが あか', 'しんごうが あお', 'ともだちが よぶ'],
    right: ['まつ', 'まわりを みて わたる', 'へんじを する', 'はしって にげる'],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrong: [
      { pair: [0, 1], misconception: 'cond-reverse' },
      { pair: [1, 0], misconception: 'cond-reverse' },
    ],
    hints: [
      'ひだりを ひとつ えらんで、そのとき どうするか かんがえよう。',
      'あかい ときと あおい ときは、はんたいの うごきだよ。',
      'あおい ときも、くるまが とまったか まわりを みるよ。',
    ],
    explain:
      'あかなら まつ、あおなら まわりを みて わたる、ともだちが よんだら へんじを する。じょうけんに よって うごきが かわるよ。',
  },
  {
    id: 'body',
    level: 1,
    prompt: 'もし ○○なら、△△。ただしい くみあわせを せんで むすぼう。',
    left: ['おなかが すいた', 'ねむい', 'てが よごれた'],
    right: ['ごはんを たべる', 'ふとんで ねる', 'てを あらう', 'さんぽに いく'],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrong: [
      { pair: [0, 2], misconception: 'cond-reverse' },
      { pair: [1, 0], misconception: 'cond-reverse' },
    ],
    hints: [
      'ひだりの ようすを ひとつ えらんで、からだが どうして ほしいか かんがえよう。',
      'おなかが すいた ときに ほしい ものと、ねむい ときに ほしい ものは ちがうね。',
      'よごれた ときは、きれいに する ことを かんがえよう。',
    ],
    explain: 'おなかが すいたら たべる、ねむいなら ねる、てが よごれたら あらう。ようすに あう ことを えらぶよ。',
  },
];
const matchItems = MATCHES.map(
  (m): MatchItem => ({
    engine: 'match',
    id: `daily-alt-${m.id}`,
    objective: 'if-daily',
    level: m.level,
    alt: true,
    prompt: m.prompt,
    left: m.left.map((label) => ({ label })),
    right: m.right.map((label) => ({ label })),
    pairs: m.pairs,
    wrongPairs: m.wrong,
    hints: m.hints,
    explain: m.explain,
    identity: `daily-alt-${m.id}`,
  }),
);

// ---- if-else ----
// 画面の高さに入るように、きまり（1行）・いまの ようす（1行）・みじかい 選択肢（7字まで）にした。
interface Ie {
  id: string;
  level: number;
  rule: string;
  now: string;
  right: string;
  wrong: string;
  extra: string;
  hints: [string, string, string];
  explain: string;
}
const ELSE: Ie[] = [
  {
    id: 'ame-hare',
    level: 1,
    rule: 'もし あめなら かさ。そうでなければ ぼうし。',
    now: 'いま、そらは はれて います。どう するかな。',
    right: 'ぼうし',
    wrong: 'かさ',
    extra: 'なにも しない',
    hints: [
      'いまの ようすを みて、「あめ」に あてはまるか かんがえよう。',
      'はれて いるなら、「あめなら」は あてはまらないね。',
      '「あめ」に あてはまらない ときは、「そうでなければ」の ほうを よむよ。',
    ],
    explain: 'はれて いるから「あめなら」は あてはまらないよ。「そうでなければ」の ぼうしを えらぶよ。',
  },
  {
    id: 'shingou-aka',
    level: 1,
    rule: 'もし しんごうが あおなら わたる。そうでなければ まつ。',
    now: 'いま、しんごうは あかです。どう するかな。',
    right: 'まつ',
    wrong: 'わたる',
    extra: 'はしって わたる',
    hints: [
      'しんごうの いろを みよう。「あお」と おなじかな。',
      'あかは「あお」では ないね。',
      'あおでは ないとき、どちらを よむかな。',
    ],
    explain: 'しんごうは あかで、あおでは ないよ。だから「そうでなければ」の まつを えらぶよ。',
  },
  {
    id: 'samui',
    level: 1,
    rule: 'もし さむいなら うわぎを きる。そうでなければ ぬぐ。',
    now: 'いま、へやは あつい くらいです。どう するかな。',
    right: 'ぬぐ',
    wrong: 'きる',
    extra: 'マフラーを まく',
    hints: [
      'いまの へやは さむいかな、あついかな。',
      '「さむい」に あてはまるか どうか かんがえよう。',
      'あついなら、「さむいなら」では ないね。',
    ],
    explain: 'いまは あついから「さむいなら」は あてはまらないよ。「そうでなければ」の ぬぐを えらぶよ。',
  },
  {
    id: 'gohan',
    level: 2,
    rule: 'もし ごはんの じかんなら たべる。そうでなければ あそぶ。',
    now: 'いま、ごはんの じかんです。どう するかな。',
    right: 'たべる',
    wrong: 'あそぶ',
    extra: 'ねる',
    hints: [
      'いま ごはんの じかんかどうか、よく よもう。',
      'ごはんの じかんなら、「もし」の ほうが あてはまるね。',
      '「もし」が あてはまる ときは、そのあとの うごきを するよ。',
    ],
    explain: 'いまは ごはんの じかんだから「もし」の ほうだよ。たべるを えらぶよ。',
  },
  {
    id: 'onaka',
    level: 2,
    rule: 'もし おなかが すいたら おやつ。そうでなければ ほんを よむ。',
    now: 'いま、おなかが ぺこぺこです。どう するかな。',
    right: 'おやつ',
    wrong: 'ほんを よむ',
    extra: 'おふろ',
    hints: [
      'いま おなかは すいているかな。',
      '「おなかが すいた」に あてはまるなら、「もし」の ほうだよ。',
      '「もし」が あてはまる ときは、そのあとに かいてある ことを するよ。',
    ],
    explain: 'いまは おなかが すいているから「もし」の ほうだよ。おやつを えらぶよ。',
  },
  {
    id: 'kaminari',
    level: 2,
    rule: 'もし かみなりなら うちに はいる。そうでなければ あそぶ。',
    now: 'いま、ごろごろ かみなりが なって います。どう するかな。',
    right: 'うちに はいる',
    wrong: 'あそぶ',
    extra: 'きの したへ いく',
    hints: [
      'いま かみなりが なっているか、きこう。',
      'なっているなら、「もし」の ほうが あてはまるね。',
      '「もし」が あてはまるときは、そのあとの うごきを するよ。',
    ],
    explain: 'いまは かみなりが なって いるよ。「もし」の ほうだから、うちに はいるよ。あぶない ときは そとから はなれよう。',
  },
  {
    id: 'ao-hare',
    level: 0,
    rule: 'もし ひるまなら おひさま。そうでなければ ほしを みる。',
    now: 'いま、まっくらで ほしが ひかって います。どう するかな。',
    right: 'ほしを みる',
    wrong: 'おひさま',
    extra: 'ひなたぼっこ',
    hints: [
      'そらの ようすを みよう。ひるまかな、よるかな。',
      'くらい そらに ほしが ひかって いるね。「ひるま」に あてはまるかな。',
      '「ひるま」に あてはまらない ときは、「そうでなければ」を よむよ。',
    ],
    explain: 'いまは よるだから「ひるまなら」は あてはまらないよ。「そうでなければ」の ほしを みるを えらぶよ。',
  },
];
const elseItems: ChoiceItem[] = ELSE.map((q) =>
  choiceItem({
    id: `else-${q.id}`,
    obj: 'if-else',
    level: q.level,
    prompt: `${q.rule}\n${q.now}`,
    right: q.right,
    wrongs: [
      [q.wrong, 'ifelse-swap'],
      [q.extra, 'cond-ignore'],
    ],
    hints: q.hints,
    explain: q.explain,
  }),
);
// 別例: 条件で分ける
interface Sr {
  id: string;
  level: number;
  prompt: string;
  boxes: [string, string];
  a: string[];
  b: string[];
  hints: [string, string, string];
  explain: string;
}
const SORTS: Sr[] = [
  {
    id: 'ame-hare',
    level: 1,
    prompt: 'あめの ひに する ことと、はれの ひに する ことに わけよう。',
    boxes: ['あめの ひ', 'はれの ひ'],
    a: ['かさを さす', 'ながぐつを はく', 'かっぱを きる'],
    b: ['ぼうしを かぶる', 'せんたくものを そとに ほす', 'すなばで あそぶ'],
    hints: [
      'カードを ひとつ えらんで、どんな ひの ことか かんがえよう。',
      'ぬれない ために する ことは、あめの ひだね。',
      'そとで ひなたに でて する ことは、はれの ひだよ。',
    ],
    explain: 'かさ・ながぐつ・かっぱは、ぬれない ための ものだから あめの ひ。ぼうし・せんたく・すなばは はれの ひだよ。',
  },
  {
    id: 'atsui-samui',
    level: 2,
    prompt: 'あつい ひに する ことと、さむい ひに する ことに わけよう。',
    boxes: ['あつい ひ', 'さむい ひ'],
    a: ['つめたい むぎちゃを のむ', 'はんそでを きる', 'うちわで あおぐ'],
    b: ['てぶくろを する', 'マフラーを まく', 'あたたかい スープを のむ'],
    hints: [
      'カードを ひとつ えらんで、からだが あつく なるか さむく なるか かんがえよう。',
      'からだを ひやす ことは、あつい ひに したい ことだね。',
      'からだを あたためる ことは、さむい ひに したい ことだよ。',
    ],
    explain: 'ひやす ものは あつい ひ、あたためる ものは さむい ひ。いまの ようすに あわせて えらんでいるよ。',
  },
  {
    id: 'hiru-yoru',
    level: 0,
    prompt: 'ひるまに する ことと、よるに する ことに わけよう。',
    boxes: ['ひるま', 'よる'],
    a: ['こうえんで あそぶ', 'がっこうで べんきょう', 'おひさまを あびる'],
    b: ['ほしを みる', 'ふとんで ねる', 'でんきを けす'],
    hints: [
      'カードを ひとつ えらんで、あかるい ときか くらい ときか かんがえよう。',
      'そらに ほしが ひかるのは、いつかな。',
      'ふとんに はいって ねるのは、いつかな。',
    ],
    explain: 'そとで あそんだり べんきょうしたり するのは ひるま、ほしを みたり ねたり するのは よるだよ。',
  },
];
/** 画面に入るよう、カードは 箱ごとに 文字の少ない 2枚だけ 出す（箱 13u ＋ カード 2段） */
const fewest = (xs: string[]) => [...xs].sort((p, q) => p.length - q.length).slice(0, 2);
const sortItems = SORTS.map(
  (s): SortItem => ({
    engine: 'sort',
    id: `else-alt-${s.id}`,
    objective: 'if-else',
    level: s.level,
    alt: true,
    prompt: s.prompt,
    boxes: s.boxes.map((label) => ({ label })),
    cards: [
      ...fewest(s.a).map((label) => ({ label, box: 0, wrongBoxes: [{ box: 1, misconception: 'ifelse-swap' }] })),
      ...fewest(s.b).map((label) => ({ label, box: 1, wrongBoxes: [{ box: 0, misconception: 'ifelse-swap' }] })),
    ],
    hints: s.hints,
    explain: s.explain,
    identity: `else-alt-${s.id}`,
  }),
);

// ---- if-read ----
type Rd = [id: string, level: number, dir: Dir, rows: string[], a: number, turn: 'R' | 'L', b: number, bug: 'cond' | 'body'];
const READS: Rd[] = [
  ['r1', 1, 'right', ['S..', '..G'], 2, 'R', 1, 'cond'],
  ['r2', 1, 'left', ['..S', '...', 'G..'], 2, 'L', 2, 'body'],
  ['r3', 1, 'right', ['S...', '...G'], 3, 'R', 1, 'cond'],
  ['r4', 2, 'up', ['G..', '...', '..S'], 2, 'L', 2, 'body'],
  ['r5', 2, 'right', ['S.#', '.G.'], 1, 'R', 1, 'cond'],
  ['r6', 2, 'right', ['.#G', 'S..'], 2, 'L', 1, 'body'],
  ['r7', 2, 'right', ['S....', '....G'], 4, 'R', 1, 'cond'],
  ['r8', 2, 'up', ['G....', '.....', '....S'], 2, 'L', 4, 'body'],
];
const readItems = READS.map(([id, level, dir, rows, a, turn, b, bug]) => {
  const t = turn === 'R' ? R : L;
  const other = turn === 'R' ? L : R;
  const good: Cmd[] = [...times(a, F), iff('wall-ahead', t), ...times(b, F)];
  // 一か所まちがえた列: 条件を「まえが あいていたら」に、または まがる むきを はんたいに
  const initial: Cmd[] =
    bug === 'cond'
      ? [...times(a, F), iff('open-ahead', t), ...times(b, F)]
      : [...times(a, F), iff('wall-ahead', other), ...times(b, F)];
  const wallWord = 'まえが かべなら';
  const turnWord = turn === 'R' ? 'みぎ' : 'ひだり';
  return puzzle({
    id: `read-${id}`,
    obj: 'if-read',
    level,
    rows,
    dir,
    solution: good,
    initial,
    palette: ['forward', 'turnRight', 'turnLeft', 'if'],
    conds: ['wall-ahead', 'open-ahead'],
    lead: 'うまく いかない ふだを なおして、ゴールへ いこう。',
    note: '「もし」の ふだの みぎの ちいさな ふだを おすと、じょうけんが かわるよ。',
    hints:
      bug === 'cond'
        ? [
            'うごかして、キャラクターが どこで うまく いかないか みよう。',
            '「もし」の ふだは、じょうけんが あてはまった ときだけ、なかの ふだを うごかすよ。',
            `かべに ぶつかりそうな ところで ${turnWord}を むきたいよ。じょうけんは「${wallWord}」と「まえが あいていたら」の どちらかな。`,
          ]
        : [
            'うごかして、キャラクターが どこで うまく いかないか みよう。',
            'ゴールは どちらに あるかな。まがる ところで どちらを むけば ちかづくかな。',
            `かべの まえで ${turnWord}を むくと ゴールの ほうへ いけるよ。なかの ふだを みてみよう。`,
          ],
    why: `「${wallWord} ${turnWord}を むく」と かくと、かべの まえで だけ まがるよ。「もし」の ふだは じょうけんを よんで つかおう。`,
    mis: MIS,
  });
});

// 別例: 「もし」の札を使った手順で、どこに着くか
const readLandings = [
  landingItem({
    id: 'read-alt-ln1',
    obj: 'if-read',
    level: 1,
    alt: true,
    rows: ['.....', 'S.#..', '.....', '.....'],
    dir: 'right',
    prog: [F, iff('wall-ahead', R), F],
    mis: { turn: 'turn', short: 'short', count: 'miscount', cond: 'cond-ignore' },
  }),
  landingItem({
    id: 'read-alt-ln2',
    obj: 'if-read',
    level: 1,
    alt: true,
    rows: ['.....', '.....', '.....', 'S....'],
    dir: 'right',
    prog: [F, iff('open-ahead', L), F, F],
    mis: { turn: 'turn', short: 'short', count: 'miscount', cond: 'cond-ignore' },
  }),
  landingItem({
    id: 'read-alt-ln3',
    obj: 'if-read',
    level: 2,
    alt: true,
    rows: ['.....', '.....', 'S..#.', '.....'],
    dir: 'right',
    prog: [F, F, iff('wall-ahead', L), F],
    mis: { turn: 'turn', short: 'short', count: 'miscount', cond: 'cond-ignore' },
  }),
];

const items: Item[] = [
  ...dailyItems,
  ...matchItems,
  ...elseItems,
  ...sortItems,
  ...readItems,
  ...readLandings,
];

const introGrid = gridFigure(layout(['S..', '..G'], 'right'), { label: 'ますの ず。ほしが ゴール' });

export const condition: UnitSpec = {
  ...baseUnit('g1.prog.condition', 'g1'),
  title: 'もし ○○なら',
  prereq: ['g1.prog.sequence'],
  objectives: [
    { id: 'if-daily', title: '「もし ○○なら △△」を せいかつで つかう' },
    { id: 'if-else', title: '「そうでなければ」で どちらを するか きめる' },
    { id: 'if-read', title: '「もし」の ふだを よんで、てじゅんを なおす' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'cond-reverse',
      explain:
        'じょうけんと はんたいの うごきを えらんだのかな。「もし」の あとの ようすを よく よんで、あてはまる うごきを えらぼう。',
    },
    {
      id: 'cond-ignore',
      explain:
        'じょうけんを みないで えらんだのかな。いまの ようすが「もし」に あてはまるか、まず たしかめよう。',
    },
    {
      id: 'ifelse-swap',
      explain:
        '「もし」と「そうでなければ」を とりちがえたのかな。あてはまる ときは「もし」、あてはまらない ときは「そうでなければ」だよ。',
    },
    {
      id: 'miscount',
      explain: 'マスの かずを かぞえまちがえたのかな。ふだを ひとつずつ ゆびで たどって みよう。',
    },
  ],
  levels: [
    { label: 'せいかつの もしも', chance: 0.1 },
    { label: 'もし と そうでなければ', chance: 0.1 },
    { label: '「もし」の ふだを よむ', chance: 0.1 },
  ],
  intro: [
    {
      text: '「もし あめなら かさを さす」。ようすが あてはまる ときだけ、あとの ことを するよ。',
      figure: { kind: 'text', text: 'もし あめなら → かさを さす', size: 'l' },
    },
    {
      text: 'あてはまらない ときは、「そうでなければ」の ほうを するよ。',
      figure: { kind: 'text', text: 'もし あめなら かさ、そうでなければ ぼうし', size: 'l' },
    },
    {
      text: 'プログラムの「もし」の ふだも おなじだよ。「まえが かべなら みぎを むく」は、かべの まえで だけ みぎを むくよ。',
      figure: introGrid,
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）プログラミング的思考（条件分岐）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};




