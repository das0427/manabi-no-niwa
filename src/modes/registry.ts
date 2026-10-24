/**
 * 9モードの定義（遊び方・スキル・段階）。段階の中身の正本は docs/learning-design.md。
 * 編集は Opus（統括）。各モード担当はここを編集しない。
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ModeId, SkillId, SkillProgress } from '../core/types';
import type { ModePlayProps } from '../core/session/types';

export interface LevelDef {
  /** 'S1' など（learning-design.md の段階名） */
  code: string;
  /** 保護者向けの段階名 */
  label: string;
  /** でたらめに答えて independent になる確率（進む条件に使う） */
  chance: number;
  /** 探索の段階: この件数で自動的に進む */
  autoPromoteAfter?: number;
}

export interface SkillDef {
  id: SkillId;
  modeId: ModeId;
  /** 保護者向けの名前 */
  label: string;
  levels: LevelDef[];
}

export type RoundKind = 'questions' | 'boards' | 'trace' | 'work';

export interface VariantDef {
  id: string;
  /** 子供向けの名前（ひらがな） */
  title: string;
  titleVoice: string;
  icon: string;
  skillId: SkillId | null;
  roundKind: RoundKind;
  /** このスキルの中で遊べる段階の範囲（なぞりの「せん」「めいろ」「もじ」など） */
  levelRange?: [number, number];
  /** 遊び方の選択画面に出すか（解放条件） */
  available?: (progress: Partial<Record<SkillId, SkillProgress>>) => boolean;
}

export interface ModeDef {
  id: ModeId;
  title: string;
  titleVoice: string;
  icon: string;
  variants: VariantDef[];
  /** 保護者画面の「おうちで ためせる あそび」 */
  homeTips: string[];
  Component: LazyExoticComponent<ComponentType<ModePlayProps>>;
}

const L = (
  code: string,
  label: string,
  chance: number,
  extra: Partial<LevelDef> = {},
): LevelDef => ({
  code,
  label,
  chance,
  ...extra,
});

export const SKILLS: Record<SkillId, SkillDef> = {
  shop: {
    id: 'shop',
    modeId: 'shopping',
    label: 'おかいもの',
    levels: [
      L('S1', '名前を聞いて1つ選ぶ', 0.25),
      L('S2', '同じ品物を1〜3個', 0.1),
      L('S3', '同じ品物を1〜5個', 0.05),
      L('S4', '2種類の注文', 0.02),
    ],
  },
  kana: {
    id: 'kana',
    modeId: 'hiragana',
    label: 'ひらがな（よむ）',
    levels: [
      L('H1', '音を聞いて2択', 0.5),
      L('H2', '音を聞いて3択', 1 / 3),
      L('H3', 'はじめの音（2択）', 0.5),
      L('H4', '2文字の言葉を作る', 1 / 6),
      L('H5', '3文字の言葉を作る', 1 / 24),
    ],
  },
  sort: {
    id: 'sort',
    modeId: 'sorting',
    label: 'なかまわけ',
    levels: [
      L('N1', '色で2つに分ける', 1 / 16),
      L('N2', '種類で2つに分ける', 1 / 16),
      L('N3', '種類で3つに分ける', 0.01),
      L('N4', '分け方を変えて分け直す', 0.01),
    ],
  },
  shape: {
    id: 'shape',
    modeId: 'shapes',
    label: 'かたち',
    levels: [
      L('K1', '同じ形を選ぶ', 1 / 3),
      L('K2', '2〜3ピースで作る', 1 / 6),
      L('K3', '4ピースで作る', 0.05),
      L('K4', '向きを変えて入れる', 0.05),
      L('K5', '見本を見て作る', 0.05),
    ],
  },
  memory: {
    id: 'memory',
    modeId: 'memory',
    label: 'おぼえてさがす',
    levels: [
      L('B1', '1枚を覚えて2択', 0.5),
      L('B2', '1枚を覚えて3択', 1 / 3),
      L('B3', '2枚を覚えて4枚から', 1 / 6),
      L('B4', '場所を覚える', 1 / 3),
      L('B5', '2枚の順番', 0.5),
      L('B6', '3枚の順番', 1 / 6),
    ],
  },
  compare: {
    id: 'compare',
    modeId: 'compare',
    label: 'くらべっこ',
    levels: [
      L('P1', '大きさ（2択）', 0.5),
      L('P2', '長さ（2択）', 0.5),
      L('P3', '数（2択）', 0.5),
      L('P4', '「おなじ」を含む3択', 1 / 3),
      L('P5', '3つを順に並べる', 1 / 6),
    ],
  },
  road: {
    id: 'road',
    modeId: 'road',
    label: 'みちづくり',
    levels: [
      L('R1', '1か所を埋める', 0.1),
      L('R2', '2〜3か所を埋める', 0.02),
      L('R3', 'いわを避ける', 0.01),
      L('R4', '分かれ道', 0.01),
    ],
  },
  trace: {
    id: 'trace',
    modeId: 'trace',
    label: 'なぞり',
    levels: [
      L('T1', '太く短い直線', 0),
      L('T2', '長い線・ゆるい曲線', 0),
      L('T3', '折れ線・形', 0),
      L('T4', 'かんたんな迷路', 0),
      L('T5', '1画のひらがな', 0),
      L('T6', '2画のひらがな', 0),
      L('T7', '曲線の多いひらがな', 0),
    ],
  },
  add: {
    id: 'add',
    modeId: 'math',
    label: 'たしざん（絵）',
    levels: [
      L('A', '絵を合わせる（3まで）', 1 / 3),
      L('B1', '絵と式（3まで）', 1 / 3),
      L('B2', '絵と式（5まで）', 1 / 3),
      L('B3', 'たす0', 1 / 3),
    ],
  },
  sub: {
    id: 'sub',
    modeId: 'math',
    label: 'ひきざん（絵）',
    levels: [
      L('C1', '絵で減る（3まで）', 1 / 3),
      L('C2', '絵で減る（5まで）', 1 / 3),
      L('C3', '答えが0', 1 / 3),
    ],
  },
  split: {
    id: 'split',
    modeId: 'math',
    label: 'わける',
    levels: [
      L('D1', '2つのおさらに分ける', 1, { autoPromoteAfter: 10 }),
      L('D2', '片方の数を答える', 1 / 3),
    ],
  },
  formula_add: {
    id: 'formula_add',
    modeId: 'math',
    label: 'しきだけ（たしざん）',
    levels: [L('E1', '式だけのたしざん', 1 / 3)],
  },
  formula_sub: {
    id: 'formula_sub',
    modeId: 'math',
    label: 'しきだけ（ひきざん）',
    levels: [L('E2', '式だけのひきざん', 1 / 3)],
  },
};

