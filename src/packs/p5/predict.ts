/**
 * p5.env.predict どう なるかな（curriculum-matrix 3.3・docs/expansion/p2-design/p5.md 2章）。
 * 場面ごとに 3問: よそう（choice。結果は解説の図）→ やってみる（experiment の表）→ かんがえる（choice）。
 * 練習 8場面（ひとつの ものが どう なるか）＋ 別例 3場面（2つを くらべて どっちか）。火・薬品・刃物は使わない。
 * 同一性キー: 場面:predict / 場面:observe / 場面:apply。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { ExperimentItem } from '../../engines/experiment/experiment';
import type { ExpSetup } from '../../engines/experiment/model';
import type { Figure } from '../../engines/figure/types';
import { choiceItem, ill, opts } from './lib';

type TableSetup = Extract<ExpSetup, { kind: 'table' }>;

/** [文, 絵, 誤概念] */
type Opt = [label: string, illust?: string, misconception?: string];
const toOpt = ([label, illust, misconception]: Opt, correct = false): ChoiceOption => ({
  label,
  ...(illust ? { figure: ill(illust) } : {}),
  ...(correct ? { correct: true } : {}),
  ...(misconception ? { misconception } : {}),
});

export interface Scene {
  id: string;
  /** 別例（2つを くらべて どっちか） */
  alt?: boolean;
  setup: TableSetup;
  /** よそう */
  q1: {
    figure?: string;
    prompt: string;
    right: Opt;
    wrong: Opt;
    h2: string;
    /** 予想の対象の値の id と、その結果の key（rows と照らす） */
    ask: string;
    rightKey: string;
    /** 解説の図: [結果の絵, 結果の語] */
    result: [illust: string, word: string];
    explain: string;
  };
  /** やってみる */
  q2: {
    prompt: string;
    /** 聞いている結果の key（rows と照らす） */
    askKey: string;
    /** 正解の値の id */
    right: string;
    /** 誤りの値の id と誤概念 */
    wrong: [value: string, misconception: string][];
    /** 選択肢の文（値の名前と違うときだけ） */
    label?: Record<string, string>;
    /** 選択肢の絵 */
    figs?: Record<string, string>;
    explain: string;
  };
  /** かんがえる */
  q3: {
    figure?: string;
    prompt: string;
    right: Opt;
    wrong: Opt;
    h2: string;
    explain: string;
  };
}

interface TableArgs {
  factor: string;
  factorLabel: string;
  values: [id: string, label: string][];
  output: string;
  /** [値の id, 結果の文, key, 絵] */
  rows: [value: string, result: string, key: string, illust?: string][];
}
const table = (a: TableArgs): TableSetup => ({
  kind: 'table',
  factors: [
    {
      id: a.factor,
      label: a.factorLabel,
      values: a.values.map(([id, label]) => ({ id, label })),
    },
  ],
  output: a.output,
  rows: a.rows.map(([v, result, key, illust]) => ({
    when: { [a.factor]: v },
    result,
    key,
    ...(illust ? { figure: ill(illust) } : {}),
  })),
});

