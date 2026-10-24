/**
 * 漢字の書きの単元（g1.ja.kanji-write-g1・g2.ja.kanji-write-g2）で共通の誤概念。
 */
import type { Misconception } from '../../curriculum/types';

export const WRITE_MISCONCEPTIONS: Misconception[] = [
  {
    id: 'similar-shape',
    explain:
      'にている かたちの じと まちがえたのかな。よこの せんの かずや、とびだす ところを よく みくらべて みよう。',
  },
  {
    id: 'same-sound',
    explain:
      'おなじ よみの べつの じと まちがえたのかな。ぶんの いみを かんがえて、あてはまる じを えらぼう。',
  },
  {
    id: 'wrong-part',
    explain:
      'ぶひんを まちがえたのかな。じを ふたつ、みっつの かたまりに わけて、ひとつずつ たしかめよう。',
  },
  {
    id: 'stroke-order',
    explain:
      'かく じゅんばんが ちがったのかな。おてほんの うごきを もういちど みて、はじめの せんから なぞろう。うえから した、ひだりから みぎが きほんだよ。',
  },
  {
    id: 'stroke-direction',
    explain:
      'せんを ひく むきが ぎゃくだったのかな。おてほんの まるから はじめて、むきを たしかめよう。',
  },
  {
    id: 'stroke-count',
    explain:
      'せんの かずを かぞえまちがえたのかな。おてほんの うごきを おもいだして、ひとつずつ ゆびで たどって かぞえよう。',
  },
];
