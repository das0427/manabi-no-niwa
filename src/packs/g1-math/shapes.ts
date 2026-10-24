/**
 * g1.math.shapes ものの かたち（はこ・つつ・ボール）、かたちづくり（curriculum-matrix 3.4）。
 *
 * 到達項目: なかま（立体の仲間分け）・とくちょう（ころがる／たいらな ところ）・うつす（写し取った面の形）・
 *   かたちづくり（格子に同じ形をかく）。
 * 同一性キー: 仲間分け・選ぶ問題は「問い × 出した物の組」（並びは同じとみる）。かたちづくりは形と大きさ
 *   （向きはこの単元の学習内容でないので、回転しただけの形は同じ: 1.4）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem } from '../../engines/geometry/geometry';
import type { SortItem } from '../../engines/sort/sort';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Cls = 'box' | 'cyl' | 'ball';
type Face = 'square' | 'rect' | 'circle' | 'triangle';
type Obj = 'nakama' | 'tokucho' | 'utsusu' | 'katachi';

interface Thing {
  id: string;
  name: string;
  cls: Cls | 'prism';
  /** かみに おしつけて うつしとれる めんの かたち（ボールは無し） */
  face?: Face;
}

const THINGS: Thing[] = [
  { id: 'g1m-box', name: 'おかしの はこ', cls: 'box', face: 'rect' },
  { id: 'g1m-dice', name: 'さいころ', cls: 'box', face: 'square' },
  { id: 'g1m-tissue', name: 'ティッシュの はこ', cls: 'box', face: 'rect' },
  { id: 'g1m-block', name: 'つみきの はこ', cls: 'box', face: 'rect' },
  { id: 'g1m-can', name: 'かん', cls: 'cyl', face: 'circle' },
  { id: 'g1m-roll', name: 'まいた かみ', cls: 'cyl', face: 'circle' },
  { id: 'g1m-cyl', name: 'つみきの つつ', cls: 'cyl', face: 'circle' },
  { id: 'ball', name: 'ボール', cls: 'ball' },
  { id: 'mikan', name: 'みかん', cls: 'ball' },
  { id: 'watermelon', name: 'すいか', cls: 'ball' },
  { id: 'tomato', name: 'トマト', cls: 'ball' },
  { id: 'g1m-cheese', name: 'さんかくの はこ', cls: 'prism', face: 'triangle' },
];
/** 仲間分けに使う物（はこ・つつ・ボールの どれか） */
const SOLIDS = THINGS.filter((t) => t.cls !== 'prism');
/** 面を写し取れる物 */
const STAMPS = THINGS.filter((t) => t.face);

const CLS_NAME: Record<Cls, string> = {
  box: 'はこの かたち',
  cyl: 'つつの かたち',
  ball: 'ボールの かたち',
};
const CLS_INDEX: Record<Cls, number> = { box: 0, cyl: 1, ball: 2 };
const FACE_NAME: Record<Face, string> = {
  square: 'しかく',
  rect: 'しかく',
  circle: 'まる',
  triangle: 'さんかく',
};

const ill = (id: string): Figure => ({ kind: 'illust', id });
const card = (t: Thing) => ({ figure: ill(t.id), name: t.name });
const idsKey = (ts: Thing[]) =>
  ts
    .map((t) => t.id)
    .sort()
    .join(',');

const FACE_FIG: Record<Face, Figure> = {
  circle: { kind: 'shape', shape: 'circle', w: 60, h: 60 },
  triangle: { kind: 'shape', shape: 'triangle', w: 70, h: 60 },
  square: { kind: 'shape', shape: 'square', w: 60, h: 60 },
  rect: { kind: 'shape', shape: 'rect', w: 90, h: 50 },
};

/** n 個を選ぶ（cond を満たすまで選び直す。選び直しは定義域の中で均等） */
function sampleWhere(rng: Rng, pool: Thing[], n: number, cond: (ts: Thing[]) => boolean): Thing[] {
  for (let i = 0; i < 100; i++) {
    const s = rng.sample(pool, n);
    if (cond(s)) return s;
  }
  throw new Error('sampleWhere: 条件を満たす組が無い');
}
const kinds = (ts: Thing[]) => new Set(ts.map((t) => t.cls)).size;

