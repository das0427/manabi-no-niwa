/**
 * 幼児ホームの札（ux-by-age 2.1、curriculum-matrix 4章・6.2）。区分ごとに最大9枚（3×3。位置は固定）。
 * 札は1つ以上の単元につながる。単元が1つなら直接開き、2つ以上なら選ぶ画面を出す。
 * 2歳段階（toddlerStage 2）は stage2Cards の札だけ（最大4枚、review-1 #23）。
 * 中身（どの札にどの単元）は幼児の教材の担当が書く。札が無い区分は v1 のホームを出す。
 */
import type { StageId } from './types';

export interface HomeCard {
  id: string;
  /** 札の名前（ひらがな。空白で2行に分ける） */
  title: string;
  /** 絵（IllustId） */
  icon: string;
  /** つながる単元ID（並び順＝選ぶ画面の順） */
  units: string[];
  /** 札を押したときの読み上げ（音声キー。省略時は読み上げない） */
  titleVoice?: string;
}

export interface PreschoolHomeDef {
  stage: Extract<StageId, 'p23' | 'p4' | 'p5'>;
  cards: HomeCard[];
  /** 2歳段階で出す札の id（p23 のみ） */
  stage2Cards?: string[];
}

export const PRESCHOOL_HOMES: Partial<Record<'p23' | 'p4' | 'p5', PreschoolHomeDef>> = {
  // 2〜3歳: 教科名を出さない。2歳段階は 4枚（かたちあわせ・わけてみよう・なまえあて・おかいもの）＋おえかき
  p23: {
    stage: 'p23',
    cards: [
      {
        id: 'shape-match',
        title: 'かたち あわせ',
        icon: 'mode-shapes',
        units: ['p23.math.shape-match'],
      },
      { id: 'sort', title: 'わけて みよう', icon: 'mode-sorting', units: ['p23.think.sort'] },
      { id: 'word-listen', title: 'なまえ あて', icon: 'listen', units: ['p23.ja.word-listen'] },
      { id: 'shop', title: 'おかいもの', icon: 'mode-shopping', units: ['p23.math.shop'] },
      { id: 'compare', title: 'くらべっこ', icon: 'mode-compare', units: ['p23.math.compare'] },
      { id: 'sound-play', title: 'おと あそび', icon: 'p23-duck', units: ['p23.ja.sound-play'] },
      {
        id: 'daily-life',
        title: 'くらしの どうぐ',
        icon: 'p23-spoon',
        units: ['p23.env.daily-life'],
      },
      { id: 'lines', title: 'ゆびで せん', icon: 'trace-lines', units: ['p23.hand.lines'] },
    ],
    stage2Cards: ['shape-match', 'sort', 'word-listen', 'shop'],
  },
  // 4歳: 初期版9モードの名前を札に残し、中身を新しい単元へつなぐ（curriculum-matrix 4.1）
  p4: {
    stage: 'p4',
    cards: [
      {
        id: 'shopping',
        title: 'おかいもの ごっこ',
        icon: 'mode-shopping',
        units: ['p4.math.shop'],
        titleVoice: 'title.shopping',
      },
      {
        id: 'hiragana',
        title: 'ひらがな',
        icon: 'mode-hiragana',
        units: ['p4.ja.first-sound', 'p4.ja.kana-read', 'p4.ja.word-play'],
        titleVoice: 'title.hiragana',
      },
      {
        id: 'sorting',
        title: 'なかまわけ',
        icon: 'mode-sorting',
        units: ['p4.think.sort', 'p4.think.pattern'],
        titleVoice: 'title.sorting',
      },
      {
        id: 'shapes',
        title: 'かたち パズル',
        icon: 'mode-shapes',
        units: ['p4.math.shapes'],
        titleVoice: 'title.shapes',
      },
      {
        id: 'memory',
        title: 'おぼえて さがす',
        icon: 'mode-memory',
        units: ['p4.think.memory'],
        titleVoice: 'title.memory',
      },
      {
        id: 'compare',
        title: 'くらべっこ',
        icon: 'mode-compare',
        units: ['p4.math.compare'],
        titleVoice: 'title.compare',
      },
      {
        id: 'road',
        title: 'みちを つくろう',
        icon: 'mode-road',
        units: ['p4.think.road'],
        titleVoice: 'title.road',
      },
      {
        id: 'trace',
        title: 'なぞって あそぼう',
        icon: 'mode-trace',
        units: ['p4.hand.lines', 'p4.hand.kana-trace-early'],
        titleVoice: 'title.trace',
      },
      {
        id: 'math',
        title: 'さんすう',
        icon: 'mode-math',
        units: ['p4.math.count-pictures'],
        titleVoice: 'title.math',
      },
    ],
  },
  // 5歳: 「もじ」は よむ（ひらがな・かたかな・おはなし）と かく（もじを かく）を分ける。式・カタカナの書きは既定で非表示
  p5: {
    stage: 'p5',
    cards: [
      {
        id: 'kazu',
        title: 'かず',
        icon: 'mode-math',
        units: ['p5.math.numbers-10', 'p5.math.compose', 'p5.math.add-sub'],
      },
      { id: 'clock', title: 'とけい', icon: 'p5-clock', units: ['p5.math.clock'] },
      {
        id: 'katachi',
        title: 'かたち ながさ',
        icon: 'mode-shapes',
        units: ['p5.math.shapes', 'p5.math.measure-compare'],
      },
      {
        id: 'hiragana',
        title: 'ひらがな',
        icon: 'mode-hiragana',
        units: ['p5.ja.kana-read-all', 'p5.ja.word-build'],
      },
      { id: 'katakana', title: 'かたかな', icon: 'bus-yellow', units: ['p5.ja.katakana-read'] },
      { id: 'ohanashi', title: 'おはなし', icon: 'p5-book', units: ['p5.ja.story-listen'] },
      {
        id: 'kaku',
        title: 'もじを かく',
        icon: 'trace-letters',
        units: ['p5.hand.kana-trace', 'p5.hand.katakana-trace'],
      },
      { id: 'kimari', title: 'きまり', icon: 'mode-sorting', units: ['p5.think.pattern'] },
      { id: 'tejun', title: 'てじゅん', icon: 'subj-program', units: ['p5.prog.steps'] },
    ],
  },
};

export function preschoolStageOf(audience: string): 'p23' | 'p4' | 'p5' | null {
  if (audience === 'toddler') return 'p23';
  if (audience === 'p4' || audience === 'p5') return audience;
  return null;
}
