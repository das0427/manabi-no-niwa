/**
 * ほかの がくねん・きょうか（先取り・さかのぼり X-TG-03）。
 * 幼児（2〜3歳・4歳・5歳）からも小学生からも、どの区分の札・教科にも行ける。
 * 左に区分のタブ（2〜3さい〜6ねん）、右にその区分の札（幼児はホームの札、小学生は教科の札）。
 * 区分を変えるのではなく「のぞきに行く」入口なので、プロフィールの区分・記録はそのまま。
 */
import { gradeOf, type Grade } from '../audience/audience';
import { profileAudience } from '../core/types';
import { PRESCHOOL_HOMES, preschoolStageOf, type HomeCard } from '../curriculum/preschoolHome';
import { subjectName, subjectsForGrade } from '../curriculum/subjects';
import { Illust } from '../illust/Illust';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { ModeHeader } from '../ui/ModeHeader';
import { useApp } from './AppState';
import { cardUnits, openUnit } from './PreschoolHome';
import { navigate } from './router';
import './home.css';
import './school-home.css';
import './explore.css';

export const EXPLORE_STAGES = ['p23', 'p4', 'p5', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;
export type ExploreStage = (typeof EXPLORE_STAGES)[number];

export const STAGE_LABEL: Record<ExploreStage, string> = {
  p23: '2〜3さい',
  p4: '4さい',
  p5: '5さい',
  g1: '1ねん',
  g2: '2ねん',
  g3: '3ねん',
  g4: '4ねん',
  g5: '5ねん',
  g6: '6ねん',
};

/** 子供のいまの区分（幼児は p23/p4/p5、小学生は在籍学年か区分の学年） */
export function ownStage(audience: string, enrolledGrade?: number): ExploreStage {
  const pre = preschoolStageOf(audience);
  if (pre) return pre;
  const g = enrolledGrade ?? gradeOf(audience as Parameters<typeof gradeOf>[0]);
  return (g >= 1 && g <= 6 ? `g${g}` : 'g1') as ExploreStage;
}

function TwoLine({ text }: { text: string }) {
  const [a, ...rest] = text.split(' ');
  return (
    <span className="home-card__name">
      {a}
      {rest.length ? <br /> : null}
      {rest.join('')}
    </span>
  );
}

export function Explore({ stage: stageParam }: { stage?: string }) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const own = ownStage(profileAudience(profile), profile.enrolledGrade ?? undefined);
  const stage = (
    (EXPLORE_STAGES as readonly string[]).includes(stageParam ?? '') ? stageParam : own
  ) as ExploreStage;
  const learner = profile.enrolledGrade ?? gradeOf(profileAudience(profile));
  const ctx = { furigana: settings.support.furigana, learnerGrade: learner };

  const openCard = (c: HomeCard, st: 'p23' | 'p4' | 'p5') => {
    const units = cardUnits(c, settings.unitsOpened);
    if (units.length === 1) openUnit(units[0]!);
    else if (units.length > 1) navigate({ name: 'card', stage: st, cardId: c.id });
  };

  let body;
  if (stage === 'p23' || stage === 'p4' || stage === 'p5') {
    const def = PRESCHOOL_HOMES[stage];
    const cards = (def?.cards ?? []).filter((c) => cardUnits(c, settings.unitsOpened).length > 0);
    body = (
      <div className="explore-cards" role="list" aria-label={`${STAGE_LABEL[stage]}の あそび`}>
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            role="listitem"
            className="home-card"
            aria-label={c.title.replace(/ /g, '')}
            onClick={() => openCard(c, stage)}
            data-testid={`explore-card-${c.id}`}
          >
            <Illust id={c.icon} className="home-card__illust" decorative />
            <TwoLine text={c.title} />
          </button>
        ))}
      </div>
    );
  } else {
    const grade = Number(stage.slice(1)) as Grade;
    const subjects = subjectsForGrade(grade);
    body = (
      <div className="explore-cards" role="list" aria-label={`${STAGE_LABEL[stage]}の きょうか`}>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            role="listitem"
            className="school-subject"
            style={{ ['--subj' as string]: s.color }}
            aria-label={plainText(subjectName(s, grade))}
            onClick={() => navigate({ name: 'subject', subject: s.id, grade: stage })}
            data-testid={`explore-subject-${s.id}`}
          >
            <Illust id={s.icon} className="school-subject__illust" decorative />
            <span className="school-subject__name">
              <Rt text={subjectName(s, grade)} ctx={ctx} />
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="screen explore" data-testid="explore" data-stage={stage}>
      <ModeHeader
        promptText="どこで あそぶ？"
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => undefined}
        canListen={false}
      />
      <div className="explore-tabs" role="tablist" aria-label="がくねん">
        {EXPLORE_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            role="tab"
            aria-selected={st === stage}
            className={`explore-tab ${st === stage ? 'is-current' : ''} ${st === own ? 'is-own' : ''}`}
            onClick={() => navigate({ name: 'explore', stage: st }, { replace: true, force: true })}
            data-testid={`explore-tab-${st}`}
          >
            {STAGE_LABEL[st]}
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}
