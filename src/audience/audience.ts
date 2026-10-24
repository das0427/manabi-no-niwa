/**
 * 対象区分と支援設定（docs/expansion/architecture.md 2章, ux-by-age.md 1章）。純粋なデータと関数。
 * 区分は「既定値の出どころ」にすぎない。区分を変えても記録・作品・習熟度は変えない（X-TG-04）。
 */
export const AUDIENCE_IDS = ['toddler', 'p4', 'p5', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
export type AudienceId = (typeof AUDIENCE_IDS)[number];
export type ToddlerStage = 2 | 3;
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export interface SupportSettings {
  /** unlearned = 保護者画面の「がくねんに あわせる」 */
  furigana: 'unlearned' | 'all' | 'none';
  readAloud: 'always' | 'button' | 'off';
  textScale: 1 | 1.15 | 1.3;
  instruction: 'short' | 'normal';
  style: 'gentle' | 'standard' | 'calm';
  drawingTools: 'simple' | 'detailed';
  effects: 'on' | 'quiet' | 'off';
}

/** 区分ごとの画面の設計値（ux-by-age.md 1章の表）。設定ではなく区分の性質 */
export interface AudienceUx {
  /** 保護者画面での名前（子供画面には年齢を出さない: 統括の判断4） */
  parentLabel: string;
  /** 選択肢の数の上限 */
  maxChoices: number;
  /** 1回の問題数の既定 */
  roundSize: number;
  /** 正誤を強調しない（2歳段階） */
  softJudgement: boolean;
  /** 残り量の表示 */
  remaining: 'none' | 'dots' | 'dots-text' | 'count';
  /** 長押し・ドラッグを要する操作を出さない */
  noHoldOrDrag: boolean;
  /** 利用時間の目安の既定（分） */
  sessionMinutes: number;
  /** 開始時に「おとなと いっしょに」を表示 */
  withAdult: boolean;
  /** 判定ありのなぞりを出す */
  judgedTrace: boolean;
  /** 習熟度（正誤・進度）を記録する。2歳段階は遊んだ内容だけ（統括の判断1） */
  recordMastery: boolean;
}

type UxKey = AudienceId | 'toddler2' | 'toddler3';

const UX: Record<Exclude<UxKey, 'toddler'>, AudienceUx> = {
  toddler2: {
    parentLabel: '2〜3さい（2さいの だんかい）',
    maxChoices: 2,
    roundSize: 3,
    softJudgement: true,
    remaining: 'none',
    noHoldOrDrag: true,
    sessionMinutes: 5,
    withAdult: true,
    judgedTrace: false,
    recordMastery: false,
  },
  toddler3: {
    parentLabel: '2〜3さい（3さいの だんかい）',
    maxChoices: 3,
    roundSize: 3,
    softJudgement: false,
    remaining: 'none',
    noHoldOrDrag: true,
    sessionMinutes: 8,
    withAdult: true,
    judgedTrace: true,
    recordMastery: true,
  },
  p4: {
    parentLabel: '4さい',
    maxChoices: 4,
    roundSize: 4,
    softJudgement: false,
    remaining: 'dots',
    noHoldOrDrag: false,
    sessionMinutes: 10,
    withAdult: false,
    judgedTrace: true,
    recordMastery: true,
  },
  p5: {
    parentLabel: '5さい',
    maxChoices: 4,
    roundSize: 5,
    softJudgement: false,
    remaining: 'dots',
    noHoldOrDrag: false,
    sessionMinutes: 10,
    withAdult: false,
    judgedTrace: true,
    recordMastery: true,
  },
  g1: grade('小学1年', 4, 5, 'dots-text', 15),
  g2: grade('小学2年', 4, 5, 'dots-text', 15),
  g3: grade('小学3年', 4, 6, 'count', 20),
  g4: grade('小学4年', 4, 6, 'count', 20),
  g5: grade('小学5年', 4, 8, 'count', 20),
  g6: grade('小学6年', 4, 8, 'count', 20),
};

function grade(
  parentLabel: string,
  maxChoices: number,
  roundSize: number,
  remaining: AudienceUx['remaining'],
  sessionMinutes: number,
): AudienceUx {
  return {
    parentLabel,
    maxChoices,
    roundSize,
    softJudgement: false,
    remaining,
    noHoldOrDrag: false,
    sessionMinutes,
    withAdult: false,
    judgedTrace: true,
    recordMastery: true,
  };
}

export function audienceUx(a: AudienceId, toddlerStage: ToddlerStage = 3): AudienceUx {
  if (a === 'toddler') return UX[toddlerStage === 2 ? 'toddler2' : 'toddler3'];
  return UX[a];
}

/** 区分の既定の支援設定（architecture.md 2章、統括の判断6: 小1〜2は自動で読み上げ） */
export function defaultSupport(a: AudienceId): SupportSettings {
  const base: SupportSettings = {
    furigana: 'unlearned',
    readAloud: 'always',
    textScale: 1,
    instruction: 'normal',
    style: 'gentle',
    drawingTools: 'simple',
    effects: 'on',
  };
  switch (a) {
    case 'toddler':
    case 'p4':
    case 'p5':
      return { ...base, instruction: 'short' };
    case 'g1':
    case 'g2':
      return { ...base, style: 'standard' };
    case 'g3':
    case 'g4':
      return {
        ...base,
        style: 'standard',
        readAloud: 'button',
        drawingTools: 'detailed',
        effects: 'quiet',
      };
    case 'g5':
    case 'g6':
      return {
        ...base,
        style: 'calm',
        readAloud: 'button',
        drawingTools: 'detailed',
        effects: 'off',
      };
  }
}

/** 在籍学年に対応する区分（就学前は null を返す） */
export function audienceForGrade(g: Grade | null | undefined): AudienceId | null {
  return g ? (`g${g}` as AudienceId) : null;
}

/** 区分の学年（小学生のみ）。就学前は 0 */
export function gradeOf(a: AudienceId): 0 | Grade {
  return a.startsWith('g') ? (Number(a.slice(1)) as Grade) : 0;
}

export function isPreschool(a: AudienceId): boolean {
  return gradeOf(a) === 0;
}

/**
 * ふりがなを付けるか（統括の判断3）。kanjiGrade は配当学年（配当外は 7 以上 / null）。
 * learnerGrade は在籍学年（就学前は 0）。
 */
export function showFurigana(
  mode: SupportSettings['furigana'],
  kanjiGrade: number | null,
  learnerGrade: number,
): boolean {
  if (mode === 'all') return true;
  if (mode === 'none') return false;
  if (learnerGrade <= 0 || kanjiGrade === null) return true;
  return kanjiGrade >= learnerGrade;
}
