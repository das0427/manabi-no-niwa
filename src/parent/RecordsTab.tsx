/**
 * 保護者画面「きろく」。
 * - 2歳段階（recordMastery=false の区分）は「あそんだ内容」だけを見せ、正誤・ヒント数・「むずかしそう」を
 *   出さない（architecture.md 2章、review-1 #8）。
 * - 1.0 からある9つのあそび（旧モードID）の記録は「まえの きろく」で閲覧のみ（変換しない。acceptance A-06、
 *   curriculum-matrix.md 4.1）。
 */
import { useCallback } from 'react';
import { useApp } from '../app/AppState';
import { audienceUx } from '../audience/audience';
import { explainProgress, looksHard } from '../core/progress/rules';
import { recommend } from '../core/progress/recommend';
import * as db from '../core/storage/index';
import {
  SKILL_IDS,
  profileAudience,
  type AttemptRecord,
  type ModeId,
  type RecordModeId,
  type SkillProgress,
} from '../core/types';
import { MODES, SKILLS } from '../modes/registry';
import { Note, Section } from './ui';
import {
  OUTCOME_LABEL,
  formatDate,
  formatDateTime,
  modeTitle,
  startOfToday,
  todayString,
  useLoad,
} from './util';

const DAY = 86_400_000;

function levelCode(a: AttemptRecord): string {
  if (!a.skillId) return '-';
  return SKILLS[a.skillId].levels[a.level]?.code ?? '-';
}

/** あそびごとのまとめ（単元は unitId ごと、旧モードはモードごと） */
interface PlaySummary {
  modeId: RecordModeId;
  unitId?: string;
  n: number;
  first: number;
  last: number;
}

/** 記録をあそびごとにまとめる（最後に遊んだ順） */
export function summarizePlay(attempts: readonly AttemptRecord[]): PlaySummary[] {
  const m = new Map<string, PlaySummary>();
  for (const a of attempts) {
    const k = a.modeId === 'unit' ? `unit\u0000${a.unitId ?? ''}` : a.modeId;
    const cur = m.get(k);
    if (!cur) {
      m.set(k, { modeId: a.modeId, unitId: a.unitId, n: 1, first: a.at, last: a.at });
    } else {
      cur.n += 1;
      cur.first = Math.min(cur.first, a.at);
      cur.last = Math.max(cur.last, a.at);
    }
  }
  return [...m.values()].sort((a, b) => b.last - a.last);
}

/** 1.0 からある9つのあそび（旧モードID）の記録か */
export function isLegacyRecord(a: Pick<AttemptRecord, 'modeId'>): boolean {
  return a.modeId !== 'unit';
}

