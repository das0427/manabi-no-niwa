/**
 * g1.ja.kanji-read-g1 かんじを よむ（1年の漢字80字）: curriculum-matrix 3.4。
 *
 * 字のデータ表（data/rows-g1.ts: 80字・語例237・文80）から、語の中で読む → 文の中で読む → 同じ字の別の読み、の順で出す。
 * 読みは小学校で学ぶ音訓に限る。形式は choice（選ぶ）・build（かなタイルで読みを作る）・fill（文の空欄に入れる）。
 * 配当表の「字と絵（象形）」の入口は、この単元には置いていない（絵の字形は書き問題の trace が受け持つ）。
 */
import type { UnitSpec } from '../../curriculum/types';
import { READ_LEVELS, READ_MISCONCEPTIONS } from './read-common';
import { makeReadModel } from './read-gen';
import { ENTRIES_G1 } from './table';

const model = makeReadModel(1, ENTRIES_G1);

export const kanjiReadG1: UnitSpec = {
  id: 'g1.ja.kanji-read-g1',
  title: 'かんじを よむ（1ねん）',
  stage: 'g1',
  subject: 'ja',
  domain: 'kanji',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.hiragana-read'],
  objectives: [
    { id: 'word', title: 'ことばの なかで よむ' },
    { id: 'sentence', title: 'ぶんの なかで よむ' },
    { id: 'compare', title: 'おなじ 字の ちがう よみ' },
  ],
  misconceptions: READ_MISCONCEPTIONS,
  levels: READ_LEVELS,
  intro: [
    {
      text: 'かんじは、ことばに よって よみかたが かわる ことが あるよ。',
      figure: { kind: 'text', text: '山《やま》', size: 'xl' },
    },
    {
      text: '「山《やま》」は 「やま」と よんだり、「山《さん》林《りん》」の ように 「さん」と よんだり するよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'text', text: '山《やま》', size: 'xl' },
          { kind: 'text', text: '山《さん》林《りん》', size: 'xl' },
        ],
        gap: 24,
      },
    },
    {
      text: 'ふとい じの よみを、ことばや ぶんを よく みて えらぼう。',
      figure: { kind: 'text', text: '火《か》**山《ざん》**', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕（漢字の読み）・別表 学年別漢字配当表（第1学年）',
  revised: '2026-10-24',
};
