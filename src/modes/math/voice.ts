import { vocab } from '../../content/vocab';
import type { VoiceEntries } from '../../voice/types';
import { MATH_ITEMS } from './logic';

const perItem: VoiceEntries = {};
for (const id of MATH_ITEMS) {
  const label = vocab(id).label;
  perItem[`math.item-ga.${id}`] = `${label}が`;
  perItem[`math.item-wa.${id}`] = `${label}は`;
}

/** 〜こと（1〜4）。「さんこと にこ」の前半 */
const KO_TO = ['', 'いっこと', 'にこと', 'さんこと', 'よんこと'];
const koTo: VoiceEntries = {};
KO_TO.forEach((t, i) => {
  if (i > 0) koTo[`math.ko-to.${i}`] = t;
});

/**
 * さんすう の音声台本。数字＋助数詞はひらがな（Open JTalk の読み誤りを避ける）。
 * 遊び方の名前（math.variant.*）は共通台本にあるのでここには置かない。
 */
export const voice = {
  ...perItem,
  ...koTo,
  // 場面
  'math.add-more': 'もう',
  'math.add-came': 'きたよ',
  'math.add-none': 'もう ひとつも こなかったよ',
  'math.none': 'ひとつも ないよ',
  'math.aru': 'あるよ',
  'math.tabeta': 'たべたよ',
  'math.kocchi': 'こっちに',
  'math.zenbu': 'ぜんぶで',
  'math.datta': 'だね',
  'math.hint-kocchi': 'こっち',
  // 問い（画面上部の文）
  'math.q-all': 'ぜんぶで なんこ？',
  'math.q-rest': 'のこりは なんこ？',
  'math.q-other': 'あっちは なんこ？',
  'math.q-split': 'ふたつの おさらに わけよう',
  // 式の読み
  'math.plus': 'たす',
  'math.minus': 'ひく',
  'math.wa': { text: 'は', yomi: 'わ' },
  'math.wa-q': { text: 'は？', yomi: 'わ' },
  'math.to': 'と',
  'math.ikutsu': 'いくつ？',
  // 各回の最初の説明
  'math.intro-count': 'えを ゆびで さわると、かぞえられるよ',
  'math.intro-formula': 'しきの こたえを えらんでね。わからない ときは、えで みて みよう',
  'math.intro-split':
    'たべものを ゆびで さわると、おさらに のるよ。ふたつの おさらに わけて みよう',
  // ヒント
  'math.hint-count': 'えを ひとつずつ かぞえよう',
  'math.hint-together': 'いっしょに かぞえて みよう',
  'math.hint-picture': 'えで みて たしかめよう',
  'math.hint-split-1': 'さわって おさらに のせよう',
  'math.hint-split-2': 'どちらにも ひとつ いれてね',
  // 分ける
  'math.split-need': 'ぜんぶ のせて、ふたつに わけよう',
  'math.other-split': 'ほかの わけかたも ある かな？',
  'math.same-split': 'さっきと おなじ わけかただね',
  'math.all-splits': 'ぜんぶの わけかたが でたね',
} satisfies VoiceEntries;
