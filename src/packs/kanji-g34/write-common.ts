/**
 * 漢字の書きの単元（g3.ja.kanji-write-g3・g4.ja.kanji-write-g4）で共通の誤概念。
 * 誤概念の説明は、書く字が出てしまわないよう、漢字は1年の配当字だけにしてある。
 */
import type { Misconception } from '../../curriculum/types';

export const WRITE_MISCONCEPTIONS: Misconception[] = [
  {
    id: 'similar-shape',
    explain:
      'かたちがにている字《じ》とまちがえたのかな。よこの線《せん》のかずや、とびだすところを、よく見《み》くらべてみよう。',
  },
  {
    id: 'same-sound',
    explain:
      '同《おな》じよみの、べつの字《じ》とまちがえたのかな。文《ぶん》のいみをかんがえて、あてはまる字《じ》をえらぼう。',
  },
  {
    id: 'wrong-part',
    explain:
      'ぶひんをまちがえたのかな。字《じ》を二《ふた》つ、三《みっ》つのかたまりにわけて、一《ひと》つずつたしかめよう。',
  },
  {
    id: 'stroke-order',
    explain:
      'かくじゅんばんがちがったのかな。おてほんのうごきをもういちど見《み》て、はじめの線《せん》からなぞろう。上《うえ》から下《した》、左《ひだり》から右《みぎ》がきほんだよ。',
  },
  {
    id: 'stroke-direction',
    explain:
      '線《せん》をひくむきがぎゃくだったのかな。おてほんのまるからはじめて、むきをたしかめよう。',
  },
  {
    id: 'stroke-count',
    explain:
      '線《せん》のかずをかぞえまちがえたのかな。おてほんのうごきをおもいだして、一《ひと》つずつゆびでたどってかぞえよう。',
  },
];
