/**
 * 開発用: 単元の見本の問題（qa.ts の sampleItems）を1問だけ、本物の単元の画面（UnitRound）で出す。
 * 文字の配置の検査（e2e/text-layout.spec.ts、npm run check:text-layout）と、報告された画面の再現に使う。
 *
 *   #/dev/unit/<unitId>            … 見本の問題の一覧（件数を data-count に出す）
 *   #/dev/unit/<unitId>/<n>        … n 番目（0 から）の問題
 *   #/dev/unit/<unitId>/<n>?state=h2&seeds=2
 *
 * query:
 *   - state: q（問題。既定）/ h1・h2・h3（ヒントをその段まで出す）/ explain（つぎへ を押した後の解説）
 *   - seeds: 生成器の単元で、段階ごとに作る seed の数（既定 2。検査と同じ値にする）
 *   - aud:   区分（toddler / p4 / p5 / g1〜g6）。既定は単元の段階（p23 は 3歳段階）
 *   - ts:    文字の大きさの設定（1 / 1.15 / 1.3）、furi: ふりがな（unlearned / all / none）
 *
 * 読み上げはしない（readAloud: 'off'。「もういちど きく」は押せない形で同じ位置に出る）。
 * 記録は開発用のプロフィール ID（dev-text-layout）に書く。今のプロフィールの記録は変えない。
 * 本番ビルドには入らない（App.tsx が import.meta.env.DEV のときだけ import する）。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AUDIENCE_IDS,
  defaultSupport,
  gradeOf,
  type AudienceId,
  type SupportSettings,
} from '../audience/audience';
import { useApp } from '../app/AppState';
import { audio } from '../core/audio/index';
import { emptyUnitProgress } from '../core/storage/index';
import type { Profile } from '../core/types';
import { sampleItems } from '../curriculum/qa';
import type { Item, UnitSpec } from '../curriculum/types';
import { unitMeta } from '../curriculum/unitIndex';
import { loadPack } from '../packs/loader';
import { UnitRound } from '../units/UnitRunner';

const DEV_PROFILE_ID = 'dev-text-layout';

/** 見本の1問の情報（検査が window.__mnwDevUnit から読む） */
export interface DevUnitInfo {
  unitId: string;
  stage: string;
  kind: string;
  count: number;
  items: { level: number; engine: string; hints: number; identity: string }[];
}

declare global {
  interface Window {
    __mnwDevUnit?: DevUnitInfo & { ready?: string };
  }
}

function audienceOf(stage: string): AudienceId {
  if (stage === 'p23') return 'toddler';
  return (AUDIENCE_IDS as readonly string[]).includes(stage) ? (stage as AudienceId) : 'p4';
}

type State = 'q' | 'h1' | 'h2' | 'h3' | 'explain';

function parseState(s: string | null): State {
  return s === 'h1' || s === 'h2' || s === 'h3' || s === 'explain' ? s : 'q';
}

