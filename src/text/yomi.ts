/**
 * 読み上げ用のよみ（音声台本の yomi）。RichText の《よみ》・分数・記号・数＋助数詞をひらがなにする。
 * Open JTalk は「1こ」を「いちこ」と読むなど数の読みを誤るため、数はすべてここでひらがなにする（v1 の知見）。
 */
import { numberReading, spokenReading } from './rich';

/** 記号の読み */
const SYMBOLS: [RegExp, string][] = [
  [/[＋+]/g, ' たす '],
  [/[−\-－](?=\s*\d)/g, ' ひく '],
  [/[×✕]/g, ' かける '],
  [/[÷]/g, ' わる '],
  [/[＝=]/g, ' は '],
  [/□|{{}}/g, ' なに '],
];

type Rule = (n: number) => string | null;

/** 助数詞ごとの音の変化（最後の位で決まる。10・20… は「じゅっ」） */
const COUNTERS: Record<string, { base: string; rule: Rule }> = {
  こ: {
    base: 'こ',
    rule: (d) => ({ 1: 'いっこ', 6: 'ろっこ', 8: 'はっこ', 10: 'じゅっこ' })[d] ?? null,
  },
  ひき: {
    base: 'ひき',
    rule: (d) =>
      ({ 1: 'いっぴき', 3: 'さんびき', 6: 'ろっぴき', 8: 'はっぴき', 10: 'じゅっぴき' })[d] ?? null,
  },
  びき: { base: 'ひき', rule: () => null },
  ぴき: { base: 'ひき', rule: () => null },
  ほん: {
    base: 'ほん',
    rule: (d) =>
      ({ 1: 'いっぽん', 3: 'さんぼん', 6: 'ろっぽん', 8: 'はっぽん', 10: 'じゅっぽん' })[d] ?? null,
  },
  かい: {
    base: 'かい',
    rule: (d) => ({ 1: 'いっかい', 6: 'ろっかい', 8: 'はっかい', 10: 'じゅっかい' })[d] ?? null,
  },
  さい: {
    base: 'さい',
    rule: (d) => ({ 1: 'いっさい', 8: 'はっさい', 10: 'じゅっさい' })[d] ?? null,
  },
  さつ: {
    base: 'さつ',
    rule: (d) => ({ 1: 'いっさつ', 8: 'はっさつ', 10: 'じゅっさつ' })[d] ?? null,
  },
  ぷん: { base: 'ふん', rule: () => null },
  ふん: {
    base: 'ふん',
    rule: (d) =>
      ({
        1: 'いっぷん',
        3: 'さんぷん',
        4: 'よんぷん',
        6: 'ろっぷん',
        8: 'はっぷん',
        10: 'じゅっぷん',
      })[d] ?? null,
  },
  にん: { base: 'にん', rule: (d) => ({ 1: 'ひとり', 2: 'ふたり' })[d] ?? null },
  わ: { base: 'わ', rule: () => null },
  まい: { base: 'まい', rule: () => null },
  だい: { base: 'だい', rule: () => null },
  じ: { base: 'じ', rule: (d) => ({ 4: 'よじ', 7: 'しちじ', 9: 'くじ' })[d] ?? null },
  えん: { base: 'えん', rule: (d) => ({ 4: 'よえん' })[d] ?? null },
};
const COUNTER_RE = new RegExp(
  `(\\d+)\\s*(${Object.keys(COUNTERS)
    .sort((a, b) => b.length - a.length)
    .join('|')})`,
  'g',
);

/** 数＋助数詞の読み（例 1こ → いっこ、23びき → にじゅうさんびき、10ぷん → じゅっぷん） */
export function counterReading(n: number, counter: string): string {
  const c = COUNTERS[counter];
  if (!c) return numberReading(n) + counter;
  // 1〜10 は表、11以上は「上の位の読み」＋最後の位の変化
  const last = n % 10;
  const head = n - (last === 0 ? n % 100 : last);
  const tail = last === 0 ? (n % 100 === 0 ? 0 : 10) : last;
  if (n === 0) return `ぜろ${c.base}`;
  if (tail === 0) return numberReading(n) + c.base;
  const special = c.rule(tail);
  // 十の位があって最後が 0 のとき（20, 30 …）は「…じゅっ」
  if (last === 0 && tail === 10 && n >= 20) {
    const tens = numberReading(n).replace(/じゅう$/, '');
    return special ? tens + special : numberReading(n) + c.base;
  }
  const headRead = head > 0 ? numberReading(head) : '';
  return headRead + (special ?? numberReading(tail) + c.base);
}

/** 画面の文（RichText）→ 読み上げのよみ（ひらがな） */
export function speechYomi(rich: string): string {
  let s = spokenReading(rich);
  s = s.replace(COUNTER_RE, (_, d: string, ctr: string) => counterReading(Number(d), ctr));
  for (const [re, rep] of SYMBOLS) s = s.replace(re, rep);
  s = s.replace(/\d+(\.\d+)?/g, (m) => {
    if (m.includes('.')) {
      const [i, f] = m.split('.');
      return `${numberReading(Number(i))}てん${[...f!].map((d) => numberReading(Number(d))).join('')}`;
    }
    return numberReading(Number(m));
  });
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '。')
    .trim();
}
