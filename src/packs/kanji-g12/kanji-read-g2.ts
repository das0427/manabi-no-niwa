/**
 * g2.ja.kanji-read-g2 かんじを よむ（2年の漢字160字）: curriculum-matrix 3.5。
 *
 * 字のデータ表（data/rows-g2a.ts・rows-g2b.ts: 160字・語例462・文160）から、語の中で読む → 文の中で読む →
 * 同じ字の別の読み、の順で出す。問題文のほかの漢字は1・2年の配当字だけ。読みは小学校で学ぶ音訓に限る。
 * 1年の字の読みの確かめは、g1.ja.kanji-read-g1 で行う（この単元は2年の字）。
 */
import type { UnitSpec } from '../../curriculum/types';
import { READ_LEVELS, READ_MISCONCEPTIONS } from './read-common';
import { makeReadModel } from './read-gen';
import { ENTRIES_G2 } from './table';

const model = makeReadModel(2, ENTRIES_G2);

export const kanjiReadG2: UnitSpec = {
  id: 'g2.ja.kanji-read-g2',
  title: 'かんじを よむ（2ねん）',
  stage: 'g2',
  subject: 'ja',
  domain: 'kanji',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g1.ja.kanji-read-g1'],
  objectives: [
    { id: 'word', title: 'ことばの なかで よむ' },
    { id: 'sentence', title: 'ぶんの なかで よむ' },
    { id: 'compare', title: 'おなじ 字の ちがう よみ' },
  ],
  misconceptions: READ_MISCONCEPTIONS,
  levels: READ_LEVELS,
  intro: [
    {
      text: '2ねんせいの かんじも、ことばに よって よみかたが かわる ことが あるよ。',
      figure: { kind: 'text', text: '海《うみ》', size: 'xl' },
    },
    {
      text: '「海《うみ》」は 「うみ」と よんだり、「海《かい》外《がい》」の ように 「かい」と よんだり するよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'text', text: '海《うみ》', size: 'xl' },
          { kind: 'text', text: '海《かい》外《がい》', size: 'xl' },
        ],
        gap: 24,
      },
    },
    {
      text: 'ふとい じの よみを、ことばや ぶんを よく みて えらぼう。',
      figure: { kind: 'text', text: '外《がい》**国《こく》**', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕（漢字の読み）・別表 学年別漢字配当表（第2学年）',
  revised: '2026-10-24',
};
