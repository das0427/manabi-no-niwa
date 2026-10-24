/**
 * 単元と問題の型（docs/expansion/curriculum-matrix.md 1章・2章、architecture.md 3章・5章）。
 * 教材パック（src/packs/<packId>/）はこの型のデータと生成器だけを持ち、UI を持たない。
 */
import type { NumberAnswer } from '../core/answer/number';
import type { Rng } from '../core/util/rng';
import type { Figure } from '../engines/figure/types';

/** 文の記法（src/text/rich.ts）。漢字は必ず《よみ》付き */
export type RichText = string;

/** 単元IDの段階（curriculum-matrix 0.5） */
export type StageId = 'p23' | 'p4' | 'p5' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6';
export type SubjectId =
  'ja' | 'math' | 'think' | 'env' | 'hand' | 'prog' | 'life' | 'sci' | 'soc' | 'en';
/** 単元の種別（curriculum-matrix 0.5: 計 概 読 知 運 探 記 遊） */
export type UnitKind =
  'calc' | 'concept' | 'reading' | 'knowledge' | 'writing' | 'inquiry' | 'record' | 'play';
export type Priority = 'P1' | 'P2';
/** 状態（curriculum-matrix 1.1。planned は子供画面に出さない） */
export type UnitStatus = 'planned' | 'partial' | 'ready';
/** 復習の単位（curriculum-matrix 1.6） */
export type ReviewUnit = 'item' | 'type' | 'objective' | 'view' | 'none';

/** 到達項目（1.5）。2〜8個 */
export interface Objective {
  id: string;
  title: RichText;
}

/** 典型的な誤り（1.2-4）。誤りの選択肢・入力に id を付ける */
export interface Misconception {
  id: string;
  /** 子供に見せる説明（責めない文。「〜と かんがえたのかな」） */
  explain: RichText;
  figure?: Figure;
}

export interface LevelDef {
  /** 段階の名前（保護者画面用） */
  label: string;
  /** でたらめに答えて independent になる確率（進む条件の厳しさ。core/progress/rules.ts） */
  chance: number;
  autoPromoteAfter?: number;
}

/** おてほん（導入）の1場面。練習の数に数えない */
export interface IntroStep {
  text: RichText;
  figure?: Figure;
}

// ---- 問題 ----
export interface ItemBase {
  /** 単元内で一意。生成問題は生成器が付ける（例 'add:3+5'） */
  id: string;
  /** 到達項目の id */
  objective: string;
  /** 段階（0始まり） */
  level: number;
  /** 問題文 */
  prompt: RichText;
  /** 作業領域に出す図 */
  figure?: Figure;
  /** ヒント（幼児2段階、小学生3段階。どの段階も答えそのものを示さない） */
  hints: RichText[];
  /** 解説（正解後・つぎへの後） */
  explain: RichText;
  explainFigure?: Figure;
  /** 同一性キー（1.4）。水増しの検査に使う */
  identity: string;
  /** 別例での確認（表現を変えた問題, 1.2-3） */
  alt?: boolean;
}

export interface ChoiceOption {
  /** 文（RichText）か図 */
  label?: RichText;
  figure?: Figure;
  correct?: boolean;
  /** 誤りの選択肢の誤概念 id */
  misconception?: string;
}

export interface ChoiceItem extends ItemBase {
  engine: 'choice';
  options: ChoiceOption[];
  /** 正解をすべて選ぶ（順不同の集合一致） */
  multi?: boolean;
  /** 選択肢を並べ替えない（大小の順など意味のある並び） */
  fixedOrder?: boolean;
  /** 選択肢の並び（既定 row） */
  layout?: 'row' | 'grid' | 'column';
}

export interface NumberField {
  /** 欄の名前（「しょう」「あまり」「m」「cm」など） */
  label?: RichText;
  answer: NumberAnswer;
}

export interface NumberItem extends ItemBase {
  engine: 'number';
  /** 欄（「□m□cm」「商とあまり」は複数欄） */
  fields: NumberField[];
  /** 数字キーで使える記号 */
  keys?: ('decimal' | 'fraction' | 'minus')[];
  /** 入力に応じた誤概念の推定（例: 繰り上がりを忘れた答え） */
  wrongAnswers?: { value: string; misconception: string }[];
}

/** 問題の型の和。エンジンを足すときはここに加える（統括が管理） */
export type Item = ChoiceItem | NumberItem;
export type EngineId = Item['engine'];

// ---- 単元 ----
export interface GenerateContext {
  level: number;
  rng: Rng;
  /** 回の中での番号（0始まり） */
  index: number;
}

export type ItemSource =
  | { kind: 'items'; items: Item[] }
  | {
      kind: 'generator';
      generate(ctx: GenerateContext): Item;
      /**
       * 定義域の大きさ（同一性キーで数えた、作りうる異なる問題の総数）。
       * 基準 N より小さいときは「全件」が基準になる（curriculum-matrix 1.3）
       */
      domainSize?: number;
      /** 手作りの問題（別例・導入の確認など）も併せて出す */
      items?: Item[];
    };

export interface UnitSpec {
  /** '{段階}.{教科}.{名前}'（curriculum-matrix の単元ID） */
  id: string;
  title: RichText;
  stage: StageId;
  subject: SubjectId;
  /** 領域（算数: A-number 等。curriculum-matrix の表の領域） */
  domain: string;
  kind: UnitKind;
  priority: Priority;
  status: UnitStatus;
  /** 絵（IllustId） */
  icon: string;
  prereq: string[];
  objectives: Objective[];
  misconceptions: Misconception[];
  levels: LevelDef[];
  intro: IntroStep[];
  source: ItemSource;
  review: ReviewUnit;
  /** 1回の問題数（省略時は区分の既定） */
  roundSize?: number;
  /** 根拠（学習指導要領の該当など） */
  basis: string;
  /** 学年の割当が本アプリの案（curriculum-matrix 0.3 の ※） */
  gradeIsAppProposal?: boolean;
  /** 'YYYY-MM-DD' */
  revised: string;
}

export interface PackContent {
  packId: string;
  units: UnitSpec[];
}

/** 単元の索引（本体に同梱する軽いメタデータ。architecture.md 3章） */
export interface UnitMeta {
  id: string;
  pack: string;
  title: RichText;
  stage: StageId;
  subject: SubjectId;
  domain: string;
  icon: string;
  prereq: string[];
  priority: Priority;
  status: UnitStatus;
  engine: EngineId;
}
