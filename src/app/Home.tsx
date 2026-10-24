import { useEffect, useState } from 'react';
import { audio } from '../core/audio/index';
import { MODE_DOMAIN, recommend, type Recommendation } from '../core/progress/recommend';
import * as db from '../core/storage/index';
import type { ModeId } from '../core/types';
import { Illust } from '../illust/Illust';
import { MODES, SKILLS } from '../modes/registry';
import { useApp } from './AppState';
import { ParentGateButton } from './ParentGate';
import { navigate } from './router';
import './home.css';

void MODE_DOMAIN;

function todayInfo() {
  const d = new Date();
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    todayStart: start.getTime(),
  };
}

/** 名前を意味の切れ目で2行に（DESINGN.md 5.2） */
function TwoLine({ text, className = 'home-card__name' }: { text: string; className?: string }) {
  const [a, ...rest] = text.split(' ');
  return (
    <span className={className}>
      {a}
      {rest.length ? <br /> : null}
      {rest.join('')}
    </span>
  );
}

/**
 * ホーム（DESINGN.md 5.2）。左に全9モードの 3×3（位置は固定）、右に きょうの おすすめ。
 * 「すき」はハートの印だけで、並びは変えない。
 */
export function Home() {
  const app = useApp();
  const profile = app.profile;
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (!profile || !app.settings) return;
    let alive = true;
    void (async () => {
      const { today, todayStart } = todayInfo();
      const rounds = await db.listRounds(profile.id, { since: todayStart - 30 * 86400000 });
      const progress = await db.listProgress(profile.id);
      const inProgress = progress
        .filter((p) => p.window.length >= 5 && p.level < SKILLS[p.skillId].levels.length - 1)
        .map((p) => SKILLS[p.skillId].modeId);
      const r = recommend({
        today,
        todayStart,
        favorites: app.favorites,
        rounds,
        inProgress,
        visible:
          app.settings!.homeDisplay === 'all' ? MODES.map((m) => m.id) : app.settings!.visibleModes,
      });
      if (alive) setRecs(r);
    })();
    return () => {
      alive = false;
    };
  }, [profile, app.settings, app.favorites]);

  if (!profile || !app.settings) return null;
  const visible = (m: ModeId) =>
    app.settings!.homeDisplay === 'all' || app.settings!.visibleModes.includes(m);

  const open = (m: ModeId) => {
    void audio.play(MODES.find((x) => x.id === m)!.titleVoice);
    navigate({ name: 'mode', modeId: m });
  };

  return (
    <div className="screen home" data-testid="home">
      <div className="home-top">
        <div className="home-profile">
          <Illust id={profile.avatar} className="home-profile__avatar" decorative />
          <span className="label-text">{profile.name}</span>
        </div>
        <ParentGateButton />
      </div>
      <div className="home-grid" role="list" aria-label="ぜんぶの あそび">
        {MODES.map((m) =>
          visible(m.id) ? (
            <button
              key={m.id}
              type="button"
              role="listitem"
              className="home-card"
              aria-label={m.title.replace(' ', '')}
              onClick={() => open(m.id)}
              data-testid={`home-mode-${m.id}`}
            >
              <Illust id={m.icon} className="home-card__illust" decorative />
              <TwoLine text={m.title} />
              {app.favorites.includes(m.id) ? (
                <Illust id="heart-on" className="home-card__heart" label="すき" />
              ) : null}
            </button>
          ) : (
            <div key={m.id} className="home-card home-card--empty" aria-hidden />
          ),
        )}
      </div>
      <aside className="home-side">
        <p className="label-text home-side__title">きょうの おすすめ</p>
        {recs.map((r) => {
          const m = MODES.find((x) => x.id === r.modeId)!;
          return (
            <button
              key={r.modeId}
              type="button"
              className="home-rec"
              aria-label={`おすすめ ${m.title.replace(' ', '')}`}
              onClick={() => open(r.modeId)}
              data-testid={`home-rec-${r.modeId}`}
            >
              <Illust id={m.icon} className="home-rec__illust" decorative />
              <TwoLine text={m.title} className="home-rec__name" />
            </button>
          );
        })}
        <button
          type="button"
          className="home-rec home-rec--note"
          aria-label="がんばりノート"
          onClick={() => {
            void audio.play('app.notebook');
            navigate({ name: 'notebook' });
          }}
          data-testid="home-notebook"
        >
          <Illust id="notebook" className="home-rec__illust" decorative />
          <TwoLine text="がんばり ノート" className="home-rec__name" />
        </button>
      </aside>
    </div>
  );
}
