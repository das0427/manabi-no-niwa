/**
 * g4.ja.kanji-write-g4 漢字を書く（3年の字の定着、4年の字を漸次書く）: curriculum-matrix 3.7。
 *
 * 書きの習熟判定は前の学年の字まで（2.2）。そこで段階を次のように分ける。
 *   段階1・2 … 4年の字（練習。なぞり・お手本比較・選んで書く・画数と筆順。習熟の判定には使わない扱い）
 *   段階3   … 3年の字のしあげ（最上段。ここを通ると習熟）
 * 書く字は問題文・ヒントに出さず、ほかの漢字をかなにした文（問う字の読みを太字）で示す。
 */
import type { UnitSpec } from '../../curriculum/types';
import { WRITE_MISCONCEPTIONS } from './write-common';
import { makeWriteModel } from './write-gen';
import { ENTRIES_G3, ENTRIES_G4 } from './table';

const model = makeWriteModel({
  maxGrade: 4,
  charsAt: [ENTRIES_G4, ENTRIES_G4, ENTRIES_G3],
  weights: [
    [
      ['tr', 70],
      ['tf', 30],
    ],
    [
      ['fr', 20],
      ['fw', 10],
      ['cn', 18],
      ['fs', 12],
      ['cs', 28],
      ['pt', 12],
    ],
    [
      ['tr', 15],
      ['cs', 35],
      ['cw', 15],
      ['pt', 5],
      ['cn', 15],
      ['fs', 15],
    ],
  ],
  options: 4,
});

export const kanjiWriteG4: UnitSpec = {
  id: 'g4.ja.kanji-write-g4',
  title: '漢《かん》字《じ》を書《か》く（4年《ねん》）',
  stage: 'g4',
  subject: 'ja',
  domain: 'kanji',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-trace',
  prereq: ['g3.ja.kanji-write-g3'],
  objectives: [
    { id: 'trace', title: 'お手本《てほん》を見《み》てなぞる' },
    { id: 'compare', title: '書《か》いてお手本《てほん》とくらべる' },
    { id: 'choose', title: '文《ぶん》の中《なか》でえらんで書《か》く' },
    { id: 'order', title: '画数《かくすう》と書《か》きじゅん' },
  ],
  misconceptions: WRITE_MISCONCEPTIONS,
  levels: [
    { label: '4年の漢字をなぞる', chance: 0.05 },
    { label: '4年の漢字を書く・えらぶ', chance: 1 / 4 },
    { label: '3年の漢字のしあげ', chance: 1 / 4 },
  ],
  intro: [
    {
      text: '4年《ねん》生《せい》の漢字《かんじ》も、お手本《てほん》のじゅんばんでなぞっておぼえよう。',
      figure: { kind: 'text', text: '熱《あつ》い', size: 'xl' },
    },
    {
      text: 'つぎは自分《じぶん》で書《か》いて、お手本《てほん》とくらべるよ。文《ぶん》にあてはまる漢字《かんじ》もえらぼう。',
      figure: { kind: 'text', text: '健《けん》康《こう》', size: 'xl' },
    },
    {
      text: 'さいごは、3年《ねん》生《せい》の漢字《かんじ》も思《おも》い出《だ》して、しあげるよ。',
      figure: { kind: 'text', text: '湖《みずうみ》', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年〔知識及び技能〕（第3学年までの漢字を書き、第4学年の漢字を漸次書く）・書写・別表 学年別漢字配当表（第3・4学年。2020年度からの配当）',
  revised: '2026-10-24',
};
