/**
 * 単元の地図（ux-by-age 2.3）: 学年のタブ（全学年へ行ける。先取り・さかのぼり X-TG-03）、領域ごとの列、
 * 単元の札と状態の印（色だけにしない: まだ＝白丸／とりくみちゅう＝半分ぬり／できた＝○／しっかり＝○＋星／ふくしゅう＝時計）。
 */
import { useEffect, useState } from 'react';
import { gradeOf, type Grade } from '../audience/audience';
import * as db from '../core/storage/index';
import { profileAudience, type UnitProgress } from '../core/types';
import { initialReview, unitMark, type UnitMark } from '../curriculum/review';
import { subjectDef, subjectName } from '../curriculum/subjects';
import type { StageId, SubjectId } from '../curriculum/types';
import { visibleUnits } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { ModeHeader } from '../ui/ModeHeader';
import { useApp } from './AppState';
import { navigate } from './router';
import './subject-map.css';

const MARK_LABEL: Record<UnitMark, string> = {
  'not-started': 'まだ',
  'in-progress': 'とりくみちゅう',
  done: 'できた',
  secured: 'しっかり できた',
  'review-due': 'ふくしゅう',
};

export function MarkIcon({ mark }: { mark: UnitMark }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`umark umark--${mark}`}
      role="img"
      aria-label={MARK_LABEL[mark]}
    >
      {mark === 'review-due' ? (
        <>
          <circle cx="12" cy="12" r="9" className="umark__ring" />
          <path d="M12 7 V12 L16 14" className="umark__hand" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" className="umark__ring" />
          {mark === 'in-progress' ? (
            <path d="M12 3 A9 9 0 0 0 12 21 Z" className="umark__fill" />
          ) : null}
          {mark === 'done' || mark === 'secured' ? (
            <circle cx="12" cy="12" r="5" className="umark__inner" />
          ) : null}
          {mark === 'secured' ? (
            <path
              d="M19 1 L20.5 4.5 L24 5 L21.3 7.3 L22 11 L19 9 L16 11 L16.7 7.3 L14 5 L17.5 4.5 Z"
              className="umark__star"
            />
          ) : null}
        </>
      )}
    </svg>
  );
}

export function SubjectMap({ subject, grade: gradeParam }: { subject: string; grade?: string }) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const def = subjectDef(subject);
  const learner = profile.enrolledGrade ?? gradeOf(profileAudience(profile));
  const grades = def?.grades ?? [];
  const fallback = (grades.includes(learner as Grade) ? learner : grades[0]) ?? 1;
  const grade = gradeParam ? Number(gradeParam.slice(1)) : fallback;
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
  if (!def) return null;
  const ctx = { furigana: settings.support.furigana, learnerGrade: learner };
  const units = visibleUnits(
    { subject: subject as SubjectId, stage: `g${grade}` as StageId },
    settings.unitsOpened,
  );
  const now = Date.now();
  const markOf = (id: string) =>
    unitMark(progress.find((p) => p.unitId === id)?.review ?? initialReview, now);
  const known = new Set(def.domains.map((d) => d.id));
  const columns = [
    ...def.domains.map((d) => ({ ...d, units: units.filter((u) => u.domain === d.id) })),
    { id: 'other', name: 'そのほか', units: units.filter((u) => !known.has(u.domain)) },
  ].filter((c) => c.units.length > 0);

  return (
    <div
      className="screen subject-map"
      data-testid={`subject-map-${subject}`}
      style={{ ['--subj' as string]: def.color }}
    >
      <ModeHeader
        promptText=""
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => undefined}
        canListen={false}
      />
      <div className="smap-title">
        <Illust id={def.icon} className="smap-title__illust" decorative />
        <span>
          <Rt text={subjectName(def, learner)} ctx={ctx} />
        </span>
      </div>
      <div className="smap-tabs" role="tablist" aria-label="がくねん">
        {grades.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === grade}
            className={`smap-tab ${g === grade ? 'is-current' : ''}`}
            onClick={() =>
              navigate({ name: 'subject', subject, grade: `g${g}` }, { replace: true, force: true })
            }
            data-testid={`grade-tab-${g}`}
          >
            {g}ねん
          </button>
        ))}
      </div>
      <div className="smap-columns">
        {columns.length === 0 ? (
          <p className="label-text smap-empty" data-testid="smap-empty">
            この がくねんの たんげんは じゅんびちゅう だよ
          </p>
        ) : null}
        {columns.map((c) => (
          <section key={c.id} className="smap-col">
            <p className="smap-col__name">{c.name}</p>
            {c.units.map((u) => {
              const mark = markOf(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className="smap-unit"
                  aria-label={`${plainText(u.title)} ${MARK_LABEL[mark]}`}
                  onClick={() => navigate({ name: 'unit', unitId: u.id })}
                  data-testid={`unit-card-${u.id}`}
                  data-mark={mark}
                >
                  <Illust id={u.icon} className="smap-unit__illust" decorative />
                  <span className="smap-unit__title">
                    <Rt text={u.title} ctx={ctx} />
                  </span>
                  <MarkIcon mark={mark} />
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
