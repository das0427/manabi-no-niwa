/**
 * 幼児の単元の入口:
 *  - CardChooser: 札に単元が2つ以上あるとき、絵の大きな札で選ぶ（v1 の遊び方の選択と同じ寸法）。
 *  - LegacyEntry: v1 のモードを使う単元を、使う遊び方・段階の範囲に絞って開く（curriculum-matrix 4.1）。
 */
import { audio } from '../core/audio/index';
import { PRESCHOOL_HOMES } from '../curriculum/preschoolHome';
import { unitMeta } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { Rt } from '../text/Rt';
import { plainText } from '../text/rich';
import { ModeHeader } from '../ui/ModeHeader';
import { useApp } from './AppState';
import { ModeEntry } from './ModeEntry';
import { cardUnits, openUnit } from './PreschoolHome';
import { navigate } from './router';

export function CardChooser({ stage, cardId }: { stage: string; cardId: string }) {
  const app = useApp();
  const def = PRESCHOOL_HOMES[stage as 'p23' | 'p4' | 'p5'];
  const card = def?.cards.find((c) => c.id === cardId);
  if (!card || !app.settings) return null;
  const ctx = { furigana: app.settings.support.furigana, learnerGrade: 0 };
  return (
    <div className="screen" data-testid={`card-chooser-${cardId}`}>
      <ModeHeader
        promptText="どれで あそぶ？"
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => void audio.play('app.choose-variant')}
        canListen
      />
      <div className="center-col" style={{ top: 'calc(var(--u) * 8)' }}>
        <div
          className="row"
          style={{ gap: 'calc(var(--u) * 2.4)', flexWrap: 'wrap', maxWidth: 'calc(var(--u) * 92)' }}
        >
          {cardUnits(card, app.settings.unitsOpened).map((id) => {
            const m = unitMeta(id)!;
            return (
              <button
                key={id}
                type="button"
                className="choice"
                aria-label={plainText(m.title)}
                onClick={() => openUnit(id)}
                data-testid={`card-unit-${id}`}
                style={{
                  width: 'calc(var(--u) * 24)',
                  height: 'calc(var(--u) * 22)',
                  gap: 'calc(var(--u) * 0.6)',
                }}
              >
                <Illust id={m.icon} className="choice__illust" decorative />
                <span className="label-text" style={{ textAlign: 'center' }}>
                  <Rt text={m.title} ctx={ctx} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LegacyEntry({ unitId, variantId }: { unitId: string; variantId?: string }) {
  const m = unitMeta(unitId);
  if (!m?.legacy) return null;
  const lg = m.legacy;
  return (
    <ModeEntry
      key={`${unitId}-${variantId ?? ''}`}
      modeId={lg.modeId}
      variantId={variantId}
      onlyVariants={lg.variants}
      levelRange={lg.levelRange}
      onPickVariant={(v) =>
        navigate({ name: 'legacy', unitId, variantId: v }, { replace: false, force: true })
      }
    />
  );
}
