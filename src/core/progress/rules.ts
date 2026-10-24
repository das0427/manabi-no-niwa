/**
 * 段階（難易度）の自動調整ルール。純粋関数。
 * 仕様の正本: docs/architecture.md 4.3（結果の種類）と 4.4（進度ルール）。
 *
 * 要点:
 * - 1問ごとには段階を変えない。evaluate() は1回（ラウンド）の終わりにだけ呼ぶ。
 * - 窓 = 今の段階での直近10件。abandoned と operationIssue 付きの問題は入れない。
 * - 進む: 段階が変わってから10件以上、直近10件中8件以上が independent。
 * - 戻る: 段階が変わってから8件以上、直近6件中 independent ≤ 1 かつ (after_hint + skipped) ≥ 4。
 *   self_corrected と after_review は「戻る」に数えない（見直しは良い方略。罰にしない）。
 * - 保護者が固定したスキルは変わらない。
 */
import type { Outcome, SkillId, SkillProgress } from '../types';

export const RULES = {
  windowSize: 10,
  promoteNeed: 8,
  promoteNeedHighChance: 9,
  demoteLook: 6,
  demoteMinSinceChange: 8,
  demoteMaxIndependent: 1,
  demoteMinStruggle: 4,
} as const;

/** 進む条件（10件中何件の independent が必要か） */
export function promoteNeedFor(chance = 0): number {
  return chance > 0.34 ? RULES.promoteNeedHighChance : RULES.promoteNeed;
}

export function emptyProgress(profileId: string, skillId: SkillId): SkillProgress {
  return {
    profileId,
    skillId,
    level: 0,
    window: [],
    mastered: false,
    attempted: false,
    changedAt: 0,
    lastChange: null,
  };
}

/** 進度の共通部分（v1 のスキル進度と、新しい単元の進度 UnitProgress の両方に使う） */
export type ProgressCore = Omit<SkillProgress, 'skillId'>;

/** 1問の結果を窓に加える（段階は変えない） */
export function addOutcome<P extends ProgressCore>(
  p: P,
  outcome: Outcome,
  operationIssue = false,
): P {
  const attempted = p.attempted || outcome !== 'abandoned';
  if (outcome === 'abandoned' || operationIssue) return { ...p, attempted };
  const window = [...p.window, outcome].slice(-RULES.windowSize);
  return { ...p, window, attempted };
}

export interface EvaluateOptions {
  levelCount: number;
  /** 保護者が固定した段階（あれば変化させない） */
  locked?: number;
  /**
   * 1問をでたらめに答えて independent になる確率（2択=0.5）。
   * 0.34 を超える段階は、進む条件を 10件中9件に厳しくする（偶然で進みにくくする）。
   */
  chance?: number;
  /** 探索の段階（さんすう D1 など）: この件数たまったら結果に関係なく進む */
  autoPromoteAfter?: number;
  now: number;
}

export type Change = 'up' | 'down' | 'mastered' | null;

export interface EvaluateResult<P extends ProgressCore = SkillProgress> {
  next: P;
  change: Change;
}

function count(list: readonly Outcome[], ...kinds: Outcome[]): number {
  return list.filter((o) => kinds.includes(o)).length;
}

