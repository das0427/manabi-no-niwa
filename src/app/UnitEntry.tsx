/**
 * 幼児の単元の入口:
 *  - CardChooser: 札に単元が2つ以上あるとき、絵の大きな札で選ぶ。札は 24u × 21u（v1 の遊び方の選択と近い寸法）。
 *    札の名前は AppLabel（札の区分 p23・p4・p5 の分かち書きで折る）で、札に入るまで 2.6u から --text-min（2.2u）まで縮める。
 *    並びの箱は上 8u・下 2u（6 枚・2 段でも下の余白 2u。text-layout-fixes「アプリの画面」A4）。
 *  - LegacyEntry: v1 のモードを使う単元を、使う遊び方・段階の範囲に絞って開く（curriculum-matrix 4.1）。
 */
import { audio } from '../core/audio/index';
import { findPreschoolCard } from '../curriculum/preschoolEnglish';
import { unitMeta } from '../curriculum/unitIndex';
import { Illust } from '../illust/Illust';
import { plainText } from '../text/rich';
import { AppLabel } from '../ui/AppLabel';
import { ModeHeader } from '../ui/ModeHeader';
import { useApp } from './AppState';
import { ModeEntry } from './ModeEntry';
import { cardUnits, openUnit } from './PreschoolHome';
import { navigate } from './router';

/** 札の大きさ（u）。幅 24・高さ 21（絵 11u ＋ 間 0.6u ＋ 名前 2 行が内側に入る） */
const CARD_W = 24;
const CARD_H = 21;
/** 札の間（u）。行の間 1.6（主操作の間の最小）・列の間 2.4 */
const ROW_GAP = 1.6;
const COL_GAP = 2.4;

export function CardChooser({ stage, cardId }: { stage: string; cardId: string }) {
  const app = useApp();
  const preStage = stage === 'p23' || stage === 'p4' || stage === 'p5' ? stage : undefined;
  const card = preStage ? findPreschoolCard(preStage, cardId) : undefined;
  if (!preStage || !card || !app.settings) return null;
  const ctx = { furigana: app.settings.support.furigana, learnerGrade: 0 };
  return (
    <div className="screen" data-stage={preStage} data-testid={`card-chooser-${cardId}`}>
      <ModeHeader
        promptText="どれで あそぶ？"
        onHome={() => navigate({ name: 'home' }, { force: true })}
        onListen={() => void audio.play('app.choose-variant')}
        canListen
      />
      <div
        className="center-col"
        style={{ top: 'calc(var(--u) * 8)', bottom: 'calc(var(--u) * 2)' }}
      >
        <div
          className="row"
          style={{
            gap: `calc(var(--u) * ${ROW_GAP}) calc(var(--u) * ${COL_GAP})`,
            flexWrap: 'wrap',
            maxWidth: 'calc(var(--u) * 92)',
          }}
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
                  width: `calc(var(--u) * ${CARD_W})`,
                  height: `calc(var(--u) * ${CARD_H})`,
                  gap: 'calc(var(--u) * 0.6)',
                  textAlign: 'center',
                }}
              >
                <Illust id={m.icon} className="choice__illust" decorative />
                <AppLabel text={m.title} stage={preStage} ctx={ctx} fit={{ fromU: 2.6 }} />
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
      onPickVariant={(v, say) =>
        navigate({ name: 'legacy', unitId, variantId: v }, { replace: false, force: true, say })
      }
    />
  );
}
