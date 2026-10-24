/**
 * 小学生ホーム（ux-by-age 2.2）: 上に教科の札、右に きょうの おすすめ（復習を含む）・おえかき・がんばりノート。
 * 教科の札には「とりくみちゅう」の単元数を小さく出す（点数は出さない）。
 */
import { useEffect, useMemo, useState } from 'react';
import { gradeOf, type Grade } from '../audience/audience';
import * as db from '../core/storage/index';
import { profileAudience, type UnitProgress } from '../core/types';
import { recommendUnits, type UnitRec } from '../curriculum/recommend';
import { subjectName, subjectsForGrade } from '../curriculum/subjects';
import type { StageId } from '../curriculum/types';
import { unitMeta, UNIT_INDEX } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { useApp } from './AppState';
import { ParentGateButton } from './ParentGate';
import { navigate } from './router';
import './home.css';
import './school-home.css';

export function SchoolHome() {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const grade = (profile.enrolledGrade ?? gradeOf(profileAudience(profile))) as Grade;
  const stage = `g${grade}` as StageId;
  const [progress, setProgress] = useState<UnitProgress[]>([]);
  useEffect(() => {
    let alive = true;
    void db.listUnitProgress(profile.id).then((p) => {
      if (alive) setProgress(p);
    });
    return () => {
      alive = false;
    };
  }, [profile.id]);
  const recs: UnitRec[] = useMemo(
    () => recommendUnits({ index: UNIT_INDEX, progress, stage, now: Date.now() }),
    [progress, stage],
  );
  const ctx = { furigana: settings.support.furigana, learnerGrade: grade };
  const learningIn = (subject: string) =>
    progress.filter((p) => p.review.stage === 'learning' && unitMeta(p.unitId)?.subject === subject)
      .length;

  return (
    <div className="screen home school-home" data-testid="school-home">
      <div className="home-top">
        <div className="home-profile">
          <Illust id={profile.avatar} className="home-profile__avatar" decorative />
          <span className="label-text">{profile.name}</span>
        </div>
        <div className="home-top__right">
          <ParentGateButton />
        </div>
      </div>
      <div className="school-subjects" role="list" aria-label="きょうか">
        {subjectsForGrade(grade).map((s) => {
          const n = learningIn(s.id);
          const name = subjectName(s, grade);
          return (
            <button
              key={s.id}
              type="button"
              role="listitem"
              className="school-subject"
              style={{ ['--subj' as string]: s.color }}
              aria-label={`${plainText(name)}${n ? ` とりくみちゅう ${n}` : ''}`}
              onClick={() => navigate({ name: 'subject', subject: s.id })}
              data-testid={`subject-${s.id}`}
            >
              <Illust id={s.icon} className="school-subject__illust" decorative />
              <span className="school-subject__name">
                <Rt text={name} ctx={ctx} />
              </span>
              {n > 0 ? (
                <span className="school-subject__count" aria-hidden>
                  <span className="school-subject__half" />
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <aside className="home-side">
        <p className="label-text home-side__title">きょうの おすすめ</p>
        {recs.map((r) => {
          const u = unitMeta(r.unitId)!;
          return (
            <button
              key={r.unitId}
              type="button"
              className="home-rec"
              aria-label={`おすすめ ${plainText(u.title)}${r.kind === 'review' ? ' ふくしゅう' : ''}`}
              onClick={() => navigate({ name: 'unit', unitId: r.unitId })}
              data-testid={`rec-${r.unitId}`}
            >
              <Illust id={u.icon} className="home-rec__illust" decorative />
              <span className="home-rec__name">
                <Rt text={u.title} ctx={ctx} />
                {r.kind === 'review' ? <span className="school-rec__tag">ふくしゅう</span> : null}
              </span>
            </button>
          );
        })}
        <div className="school-side__row">
          <button
            type="button"
            className="home-rec home-rec--note school-side__half"
            aria-label="おえかき"
            onClick={() => navigate({ name: 'draw' })}
            data-testid="home-draw"
          >
            <Illust id="picture" className="home-rec__illust" decorative />
            <span className="home-rec__name">おえかき</span>
          </button>
          <button
            type="button"
            className="home-rec home-rec--note school-side__half"
            aria-label="がんばりノート"
            onClick={() => navigate({ name: 'notebook' }, { say: 'app.notebook' })}
            data-testid="home-notebook"
          >
            <Illust id="notebook" className="home-rec__illust" decorative />
            <span className="home-rec__name">ノート</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
