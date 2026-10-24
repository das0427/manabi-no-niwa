/** sort の見本の問題（統括が画面で確かめる用。checkSort が誤りを返さないことをテストで確かめる） */
import type { SortItem } from './sort';

export const sortSamples: SortItem[] = [
  {
    engine: 'sort',
    id: 'sample-sort:food-animal',
    objective: 'sort-kind',
    level: 0,
    prompt: 'たべもの と どうぶつに わけよう。',
    boxes: [
      { figure: { kind: 'illust', id: 'apple' }, name: 'たべもの' },
      { figure: { kind: 'illust', id: 'dog' }, name: 'どうぶつ' },
    ],
    cards: [
      { figure: { kind: 'illust', id: 'banana' }, name: 'バナナ', box: 0 },
      { figure: { kind: 'illust', id: 'cat' }, name: 'ねこ', box: 1 },
      { figure: { kind: 'illust', id: 'onigiri' }, name: 'おにぎり', box: 0 },
      { figure: { kind: 'illust', id: 'rabbit' }, name: 'うさぎ', box: 1 },
    ],
    hints: ['たべられる ものは どれかな。', 'うごく いきものは どうぶつの はこへ。'],
    explain: 'バナナと おにぎりは たべもの、ねこと うさぎは どうぶつ だよ。',
    identity: 'sort:food-animal-1',
  },
  {
    engine: 'sort',
    id: 'sample-sort:even-odd',
    objective: 'sort-even-odd',
    level: 0,
    prompt: '偶数《ぐうすう》と 奇数《きすう》に わけよう。',
    boxes: [{ label: '偶数《ぐうすう》' }, { label: '奇数《きすう》' }],
    cards: [
      { label: '4', box: 0 },
      { label: '7', box: 1 },
      { label: '10', box: 0, wrongBoxes: [{ box: 1, misconception: 'parity-tens' }] },
      { label: '13', box: 1 },
      { label: '0', box: 0, wrongBoxes: [{ box: 1, misconception: 'parity-zero' }] },
      { label: '21', box: 1 },
    ],
    hints: [
      '2で わりきれる かずが 偶数《ぐうすう》だよ。',
      'いちの くらいの かずを みよう。',
      'いちの くらいが 0・2・4・6・8 なら 偶数《ぐうすう》だよ。',
    ],
    explain: '4・10・0 は 偶数《ぐうすう》、7・13・21 は 奇数《きすう》 だよ。',
    identity: 'sort:parity-4-7-10-13-0-21',
  },
];
