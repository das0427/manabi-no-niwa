/**
 * g4.prog.prefecture-finder 特徴から県《けん》を見つける手順（条件の連鎖）（curriculum-matrix 3.6、手引B）。
 *
 * 地図は使えないので、10の県《けん》の「例のデータ」をふだ（県の名前と3つの○×）にして、「はい・いいえ」の質問で候補をしぼる形にした。
 * 使う特徴（3つ）: A＝海に面している／B＝県庁のある市の名前と同じ／C＝本州にある。
 *   はい・いいえ（○×）は、下の FACTS から問題ごとに計算して答えを決める（手で答えを書かない）。
 * 画面（作業領域は高さ約23u）に入るよう、表は使わず、ふだの図（名前と ○×）と記号 A・B・C で見せる。
 *
 * 到達項目:
 *   narrow  … 質問の答えに合う県を、ふだの ○× を読んで見つける（choice）。別例 = 条件に合う県の数を数える（number）
 *   order-q … 3つの質問を、はやくしぼれる順に並べる（order）。別例 = 最初にする質問を選ぶ（choice）
 *   fewer   … 目当ての県を見つけるのに いちばん少ない質問の数を求める（number）。別例 = 見つかったか判断する（choice）
 * 同一性キー: 問題の id。program エンジンは使っていない（質問の木をカードで作る部品がないため）。
 */
import type { ChoiceItem, Item, NumberItem, OrderItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { baseUnit } from './kit';

// ---- 例のデータ ----
type Key =
  | 'hokkaido'
  | 'aomori'
  | 'tochigi'
  | 'nagano'
  | 'aichi'
  | 'nara'
  | 'hyogo'
  | 'okinawa'
  | 'yamanashi'
  | 'fukuoka';

interface Pref {
  name: string;
  sea: boolean;
  same: boolean;
  honshu: boolean;
}
/** 県の名前（ひらがな）・海に面している・県庁のある市と名前が同じ・本州にある（学習指導要領の4年「都道府県の様子」の範囲の例） */
const FACTS: Record<Key, Pref> = {
  hokkaido: { name: 'ほっかいどう', sea: true, same: false, honshu: false },
  aomori: { name: 'あおもり', sea: true, same: true, honshu: true },
  tochigi: { name: 'とちぎ', sea: false, same: false, honshu: true },
  nagano: { name: 'ながの', sea: false, same: true, honshu: true },
  aichi: { name: 'あいち', sea: true, same: false, honshu: true },
  nara: { name: 'なら', sea: false, same: true, honshu: true },
  hyogo: { name: 'ひょうご', sea: true, same: false, honshu: true },
  okinawa: { name: 'おきなわ', sea: true, same: false, honshu: false },
  yamanashi: { name: 'やまなし', sea: false, same: false, honshu: true },
  fukuoka: { name: 'ふくおか', sea: true, same: true, honshu: false },
};

type Q = 'sea' | 'same' | 'honshu';
const ALL_Q: Q[] = ['sea', 'same', 'honshu'];
/** ふだの しるし: A＝海に めんして いる、B＝けんちょうの 市と なまえが おなじ、C＝本州に ある */
const MARK: Record<Q, string> = { sea: 'A', same: 'B', honshu: 'C' };
/** 順ならべのふだに書く ことば */
const QWORD: Record<Q, string> = { sea: 'うみ', same: 'なまえ', honshu: 'ほんしゅう' };
const answerOf =(k: Key, q: Q) => FACTS[k][q];
const mark = (b: boolean) => (b ? '○' : '×');
const nameOf = (k: Key) => FACTS[k].name;

/** 質問の答えを順に当てはめたときに残る県 */
function remain(pool: Key[], steps: [Q, boolean][]): Key[] {
  return pool.filter((k) => steps.every(([q, a]) => answerOf(k, q) === a));
}
const perms = <T>(xs: T[]): T[][] =>
  xs.length <= 1
    ? [xs]
    : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));

