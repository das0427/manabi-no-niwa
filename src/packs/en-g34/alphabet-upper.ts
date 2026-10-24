/**
 * g3.en.alphabet-upper 文字《もじ》の 名前《なまえ》を 聞《き》いて 大文字《おおもじ》を えらぶ（curriculum-matrix 3.6。外活34）。
 * 3・4年は 文字を書かせない（2.3）。形の認識だけ。
 *   段階0: 名前を聞いて えらぶ（音の にている字が まぎらわしい選択肢）
 *   段階1: 形の にている字（E/F、M/N など）
 *   段階2: 身の回りの 大文字（BUS・STOP など。文字を1つずつ聞く）
 * 同一性キー: 形式 × 字（または語）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, enText, listen } from './lib';

export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** 名前の音が にている字（おわりの音が同じ なかま） */
const SOUND_GROUPS = ['BCDEGPTVZ', 'AHJK', 'FLMNSX', 'IY', 'QUW', 'OR'];
/** 形の にている字 */
export const SHAPE_ALIKE: Record<string, string> = {
  A: 'HV',
  B: 'PR',
  C: 'GO',
  D: 'OP',
  E: 'FB',
  F: 'EP',
  G: 'CO',
  H: 'NA',
  I: 'LT',
  J: 'IU',
  K: 'XR',
  L: 'IJ',
  M: 'NW',
  N: 'MH',
  O: 'QC',
  P: 'RF',
  Q: 'OG',
  R: 'PK',
  S: 'ZG',
  T: 'IY',
  U: 'VJ',
  V: 'UY',
  W: 'MV',
  X: 'KY',
  Y: 'VX',
  Z: 'NS',
};

export const abc = (c: string) => en('abc', c);

/** 音の にている字を2つ（足りなければ形の にている字） */
function soundAlike(c: string): [string, string][] {
  const g = SOUND_GROUPS.find((s) => s.includes(c))!;
  const i = g.indexOf(c);
  const out: [string, string][] = [];
  for (let k = 1; k < g.length && out.length < 2; k++)
    out.push([g[(i + k) % g.length]!, 'sound-alike']);
  for (const s of SHAPE_ALIKE[c]!)
    if (out.length < 2 && !out.some(([x]) => x === s)) out.push([s, 'shape-alike']);
  return out;
}

const half = (c: string) => (c <= 'M' ? 'am' : 'nz');

