/** geometry の見本の問題（統括が画面で確かめる用。checkGeometry が誤りを返さないこと） */
import type { GeometryItem } from './geometry';

export const geometrySamples: GeometryItem[] = [
  {
    // 小2: 形を見分ける（すべて選ぶ）
    id: 'geo-sample:pick-right-triangle',
    engine: 'geometry',
    objective: 'right-angle',
    level: 0,
    prompt: 'ちょっかくが ある さんかくけいを ぜんぶ えらぼう',
    hints: [
      'さんかくじょうぎの かどと くらべよう',
      'たてと よこの せんが まじわる かどを さがそう',
      'かどが 1つ ちょっかく なら ちょっかくさんかくけい',
    ],
    explain: '1ばんと 3ばんは ちょっかくの かどが あるよ',
    identity: 'pick:right-tri:a',
    task: {
      kind: 'pick',
      multi: true,
      options: [
        {
          shape: {
            points: [
              [0, 0],
              [0, 3],
              [4, 3],
            ],
          },
          correct: true,
        },
        {
          shape: {
            points: [
              [0, 3],
              [2, 0],
              [4, 3],
            ],
          },
          misconception: 'mis-looks-right',
        },
        {
          shape: {
            points: [
              [0, 0],
              [3, 0],
              [0, 2],
            ],
          },
          correct: true,
        },
        {
          shape: {
            points: [
              [0, 3],
              [1, 0],
              [5, 2],
            ],
          },
          misconception: 'mis-looks-right',
        },
      ],
    },
  },
  {
    // 小2: 方眼に長方形をかく
    id: 'geo-sample:draw-rect-3x5',
    engine: 'geometry',
    objective: 'draw-rect',
    level: 1,
    prompt: 'たて 3、よこ 5 の ちょうほうけいを かこう',
    hints: [
      'てんを じゅんに タップして、さいごに さいしょの てんを タップしよう',
      'よこに 5ます、たてに 3ます',
      'かどは みんな ちょっかく だよ',
    ],
    explain: 'たて 3ます、よこ 5ますで、かどが みんな ちょっかくの しかくけい だよ',
    identity: 'draw:rect:3x5',
    task: {
      kind: 'draw',
      grid: { w: 8, h: 6 },
      target: { kind: 'shape', shape: 'rectangle', sides: [3, 5, 3, 5] },
    },
    misconceptions: { wrongSides: 'mis-count-dots', wrongClass: 'mis-not-right-angle' },
  },
  {
    // 小6: 線対称の位置にかく
    id: 'geo-sample:draw-reflect',
    engine: 'geometry',
    objective: 'symmetry',
    level: 2,
    prompt: 'てんせんを たいしょうの じくに して、せんたいしょうな かたちを かこう',
    hints: [
      'じくから おなじ きょりの ところに てんを うとう',
      'ちょうてんの 1つずつ、じくの はんたいがわの てんを さがそう',
      'さいごに てんを むすんで とじよう',
    ],
    explain: 'じくから おなじ きょりに、はんたいがわへ うつした かたちだよ',
    identity: 'draw:reflect:a',
    task: {
      kind: 'draw',
      grid: { w: 10, h: 6 },
      given: [
        {
          points: [
            [1, 1],
            [4, 1],
            [4, 5],
            [2, 4],
          ],
        },
      ],
      target: {
        kind: 'reflect',
        points: [
          [1, 1],
          [4, 1],
          [4, 5],
          [2, 4],
        ],
        axis: [
          [5, 0],
          [5, 6],
        ],
      },
    },
    misconceptions: { translated: 'mis-translate' },
  },
  {
    // 小4: 分度器で角を測る
    id: 'geo-sample:angle-130',
    engine: 'geometry',
    objective: 'protractor',
    level: 3,
    prompt: 'この かくは なんど？',
    hints: [
      'ぶんどきの 0の せんが へんに かさなって いるよ',
      '0から はじまる めもりを よもう',
      'もう 1つの へんが とおる めもりは？',
    ],
    explain: '0から はじまる めもりで よむと 130° だよ',
    identity: 'angle:130',
    task: { kind: 'angle', degrees: 130, base: 10 },
    misconceptions: { otherScale: 'mis-other-scale' },
  },
];
