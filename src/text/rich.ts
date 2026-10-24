/**
 * 教材の文の小さな記法（docs/expansion/architecture.md 4章）。純粋関数。
 *
 *   漢字《かんじ》     … よみ付きの語（ふりがなを出すかは表示側が決める）
 *   [[3/4]]           … 分数   [[2 1/3]] … 帯分数
 *   **強い**          … 強調
 *   {{  }}            … 空欄（穴埋め）
 *
 * 規則: 教材の文の漢字は必ず《》のよみ付きの語の中に置く（findBareKanji で検査）。
 */
export type Token =
  | { t: 'text'; s: string }
  | { t: 'ruby'; base: string; reading: string }
  | { t: 'frac'; whole?: number; num: number; den: number }
  | { t: 'strong'; children: Token[] }
  | { t: 'blank' };

const KANJI = /[一-鿿㐀-䶿々]/;

/** 文をトークン列にする */
export function parseRich(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', s: buf });
    buf = '';
  };
  while (i < src.length) {
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2);
      if (end > i) {
        flush();
        out.push({ t: 'strong', children: parseRich(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (src.startsWith('[[', i)) {
      const end = src.indexOf(']]', i + 2);
      const frac = end > i ? parseFrac(src.slice(i + 2, end)) : null;
      if (frac) {
        flush();
        out.push(frac);
        i = end + 2;
        continue;
      }
    }
    if (src.startsWith('{{', i)) {
      const end = src.indexOf('}}', i + 2);
      if (end > i) {
        flush();
        out.push({ t: 'blank' });
        i = end + 2;
        continue;
      }
    }
    const ch = src[i]!;
    if (ch === '《') {
      const end = src.indexOf('》', i + 1);
      if (end > i) {
        // 直前の、漢字（と送り仮名でない部分）の並びを親文字にする
        const m = /[一-鿿㐀-䶿々〆ヶ]+$/.exec(buf);
        if (m) {
          const base = m[0];
          buf = buf.slice(0, buf.length - base.length);
          flush();
          out.push({ t: 'ruby', base, reading: src.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function parseFrac(s: string): Token | null {
  const m = /^\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
  if (!m) return null;
  return {
    t: 'frac',
    whole: m[1] !== undefined ? Number(m[1]) : undefined,
    num: Number(m[2]),
    den: Number(m[3]),
  };
}

/** よみ付きでない漢字（規則違反）を返す */
export function findBareKanji(src: string): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const tk of ts) {
      if (tk.t === 'text') for (const c of tk.s) if (KANJI.test(c)) bad.push(c);
      if (tk.t === 'strong') walk(tk.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

/** 画面に出す文（ふりがな・記号を取り除いた素の文。長さの検査や aria 用） */
export function plainText(src: string): string {
  const walk = (ts: Token[]): string =>
    ts
      .map((tk) => {
        switch (tk.t) {
          case 'text':
            return tk.s;
          case 'ruby':
            return tk.base;
          case 'frac':
            return `${tk.whole !== undefined ? `${tk.whole}と` : ''}${tk.num}/${tk.den}`;
          case 'strong':
            return walk(tk.children);
          case 'blank':
            return '□';
        }
      })
      .join('');
  return walk(parseRich(src));
}

const KANSUJI = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

/** 1〜9999 の数をひらがなで（読み上げ用。大きな数は数字のまま Open JTalk に任せる） */
export function numberReading(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n === 0) return 'ぜろ';
  const sen = Math.floor(n / 1000);
  const hyaku = Math.floor((n % 1000) / 100);
  const ju = Math.floor((n % 100) / 10);
  const ichi = n % 10;
  const senR =
    sen === 0
      ? ''
      : sen === 1
        ? 'せん'
        : sen === 3
          ? 'さんぜん'
          : sen === 8
            ? 'はっせん'
            : `${KANSUJI[sen]}せん`;
  const hyakuR =
    hyaku === 0
      ? ''
      : hyaku === 1
        ? 'ひゃく'
        : hyaku === 3
          ? 'さんびゃく'
          : hyaku === 6
            ? 'ろっぴゃく'
            : hyaku === 8
              ? 'はっぴゃく'
              : `${KANSUJI[hyaku]}ひゃく`;
  const juR = ju === 0 ? '' : ju === 1 ? 'じゅう' : `${KANSUJI[ju]}じゅう`;
  return senR + hyakuR + juR + KANSUJI[ichi];
}

/**
 * 読み上げ用のよみ（台本の yomi）。漢字は《》のよみ、分数は「よんぶんの さん」。
 * Open JTalk に漢字を読ませないことで、読み誤りを防ぐ（architecture.md 10章）。
 */
export function spokenReading(src: string): string {
  const walk = (ts: Token[]): string =>
    ts
      .map((tk) => {
        switch (tk.t) {
          case 'text':
            return tk.s;
          case 'ruby':
            return tk.reading;
          case 'frac': {
            const f = `${numberReading(tk.den)}ぶんの ${numberReading(tk.num)}`;
            return tk.whole !== undefined ? `${numberReading(tk.whole)}と ${f}` : f;
          }
          case 'strong':
            return walk(tk.children);
          case 'blank':
            return 'なに';
        }
      })
      .join('');
  return walk(parseRich(src));
}
