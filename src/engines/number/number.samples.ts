/** number の見本の問題（統括が画面で確かめる用。checkNumberItem が誤りを返さないこと） */
import type { NumberItem } from '../../curriculum/types';

const base = {
  engine: 'number' as const,
  level: 0,
  hints: ['いちの くらいから じゅんに', 'くりあがりに きを つけよう', 'さいごに たしかめよう'],
};

export const numberSamples: NumberItem[] = [
  {
    ...base,
    // 単位を欄の後ろに（「□ cm」）
    id: 'number-sample:unit',
    objective: 'unit-suffix',
    prompt: '1m は なん cm？',
    hints: ['ものさしを おもいだそう', '1m は 1cmの いくつぶん かな', '1m ＝ 100cm'],
    explain: '1m は 100cm だよ',
    identity: 'unit:1m=100cm',
    fields: [{ answer: { kind: 'int', value: 100 }, unit: 'cm' }],
    wrongAnswers: [{ value: '10', misconception: 'mis-unit-10' }],
  },
  {
    ...base,
    // 兆の数（13けた）。表示だけ 4けたごとに区切る
    id: 'number-sample:big',
    objective: 'big-number',
    prompt: '3兆《ちょう》を すうじで かこう',
    hints: [
      '1兆《ちょう》は 0が 12こ',
      '4けたずつ 区切《くぎ》ると よみやすいよ',
      '3の あとに 0を 12こ',
    ],
    explain: '3兆《ちょう》は 3000000000000（0が 12こ）だよ',
    identity: 'big:3e12',
    fields: [{ answer: { kind: 'int', value: 3000000000000 }, digitGroup: 4 }],
    wrongAnswers: [{ value: '300000000000', misconception: 'mis-zero-count' }],
  },
  {
    ...base,
    // たし算の筆算（くり上がりのメモ付き）
    id: 'number-sample:col-add',
    objective: 'column-add',
    prompt: 'ひっさんで けいさんしよう',
    explain: '487 ＋ 356 ＝ 843。くり上《あ》がりを 2かい するよ',
    identity: 'col:487+356',
    fields: [{ answer: { kind: 'int', value: 843 } }],
    wrongAnswers: [{ value: '733', misconception: 'mis-no-carry' }],
    column: { op: 'add', operands: [487, 356], memo: true },
  },
  {
    ...base,
    // ひき算の筆算（くり下がりのメモ付き。0 の位から くり下がる）
    id: 'number-sample:col-sub',
    objective: 'column-sub',
    prompt: 'ひっさんで けいさんしよう',
    hints: ['いちの くらいから ひこう', '3から 8は ひけないね', 'じゅうの くらいが 0のときは ひゃくの くらいから'],
    explain: '403 − 178 ＝ 225 だよ',
    identity: 'col:403-178',
    fields: [{ answer: { kind: 'int', value: 225 } }],
    wrongAnswers: [{ value: '375', misconception: 'mis-smaller-from-larger' }],
    column: { op: 'sub', operands: [403, 178], memo: true },
  },
  {
    ...base,
    // かけ算の筆算（1けた × 。くり上がりのメモ付き）
    id: 'number-sample:col-mul1',
    objective: 'column-mul',
    prompt: 'ひっさんで けいさんしよう',
    explain: '286 × 3 ＝ 858 だよ',
    identity: 'col:286x3',
    fields: [{ answer: { kind: 'int', value: 858 } }],
    wrongAnswers: [{ value: '648', misconception: 'mis-no-carry' }],
    column: { op: 'mul', operands: [286, 3], memo: true },
  },
  {
    ...base,
    // かけ算の筆算（2けた × 2けた。部分積の段）
    id: 'number-sample:col-mul2',
    objective: 'column-mul',
    prompt: 'ひっさんで けいさんしよう',
    hints: [
      'まず 23 × 5 を 1だんめに',
      'つぎに 23 × 4 を 2だんめに。じゅうの くらいから かくよ',
      'さいごに 2つの だんを たそう',
    ],
    explain: '23 × 5 ＝ 115、23 × 40 ＝ 920。あわせて 1035 だよ',
    identity: 'col:23x45',
    fields: [
      { answer: { kind: 'int', value: 115 } },
      { answer: { kind: 'int', value: 92 } },
      { answer: { kind: 'int', value: 1035 } },
    ],
    wrongAnswers: [{ value: '115|92|207', misconception: 'mis-partial-shift' }],
    column: { op: 'mul', operands: [23, 45] },
  },
  {
    ...base,
    // わり算の筆算（商が1けた。たてる・かける・ひく）
    id: 'number-sample:col-div',
    objective: 'column-div',
    prompt: 'ひっさんで けいさんしよう',
    hints: [
      '7は 8で われないね。75を 8で わろう',
      '8 × 9 ＝ 72',
      '75から 72を ひいた のこりが あまり',
    ],
    explain: '75 ÷ 8 ＝ 9 あまり 3 だよ',
    identity: 'col:75/8',
    fields: [
      { answer: { kind: 'int', value: 9 } },
      { answer: { kind: 'int', value: 72 } },
      { answer: { kind: 'int', value: 3 } },
    ],
    wrongAnswers: [{ value: '8|64|11', misconception: 'mis-remainder-too-big' }],
    column: { op: 'div', operands: [75, 8] },
  },
];
