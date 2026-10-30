/**
 * p5.ja.letter-play おてがみ ごっこ（curriculum-matrix 3.3・docs/expansion/p2-design/p5.md 4章）。
 * plan: だれに なにを つたえるか きめる（explain の理由の選択。採点しない）。
 * write: えと じで おてがみを かく（explain の盤。採点しない）。
 * 子供の名前は書かせない・実在の人の名前を出さない。同一性キー: id と同じ。
 */
import type { UnitSpec } from '../../curriculum/types';
import type { ExplainItem } from '../../engines/explain/explain';
import { ill } from './lib';

type Reason = string | [label: string, illust: string];

const PLAN_EXPLAIN = 'きめられたね。つぎは えと じで かいて みよう。';

function planItem(id: string, prompt: string, reasons: Reason[], alt = false): ExplainItem {
  return {
    engine: 'explain',
    id,
    objective: 'plan',
    level: 0,
    ...(alt ? { alt: true } : {}),
    prompt,
    reasons: reasons.map((r) =>
      typeof r === 'string' ? { label: r } : { label: r[0], figure: ill(r[1]) },
    ),
    require: { reason: true },
    hints: ['つたえたい ひとの かおを おもいうかべよう。', 'どれを えらんでも いいよ。'],
    explain: PLAN_EXPLAIN,
    identity: id,
  };
}

const WRITE_EXPLAIN = 'すてきな おてがみが できたね。おうちの ひとと いっしょに みよう。';

function writeItem(
  id: string,
  prompt: string,
  model: string | null,
  canvas: NonNullable<ExplainItem['canvas']>,
  alt = false,
): ExplainItem {
  return {
    engine: 'explain',
    id,
    objective: 'write',
    level: 1,
    ...(alt ? { alt: true } : {}),
    prompt,
    ...(model ? { figure: { kind: 'text', text: model, size: 'l' } } : {}),
    canvas,
    hints: [
      'ゆっくりで いいよ。えだけでも つたわるよ。',
      'じが むずかしい ときは、おうちの ひとに てつだって もらおう。',
    ],
    explain: WRITE_EXPLAIN,
    identity: id,
  };
}

export const letterPlay: UnitSpec = {
  id: 'p5.ja.letter-play',
  title: 'おてがみ ごっこ',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'record',
  priority: 'P2',
  status: 'ready',
  icon: 'p5-letter',
  prereq: ['p5.hand.kana-trace'],
  objectives: [
    { id: 'plan', title: 'だれに なにを つたえるか きめる' },
    { id: 'write', title: 'えと じで おてがみを かく' },
  ],
  // 採点しない記録なので誤概念は持たない（life-g12 の growth と同じ扱い）
  misconceptions: [],
  levels: [
    { label: 'だれに なにを きめる', chance: 0.1 },
    { label: 'えと じで かく', chance: 0.1 },
  ],
  intro: [
    { text: 'おてがみで、きもちを つたえて みよう。', figure: ill('p5-letter') },
    { text: 'じは ひとつでも いいよ。えだけでも つたわるよ。', figure: ill('heart') },
  ],
  source: {
    kind: 'items',
    items: [
      planItem('plan:who', 'おてがみを だれに かこうかな？', [
        'おうちの ひと',
        'ともだち',
        'せんせい',
        'どうぶつ',
      ]),
      planItem('plan:feeling', 'どんな きもちを つたえたい？', [
        'ありがとう',
        'だいすき',
        'あそぼうね',
        'おめでとう',
      ]),
      planItem('plan:birthday', 'おたんじょうびの ひとに、なんと かく？', [
        'おめでとう',
        'いつも ありがとう',
        'また あそぼうね',
      ]),
      planItem('plan:get-well', 'かぜで おやすみの ともだちに、なんと かく？', [
        'はやく げんきに なってね',
        'まって いるよ',
        'また あそぼうね',
      ]),
      planItem('plan:thanks', 'てつだって くれた ひとに、なんと かく？', [
        'ありがとう',
        'たすかったよ',
        'うれしかったよ',
      ]),
      planItem('plan:what', 'おてがみに なにを かく？', ['え', 'じ', 'えと じ']),
      planItem(
        'plan:pic-thanks',
        'えだけで「ありがとう」を つたえよう。どの えに する？',
        [
          ['ハート', 'heart'],
          ['おはな', 'flower'],
          ['リボン', 'p5-ribbon'],
        ],
        true,
      ),
      planItem(
        'plan:pic-play',
        'えだけで「あそぼう」を つたえよう。どの えに する？',
        [
          ['ボール', 'ball'],
          ['じてんしゃ', 'bicycle'],
          ['えほん', 'p5-book'],
        ],
        true,
      ),
      planItem(
        'plan:pic-well',
        'えだけで「げんきに なってね」を つたえよう。どの えに する？',
        [
          ['おひさま', 'p5-sun'],
          ['りんご', 'apple'],
          ['おはな', 'flower'],
        ],
        true,
      ),
      writeItem('write:picture', 'おてがみに すきな えを かこう。', null, { aspect: 4 / 3 }),
      writeItem(
        'write:arigatou',
        '「ありがとう」と かいて みよう。みながら かいて いいよ。',
        'ありがとう',
        { aspect: 16 / 9, guide: 'lines' },
      ),
      writeItem('write:daisuki', '「だいすき」と かいて、ハートの えも かこう。', 'だいすき', {
        aspect: 4 / 3,
      }),
      writeItem('write:omedetou', '「おめでとう」と かいて みよう。', 'おめでとう', {
        aspect: 16 / 9,
        guide: 'lines',
      }),
      writeItem(
        'write:asobou',
        '「あそぼうね」と かいて、あそびたい ことの えも かこう。',
        'あそぼうね',
        { aspect: 4 / 3 },
      ),
      writeItem('write:free', 'つたえたい ことばを かんがえて、えと じで かこう。', null, {
        aspect: 4 / 3,
      }),
      writeItem(
        'write:postcard',
        'はがきを かこう。うえに え、したに「げんき？」と かこう。',
        'げんき？',
        { aspect: 0.7 },
        true,
      ),
      writeItem(
        'write:notice',
        'おしらせを かこう。「あした あそぼう」と かいて みよう。',
        'あした あそぼう',
        { aspect: 16 / 9, guide: 'lines' },
        true,
      ),
      writeItem(
        'write:tag',
        'おくりものに つける、ちいさな ふだを かこう。',
        null,
        { aspect: 1.5 },
        true,
      ),
    ],
  },
  review: 'none',
  basis:
    '幼稚園教育要領 言葉 内容(10)（日常生活の中で、文字などで伝える楽しさを味わう）、同解説（5歳児は書くことはまだ難しく、自分なりの書き方が多い。文字を使う喜びを味わう）、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
