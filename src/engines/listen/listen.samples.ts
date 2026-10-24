/** listen の見本の問題（統括が画面で確かめる用。教材パックの書き方の例） */
import type { ListenItem } from './listen';

export const LISTEN_SAMPLES: ListenItem[] = [
  {
    id: 'sample-listen-word',
    engine: 'listen',
    objective: 'o1',
    level: 0,
    prompt: 'きこえた ものは どれかな',
    audio: { text: 'うさぎ' },
    options: [
      { figure: { kind: 'illust', id: 'rabbit' }, label: 'うさぎ', correct: true },
      { figure: { kind: 'illust', id: 'cat' }, label: 'ねこ', misconception: 'm-sound' },
      { figure: { kind: 'illust', id: 'dog' }, label: 'いぬ', misconception: 'm-sound' },
    ],
    hints: ['もういちど よく きいてね', 'さいしょの おとは 「う」だよ'],
    explain: '「うさぎ」と いったね',
    identity: 'listen:word:うさぎ',
  },
  {
    id: 'sample-listen-count',
    engine: 'listen',
    objective: 'o2',
    level: 0,
    prompt: 'おとは いくつ あったかな',
    audio: [{ text: 'た' }, { text: 'い' }, { text: 'こ' }],
    gapMs: 600,
    options: [
      { label: '2つ', misconception: 'm-count' },
      { label: '3つ', correct: true },
      { label: '4つ', misconception: 'm-count' },
    ],
    fixedOrder: true,
    hints: ['てを たたきながら きいてね', '「た」「い」…と かぞえよう'],
    explain: '「た・い・こ」で 3つ だね',
    identity: 'listen:count:たいこ',
  },
  {
    id: 'sample-listen-en',
    engine: 'listen',
    objective: 'o3',
    level: 0,
    prompt: '聞《き》こえた ものを えらぼう',
    audio: { text: 'apple', key: 'en-sample/apple' },
    options: [
      { figure: { kind: 'illust', id: 'apple' }, label: 'りんご', correct: true },
      { figure: { kind: 'illust', id: 'banana' }, label: 'バナナ', misconception: 'm-word' },
      { figure: { kind: 'illust', id: 'strawberry' }, label: 'いちご', misconception: 'm-word' },
    ],
    hints: [
      'もういちど 聞《き》いてみよう',
      'さいしょの 音《おと》に 注目《ちゅうもく》しよう',
      '赤《あか》くて まるい くだものだよ',
    ],
    explain: 'apple は りんご だよ',
    identity: 'listen:en:apple',
  },
];
