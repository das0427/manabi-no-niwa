/** reading の見本の問題（統括が画面で確かめる用。本文は見本のために書いたもの） */
import type { ReadingItem, ReadingPassage } from './reading';

/** 説明文（形式段落に番号）。1つの本文を複数の設問で使う */
const TANPOPO: ReadingPassage = {
  id: 'sample-tanpopo',
  title: 'たんぽぽの ちえ',
  genre: 'explain',
  numbered: true,
  paragraphs: [
    ['春《はる》に なると、たんぽぽの 黄色《きいろ》い 花《はな》が さきます。'],
    ['花《はな》が しぼむと、たねが できます。', 'たねには、白《しろ》い わたげが ついて います。'],
    [
      'わたげは、風《かぜ》に のって とおくまで とんで いきます。',
      'こうして、たんぽぽは あちこちに なかまを ふやすのです。',
    ],
  ],
};

/** 物語 */
const KITSUNE: ReadingPassage = {
  id: 'sample-kitsune',
  genre: 'story',
  paragraphs: [
    ['ある 日《ひ》、こぎつねが 森《もり》で 赤《あか》い 木《き》の みを 見《み》つけました。'],
    [
      'こぎつねは、みを ひとつ とって、おかあさんに もって かえりました。',
      'おかあさんは にっこり わらいました。',
    ],
  ],
};

export const READING_SAMPLES: ReadingItem[] = [
  {
    id: 'sample-reading-order',
    engine: 'reading',
    objective: 'o-order',
    level: 0,
    aspect: 'order',
    passage: TANPOPO,
    prompt: '花《はな》が しぼんだ あと、すぐに なにが できますか。',
    options: [
      { label: 'たね', correct: true },
      { label: 'わたげが とぶ', misconception: 'm-order-skip' },
      { label: '黄色《きいろ》い 花《はな》', misconception: 'm-order-before' },
    ],
    hints: [
      '②の だんらくを 読《よ》もう',
      '「しぼむと」の すぐ あとを 見《み》よう',
      '「花《はな》が しぼむと、〇〇が できます」',
    ],
    hintFocus: [[{ p: 2 }], [{ p: 2, s: 1 }], null],
    evidence: [{ p: 2, s: 1 }],
    explain: '②の だんらくに 「花《はな》が しぼむと、たねが できます」と あります。',
    identity: 'reading:tanpopo:order-1',
  },
  {
    id: 'sample-reading-gist',
    engine: 'reading',
    objective: 'o-gist',
    level: 0,
    aspect: 'gist',
    passage: TANPOPO,
    prompt: 'この 文章《ぶんしょう》で いちばん つたえたい ことは どれですか。',
    options: [
      { label: 'たんぽぽは わたげで なかまを ふやす', correct: true },
      { label: 'たんぽぽの 花《はな》は 黄色《きいろ》い', misconception: 'm-gist-detail' },
      { label: 'たんぽぽは 春《はる》に さく', misconception: 'm-gist-detail' },
    ],
    hints: [
      'さいごの だんらくを 読《よ》もう',
      '「こうして」の あとに まとめが あるよ',
      '「なかまを 〇〇〇」',
    ],
    hintFocus: [[{ p: 3 }], [{ p: 3, s: 2 }]],
    evidence: [{ p: 3, s: 2 }],
    explain:
      'さいごの 文《ぶん》「こうして、たんぽぽは あちこちに なかまを ふやすのです」が まとめです。',
    identity: 'reading:tanpopo:gist-1',
  },
  {
    id: 'sample-reading-character',
    engine: 'reading',
    objective: 'o-character',
    level: 0,
    aspect: 'character',
    passage: KITSUNE,
    prompt: 'みを もって かえったのは だれですか。',
    options: [
      { label: 'こぎつね', correct: true },
      { label: 'おかあさん', misconception: 'm-character' },
    ],
    hints: [
      '2つめの だんらくを 読《よ》もう',
      '「もって かえりました」の 前《まえ》を 見《み》よう',
      '「〇〇〇〇は、みを ひとつ とって」',
    ],
    hintFocus: [[{ p: 2 }], [{ p: 2, s: 1 }], [{ p: 2, s: 1 }]],
    evidence: [{ p: 2, s: 1 }],
    explain: '「こぎつねは、みを ひとつ とって、おかあさんに もって かえりました」と あります。',
    identity: 'reading:kitsune:character-1',
  },
];
