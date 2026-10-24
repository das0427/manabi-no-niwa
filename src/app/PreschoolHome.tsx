/**
 * 幼児ホーム（2〜3歳・4歳・5歳。ux-by-age 2.1）: 左に札の 3×3（位置は固定）、右に おえかき・がんばりノート。
 * 2歳段階は札4枚（2×2）・おすすめなし（review-1 #23）。保護者向けの案内は起動画面で出す。
 */
import type { CSSProperties } from 'react';
import { audio } from '../core/audio/index';
import type { HomeCard, PreschoolHomeDef } from '../curriculum/preschoolHome';
import { unitMeta } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { useApp } from './AppState';
import { ParentGateButton } from './ParentGate';
import { navigate } from './router';
import './home.css';

/** 単元を開く（v1 のモードを使う単元は ModeEntry、それ以外は UnitRunner） */
export function openUnit(unitId: string): void {
  const m = unitMeta(unitId);
  if (!m) return;
  navigate(m.legacy ? { name: 'legacy', unitId } : { name: 'unit', unitId });
}

/** 札の単元のうち、子供画面に出すもの（保護者が開いていない hiddenByDefault は出さない） */
export function cardUnits(card: HomeCard): string[] {
  return card.units.filter((id) => {
    const m = unitMeta(id);
    return m && m.status !== 'planned' && !m.hiddenByDefault;
  });
}

function TwoLine({ text }: { text: string }) {
  const [a, ...rest] = text.split(' ');
  return (
    <span className="home-card__name">
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

  const open = (c: HomeCard) => {
    const units = cardUnits(c);
    if (c.titleVoice) void audio.play(c.titleVoice);
    if (units.length === 1) openUnit(units[0]!);
    else if (units.length > 1) navigate({ name: 'card', stage: def.stage, cardId: c.id });
  };

  return (
    <div className="screen home" data-testid={`preschool-home-${def.stage}`}>
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
          cardUnits(c).length > 0 ? (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className="home-card"
              aria-label={c.title.replace(/ /g, '')}
              onClick={() => open(c)}
              data-testid={`home-card-${c.id}`}
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
        <button
          type="button"
          className="home-rec home-rec--note"
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
            className="home-rec home-rec--note"
            aria-label="がんばりノート"
            onClick={() => navigate({ name: 'notebook' }, { say: 'app.notebook' })}
            data-testid="home-notebook"
          >
            <Illust id="notebook" className="home-rec__illust" decorative />
            <span className="home-rec__name">
              がんばり
              <br />
              ノート
            </span>
          </button>
        )}
      </aside>
    </div>
  );
}
