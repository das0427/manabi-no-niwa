/** experiment の見本の問題（統括が画面で確かめる用。checkExperiment が誤りを返さないこと） */
import type { ExperimentItem } from './experiment';

export const experimentSamples: ExperimentItem[] = [
  {
    // 小5: 振り子（考察）
    id: 'exp-sample:pendulum-consider',
    engine: 'experiment',
    objective: 'pendulum-length',
    level: 0,
    prompt: 'ふりこの 1おうふくの 時間《じかん》は なにで かわる？',
    hints: [
      '長《なが》さ・重《おも》さ・振《ふ》れ幅《はば》を 1つずつ かえて みよう',
      'かえた ときに 時間《じかん》が かわった じょうけんは どれ？',
      '表《ひょう》の 時間《じかん》を くらべよう',
    ],
    explain:
      'ふりこの 1おうふくの 時間《じかん》は 長《なが》さで かわるよ。重《おも》さや 振《ふ》れ幅《はば》では かわらないよ',
    identity: 'pendulum:consider:what-changes',
    setup: {
      kind: 'pendulum',
      length: [25, 50, 100],
      weight: [10, 20, 40],
      amplitude: [10, 20, 30],
    },
    task: {
      kind: 'consider',
      minTrials: 2,
      options: [
        { label: 'ふりこの 長《なが》さ', correct: true },
        { label: 'おもりの 重《おも》さ', misconception: 'mis-weight' },
        { label: '振《ふ》れ幅《はば》', misconception: 'mis-amplitude' },
      ],
    },
  },
  {
    // 小5: 振り子（条件制御）
    id: 'exp-sample:pendulum-control',
    engine: 'experiment',
    objective: 'control',
    level: 1,
    prompt: '長《なが》さで 時間《じかん》が かわるか、2かい やって しらべよう',
    hints: [
      'しらべたい じょうけんだけを かえるよ',
      '重《おも》さと 振《ふ》れ幅《はば》は 2かいとも おなじに しよう',
      '長《なが》さだけを かえて 2かい やってみよう',
    ],
    explain:
      '長《なが》さだけを かえて、重《おも》さと 振《ふ》れ幅《はば》は おなじに すると くらべられるよ',
    identity: 'pendulum:control:length',
    setup: {
      kind: 'pendulum',
      length: [25, 50, 100],
      weight: [10, 20, 40],
      amplitude: [10, 20, 30],
    },
    task: { kind: 'control', factor: 'length' },
    misconceptions: { changedMany: 'mis-change-two', notChanged: 'mis-not-changed' },
  },
  {
    // 小6: てこをつり合わせる
    id: 'exp-sample:lever-reach',
    engine: 'experiment',
    objective: 'lever-balance',
    level: 1,
    prompt: 'ひだりの 2の 位置《いち》に 30g。みぎの 3の 位置《いち》に なんg で つりあう？',
    hints: [
      '「位置《いち》 × 重《おも》さ」を くらべよう',
      'ひだりは 2 × 30 ＝ 60',
      'みぎも 3 × □ ＝ 60 に なる 重《おも》さ',
    ],
    explain: 'ひだりは 2 × 30 ＝ 60、みぎは 3 × 20 ＝ 60 で つりあうよ',
    identity: 'lever:reach:2x30:3',
    setup: {
      kind: 'lever',
      leftPos: [2],
      leftWeight: [30],
      rightPos: [3],
      rightWeight: [10, 20, 30, 40, 60],
    },
    task: { kind: 'reach', target: 'balance' },
    misconceptions: { weightOnly: 'mis-weight-only' },
  },
  {
    // 小4: 回路（モーターを速く回す）
    id: 'exp-sample:circuit-fast',
    engine: 'experiment',
    objective: 'current',
    level: 0,
    prompt: 'モーターが いちばん はやく まわる つなぎ方《かた》に して こたえよう',
    hints: [
      '乾電池《かんでんち》の かずと つなぎ方《かた》を かえて やってみよう',
      '2この つなぎ方《かた》を くらべよう',
      '直列《ちょくれつ》と 並列《へいれつ》、はやいのは どっち？',
    ],
    explain:
      '乾電池《かんでんち》 2こを 直列《ちょくれつ》に つなぐと 電流《でんりゅう》が 大《おお》きく なって はやく まわるよ',
    identity: 'circuit:reach:fast',
    setup: { kind: 'circuit', device: 'motor', cells: [1, 2], connection: ['series', 'parallel'] },
    task: { kind: 'reach', target: 'fast' },
    misconceptions: { seriesParallel: 'mis-parallel' },
  },
  {
    // 小3: 磁石（固定表）
    id: 'exp-sample:magnet-table',
    engine: 'experiment',
    objective: 'magnet',
    level: 0,
    prompt: 'じしゃくに つく ものは どれ？ やってみて こたえよう',
    hints: [
      'いろいろな ものを じしゃくに ちかづけて みよう',
      'つく ものと つかない ものを 表《ひょう》で くらべよう',
      '鉄《てつ》で できて いる ものは どれ？',
    ],
    explain: '鉄《てつ》の くぎは じしゃくに つくよ。アルミかんや 10円玉《えんだま》は つかないよ',
    identity: 'magnet:consider:nail',
    setup: {
      kind: 'table',
      factors: [
        {
          id: 'thing',
          label: 'もの',
          values: [
            { id: 'nail', label: '鉄《てつ》の くぎ' },
            { id: 'can', label: 'アルミかん' },
            { id: 'coin', label: '10円玉《えんだま》' },
          ],
        },
      ],
      output: 'じしゃくに',
      rows: [
        { when: { thing: 'nail' }, result: 'つく' },
        { when: { thing: 'can' }, result: 'つかない' },
        { when: { thing: 'coin' }, result: 'つかない' },
      ],
    },
    task: {
      kind: 'consider',
      minTrials: 3,
      options: [
        { label: '鉄《てつ》の くぎ', correct: true },
        { label: 'アルミかん', misconception: 'mis-all-metal' },
        { label: '10円玉《えんだま》', misconception: 'mis-all-metal' },
      ],
    },
  },
];
