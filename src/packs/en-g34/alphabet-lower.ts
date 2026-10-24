/**
 * g4.en.alphabet-lower 小文字《こもじ》（名前を聞いて選ぶ、大文字と組にする）（curriculum-matrix 3.7。外活34）。
 *   段階0: 名前を聞いて 小文字を えらぶ
 *   段階1: 大文字と 小文字を 線で むすぶ（match）
 *   段階2: 形の にている 小文字（b/d/p/q、m/n、h/n、i/j/l、u/v など）
 * 3・4年は 文字を書かせない（2.3）。同一性キー: 形式 × 字（match は 字の組）。
 */
import type { ChoiceOption, Item, MatchItem, UnitSpec } from '../../curriculum/types';
import { en, enText, listen } from './lib';

const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
const SOUND_GROUPS = ['bcdegptvz', 'ahjk', 'flmnsx', 'iy', 'quw', 'or'];
/** 形の にている 小文字 */
const SHAPE_ALIKE: Record<string, string> = {
  a: 'do',
  b: 'dp',
  c: 'eo',
  d: 'bq',
  e: 'co',
  f: 'tl',
  g: 'qy',
  h: 'nb',
  i: 'jl',
  j: 'ig',
  k: 'hx',
  l: 'it',
  m: 'nw',
  n: 'hu',
  o: 'ac',
  p: 'qb',
  q: 'pg',
  r: 'nv',
  s: 'zc',
  t: 'fl',
  u: 'nv',
  v: 'uy',
  w: 'mv',
  x: 'ky',
  y: 'vg',
  z: 'sx',
};

/** 音声は 大文字と同じ（文字の名前は 大文字・小文字で同じ）。キーは大文字で共有 */
const abc = (c: string) => en('abc', c.toUpperCase());

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

function nameItems(): Item[] {
  const out: Item[] = [];
  LOWER.forEach((c) => {
    const opts: ChoiceOption[] = [
      { label: c, correct: true },
      ...soundAlike(c).map(([x, m]) => ({ label: x, misconception: m })),
    ];
    out.push(
      listen({
        id: `name:${c}`,
        objective: 'name',
        level: 0,
        prompt: '聞《き》こえた 文字《もじ》の 小文字《こもじ》は どれ？',
        audio: abc(c),
        options: opts,
        hints: [
          '文字《もじ》の 名前《なまえ》を さいごまで 聞《き》こう。',
          '大文字《おおもじ》を おもいうかべてから、小文字《こもじ》の 形《かたち》を さがそう。',
          `アルファベットの ${c <= 'm' ? 'まえの はんぶん' : 'うしろの はんぶん'}に ある 文字《もじ》だよ。`,
        ],
        explain:
          '小文字《こもじ》も 名前《なまえ》は 大文字《おおもじ》と おなじ。形《かたち》を たしかめよう。',
        explainFigure: enText(`${c.toUpperCase()}  ${c}`, 'xl'),
        identity: `name:${c}`,
      }),
    );
  });
  // 別例: 2つ つづけて 聞いて ならびを えらぶ
  const PAIRS = ['bd', 'pq', 'mn', 'hk', 'ij', 'eg', 'tv', 'ay', 'sf', 'uw'];
  PAIRS.forEach((p) => {
    const [a, b] = [p[0]!, p[1]!];
    out.push(
      listen({
        id: `pair:${p}`,
        objective: 'name',
        level: 1,
        prompt:
          '文字《もじ》を 2つ つづけて いうよ。聞《き》こえた じゅんに ならんで いるのは どれ？',
        audio: [abc(a), abc(b)],
        gapMs: 600,
        options: [
          { label: `${a} ${b}`, correct: true },
          { label: `${b} ${a}`, misconception: 'pair-order' },
          { label: `${a} ${SHAPE_ALIKE[b]![0]}`, misconception: 'shape-alike' },
        ],
        hints: [
          '1つめと 2つめを わけて 聞《き》こう。',
          'じゅんばんにも 気《き》を つけよう。',
          '1つめの 文字《もじ》の 形《かたち》から たしかめよう。',
        ],
        explain: '聞《き》こえた じゅんに ならべると、こたえの ならびに なります。',
        explainFigure: enText(`${a}  ${b}`, 'xl'),
        identity: `pair:${p}`,
        alt: true,
      }),
    );
  });
  return out;
}