// ---- 図 ----
/** ○か×の しるし（中心 cx, cy・大きさ r） */
const markShape = (ok: boolean, cx: number, cy: number, r: number) =>
  ok
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--ink)" stroke-width="${(r * 0.45).toFixed(1)}"/>`
    : `<path d="M${cx - r * 0.85} ${cy - r * 0.85} L${cx + r * 0.85} ${cy + r * 0.85} M${cx + r * 0.85} ${cy - r * 0.85} L${cx - r * 0.85} ${cy + r * 0.85}" stroke="var(--ink)" stroke-width="${(r * 0.45).toFixed(1)}" stroke-linecap="round"/>`;

/** 1まいの ふだの 中身（名前と A・B・C の ○×）。x は ふだの 左はし。幅 66・高さ 38 */
function cardBody(k: Key, x: number): string {
  const name = nameOf(k);
  const fs = Math.min(12, 60 / name.length);
  let body = `<rect x="${x}" y="1" width="66" height="38" rx="6" fill="var(--white)" stroke="var(--ink)" stroke-width="2"/>`;
  body += `<text x="${x + 33}" y="${(1 + 4 + fs).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="700" fill="var(--ink)">${name}</text>`;
  ALL_Q.forEach((q, j) => {
    const gx = x + 4 + j * 21;
    body += `<text x="${gx}" y="33" font-size="9" font-weight="700" fill="var(--ink-soft)">${MARK[q]}</text>`;
    body += markShape(answerOf(k, q), gx + 12, 29, 5);
  });
  return body;
}

/** 県の ふだ 1まいの図（選択肢で使う） */
function marksFigure(k: Key, label: string, hU = 6.5): Figure {
  return {
    kind: 'svg',
    label,
    markup: `<svg viewBox="0 0 68 40" style="height:calc(var(--u) * ${hU})" xmlns="http://www.w3.org/2000/svg">${cardBody(k, 1)}</svg>`,
  };
}

/** 候補の県を ならべた図（名前と しるし）。よこはば 90u いない・字が よめる 大きさに する */
function candidatesFigure(keys: Key[], label: string): Figure {
  const W = keys.length * 69 + 3;
  const H = 40;
  const hU = Math.min(8, (90 * H) / W);
  const body = keys.map((k, i) => cardBody(k, 2 + i * 69)).join('');
  return {
    kind: 'svg',
    label,
    markup: `<svg viewBox="0 0 ${W} ${H}" style="height:calc(var(--u) * ${hU.toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}
/** しるしの意味（A・B・C）を 1行で見せる図 */
function legendFigure(hU = 3.4): Figure {
  const t = 'A＝うみに めんして いる　B＝けんちょうの まちと なまえが おなじ　C＝ほんしゅうに ある';
  return {
    kind: 'svg',
    label:
      'しるしの いみ。A は うみに めんして いる、B は けんちょうの まちと なまえが おなじ、C は ほんしゅうに ある',
    markup: `<svg viewBox="0 0 460 20" style="height:calc(var(--u) * ${hU})" xmlns="http://www.w3.org/2000/svg"><text x="230" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink-soft)">${t}</text></svg>`,
  };
}

const col = (items: Figure[], gap = 1): Figure => ({ kind: 'column', items, gap });

const rotate = <T>(xs: T[], seed: string): T[] => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const at = h % xs.length;
  return [...xs.slice(at), ...xs.slice(0, at)];
};

const qm = (q: Q) => `「${MARK[q]}」`;
const condText = (steps: [Q, boolean][]) => steps.map(([q, a]) => `${qm(q)}が ${mark(a)}`).join('、');
const READ = 'A・B・C の じゅんに ○か×が あるよ。';

