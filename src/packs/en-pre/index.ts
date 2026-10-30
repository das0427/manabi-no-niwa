/**
 * en-pre（幼児向けの英語。設計: docs/expansion/p2-design/preschool-english.md）。
 * 英語は音声だけ（画面の文字は日本語）。目標は英語の音に親しむ・日本語との音の違いに気づく・ちがう ことばに興味を持つこと。
 * P1 の8単元。P2（p23.en.move・p4.en.where・p5.en.picture-book・p5.en.first-sound・p5.en.abc）は未実装。
 */
import type { PackContent } from '../../curriculum/types';
import { p4ColorsNumbers } from './colors-numbers';
import { p4Hello } from './hello';
import { p4Move } from './move';
import { p4PictureBook } from './picture-book';
import { p5Phrases } from './phrases';
import { p5Shop } from './shop';
import { p23Words, p4Words } from './words';

const pack: PackContent = {
  packId: 'en-pre',
  units: [p23Words, p4Words, p4ColorsNumbers, p4Move, p4Hello, p4PictureBook, p5Phrases, p5Shop],
};

export default pack;
