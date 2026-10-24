/** order の見本の問題（統括が画面で確かめる用。checkOrder が誤りを返さないことをテストで確かめる） */
import type { OrderItem } from './order';

export const orderSamples: OrderItem[] = [
  {
    engine: 'order',
    id: 'sample-order:num-small-first',
    objective: 'order-number',
    level: 0,
    prompt: 'ちいさい じゅんに ならべよう。',
    cards: [{ label: '2' }, { label: '5' }, { label: '7' }, { label: '9' }],
    ends: ['ちいさい', 'おおきい'],
    reverseMisconception: 'order-reverse',
    hints: [
      'いちばん ちいさい かずは どれかな。',
      '2の つぎに ちいさい かずを さがそう。',
      'かずの せんで ひだりに ある ほうが ちいさいよ。',
    ],
    explain: '2、5、7、9 の じゅんだよ。',
    identity: 'order:2-5-7-9',
  },
  {
    engine: 'order',
    id: 'sample-order:egg-chick',
    objective: 'order-time',
    level: 0,
    prompt: 'うまれる じゅんに ならべよう。',
    cards: [
      { figure: { kind: 'illust', id: 'egg' }, name: 'たまご' },
      { figure: { kind: 'illust', id: 'chick' }, name: 'ひよこ' },
      { figure: { kind: 'illust', id: 'bird' }, name: 'とり' },
    ],
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'order-reverse',
    hints: ['さいしょは なにから うまれるかな。', 'たまごの つぎは ひよこだね。'],
    explain: 'たまご → ひよこ → とり の じゅんだよ。',
    identity: 'order:egg-chick-bird',
  },
  {
    engine: 'order',
    id: 'sample-order:diary',
    objective: 'order-sentence',
    level: 1,
    prompt: 'おはなしの じゅんに ぶんを ならべよう。',
    layout: 'column',
    cards: [
      { label: 'あさ、バスに のりました。' },
      { label: 'どうぶつえんで ぞうを 見《み》ました。' },
      { label: 'おひるに おべんとうを たべました。' },
      { label: 'ゆうがた、いえに かえりました。' },
    ],
    wrongOrders: [{ order: [1, 0, 2, 3], misconception: 'order-skip-start' }],
    hints: [
      'あさ・おひる・ゆうがた の ことばに めを つけよう。',
      'いちばん はじめに した ことは どれかな。',
      'さいごは いえに かえった ところだね。',
    ],
    explain: 'あさ → どうぶつえん → おひる → ゆうがた の じゅんだよ。',
    identity: 'order:diary-zoo',
  },
];