function PlaySummaryTable({ rows, testId }: { rows: PlaySummary[]; testId: string }) {
  return (
    <table className="p-table" data-testid={testId}>
      <thead>
        <tr>
          <th>あそび</th>
          <th>取り組んだ数</th>
          <th>はじめて</th>
          <th>さいごに</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.modeId}-${r.unitId ?? ''}`} data-testid={`${testId}-row`}>
            <td>{modeTitle(r.modeId, r.unitId)}</td>
            <td>{r.n}</td>
            <td>{formatDate(r.first)}</td>
            <td>{formatDate(r.last)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const LEGACY_ROWS = 300;

/**
 * まえの きろく（1.0 からある9つのあそびの記録。閲覧のみ）。
 * playOnly（2歳段階）のときは、あそびごとの回数と日付だけを出し、正誤・ヒント数・段階は出さない。
 */
function LegacyRecords({
  attempts,
  progress,
  playOnly,
}: {
  attempts: AttemptRecord[];
  progress: SkillProgress[];
  playOnly: boolean;
}) {
  const old = attempts.filter((a) => isLegacyRecord(a) && !a.operationIssue);
  const keptProgress = progress.filter((p) => p.attempted).length;
  return (
    <Section title="まえの きろく（1.0 からの 9つの あそび）" id="legacy-records">
      <Note>
        1.0 からある9つのあそび（おかいものごっこ・ひらがな・さんすう
        など）の記録です。1.0で遊んだ記録は消さず、変換もしていません。ここでは見るだけで、変更はできません。新しい単元の進み具合には入れていません。いまのホームにある同じあそびの札で遊んだ記録も、ここに入ります。
      </Note>
      {old.length === 0 && keptProgress === 0 ? (
        <p className="p-muted" data-testid="legacy-empty">
          ありません。
        </p>
      ) : (
        <>
          {playOnly ? null : (
            <p className="p-small" data-testid="legacy-progress-count">
              段階の記録が残っているスキル: {keptProgress}
              （段階と直近の結果は、上の「スキルごとの様子」に出ています）
            </p>
          )}
          {old.length > 0 ? (
            <PlaySummaryTable rows={summarizePlay(old)} testId="legacy-summary" />
          ) : null}
          {old.length > 0 && !playOnly ? (
            <details className="p-details" data-testid="legacy-detail">
              <summary>
                1問ごとの記録を見る（新しい順に {Math.min(old.length, LEGACY_ROWS)} 件）
              </summary>
              <table className="p-table" data-testid="legacy-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>あそび</th>
                    <th>段階</th>
                    <th>問題</th>
                    <th>結果</th>
                    <th>ヒント</th>
                  </tr>
                </thead>
                <tbody>
                  {old.slice(0, LEGACY_ROWS).map((a, i) => (
                    <tr key={a.id ?? i}>
                      <td>{formatDateTime(a.at)}</td>
                      <td>{modeTitle(a.modeId, a.unitId)}</td>
                      <td>{levelCode(a)}</td>
                      <td>{a.itemKey}</td>
                      <td>{OUTCOME_LABEL[a.outcome]}</td>
                      <td>{a.hintsUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </>
      )}
    </Section>
  );
}

/** 2歳段階: あそんだ内容だけ（正誤・ヒント数・「むずかしそう」・とまどいの記録を出さない） */
function PlayOnlyRecords({ attempts }: { attempts: AttemptRecord[] }) {
  const played = attempts.filter((a) => !a.operationIssue);
  return (
    <>
      <Section title="あそんだ内容" id="play-summary">
        <Note>
          2歳の段階では、正誤・ヒントの数・「むずかしそう」は表示しません。どのあそびで、どんな内容に触れたかだけを表示します。段階は自動では変わりません（「せってい」で決めます）。
        </Note>
        {played.length === 0 ? (
          <p className="p-muted" data-testid="play-empty">
            まだ記録がありません。
          </p>
        ) : (
          <PlaySummaryTable rows={summarizePlay(played)} testId="play-table" />
        )}
      </Section>
      {played.length === 0 ? null : (
        <Section title="さいきん あそんだもの" id="play-recent">
          <table className="p-table" data-testid="play-recent-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>あそび</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {played.slice(0, 50).map((a, i) => (
                <tr key={a.id ?? i}>
                  <td>{formatDateTime(a.at)}</td>
                  <td>{modeTitle(a.modeId, a.unitId)}</td>
                  <td>{a.itemKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

export function RecordsTab() {
  const app = useApp();
  const profile = app.profile;
  const settings = app.settings;
  const favorites = app.favorites;
  const pid = profile?.id ?? '';
  const load = useCallback(async () => {
    const todayStart = startOfToday();
    const [attempts, progress, rounds] = await Promise.all([
      db.listAttempts(pid, { limit: 2000 }),
      db.listProgress(pid),
      db.listRounds(pid, { since: todayStart - 30 * DAY }),
    ]);
    return { attempts, progress, rounds, todayStart };
  }, [pid]);
  const { data } = useLoad(load);
  if (!profile || !settings) return null;
  if (!data) return <p>読み込み中…</p>;

  const { attempts, progress, rounds, todayStart } = data;
  // 2歳段階（進度の判定をしない区分）は「あそんだ内容」だけ
  const playOnly = !audienceUx(profileAudience(profile), profile.toddlerStage ?? 3).recordMastery;
  const byskill = new Map<string, SkillProgress>(progress.map((p) => [p.skillId, p]));
  const learning = attempts.filter((a) => !a.operationIssue);
  const issues = attempts.filter((a) => a.operationIssue);

  // 今日の利用時間
  const todayRounds = rounds.filter((r) => r.startedAt >= todayStart);
  const todayMs = todayRounds.reduce((s, r) => s + Math.max(0, r.endedAt - r.startedAt), 0);
  const todayMin = Math.round(todayMs / 60_000);

  // きょうの おすすめ（ホームと同じ規則）
  const inProgress = progress
    .filter((p) => p.window.length >= 5 && p.level < SKILLS[p.skillId].levels.length - 1)
    .map((p) => SKILLS[p.skillId].modeId);
  const recs = recommend({
    today: todayString(),
    todayStart,
    favorites,
    rounds,
    inProgress,
    visible: settings.homeDisplay === 'all' ? MODES.map((m) => m.id) : settings.visibleModes,
  });

  // むずかしそうな問題（3回以上取り組んで自力0）
  const items = new Map<
    string,
    { modeId: ModeId | 'unit'; unitId?: string; itemKey: string; n: number; ind: number }
  >();
  for (const a of learning) {
    if (a.outcome === 'abandoned') continue;
    const k = `${a.modeId}\u0000${a.unitId ?? ''}\u0000${a.itemKey}`;
    const cur = items.get(k) ?? {
      modeId: a.modeId,
      unitId: a.unitId,
      itemKey: a.itemKey,
      n: 0,
      ind: 0,
    };
    cur.n += 1;
    if (a.outcome === 'independent') cur.ind += 1;
    items.set(k, cur);
  }
  const hardItems = [...items.values()].filter((x) => x.n >= 3 && x.ind === 0);

  return (
    <div data-testid="tab-records">
      <Note>
        この記録は遊んだ内容の記録で、能力の測定ではありません。点数や順位をつけるためのものではなく、お子さんの様子を知り、声かけや遊び方を考える材料としてお使いください。
      </Note>

      <Section title="今日の利用">
        <p data-testid="today-usage">
          今日の利用時間: 約 {todayMin} 分（{todayRounds.length} 回）
          {settings.sessionMinutes > 0 ? ` ／ 目安 ${settings.sessionMinutes} 分` : ''}
        </p>
        {playOnly ? null : (
          <>
            <h3>きょうの おすすめ（ホームに出ているもの）</h3>
            <ul data-testid="recommendations">
              {recs.map((r) => (
                <li key={r.modeId}>
                  {modeTitle(r.modeId)}&emsp;<span className="p-muted">理由: {r.reason}</span>
                </li>
              ))}
              {recs.length === 0 ? <li className="p-muted">おすすめはありません</li> : null}
            </ul>
          </>
        )}
      </Section>

      {playOnly ? (
        <>
          <PlayOnlyRecords attempts={attempts} />
          <LegacyRecords attempts={attempts} progress={progress} playOnly />
        </>
      ) : (
        <>
          <Section title="スキルごとの様子">
            <Note>
              「直近」は、いまの段階での直近10問までの結果です。「もういちど」はヒント1の後に自分で選び直して正解、「ヒント後」は具体的なヒントの後に正解、「見直し後」は見直し機能を使って正解した数です。
            </Note>
            <table className="p-table" data-testid="skill-table">
              <thead>
                <tr>
                  <th>スキル</th>
                  <th>状態・段階</th>
                  <th>自力</th>
                  <th>もういちど</th>
                  <th>ヒント後</th>
                  <th>見直し後</th>
                  <th>スキップ</th>
                  <th>説明</th>
                </tr>
              </thead>
              <tbody>
                {SKILL_IDS.map((id) => {
                  const def = SKILLS[id];
                  const p = byskill.get(id);
                  const lv = def.levels[p?.level ?? 0] ?? def.levels[0];
                  if (!lv) return null;
                  const label = `${lv.code} ${lv.label}`;
                  if (!p || !p.attempted) {
                    return (
                      <tr key={id} data-testid={`skill-${id}`} data-state="not-started">
                        <td>{def.label}</td>
                        <td>
                          <span className="p-badge p-badge--idle">まだ取り組んでいません</span>
                        </td>
                        <td colSpan={5} className="p-muted">
                          -
                        </td>
                        <td className="p-muted">
                          {explainProgress(
                            p ?? {
                              profileId: pid,
                              skillId: id,
                              level: 0,
                              window: [],
                              mastered: false,
                              attempted: false,
                              changedAt: 0,
                              lastChange: null,
                            },
                            def.levels.length,
                            label,
                          )}
                        </td>
                      </tr>
                    );
                  }
                  const w = p.window;
                  const cnt = (...k: string[]) => w.filter((o) => k.includes(o)).length;
                  const hard = looksHard(p);
                  return (
                    <tr key={id} data-testid={`skill-${id}`} data-state={hard ? 'hard' : 'active'}>
                      <td>{def.label}</td>
                      <td>
                        {lv.code}（{lv.label}）
                        {hard ? (
                          <span className="p-badge p-badge--hard" data-testid={`hard-${id}`}>
                            むずかしそう
                          </span>
                        ) : null}
                      </td>
                      <td>{cnt('independent')}</td>
                      <td>{cnt('self_corrected')}</td>
                      <td>{cnt('after_hint')}</td>
                      <td>{cnt('after_review')}</td>
                      <td>{cnt('skipped')}</td>
                      <td className="p-small">
                        {explainProgress(
                          p,
                          def.levels.length,
                          label,
                          settings.levelLocks[id],
                          lv.chance,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <Section title="むずかしそうな問題">
            <Note>
              同じ問題に3回以上取り組んで、自力でできたのが0回のものです（未実施の問題は含みません）。
            </Note>
            {hardItems.length === 0 ? (
              <p className="p-muted" data-testid="hard-items-empty">
                いまのところありません。
              </p>
            ) : (
              <table className="p-table" data-testid="hard-items">
                <thead>
                  <tr>
                    <th>モード</th>
                    <th>問題</th>
                    <th>取り組んだ回数</th>
                  </tr>
                </thead>
                <tbody>
                  {hardItems.map((x) => (
                    <tr key={`${x.modeId}-${x.itemKey}`}>
                      <td>{modeTitle(x.modeId, x.unitId)}</td>
                      <td>{x.itemKey}</td>
                      <td>{x.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="最近の記録">
            {learning.length === 0 ? (
              <p className="p-muted">まだ記録がありません。</p>
            ) : (
              <table className="p-table" data-testid="recent-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>モード</th>
                    <th>段階</th>
                    <th>問題</th>
                    <th>結果</th>
                    <th>ヒント</th>
                  </tr>
                </thead>
                <tbody>
                  {learning.slice(0, 50).map((a, i) => (
                    <tr key={a.id ?? i}>
                      <td>{formatDateTime(a.at)}</td>
                      <td>{modeTitle(a.modeId, a.unitId)}</td>
                      <td>{levelCode(a)}</td>
                      <td>{a.itemKey}</td>
                      <td>{OUTCOME_LABEL[a.outcome]}</td>
                      <td>{a.hintsUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="そうさに とまどったかもしれない記録">
            <Note>
              画面の外をたくさん押した、線が途中で途切れたなど、遊び方の難しさかもしれない記録です。学力とは別に扱い、段階の判断にも使いません。
            </Note>
            {issues.length === 0 ? (
              <p className="p-muted" data-testid="issues-empty">
                ありません。
              </p>
            ) : (
              <table className="p-table" data-testid="issues-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>モード</th>
                    <th>問題</th>
                    <th>入力</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, 30).map((a, i) => (
                    <tr key={a.id ?? i}>
                      <td>{formatDateTime(a.at)}</td>
                      <td>{modeTitle(a.modeId, a.unitId)}</td>
                      <td>{a.itemKey}</td>
                      <td>
                        {
                          { touch: '指', pen: 'ペン', mouse: 'マウス', unknown: '不明' }[
                            a.inputKind
                          ]
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <LegacyRecords attempts={attempts} progress={progress} playOnly={false} />
        </>
      )}
    </div>
  );
}
