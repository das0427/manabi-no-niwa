import { useAudioState } from '../core/audio/index';
import { Illust } from '../illust/Illust';

interface Props {
  promptText: string;
  onHome: () => void;
  onListen: () => void;
  canListen: boolean;
}

/** 左上「おうち」、中央に問題文、右上「もういちど きく」（位置は全画面で固定。DESINGN.md 5.1） */
export function ModeHeader({ promptText, onHome, onListen, canListen }: Props) {
  const { speaking } = useAudioState();
  return (
    <header className="mode-header">
      <button
        type="button"
        className="tap tap--wood tap--aux"
        aria-label="おうち"
        onClick={onHome}
        data-testid="home-button"
      >
        <Illust id="home" className="tap__icon" decorative />
      </button>
      <p className="mode-header__prompt" data-testid="prompt-text">
        {promptText}
      </p>
      <button
        type="button"
        className={`tap tap--sky tap--aux ${speaking ? 'listen--speaking' : ''}`}
        aria-label="もういちど きく"
        onClick={onListen}
        disabled={!canListen}
        data-testid="listen-button"
        data-speaking={speaking ? '1' : '0'}
      >
        <Illust id="listen" className="tap__icon" decorative />
        <SpeakingDots active={speaking} />
      </button>
    </header>
  );
}

/** 音声の再生中に動く3つの点（動きを減らす設定では静止。VO-06） */
function SpeakingDots({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 30 10"
      aria-hidden
      style={{
        width: 'calc(var(--u) * 3)',
        height: 'calc(var(--u) * 1)',
        opacity: active ? 1 : 0.35,
      }}
    >
      {[5, 15, 25].map((x) => (
        <circle key={x} className="listen-wave" cx={x} cy={5} r={3.5} fill="#4A3B32" />
      ))}
    </svg>
  );
}
