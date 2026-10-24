/**
 * g6.prog.sensor 条件で動く道具（もし暗ければライトを点ける）（curriculum-matrix 3.8、手引A・理科6年 電気の利用）。
 *
 * 到達項目:
 *   rule-action … センサーが調べること（条件）と、はたらき（動作）を結びつける（choice）。別例 = 文の空欄に入れる（fill）
 *   change      … 条件の決まりを変えると動作が変わる。ロボットの前のセンサー（かべがあるか）で動く手順を直す（program）。
 *                 別例 = 手順でどこに着くかを選ぶ（choice）
 *   save        … 電気のむだを減らす決まりを選ぶ（表を読んで、2つの条件で動かす）（choice）。別例 = 動く時間を数える（number）
 * 理科6年「電気の利用」（g6.sci.electricity-use）と連携する内容だが、このパックは他のパックを import しない。
 * 同一性キー: 問題の id。
 * 表のデータは例のデータ（id から決まる乱数。答えは表から計算して決める）。
 */
import { createRng, hashSeed } from '../../core/util/rng';
import type { ChoiceItem, FillItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import {
  baseUnit,
  BASE_MIS,
  choiceItem,
  F,
  gridFigure,
  iff,
  landingItem,
  layout,
  puzzle,
  R,
  rep,
  type Cmd,
  type ProgMis,
} from './kit';
import { PALETTE, sp, TIMES, type Mp } from './condition-combo';

const MIS: ProgMis = {
  bump: 'bump',
  short: 'short',
  turn: 'turn',
  repeatCount: 'repeat-count',
  tooMany: 'too-many',
};

// ---- rule-action ----
interface Ra {
  id: string;
  level: number;
  prompt: string;
  right: string;
  wrongs: [string, string][];
  hints: [string, string, string];
  explain: string;
}
const RA: Ra[] = [
  {
    id: 'ra1',
    level: 0,
    prompt: 'センサーライトは、まわりが くらくなると ひかるよ。この ライトの センサーは、なにを しらべて いるかな。',
    right: '明《あか》るさ',
    wrongs: [
      ['おと', 'sensor-kind'],
      ['におい', 'sensor-kind'],
    ],
    hints: [
      'ライトが ひかるのは、どんな ときかな。',
      '「くらくなると」と あるね。くらい・あかるいは なにの ちがいかな。',
      'ライトは、まわりが どれくらい あかるいかを しらべて いるよ。',
    ],
    explain: 'センサーライトは、まわりの 明《あか》るさを しらべて、くらい ときに ひかるよ。',
  },
  {
    id: 'ra2',
    level: 0,
    prompt: 'じどうドアは、ひとが ちかづくと ひらくよ。ドアの センサーは、なにを しらべて いるかな。',
    right: '人《ひと》が いるか どうか',
    wrongs: [
      ['明《あか》るさ', 'sensor-kind'],
      ['おんど', 'sensor-kind'],
    ],
    hints: [
      'ドアが ひらくのは、どんな ときかな。',
      '「ちかづくと」と あるね。だれが ちかづくのかな。',
      'ドアの まえに ひとが いるか、いないかを しらべて いるよ。',
    ],
    explain: 'じどうドアは、人《ひと》が ちかづいたかを しらべる センサーで うごくよ。',
  },
  {
    id: 'ra3',
    level: 0,
    prompt: 'エアコンは、へやが あつく なると れいぼうを はじめるよ。エアコンの センサーは、なにを しらべて いるかな。',
    right: 'おんど',
    wrongs: [
      ['おと', 'sensor-kind'],
      ['人《ひと》の かず', 'sensor-kind'],
    ],
    hints: [
      'あつい・すずしいは、なにの ちがいかな。',
      'へやの あつさを あらわす 数《かず》が あるよ。',
      '「28ど」のように、へやの おんどを はかる センサーだよ。',
    ],
    explain: 'エアコンは、へやの おんどを はかって、あつい ときに れいぼうを つけるよ。',
  },
  {
    id: 'ra4',
    level: 0,
    prompt: 'もし くらい なら ライトを つける。いま、まわりは あかるいよ。ライトは どうなるかな。',
    right: 'つかない',
    wrongs: [
      ['つく', 'cond-ignore'],
      ['ついたり きえたり する', 'cond-ignore'],
    ],
    hints: [
      '「もし」の あとの ようすが、いま あてはまるかを たしかめよう。',
      'いまは「くらい」かな、「あかるい」かな。',
      'あてはまらない ときは、「つける」はたらきは おこらないよ。',
    ],
    explain: '「くらい なら つける」だから、あかるい いまは つかないよ。条件《じょうけん》に あてはまった ときだけ はたらくんだね。',
  },
  {
    id: 'ra5',
    level: 1,
    prompt: 'もし ひとが ちかづいたら ドアが ひらく。だれも ちかづかない とき、ドアは どうなるかな。',
    right: 'しまったまま',
    wrongs: [
      ['ひらく', 'cond-ignore'],
      ['ひらいたり しまったり する', 'cond-ignore'],
    ],
    hints: [
      '「ひとが ちかづいたら」が いま あてはまるかな。',
      'だれも ちかづいて いないよ。',
      'あてはまらない ときは、ドアは そのままの すがただよ。',
    ],
    explain: '人《ひと》が ちかづいた ときだけ ひらくから、だれも いない ときは しまった ままだよ。',
  },
  {
    id: 'ra6',
    level: 1,
    prompt: 'もし へやが あつく なったら せんぷうきが まわる。いま、へやは すずしいよ。せんぷうきは どうなるかな。',
    right: 'とまっている',
    wrongs: [
      ['まわる', 'cond-ignore'],
      ['はやく まわる', 'cond-ignore'],
    ],
    hints: [
      '「あつく なったら」が いま あてはまるか たしかめよう。',
      'いま、へやは すずしいね。',
      'あてはまらないなら、せんぷうきは はたらかないよ。',
    ],
    explain: 'あつい ときだけ まわるから、すずしい いまは とまっているよ。',
  },
  {
    id: 'ra7',
    level: 1,
    prompt: 'もし くらい なら ライトを つける。そうでなければ ライトを けす。いま、ひるまで あかるいよ。ライトは どうなるかな。',
    right: 'きえている',
    wrongs: [
      ['ついている', 'ifelse-swap'],
      ['ちかちか する', 'cond-ignore'],
    ],
    hints: [
      'いま「くらい」かどうかを たしかめよう。',
      'ひるまは あかるいね。「くらい」には あてはまらないよ。',
      'あてはまらない ときは「そうでなければ」の ほうの はたらきを するよ。',
    ],
    explain: 'あかるい ひるまは「くらい」に あてはまらないから、「そうでなければ けす」の ほうで、ライトは きえるよ。',
  },
  {
    id: 'ra8',
    level: 1,
    prompt: 'ワイパーは、あめが ふると うごくよ。いま あめが ふって いるよ。ワイパーは どうなる？',
    right: 'うごく',
    wrongs: [
      ['とまったまま', 'cond-reverse'],
      ['はんたいに まわる', 'cond-ignore'],
    ],
    hints: [
      'センサーは なにを しらべるのかな。',
      'いま、あめが ふって いるね。条件《じょうけん》に あてはまるかな。',
      'あてはまる ときは、きまった はたらきを するよ。',
    ],
    explain: 'あめが ふると うごく きまりで、いま あめが ふって いるから、ワイパーは うごくよ。',
  },
];
const raItems: ChoiceItem[] = RA.map((q) =>
  choiceItem({
    id: `ra-${q.id}`,
    obj: 'rule-action',
    level: q.level,
    prompt: q.prompt,
    right: q.right,
    wrongs: q.wrongs,
    layout: 'column',
    hints: q.hints,
    explain: q.explain,
  }),
);

// 別例: 文の空欄に入れる
interface Fl {
  id: string;
  level: number;
  text: string;
  options: [string, string, string, string];
  answers: [string, string];
  wrong: [[string, string], [string, string]];
  hints: [string, string, string];
  explain: string;
}
const FL: Fl[] = [
  {
    id: 'f1',
    level: 0,
    text: 'もし まわりが {{}} なら、ライトを {{}}。',
    options: ['くらい', '明《あか》るい', 'つける', 'けす'],
    answers: ['くらい', 'つける'],
    wrong: [
      ['明《あか》るい', 'cond-reverse'],
      ['けす', 'cond-reverse'],
    ],
    hints: [
      'ライトが ひかって ほしいのは、どんな ときかな。',
      '「もし」の ところには、まわりの ようすが はいるよ。',
      'つぎの ところには、ライトに させる ことが はいるよ。',
    ],
    explain: '「もし まわりが くらいなら、ライトを つける」。ようすが くらい ときに ライトを つけるんだね。',
  },
  {
    id: 'f2',
    level: 0,
    text: 'もし ひとが {{}} と、ドアが {{}}。',
    options: ['ちかづく', 'はなれる', 'ひらく', 'しまる'],
    answers: ['ちかづく', 'ひらく'],
    wrong: [
      ['はなれる', 'cond-reverse'],
      ['しまる', 'cond-reverse'],
    ],
    hints: [
      'ドアが ひらいて ほしいのは、ひとが どう うごいた ときかな。',
      '「もし」の ところには、センサーが しらべる ことが はいるよ。',
      'つぎの ところには、ドアが する ことが はいるよ。',
    ],
    explain: '「もし ひとが ちかづくと、ドアが ひらく」。ちかづいた ときに ひらくんだね。',
  },
  {
    id: 'f3',
    level: 1,
    text: 'もし へやの おんどが {{}} なら、エアコンで {{}}。',
    options: ['たかい', 'ひくい', 'れいぼうする', 'だんぼうする'],
    answers: ['たかい', 'れいぼうする'],
    wrong: [
      ['ひくい', 'cond-reverse'],
      ['だんぼうする', 'cond-reverse'],
    ],
    hints: [
      'エアコンで れいぼうを したいのは、へやが あつい ときだよ。',
      '「もし」の ところには、おんどの ようすが はいるよ。',
      'あつい ときに することと、さむい ときに する ことを くらべよう。',
    ],
    explain: '「もし おんどが たかいなら、れいぼうする」。あつい ときに へやを すずしく するよ。',
  },
];
const flItems: FillItem[] = FL.map((q) => ({
  engine: 'fill',
  id: `ra-alt-${q.id}`,
  objective: 'rule-action',
  level: q.level,
  alt: true,
  prompt: '「もし ○○なら、△△」の ○○と △△に あてはまる ことばを えらぼう。',
  text: q.text,
  options: q.options,
  blanks: [
    { answers: [q.answers[0]], options: [q.options[0], q.options[1]], wrong: [{ value: q.wrong[0][0], misconception: q.wrong[0][1] }] },
    { answers: [q.answers[1]], options: [q.options[2], q.options[3]], wrong: [{ value: q.wrong[1][0], misconception: q.wrong[1][1] }] },
  ],
  hints: q.hints,
  explain: q.explain,
  identity: `ra-alt-${q.id}`,
}));

// ---- change ----
type Rule2Bug = 'swap' | 'turn' | 'noturn' | 'count';
const TURN2 = { R, L: { op: 'turnLeft' } as Cmd };
/** ずっと くりかえす: もし まえが あいていたら すすむ、もし まえが かべなら まがる */
const rule2 = (t: 'R' | 'L'): Cmd[] => [
  rep('goal', iff('open-ahead', F), iff('wall-ahead', TURN2[t])),
];
function bug2(t: 'R' | 'L', bug: Rule2Bug): Cmd[] {
  const ok = TURN2[t];
  const bad = t === 'R' ? TURN2.L : R;
  switch (bug) {
    case 'swap':
      return [rep('goal', iff('wall-ahead', F), iff('open-ahead', ok))];
    case 'turn':
      return [rep('goal', iff('open-ahead', F), iff('wall-ahead', bad))];
    case 'noturn':
      return [rep('goal', iff('open-ahead', F))];
    case 'count':
      return [rep(6, iff('open-ahead', F), iff('wall-ahead', ok))];
  }
}
const H2: Record<Rule2Bug, [string, string, string]> = {
  swap: [
    'うごかして、ロボットが どこで うまく いかないか みよう。',
    'ロボットは、まえが あいている とき すすみ、まえが かべの とき まがりたいよ。じょうけんを 読《よ》もう。',
    '「すすむ」の ふだの じょうけんと、「まがる」の ふだの じょうけんが、入《い》れかわって いないかな。',
  ],
  turn: [
    'うごかして、ロボットが どこで かべに ぶつかるか みよう。',
    'みちは みぎと ひだり、どちらに まがっているかな。',
    '「まえが かべなら」の なかの まがる むきを、みちに あわせよう。',
  ],
  noturn: [
    'うごかして、ロボットが かべの まえで どうなるか みよう。',
    'まえが あいていれば すすめるけれど、かべに ついたら どうするのかな。',
    'かべに ついた ときの ふだが たりないよ。もう ひとつ「もし」の ふだが いるね。',
  ],
  count: [
    'うごかして、ゴールの てまえで とまらないか みよう。',
    'くりかえす かいすうが たりないよ。',
    'かいすうを かぞえるより、「つくまで」に かえる ほうが かんたんだよ。',
  ],
};
const CHANGES: [string, number, Mp, Rule2Bug][] = [
  ['c1', 1, sp(4, 3), 'swap'],
  ['c2', 1, sp(5, 3, true), 'turn'],
  ['c3', 1, sp(4, 4), 'noturn'],
  ['c4', 1, sp(5, 4, true), 'swap'],
  ['c5', 2, sp(5, 5), 'turn'],
  ['c6', 2, sp(6, 4), 'noturn'],
  ['c7', 2, sp(6, 5, true), 'swap'],
  ['c8', 2, sp(5, 5, true), 'count'],
];
const changeItems = CHANGES.map(([id, level, m, bug]) =>
  puzzle({
    id: `change-${id}`,
    obj: 'change',
    level,
    rows: m.rows,
    dir: m.dir,
    solution: rule2(m.t),
    initial: bug2(m.t, bug),
    palette: PALETTE,
    repeatTimes: TIMES,
    conds: ['wall-ahead', 'open-ahead'],
    maxCards: 5,
    lead: 'センサーで うごく ロボット。じょうけんを なおそう。',
    hints: H2[bug],
    why: 'センサーの こたえ（かべが ある・ない）で、ロボットの はたらきが かわるよ。じょうけんを かえると、うごきも かわるね。',
    mis: MIS,
  }),
);
const sense = (n: number, t: 'R' | 'L'): Cmd[] => [
  rep(n, iff('open-ahead', F), iff('wall-ahead', TURN2[t])),
];
const changeAlts = [
  landingItem({
    id: 'change-alt-a1',
    obj: 'change',
    level: 1,
    alt: true,
    rows: sp(5, 4).rows.map((r) => r.replace('G', '.')),
    dir: 'right',
    prog: sense(7, 'R'),
    mis: { turn: 'turn', short: 'short', count: 'repeat-count', cond: 'cond-ignore' },
    hints: [
      'ロボットが 1かいごとに どうするかを たどろう。',
      '1かいで「まえが あいていたら すすむ」、そのあと「まえが かべなら まがる」を しらべるよ。',
      'かべの まえに ついた ときだけ、むきが かわるよ。',
    ],
  }),
  landingItem({
    id: 'change-alt-a2',
    obj: 'change',
    level: 2,
    alt: true,
    rows: sp(5, 3, true).rows.map((r) => r.replace('G', '.')),
    dir: 'left',
    prog: sense(6, 'L'),
    mis: { turn: 'turn', short: 'short', count: 'repeat-count', cond: 'cond-ignore' },
    hints: [
      'ロボットが 1かいごとに どうするかを たどろう。',
      '1かいで「まえが あいていたら すすむ」、そのあと「まえが かべなら まがる」を しらべるよ。',
      'かべの まえに ついた ときだけ、むきが かわるよ。',
    ],
  }),
  landingItem({
    id: 'change-alt-a3',
    obj: 'change',
    level: 2,
    alt: true,
    rows: sp(6, 5).rows.map((r) => r.replace('G', '.')),
    dir: 'right',
    prog: sense(11, 'R'),
    mis: { turn: 'turn', short: 'short', count: 'repeat-count', cond: 'cond-ignore' },
    hints: [
      'ロボットが 1かいごとに どうするかを たどろう。',
      '1かいで「まえが あいていたら すすむ」、そのあと「まえが かべなら まがる」を しらべるよ。',
      'かべの まえに ついた ときだけ、むきが かわるよ。',
    ],
  }),
];

// ---- save ----
const SCENES = {
  light: {
    scene: 'きょうしつの ライト',
    c1: { name: 'まわり', yes: 'くらい', no: '明《あか》るい' },
    c2: { name: '人《ひと》', yes: 'いる', no: 'いない' },
    action: 'ライトを つける',
  },
  air: {
    scene: 'へやの エアコン',
    c1: { name: 'おんど', yes: 'あつい', no: 'すずしい' },
    c2: { name: '人《ひと》', yes: 'いる', no: 'いない' },
    action: 'エアコンを つける',
  },
  water: {
    scene: 'はなだんの 水《みず》やり',
    c1: { name: 'つち', yes: 'かわいている', no: 'しめっている' },
    c2: { name: 'てんき', yes: 'はれ', no: 'あめ' },
    action: '水《みず》を やる',
  },
  hall: {
    scene: 'ろうかの ライト',
    c1: { name: 'まわり', yes: 'くらい', no: '明《あか》るい' },
    c2: { name: '人《ひと》', yes: 'いる', no: 'いない' },
    action: 'ライトを つける',
  },
  fan: {
    scene: 'おふろの かんきせん',
    c1: { name: 'しつど', yes: 'たかい', no: 'ひくい' },
    c2: { name: '人《ひと》', yes: 'いる', no: 'いない' },
    action: 'かんきせんを まわす',
  },
} as const;
const HOURS = ['6じ', '8じ', '10じ', '12じ', '14じ', '16じ', '18じ', '20じ'];

function makeTable(id: string): { c1: boolean[]; c2: boolean[] } {
  for (let t = 0; t < 500; t++) {
    const rng = createRng(hashSeed('sensor-save', id, t));
    const c1 = HOURS.map(() => rng.next() < 0.5);
    const c2 = HOURS.map(() => rng.next() < 0.5);
    const both = c1.filter((v, i) => v && c2[i]).length;
    const only1 = c1.filter((v, i) => v && !c2[i]).length;
    const only2 = c2.filter((v, i) => v && !c1[i]).length;
    if (both >= 2 && both <= 3 && only1 >= 1 && only2 >= 1) return { c1, c2 };
  }
  throw new Error(`${id}: 表が作れない`);
}
type Scene = (typeof SCENES)[keyof typeof SCENES];
/** ふりがな付きの表記を、図（SVG）の中で使うために ひらがなにする */
const kana = (s: string) => s.replace(/[\u4e00-\u9fff]+《([^》]+)》/g, '$1');
/** 1日の じかんごとの センサーの こたえを ○（あてはまる）で ならべた図 */
function timelineFig(sc: Scene, t: { c1: boolean[]; c2: boolean[] }): Figure {
  const x0 = 190;
  const step = 33;
  let body = '';
  HOURS.forEach((h, i) => {
    const cx = x0 + i * step;
    body += `<text x="${cx}" y="14" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink-soft)">${h}</text>`;
    [t.c1[i]!, t.c2[i]!].forEach((on, r) => {
      const cy = 34 + r * 24;
      body += on
        ? `<circle cx="${cx}" cy="${cy}" r="9" fill="var(--ink)"/>`
        : `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="var(--ink-soft)" stroke-width="1.6" stroke-dasharray="3 3"/>`;
    });
  });
  const rows = [`${kana(sc.c1.name)}：${kana(sc.c1.yes)}`, `${kana(sc.c2.name)}：${kana(sc.c2.yes)}`];
  rows.forEach((r, i) => {
    body += `<text x="${x0 - 22}" y="${39 + i * 24}" text-anchor="end" font-size="14" font-weight="700" fill="var(--ink)">${r}</text>`;
  });
  return {
    kind: 'svg',
    label: `いちにちの ひょう。●は あてはまる じかん。うえの れつ ${rows[0]}、したの れつ ${rows[1]}`,
    markup: `<svg viewBox="0 0 460 70" style="height:calc(var(--u) * 14)" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}
const SAVES: [string, number, keyof typeof SCENES][] = [
  ['s1', 2, 'light'],
  ['s2', 2, 'air'],
  ['s3', 2, 'water'],
  ['s4', 2, 'hall'],
  ['s5', 2, 'fan'],
  ['s6', 2, 'air'],
];
const condText = (sc: Scene, kind: 'a' | 'b' | 'c') =>
  kind === 'a'
    ? `${sc.c1.name}が ${sc.c1.yes}`
    : kind === 'c'
      ? `${sc.c2.name}が ${sc.c2.yes}`
      : `${sc.c1.name}が ${sc.c1.yes} かつ ${sc.c2.name}が ${sc.c2.yes}`;
const saveItems: ChoiceItem[] = SAVES.map(([id, level, key]) => {
  const sc = SCENES[key];
  const t = makeTable(`${id}-${key}`);
  return choiceItem({
    id: `save-${id}`,
    obj: 'save',
    level,
    prompt: `${sc.scene}の きまり。むだの ない ものは どれ？\nひつよう: ${condText(sc, 'b').replace(' かつ ', ' と ')}`,
    figure: timelineFig(sc, t),
    right: '2つとも',
    wrongs: [
      [`${sc.c1.name}だけ`, 'cond-one'],
      [`${sc.c2.name}だけ`, 'cond-one'],
    ],
    layout: 'row',
    hints: [
      'ひょうを 見《み》て、ひつよう な ときは いつか さがそう。●が 2つ そろった ところだよ。',
      `ひつよう な のは、「${sc.c1.name}が ${sc.c1.yes}」と「${sc.c2.name}が ${sc.c2.yes}」の りょうほうが あてはまる ときだけだよ。`,
      'ひとつの じょうけんだけだと、ひつよう ない ときにも はたらいて しまわないかな。',
    ],
    explain: `ひつよう な ときは 2つの じょうけんが そろった ときだけ。ひとつだけの きまりだと、ひつよう ない ときにも はたらいて、むだに なってしまうよ。`,
  });
});
const saveAlts: NumberItem[] = [
  { id: 'a1', level: 2, key: 'light' as const, rule: 'b' as const },
  { id: 'a2', level: 2, key: 'air' as const, rule: 'a' as const },
  { id: 'a3', level: 2, key: 'water' as const, rule: 'c' as const },
].map((q) => {
  const sc = SCENES[q.key];
  const t = makeTable(`${q.id}-${q.key}`);
  const on = (r: 'a' | 'b' | 'c') =>
    HOURS.filter((_, i) => (r === 'a' ? t.c1[i] : r === 'c' ? t.c2[i] : t.c1[i] && t.c2[i])).length;
  const answer = on(q.rule);
  const others = (['a', 'b', 'c'] as const).filter((r) => r !== q.rule).map((r) => on(r));
  return {
    engine: 'number',
    id: `save-alt-${q.id}`,
    objective: 'save',
    level: q.level,
    alt: true,
    prompt: `きまり: ${condText(sc, q.rule)}\n${sc.action}のは、8つの じかんの うち なんかい？`,
    figure: timelineFig(sc, t),
    fields: [{ label: 'かい', answer: { kind: 'int', value: answer } }],
    wrongAnswers: [...new Set([...others, HOURS.length])]
      .filter((v) => v !== answer)
      .map((v) => ({ value: String(v), misconception: 'count-cond' })),
    hints: [
      'ひょうを ひだりから じゅんに 見《み》て、きまりに あてはまる ところに しるしを つけよう。',
      q.rule === 'b'
        ? '2つの じょうけんが りょうほう あてはまる ところだけ しるしを つけるよ。'
        : 'ひとつの じょうけんだけを 見《み》れば いいよ。',
      '1つずつ 見《み》て、しるしの 数《かず》を 数《かぞ》えよう。',
    ],
    explain: `きまりに あてはまる じかんを ひょうから 数《かぞ》えると ${answer}かい。「かつ」の きまりは、2つとも あてはまる ときだけ なので すくなくなるよ。`,
    identity: `save-alt-${q.id}`,
  } as NumberItem;
});
const items: Item[] = [
  ...raItems,
  ...flItems,
  ...changeItems,
  ...changeAlts,
  ...saveItems,
  ...saveAlts,
];

const introGrid = gridFigure(layout(['S..', '..G'], 'right'), { label: 'ますの ず。ほしが ゴール' });

export const sensor: UnitSpec = {
  ...baseUnit('g6.prog.sensor', 'g6'),
  title: 'センサーで うごく どうぐ',
  prereq: ['g3.prog.condition-combo'],
  objectives: [
    { id: 'rule-action', title: 'センサーが しらべる ことと、はたらきを むすびつける' },
    { id: 'change', title: '条件《じょうけん》を かえると、うごきが かわる' },
    { id: 'save', title: 'むだを へらす きまりを えらぶ' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'sensor-kind',
      explain:
        'べつの センサーと まちがえたのかな。どんな ときに はたらくかを 見《み》ると、なにを しらべて いるかが わかるよ。',
    },
    {
      id: 'cond-reverse',
      explain:
        'じょうけんと はんたいの ことを えらんだのかな。「もし」の あとの ようすを よく 読《よ》んで、あてはまる ものを えらぼう。',
    },
    {
      id: 'cond-ignore',
      explain:
        'じょうけんを たしかめなかったのかな。いまの ようすが「もし」に あてはまるかを、まず 見《み》よう。',
    },
    {
      id: 'ifelse-swap',
      explain:
        '「もし」と「そうでなければ」を とりちがえたのかな。あてはまる ときは「もし」、あてはまらない ときは「そうでなければ」だよ。',
    },
    {
      id: 'cond-one',
      explain:
        'ひとつの じょうけんだけを 見《み》たのかな。むだを へらすには、ひつよう な ときの 2つの じょうけんが そろった ときだけ はたらかせるよ。',
    },
    {
      id: 'count-cond',
      explain:
        'ひょうの 見《み》かたを まちがえたのかな。きまりの じょうけんに あてはまる ところだけに しるしを つけて 数《かぞ》えよう。',
    },
    {
      id: 'repeat-count',
      explain: 'くりかえす かいすうが ちがったのかな。「つくまで」を つかうと、かぞえなくても いいよ。',
    },
    {
      id: 'too-many',
      explain: 'ふだが おおすぎたのかな。「ずっと くりかえす」の なかに「もし」を ならべよう。',
    },
  ],
  levels: [
    { label: 'センサーと はたらき', chance: 0.1 },
    { label: 'じょうけんを かえる', chance: 0.05 },
    { label: 'むだを へらす', chance: 0.1 },
  ],
  intro: [
    {
      text: 'センサーは、明《あか》るさや 人《ひと》の うごきなどを しらべる どうぐだよ。しらべた こたえで、はたらきが きまるよ。',
      figure: { kind: 'text', text: 'くらい → ライトを つける', size: 'l' },
    },
    {
      text: '「もし ○○なら △△」の ○○を 条件《じょうけん》と いうよ。条件《じょうけん》を かえると、うごきも かわるよ。',
      figure: { kind: 'text', text: 'あかるい → ライトを けす', size: 'l' },
    },
    {
      text: 'ロボットの 前《まえ》の センサーは「まえが かべか どうか」を しらべるよ。それで すすむ・まがるを きめられるよ。',
      figure: introGrid,
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）理科 第6学年 A(4)（電気の利用）、同 内容の取扱い（プログラミングを体験する学習の例）、小学校プログラミング教育の手引（第三版）A。他の教科（理科6年 g6.sci.electricity-use）と連携。program エンジンの「まえが かべ」を前センサーに見立てた',
  gradeIsAppProposal: false,
};




