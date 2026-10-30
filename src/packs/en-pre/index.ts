/**
 * en-pre（幼児向けの英語。設計: docs/expansion/p2-design/preschool-english.md）。
 * 英語は音声だけ（画面の文字は日本語）。目標は英語の音に親しむ・日本語との音の違いに気づく・ちがう ことばに興味を持つこと。
 * P1 の8単元と P2 の5単元（p23.en.move・p4.en.where・p5.en.picture-book・p5.en.first-sound・p5.en.abc）。
 * どれも最初は partial（英語の音声の全件試聴のあとに ready）。
 */
import type { PackContent } from '../../curriculum/types';
import { p5Abc } from './abc';
import { p4ColorsNumbers } from './colors-numbers';
import { p5FirstSound } from './first-sound';
import { p4Hello } from './hello';
import { p4Move } from './move';
import { p23Move } from './move-p23';
import { p4PictureBook } from './picture-book';
import { p5PictureBook } from './picture-book-p5';
import { p5Phrases } from './phrases';
import { p5Shop } from './shop';
import { p4Where } from './where';
import { p23Words, p4Words } from './words';

const pack: PackContent = {
  packId: 'en-pre',
  units: [
    p23Words,
    p23Move,
    p4Words,
    p4ColorsNumbers,
    p4Move,
    p4Hello,
    p4PictureBook,
    p4Where,
    p5Phrases,
    p5Shop,
    p5PictureBook,
    p5FirstSound,
    p5Abc,
  ],
};

export default pack;
