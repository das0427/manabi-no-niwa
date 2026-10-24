import { useEffect, useMemo, useState } from 'react';
import { audio } from '../core/audio/index';
import type { RoundSummary } from '../core/session/types';
import type { ModeId } from '../core/types';
import { Illust } from '../illust/Illust';
import { ModeHeader } from '../ui/ModeHeader';
import { Tap } from '../ui/Tap';
import { useApp } from './AppState';
import { textOf } from './voiceText';

interface Props {
  modeId: ModeId;
  summary: RoundSummary;
  timeUp: boolean;
  onAgain: () => void;
  onHome: () => void;
}

/**
 * 完了画面（learning-design.md 10章）。やったことの絵＋行動に基づく1文＋札2つ＋ハート。
 * 点数・星は出さない。利用時間の目安に達していたら「きょうは ここまで」（おうち だけ）。
 */
export function DoneScreen({ modeId, summary, timeUp, onAgain, onHome }: Props) {
  const app = useApp();
  const praise = summary.praise ?? 'praise.finished';
  const liked = app.favorites.includes(modeId);
  const [busy, setBusy] = useState(false);

  const seq = useMemo(
    () => [...toList(summary.before), praise, ...(timeUp ? ['app.timeup'] : [])],
    [summary, praise, timeUp],
  );
  useEffect(() => {
    void audio.play(seq);
  }, [seq]);

  const caption = summary.caption ?? textOf(praise);
  const illusts = (summary.illusts ?? []).slice(0, 5);

  return (
    <div className="screen done" data-testid="done-screen">
      {/* 完了画面も、おうち（左上）と もういちど きく（右上）の位置は同じ（DESINGN.md 5.1） */}
      <ModeHeader promptText="" onHome={onHome} onListen={() => void audio.play(seq)} canListen />
      <div
        className="center-col"
        style={{ gap: 'calc(var(--u) * 2.4)', top: 'calc(var(--u) * 6)' }}
      >
        <div className="row" style={{ minHeight: 'calc(var(--u) * 16)' }}>
          {summary.showcase ??
            illusts.map((id, i) => (
              <Illust
                key={`${id}-${i}`}
                id={id}
                style={{ width: 'calc(var(--u) * 13)', height: 'calc(var(--u) * 13)' }}
              />
            ))}
        </div>
        <p className="title-text" data-testid="done-caption">
          {caption}
        </p>
        {timeUp ? <p className="label-text">きょうは ここまでに しよう</p> : null}
        <div className="row">
          {!timeUp ? (
            <Tap
              label="もういっかい"
              text="もういっかい"
              icon="again"
              variant="main"
              size="big"
              disabled={busy}
              onPress={() => {
                setBusy(true);
                onAgain();
              }}
              testId="again-button"
            />
          ) : null}
          <Tap
            label="おうち"
            text="おうち"
            icon="home"
            size="big"
            onPress={onHome}
            testId="done-home-button"
          />
          <Tap
            label={liked ? 'すき（えらんだ）' : 'すき'}
            icon={liked ? 'heart-on' : 'heart'}
            variant="white"
            onPress={() => {
              void app.toggleFavorite(modeId).then((on) => {
                if (on) void audio.play('app.liked');
              });
            }}
            testId="like-button"
          />
        </div>
      </div>
    </div>
  );
}

function toList(seq: RoundSummary['before']): (string | number)[] {
  if (seq === undefined) return [];
  return typeof seq === 'string' ? [seq] : [...seq];
}
