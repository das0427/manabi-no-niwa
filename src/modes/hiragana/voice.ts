import { vocab } from '../../content/vocab';
import type { VoiceEntries } from '../../voice/types';
import { INCLUDED_KANA, KANA_TABLE, WORDS_2, WORDS_3 } from './kana-table';

/**
 * ひらがなの音声台本。字ごとの台本は kana-table.ts から作る（字を足すと台本も増える）。
 *
 * 【生成後に聞いて直すこと（統括へ）】単独の仮名は Open JTalk で読みが揺れる。
 *  - 「は」が「わ」、「へ」が「え」と読まれる（助詞扱い）。kana.char.ha / kana.char.he
 *  - 無声化: 「す」「く」「し」「ひ」「ふ」「き」「ち」「つ」が息だけになる。kana.char.su / ku / si ...
 *  - 「ん」「を」の単独は不安定。kana.char.n
 * 直し方の候補（上から試す。{ text, yomi } にすれば画面の文字は変わらない。長めに伸ばす「はー」は不可）:
 *  1. まず text と同じ（いまの台本）で生成して聞く
 *  2. だめなら yomi をカタカナ（「ハ」「ヘ」「ス」）にする
 *  3. それでもだめなら yomi を「『は』」（かぎ括弧つき）にする。最後は例語の音源から頭だけを切り出す
 *  文の中の字（kana.q.* 『あ』は どれかな / kana.ex.* 『あ』は ありの 『あ』）は、
 *  かぎ括弧つきで文として読まれるので揺れにくいが、「は」「へ」を含む文は必ず聞いて確かめる。
 */
const entries: VoiceEntries = {};

/**
 * 字を単独で・かぎ括弧の中で読ませるときの読み（統括が生成後に確認して決めた方法）。
 * Open JTalk は単独の「は」を助詞として「わ」と読む（g2p で "w a" を確認）。
 * 読み（yomi）だけをカタカナにすると「ハ」= "h a" になる。画面の文字（text）はひらがなのまま。
 * カタカナはどの字でもひらがなと同じ音なので、全部の字に同じ規則を使う。
 */
const kata = (s: string) =>
  [...s].map((c) => (/[ぁ-ゖ]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0x60) : c)).join('');

for (const e of KANA_TABLE) {
  if (!e.included && !e.tileOnly) continue;
  entries[`kana.char.${e.romaji}`] = { text: e.char, yomi: kata(e.char) };
}

for (const e of INCLUDED_KANA) {
  const label = vocab(e.word!).label;
  const k = kata(e.char);
  entries[`kana.q.${e.romaji}`] = { text: `『${e.char}』は どれかな`, yomi: `「${k}」は どれかな` };
  entries[`kana.ex.${e.romaji}`] = {
    text: `『${e.char}』は ${label}の 『${e.char}』`,
    yomi: `「${k}」は ${label}の 「${k}」`,
  };
  const chars = [...label];
  entries[`kana.first.${e.word}`] = `${label}の はじめの おとは どれかな`;
  // ゆっくり区切って言う（ヒント1）
  entries[`kana.slow.${e.word}`] = {
    text: chars.join('・'),
    yomi: chars.map(kata).join('、'),
    speed: 0.75,
  };
  entries[`kana.split.${e.word}`] = {
    text: `${chars.join('・')}の ${e.char}`,
    yomi: `${chars.map(kata).join('、')}の 「${k}」`,
  };
}

const NTH = ['', 'いちばんめ', 'にばんめ', 'さんばんめ'];
for (const id of [...WORDS_2, ...WORDS_3]) {
  const label = vocab(id).label;
  entries[`kana.make.${id}`] = `${label}を つくろう`;
  [...label].forEach((_, i) => {
    entries[`kana.pos.${id}.${i + 1}`] = `${label}の ${NTH[i + 1]}の おと`;
  });
}

/** ひらがな の音声台本 */
export const voice = {
  ...entries,
  'kana.how-pick': 'こえを きいて、あう もじを おしてね',
  'kana.how-first': 'えと なまえを きいて、はじめの おとの もじを おしてね',
  'kana.how-build': 'もじを おして、ことばを つくろう',
  'kana.listen-prompt': 'こえを きいて えらぼう',
  'kana.first-short': 'はじめの おとは どれかな',
  'kana.that-is': 'それは',
  'kana.dayo': 'だよ',
  'kana.listen-again': 'もういちど きいてね',
  'kana.nth.1': 'いちばんめは',
  'kana.nth.2': 'にばんめは',
  'kana.nth.3': 'さんばんめは',
} satisfies VoiceEntries;
