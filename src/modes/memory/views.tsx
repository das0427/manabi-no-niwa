/** おぼえてさがす の画面部品（覚える画面・答える画面）。判断は index.tsx、ここは描画だけ。 */
import { useEffect, useRef, useState } from 'react';
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { Choice } from '../../ui/Choice';
import { PLACE_COUNT, type MemItem, type MemQuestion } from './logic';

/** 順に出す間隔（B5/B6） */
const REVEAL_MS = 900;

/** 覚える画面。絵を大きく出す。出し終えたら onAllShown を1回呼ぶ。 */
export function StudyView({ q, onAllShown }: { q: MemQuestion; onAllShown: () => void }) {
  const [count, setCount] = useState(q.kind === 'order' ? 1 : q.shown.length);
  const cb = useRef(onAllShown);
  cb.current = onAllShown;

  useEffect(() => {
    if (count >= q.shown.length) {
      cb.current();
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [count, q.shown.length]);

  if (q.kind === 'place') {
    return (
      <div className="mem-study mem-study--place" data-testid="study">
        {Array.from({ length: PLACE_COUNT }, (_, i) => (
          <div key={i} className={`mem-frame mem-frame--place ${i === q.pos ? '' : 'is-empty'}`}>
            {i === q.pos ? <Illust id={q.shown[0]!} className="mem-frame__pic" decorative /> : null}
          </div>
        ))}
      </div>
    );
  }
  if (q.kind === 'order') {
    return (
      <div className="mem-study" data-testid="study">
        {q.shown.map((item, i) => (
          <div key={i} className="mem-step">
            <div className={`mem-frame mem-frame--order ${i < count ? '' : 'is-empty'}`}>
              {i < count ? <Illust id={item} className="mem-frame__pic" decorative /> : null}
            </div>
            <span className="mem-step__num">{i + 1}ばん</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mem-study" data-testid="study">
      {q.shown.map((item) => (
        <div key={item} className="mem-frame mem-frame--big">
          <Illust id={item} className="mem-frame__pic" decorative />
        </div>
      ))}
    </div>
  );
}

interface AnswerProps {
  q: MemQuestion;
  picked: readonly MemItem[];
  placedCount: number;
  /** 間違えた選択肢（pick: 絵 / place: 場所の番号） */
  wrongs: readonly (MemItem | number)[];
  /** order: 直前に間違えて置こうとした絵 */
  flash: MemItem | null;
  /** order: 示す絵（ヒント2） */
  hintItem: MemItem | null;
  revealed: boolean;
  disabled: boolean;
  onPick: (item: MemItem) => void;
  onCard: (i: number) => void;
}

/** 答える画面。覚えた絵は DOM に残さない（選択肢・候補にだけ絵がある） */
export function AnswerView(p: AnswerProps) {
  const { q } = p;
  if (q.kind === 'pick') {
    return (
      <div className="mem-answer" data-testid="answer">
        {q.choices.map((item, i) => {
          const state = p.picked.includes(item)
            ? 'correct'
            : p.wrongs.includes(item)
              ? 'wrong'
              : null;
          return (
            <Choice
              key={item}
              label={vocab(item).label}
              illust={item}
              state={state}
              disabled={p.disabled || p.picked.includes(item)}
              onPress={() => p.onPick(item)}
              className="mem-choice"
              testId={`choice-${i}`}
            />
          );
        })}
      </div>
    );
  }
  if (q.kind === 'place') {
    return (
      <div className="mem-answer" data-testid="answer">
        {Array.from({ length: PLACE_COUNT }, (_, i) => {
          const open = p.revealed && i === q.pos;
          return (
            <Choice
              key={i}
              label={open ? vocab(q.answer[0]!).label : 'カード'}
              state={open ? 'correct' : p.wrongs.includes(i) ? 'wrong' : null}
              disabled={p.disabled}
              onPress={() => p.onCard(i)}
              className="mem-choice mem-choice--card"
              testId={`card-${i}`}
            >
              {open ? (
                <Illust id={q.answer[0]!} className="choice__illust mem-choice__pic" decorative />
              ) : (
                <span className="mem-card-back" aria-hidden />
              )}
            </Choice>
          );
        })}
      </div>
    );
  }
  const tray = q.choices.filter((c) => !q.answer.slice(0, p.placedCount).includes(c));
  return (
    <div className="mem-order" data-testid="answer">
      <div className="mem-slots" role="group" aria-label="ならべる ところ">
        {q.answer.map((item, i) => (
          <div
            key={i}
            className={`mem-slot ${i < p.placedCount ? 'is-filled' : ''}`}
            data-testid={`slot-${i}`}
          >
            {i < p.placedCount ? (
              <Illust id={item} className="mem-slot__pic" decorative />
            ) : (
              <span className="mem-slot__num">{i + 1}ばん</span>
            )}
          </div>
        ))}
      </div>
      <div className="mem-tray" role="group" aria-label="えを えらぶ">
        {tray.map((item) => (
          <Choice
            key={item}
            label={vocab(item).label}
            illust={item}
            state={p.flash === item ? 'wrong' : p.hintItem === item ? 'hint' : null}
            disabled={p.disabled}
            onPress={() => p.onPick(item)}
            className="mem-choice mem-choice--tray"
            testId={`tray-${item}`}
          />
        ))}
      </div>
    </div>
  );
}