// ---- なかま ----
function nakamaSort(level: number, rng: Rng): SortItem {
  const ts = sampleWhere(rng, SOLIDS, 6, (s) => kinds(s) >= 2);
  return {
    engine: 'sort',
    id: `nakama:${idsKey(ts)}`,
    objective: 'nakama',
    level,
    prompt: 'おなじ かたちの なかまに わけよう。',
    fixedOrder: true,
    boxes: [{ label: CLS_NAME.box }, { label: CLS_NAME.cyl }, { label: CLS_NAME.ball }],
    cards: ts.map((t) => {
      const c = t.cls as Cls;
      const wrong =
        c === 'cyl'
          ? [
              { box: 0, misconception: 'cyl-as-box' },
              { box: 2, misconception: 'cyl-as-ball' },
            ]
          : c === 'box'
            ? [
                { box: 1, misconception: 'cyl-as-box' },
                { box: 2, misconception: 'look-not-shape' },
              ]
            : [
                { box: 0, misconception: 'look-not-shape' },
                { box: 1, misconception: 'cyl-as-ball' },
              ];
      return { ...card(t), box: CLS_INDEX[c], wrongBoxes: wrong };
    }),
    hints: [
      'いろや おおきさでは なく、かたちを みよう。',
      'たいらな ところと、まるい ところを さがそう。かどが あれば はこ、どこも まるければ ボール。',
      'まるい たいらな めんが あって、よこに すると ころがる ものは…',
    ],
    explain:
      'かどの ある ものは はこの かたち、まるい めんが 2つ ある ものは つつの かたち、どこから みても まるい ものは ボールの かたち だよ。',
    identity: `nakama:${idsKey(ts)}`,
  };
}

function nakamaPick(level: number, rng: Rng): GeometryItem {
  const target = rng.pick<Cls>(['box', 'cyl', 'ball']);
  const ts = sampleWhere(
    rng,
    SOLIDS,
    4,
    (s) => s.some((t) => t.cls === target) && s.some((t) => t.cls !== target),
  );
  const misOf = (c: Cls): string =>
    (target === 'cyl' && c === 'box') || (target === 'box' && c === 'cyl')
      ? 'cyl-as-box'
      : (target === 'cyl' && c === 'ball') || (target === 'ball' && c === 'cyl')
        ? 'cyl-as-ball'
        : 'look-not-shape';
  return {
    engine: 'geometry',
    id: `nakama-alt:${target}:${idsKey(ts)}`,
    objective: 'nakama',
    level,
    alt: true,
    prompt: `${CLS_NAME[target]}の ものを ぜんぶ えらぼう。`,
    task: {
      kind: 'pick',
      multi: true,
      options: ts.map((t) =>
        t.cls === target
          ? { figure: ill(t.id), label: t.name, correct: true }
          : { figure: ill(t.id), label: t.name, misconception: misOf(t.cls as Cls) },
      ),
    },
    hints: [
      `${CLS_NAME[target]}は どんな かたちだったかな。`,
      target === 'box'
        ? 'たいらな めんと かどが ある ものを さがそう。'
        : target === 'cyl'
          ? 'まるい たいらな めんが ある ものを さがそう。'
          : 'どこから みても まるい ものを さがそう。',
      `${ts.filter((t) => t.cls === target)[0]!.name}は ${CLS_NAME[target]}。ほかにも あるかな。`,
    ],
    explain: `${ts
      .filter((t) => t.cls === target)
      .map((t) => t.name)
      .join('、')}が ${CLS_NAME[target]}だよ。`,
    identity: `nakama-alt:${target}:${idsKey(ts)}`,
  };
}

// ---- とくちょう（ころがる・つむ） ----
type Q = 'roll' | 'flat' | 'both';
const Q_TEXT: Record<Q, string> = {
  roll: 'どの むきに おいても よく ころがるのは どれ？',
  flat: 'どの むきに おいても ころがらず、たかく つみやすいのは どれ？',
  both: 'たてると つめて、よこに すると ころがるのは どれ？',
};
const Q_ANSWER: Record<Q, Cls> = { roll: 'ball', flat: 'box', both: 'cyl' };