// ---- narrow ----
interface Nr {
  id: string;
  level: number;
  pool: Key[];
  steps: [Q, boolean][];
}
const NARROWS: Nr[] = [
  { id: 'n1', level: 0, pool: ['aomori', 'tochigi', 'aichi', 'nagano'], steps: [['sea', true], ['same', true]] },
  { id: 'n2', level: 0, pool: ['hokkaido', 'aomori', 'tochigi', 'fukuoka'], steps: [['honshu', false], ['same', true]] },
  { id: 'n3', level: 0, pool: ['aichi', 'nara', 'okinawa', 'tochigi'], steps: [['sea', false], ['same', true]] },
  { id: 'n4', level: 1, pool: ['nagano', 'aichi', 'okinawa', 'yamanashi'], steps: [['honshu', true], ['sea', false], ['same', false]] },
  { id: 'n5', level: 1, pool: ['hokkaido', 'aomori', 'nara', 'hyogo'], steps: [['sea', true], ['same', false], ['honshu', true]] },
  { id: 'n6', level: 1, pool: ['fukuoka', 'hokkaido', 'aomori', 'nagano'], steps: [['sea', true], ['honshu', false], ['same', false]] },
];
const narrowItems: ChoiceItem[] = NARROWS.map((n) => {
  const ans = remain(n.pool, n.steps);
  if (ans.length !== 1) throw new Error(`${n.id}: 答えが1つに決まらない（${ans.length}）`);
  return {
    engine: 'choice',
    id: `narrow-${n.id}`,
    objective: 'narrow',
    level: n.level,
    prompt: `${condText(n.steps)} の 県《けん》は どれかな。`,
    figure: legendFigure(),
    options: rotate(n.pool, n.id).map((k) => ({
      label: nameOf(k),
      figure: marksFigure(k, `${nameOf(k)}の しるし`),
      ...(k === ans[0] ? { correct: true } : { misconception: 'narrow-miss' }),
    })),
    layout: 'row',
    fixedOrder: true,
    hints: [
      `ふだの しるしを 見《み》よう。${READ}`,
      `${condText(n.steps)}に ぴったり あう ふだを さがそう。ぜんぶ あてはまる ものだけが こたえだよ。`,
      '1つずつ しるしを たしかめて、あわない ふだを のぞいて いこう。',
    ],
    explain: `${condText(n.steps)}に ぜんぶ あてはまるのは ${nameOf(ans[0]!)}だけだよ。しつもんに こたえるたびに、のこる 県《けん》が へっていくね。`,
    identity: `narrow-${n.id}`,
  };
});

// 別例: 条件に合う県の数を数える
const POOL6: Key[] = ['hokkaido', 'aomori', 'tochigi', 'nagano', 'aichi', 'fukuoka'];
interface Nc {
  id: string;
  level: number;
  steps: [Q, boolean][];
}
const NCOUNT: Nc[] = [
  { id: 'c1', level: 0, steps: [['sea', true]] },
  { id: 'c2', level: 0, steps: [['sea', true], ['honshu', true]] },
  { id: 'c3', level: 1, steps: [['honshu', true], ['sea', false]] },
];
const countItems: NumberItem[] = NCOUNT.map((c) => {
  const left = remain(POOL6, c.steps);
  const first = remain(POOL6, [c.steps[0]!]);
  const wrongs = [
    ...(first.length !== left.length ? [{ value: String(first.length), misconception: 'narrow-miss' }] : []),
    { value: String(POOL6.length), misconception: 'narrow-miss' },
  ].filter((w) => w.value !== String(left.length));
  return {
    engine: 'number',
    id: `narrow-alt-${c.id}`,
    objective: 'narrow',
    level: c.level,
    alt: true,
    prompt: `${condText(c.steps)} の 県《けん》は いくつ あるかな。`,
    figure: col([legendFigure(), candidatesFigure(POOL6, '6つの 県《けん》の ふだ')], 0.8),
    fields: [{ label: 'つ', answer: { kind: 'int', value: left.length } }],
    wrongAnswers: wrongs,
    hints: [
      `ふだの しるしを 見《み》よう。${READ}`,
      c.steps.length > 1
        ? '1つめの しるしで のこる ふだに めじるしを つけてから、2つめの しるしを 見《み》よう。'
        : '○の ふだを、ひとつずつ 数《かぞ》えよう。',
      `${condText(c.steps)}に ぴったり あう ふだだけを 数《かぞ》えるよ。`,
    ],
    explain: `${condText(c.steps)}に あてはまる ふだは ${left.map(nameOf).join('、')}。ぜんぶで ${left.length}つだよ。`,
    identity: `narrow-alt-${c.id}`,
  };
});