/** match: 大文字 ↔ 小文字（右に まぎらわしい 小文字を1つ たす） */
const MATCH_SETS: { up: string; extra: string }[] = [
  { up: 'ABDE', extra: 'q' },
  { up: 'GHIJ', extra: 'l' },
  { up: 'KLMN', extra: 'u' },
  { up: 'PQRS', extra: 'b' },
  { up: 'TUVW', extra: 'n' },
  { up: 'XYZF', extra: 't' },
  { up: 'BCOA', extra: 'd' },
  { up: 'DPEH', extra: 'n' },
];

function matchItems(): Item[] {
  const out: Item[] = [];
  MATCH_SETS.forEach((s) => {
    const ups = s.up.split('');
    const lows = [...ups.map((u) => u.toLowerCase()), s.extra];
    // 右の段: 小文字（ならびは画面で混ぜる）
    const wrongPairs: MatchItem['wrongPairs'] = [];
    ups.forEach((u, li) => {
      const l = u.toLowerCase();
      lows.forEach((x, ri) => {
        if (x !== l && SHAPE_ALIKE[l]!.includes(x))
          wrongPairs.push({ pair: [li, ri], misconception: 'shape-alike' });
      });
    });
    out.push({
      engine: 'match',
      id: `match:${s.up}`,
      objective: 'pair',
      level: 1,
      prompt: '大文字《おおもじ》と 小文字《こもじ》を 線《せん》で むすぼう。',
      left: ups.map((u) => ({ label: u })),
      right: lows.map((l) => ({ label: l })),
      pairs: ups.map((_, i) => [i, i] as [number, number]),
      wrongPairs,
      hints: [
        '大文字《おおもじ》と 小文字《こもじ》で 形《かたち》が にている ものと、ちがう ものが あるよ。',
        '名前《なまえ》を こえに だして いいながら むすぼう。',
        'つかわない 小文字《こもじ》が 1つ あるよ。',
      ],
      explain:
        '名前《なまえ》が おなじ 大文字《おおもじ》と 小文字《こもじ》が 組《くみ》に なります。',
      explainFigure: enText(ups.map((u) => `${u}${u.toLowerCase()}`).join('  '), 'l'),
      identity: `match:${s.up}`,
    });
  });
  // 別例: 大文字を 見て 小文字を えらぶ（音なし）
  const ALT: string[] = ['B', 'D', 'Q', 'G', 'N', 'R', 'H', 'L'];
  ALT.forEach((u) => {
    const l = u.toLowerCase();
    out.push({
      engine: 'choice',
      id: `up-to-low:${u}`,
      objective: 'pair',
      level: 2,
      prompt: 'この 大文字《おおもじ》の 小文字《こもじ》は どれ？',
      figure: enText(u, 'xl'),
      options: [
        { label: l, correct: true },
        ...SHAPE_ALIKE[l]!.split('').map((x) => ({ label: x, misconception: 'shape-alike' })),
      ],
      hints: [
        '大文字《おおもじ》の 名前《なまえ》を いって みよう。',
        '大文字《おおもじ》と 小文字《こもじ》は 形《かたち》が ちがう ことが あるよ。',
        'むきや、たてぼうの ながさを くらべよう。',
      ],
      explain: '名前《なまえ》が おなじ 小文字《こもじ》が こたえです。',
      explainFigure: enText(`${u}  ${l}`, 'xl'),
      identity: `up-to-low:${u}`,
      alt: true,
    });
  });
  return out;
}

/** 形の にている 小文字（聞いて えらぶ） */
const SIMILAR: string[][] = [
  ['b', 'd', 'p'],
  ['d', 'b', 'q'],
  ['p', 'q', 'b'],
  ['q', 'p', 'd'],
  ['m', 'n', 'w'],
  ['n', 'h', 'u'],
  ['h', 'n', 'k'],
  ['i', 'j', 'l'],
  ['j', 'i', 'g'],
  ['u', 'v', 'n'],
  ['g', 'q', 'y'],
  ['f', 't', 'l'],
];