function tokuchoChoice(level: number, rng: Rng): ChoiceItem {
  const q = rng.pick<Q>(['roll', 'flat', 'both']);
  const pickCls = (c: Cls) => rng.pick(SOLIDS.filter((t) => t.cls === c));
  const ts = (['box', 'cyl', 'ball'] as Cls[]).map(pickCls);
  const ans = Q_ANSWER[q];
  const mis = (c: Cls) =>
    (q === 'roll' && c === 'cyl') || (q === 'both' && c === 'ball') ? 'cyl-as-ball' : 'roll-stack';
  const key = `toku:${q}:${idsKey(ts)}`;
  return {
    engine: 'choice',
    id: key,
    objective: 'tokucho',
    level,
    prompt: Q_TEXT[q],
    layout: 'row',
    options: ts.map((t) =>
      t.cls === ans
        ? { figure: ill(t.id), label: t.name, correct: true }
        : { figure: ill(t.id), label: t.name, misconception: mis(t.cls as Cls) },
    ),
    hints: [
      'たいらな ところが あるか、まるい ところが あるかを みよう。',
      'たいらな ところで おくと とまる。まるい ところで おくと ころがるよ。',
      q === 'roll'
        ? 'たいらな ところが ひとつも ない ものは…'
        : q === 'flat'
          ? 'まるい ところが ひとつも ない ものは…'
          : 'たいらな まるい めんと、まるい よこが ある ものは…',
    ],
    explain:
      q === 'roll'
        ? 'ボールの かたちは たいらな ところが ないので、どの むきにも ころがるよ。'
        : q === 'flat'
          ? 'はこの かたちは たいらな めんだけで できて いるので、ころがらず つみやすいよ。'
          : 'つつの かたちは、たいらな めんを したに すると つめて、よこに すると ころがるよ。',
    identity: key,
  };
}

function tokuchoSort(level: number, rng: Rng): SortItem {
  const ts = sampleWhere(
    rng,
    SOLIDS,
    5,
    (s) => s.some((t) => t.cls === 'ball') && s.some((t) => t.cls !== 'ball'),
  );
  const key = `toku-alt:${idsKey(ts)}`;
  return {
    engine: 'sort',
    id: key,
    objective: 'tokucho',
    level,
    alt: true,
    prompt: 'たいらな ところが ある ものと、ない ものに わけよう。',
    fixedOrder: true,
    boxes: [{ label: 'たいらな ところが ある' }, { label: 'たいらな ところが ない' }],
    cards: ts.map((t) =>
      t.cls === 'ball'
        ? { ...card(t), box: 1, wrongBoxes: [{ box: 0, misconception: 'roll-stack' }] }
        : {
            ...card(t),
            box: 0,
            wrongBoxes: [{ box: 1, misconception: t.cls === 'cyl' ? 'cyl-as-ball' : 'roll-stack' }],
          },
    ),
    hints: [
      'つくえに おいて、ぴたっと とまる ところが あるか かんがえよう。',
      'はこの かたちにも つつの かたちにも、たいらな めんが あるよ。',
      'どこから さわっても まるい ものは…',
    ],
    explain:
      'はこの かたちと つつの かたちには たいらな ところが あるよ。ボールの かたちには ないね。',
    identity: key,
  };
}

// ---- うつす（写し取った面の形） ----
function faceOptions(t: Thing) {
  const face = t.face!;
  const sq: Face = face === 'square' || face === 'rect' ? face : 'square';
  const all: { f: Face; mis?: string }[] = [
    { f: 'circle', mis: face === 'circle' ? undefined : 'face-round' },
    { f: sq, mis: face === 'square' || face === 'rect' ? undefined : 'face-side' },
    { f: 'triangle', mis: face === 'triangle' ? undefined : 'corner-count' },
  ];
  return all.map(({ f, mis }) =>
    mis
      ? { figure: FACE_FIG[f], label: FACE_NAME[f], misconception: mis }
      : { figure: FACE_FIG[f], label: FACE_NAME[f], correct: true },
  );
}

