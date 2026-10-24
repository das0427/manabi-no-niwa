/** match の見本の問題（統括が画面で確かめる用。checkMatch が誤りを返さないことをテストで確かめる） */
import type { MatchItem } from './match';

export const matchSamples: MatchItem[] = [
  {
    engine: 'match',
    id: 'sample-match:kanji-reading',
    objective: 'match-kanji-read',
    level: 0,
    prompt: '漢字《かんじ》と よみを せんで むすぼう。',
    left: [{ label: '山《!やま》' }, { label: '川《!かわ》' }, { label: '木《!き》' }],
    right: [{ label: 'き' }, { label: 'やま' }, { label: 'かわ' }, { label: 'ひ' }],
    pairs: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    wrongPairs: [{ pair: [1, 1], misconception: 'kanji-shape-mix' }],
    hints: [
      'えから できた 字《じ》だよ。かたちを よく みよう。',
      'やまは とがった かたち だね。',
      'かわは みずが ながれる かたち だよ。',
    ],
    explain: '山《やま》は やま、川《かわ》は かわ、木《き》は き と よむよ。',
    identity: 'match:yama-kawa-ki',
  },
  {
    engine: 'match',
    id: 'sample-match:length-units',
    objective: 'match-units',
    level: 1,
    prompt: 'おなじ ながさを むすぼう。',
    left: [{ label: '1m' }, { label: '1cm' }, { label: '1km' }],
    right: [{ label: '100cm' }, { label: '10mm' }, { label: '1000m' }, { label: '10cm' }],
    pairs: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    wrongPairs: [{ pair: [0, 3], misconception: 'unit-m-cm-10' }],
    hints: ['1mは なんcmかな。', '1cmは 10こに わけた 1つが 1mm だよ。', '1kmは 1000m だよ。'],
    explain: '1m＝100cm、1cm＝10mm、1km＝1000m だよ。',
    identity: 'match:units-m-cm-km',
  },
  {
    engine: 'match',
    id: 'sample-match:animal-food',
    objective: 'match-picture',
    level: 0,
    prompt: 'すきな たべものと むすぼう。',
    left: [
      { figure: { kind: 'illust', id: 'rabbit' }, name: 'うさぎ' },
      { figure: { kind: 'illust', id: 'monkey' }, name: 'さる' },
    ],
    right: [
      { figure: { kind: 'illust', id: 'carrot' }, name: 'にんじん' },
      { figure: { kind: 'illust', id: 'banana' }, name: 'バナナ' },
    ],
    pairs: [
      [0, 0],
      [1, 1],
    ],
    hints: ['うさぎが すきなのは どれかな。', 'さるは きいろい たべものが すきだよ。'],
    explain: 'うさぎは にんじん、さるは バナナ だね。',
    identity: 'match:rabbit-monkey',
  },
];
