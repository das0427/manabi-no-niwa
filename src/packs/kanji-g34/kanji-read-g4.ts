/**
 * g4.ja.kanji-read-g4 4年の漢字202字を読む（都道府県名の字を含む）: curriculum-matrix 3.7。
 *
 * 字のデータ表（data/rows-g4a〜d.ts: 202字・語例606・文202）から、語の中で読む → 文の中で読む →
 * 都道府県名の字・同じ字の別の読み、の順で出す。問題文のほかの漢字は1〜4年の配当字だけ。読みは小学校で学ぶ音訓に限る。
 * 都道府県名に使う字（茨・媛・岡・潟・岐・熊・香・佐・埼・崎・滋・鹿・縄・井・栃・奈・梨・阪・阜・富・徳・賀 など）は、
 * 県名を語例にしてあり、g4.soc.prefectures と字を共有する（この単元は読み、社会は名前と位置）。
 * 3年の字の読みの確かめは、g3.ja.kanji-read-g3 で行う（この単元は4年の字）。
 */
import type { UnitSpec } from '../../curriculum/types';
import { READ_LEVELS_G4, READ_MISCONCEPTIONS } from './read-common';
import { makeReadModel } from './read-gen';
import { ENTRIES_G4 } from './table';

const model = makeReadModel({
  grade: 4,
  entries: ENTRIES_G4,
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
      ['kc', 22],
      ['kb', 10],
      ['pc', 20],
      ['pf', 12],
      ['sc', 14],
      ['sf', 10],
      ['wc', 7],
      ['wb', 5],
    ],
  ],
});

export const kanjiReadG4: UnitSpec = {
  id: 'g4.ja.kanji-read-g4',
  title: '漢《かん》字《じ》を読《よ》む（4年《ねん》）',
  stage: 'g4',
  subject: 'ja',
  domain: 'kanji',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-kokugo',
  prereq: ['g3.ja.kanji-read-g3'],
  objectives: [
    { id: 'word', title: 'ことばの中《なか》で読《よ》む' },
    { id: 'sentence', title: '文《ぶん》の中《なか》で読《よ》む' },
    { id: 'compare', title: '同《おな》じ字《じ》の読《よ》み分《わ》け' },
    { id: 'pref', title: '県《けん》の名《な》前《まえ》の字《じ》を読《よ》む' },
  ],
  misconceptions: READ_MISCONCEPTIONS,
  levels: READ_LEVELS_G4,
  intro: [
    {
      text: '4年《ねん》生《せい》の漢字《かんじ》も、ことばによって読《よ》み方《かた》がかわることがあるよ。',
      figure: { kind: 'text', text: '低《ひく》い', size: 'xl' },
    },
    {
      text: '「低《ひく》い」は「ひくい」と読《よ》み、「最《さい》低《てい》」では「てい」と読《よ》むよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'text', text: '低《ひく》い', size: 'xl' },
          { kind: 'text', text: '最《さい》低《てい》', size: 'xl' },
        ],
        gap: 24,
      },
    },
    {
      text: '県《けん》の名《な》前《まえ》にも、4年《ねん》生《せい》の漢字《かんじ》がたくさん使《つか》われているよ。',
      figure: { kind: 'text', text: '**茨《いばら》**城《き》県《けん》', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年〔知識及び技能〕（漢字の読み）・別表 学年別漢字配当表（第4学年。2020年度からの配当）・社会 第4学年（都道府県の名称）',
  revised: '2026-10-24',
};
