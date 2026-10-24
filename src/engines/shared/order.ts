/**
 * 選択肢を並べる順（元の番号の列）。choice・geometry の pick・graph の選ぶ問題・fill の札で共通。
 * 教材の書き方で正解が先頭に偏っても、位置で当てられないようにする（内容レビュー g3・g4 中-A）。
 * 問題の id で決まる順なので、同じ問題は何度描いても・再開しても同じ順になる。
 *
 * 並べ替えないとき:
 *  - fixedOrder（大小の順など意味のある並び）
 *  - 問題文・ヒント・解説が「1ばん」「2ばんめ」のように位置で選択肢を指している
 *  - 選択肢が図の記号（あ・い・う…、①②…）だけ
 */
import { createRng, hashSeed } from '../../core/util/rng';

export interface OrderSource {
  id: string;
  fixedOrder?: boolean;
  prompt?: unknown;
  hints?: unknown;
  explain?: unknown;
}

const POSITION_REF = /[0-9０-９]\s*ばん/;
const SYMBOL_LABEL = /^[あいうえおかきくけこ①-⑳]$/;

function refersToPosition(item: OrderSource): boolean {
  return POSITION_REF.test(
    JSON.stringify([item.prompt ?? '', item.hints ?? [], item.explain ?? '']),
  );
}

/**
 * @param shown 出す選択肢の元の番号（元の順）
 * @param labels 各選択肢の文字（無ければ undefined）。元の番号で引く
 * @param salt 同じ問題の中で別の並びにしたいとき（fill の空欄ごと など）
 */
export function displayOrder(
  item: OrderSource,
  shown: readonly number[],
  labels: readonly (string | undefined)[] = [],
  salt = '',
): number[] {
  const out = [...shown];
  if (item.fixedOrder || out.length < 2) return out;
  if (refersToPosition(item)) return out;
  const ls = out.map((i) => labels[i]);
  if (ls.length > 0 && ls.every((l) => typeof l === 'string' && SYMBOL_LABEL.test(l))) return out;
  const rng = createRng(hashSeed('choice-order', item.id, salt));
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 元の番号 i の選択肢が、表示で何番目か（1から）。answerText などで使う */
export function displayPosition(
  item: OrderSource,
  count: number,
  i: number,
  labels: readonly (string | undefined)[] = [],
  salt = '',
): number {
  const order = displayOrder(
    item,
    Array.from({ length: count }, (_, k) => k),
    labels,
    salt,
  );
  return order.indexOf(i) + 1;
}
