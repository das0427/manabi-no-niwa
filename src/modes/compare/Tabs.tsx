import { Tap, type TapState } from '../../ui/Tap';

interface Props {
  withSame: boolean;
  stateOf: (side: number) => TapState;
  onChoose: (side: number) => void;
}

/** カードの下の札「ひだり」「みぎ」（P4 は「おなじ」も）。数の問題と P4 で使う */
export function Tabs({ withSame, stateOf, onChoose }: Props) {
  return (
    <>
      <Tap
        label="ひだり"
        text="ひだり"
        variant="white"
        className="cmp-tab"
        style={{ left: 'calc(var(--u) * 13)', width: 'calc(var(--u) * 26)' }}
        state={stateOf(0)}
        onPress={() => onChoose(0)}
        testId="choice-0"
      />
      <Tap
        label="みぎ"
        text="みぎ"
        variant="white"
        className="cmp-tab"
        style={{ left: 'calc(var(--u) * 61)', width: 'calc(var(--u) * 26)' }}
        state={stateOf(1)}
        onPress={() => onChoose(1)}
        testId="choice-1"
      />
      {withSame ? (
        <Tap
          label="おなじ"
          className="cmp-tab"
          variant="white"
          style={{ left: 'calc(var(--u) * 41)', width: 'calc(var(--u) * 18)' }}
          state={stateOf(2)}
          onPress={() => onChoose(2)}
          testId="choice-2"
          text={
            <span className="cmp-same">
              <svg viewBox="0 0 12 6" className="cmp-same__pic" aria-hidden="true">
                <circle cx="3" cy="3" r="2.4" />
                <circle cx="9" cy="3" r="2.4" />
              </svg>
              おなじ
            </span>
          }
        />
      ) : null}
    </>
  );
}