function utsusuChoice(level: number, rng: Rng): ChoiceItem {
  const t = rng.pick(STAMPS);
  const key = `utsusu:${t.id}`;
  return {
    engine: 'choice',
    id: key,
    objective: 'utsusu',
    level,
    prompt: `${t.name}の そこを かみに おしつけて、まわりを なぞると どんな かたち？`,
    figure: ill(t.id),
    layout: 'row',
    options: faceOptions(t),
    hints: [
      'よこから みた かたちでは なく、したの たいらな めんを みよう。',
      `${t.name}を ひっくりかえして、そこを みる つもりで かんがえよう。`,
      t.face === 'circle' ? 'そこには かどが あるかな。' : `そこの かどを かぞえよう。1つ、2つ、…`,
    ],
    explain: `${t.name}の そこは ${FACE_NAME[t.face!]}。だから ${FACE_NAME[t.face!]}が うつしとれるよ。`,
    explainFigure: FACE_FIG[t.face!],
    identity: key,
  };
}

const faceGroup = (f: Face): 'circle' | 'quad' | 'triangle' =>
  f === 'circle' ? 'circle' : f === 'triangle' ? 'triangle' : 'quad';

function utsusuPick(level: number, rng: Rng): GeometryItem {
  const target = rng.pick<'circle' | 'quad' | 'triangle'>(['circle', 'quad', 'triangle']);
  const ts = sampleWhere(
    rng,
    STAMPS,
    4,
    (s) =>
      s.some((t) => faceGroup(t.face!) === target) && s.some((t) => faceGroup(t.face!) !== target),
  );
  const word = target === 'circle' ? 'まる' : target === 'quad' ? 'しかく' : 'さんかく';
  const misOf = (f: Face) =>
    target === 'circle'
      ? 'face-round'
      : target === 'quad' && f === 'circle'
        ? 'face-side'
        : 'corner-count';
  const key = `utsusu-alt:${target}:${idsKey(ts)}`;
  return {
    engine: 'geometry',
    id: key,
    objective: 'utsusu',
    level,
    alt: true,
    prompt: `そこを うつしとると ${word}に なる ものを ぜんぶ えらぼう。`,
    task: {
      kind: 'pick',
      multi: true,
      options: ts.map((t) =>
        faceGroup(t.face!) === target
          ? { figure: ill(t.id), label: t.name, correct: true }
          : { figure: ill(t.id), label: t.name, misconception: misOf(t.face!) },
      ),
    },
    hints: [
      'それぞれの そこの たいらな めんを おもいうかべよう。',
      target === 'circle'
        ? 'まるい めんが ある ものは つつの かたちだね。'
        : target === 'quad'
          ? 'かどが 4つの めんが ある ものを さがそう。'
          : 'かどが 3つの めんが ある ものを さがそう。',
      `${ts.find((t) => faceGroup(t.face!) === target)!.name}の そこは ${word}。ほかにも あるかな。`,
    ],
    explain: `${ts
      .filter((t) => faceGroup(t.face!) === target)
      .map((t) => t.name)
      .join('、')}の そこを うつすと ${word}に なるよ。`,
    identity: key,
  };
}

// ---- かたちづくり ----
type Pt = [number, number];
interface Shape {
  key: string;
  kind: 'square' | 'rectangle' | 'triangle';
  w: number;
  h: number;
}
const SHAPES: Shape[] = [
  ...[1, 2, 3].map((s) => ({ key: `sq${s}`, kind: 'square' as const, w: s, h: s })),
  ...(
    [
      [2, 1],
      [3, 1],
      [4, 1],
      [3, 2],
      [4, 2],
      [4, 3],
    ] as const
  ).map(([w, h]) => ({ key: `rect${w}x${h}`, kind: 'rectangle' as const, w, h })),
  ...(
    [
      [2, 1],
      [2, 2],
      [3, 2],
      [3, 1],
      [3, 3],
      [4, 2],
    ] as const
  ).map(([w, h]) => ({ key: `tri${w}x${h}`, kind: 'triangle' as const, w, h })),
];
const KIND_NAME = { square: 'しかく', rectangle: 'しかく', triangle: 'さんかく' } as const;

