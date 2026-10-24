/** fill の見本の問題（統括が画面で確かめる用。checkFill が誤りを返さないことをテストで確かめる） */
import type { FillItem } from './fill';

export const fillSamples: FillItem[] = [
  {
    engine: 'fill',
    id: 'sample-fill:particles',
    objective: 'fill-particles',
    level: 1,
    prompt: '{{}}に はいる じを えらぼう。',
    text: 'ぼく{{}} こうえん{{}} ボール{{}} もって いく。',
    options: ['は', 'わ', 'へ', 'え', 'を', 'お'],
    blanks: [
      { answers: ['は'], wrong: [{ value: 'わ', misconception: 'particle-ha-wa' }] },
      { answers: ['へ'], wrong: [{ value: 'え', misconception: 'particle-he-e' }] },
      { answers: ['を'], wrong: [{ value: 'お', misconception: 'particle-wo-o' }] },
    ],
    hints: [
      'こえに だすと 「わ」「え」「お」と きこえる ところ だよ。',
      '「〜は」「〜へ」「〜を」は ことばと ことばを つなぐ じ だよ。',
      'ぼく「は」、こうえん「へ」、ボール「を」 と かくよ。',
    ],
    explain: 'ぼく**は** こうえん**へ** ボール**を** もって いく。',
    identity: 'fill:particles-boku-kouen',
  },
  {
    engine: 'fill',
    id: 'sample-fill:add-box',
    objective: 'fill-box',
    level: 0,
    prompt: '{{}}に はいる かずを えらぼう。',
    text: '3 ＋ {{}} ＝ 8',
    options: ['4', '5', '6', '11'],
    blanks: [{ answers: ['5'], wrong: [{ value: '11', misconception: 'box-add-all' }] }],
    hints: [
      '3に いくつ たすと 8に なるかな。',
      'ゆびで 4、5、6… と かぞえて みよう。',
      '8 − 3 で もとめられるよ。',
    ],
    explain: '3 ＋ 5 ＝ 8 だから 5 だよ。',
    identity: 'fill:3+?=8',
  },
  {
    engine: 'fill',
    id: 'sample-fill:conjunction',
    objective: 'fill-conjunction',
    level: 2,
    prompt: 'つなぐ ことばを いれよう。',
    text: 'あめが ふって きた。{{}}、かさを さした。\nかさを さした。{{}}、ふくが ぬれた。',
    options: ['だから', 'でも'],
    useOnce: true,
    blanks: [
      { answers: ['だから'], wrong: [{ value: 'でも', misconception: 'conj-reverse' }] },
      { answers: ['でも'], wrong: [{ value: 'だから', misconception: 'conj-reverse' }] },
    ],
    hints: [
      'まえの ぶんと あとの ぶんの つながりを かんがえよう。',
      'あめが ふったら、かさを さすのは あたりまえ かな。',
      'かさを さしたのに ぬれた のは、おもって いた ことと ちがうね。',
    ],
    explain:
      '「だから」は あたりまえの つながり、「でも」は ちがう ことが おきる ときに つかうよ。',
    identity: 'fill:conj-ame-kasa',
  },
];
