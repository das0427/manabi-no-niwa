/** graph の見本の問題（統括が画面で確かめる用。checkGraph が誤りを返さないこと） */
import type { GraphItem } from './graph';

export const graphSamples: GraphItem[] = [
  {
    // 小1: 絵グラフを読む
    id: 'graph-sample:picture-most',
    engine: 'graph',
    objective: 'read-most',
    level: 0,
    prompt: 'いちばん おおいのは どの くだもの？',
    hints: [
      'たかさを くらべよう',
      'いちばん たかく つんで あるのは どれかな',
      'りんごと みかんの たかさを くらべよう',
    ],
    explain: 'みかんが 6こで いちばん たかいよ',
    identity: 'picture:most:4-6-2',
    data: {
      kind: 'picture',
      labels: ['りんご', 'みかん', 'バナナ'],
      values: [4, 6, 2],
      illust: 'apple',
      max: 7,
    },
    task: {
      kind: 'choice',
      options: [
        { label: 'りんご', misconception: 'mis-not-tallest' },
        { label: 'みかん', correct: true },
        { label: 'バナナ', misconception: 'mis-smallest' },
      ],
    },
  },
  {
    // 小3: 1目盛り5人の棒グラフを読む
    id: 'graph-sample:bar-read-5',
    engine: 'graph',
    objective: 'read-scale',
    level: 1,
    prompt: 'サッカーが すきな 人《ひと》は なん人《にん》？',
    hints: [
      '1めもりが いくつか しらべよう',
      '0と 10の あいだに めもりが 2つ。1めもりは 5人《にん》',
      'サッカーの ぼうは 20の 上《うえ》の めもりまで',
    ],
    explain: '1めもりは 5人《にん》。20から 1めもり 上《うえ》で 25人《にん》だよ',
    identity: 'bar:read:25/5',
    data: {
      kind: 'bar',
      labels: ['やきゅう', 'サッカー', 'すいえい', 'なわとび'],
      values: [15, 25, 10, 5],
      scaleStep: 5,
      labelEvery: 2,
      max: 30,
      unit: '人《にん》',
    },
    task: {
      kind: 'number',
      fields: [{ label: 'サッカー', answer: { kind: 'int', value: 25 } }],
      wrongAnswers: [{ value: '6', misconception: 'mis-scale-as-one' }],
    },
  },
  {
    // 小3: 表を見て棒グラフを作る（1目盛り2人）
    id: 'graph-sample:bar-make-2',
    engine: 'graph',
    objective: 'make-bar',
    level: 2,
    prompt: 'ひょうを 見《み》て、ぼうグラフを かこう',
    hints: [
      '1めもりは 2人《にん》だよ',
      'いぬは 8人《にん》。8の めもりまで ぼうを のばそう',
      'のこりの ぼうも、ひょうの かずの めもりまで のばそう',
    ],
    explain:
      '1めもり 2人《にん》なので、8人《にん》は 4めもり、6人《にん》は 3めもり、4人《にん》は 2めもり だよ',
    identity: 'bar:make:8-6-4/2',
    data: {
      kind: 'bar',
      labels: ['いぬ', 'ねこ', 'うさぎ'],
      values: [8, 6, 4],
      scaleStep: 2,
      max: 12,
      unit: '人《にん》',
      header: ['どうぶつ', '人数《にんずう》'],
    },
    task: { kind: 'make' },
    misconceptions: { scaleAsOne: 'mis-scale-as-one' },
  },
  {
    // 小4: 2本の折れ線を読む（凡例。実線と●／破線と■）
    id: 'graph-sample:line2-diff',
    engine: 'graph',
    objective: 'read-line2',
    level: 1,
    prompt: '7がつの きおんの ちがいは なんど？',
    hints: [
      'どちらの せんか、はんれいで たしかめよう',
      '7がつの ところで 2つの てんを よもう',
      '29どと 21どの ちがいを もとめよう',
    ],
    explain: 'なはは 29ど、さっぽろは 21ど。ちがいは 8ど だよ',
    identity: 'line2:diff:7',
    data: {
      kind: 'line',
      labels: ['4月《がつ》', '5月《がつ》', '6月《がつ》', '7月《がつ》', '8月《がつ》', '9月《がつ》'],
      values: [22, 25, 27, 29, 29, 28],
      name: 'なは',
      series2: { name: 'さっぽろ', values: [7, 13, 17, 21, 22, 18] },
      scaleStep: 1,
      labelEvery: 5,
      max: 30,
      unit: 'ど',
    },
    task: {
      kind: 'number',
      fields: [{ label: 'ちがい', answer: { kind: 'int', value: 8 }, unit: 'ど' }],
      wrongAnswers: [{ value: '29', misconception: 'mis-read-one-line' }],
    },
  },
  {
    // 小5: 円グラフの割合を読む（% を欄の後ろに）
    id: 'graph-sample:pie-percent',
    engine: 'graph',
    objective: 'read-pie',
    level: 1,
    prompt: 'あげパンは ぜんたいの なん%？',
    hints: [
      'あげパンは ②の ぶぶん',
      'めもりは 1めもり 1%',
      '40%の ところから 65%の ところまで',
    ],
    explain: '②は 40%から 65%まで。65 − 40 ＝ 25 で 25% だよ',
    identity: 'pie:read:25',
    data: {
      kind: 'pie',
      labels: ['カレー', 'あげパン', 'ラーメン', 'その他《た》'],
      values: [40, 25, 20, 15],
      title: 'すきな きゅうしょく',
    },
    task: {
      kind: 'number',
      fields: [{ label: 'あげパン', answer: { kind: 'int', value: 25 }, unit: '%' }],
      wrongAnswers: [{ value: '65', misconception: 'mis-read-cumulative' }],
    },
  },
  {
    // 小5: 帯グラフで いちばん多い項目を選ぶ
    id: 'graph-sample:band-most',
    engine: 'graph',
    objective: 'read-band',
    level: 1,
    prompt: 'いちばん おおいのは どれ？',
    hints: [
      'おびの ながさを くらべよう',
      'めもりで それぞれの わりあいを よもう',
      '①は 35%、②は 30%',
    ],
    explain: '①の いぬが 35%で いちばん おおいよ',
    identity: 'band:most:35',
    data: {
      kind: 'band',
      labels: ['いぬ', 'ねこ', 'とり', 'その他《た》'],
      values: [35, 30, 20, 15],
      title: 'かいたい どうぶつ',
    },
    task: {
      kind: 'choice',
      options: [
        { label: 'いぬ', correct: true },
        { label: 'ねこ', misconception: 'mis-not-longest' },
        { label: 'その他《た》', misconception: 'mis-other-as-item' },
      ],
    },
  },
];
