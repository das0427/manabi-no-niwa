/**
 * ローマ字の判定（小3 国語）。令和7年内閣告示第4号「ローマ字のつづり方」（ヘボン式に準ずる）を現行とする
 * （docs/expansion/research/elementary-japanese-math.md 3-3, progress.md 統括の判断7）。純粋関数。
 *
 * - 撥音「ん」は常に n（b・m・p の前でも m にしない）。母音・y の前では n' も受け入れる（告示原文未読のため両方許容）。
 * - 促音「っ」は次の子音字を重ねる（ち の前も c を重ねる: matcha ではなく maccha）。
 * - 長音は長音符号（ō）・山形（ô）・母音を並べる（ou / oo）のいずれも正解。
 * - 訓令式（si, ti, tu, hu, zi, sya …）・wo は誤答にせず「もう一度」とし、告示の書き方を示す。
 * - 大文字・小文字は区別しない。助詞の は・へ・を は教材データ側で発音どおり（わ・え・お）に書く。
 */

type Alt = { s: string; kunrei: boolean };
type Seg = Alt[];

// prettier-ignore
const BASE: Record<string, [string, string?]> = {
  // かな: [告示のつづり, 訓令式（違うときだけ）]
  あ: ['a'], い: ['i'], う: ['u'], え: ['e'], お: ['o'],
  か: ['ka'], き: ['ki'], く: ['ku'], け: ['ke'], こ: ['ko'],
  さ: ['sa'], し: ['shi', 'si'], す: ['su'], せ: ['se'], そ: ['so'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['o', 'wo'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  だ: ['da'], ぢ: ['ji', 'zi'], づ: ['zu'], で: ['de'], ど: ['do'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
};

/** 拗音: 行の頭 + [ゃ, ゅ, ょ] */
// prettier-ignore
const YOON: Record<string, [string, string?]> = {
  き: ['ky'], し: ['sh', 'sy'], ち: ['ch', 'ty'], に: ['ny'], ひ: ['hy'], み: ['my'], り: ['ry'],
  ぎ: ['gy'], じ: ['j', 'zy'], ぢ: ['j', 'zy'], び: ['by'], ぴ: ['py'],
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

function alts(main: string, kunrei?: string): Seg {
  const out: Seg = [{ s: main, kunrei: false }];
  if (kunrei && kunrei !== main) out.push({ s: kunrei, kunrei: true });
  return out;
}

/** カタカナ → ひらがな（ー はそのまま） */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const lastVowel = (s: string) => s[s.length - 1]!;

/** かなの語を、つづりの候補の列にする */
export function segmentKana(kana: string): Seg[] {
  const src = toHiragana(kana);
  const segs: Seg[] = [];
  let sokuon = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === 'っ') {
      sokuon = true;
      continue;
    }
    let seg: Seg;
    if (next && SMALL_Y[next] && YOON[c]) {
      const [h, k] = YOON[c]!;
      const v = SMALL_Y[next]!;
      seg = alts(h + v, k ? k + v : undefined);
      i++;
    } else if (c === 'ん') {
      const n2 = src[i + 1];
      const beforeVowelOrY = n2 !== undefined && /[あいうえおやゆよ]/.test(n2);
      seg = beforeVowelOrY
        ? [
            { s: "n'", kunrei: false },
            { s: 'n', kunrei: false },
          ]
        : [{ s: 'n', kunrei: false }];
    } else if (c === 'ー' && segs.length > 0) {
      // 長音符: 直前の母音を伸ばす
      const prev = segs[segs.length - 1]!;
      segs[segs.length - 1] = lengthen(prev, null);
      continue;
    } else if (BASE[c]) {
      const prev = segs[segs.length - 1];
      if (prev && !sokuon && isLongVowel(prev, c)) {
        segs[segs.length - 1] = lengthen(prev, BASE[c]![0]);
        continue;
      }
      seg = alts(...BASE[c]!);
    } else {
      throw new Error(`romaji: unsupported kana "${c}" in "${kana}"`);
    }
    if (sokuon) {
      seg = seg.map((a) => ({ s: a.s[0]! + a.s, kunrei: a.kunrei }));
      sokuon = false;
    }
    segs.push(seg);
  }
  return segs;
}

/** 直前の音と同じ母音（お＋う も）が続くと長音 */
function isLongVowel(prev: Seg, kana: string): boolean {
  const v = BASE[kana]![0];
  if (!/^[aiueo]$/.test(v)) return false;
  const pv = lastVowel(prev[0]!.s);
  if (!/[aueo]/.test(pv)) return false; // いい は ii のまま（長音符号を使わない）
  return v === pv || (pv === 'o' && v === 'u');
}

/** 長音: 長音符号・山形・母音を並べる、のいずれも可。written は仮名どおりに並べる母音（ー なら同じ母音） */
function lengthen(prev: Seg, written: string | null): Seg {
  const out: Seg = [];
  for (const a of prev) {
    const v = lastVowel(a.s);
    // 長音が続く（「ラーー」など）は教材データの誤り（コードレビュー #12）
    if (!MACRON[v]) throw new Error(`romaji: 長音を伸ばせない（${a.s}）`);
    const stem = a.s.slice(0, -1);
    out.push({ s: stem + MACRON[v]!, kunrei: a.kunrei });
    out.push({ s: a.s + (written ?? v), kunrei: a.kunrei });
    if (written === 'u' && v === 'o') out.push({ s: a.s + 'o', kunrei: a.kunrei }); // おう を oo と書いても可
  }
  return out;
}

/** 入力の正規化: 小文字・全角英字→半角・山形→長音符号・空白除去 */
export function normalizeRomaji(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/â/g, 'ā')
    .replace(/î/g, 'ī')
    .replace(/û/g, 'ū')
    .replace(/ê/g, 'ē')
    .replace(/ô/g, 'ō')
    .replace(/[’‘`]/g, "'")
    .replace(/[\s-]+/g, ''); // \s は全角空白も含む
}

/** 告示のつづり（長音符号を使う形）。画面の手本に使う */
export function canonicalRomaji(kana: string): string {
  return segmentKana(kana)
    .map((seg) => seg.find((a) => !a.kunrei)!.s)
    .join('');
}

export type RomajiVerdict =
  | { result: 'correct' }
  | { result: 'retry'; reason: 'kunrei'; canonical: string }
  | { result: 'wrong'; canonical: string };

export function judgeRomaji(kana: string, input: string): RomajiVerdict {
  const segs = segmentKana(kana);
  const s = normalizeRomaji(input);
  const canonical = canonicalRomaji(kana);
  // 0: 一致しない, 1: 告示どおり, 2: 訓令式を含む
  const memo = new Map<string, number>();
  const walk = (si: number, pos: number): number => {
    if (si === segs.length) return pos === s.length ? 1 : 0;
    const key = `${si}:${pos}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    for (const a of segs[si]!) {
      if (!s.startsWith(a.s, pos)) continue;
      const r = walk(si + 1, pos + a.s.length);
      if (r === 0) continue;
      const v = a.kunrei || r === 2 ? 2 : 1;
      if (v === 1) {
        best = 1;
        break;
      }
      best = 2;
    }
    memo.set(key, best);
    return best;
  };
  const r = walk(0, 0);
  if (r === 1) return { result: 'correct' };
  if (r === 2) return { result: 'retry', reason: 'kunrei', canonical };
  return { result: 'wrong', canonical };
}
