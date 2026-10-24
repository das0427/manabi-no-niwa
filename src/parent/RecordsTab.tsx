import { useCallback } from 'react';
import { useApp } from '../app/AppState';
import { explainProgress, looksHard } from '../core/progress/rules';
import { recommend } from '../core/progress/recommend';
import * as db from '../core/storage/index';
import { SKILL_IDS, type AttemptRecord, type ModeId, type SkillProgress } from '../core/types';
import { MODES, SKILLS } from '../modes/registry';
import { Note, Section } from './ui';
import {
  OUTCOME_LABEL,
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
  const items = new Map<string, { modeId: ModeId; itemKey: string; n: number; ind: number }>();
  for (const a of learning) {
    if (a.outcome === 'abandoned') continue;
    const k = `${a.modeId}\u0000${a.itemKey}`;
    const cur = items.get(k) ?? { modeId: a.modeId, itemKey: a.itemKey, n: 0, ind: 0 };
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
        <h3>きょうの おすすめ（ホームに出ているもの）</h3>
        <ul data-testid="recommendations">
          {recs.map((r) => (
            <li key={r.modeId}>
              {modeTitle(r.modeId)}&emsp;<span className="p-muted">理由: {r.reason}</span>
            </li>
          ))}
          {recs.length === 0 ? <li className="p-muted">おすすめはありません</li> : null}
        </ul>
      </Section>

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
                  <td>{modeTitle(x.modeId)}</td>
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
                  <td>{modeTitle(a.modeId)}</td>
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
                  <td>{modeTitle(a.modeId)}</td>
                  <td>{a.itemKey}</td>
                  <td>
                    {{ touch: '指', pen: 'ペン', mouse: 'マウス', unknown: '不明' }[a.inputKind]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