export const SCENES: Scene[] = [
  {
    id: 'float',
    setup: table({
      factor: 'thing',
      factorLabel: 'いれる もの',
      values: [
        ['rock', 'こいし'],
        ['leaf', 'はっぱ'],
        ['apple', 'りんご'],
      ],
      output: 'みずに いれると',
      rows: [
        ['rock', 'しずんだ', 'sink', 'rock'],
        ['leaf', 'ういた', 'float', 'leaf'],
        ['apple', 'ういた', 'float', 'apple'],
      ],
    }),
    q1: {
      figure: 'rock',
      prompt: 'こいしを みずに いれると どう なるかな？',
      right: ['しずむ'],
      wrong: ['うく', undefined, 'small-floats'],
      h2: 'こいしを てに のせると、どんな かんじかな。',
      ask: 'rock',
      rightKey: 'sink',
      result: ['rock', 'しずむ'],
      explain:
        'こいしは しずむよ。ちいさくても しずむ ものが あるね。おうちの ひとと いっしょに、こいしと ボールを みずに いれて くらべて みよう。',
    },
    q2: {
      prompt: 'ぜんぶ やって みよう。しずんだ ものは どれ？',
      askKey: 'sink',
      right: 'rock',
      wrong: [
        ['apple', 'big-heavy'],
        ['leaf', 'look-again'],
      ],
      figs: { rock: 'rock', apple: 'apple', leaf: 'leaf' },
      explain: 'しずんだのは こいし。はっぱと りんごは ういたね。りんごは おおきいけど うくよ。',
    },
    q3: {
      prompt: 'みずに うかべて ひやせるのは どっち？',
      right: ['すいか', 'watermelon'],
      wrong: ['たまご', 'egg', 'small-floats'],
      h2: 'りんごの ように、おおきくても うく ものが あるね。',
      explain: 'すいかは おおきいけど みずに うくよ。たまごは ちいさいけど しずむよ。',
    },
  },
  {
    id: 'melt',
    setup: table({
      factor: 'place',
      factorLabel: 'おく ところ',
      values: [
        ['sun', 'ひなた'],
        ['shade', 'ひかげ'],
      ],
      output: 'こおりは',
      rows: [
        ['sun', 'はやく とけた', 'fast', 'p5-sun'],
        ['shade', 'ゆっくり とけた', 'slow', 'p5-ice'],
      ],
    }),
    q1: {
      figure: 'p5-ice',
      prompt: 'こおりを ひなたに おくと どう なるかな？',
      right: ['はやく とける'],
      wrong: ['とけない', undefined, 'no-change'],
      h2: 'ひなたは あたたかいね。こおりは あたたかいと どう なるかな。',
      ask: 'sun',
      rightKey: 'fast',
      result: ['p5-sun', 'とける'],
      explain:
        'ひなたに おくと、こおりは はやく とけるよ。おうちで、こおりを 2つ ひなたと ひかげに おいて くらべて みよう。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。はやく とけたのは どっち？',
      askKey: 'fast',
      right: 'sun',
      wrong: [['shade', 'look-again']],
      explain: 'ひなたの こおりが はやく とけたね。ひかげは ゆっくりだったよ。',
    },
    q3: {
      prompt: 'アイスを とけにくく するには、どこに おく？',
      right: ['すずしい ところ'],
      wrong: ['ひなた', undefined, 'opposite'],
      h2: 'こおりが ゆっくり とけたのは どこだったかな。',
      explain: 'すずしい ところに おくと、とけにくいよ。',
    },
  },
  {
    id: 'roll',
    setup: table({
      factor: 'thing',
      factorLabel: 'おく もの',
      values: [
        ['ball', 'ボール'],
        ['box', 'はこ'],
        ['can', 'つつ'],
      ],
      output: 'さかに おくと',
      rows: [
        ['ball', 'ころがった', 'roll', 'ball'],
        ['box', 'ころがらない', 'stay', 'p5-box'],
        ['can', 'ころがった', 'roll', 'p5-can'],
      ],
    }),
    q1: {
      figure: 'ball',
      prompt: 'さかに ボールを おくと どう なるかな？',
      right: ['ころがる'],
      wrong: ['とまって いる', undefined, 'no-change'],
      h2: 'ボールは どんな かたちかな。',
      ask: 'ball',
      rightKey: 'roll',
      result: ['ball', 'ころがる'],
      explain:
        'まるい ボールは さかで ころがるよ。ほんを たてかけて さかを つくり、ボールを ころがして みよう。',
    },
    q2: {
      prompt: 'ぜんぶ やって みよう。ころがらなかった ものは どれ？',
      askKey: 'stay',
      right: 'box',
      wrong: [
        ['ball', 'look-again'],
        ['can', 'flat-side'],
      ],
      figs: { ball: 'ball', box: 'p5-box', can: 'p5-can' },
      explain:
        'ころがらなかったのは はこ。ボールと つつは ころがったね。つつは よこに すると まるい ところで ころがるよ。',
    },
    q3: {
      prompt: 'さかで ころがりそうな ものは どっち？',
      right: ['みかん', 'mikan'],
      wrong: ['ほん', 'p5-book', 'shape-roll'],
      h2: 'まるい ところが ある ものは どっちかな。',
      explain: 'まるい みかんは ころがるよ。かどの ある ほんは ころがらないね。',
    },
  },
  {
    id: 'wind',
    setup: table({
      factor: 'thing',
      factorLabel: 'あおぐ もの',
      values: [
        ['leaf', 'はっぱ'],
        ['balloon', 'ふうせん'],
        ['rock', 'こいし'],
      ],
      output: 'うちわで あおぐと',
      rows: [
        ['leaf', 'とんだ', 'move', 'leaf'],
        ['balloon', 'うごいた', 'move', 'p5-balloon'],
        ['rock', 'うごかない', 'stay', 'rock'],
      ],
    }),
    q1: {
      figure: 'leaf',
      prompt: 'うちわで はっぱを あおぐと どう なるかな？',
      right: ['とんで いく'],
      wrong: ['うごかない', undefined, 'no-change'],
      h2: 'はっぱは かるいかな、おもいかな。',
      ask: 'leaf',
      rightKey: 'move',
      result: ['leaf', 'とぶ'],
      explain:
        'かるい はっぱは、かぜで とんで いくよ。かみを ちいさく ちぎって、うちわで あおいで みよう。',
    },
    q2: {
      prompt: 'ぜんぶ やって みよう。うごかなかった ものは どれ？',
      askKey: 'stay',
      right: 'rock',
      wrong: [
        ['balloon', 'big-heavy'],
        ['leaf', 'look-again'],
      ],
      figs: { rock: 'rock', balloon: 'p5-balloon', leaf: 'leaf' },
      explain: 'うごかなかったのは こいし。ふうせんは おおきいけど かるいから うごいたね。',
    },
    q3: {
      prompt: 'かぜで うごきそうな ものは どっち？',
      right: ['リボン', 'p5-ribbon'],
      wrong: ['ほん', 'p5-book', 'heavy-moves'],
      h2: 'かぜで うごいたのは、かるい ものだったね。',
      explain: 'かるい リボンは かぜで ゆれるよ。おもい ほんは うごかないね。',
    },
  },
  {
    id: 'freeze',
    setup: table({
      factor: 'place',
      factorLabel: 'おく ところ',
      values: [
        ['freezer', 'れいとうこ'],
        ['room', 'へや'],
      ],
      output: 'ひとばん おくと',
      rows: [
        ['freezer', 'こおった', 'ice', 'p5-ice'],
        ['room', 'みずの まま', 'water', 'p23-cup'],
      ],
    }),
    q1: {
      figure: 'p23-cup',
      prompt: 'みずを れいとうこに ひとばん おくと どう なるかな？',
      right: ['こおる'],
      wrong: ['みずの まま', undefined, 'no-change'],
      h2: 'れいとうこの なかは、とても つめたいね。',
      ask: 'freezer',
      rightKey: 'ice',
      result: ['p5-ice', 'こおる'],
      explain:
        'みずは れいとうこで こおって、こおりに なるよ。おうちの ひとと いっしょに、こおりを つくって みよう。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。こおったのは どっち？',
      askKey: 'ice',
      right: 'freezer',
      wrong: [['room', 'look-again']],
      explain: 'れいとうこの みずが こおったね。へやの みずは みずの ままだよ。',
    },
    q3: {
      figure: 'p5-ice',
      prompt: 'こおりを へやに おいて おくと どう なるかな？',
      right: ['とけて みずに なる'],
      wrong: ['こおりの まま', undefined, 'no-change'],
      h2: 'へやは れいとうこより あたたかいね。',
      explain: 'へやに おくと、こおりは とけて みずに もどるよ。',
    },
  },
  {
    id: 'plant',
    setup: table({
      factor: 'water',
      factorLabel: 'みず',
      values: [
        ['give', 'あげる'],
        ['none', 'あげない'],
      ],
      output: 'なんにちか たつと',
      rows: [
        ['give', 'げんき', 'ok', 'flower'],
        ['none', 'しおれた', 'wilt', 'p5-wilted'],
      ],
    }),
    q1: {
      figure: 'flower',
      prompt: 'はなに なんにちも みずを あげないと どう なるかな？',
      right: ['しおれる'],
      wrong: ['おおきく なる', undefined, 'no-need-water'],
      h2: 'はなも、みずを のんで いきて いるよ。',
      ask: 'none',
      rightKey: 'wilt',
      result: ['p5-wilted', 'しおれる'],
      explain:
        'みずが ないと、はなは しおれて しまうよ。おうちの はなに みずを あげて、ようすを みて みよう。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。げんきなのは どっち？',
      askKey: 'ok',
      right: 'give',
      wrong: [['none', 'look-again']],
      label: { give: 'みずを あげた', none: 'あげなかった' },
      figs: { give: 'flower', none: 'p5-wilted' },
      explain: 'みずを あげた はなは げんき。あげなかった はなは しおれたね。',
    },
    q3: {
      figure: 'p5-wilted',
      prompt: 'しおれそうな はなを みつけたら、どう する？',
      right: ['みずを あげる'],
      wrong: ['そのままに する', undefined, 'no-need-water'],
      h2: 'げんきだったのは、どっちの はなだったかな。',
      explain: 'みずを あげると、はなが げんきに なる ことが あるよ。',
    },
  },
  {
    id: 'dissolve',
    setup: table({
      factor: 'thing',
      factorLabel: 'いれる もの',
      values: [
        ['sugar', 'さとう'],
        ['sand', 'すな'],
        ['salt', 'しお'],
      ],
      output: 'みずに いれて まぜると',
      rows: [
        ['sugar', 'とけて みえなく なった', 'melt'],
        ['sand', 'そこに たまった', 'stay'],
        ['salt', 'とけて みえなく なった', 'melt'],
      ],
    }),
    q1: {
      figure: 'p23-cup',
      prompt: 'さとうを みずに いれて まぜると どう なるかな？',
      right: ['とけて みえなく なる'],
      wrong: ['そのまま みえる', undefined, 'no-change'],
      h2: 'あまい のみものに、さとうの つぶは みえるかな。',
      ask: 'sugar',
      rightKey: 'melt',
      result: ['p23-cup', 'とける'],
      explain:
        'さとうは みずに とけて、みえなく なるよ。おうちの ひとと、コップの みずに さとうを すこし いれて まぜて みよう。',
    },
    q2: {
      prompt: 'ぜんぶ やって みよう。とけなかった ものは どれ？',
      askKey: 'stay',
      right: 'sand',
      wrong: [
        ['sugar', 'look-again'],
        ['salt', 'look-again'],
      ],
      explain: 'とけなかったのは すな。そこに たまったね。さとうと しおは とけたよ。',
    },
    q3: {
      figure: 'p23-cup',
      prompt: 'みえなく なった さとうは どう なったかな？',
      right: ['みずの なかに ある'],
      wrong: ['きえて なくなった', undefined, 'vanished'],
      h2: 'さとうを とかした みずは、どんな あじかな。',
      explain:
        'みえなく なっても、さとうは みずの なかに あるよ。だから あまい あじが するんだね。',
    },
  },
  {
    id: 'clap',
    setup: table({
      factor: 'how',
      factorLabel: 'たたきかた',
      values: [
        ['strong', 'つよく'],
        ['weak', 'よわく'],
      ],
      output: 'おとは',
      rows: [
        ['strong', 'おおきい', 'loud', 'p5-note'],
        ['weak', 'ちいさい', 'soft', 'p5-note'],
      ],
    }),
    q1: {
      figure: 'p5-note',
      prompt: 'てを つよく たたくと どう なるかな？',
      right: ['おおきい おとが でる'],
      wrong: ['ちいさい おとが でる', undefined, 'opposite'],
      h2: 'そっと たたいた ときと くらべて みよう。',
      ask: 'strong',
      rightKey: 'loud',
      result: ['p5-note', 'おおきい おと'],
      explain:
        'つよく たたくと、おおきい おとが でるよ。つよく、よわく、てを たたいて くらべて みよう。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。ちいさい おとが でたのは どっち？',
      askKey: 'soft',
      right: 'weak',
      wrong: [['strong', 'look-again']],
      explain: 'よわく たたくと ちいさい おと。つよく たたくと おおきい おとだったね。',
    },
    q3: {
      prompt: 'とおくの ひとに きこえるように たたくには？',
      right: ['つよく たたく'],
      wrong: ['よわく たたく', undefined, 'opposite'],
      h2: 'おおきい おとが でたのは、どんな たたきかただったかな。',
      explain: 'つよく たたくと おおきい おとが でて、とおくまで きこえるよ。',
    },
  },
  // ---- 別例（2つを くらべて どっちか）----
  {
    id: 'ice-size',
    alt: true,
    setup: table({
      factor: 'size',
      factorLabel: 'こおりの おおきさ',
      values: [
        ['big', 'おおきい'],
        ['small', 'ちいさい'],
      ],
      output: 'ひなたに おくと',
      rows: [
        ['big', 'ゆっくり とけた', 'slow', 'p5-ice'],
        ['small', 'はやく とけた', 'fast', 'p5-ice'],
      ],
    }),
    q1: {
      figure: 'p5-ice',
      prompt: 'おおきい こおりと ちいさい こおり。はやく とけるのは どっち？',
      right: ['ちいさい こおり'],
      wrong: ['おおきい こおり', undefined, 'opposite'],
      h2: 'こおりが ぜんぶ とけるまでの じかんを くらべよう。',
      ask: 'small',
      rightKey: 'fast',
      result: ['p5-ice', 'ちいさい ほうが はやい'],
      explain:
        'ちいさい こおりの ほうが はやく とけるよ。おうちで、おおきさの ちがう こおりで くらべて みよう。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。ゆっくり とけたのは どっち？',
      askKey: 'slow',
      right: 'big',
      wrong: [['small', 'look-again']],
      explain: 'おおきい こおりは ゆっくり とけたね。',
    },
    q3: {
      prompt: 'こおりを はやく とかしたい。どう する？',
      right: ['ちいさい こおりに する'],
      wrong: ['おおきい まま おく', undefined, 'opposite'],
      h2: 'はやく とけたのは どっちの こおりだったかな。',
      explain: 'ちいさい こおりに すると、はやく とけるよ。',
    },
  },
  {
    id: 'float-pair',
    alt: true,
    setup: table({
      factor: 'thing',
      factorLabel: 'いれる もの',
      values: [
        ['mikan', 'みかん'],
        ['rock', 'こいし'],
      ],
      output: 'みずに いれると',
      rows: [
        ['mikan', 'ういた', 'float', 'mikan'],
        ['rock', 'しずんだ', 'sink', 'rock'],
      ],
    }),
    q1: {
      prompt: 'みかんと こいし。みずに うくのは どっち？',
      right: ['みかん', 'mikan'],
      wrong: ['こいし', 'rock', 'small-floats'],
      h2: 'かわの ついた みかんは、なかに くうきが あるよ。',
      ask: 'mikan',
      rightKey: 'float',
      result: ['mikan', 'うく'],
      explain: 'かわの ついた みかんは うくよ。こいしは しずむね。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。しずんだのは どっち？',
      askKey: 'sink',
      right: 'rock',
      wrong: [['mikan', 'big-heavy']],
      figs: { mikan: 'mikan', rock: 'rock' },
      explain: 'しずんだのは こいし。みかんは こいしより おおきいけど ういたね。',
    },
    q3: {
      prompt: 'りんごと たまご。みずに うくのは どっち？',
      right: ['りんご', 'apple'],
      wrong: ['たまご', 'egg', 'small-floats'],
      h2: 'おおきさだけでは きまらないね。',
      explain: 'りんごは うくよ。たまごは ちいさいけど しずむよ。',
    },
  },
  {
    id: 'roll-pair',
    alt: true,
    setup: table({
      factor: 'thing',
      factorLabel: 'おく もの',
      values: [
        ['ball', 'ボール'],
        ['box', 'はこ'],
      ],
      output: 'さかに おくと',
      rows: [
        ['ball', 'ころがった', 'roll', 'ball'],
        ['box', 'ころがらない', 'stay', 'p5-box'],
      ],
    }),
    q1: {
      prompt: 'ボールと はこ。さかで ころがるのは どっち？',
      right: ['ボール', 'ball'],
      wrong: ['はこ', 'p5-box', 'shape-roll'],
      h2: 'かどが ある のは どっちかな。',
      ask: 'ball',
      rightKey: 'roll',
      result: ['ball', 'ころがる'],
      explain: 'まるい ボールが ころがるよ。はこは かどが あって ころがらないね。',
    },
    q2: {
      prompt: 'りょうほう やって みよう。ころがらなかったのは どっち？',
      askKey: 'stay',
      right: 'box',
      wrong: [['ball', 'look-again']],
      explain: 'はこは ころがらなかったね。',
    },
    q3: {
      figure: 'p5-can',
      prompt: 'つつを よこに して、さかに おくと どう なる？',
      right: ['ころがる'],
      wrong: ['ころがらない', undefined, 'flat-side'],
      h2: 'よこに した つつには、まるい ところが あるね。',
      explain: 'つつは よこに すると、まるい ところで ころがるよ。',
    },
  },
];