// ---- order-q ----
interface Oq {
  id: string;
  level: number;
  pool: Key[];
  target: Key;
}
/** しつもんの順の「のこる数のごうけい」（小さいほど はやくしぼれる） */
function cost(pool: Key[], target: Key, order: Q[]): number {
  let total = 0;
  const steps: [Q, boolean][] = [];
  for (const q of order) {
    steps.push([q, answerOf(target, q)]);
    total += remain(pool, steps).length;
  }
  return total;
}
const ORDERQ: Oq[] = [
  { id: 'o1', level: 1, pool: POOL6, target: 'aomori' },
  { id: 'o2', level: 1, pool: POOL6, target: 'tochigi' },
  { id: 'o3', level: 1, pool: POOL6, target: 'fukuoka' },
  { id: 'o4', level: 2, pool: POOL6, target: 'hokkaido' },
  { id: 'o5', level: 2, pool: POOL6, target: 'nagano' },
  { id: 'o6', level: 2, pool: POOL6, target: 'aichi' },
];
const orderItems: OrderItem[] = ORDERQ.map((o) => {
  const all = perms([...ALL_Q]).map((p) => ({ p, c: cost(o.pool, o.target, p) }));
  const best = Math.min(...all.map((x) => x.c));
  const bests = all.filter((x) => x.c === best);
  if (bests.length > 3 || bests.length === all.length) throw new Error(`${o.id}: 最短の順が決まらない`);
  const first = bests[0]!.p;
  const posOf = (q: Q) => first.indexOf(q);
  const also = bests.slice(1).map((b) => b.p.map(posOf));
  const worst = all.filter((x) => x.c === Math.max(...all.map((y) => y.c)))[0]!;
  return {
    engine: 'order',
    id: `orderq-${o.id}`,
    objective: 'order-q',
    level: o.level,
    prompt: `${nameOf(o.target)}を さがす。はやい じゅんに ならべよう。`,
    figure: candidatesFigure(o.pool, '6つの 県《けん》の ふだ'),
    cards: first.map((q) => ({ label: `${MARK[q]}：${QWORD[q]}` })),
    ...(also.length ? { alsoAccept: also } : {}),
    wrongOrders: [{ order: worst.p.map(posOf), misconception: 'order-q' }],
    ends: ['さいしょ', 'さいご'],
    hints: [
      'しつもんに こたえるたびに、のこる 県《けん》が へるよ。',
      `${nameOf(o.target)}の しるしと おなじ ふだが いくつ のこるか、しつもんごとに 数《かぞ》えて みよう。`,
      'のこる ふだが いちばん 少《すく》なく なる しつもんから ならべるよ。',
    ],
    explain: `${first.map((q, i) => `${i + 1}つめは${qm(q)}`).join('、')}の じゅんが はやくしぼれるよ。おおくの ふだを のぞける しつもんを さきに すると、のこる 県《けん》が はやく へるからだよ。`,
    identity: `orderq-${o.id}`,
  };
});

// 別例: 最初にする質問を選ぶ
const FIRSTQ: Oq[] = [
  { id: 'f1', level: 1, pool: POOL6, target: 'tochigi' },
  { id: 'f2', level: 2, pool: POOL6, target: 'hokkaido' },
  { id: 'f3', level: 2, pool: POOL6, target: 'aichi' },
];
const firstItems: ChoiceItem[] = FIRSTQ.map((f) => {
  const counts = ALL_Q.map((q) => ({ q, n: remain(f.pool, [[q, answerOf(f.target, q)]]).length }));
  const min = Math.min(...counts.map((c) => c.n));
  const bests = counts.filter((c) => c.n === min);
  if (bests.length !== 1) throw new Error(`${f.id}: 最初の質問が決まらない`);
  const best = bests[0]!;
  return {
    engine: 'choice',
    id: `orderq-alt-${f.id}`,
    objective: 'order-q',
    level: f.level,
    alt: true,
    prompt: `${nameOf(f.target)}を さがすよ。さいしょに する しつもんは どれが いいかな。`,
    figure: col([legendFigure(), candidatesFigure(f.pool, '6つの 県《けん》の ふだ')], 0.8),
    options: ALL_Q.map((q) => ({
      label: qm(q),
      ...(q === best.q ? { correct: true } : { misconception: 'order-q' }),
    })),
    layout: 'row',
    fixedOrder: true,
    hints: [
      'しつもんごとに、のこる ふだの 数《かず》を くらべよう。',
      `${nameOf(f.target)}の しるしと おなじ ふだが いくつ のこるか 数《かぞ》えよう。`,
      'のこる ふだが いちばん 少《すく》なく なる しつもんを えらぼう。',
    ],
    explain: `${qm(best.q)}が ${mark(answerOf(f.target, best.q))}の ふだは ${best.n}つ。いちばん 少《すく》なく のこるよ。さいしょに おおく のぞける しつもんを えらぶと はやいね。`,
    identity: `orderq-alt-${f.id}`,
  };
});