function nameItems(): Item[] {
  const out: Item[] = [];
  UPPER.forEach((c) => {
    const opts: ChoiceOption[] = [
      { label: c, correct: true },
      ...soundAlike(c).map(([x, m]) => ({ label: x, misconception: m })),
    ];
    out.push(
      listen({
        id: `name:${c}`,
        objective: half(c),
        level: 0,
        prompt: '聞《き》こえた 文字《もじ》は どれ？',
        audio: abc(c),
        options: opts,
        hints: [
          '文字《もじ》の 名前《なまえ》を さいごまで 聞《き》こう。',
          '名前《なまえ》の おわりの 音《おと》が にている 文字《もじ》が あるよ。はじめの 音《おと》を くらべよう。',
          `アルファベットの ${c <= 'M' ? 'まえの はんぶん（AからM）' : 'うしろの はんぶん（NからZ）'}に ある 文字《もじ》だよ。`,
        ],
        explain:
          'こたえの 文字《もじ》を ゆびで なぞりながら、名前《なまえ》を まねして いって みよう。',
        explainFigure: enText(c, 'xl'),
        identity: `name:${c}`,
      }),
    );
    const shapeOpts: ChoiceOption[] = [
      { label: c, correct: true },
      ...SHAPE_ALIKE[c]!.split('').map((x) => ({ label: x, misconception: 'shape-alike' })),
    ];
    out.push(
      listen({
        id: `shape:${c}`,
        objective: half(c),
        level: 1,
        prompt:
          '聞《き》こえた 文字《もじ》は どれ？ 形《かたち》が にているので よく 見《み》よう。',
        audio: abc(c),
        options: shapeOpts,
        hints: [
          '名前《なまえ》を 聞《き》いたら、その 文字《もじ》の 形《かたち》を おもいうかべよう。',
          'ぼうの かず、まるい ところ、とびでた ところを くらべよう。',
          `アルファベットの ${c <= 'M' ? 'まえの はんぶん' : 'うしろの はんぶん'}に ある 文字《もじ》だよ。`,
        ],
        explain:
          '形《かたち》の にている 文字《もじ》と くらべて、ちがう ところを 見《み》つけよう。',
        explainFigure: {
          kind: 'row',
          items: [enText(c, 'xl'), enText(SHAPE_ALIKE[c]!.split('').join(' '), 'l')],
          gap: 24,
        },
        identity: `shape:${c}`,
      }),
    );
  });
  // 別例: 2つ 続けて 聞いて、文字の ならびを えらぶ
  const PAIRS = [
    'BD',
    'EG',
    'MC',
    'KA',
    'HJ',
    'FL',
    'NM',
    'TP',
    'QU',
    'RO',
    'SX',
    'VZ',
    'WY',
    'IZ',
  ];
  PAIRS.forEach((p) => {
    const [a, b] = [p[0]!, p[1]!];
    const sub = soundAlike(b)[0]![0];
    out.push(
      listen({
        id: `pair:${p}`,
        objective: half(a),
        level: 1,
        prompt:
          '文字《もじ》を 2つ つづけて いうよ。聞《き》こえた じゅんに ならんで いるのは どれ？',
        audio: [abc(a), abc(b)],
        gapMs: 600,
        options: [
          { label: `${a} ${b}`, correct: true },
          { label: `${b} ${a}`, misconception: 'pair-order' },
          { label: `${a} ${sub}`, misconception: 'sound-alike' },
        ],
        hints: [
          '1つめと 2つめを わけて 聞《き》こう。',
          'じゅんばんにも 気《き》を つけよう。',
          `1つめは ${a}だよ。`,
        ],
        explain: `聞《き》こえた じゅんに ${a}、${b}です。`,
        explainFigure: enText(`${a}  ${b}`, 'xl'),
        identity: `pair:${p}`,
        alt: true,
      }),
    );
  });
  return out;
}

/** 身の回りの 大文字（看板・標識など。特定の商品名・団体名は使わない） */
const SIGNS: { word: string; ja: string; wrong: [string, string] }[] = [
  { word: 'BUS', ja: 'バスの のりば', wrong: ['BOX', 'SUN'] },
  { word: 'STOP', ja: 'とまれ', wrong: ['SHOP', 'TOP'] },
  { word: 'EXIT', ja: 'でぐち', wrong: ['EDIT', 'TAXI'] },
  { word: 'OPEN', ja: 'あいて います', wrong: ['OVEN', 'PEN'] },
  { word: 'ZOO', ja: 'どうぶつえん', wrong: ['TOO', 'MOO'] },
  { word: 'TAXI', ja: 'タクシーの のりば', wrong: ['TAX', 'EXIT'] },
  { word: 'PARK', ja: 'こうえん', wrong: ['PACK', 'DARK'] },
  { word: 'UP', ja: 'うえへ', wrong: ['US', 'CUP'] },
  { word: 'TV', ja: 'テレビ', wrong: ['TY', 'IV'] },
  { word: 'WC', ja: 'トイレ', wrong: ['WE', 'VC'] },
];