function similarItems(): Item[] {
  const out: Item[] = [];
  for (const [c, ...rest] of SIMILAR) {
    out.push(
      listen({
        id: `similar:${c}`,
        objective: 'similar',
        level: 2,
        prompt:
          '聞《き》こえた 文字《もじ》の 小文字《こもじ》は どれ？ 形《かたち》が にているよ。',
        audio: abc(c!),
        options: [
          { label: c!, correct: true },
          ...rest.map((x) => ({ label: x, misconception: 'mirror' })),
        ],
        hints: [
          '名前《なまえ》を 聞《き》いて、大文字《おおもじ》を おもいうかべよう。',
          'まるい ところが みぎか ひだりか、たてぼうが うえに でるか したに でるかを 見《み》よう。',
          '4本《ほん》の 線《せん》の どこに かく 文字《もじ》かも ヒントに なるよ。',
        ],
        explain:
          '形《かたち》の にている 小文字《こもじ》は、むきと たてぼうの ながさで 見《み》わけよう。',
        explainFigure: enText(`${c}   ${rest.join('  ')}`, 'xl'),
        identity: `similar:${c}`,
      }),
    );
  }
  // 別例: 小文字を 見て、その 大文字を えらぶ（音なし）
  const ALT: [string, string, string][] = [
    ['b', 'B', 'D'],
    ['d', 'D', 'B'],
    ['q', 'Q', 'P'],
    ['p', 'P', 'Q'],
    ['n', 'N', 'M'],
    ['h', 'H', 'N'],
  ];
  for (const [l, U, W] of ALT) {
    out.push({
      engine: 'choice',
      id: `low-to-up:${l}`,
      objective: 'similar',
      level: 2,
      prompt: 'この 小文字《こもじ》の 大文字《おおもじ》は どれ？',
      figure: enText(l, 'xl'),
      options: [
        { label: U, correct: true },
        { label: W, misconception: 'mirror' },
        { label: SHAPE_ALIKE[l]![1]!.toUpperCase(), misconception: 'shape-alike' },
      ],
      hints: [
        'まるい ところの むきを 見《み》よう。',
        'たてぼうが うえに でて いるか、したに でて いるか 見《み》よう。',
        '名前《なまえ》を いって、大文字《おおもじ》を おもいうかべよう。',
      ],
      explain: '名前《なまえ》が おなじ 大文字《おおもじ》が こたえです。',
      explainFigure: enText(`${U}  ${l}`, 'xl'),
      identity: `low-to-up:${l}`,
      alt: true,
    });
  }
  return out;
}

export const alphabetLower: UnitSpec = {
  id: 'g4.en.alphabet-lower',
  title: 'アルファベット（小文字《こもじ》）',
  stage: 'g4',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g3.en.alphabet-upper'],
  objectives: [
    { id: 'name', title: '名前《なまえ》を 聞《き》いて 小文字《こもじ》が わかる' },
    { id: 'pair', title: '大文字《おおもじ》と 小文字《こもじ》を 組《くみ》に できる' },
    { id: 'similar', title: '形《かたち》の にている 小文字《こもじ》を 見《み》わける' },
  ],
  misconceptions: [
    {
      id: 'sound-alike',
      explain:
        '名前《なまえ》の 音《おと》が にている 文字《もじ》と まちがえたのかな。はじめの 音《おと》を よく 聞《き》こう。',
    },
    {
      id: 'shape-alike',
      explain:
        '形《かたち》が にている 文字《もじ》と まちがえたのかな。たてぼうの ながさや まるの むきを くらべよう。',
    },
    {
      id: 'mirror',
      explain:
        'かがみに うつしたように むきが はんたいの 文字《もじ》と まちがえたのかな。まるが みぎか ひだりか、ぼうが うえか したかを 見《み》よう。',
    },
    {
      id: 'pair-order',
      explain: 'じゅんばんが ぎゃくに なったのかな。1つめから じゅんに 聞《き》こう。',
    },
  ],
  levels: [
    { label: '名前《なまえ》を 聞《き》いて えらぶ', chance: 0.05 },
    { label: '大文字《おおもじ》と 組《くみ》に する', chance: 0.05 },
    { label: '形《かたち》の にている 小文字《こもじ》', chance: 0.05 },
  ],
  intro: [
    {
      text: 'アルファベットには 大文字《おおもじ》と 小文字《こもじ》が あるよ。名前《なまえ》は おなじだよ。',
      figure: enText('A a   B b   C c', 'xl'),
    },
    {
      text: 'この 4つは 形《かたち》が にているよ。まるの むきと、ぼうの ながさを くらべよう。',
      figure: enText('b  d  p  q', 'xl'),
    },
  ],
  source: { kind: 'items', items: [...nameItems(), ...matchItems(), ...similarItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（文字の読み方が発音されるのを聞いた際に、どの文字であるかが分かる）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
