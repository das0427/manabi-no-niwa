/**
 * 幼児ホーム（2〜3歳・4歳・5歳。ux-by-age 2.1）: 左に札の 3×3（位置は固定）、右に おえかき・がんばりノート。
 * 2歳段階は札4枚（2×2）・おすすめなし（review-1 #23）。保護者向けの案内は起動画面で出す。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import { MODE_IDS } from '../core/types';
import {
  recommendCards,
  type CardRec,
  type HomeCard,
  type PreschoolHomeDef,
} from '../curriculum/preschoolHome';
import { unitMeta } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { useApp } from './AppState';
import { ParentGateButton } from './ParentGate';
import { navigate } from './router';
import './home.css';
import './school-home.css';

/** 単元を開く（v1 のモードを使う単元は ModeEntry、それ以外は UnitRunner） */
export function openUnit(unitId: string): void {
  const m = unitMeta(unitId);
  if (!m) return;
  navigate(m.legacy ? { name: 'legacy', unitId } : { name: 'unit', unitId });
}

/** 札の単元のうち、子供画面に出すもの（保護者が開いていない hiddenByDefault は出さない） */
export function cardUnits(card: HomeCard, opened: readonly string[] = []): string[] {
  return card.units.filter((id) => {
    const m = unitMeta(id);
    return m && m.status !== 'planned' && (!m.hiddenByDefault || opened.includes(id));
  });
}

/** v1 のモード名の札は v1 と同じ目印（既存の E2E と保護者の手順書の互換） */
function cardTestId(id: string): string {
  return (MODE_IDS as readonly string[]).includes(id) ? `home-mode-${id}` : `home-card-${id}`;
}

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

export function PreschoolHome({ def }: { def: PreschoolHomeDef }) {
  const app = useApp();
  const profile = app.profile!;
  const stage2 = def.stage === 'p23' && profile.toddlerStage === 2;
  const cards = stage2
    ? def.cards.filter((c) => def.stage2Cards?.includes(c.id))
    : def.cards.slice(0, 9);
  const big = stage2;
  const gridStyle: CSSProperties | undefined = big
    ? {
        gridTemplateColumns: 'repeat(2, calc(var(--u) * 26))',
        gridAutoRows: 'calc(var(--u) * 21)',
      }
    : undefined;

  // きょうの おすすめ（2歳段階は出さない: review-1 #23）
  const [recs, setRecs] = useState<CardRec[]>([]);
  const settings = app.settings;
  useEffect(() => {
    if (stage2 || !settings) return;
    let alive = true;
    void (async () => {
      const d = new Date();
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      const rounds = await db.listRounds(profile.id, { since: start.getTime() - 30 * 86400000 });
      const shown = cards.filter((c) => cardUnits(c, settings.unitsOpened).length > 0);
      const r = recommendCards({
        cards: shown,
        today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        todayStart: start.getTime(),
        rounds,
        favorites: app.favorites,
        legacyModeOf: (u) => unitMeta(u)?.legacy?.modeId,
        domainOf: (c) => unitMeta(c.units[0]!)?.subject ?? c.id,
      });
      if (alive) setRecs(r);
    })();
    return () => {
      alive = false;
    };
    // cards は def と stage2 で決まる
  }, [profile.id, settings, app.favorites, def, stage2]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c: HomeCard) => {
    const units = cardUnits(c, app.settings?.unitsOpened);
    if (c.titleVoice) void audio.play(c.titleVoice);
    if (units.length === 1) openUnit(units[0]!);
    else if (units.length > 1) navigate({ name: 'card', stage: def.stage, cardId: c.id });
  };

  return (
    <div className="screen home" data-testid="home" data-stage={def.stage}>
      <div className="home-top">
        <div className="home-profile">
          <Illust id={profile.avatar} className="home-profile__avatar" decorative />
          <span className="label-text">{profile.name}</span>
        </div>
        <div className="home-top__right">
          <ParentGateButton />
        </div>
      </div>
      <div className="home-grid" role="list" aria-label="ぜんぶの あそび" style={gridStyle}>
        {cards.map((c) =>
          cardUnits(c, app.settings?.unitsOpened).length > 0 ? (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className="home-card"
              aria-label={c.title.replace(/ /g, '')}
              onClick={() => open(c)}
              data-testid={cardTestId(c.id)}
            >
              <Illust
                id={c.icon}
                className="home-card__illust"
                decorative
                style={
                  big ? { width: 'calc(var(--u) * 13)', height: 'calc(var(--u) * 13)' } : undefined
                }
              />
              <TwoLine text={c.title} />
            </button>
          ) : (
            <div key={c.id} className="home-card home-card--empty" aria-hidden />
          ),
        )}
      </div>
      <aside className="home-side">
        {stage2 ? null : <p className="label-text home-side__title">きょうの おすすめ</p>}
        {recs.map((r) => {
          const c = cards.find((x) => x.id === r.cardId)!;
          return (
            <button
              key={c.id}
              type="button"
              className="home-rec"
              aria-label={`おすすめ ${c.title.replace(/ /g, '')}`}
              onClick={() => open(c)}
              data-testid={`home-rec-${c.id}`}
            >
              <Illust id={c.icon} className="home-rec__illust" decorative />
              <TwoLine text={c.title} className="home-rec__name" />
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
          {stage2 ? null : (
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
          )}
        </div>
        {/* ほかの がくねん・きょうか（幼児からも小学生の教科をのぞける） */}
        <button
          type="button"
          className="home-rec home-rec--note"
          aria-label="ほかの がくねん・きょうか"
          onClick={() => navigate({ name: 'explore' })}
          data-testid="home-explore"
        >
          <Illust id="explore" className="home-rec__illust" decorative />
          <span className="home-rec__name">
            ほかの
            <br />
            がくねん
          </span>
        </button>
      </aside>
    </div>
  );
}
