/**
 * g5.ja.kanji-write-g5 漢字を書く（4年の字の定着、5年の字を漸次書く）: curriculum-matrix 3.8。
 *
 * 書きの習熟判定は前の学年の字まで（2.2）。そこで段階を次のように分ける。
 *   段階1・2 … 5年の字（練習。なぞり・お手本比較・選んで書く・画数と筆順。習熟の判定には使わない扱い）
 *   段階3   … 4年の字のしあげ（最上段。ここを通ると習熟）
 * 書く字は問題文・ヒントに出さず、ほかの漢字をかなにした文（問う字の読みを太字）で示す。同音の字は、文の意味で一つに決まるものだけを選択肢にする。
 */
import type { UnitSpec } from '../../curriculum/types';
import { WRITE_MISCONCEPTIONS } from './write-common';
import { makeWriteModel } from './write-gen';
import { ENTRIES_G4, ENTRIES_G5 } from './table';

const model = makeWriteModel({
  maxGrade: 5,
  charsAt: [ENTRIES_G5, ENTRIES_G5, ENTRIES_G4],
  weights: [
    [
      ['tr', 70],
      ['tf', 30],
    ],
    [
      ['fr', 20],
      ['fw', 12],
      ['cn', 18],
      ['fs', 12],
      ['cs', 30],
      ['cw', 8],
    ],
    [
      ['tr', 15],
      ['cs', 38],
      ['cw', 17],
      ['cn', 15],
      ['fs', 15],
    ],
  ],
  options: 4,
});

export const kanjiWriteG5: UnitSpec = {
  id: 'g5.ja.kanji-write-g5',
  title: '漢《かん》字《じ》を書《か》く（5年《ねん》）',
  stage: 'g5',
  subject: 'ja',
  domain: 'kanji',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-trace',
  prereq: ['g4.ja.kanji-write-g4'],
  objectives: [
    { id: 'trace', title: 'お手本《てほん》を見《み》てなぞる' },
    { id: 'compare', title: '書《か》いてお手本《てほん》とくらべる' },
    { id: 'choose', title: '文《ぶん》の中《なか》でえらんで書《か》く' },
    { id: 'order', title: '画数《かくすう》と書《か》きじゅん' },
  ],
  misconceptions: WRITE_MISCONCEPTIONS,
  levels: [
    { label: '5年の漢字をなぞる', chance: 0.05 },
    { label: '5年の漢字を書く・えらぶ', chance: 1 / 4 },
    { label: '4年の漢字のしあげ', chance: 1 / 4 },
  ],
  intro: [
    {
      text: '5年《ねん》生《せい》の漢字《かんじ》も、お手本《てほん》のじゅんばんでなぞっておぼえよう。',
      figure: { kind: 'text', text: '過《す》ぎる', size: 'xl' },
    },
    {
      text: 'つぎは自分《じぶん》で書《か》いて、お手本《てほん》とくらべるよ。文《ぶん》にあてはまる漢字《かんじ》もえらぼう。同《おな》じ読《よ》みの字《じ》にも気《き》をつけよう。',
      figure: { kind: 'text', text: '成《せい》績《せき》', size: 'xl' },
    },
    {
      text: 'さいごは、4年《ねん》生《せい》の漢字《かんじ》も思《おも》い出《だ》して、しあげるよ。',
      figure: { kind: 'text', text: '熱《あつ》い', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第5学年及び第6学年〔知識及び技能〕（第4学年までの漢字を書き、第5学年の漢字を漸次書く）・書写・別表 学年別漢字配当表（第4・5学年）',
  revised: '2026-10-24',
};