const one = (
  skillId: SkillId,
  roundKind: RoundKind,
  icon: string,
  title: string,
  titleVoice: string,
): VariantDef[] => [{ id: 'main', title, titleVoice, icon, skillId, roundKind }];

export const MODES: ModeDef[] = [
  {
    id: 'shopping',
    title: 'おかいもの ごっこ',
    titleVoice: 'title.shopping',
    icon: 'mode-shopping',
    variants: one('shop', 'questions', 'mode-shopping', 'おかいもの ごっこ', 'title.shopping'),
    homeTips: [
      '買い物のとき「トマトを 3こ かごに いれてね」と頼んでみる',
      'おやつを「ひとつ、ふたつ」と声に出して数えながら分ける',
      'お店やさんごっこで、注文する役と売る役を交代する',
    ],
    Component: lazy(() => import('./shopping/index')),
  },
  {
    id: 'hiragana',
    title: 'ひらがな',
    titleVoice: 'title.hiragana',
    icon: 'mode-hiragana',
    variants: one('kana', 'questions', 'mode-hiragana', 'ひらがな', 'title.hiragana'),
    homeTips: [
      '「『い』で はじまる もの なあに？」と言葉の最初の音で遊ぶ',
      '看板や絵本で、知っている字を一緒に探す',
      '子供の名前の字を、身の回りで見つける',
    ],
    Component: lazy(() => import('./hiragana/index')),
  },
  {
    id: 'sorting',
    title: 'なかまわけ',
    titleVoice: 'title.sorting',
    icon: 'mode-sorting',
    variants: one('sort', 'boards', 'mode-sorting', 'なかまわけ', 'title.sorting'),
    homeTips: [
      '洗濯物を「だれの もの」で分けてもらう',
      'おもちゃを色や種類で片付ける',
      '同じおもちゃを、別の分け方で分け直してみる',
    ],
    Component: lazy(() => import('./sorting/index')),
  },
  {
    id: 'shapes',
    title: 'かたち パズル',
    titleVoice: 'title.shapes',
    icon: 'mode-shapes',
    variants: one('shape', 'questions', 'mode-shapes', 'かたち パズル', 'title.shapes'),
    homeTips: [
      '積み木で、見本と同じ形を作ってみる',
      '家の中で「まる」「しかく」「さんかく」を探す',
      '紙を切った形を組み合わせて、いえや さかなを作る',
    ],
    Component: lazy(() => import('./shapes/index')),
  },
  {
    id: 'memory',
    title: 'おぼえて さがす',
    titleVoice: 'title.memory',
    icon: 'mode-memory',
    variants: one('memory', 'questions', 'mode-memory', 'おぼえて さがす', 'title.memory'),
    homeTips: [
      'お盆に3つの物を置き、1つ隠して「なにが なくなった？」',
      '買い物リストを2つだけ覚えて、一緒に探す',
      '並べたおもちゃの順番を覚えて、同じ順に並べる',
    ],
    Component: lazy(() => import('./memory/index')),
  },
  {
    id: 'compare',
    title: 'くらべっこ',
    titleVoice: 'title.compare',
    icon: 'mode-compare',
    variants: one('compare', 'questions', 'mode-compare', 'くらべっこ', 'title.compare'),
    homeTips: [
      '靴を並べて「どっちが ながい？」（かかとをそろえて）',
      'おやつを2つに分けて「おなじ かな？」と数えてみる',
      '家族の手の大きさを重ねて比べる',
    ],
    Component: lazy(() => import('./compare/index')),
  },
  {
    id: 'road',
    title: 'みちを つくろう',
    titleVoice: 'title.road',
    icon: 'mode-road',
    variants: [
      {
        id: 'puzzle',
        title: 'もんだい',
        titleVoice: 'road.variant.puzzle',
        icon: 'mode-road',
        skillId: 'road',
        roundKind: 'boards',
      },
      {
        id: 'free',
        title: 'じゆうに つくる',
        titleVoice: 'road.variant.free',
        icon: 'road-free',
        skillId: null,
        roundKind: 'work',
      },
    ],
    homeTips: [
      '積み木や紙で道を作り、ミニカーを走らせる',
      '家から公園までの道順を、一緒に話しながら歩く',
      '道がつながらないとき、どこを直すか一緒に考える',
    ],
    Component: lazy(() => import('./road/index')),
  },
  {
    id: 'trace',
    title: 'なぞって あそぼう',
    titleVoice: 'title.trace',
    icon: 'mode-trace',
    variants: [
      {
        id: 'lines',
        title: 'せん',
        titleVoice: 'trace.variant.lines',
        icon: 'trace-lines',
        skillId: 'trace',
        roundKind: 'trace',
        levelRange: [0, 2],
      },
      {
        id: 'maze',
        title: 'めいろ',
        titleVoice: 'trace.variant.maze',
        icon: 'trace-maze',
        skillId: 'trace',
        roundKind: 'trace',
        levelRange: [3, 3],
        available: (p) => (p.trace?.level ?? 0) >= 3,
      },
      {
        id: 'letters',
        title: 'もじ',
        titleVoice: 'trace.variant.letters',
        icon: 'trace-letters',
        skillId: 'trace',
        roundKind: 'trace',
        levelRange: [4, 6],
        available: (p) => (p.trace?.level ?? 0) >= 4,
      },
    ],
    homeTips: [
      '砂や水、指絵の具で、指で線を描いて遊ぶ',
      '大きな紙にクレヨンで道を描き、ミニカーで走る',
      '鉛筆の持ち方は、この遊びとは別に大人が見て教える',
    ],
    Component: lazy(() => import('./trace/index')),
  },
  {
    id: 'math',
    title: 'さんすう',
    titleVoice: 'title.math',
    icon: 'mode-math',
    variants: [
      {
        id: 'add',
        title: 'たす',
        titleVoice: 'math.variant.add',
        icon: 'math-add',
        skillId: 'add',
        roundKind: 'questions',
      },
      {
        id: 'sub',
        title: 'ひく',
        titleVoice: 'math.variant.sub',
        icon: 'math-sub',
        skillId: 'sub',
        roundKind: 'questions',
      },
      {
        id: 'split',
        title: 'わける',
        titleVoice: 'math.variant.split',
        icon: 'math-split',
        skillId: 'split',
        roundKind: 'questions',
      },
      {
        id: 'formula_add',
        title: 'しき（たす）',
        titleVoice: 'math.variant.formula-add',
        icon: 'math-formula-add',
        skillId: 'formula_add',
        roundKind: 'questions',
        available: (p) => !!p.add?.mastered || (p.formula_add?.attempted ?? false),
      },
      {
        id: 'formula_sub',
        title: 'しき（ひく）',
        titleVoice: 'math.variant.formula-sub',
        icon: 'math-formula-sub',
        skillId: 'formula_sub',
        roundKind: 'questions',
        available: (p) => !!p.sub?.mastered || (p.formula_sub?.attempted ?? false),
      },
    ],
    homeTips: [
      'おやつを2つのお皿に分けて「ほかの わけかたは？」',
      '階段を上りながら数える',
      '「3つ あったのが 1つ なくなったら？」をお菓子で試す',
    ],
    Component: lazy(() => import('./math/index')),
  },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<
  ModeId,
  ModeDef
>;

/** 保護者設定「1回の問題数」をモードの単位に読み替える（learning-design.md 0.4） */
export function roundSizeFor(kind: RoundKind, setting: 3 | 4 | 5): number {
  switch (kind) {
    case 'questions':
      return setting;
    case 'boards':
      return setting === 3 ? 2 : 3;
    case 'trace':
      return setting - 1;
    case 'work':
      return 1;
  }
}
