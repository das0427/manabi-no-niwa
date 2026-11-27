/**
 * 小学生ホーム（ux-by-age 2.2）: 上に教科の札、右に きょうの おすすめ（復習を含む）・おえかき・がんばりノート。
 * 教科の札には「とりくみちゅう」の単元数を小さく出す（点数は出さない）。
 *
 * 札の名前・題は AppLabel（中身の段階で折る。text-layout-fixes「アプリの画面」A0・A3）。
 * おすすめの題は札（30u × 8.6u）に入るまで縮める（fit。下限は画面の --text-min）。
 * 「ふくしゅう」は題の中の字の札をやめ、絵の右下の時計の印（単元の地図と同じ MarkIcon）で示す。
 * 記録の保存に問題があるときは、鍵の左に保護者向けの「!」（v1 のホームと同じ。StorageHealthMark。FX16）。
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
import { plainText } from '../text/rich';
import { AppLabel } from '../ui/AppLabel';
import { useApp } from './AppState';
import { ParentGateButton } from './ParentGate';
import { navigate } from './router';
import { StorageHealthMark } from './StorageHealthMark';
import { MarkIcon } from './SubjectMap';
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
    () =>
      recommendUnits({
        index: UNIT_INDEX,
        progress,
        stage,
        now: Date.now(),
        opened: settings.unitsOpened,
      }),
    [progress, stage, settings.unitsOpened],
  );
  const ctx = { furigana: settings.support.furigana, learnerGrade: grade };
  const learningIn = (subject: string) =>
    progress.filter((p) => p.review.stage === 'learning' && unitMeta(p.unitId)?.subject === subject)
      .length;

  // data-stage: 学年の段階。app-label.css の --text-min（アプリの画面の補助の文字の最小）が効く。
  // --ts: 文字の大きさの設定。おすすめの題の縮め始め（fit の fromU）にかかる（AppLabel が読む）
  return (
    <div
      className="screen home school-home"
      data-testid="school-home"
      data-stage={stage}
      style={{ ['--ts' as string]: String(settings.support.textScale) }}
    >
      <div className="home-top">
        <div className="home-profile">
          <Illust id={profile.avatar} className="home-profile__avatar" decorative />
          <span className="label-text">{profile.name}</span>
        </div>
        <div className="home-top__right">
          <StorageHealthMark />
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
              <AppLabel text={name} stage={stage} ctx={ctx} className="school-subject__name" />
              {n > 0 ? (
                <span className="school-subject__count" aria-hidden>
                  <span className="school-subject__half" />
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
        {/* ほかの がくねん・きょうか（先取り・さかのぼり。教科は最大6つなので7枚目に入る） */}
        <button
          type="button"
          role="listitem"
          className="school-subject school-subject--explore"
          style={{ ['--subj' as string]: 'var(--paper-2)' }}
          aria-label="ほかの がくねん・きょうか"
          onClick={() => navigate({ name: 'explore' })}
          data-testid="home-explore"
        >
          <Illust id="explore" className="school-subject__illust" decorative />
          <span className="school-subject__name">
            ほかの
            <br />
            がくねん
          </span>
        </button>
      </div>
      <aside className="home-side">
        <p className="label-text home-side__title">きょうの おすすめ</p>
        {recs.map((r) => {
          const u = unitMeta(r.unitId)!;
          return (
            <button
              key={r.unitId}
              type="button"
              className="home-rec school-rec"
              aria-label={`おすすめ ${plainText(u.title)}${r.kind === 'review' ? ' ふくしゅう' : ''}`}
              onClick={() => navigate({ name: 'unit', unitId: r.unitId })}
              data-testid={`rec-${r.unitId}`}
            >
              <span className="school-rec__icon">
                <Illust id={u.icon} className="school-rec__illust" decorative />
                {r.kind === 'review' ? <MarkIcon mark="review-due" /> : null}
              </span>
              <AppLabel
                text={u.title}
                stage={u.stage}
                ctx={ctx}
                className="school-rec__name"
                fit={{ fromU: 2.6 }}
              />
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
