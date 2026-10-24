/**
 * 教材の文を音声の部品の列にする（純粋関数）。
 * - 数字を含まない文は、文まるごと1本（自然な抑揚）。キー `<packId>/<hash>`。
 * - 数字を含む文は「決まった言い回し」と「数の読み」に分けてつなぐ。言い回しは `<packId>/<hash>`、
 *   数は共通の数の音声 `num/<hash>`（位ごとの読み＋最後の位と助数詞。約600本で全ての数を読める）。
 *   生成問題の数の組み合わせごとに録音しなくて済む。つなぎ目の抑揚が不自然になる限界がある（progress.md に記録）。
 * 生成スクリプト（scripts/voice）も同じ関数で台本を作るので、表示と音声がずれない。
 */
import { numberReading } from '../text/rich';
import { counterReading, COUNTER_NAMES, speechYomi } from '../text/yomi';
import { yomiHash } from './hash';

export interface SpeechPart {
  /** 音声キー（public/audio/<key>.mp3） */
  key: string;
  /** 読み（ひらがな。Open JTalk に渡す） */
  yomi: string;
  /** 表示の文（台本・予備の読み上げ用） */
  text: string;
}

const DIGITS = /(\d+(?:\.\d+)?)/;

/** 1〜9999 を位ごとの読みに（最後の位は counter と合わせる） */
function groupParts(n: number, counter: string | null): string[] {
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const te = Math.floor((n % 100) / 10);
  const on = n % 10;
  const vals = [th * 1000, hu * 100, te * 10, on].filter((v) => v > 0);
  return vals.map((v, i) =>
    i === vals.length - 1 && counter ? counterReading(v, counter) : numberReading(v),
  );
}

/** 整数（0〜99999999）＋助数詞の読みを部品に */
export function integerParts(n: number, counter: string | null = null): string[] {
  if (n === 0) return [counter ? `ぜろ${counter}` : 'ぜろ'];
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  const out: string[] = [];
  if (man > 0) {
    out.push(...groupParts(man, null));
    out.push(rest === 0 && counter ? `まん${counter}` : 'まん');
  }
  if (rest > 0) out.push(...groupParts(rest, counter));
  return out;
}

/** 小数（例 2.35 → に、てん、さん、ご） */
export function decimalParts(s: string): string[] {
  const [i, f = ''] = s.split('.');
  return [...integerParts(Number(i)), 'てん', ...[...f].map((d) => numberReading(Number(d)))];
}

/**
 * 文（RichText）を音声の部品の列にする。
 * 数字の直後の助数詞は数の部品に含める（「1こ」→「いっこ」）。
 */
export function speechParts(packId: string, rich: string): SpeechPart[] {
  const yomiAll = speechYomi(rich);
  if (!/\d/.test(rich))
    return [{ key: `${packId}/${yomiHash(yomiAll)}`, yomi: yomiAll, text: rich }];
  const out: SpeechPart[] = [];
  const counterRe = new RegExp(`^\\s*(${COUNTER_NAMES.join('|')})`);
  let rest = rich;
  while (rest.length > 0) {
    const m = DIGITS.exec(rest);
    if (!m) {
      pushText(out, packId, rest);
      break;
    }
    if (m.index > 0) pushText(out, packId, rest.slice(0, m.index));
    rest = rest.slice(m.index + m[0].length);
    const c = counterRe.exec(rest);
    const counter = c ? c[1]! : null;
    if (c) rest = rest.slice(c[0].length);
    const parts = m[0].includes('.') ? decimalParts(m[0]) : integerParts(Number(m[0]), counter);
    for (const p of parts) out.push({ key: `num/${yomiHash(p)}`, yomi: p, text: p });
  }
  return out;
}

function pushText(out: SpeechPart[], packId: string, s: string): void {
  const yomi = speechYomi(s).trim();
  if (!yomi) return;
  out.push({ key: `${packId}/${yomiHash(yomi)}`, yomi, text: s.trim() });
}

/** 数の音声の全部品（生成スクリプトが使う。全ての数がこの部品で読める） */
export function allNumberParts(): string[] {
  const set = new Set<string>();
  const counters = [null, ...COUNTER_NAMES];
  const lastValues: number[] = [];
  for (const base of [1, 10, 100, 1000]) for (let d = 1; d <= 9; d++) lastValues.push(d * base);
  for (const v of lastValues) {
    set.add(numberReading(v));
    for (const c of counters) if (c) set.add(counterReading(v, c));
  }
  set.add('ぜろ');
  set.add('まん');
  set.add('てん');
  for (const c of COUNTER_NAMES) {
    set.add(`ぜろ${c}`);
    set.add(`まん${c}`);
  }
  return [...set].sort();
}
