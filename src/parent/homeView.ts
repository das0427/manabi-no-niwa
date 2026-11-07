/**
 * 保護者の「きろく」を、そのプロフィールの子供のホームと食い違わせないための関数（FX14。純粋な関数）。
 *
 * - どの v1 のあそび（旧モード）が、そのホームから遊べるか: 幼児ホームの札（PRESCHOOL_HOMES）につながる単元のうち、
 *   v1 のモードを使うもの（UnitMeta.legacy）。小学生ホームには v1 のあそびの札が無い。
 * - 「きょうの おすすめ」: 子供のホームと同じ関数・同じ入力で作る（幼児: recommendCards、小学生: recommendUnits）。
 *   v1 の recommend()（9つのモードの順）は、どのホームも使っていないので、保護者の画面にも出さない。
 *
 * 子供のホームの組み立て（PreschoolHome.tsx・SchoolHome.tsx）と同じ手順をここに写している。
 * ホーム側を変えたら、ここも合わせる（src/parent/recordsHome.test.tsx が、実際のホームと同じ結果になることを見ている）。
 */
import { gradeOf, type Grade } from '../audience/audience';
import { cardUnits } from '../app/PreschoolHome';
import {
  profileAudience,
  type ChildSettings,
  type ModeId,
  type Profile,
  type UnitProgress,
} from '../core/types';
import {
  PRESCHOOL_HOMES,
  preschoolStageOf,
  recommendCards,
  type HomeCard,
} from '../curriculum/preschoolHome';
import { recommendUnits, type UnitRec } from '../curriculum/recommend';
import type { StageId } from '../curriculum/types';
import { UNIT_INDEX, unitMeta } from '../curriculum/unitIndex';
import { plainText } from '../text/rich';

/** 子供のホームに出る札（幼児のホームだけ。小学生ホームと、札の定義が無い区分は空） */
export function preschoolHomeCards(profile: Profile): HomeCard[] {
  const stage = preschoolStageOf(profileAudience(profile));
  const def = stage ? PRESCHOOL_HOMES[stage] : undefined;
  if (!def) return [];
  // 2歳段階は stage2Cards の札だけ。それ以外は先頭の9枚（PreschoolHome と同じ）
  const stage2 = def.stage === 'p23' && profile.toddlerStage === 2;
  return stage2 ? def.cards.filter((c) => def.stage2Cards?.includes(c.id)) : def.cards.slice(0, 9);
}

/** その子のホームから遊べる v1 のモード（札につながる単元のうち、v1 のモードを使うもの） */
export function homeLegacyModes(
  profile: Profile,
  settings: Pick<ChildSettings, 'unitsOpened'>,
): Set<ModeId> {
  const modes = new Set<ModeId>();
  for (const card of preschoolHomeCards(profile))
    for (const id of cardUnits(card, settings.unitsOpened)) {
      const modeId = unitMeta(id)?.legacy?.modeId;
      if (modeId) modes.add(modeId);
    }
  return modes;
}

/** 札の名前（空白で2行に分ける題から空白を除く） */
export const cardTitle = (c: HomeCard): string => c.title.replace(/\s+/g, '');

export interface HomeRec {
  /** 札の id または単元の ID */
  key: string;
  title: string;
  reason: string;
}

const UNIT_REC_REASON: Record<UnitRec['kind'], string> = {
  review: '復習の時期です',
  continue: '取り組み中の単元です',
  next: '次に取り組める単元です',
};

export interface HomeRecInput {
  profile: Profile;
  settings: Pick<ChildSettings, 'unitsOpened'>;
  /** 「すき」の印（v1 のモードID） */
  favorites: readonly string[];
  /** 30日分の回の記録（modeId・variantId・startedAt） */
  rounds: readonly { modeId: string; variantId: string; startedAt: number }[];
  unitProgress: readonly UnitProgress[];
  /** YYYY-MM-DD */
  today: string;
  todayStart: number;
  now: number;
}

/**
 * 子供のホームに「きょうの おすすめ」として出ているもの。ホームに おすすめが無い区分（2歳段階）は空。
 * 幼児: 札（PreschoolHome と同じ recommendCards）。小学生: 単元（SchoolHome と同じ recommendUnits）。
 */
export function homeRecommendations(input: HomeRecInput): HomeRec[] {
  const { profile, settings } = input;
  const aud = profileAudience(profile);
  if (preschoolStageOf(aud)) {
    const cards = preschoolHomeCards(profile);
    const def = PRESCHOOL_HOMES[preschoolStageOf(aud)!];
    if (!def || (def.stage === 'p23' && profile.toddlerStage === 2)) return [];
    const shown = cards.filter((c) => cardUnits(c, settings.unitsOpened).length > 0);
    return recommendCards({
      cards: shown,
      today: input.today,
      todayStart: input.todayStart,
      rounds: input.rounds,
      favorites: input.favorites,
      legacyModeOf: (u) => unitMeta(u)?.legacy?.modeId,
      domainOf: (c) => unitMeta(c.units[0]!)?.subject ?? c.id,
    }).map((r) => ({
      key: r.cardId,
      title: cardTitle(cards.find((c) => c.id === r.cardId)!),
      reason: r.reason,
    }));
  }
  const grade = (profile.enrolledGrade ?? gradeOf(aud)) as Grade;
  return recommendUnits({
    index: UNIT_INDEX,
    progress: input.unitProgress,
    stage: `g${grade}` as StageId,
    now: input.now,
    opened: settings.unitsOpened,
  }).map((r) => {
    const m = unitMeta(r.unitId);
    return {
      key: r.unitId,
      title: m ? plainText(m.title) : r.unitId,
      reason: UNIT_REC_REASON[r.kind],
    };
  });
}
