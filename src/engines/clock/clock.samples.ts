/** clock の見本の問題（統括が画面で確かめる用。checkClock が誤りを返さないこと） */
import type { ClockItem } from './clock';

export const clockSamples: ClockItem[] = [
  {
    // 幼児（p5）: 時刻に合う時計を選ぶ
    id: 'clock-sample:pick-3',
    engine: 'clock',
    objective: 'o-clock',
    level: 0,
    prompt: '3じの とけいは どれ？',
    hints: ['みじかい はりを みよう', 'みじかい はりが 3を さして いるのは どれかな'],
    explain: 'みじかい はりが 3、ながい はりが 12 で 3じ だよ',
    identity: 'pick:3:00',
    task: {
      kind: 'pick',
      time: { h: 3, m: 0 },
      options: [
        { h: 3, m: 0 },
        { h: 12, m: 15 },
        { h: 9, m: 0 },
      ],
    },
    misconceptions: { swapHands: 'mis-swap-hands' },
  },
  {
    // 小1: 針を合わせる（5分きざみ）
    id: 'clock-sample:set-7:30',
    engine: 'clock',
    objective: 'set-half',
    level: 1,
    prompt: '7じはんに はりを あわせよう',
    hints: [
      'さきに みじかい はりを 7に しよう',
      'はん は ながい はりが 6の ところ',
      'ながい はりを 6に すると、みじかい はりは 7と 8の あいだに うごくよ',
    ],
    explain: 'ながい はりが 6、みじかい はりが 7と 8の あいだで 7じはん だよ',
    identity: 'set:7:30',
    task: { kind: 'set', target: { h: 7, m: 30 }, start: { h: 12, m: 0 }, step: 5 },
    misconceptions: { hourNext: 'mis-hour-next', hourPrev: 'mis-hour-prev' },
  },
  {
    // 小2: 時間の経過（おわりの時刻を数字で）
    id: 'clock-sample:elapsed-8:40+30',
    engine: 'clock',
    objective: 'after',
    level: 2,
    prompt: '8じ40ぷんの 30ぷんごは なんじ なんぷん？',
    hints: [
      'おびの 9じの めもりを みよう',
      '8じ40ぷんから 9じまでは 20ぷん',
      '9じから あと 10ぷん すすむと？',
    ],
    explain: '8じ40ぷんから 20ぷんで 9じ、あと 10ぷんで 9じ10ぷん だよ',
    identity: 'end:8:40+30',
    task: {
      kind: 'elapsed',
      start: { h: 8, m: 40 },
      end: { h: 9, m: 10 },
      ask: 'end',
      answerBy: 'input',
    },
    misconceptions: { noCarry: 'mis-no-carry' },
    minuteNumbers: true,
  },
];