/** ラウンドの終わりに呼ぶ。段階を上げる・下げる・そのまま を決める */
export function evaluate<P extends ProgressCore>(p: P, opt: EvaluateOptions): EvaluateResult<P> {
  const top = opt.levelCount - 1;
  if (opt.locked !== undefined) {
    const level = Math.max(0, Math.min(top, opt.locked));
    if (level !== p.level) {
      return {
        next: {
          ...p,
          level,
          window: [],
          changedAt: opt.now,
          lastChange: { from: p.level, to: level, reason: 'parent', at: opt.now },
        },
        change: null,
      };
    }
    return { next: p, change: null };
  }

  const w = p.window;
  const lastN = w.slice(-RULES.windowSize);
  const promoteByScore =
    w.length >= RULES.windowSize && count(lastN, 'independent') >= promoteNeedFor(opt.chance);
  const promoteByExplore = opt.autoPromoteAfter !== undefined && w.length >= opt.autoPromoteAfter;

  if (promoteByScore || promoteByExplore) {
    if (p.level < top) {
      return {
        next: {
          ...p,
          level: p.level + 1,
          window: [],
          changedAt: opt.now,
          lastChange: { from: p.level, to: p.level + 1, reason: 'promote', at: opt.now },
        },
        change: 'up',
      };
    }
    if (!p.mastered && promoteByScore) {
      return { next: { ...p, mastered: true }, change: 'mastered' };
    }
  }

  if (w.length >= RULES.demoteMinSinceChange && p.level > 0) {
    const look = w.slice(-RULES.demoteLook);
    const independent = count(look, 'independent');
    const struggle = count(look, 'after_hint', 'skipped');
    if (independent <= RULES.demoteMaxIndependent && struggle >= RULES.demoteMinStruggle) {
      return {
        next: {
          ...p,
          level: p.level - 1,
          window: [],
          changedAt: opt.now,
          lastChange: { from: p.level, to: p.level - 1, reason: 'demote', at: opt.now },
        },
        change: 'down',
      };
    }
  }

  return { next: p, change: null };
}

/** 保護者が段階を直接変えたとき */
export function setLevelByParent(p: SkillProgress, level: number, now: number): SkillProgress {
  if (level === p.level) return { ...p, window: [] };
  return {
    ...p,
    level,
    window: [],
    changedAt: now,
    lastChange: { from: p.level, to: level, reason: 'parent', at: now },
  };
}

/**
 * 保護者画面に出す「なぜこの段階か」の説明（AD-09）。
 * levelLabel は「S2 同じ品物を1〜3個」のような段階名。
 */
export function explainProgress(
  p: SkillProgress,
  levelCount: number,
  levelLabel: string,
  locked?: number,
  chance?: number,
): string {
  if (!p.attempted) return `まだ取り組んでいません（${levelLabel} から始まります）。`;
  if (locked !== undefined) return `保護者の設定で「${levelLabel}」に固定しています。`;
  const w = p.window;
  const ind = count(w.slice(-RULES.windowSize), 'independent');
  const parts: string[] = [`いまの段階は「${levelLabel}」です。`];
  if (p.lastChange) {
    const why =
      p.lastChange.reason === 'promote'
        ? '前の段階で自分でできることが続いたため進みました'
        : p.lastChange.reason === 'demote'
          ? '前の段階でヒントを使うことが続いたため、ひとつ前に戻りました'
          : '保護者が変更しました';
    parts.push(`${why}。`);
  }
  if (w.length < RULES.windowSize) {
    parts.push(
      `この段階で ${w.length} 問取り組みました（うち自分でできた ${ind} 問）。` +
        `10問たまると、次へ進むかどうかを判断します。`,
    );
  } else if (p.level < levelCount - 1) {
    const need = Math.max(0, promoteNeedFor(chance) - ind);
    parts.push(
      `直近10問のうち、自分でできたのは ${ind} 問です。` +
        (need === 0
          ? '次の回の終わりに次の段階へ進みます。'
          : `あと ${need} 問自分でできると、次の段階へ進みます。`),
    );
  } else {
    parts.push(
      p.mastered
        ? `最後の段階で、自分でできることが続いています（直近10問中 ${ind} 問）。`
        : `最後の段階です。直近10問のうち、自分でできたのは ${ind} 問です。`,
    );
  }
  return parts.join('');
}

/** 「むずかしそう」の判定（learning-design.md 13章） */
export function looksHard(p: SkillProgress): boolean {
  if (p.window.length < 6) return false;
  return count(p.window.slice(-6), 'independent') <= 1;
}
