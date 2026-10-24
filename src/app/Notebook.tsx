import { useEffect, useState } from 'react';
import * as db from '../core/storage/index';
import type { ModeId, WorkRecord } from '../core/types';
import { Illust } from '../illust/Illust';
import { MODE_BY_ID } from '../modes/registry';
import { WorkThumb } from '../modes/workThumb';
import { ModeHeader } from '../ui/ModeHeader';
import { audio } from '../core/audio/index';
import { unitMeta } from '../curriculum/unitIndex';
import { plainText } from '../text/rich';
import { useApp } from './AppState';
import { navigate } from './router';
import './notebook.css';

interface Day {
  date: string;
  label: string;
  modes: ModeId[];
  /** 単元の回（単元ID） */
  units: string[];
  works: WorkRecord[];
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/**
 * がんばりノート（learning-design.md 11章）。遊んだ日だけを新しい順に並べる。
 * 数値・回数は出さない（同じ日の同じモードは1つにまとめる）。
 */
export function Notebook() {
  const app = useApp();
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    if (!app.profile) return;
    const pid = app.profile.id;
    void (async () => {
      const [rounds, works] = await Promise.all([db.listRounds(pid), db.listWorks(pid)]);
      const map = new Map<string, Day>();
      const get = (t: number) => {
        const k = dayKey(t);
        let d = map.get(k);
        if (!d) {
          const dt = new Date(t);
          d = {
            date: k,
            label: `${dt.getMonth() + 1}がつ ${dt.getDate()}にち`,
            modes: [],
            units: [],
            works: [],
          };
          map.set(k, d);
        }
        return d;
      };
      for (const r of rounds) {
        if (r.count === 0) continue;
        const d = get(r.startedAt);
        if (r.modeId === 'unit') {
          if (r.unitId && unitMeta(r.unitId) && !d.units.includes(r.unitId)) d.units.push(r.unitId);
        } else if (!d.modes.includes(r.modeId)) d.modes.push(r.modeId);
      }
      for (const w of works) {
        if ((w.data as { draft?: boolean } | null)?.draft) continue;
        get(w.createdAt).works.push(w);
      }
      const sorted = [...map.values()].sort((a, b) => {
        const ta = rounds.find((r) => dayKey(r.startedAt) === a.date)?.startedAt ?? 0;
        const tb = rounds.find((r) => dayKey(r.startedAt) === b.date)?.startedAt ?? 0;
        return tb - ta;
      });
      setDays(sorted.slice(0, 30));
    })();
  }, [app.profile]);

  return (
    <div className="screen" data-testid="notebook">
      <ModeHeader
        promptText="がんばりノート"
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => void audio.play('app.notebook')}
        canListen
      />
      <div className="notebook" style={{ top: 'calc(var(--u) * 8)' }}>
        {days && days.length === 0 ? (
          <p className="label-text" style={{ textAlign: 'center' }}>
            あそぶと ここに のこるよ
          </p>
        ) : null}
        {days?.map((d) => (
          <section key={d.date} className="notebook-day">
            <p className="notebook-day__date">{d.label}</p>
            <div className="notebook-day__items">
              {d.modes.map((m) => (
                <Illust
                  key={m}
                  id={MODE_BY_ID[m].icon}
                  className="notebook-day__mode"
                  label={MODE_BY_ID[m].title}
                />
              ))}
              {d.units.map((u) => {
                const m = unitMeta(u)!;
                return (
                  <Illust
                    key={u}
                    id={m.icon}
                    className="notebook-day__mode"
                    label={plainText(m.title)}
                  />
                );
              })}
              {d.works.slice(0, 6).map((w) => (
                <div key={w.id} className="notebook-day__work">
                  <WorkThumb work={w} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
