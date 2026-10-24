/**
 * g3.ja.kanji-read-g3 3年の漢字200字を読む: curriculum-matrix 3.6。
 *
 * 字のデータ表（data/rows-g3a〜c.ts: 200字・語例600・文200）から、語の中で読む → 文の中で読む →
 * 同じ字の音と訓、の順で出す。問題文のほかの漢字は1〜3年の配当字だけ。読みは小学校で学ぶ音訓に限る。
 * 1・2年の字の読みの確かめは、g1・g2 の漢字の読みの単元で行う（この単元は3年の字）。
 */
import type { UnitSpec } from '../../curriculum/types';
import { READ_LEVELS_G3, READ_MISCONCEPTIONS } from './read-common';
import { makeReadModel } from './read-gen';
import { ENTRIES_G3 } from './table';

const model = makeReadModel({
  grade: 3,
  entries: ENTRIES_G3,
  weights: [
    [
      ['wc', 72],
      ['wb', 28],
    ],
    [
      ['sc', 38],
      ['sf', 20],
      ['wc', 22],
      ['wb', 20],
    ],
    [
      ['pc', 32],
      ['pf', 18],
      ['sc', 20],
      ['sf', 14],
      ['wc', 8],
      ['wb', 8],
    ],
  ],
});

export const kanjiReadG3: UnitSpec = {
  id: 'g3.ja.kanji-read-g3',
  title: '漢《かん》字《じ》を読《よ》む（3年《ねん》）',
  stage: 'g3',
  subject: 'ja',
  domain: 'kanji',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g2.ja.kanji-read-g2'],
  objectives: [
    { id: 'word', title: 'ことばの中《なか》で読《よ》む' },
    { id: 'sentence', title: '文《ぶん》の中《なか》で読《よ》む' },
    { id: 'compare', title: '同《おな》じ字《じ》の読《よ》み分《わ》け' },
  ],
  misconceptions: READ_MISCONCEPTIONS,
  levels: READ_LEVELS_G3,
  intro: [
    {
      text: '3年《ねん》生《せい》の漢字《かんじ》も、ことばによって読《よ》み方《かた》がかわることがあるよ。',
      figure: { kind: 'text', text: '重《おも》い', size: 'xl' },
    },
    {
      text: '「重《おも》い」は「おもい」と読《よ》み、「体《たい》重《じゅう》」では「じゅう」と読《よ》むよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'text', text: '重《おも》い', size: 'xl' },
          { kind: 'text', text: '体《たい》重《じゅう》', size: 'xl' },
        ],
        gap: 24,
      },
    },
    {
      text: '太《ふと》い字《じ》の読《よ》みを、ことばや文《ぶん》をよく見《み》てえらぼう。',
      figure: { kind: 'text', text: '体《たい》**重《じゅう》**', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年〔知識及び技能〕（漢字の読み）・別表 学年別漢字配当表（第3学年）',
  revised: '2026-10-24',
};
