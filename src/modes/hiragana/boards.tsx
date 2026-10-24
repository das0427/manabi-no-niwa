/** ひらがなの盤面の部品（選ぶ・言葉を作る・完了画面の並び） */
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { Choice } from '../../ui/Choice';
import { StateMark } from '../../ui/Tap';
import { kanaOf } from './kana-table';
import { showsExample, type BuildQuestion, type ChoiceQuestion, type KanaQuestion } from './logic';

export function ChoiceBoard({
  question,
  wrongIdx,
  correctIdx,
  hintLevel,
  listening,
  busy,
  onPick,
}: {
  question: ChoiceQuestion;
  wrongIdx: number | null;
  correctIdx: number | null;
  hintLevel: number;
  listening: boolean;
  busy: boolean;
  onPick: (i: number) => void;
}) {
  const first = question.kind === 'first';
  return (
    <>
      {first ? (
        <div className="hira-picture" data-testid="word-picture">
          <Illust id={question.word} className="hira-picture__illust" decorative />
        </div>
      ) : null}
      <div
        className={`hira-choices hira-choices--${question.choices.length}`}
        role="group"
        aria-label="えらぶ"
      >
        {question.choices.map((c, i) => (
          <Choice
            key={`${c}-${i}`}
            label={c}
            letter={c}
            className="hira-card"
            state={correctIdx === i ? 'correct' : wrongIdx === i ? 'wrong' : null}
            disabled={listening || (busy && correctIdx !== i)}
            onPress={() => onPick(i)}
            testId={`choice-${i}`}
          />
        ))}
      </div>
      {hintLevel === 2 && !first ? (
        <div className="hira-clue" data-testid="hint-picture">
          <Illust id={question.word} className="hira-clue__illust" decorative />
        </div>
      ) : null}
    </>
  );
}

export function BuildBoard({
  question,
  filled,
  used,
  pending,
  hintLevel,
  busy,
  onTile,
}: {
  question: BuildQuestion;
  filled: string[];
  used: number[];
  pending: { tile: number; char: string } | null;
  hintLevel: number;
  busy: boolean;
  onTile: (i: number) => void;
}) {
  const next = filled.length;
  const exWord =
    next < question.chars.length && showsExample(question, next)
      ? kanaOf(question.chars[next]!).word
      : undefined;
  return (
    <>
      <div className="hira-picture hira-picture--build" data-testid="word-picture">
        <Illust id={question.word} className="hira-picture__illust" decorative />
      </div>
      <div className="hira-cells" aria-label="ことば">
        {question.chars.map((_, i) => {
          const ch = filled[i] ?? (i === next && pending ? pending.char : '');
          const isWrong = i === next && pending !== null;
          const isHint = hintLevel === 2 && i === next && !pending;
          return (
            <div
              key={i}
              className={`hira-cell ${ch && !isWrong ? 'is-filled' : ''} ${isHint ? 'is-hint' : ''}`}
              data-testid={`cell-${i}`}
              data-state={isWrong ? 'wrong' : ch ? 'placed' : 'empty'}
            >
              <span className="hira-cell__letter">{ch}</span>
              {isWrong ? <StateMark state="wrong" /> : null}
            </div>
          );
        })}
      </div>
      {hintLevel === 2 && exWord && !pending ? (
        <div className="hira-clue hira-clue--build" data-testid="hint-picture">
          <Illust id={exWord} className="hira-clue__illust" decorative />
          <span className="hira-clue__label">{vocab(exWord).label}</span>
        </div>
      ) : null}
      <div
        className={`hira-tiles hira-tiles--${question.tiles.length}`}
        role="group"
        aria-label="もじ"
      >
        {question.tiles.map((c, i) =>
          used.includes(i) ? (
            <span key={i} className="hira-tile-slot" aria-hidden />
          ) : (
            <Choice
              key={i}
              label={c}
              letter={c}
              className="hira-card"
              state={pending?.tile === i ? 'wrong' : null}
              disabled={busy && pending?.tile !== i}
              onPress={() => onTile(i)}
              testId={`tile-${i}`}
            />
          ),
        )}
      </div>
    </>
  );
}

export function Showcase({ items }: { items: readonly KanaQuestion[] }) {
  return (
    <div className="hira-showcase" data-testid="hiragana-showcase">
      {items.map((it, i) => (
        <div key={i} className="hira-showcase__item">
          <Illust id={it.word} className="hira-showcase__pic" decorative />
          <span className={`hira-showcase__letter ${it.kind === 'build' ? 'is-word' : ''}`}>
            {it.kind === 'build' ? vocab(it.word).label : it.answer}
          </span>
        </div>
      ))}
    </div>
  );
}