function pointsOf(s: Shape, x0 = 0, y0 = 0): Pt[] {
  return s.kind === 'triangle'
    ? [
        [x0, y0],
        [x0, y0 + s.h],
        [x0 + s.w, y0 + s.h],
      ]
    : [
        [x0, y0],
        [x0 + s.w, y0],
        [x0 + s.w, y0 + s.h],
        [x0, y0 + s.h],
      ];
}

function katachiDraw(level: number, rng: Rng): GeometryItem {
  const s = rng.pick(SHAPES);
  const pts = pointsOf(s);
  const key = `katachi:${s.key}`;
  return {
    engine: 'geometry',
    id: key,
    objective: 'katachi',
    level,
    prompt: 'ひだりの かたちと おなじ かたちを、あいて いる ところに かこう。',
    task: {
      kind: 'draw',
      grid: { w: 2 * s.w + 3, h: 4 },
      given: [{ points: pts }],
      target:
        s.kind === 'triangle'
          ? { kind: 'congruent', points: pts }
          : { kind: 'shape', shape: s.kind, sides: [s.w, s.h, s.w, s.h], exclusive: true },
    },
    misconceptions: { wrongSides: 'count-dots', wrongClass: 'corner-count' },
    hints: [
      'おてほんの かどの かずと、へんの ながさを みよう。',
      `よこは ${s.w}ます、たては ${s.h}ます だね。`,
      'さいしょの てんを きめて、ますを かぞえながら てんを つなごう。さいごに さいしょの てんへ もどるよ。',
    ],
    explain: `よこ ${s.w}ます、たて ${s.h}ますの ${KIND_NAME[s.kind]}。かどの かずと へんの ながさが おなじなら おなじ かたちだよ。`,
    identity: key,
  };
}

/** 図の多角形（格子の座標 → 0〜100 の座標、1ます = 24） */
function polyFig(pts: Pt[], w: number, h: number): Figure {
  return {
    kind: 'shape',
    shape: 'polygon',
    points: pts.map(([x, y]) => [(x / w) * 100, (y / h) * 100]),
    w: w * 24,
    h: h * 24,
  };
}
/** 90度まわした形 */
function rotated(s: Shape): Figure {
  const pts = pointsOf(s).map(([x, y]): Pt => [s.h - y, x]);
  return polyFig(pts, s.h, s.w);
}

function katachiChoice(level: number, rng: Rng): ChoiceItem {
  const s = rng.pick(SHAPES);
  // 辺の長さが違う同じ仲間（正方形は大きさだけ違うと同じ形なので、長方形を出す）
  const sameKind = SHAPES.filter(
    (o) =>
      o.key !== s.key &&
      (s.kind === 'triangle' ? o.kind === 'triangle' : o.kind === 'rectangle') &&
      o.w * s.h !== o.h * s.w,
  );
  const other = rng.pick(sameKind);
  const diff = rng.pick(SHAPES.filter((o) => (s.kind === 'triangle') !== (o.kind === 'triangle')));
  const key = `katachi-alt:${s.key}`;
  return {
    engine: 'choice',
    id: `${key}:${other.key}:${diff.key}`,
    objective: 'katachi',
    level,
    alt: true,
    prompt: 'うえの かたちと おなじ かたちは どれ？ むきが かわって いても よいよ。',
    figure: polyFig(pointsOf(s), s.w, s.h),
    layout: 'row',
    options: [
      { figure: rotated(s), correct: true },
      { figure: polyFig(pointsOf(other), other.w, other.h), misconception: 'count-dots' },
      { figure: polyFig(pointsOf(diff), diff.w, diff.h), misconception: 'corner-count' },
    ],
    hints: [
      'かどの かずを くらべよう。',
      'つぎに、ながい へんと みじかい へんの ながさを くらべよう。',
      'まわして かさねたら ぴったり あう ものは…',
    ],
    explain: 'まわすと ぴったり かさなる かたちが おなじ かたち。むきが ちがっても おなじだよ。',
    identity: key,
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['nakama', 'tokucho'] },
  // なかまを ふくしゅうに まぜる（うつす は物が9つだけなので、1つの問題に偏らないように）
  { objs: ['utsusu', 'katachi', 'nakama'] },
  { objs: ['nakama', 'tokucho', 'utsusu', 'katachi'] },
];

