/** numberline の見本の問題（統括が画面で確かめる用。checkNumberline が誤りを返さないこと） */
import type { NumberlineItem } from './numberline';

export const numberlineSamples: NumberlineItem[] = [
  {
    id: 'nl-sample:read-13',
    engine: 'numberline',
    objective: 'read',
    level: 0,
    prompt: '↓の ところの かずは いくつ？',
    hints: [
      '5ずつの ながい めもりを みよう',
      '10の めもりから みぎへ かぞえよう',
      '10から 1めもり、2めもり、…と かぞえると？',
    ],
    explain: '10から みぎへ 3めもりで 13だよ',
    identity: 'read:0-20:13',
    line: { min: 0, max: 20, minor: 1, midEvery: 5, majorEvery: 10 },
    task: { kind: 'read', at: 13 },
    misconceptions: { neighborTick: 'mis-count-tick' },
  },
  {
    id: 'nl-sample:place-0.7',
    engine: 'numberline',
    objective: 'place',
    level: 1,
    prompt: '0.7 の ところを タップしよう',
    hints: [
      '0と 1の あいだが 10こに わけて あるよ',
      '1めもりは 0.1 だよ',
      '0から 0.1が 7こ ぶん すすもう',
    ],
    explain: '1めもりは 0.1。0から 7めもりで 0.7 だよ',
    identity: 'place:0-2/0.1:0.7',
    line: { min: 0, max: 2, minor: 0.1, midEvery: 5, majorEvery: 10 },
    task: { kind: 'place', target: 0.7 },
    misconceptions: { minorAsOne: 'mis-minor-as-one', neighborTick: 'mis-count-tick' },
  },
  {
    id: 'nl-sample:read-3/5',
    engine: 'numberline',
    objective: 'read',
    level: 2,
    prompt: '↓の ところの かずを ぶんすうで こたえよう',
    hints: [
      '0と 1の あいだは いくつに わけて あるかな',
      '1めもりは [[1/5]] だよ',
      '[[1/5]] が いくつ ぶんかな',
    ],
    explain: '1を 5つに わけた 3つ ぶんで [[3/5]] だよ',
    identity: 'read:0-1/5:3/5',
    line: { min: 0, max: 2, minor: '1/5', majorEvery: 5 },
    task: { kind: 'read', at: '3/5', keys: ['fraction'] },
    wrongAnswers: [{ value: 3, misconception: 'mis-minor-as-one' }],
  },
];
