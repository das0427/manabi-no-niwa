import type { VoiceEntries } from '../../voice/types';

/**
 * なぞって あそぼう の音声台本（接頭辞 trace.）。
 * trace.variant.* は共通台本（src/voice/catalog/common.ts）にあるのでここには作らない。
 *
 * 字の名前: 単独のひらがなは Open JTalk が読みを揺らす（「へを」の「へ」を助詞の「え」と読む等）。
 * そこで「しを なぞろう」の形で録り、読み（yomi）の中の字だけをカタカナにする（「ヘを なぞろう」）。
 * カタカナはどの字でもひらがなと同じ音なので、15字すべてに同じ規則を使う。
 * 画面に出す文（text）はひらがなのまま。生成後に15字すべて聞いて確かめること。
 */
const kata = (s: string) =>
  [...s].map((c) => (/[ぁ-ゖ]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0x60) : c)).join('');
const LETTER: Record<string, string> = {
  shi: 'し',
  ku: 'く',
  tsu: 'つ',
  he: 'へ',
  no: 'の',
  te: 'て',
  ko: 'こ',
  i: 'い',
  ri: 'り',
  u: 'う',
  chi: 'ち',
  so: 'そ',
  ru: 'る',
  ro: 'ろ',
  hi: 'ひ',
};

const letters: VoiceEntries = {};
// 字の ID（romaji）は content.ts の ROMAJI と同じ（logic.test.ts で一致を検査）。
// 音声台本は起動時に全部読み込むので、content.ts（字の点列）は import しない。
for (const [id, ch] of Object.entries(LETTER))
  letters[`trace.letter.${id}`] = { text: `${ch}を なぞろう`, yomi: `${kata(ch)}を なぞろう` };

export const voice = {
  ...letters,
  'trace.prompt.line': 'みどりから ほしまで なぞろう',
  'trace.prompt.maze': 'みちを とおって ほしへ いこう',
  // ヒント1（注目させる）
  'trace.hint.start': 'みどりの まるから はじめよう',
  'trace.hint.next': 'つぎの まるから はじめよう',
  'trace.hint.resume': 'とまった ところから',
  // ヒント2（お手本の動きをもう一度）
  'trace.hint.watch': 'おてほんを みてね',
  // 逆向き・遠くから始めた線（誤答に数えない声かけ）
  'trace.from-green': 'みどりの まるから かこう',
} satisfies VoiceEntries;