export function generateShapes(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  // うつす の練習は物が8つだけなので、別例（物の組を選ぶ）を多めに出して偏りを抑える
  const alt = rng.next() < (obj === 'utsusu' ? 0.5 : 0.3);
  switch (obj) {
    case 'nakama':
      return alt ? nakamaPick(level, rng) : nakamaSort(level, rng);
    case 'tokucho':
      return alt ? tokuchoSort(level, rng) : tokuchoChoice(level, rng);
    case 'utsusu':
      return alt ? utsusuPick(level, rng) : utsusuChoice(level, rng);
    case 'katachi':
      return alt ? katachiChoice(level, rng) : katachiDraw(level, rng);
  }
}

export const shapes: UnitSpec = {
  id: 'g1.math.shapes',
  title: 'いろいろな かたち',
  stage: 'g1',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: [],
  objectives: [
    { id: 'nakama', title: 'はこ・つつ・ボールの なかまに わける' },
    { id: 'tokucho', title: 'ころがる・つめる かたち' },
    { id: 'utsusu', title: 'うつしとった めんの かたち' },
    { id: 'katachi', title: 'おなじ かたちを かく' },
  ],
  misconceptions: [
    {
      id: 'look-not-shape',
      explain:
        'いろや おおきさ、なにに つかうかで わけたのかな。たいらな ところや まるい ところ、かたちを みよう。',
    },
    {
      id: 'cyl-as-box',
      explain:
        'つつと はこを おなじと かんがえたのかな。つつには まるい たいらな めんが あって、よこに すると ころがるよ。',
    },
    {
      id: 'cyl-as-ball',
      explain:
        'つつと ボールを おなじと かんがえたのかな。つつには たいらな めんが あるよ。ボールには たいらな ところが ないね。',
    },
    {
      id: 'roll-stack',
      explain:
        'ころがる ことと つみやすい ことを とりちがえたのかな。たいらな ところで おくと とまり、まるい ところで おくと ころがるよ。',
    },
    {
      id: 'face-side',
      explain:
        'よこから みた かたちと かんがえたのかな。かみに おしつける たいらな めん（そこ）の かたちを みよう。',
    },
    {
      id: 'face-round',
      explain: 'かどの ある めんを まると かんがえたのかな。かどが あるかを よく みよう。',
    },
    {
      id: 'corner-count',
      explain: 'かどの かずを かぞえて みよう。かどが 3つなら さんかく、4つなら しかくだよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'shape', shape: 'triangle', w: 70, h: 60 },
          { kind: 'shape', shape: 'square', w: 60, h: 60 },
        ],
      },
    },
    {
      id: 'count-dots',
      explain: 'へんの ながさが ちがうかも。てんと てんの あいだの ますを かぞえよう。',
    },
  ],
  levels: [
    { label: 'なかま・ころがる かたち', chance: 0.1 },
    { label: 'うつしとる・かたちづくり', chance: 0.1 },
    { label: 'まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'みの まわりの ものを、かたちで なかまに わけて みよう。はこの かたち、つつの かたち、ボールの かたち。',
      figure: {
        kind: 'row',
        items: [ill('g1m-box'), ill('g1m-can'), ill('ball')],
        gap: 4,
      },
    },
    {
      text: 'はこは たいらな めんで できて いて、つみやすい。ボールは どの むきにも ころがる。つつは よこに すると ころがるよ。',
      figure: { kind: 'row', items: [ill('g1m-dice'), ill('g1m-cyl'), ill('mikan')], gap: 4 },
    },
    {
      text: 'かんの そこを かみに おしつけて なぞると、まるが かけるよ。この かたちを「まる」と いうよ。',
      figure: {
        kind: 'row',
        items: [ill('g1m-can'), { kind: 'text', text: '→', size: 'l' }, FACE_FIG.circle],
        gap: 4,
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateShapes(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 B(1) 図形（ものの形を認め、形の特徴を捉える。形を写し取る・構成する）',
  revised: REVISED,
};
