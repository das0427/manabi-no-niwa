/**
 * g6.ja.kanji-read-g6 6年の漢字191字を読む: curriculum-matrix 3.9。
 *
 * 字のデータ表（data/rows-g6a・b.ts）から、熟語・語の中で読む → 文の中で読む → 同じ字の読み分け、の順で出す。
 * 問題文のほかの漢字は6年までの配当字だけ。読みは小学校で学ぶ音訓に限る。
 * 5年の字の読みの確かめは、g5.ja.kanji-read-g5 で行う（この単元は6年の字）。
 */
import type { UnitSpec } from '../../curriculum/types';
import { READ_LEVELS, READ_MISCONCEPTIONS } from './read-common';
import { makeReadModel } from './read-gen';
import { ENTRIES_G6 } from './table';

const model = makeReadModel({
  grade: 6,
  entries: ENTRIES_G6,
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

export const kanjiReadG6: UnitSpec = {
  id: 'g6.ja.kanji-read-g6',
  title: '漢《かん》字《じ》を読《よ》む（6年《ねん》）',
  stage: 'g6',
  subject: 'ja',
  domain: 'kanji',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g5.ja.kanji-read-g5'],
  objectives: [
    { id: 'word', title: '熟《じゅく》語《ご》・ことばの中《なか》で読《よ》む' },
    { id: 'sentence', title: '文《ぶん》の中《なか》で読《よ》む' },
    { id: 'compare', title: '同《おな》じ字《じ》の読《よ》み分《わ》け' },
  ],
  misconceptions: READ_MISCONCEPTIONS,
  levels: READ_LEVELS,
  intro: [
    {
      text: '6年《ねん》生《せい》の漢字《かんじ》も、ことばによって読《よ》み方《かた》がかわることがあるよ。',
      figure: { kind: 'text', text: '降《ふ》る', size: 'xl' },
    },
    {
      text: '「降《ふ》る」は「ふる」と読《よ》み、「降《こう》水《すい》」では「こう」と読《よ》むよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'text', text: '降《ふ》る', size: 'xl' },
          { kind: 'text', text: '降《こう》水《すい》', size: 'xl' },
        ],
        gap: 24,
      },
    },
    {
      text: '太《ふと》い字《じ》の読《よ》みを、ことばや文《ぶん》をよく見《み》てえらぼう。',
      figure: { kind: 'text', text: '**降《こう》**水《すい》', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第5学年及び第6学年〔知識及び技能〕（漢字の読み）・別表 学年別漢字配当表（第6学年）',
  revised: '2026-10-24',
};
