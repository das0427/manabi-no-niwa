import { VOCAB } from '../../content/vocab';
import type { VoiceEntries } from '../types';

/** 0〜10 の数の読み（数えるとき「いち、に、さん」） */
const NUM_READ = [
  'ぜろ',
  'いち',
  'に',
  'さん',
  'よん',
  'ご',
  'ろく',
  'なな',
  'はち',
  'きゅう',
  'じゅう',
];
/** 〜こ（0〜10） */
const KO = [
  'ぜろこ',
  'いっこ',
  'にこ',
  'さんこ',
  'よんこ',
  'ごこ',
  'ろっこ',
  'ななこ',
  'はっこ',
  'きゅうこ',
  'じゅっこ',
];
/** 〜ひき（0〜10） */
const HIKI = [
  'ぜろひき',
  'いっぴき',
  'にひき',
  'さんびき',
  'よんひき',
  'ごひき',
  'ろっぴき',
  'ななひき',
  'はっぴき',
  'きゅうひき',
  'じゅっぴき',
];

const numbers: VoiceEntries = {};
NUM_READ.forEach((t, i) => (numbers[`num.${i}`] = t));
KO.forEach((t, i) => (numbers[`count.ko.${i}`] = t));
HIKI.forEach((t, i) => (numbers[`count.hiki.${i}`] = t));

const items: VoiceEntries = {};
for (const v of VOCAB) items[`item.${v.id}`] = v.label;

/** 全モード共通の文 */
export const commonVoice = {
  ...numbers,
  ...items,
  'app.welcome': 'まなびのにわへ ようこそ',
  'app.start': 'はじめるを おしてね',
  'app.who': 'だれが あそぶ？',
  'app.home': 'なにで あそぶ？',
  'app.recommend': 'きょうの おすすめ',
  'app.notebook': 'がんばりノート',
  'app.resume': 'つづきから する？',
  'app.resume.yes': 'つづきから',
  'app.resume.no': 'はじめから',
  'app.choose-variant': 'どれで あそぶ？',
  'app.timeup': 'きょうは ここまでに しよう。また あそぼうね',
  'app.again': 'もういっかい',
  'app.gohome': 'おうちに もどるよ',
  'app.liked': 'すきに したよ',
  'app.next': 'つぎに いこう',
  'app.lets-try': 'やって みよう',
  'app.ok': 'そうだね',
  'app.right': 'あってるね',
  'app.try-again': 'ちがうみたい。もういちど やって みよう',
  'app.look-again': 'よく みてね',
  'app.show-answer': 'こたえは これだよ。つぎに いこう',
  'app.done': 'おしまい',
  'app.parent-only': 'ここは おとなの ひとの ばしょだよ',
  'app.no-sound': 'おとが でないみたい',
  // 行動に基づく声かけ（learning-design.md「声かけの例と条件」）
  'praise.counted': 'ひとつずつ かぞえられたね',
  'praise.rotated': 'むきを かえたら つながったね',
  'praise.self-fixed': 'もういちど やって できたね',
  'praise.traced': 'さいごまで なぞれたね',
  'praise.start-point': 'みどりの まるから かけたね',
  'praise.reviewed': 'もういちど みて たしかめたね',
  'praise.other-split': 'ちがう わけかたも みつけたね',
  'praise.sorted-color': 'いろで わけられたね',
  'praise.sorted-kind': 'なかまで わけられたね',
  'praise.gathered': 'ちゅうもんどおりに そろえられたね',
  'praise.picture-checked': 'えで たしかめたね',
  'praise.finished': 'さいごまで できたね',
  // 全部の問題を「つぎへ」で進んだ回（自分で解いた問題がない）の完了画面
  'praise.watched': 'いっしょに さいごまで みたね',
  // 遊び方の名前（src/modes/registry.ts）
  'road.variant.puzzle': 'もんだい',
  'road.variant.free': 'じゆうに つくる',
  'trace.variant.lines': 'せん',
  'trace.variant.maze': 'めいろ',
  'trace.variant.letters': 'もじ',
  'math.variant.add': 'たす',
  'math.variant.sub': 'ひく',
  'math.variant.split': 'わける',
  'math.variant.formula-add': 'しき たす',
  'math.variant.formula-sub': 'しき ひく',
  // モード名
  'title.shopping': 'おかいものごっこ',
  'title.hiragana': 'ひらがな',
  'title.sorting': 'なかまわけ',
  'title.shapes': 'かたち パズル',
  'title.memory': 'おぼえて さがす',
  'title.compare': 'くらべっこ',
  'title.road': 'みちを つくろう',
  'title.trace': 'なぞって あそぼう',
  'title.math': 'さんすう',
} satisfies VoiceEntries;
