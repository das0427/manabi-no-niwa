/**
 * g1.ja.kanji-write-g1 かんじを かく（1年の漢字80字）: curriculum-matrix 3.4。
 *
 * なぞり（書き順の判定）→ お手本比較（自由書き。採点しない）→ 文の□に入る字を選ぶ・画数と筆順の問い、の順。
 * 1年の書きは「当該学年の字を漸次書く」ので練習の単元とし、字形は採点しない（2.2）。
 * 書く字は問題文・ヒントに出さず、ほかの漢字をかなにした文（問う字の読みを太字）で示す。
 */
import type { UnitSpec } from '../../curriculum/types';
import { WRITE_MISCONCEPTIONS } from './write-common';
import { makeWriteModel } from './write-gen';
import { ENTRIES_G1 } from './table';

const model = makeWriteModel({
  maxGrade: 1,
  charsAt: [ENTRIES_G1, ENTRIES_G1, ENTRIES_G1],
  weights: [
    [
      ['tr', 70],
      ['tf', 30],
    ],
    [
      ['fr', 28],
      ['fw', 17],
      ['cn', 35],
      ['fs', 20],
    ],
    [
      ['cs', 50],
      ['cw', 20],
      ['pt', 6],
      ['cn', 14],
      ['fs', 10],
    ],
  ],
  options: 3,
});

export const kanjiWriteG1: UnitSpec = {
  id: 'g1.ja.kanji-write-g1',
  title: 'かんじを かく（1ねん）',
  stage: 'g1',
  subject: 'ja',
  domain: 'kanji',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-trace',
  prereq: ['g1.ja.kanji-read-g1'],
  objectives: [
    { id: 'trace', title: 'おてほんを みて なぞる' },
    { id: 'compare', title: 'かいて おてほんと くらべる' },
    { id: 'choose', title: 'ぶんの なかで えらんで かく' },
    { id: 'order', title: 'かくすうと かく じゅんばん' },
  ],
  misconceptions: WRITE_MISCONCEPTIONS,
  levels: [
    { label: 'おてほんを なぞる', chance: 0.05 },
    { label: 'かいて くらべる・かくすう', chance: 1 / 3 },
    { label: 'ぶんの なかで えらぶ', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'かんじには、かく じゅんばんが あるよ。うえから した、ひだりから みぎへ かくよ。',
      figure: { kind: 'text', text: '木《き》', size: 'xl' },
    },
    {
      text: 'まず、おてほんの うごきを みて、おなじ じゅんばんで なぞろう。',
      figure: { kind: 'text', text: '十《じゅう》', size: 'xl' },
    },
    {
      text: 'つぎは じぶんで かいて、おてほんと くらべるよ。にていたら「にてる」を おそう。',
      figure: { kind: 'text', text: '山《やま》', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: (ctx) => model.generate(ctx),
    domainSize: model.domainSize,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕（第1学年の漢字を漸次書く）・書写・別表 学年別漢字配当表（第1学年）',
  revised: '2026-10-24',
};
