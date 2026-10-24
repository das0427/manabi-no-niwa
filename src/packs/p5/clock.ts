/**
 * p5.math.clock とけい（curriculum-matrix 3.3・4.4）: 「なんじ」（ちょうどの時刻）まで。読みと見通しまで（統括の判断9）。
 * 段階0: 「3じの とけいは どれ？」（pick。3択）。段階1: はりを まわして「なんじ」に あわせる（set。1じかんきざみ）。
 * 段階2: くらしの 場面と 時刻（別例）。「なんじはん」以降は小1（g1.math.clock）。
 * 同一性キー: pick:h、set:h、場面 scene:名前。図は clock エンジンが描く（item.figure を付けない）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { ClockItem, ClockTime } from '../../engines/clock/clock';
import { mix } from './lib';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MIS = { swapHands: 'swap-hands', hourNext: 'hour-next', hourPrev: 'hour-next' } as const;

/** 選択肢: 正答、長針と短針を入れかえた時計（12じ以外）、となりの時刻 */
function pickOptions(h: number): ClockTime[] {
  const out: ClockTime[] = [{ h, m: 0 }];
  if (h !== 12) out.push({ h: 12, m: h * 5 });
  out.push({ h: (h % 12) + 1, m: 0 });
  if (out.length < 3) out.push({ h: h === 1 ? 12 : h - 1, m: 0 });
  return mix(`pick:${h}`, out);
}

function pickItem(h: number): ClockItem {
  return {
    engine: 'clock',
    id: `pick:${h}`,
    objective: 'pick',
    level: 0,
    prompt: `${h}じの とけいは どれ？`,
    hints: [
      'みじかい はりを みよう。',
      `ながい はりが うえの 12を さして、みじかい はりが ${h}を さして いるのは どれかな。`,
    ],
    explain: `みじかい はりが ${h}、ながい はりが 12で ${h}じ だよ。`,
    identity: `pick:${h}`,
    task: { kind: 'pick', time: { h, m: 0 }, options: pickOptions(h) },
    misconceptions: MIS,
  };
}

function setItem(h: number): ClockItem {
  const start = { h: h === 12 ? 6 : 12, m: 0 };
  return {
    engine: 'clock',
    id: `set:${h}`,
    objective: 'set',
    level: 1,
    prompt: `はりを まわして ${h}じに しよう。`,
    hints: ['ながい はりは 12の まま だよ。', `みじかい はりを ${h}に あわせよう。`],
    explain: `みじかい はりが ${h}、ながい はりが 12で ${h}じ。`,
    identity: `set:${h}`,
    task: { kind: 'set', target: { h, m: 0 }, start, step: 60 },
    misconceptions: MIS,
  };
}

/** くらしの場面（一般的な例。家庭によって違う時刻でよい、と解説に書く） */
const SCENES: { id: string; text: string; h: number; set?: boolean }[] = [
  { id: 'wake', text: 'あさ 7じに おきるよ。7じの とけいは どれ？', h: 7 },
  { id: 'lunch', text: 'おひるごはんは 12じ。12じの とけいは どれ？', h: 12 },
  { id: 'snack', text: 'おやつは 3じ。3じの とけいは どれ？', h: 3 },
  { id: 'bath', text: 'ゆうがた 6じに おふろ。6じの とけいは どれ？', h: 6 },
  { id: 'sleep', text: 'よる 8じに ねるよ。とけいを 8じに しよう。', h: 8, set: true },
  { id: 'park', text: '10じに こうえんへ いくよ。とけいを 10じに しよう。', h: 10, set: true },
  { id: 'dinner', text: 'ばんごはんは 7じ。とけいを 7じに しよう。', h: 7, set: true },
  { id: 'kinder', text: '9じに ようちえんへ いくよ。9じの とけいは どれ？', h: 9 },
  { id: 'nap', text: '1じに おひるねを するよ。1じの とけいは どれ？', h: 1 },
  { id: 'walk', text: '4じに さんぽに いくよ。とけいを 4じに しよう。', h: 4, set: true },
  { id: 'shop', text: '11じに かいものに いくよ。11じの とけいは どれ？', h: 11 },
  { id: 'play', text: '2じに こうえんで あそぶよ。とけいを 2じに しよう。', h: 2, set: true },
];

function sceneItem(s: (typeof SCENES)[number]): ClockItem {
  const base = s.set ? setItem(s.h) : pickItem(s.h);
  return {
    ...base,
    id: `scene:${s.id}`,
    objective: s.set ? 'set' : 'pick',
    level: 2,
    alt: true,
    prompt: s.text,
    explain: `${base.explain} おうちに よって じかんは ちがっても いいよ。`,
    identity: `scene:${s.id}`,
  };
}

function build(): Item[] {
  return [...range(1, 12).map(pickItem), ...range(1, 12).map(setItem), ...SCENES.map(sceneItem)];
}

export const clockUnit: UnitSpec = {
  id: 'p5.math.clock',
  title: 'とけい',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'p5-clock',
  prereq: [],
  objectives: [
    { id: 'pick', title: '「なんじ」の とけいを えらぶ' },
    { id: 'set', title: 'はりを まわして「なんじ」に する' },
  ],
  misconceptions: [
    {
      id: 'swap-hands',
      explain:
        'ながい はりと みじかい はりが いれかわったかな。「なんじ」は みじかい はりで よむよ。',
    },
    {
      id: 'hour-next',
      explain:
        'となりの すうじを みたのかな。みじかい はりが まっすぐ さして いる すうじを みよう。',
    },
    { id: 'long-hand', explain: '「なんじ ちょうど」の ときは、ながい はりは いつも 12だよ。' },
  ],
  levels: [
    { label: '「なんじ」の とけいを えらぶ', chance: 1 / 3 },
    { label: 'はりを あわせる（なんじ）', chance: 1 / 12 },
    { label: 'くらしの ばめんと じこく', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'とけいには ながい はりと みじかい はりが あるよ。',
      figure: { kind: 'clock', h: 3, m: 0 },
    },
    {
      text: 'ながい はりが 12、みじかい はりが 3の とき、3じ。',
      figure: { kind: 'clock', h: 3, m: 0 },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '教材会社の目安（教C1）、小学校学習指導要領 算数 第1学年 C（時刻の読み）へ接続、curriculum-matrix 3.3・4.4',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