// ---- fewer ----
interface Fw {
  id: string;
  level: number;
  pool: Key[];
  target: Key;
}
const subsets: Q[][] = [
  ['sea'],
  ['same'],
  ['honshu'],
  ['sea', 'same'],
  ['sea', 'honshu'],
  ['same', 'honshu'],
  ['sea', 'same', 'honshu'],
];
const identifies = (pool: Key[], target: Key, qs: Q[]) => {
  const r = remain(
    pool,
    qs.map((q) => [q, answerOf(target, q)] as [Q, boolean]),
  );
  return r.length === 1 && r[0] === target;
};
const FEWER: Fw[] = [
  { id: 'w1', level: 2, pool: ['aomori', 'tochigi', 'aichi', 'fukuoka'], target: 'tochigi' },
  { id: 'w2', level: 2, pool: ['hokkaido', 'aomori', 'tochigi', 'nagano', 'fukuoka'], target: 'hokkaido' },
  { id: 'w3', level: 2, pool: ['aomori', 'nagano', 'aichi', 'fukuoka'], target: 'aomori' },
  { id: 'w4', level: 2, pool: ['hokkaido', 'aomori', 'tochigi', 'nagano'], target: 'nagano' },
  { id: 'w5', level: 2, pool: ['aomori', 'tochigi', 'aichi', 'fukuoka', 'hokkaido'], target: 'aichi' },
  { id: 'w6', level: 2, pool: ['aomori', 'tochigi', 'nagano', 'fukuoka'], target: 'fukuoka' },
];
const fewerItems: NumberItem[] = FEWER.map((w) => {
  const ok = subsets.filter((s) => identifies(w.pool, w.target, s));
  const m = Math.min(...ok.map((s) => s.length));
  const good = ok.find((s) => s.length === m) ?? ok[0]!;
  return {
    engine: 'number',
    id: `fewer-${w.id}`,
    objective: 'fewer',
    level: w.level,
    prompt: `${nameOf(w.target)}を さがすよ。しつもんは さいてい なんこ いるかな。`,
    figure: col([legendFigure(), candidatesFigure(w.pool, `${w.pool.length}つの 県《けん》の ふだ`)], 0.8),
    fields: [{ label: 'こ', answer: { kind: 'int', value: m } }],
    wrongAnswers: [
      ...(m > 1 ? [{ value: String(m - 1), misconception: 'not-enough' }] : []),
      ...(m < 3 ? [{ value: String(m + 1), misconception: 'too-many-q' }] : []),
    ],
    hints: [
      'しつもんに こたえて、のこる ふだが 1つに なれば みつかった ことになるよ。',
      '1つの しつもんで 1つに なる か、2つの しつもんを くみあわせると 1つに なるか、ためして みよう。',
      `${nameOf(w.target)}の しるしと おなじ ふだが、ほかに のこらなく なるまで しつもんを ふやして みよう。`,
    ],
    explain: `${nameOf(w.target)}は ${good.map(qm).join('と')}の ${m}こ で ほかの ふだが なくなって、ひとつに しぼれるよ。それより 少《すく》ない しつもんでは、ほかの 県《けん》も のこるよ。`,
    identity: `fewer-${w.id}`,
  };
});