const row = (...items: Figure[]): Figure => ({ kind: 'row', items, gap: 8 });

function predictItem(s: Scene): Item {
  const q = s.q1;
  const id = `${s.id}:predict`;
  const all = [q.right, q.wrong];
  return choiceItem({
    id,
    objective: 'predict',
    level: 0,
    ...(s.alt ? { alt: true } : {}),
    prompt: q.prompt,
    ...(q.figure ? { figure: ill(q.figure) } : {}),
    hints: ['まえに みた ことや、あそんだ ことを おもいだそう。', q.h2],
    explain: q.explain,
    explainFigure: row(ill(q.result[0]), { kind: 'text', text: q.result[1], size: 'l' }),
    identity: id,
    layout: all.every((o) => o[1] !== undefined) ? 'row' : 'column',
    correct: toOpt(q.right),
    wrong: [toOpt(q.wrong)],
  });
}

function observeItem(s: Scene): ExperimentItem {
  const q = s.q2;
  const id = `${s.id}:observe`;
  const values = s.setup.factors[0]!.values;
  const nameOf = (v: string) => values.find((x) => x.id === v)!.label as string;
  const option = (v: string, mis?: string): ChoiceOption => ({
    label: q.label?.[v] ?? nameOf(v),
    ...(q.figs?.[v] ? { figure: ill(q.figs[v]!) } : {}),
    ...(mis ? { misconception: mis } : {}),
  });
  return {
    engine: 'experiment',
    id,
    objective: 'observe',
    level: 1,
    ...(s.alt ? { alt: true } : {}),
    prompt: q.prompt,
    hints: [
      'ぜんぶ「やってみる」で ためして みよう。',
      'ひょうの けっかを ゆびで たどって みよう。',
    ],
    explain: q.explain,
    identity: id,
    setup: s.setup,
    task: {
      kind: 'consider',
      minTrials: values.length,
      options: opts(
        id,
        option(q.right),
        q.wrong.map(([v, m]) => option(v, m)),
      ),
    },
  };
}