export function UnitSampleView({
  unitId,
  n,
  query,
}: {
  unitId: string;
  n?: number;
  query: string;
}) {
  const app = useApp();
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const seeds = Math.max(1, Math.min(50, Number(params.get('seeds') ?? 2) || 2));
  const [unit, setUnit] = useState<UnitSpec | null | 'missing'>(null);

  useEffect(() => {
    let alive = true;
    const meta = unitMeta(unitId);
    if (!meta) {
      setUnit('missing');
      return;
    }
    void loadPack(meta.pack).then((p) => {
      if (alive) setUnit(p.units.find((u) => u.id === unitId) ?? 'missing');
    });
    return () => {
      alive = false;
    };
  }, [unitId]);

  const items: Item[] = useMemo(
    () => (unit && unit !== 'missing' ? sampleItems(unit, seeds) : []),
    [unit, seeds],
  );

  useEffect(() => {
    if (!unit || unit === 'missing') return;
    window.__mnwDevUnit = {
      unitId,
      stage: unit.stage,
      kind: unit.source.kind,
      count: items.length,
      items: items.map((it) => ({
        level: it.level,
        engine: it.engine,
        hints: it.hints.length,
        identity: it.identity,
      })),
    };
  }, [unit, unitId, items]);

  if (!app.profile || !app.settings) return null;
  if (unit === null) return <div className="screen" data-testid="dev-unit-loading" />;
  if (unit === 'missing' || unit.source.kind === 'legacy')
    return (
      <div className="screen" data-testid="dev-unit-missing">
        <p className="label-text">
          {unit === 'missing'
            ? 'この たんげんは ないよ'
            : 'v1 の モードの たんげん（たいしょうがい）'}
        </p>
      </div>
    );

  if (n === undefined || !items[n])
    return (
      <div
        className="screen"
        data-testid="dev-unit-index"
        data-count={items.length}
        style={{ padding: 'calc(var(--u) * 3)', overflow: 'auto' }}
      >
        <p className="label-text">
          {unitId}（見本 {items.length}問。seeds={seeds}）
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'calc(var(--u) * 0.8)' }}>
          {items.map((it, i) => (
            <a key={i} href={`#/dev/unit/${unitId}/${i}${query ? `?${query}` : ''}`}>
              {i}:{it.engine}/L{it.level}
            </a>
          ))}
        </div>
      </div>
    );

  const aud = (AUDIENCE_IDS as readonly string[]).includes(params.get('aud') ?? '')
    ? (params.get('aud') as AudienceId)
    : audienceOf(unit.stage);
  const ts = Number(params.get('ts'));
  const furi = params.get('furi');
  const support: SupportSettings = {
    ...defaultSupport(aud),
    readAloud: 'off',
    ...(ts === 1.15 || ts === 1.3 ? { textScale: ts } : {}),
    ...(furi === 'all' || furi === 'none' || furi === 'unlearned' ? { furigana: furi } : {}),
  };
  const grade = gradeOf(aud);
  const profile: Profile = {
    ...app.profile,
    id: DEV_PROFILE_ID,
    audience: aud,
    toddlerStage: 3,
    enrolledGrade: grade === 0 ? null : grade,
  };
  const item = items[n];
  const spec: UnitSpec = {
    ...unit,
    // 1問だけの回（導入は出さない・段階0 として出す）
    intro: [],
    levels: [unit.levels[item.level] ?? { label: '見本', chance: 0 }],
    source: { kind: 'items', items: [{ ...item, level: 0 }] },
    roundSize: 1,
  };
  return (
    <>
      <UnitRound
        unit={spec}
        packId={unitMeta(unitId)!.pack}
        progress={{ ...emptyUnitProgress(DEV_PROFILE_ID, unit.id), attempted: true }}
        review={false}
        resume={null}
        settings={{ ...app.settings, profileId: DEV_PROFILE_ID, support }}
        profile={profile}
        onAgain={() => undefined}
        onHome={() => undefined}
      />
      <StateDriver state={parseState(params.get('state'))} hints={item.hints.length} />
    </>
  );
}

/**
 * query の state のとおりに、ヒントの札（と つぎへ）を押して画面を進める。
 * 押し終わったら window.__mnwDevUnit.ready に state を書く（検査はこれを待つ）。
 */
function StateDriver({ state, hints }: { state: State; hints: number }) {
  useEffect(() => {
    const want = state === 'q' ? 0 : state === 'explain' ? hints : Number(state.slice(1));
    let alive = true;
    const click = (id: string) =>
      (document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null)?.click();
    void (async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      await frame();
      for (let i = 0; i < Math.min(want, hints) && alive; i++) {
        click('hint-button');
        await frame();
      }
      if (state === 'explain' && alive) {
        click('next-button');
        await frame();
      }
      audio.stop();
      if (alive && window.__mnwDevUnit) window.__mnwDevUnit.ready = state;
    })();
    return () => {
      alive = false;
    };
  }, [state, hints]);
  return null;
}