function signItems(): Item[] {
  const out: Item[] = [];
  SIGNS.forEach((s) => {
    out.push(
      listen({
        id: `sign:${s.word}`,
        objective: 'sign',
        level: 2,
        prompt: '文字《もじ》を 1つずつ いうよ。どの かんばんの 文字《もじ》かな？',
        audio: s.word.split('').map(abc),
        gapMs: 500,
        options: [
          { label: s.word, correct: true },
          { label: s.wrong[0], misconception: 'one-letter' },
          { label: s.wrong[1], misconception: 'one-letter' },
        ],
        hints: [
          `文字《もじ》は ぜんぶで ${s.word.length}こ だよ。`,
          '1つめの 文字《もじ》から じゅんに たしかめよう。',
          `${s.ja}を あらわす かんばんだよ。`,
        ],
        explain: `${s.word.split('').join('、')}の じゅん。まちで「${s.ja}」を あらわす ときに 見《み》かけるよ。`,
        explainFigure: enText(s.word, 'xl'),
        identity: `sign:${s.word}`,
      }),
    );
  });
  // 別例: 1文字を 聞いて、その文字が 入っている かんばんを えらぶ
  const FIND: { c: string; right: string; wrong: [string, string] }[] = [
    { c: 'B', right: 'BUS', wrong: ['STOP', 'ZOO'] },
    { c: 'X', right: 'EXIT', wrong: ['OPEN', 'PARK'] },
    { c: 'Z', right: 'ZOO', wrong: ['BUS', 'STOP'] },
    { c: 'K', right: 'PARK', wrong: ['TAXI', 'OPEN'] },
    { c: 'N', right: 'OPEN', wrong: ['STOP', 'EXIT'] },
    { c: 'A', right: 'TAXI', wrong: ['STOP', 'BUS'] },
    { c: 'V', right: 'TV', wrong: ['UP', 'BUS'] },
  ];
  for (const f of FIND) {
    out.push(
      listen({
        id: `find:${f.c}`,
        objective: 'sign',
        level: 2,
        prompt: '聞《き》こえた 文字《もじ》が 入《はい》って いる かんばんは どれ？',
        audio: abc(f.c),
        options: [
          { label: f.right, correct: true },
          ...f.wrong.map((w) => ({ label: w, misconception: 'sound-alike' })),
        ],
        hints: [
          'まず 文字《もじ》の 名前《なまえ》を 聞《き》きとろう。',
          'かんばんの 文字《もじ》を 1つずつ 見《み》よう。',
          'その 文字《もじ》の 形《かたち》を おもいうかべてから さがそう。',
        ],
        explain: `${f.right}の 中《なか》に ${f.c}が あります。`,
        explainFigure: enText(f.right, 'xl'),
        identity: `find:${f.c}`,
        alt: true,
      }),
    );
  }
  return out;
}

export const alphabetUpper: UnitSpec = {
  id: 'g3.en.alphabet-upper',
  title: 'アルファベット（大文字《おおもじ》）',
  stage: 'g3',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: [],
  objectives: [
    { id: 'am', title: 'AからMの 名前《なまえ》と 形《かたち》が むすびつく' },
    { id: 'nz', title: 'NからZの 名前《なまえ》と 形《かたち》が むすびつく' },
    { id: 'sign', title: 'みのまわりの 大文字《おおもじ》が わかる' },
  ],
  misconceptions: [
    {
      id: 'sound-alike',
      explain:
        '名前《なまえ》の 音《おと》が にている 文字《もじ》と まちがえたのかな。名前《なまえ》の はじめの 音《おと》を よく 聞《き》こう。',
    },
    {
      id: 'shape-alike',
      explain:
        '形《かたち》が にている 文字《もじ》と まちがえたのかな。ぼうの かずや まるい ところを くらべよう。',
    },
    {
      id: 'pair-order',
      explain: 'じゅんばんが ぎゃくに なったのかな。1つめから じゅんに 聞《き》こう。',
    },
    {
      id: 'one-letter',
      explain: 'にている かんばんと まちがえたのかな。文字《もじ》を 1つずつ たしかめよう。',
    },
  ],
  levels: [
    { label: '名前《なまえ》を 聞《き》いて えらぶ', chance: 0.05 },
    { label: '形《かたち》の にている 文字《もじ》', chance: 0.05 },
    { label: 'みのまわりの 大文字《おおもじ》', chance: 0.05 },
  ],
  intro: [
    {
      text: 'アルファベットには 1つずつ 名前《なまえ》が あるよ。名前《なまえ》を 聞《き》いて、文字《もじ》を えらぼう。',
      figure: enText('A  B  C', 'xl'),
    },
    {
      text: 'この 2つのように、形《かたち》の にている 文字《もじ》も あるよ。ちがう ところを よく 見《み》よう。',
      figure: enText('E   F', 'xl'),
    },
    {
      text: 'まちの かんばんにも 大文字《おおもじ》が あるよ。さがして みよう。',
      figure: enText('BUS', 'xl'),
    },
  ],
  source: { kind: 'items', items: [...nameItems(), ...signItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（文字の読み方が発音されるのを聞いた際に、どの文字であるかが分かる）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
