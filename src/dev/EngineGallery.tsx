/**
 * 開発用: 全エンジンの見本の問題（src/engines/<id>/<id>.samples.ts）を、単元と同じ画面（UnitRound）で動かす。
 * `npm run dev` で #/dev/engines を開く。本番ビルドには入らない（App.tsx が import.meta.env.DEV のときだけ使う）。
 */
import { useState } from 'react';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { emptyUnitProgress } from '../core/storage/index';
import type { Item, UnitSpec } from '../curriculum/types';
import { UnitRound } from '../units/UnitRunner';

const modules = import.meta.glob<Record<string, unknown>>('../engines/*/*.samples.ts', {
  eager: true,
});

/** 見本のファイルから、問題の配列を取り出す（export 名はエンジンごとに違う） */
function samplesOf(mod: Record<string, unknown>): Item[] {
  for (const v of Object.values(mod)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] && 'engine' in v[0])
      return v as Item[];
  }
  return [];
}

const SAMPLES: { engine: string; items: Item[] }[] = Object.entries(modules)
  .map(([path, mod]) => ({
    engine: /engines\/([^/]+)\//.exec(path)?.[1] ?? path,
    items: samplesOf(mod),
  }))
  .filter((x) => x.items.length > 0)
  .sort((a, b) => a.engine.localeCompare(b.engine));

function specFor(engine: string, items: Item[]): UnitSpec {
  // 見本はすべて段階0・ヒントの数もそのまま出す
  return {
    id: `g1.math.dev-${engine}`,
    title: `みほん: ${engine}`,
    stage: 'g1',
    subject: 'math',
    domain: 'dev',
    kind: 'concept',
    priority: 'P2',
    status: 'planned',
    icon: 'look',
    prereq: [],
    objectives: [...new Set(items.map((i) => i.objective))].map((id) => ({ id, title: id })),
    misconceptions: [],
    levels: [{ label: 'みほん', chance: 0 }],
    intro: [],
    source: { kind: 'items', items: items.map((i) => ({ ...i, level: 0 })) },
    review: 'none',
    roundSize: items.length,
    basis: '開発用',
    revised: '2026-10-24',
  };
}

export function EngineGallery() {
  const app = useApp();
  const [engine, setEngine] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  if (!app.profile || !app.settings) return null;
  if (engine) {
    const s = SAMPLES.find((x) => x.engine === engine)!;
    return (
      <UnitRound
        key={`${engine}-${key}`}
        unit={specFor(engine, s.items)}
        packId="dev"
        progress={{
          ...emptyUnitProgress(app.profile.id, `g1.math.dev-${engine}`),
          attempted: true,
        }}
        review={false}
        resume={null}
        settings={app.settings}
        profile={app.profile}
        onAgain={() => setKey((k) => k + 1)}
        onHome={() => setEngine(null)}
      />
    );
  }
  return (
    <div
      className="screen"
      data-testid="engine-gallery"
      style={{ padding: 'calc(var(--u) * 3)', overflow: 'auto' }}
    >
      <p className="label-text">エンジンの みほん（開発用）</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 'calc(var(--u) * 1.6)' }}>
        {SAMPLES.map((s) => (
          <button
            key={s.engine}
            type="button"
            className="tap tap--wood"
            onClick={() => setEngine(s.engine)}
            data-testid={`dev-engine-${s.engine}`}
          >
            {s.engine}（{s.items.length}）
          </button>
        ))}
        <button type="button" className="tap tap--white" onClick={() => navigate({ name: 'home' })}>
          おうち
        </button>
      </div>
    </div>
  );
}
