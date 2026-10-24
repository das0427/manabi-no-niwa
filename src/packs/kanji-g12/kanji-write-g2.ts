/**
 * g2.ja.kanji-write-g2 かんじを かく（1年の字の定着、2年の字を漸次書く）: curriculum-matrix 3.5。
 *
 * 書きの習熟判定は前の学年の字まで（2.2）。そこで段階を次のように分ける。
 *   段階1・2 … 2年の字（練習。なぞり・お手本比較・選んで書く・画数と筆順。習熟の判定には使わない扱い）
 *   段階3   … 1年の字のしあげ（最上段。ここを通ると習熟）
 * 書く字は問題文・ヒントに出さず、ほかの漢字をかなにした文（問う字の読みを太字）で示す。
 */
import type { UnitSpec } from '../../curriculum/types';
import { WRITE_MISCONCEPTIONS } from './write-common';
import { makeWriteModel } from './write-gen';
import { ENTRIES_G1, ENTRIES_G2 } from './table';

const model = makeWriteModel({
  maxGrade: 2,
  charsAt: [ENTRIES_G2, ENTRIES_G2, ENTRIES_G1],
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

export const kanjiWriteG2: UnitSpec = {
  id: 'g2.ja.kanji-write-g2',
  title: 'かんじを かく（2ねん）',
  stage: 'g2',
  subject: 'ja',
  domain: 'kanji',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-trace',
  prereq: ['g1.ja.kanji-write-g1'],
  objectives: [
    { id: 'trace', title: 'おてほんを みて なぞる' },
    { id: 'compare', title: 'かいて おてほんと くらべる' },
    { id: 'choose', title: 'ぶんの なかで えらんで かく' },
    { id: 'order', title: 'かくすうと かく じゅんばん' },
  ],
  misconceptions: WRITE_MISCONCEPTIONS,
  levels: [
    { label: '2ねんの かんじを なぞる', chance: 0.05 },
    { label: '2ねんの かんじを かいて・えらぶ', chance: 1 / 4 },
    { label: '1ねんの かんじの しあげ', chance: 1 / 4 },
  ],
  intro: [
    {
      text: '2ねんせいの かんじも、おてほんの じゅんばんで なぞって おぼえよう。',
      figure: { kind: 'text', text: '時《とき》', size: 'xl' },
    },
    {
      text: 'つぎは じぶんで かいて、おてほんと くらべるよ。ぶんの あいている ところに はいる かんじも えらぼう。',
      figure: { kind: 'text', text: '森《もり》', size: 'xl' },
    },
    {
      text: 'さいごは、1ねんせいの かんじも おもいだして、しあげるよ。',
      figure: { kind: 'text', text: '花《はな》', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕（第1学年の漢字を書き、第2学年の漢字を漸次書く）・書写・別表 学年別漢字配当表（第1・2学年）',
  revised: '2026-10-24',
};