// 別例: 見つかったか判断する
interface Fd {
  id: string;
  level: number;
  target: Key;
  qs: Q[];
}
const FOUND: Fd[] = [
  { id: 'd1', level: 1, target: 'tochigi', qs: ['sea', 'honshu'] },
  { id: 'd2', level: 2, target: 'aomori', qs: ['sea', 'same'] },
  { id: 'd3', level: 2, target: 'hokkaido', qs: ['sea', 'honshu'] },
];
const foundItems: ChoiceItem[] = FOUND.map((f) => {
  const steps = f.qs.map((q) => [q, answerOf(f.target, q)] as [Q, boolean]);
  const left = remain(POOL6, steps);
  const found = left.length === 1;
  return {
    engine: 'choice',
    id: `fewer-alt-${f.id}`,
    objective: 'fewer',
    level: f.level,
    alt: true,
    prompt: `${nameOf(f.target)}を さがすよ。${f.qs.map(qm).join('と')}に こたえたよ。もう みつかったかな。`,
    figure: col([legendFigure(), candidatesFigure(POOL6, '6つの 県《けん》の ふだ')], 0.8),
    options: [
      { label: 'みつかった', ...(found ? { correct: true } : { misconception: 'too-many-q' }) },
      { label: 'まだ わからない', ...(found ? { misconception: 'not-enough' } : { correct: true }) },
    ],
    layout: 'row',
    fixedOrder: true,
    hints: [
      `${nameOf(f.target)}の ${f.qs.map(qm).join('と')}の しるしと、おなじ ふだを さがそう。`,
      'おなじ しるしの ふだが いくつ あるか 数《かぞ》えよう。',
      '1つだけ なら みつかった。2つ いじょうなら まだ わからないよ。',
    ],
    explain: found
      ? `${condText(steps)}の ふだは ${nameOf(f.target)}だけ。もう みつかったよ。`
      : `${condText(steps)}の ふだは ${left.map(nameOf).join('、')}の ${left.length}つ。まだ ひとつに しぼれて いないよ。`,
    identity: `fewer-alt-${f.id}`,
  };
});

const items: Item[] = [
  ...narrowItems,
  ...countItems,
  ...orderItems,
  ...firstItems,
  ...fewerItems,
  ...foundItems,
];

export const prefectureFinder: UnitSpec = {
  ...baseUnit('g4.prog.prefecture-finder', 'g4'),
  kind: 'inquiry',
  title: '県《けん》を みつける しつもん',
  prereq: ['g3.prog.condition-combo'],
  objectives: [
    { id: 'narrow', title: 'しつもんの こたえで 県《けん》を しぼりこむ' },
    { id: 'order-q', title: 'しぼりこみやすい しつもんの じゅんを かんがえる' },
    { id: 'fewer', title: 'すくない しつもんで みつける' },
  ],
  misconceptions: [
    {
      id: 'narrow-miss',
      explain:
        'ふだの しるしの よみまちがいかな。A・B・C の じゅんに ○×を 見《み》て、しつもんに あう ふだだけを のこそう。',
    },
    {
      id: 'order-q',
      explain:
        'のこる ふだが あまり へらない しつもんを さきに したのかな。おおく へらせる しつもんを さきに すると はやいよ。',
    },
    {
      id: 'not-enough',
      explain:
        'その しつもんだけでは、ほかの 県《けん》も のこって しまうよ。のこる ふだが 1つに なるか たしかめよう。',
    },
    {
      id: 'too-many-q',
      explain: 'それでも みつかるけれど、もっと 少《すく》ない しつもんで みつかる ことも あるよ。',
    },
  ],
  levels: [
    { label: 'しるしを よんで しぼる', chance: 0.05 },
    { label: 'しつもんの じゅん', chance: 0.05 },
    { label: 'すくない しつもん', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ひとつの 県《けん》を さがすとき、「はい」「いいえ」で こたえられる しつもんを つかうと、のこる 県《けん》が だんだん へるよ。',
      figure: candidatesFigure(['aomori', 'tochigi', 'aichi'], '3つの 県《けん》の ふだ'),
    },
    {
      text: 'ふだには しるしが 3つ。A は 海《うみ》に めんして いる、B は けんちょうの ある 市《し》と なまえが おなじ、C は 本州《ほんしゅう》に ある。○は はい、×は いいえだよ。',
      figure: legendFigure(5),
    },
    {
      text: '県《けん》は、しらべた れいの データから えらんだものだよ。おおくの ふだを のぞける しつもんを さきに すると、はやく みつかるよ。これは 手順《てじゅん》を くふうして かんがえる プログラミングの かんがえ方《かた》だよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、社会 第4学年 (1)（都道府県の様子）、小学校プログラミング教育の手引（第三版）（条件による絞り込みの考え方。内容は本アプリで作成）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};






