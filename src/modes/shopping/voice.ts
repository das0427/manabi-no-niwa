import { vocab } from '../../content/vocab';
import type { VoiceEntries } from '../../voice/types';
import { SHOP_ITEMS } from './logic';

const KO_TO = ['', 'いっこと', 'にこと', 'さんこと', 'よんこと', 'ごこと'];

const perItem: VoiceEntries = {};
for (const id of SHOP_ITEMS) {
  const label = vocab(id).label;
  perItem[`shop.item-wo.${id}`] = `${label}を`;
  perItem[`shop.item-ga.${id}`] = `${label}が`;
}
const counts: VoiceEntries = {};
KO_TO.forEach((t, i) => {
  if (i > 0) counts[`shop.count-to.${i}`] = t;
});

/** おかいものごっこ の音声台本 */
export const voice = {
  ...perItem,
  ...counts,
  'shop.intro': 'おみせやさんだよ。ちゅうもんの ものを かごに いれてね',
  'shop.how': 'できたら おねがいしますを おしてね',
  'shop.kudasai': 'ください',
  'shop.register': 'これで おねがいします',
  'shop.thanks': 'ありがとう。ちゅうもんどおりだね',
  'shop.total': 'ぜんぶで',
  'shop.short': 'たりないみたい',
  'shop.many': 'おおいみたい。かごの なかを かぞえて みよう',
  'shop.look-order': 'ちゅうもんの えを みて みよう',
  'shop.basket-full': 'かごが いっぱいだよ',
  'shop.answer': 'こたえは これだよ',
  'shop.looks-right': 'あってるよ。おねがいしますを おしてね',
} satisfies VoiceEntries;
