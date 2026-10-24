/**
 * 漢字の読みの単元（g1.ja.kanji-read-g1・g2.ja.kanji-read-g2）で共通の誤概念と段階。
 */
import type { LevelDef, Misconception } from '../../curriculum/types';

export const READ_MISCONCEPTIONS: Misconception[] = [
  {
    id: 'on-kun',
    explain:
      'おなじ じでも、ことばに よって よみかたが かわるよ。ほかの ことばで つかう よみを えらんだのかな。ことばぜんたいを こえに だして よんで みよう。',
  },
  {
    id: 'okurigana-edge',
    explain:
      'おくりがなまで よみに いれたのかな。じの よみは、おくりがなの まえまでだよ。かなで かいて ある ところは、そのまま よむんだね。',
  },
  {
    id: 'similar-kanji',
    explain:
      'にている べつの じと まちがえたのかな。ふとい じの かたちを、よく みくらべて みよう。',
  },
  {
    id: 'other-reading',
    explain:
      'べつの じの よみを えらんだのかな。ふとい じを もういちど よく みて、まわりの ことばも ヒントに しよう。',
  },
];

/** 段階（形式の割合は read-gen.ts）。chance は選択肢の数の逆数（rules.ts promoteNeedFor） */
export const READ_LEVELS: LevelDef[] = [
  { label: 'ことばの なかで よむ', chance: 1 / 3 },
  { label: 'ぶんの なかで よむ', chance: 1 / 4 },
  { label: 'おなじ 字の ちがう よみ', chance: 1 / 3 },
];