function applyItem(s: Scene): Item {
  const q = s.q3;
  const id = `${s.id}:apply`;
  const all = [q.right, q.wrong];
  return choiceItem({
    id,
    objective: 'apply',
    level: 2,
    ...(s.alt ? { alt: true } : {}),
    prompt: q.prompt,
    ...(q.figure ? { figure: ill(q.figure) } : {}),
    hints: ['やって みた ことを おもいだそう。', q.h2],
    explain: q.explain,
    identity: id,
    layout: all.every((o) => o[1] !== undefined) ? 'row' : 'column',
    correct: toOpt(q.right),
    wrong: [toOpt(q.wrong)],
  });
}

export const envPredict: UnitSpec = {
  id: 'p5.env.predict',
  title: 'どう なるかな',
  stage: 'p5',
  subject: 'env',
  domain: 'play',
  kind: 'inquiry',
  priority: 'P2',
  status: 'ready',
  icon: 'p5-ice',
  prereq: [],
  objectives: [
    { id: 'predict', title: 'やる まえに よそう する' },
    { id: 'observe', title: 'やって みて、けっかを くらべる' },
    { id: 'apply', title: 'けっかから かんがえて、ほかの ことに つかう' },
  ],
  misconceptions: [
    {
      id: 'no-change',
      explain: 'なにも かわらないと かんがえたのかな。やって みると、ようすが かわるよ。',
    },
    {
      id: 'opposite',
      explain: 'はんたいに なると かんがえたのかな。けっかを もういちど くらべて みよう。',
    },
    {
      id: 'look-again',
      explain: 'けっかが ちがって みえたのかな。ひょうに かいた けっかを もういちど みよう。',
    },
    {
      id: 'small-floats',
      explain: 'ちいさい ものは うくと かんがえたのかな。こいしや たまごは ちいさくても しずむよ。',
    },
    {
      id: 'big-heavy',
      explain:
        'おおきい ものは しずむ、うごかないと かんがえたのかな。おおきくても うく もの、かぜで うごく ものが あるよ。',
    },
    {
      id: 'shape-roll',
      explain:
        'かどが ある ものも ころがると かんがえたのかな。まるい ところが ある ものが ころがるよ。',
    },
    {
      id: 'flat-side',
      explain:
        'たいらな ところが ある ものは ころがらないと かんがえたのかな。つつは よこに すると ころがるよ。',
    },
    {
      id: 'heavy-moves',
      explain: 'おもい ものも かぜで うごくと かんがえたのかな。かるい ものが かぜで うごくよ。',
    },
    {
      id: 'no-need-water',
      explain: 'みずが なくても げんきだと かんがえたのかな。はなも みずを のんで いきて いるよ。',
    },
    {
      id: 'vanished',
      explain:
        'みえなく なったら なくなったと かんがえたのかな。とけた さとうは みずの なかに あるよ。',
    },
  ],
  levels: [
    { label: 'よそう する', chance: 0.5 },
    { label: 'やって みる', chance: 0.4 },
    { label: 'かんがえる', chance: 0.5 },
  ],
  intro: [
    {
      text: 'やる まえに「どう なるかな？」と かんがえて みよう。これが よそう。',
      figure: ill('rock'),
    },
    {
      text: 'つぎに やって みて、けっかを みよう。よそうと ちがっても だいじょうぶ。',
      figure: ill('p5-ice'),
    },
    { text: 'わかった ことを、おうちの ひとと ためして みよう。', figure: ill('house') },
  ],
  source: {
    kind: 'items',
    items: SCENES.flatMap((s) => [predictItem(s), observeItem(s), applyItem(s)]),
  },
  review: 'none',
  basis:
    '幼稚園教育要領 環境 内容(2)（物の性質や仕組みに興味や関心をもつ）、同解説（5歳児後半: 物の性質を生かして考える・予想する・試す。思考力の芽生え）、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
