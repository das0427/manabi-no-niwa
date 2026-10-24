/**
 * おかいものごっこ（M1）。注文カードは常に見えている（記憶課題にしない: M1-05）。
 * 棚の品物をタップ → かごへ（その品物の数を読み上げ）。かごの品物をタップ → 棚へ戻す。
 * 「これで おねがいします」（レジ）で判定。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { initialQuestion, type QuestionState } from '../../core/session/questionFlow';
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import {
  BASKET_MAX,
  generateRound,
  judge,
  orderVoice,
  totalOf,
  type Issue,
  type ShopItem,
} from './logic';
import './shopping.css';

interface Draft {
  index: number;
  placed: ShopItem[];
  q: QuestionState;
  results: { key: string; ok: boolean }[];
}

type HintView =
  | { kind: 'order'; item: ShopItem }
  | { kind: 'count'; item: ShopItem }
  | { kind: 'wrong'; item: ShopItem }
  | null;

const label = (lines: { item: ShopItem; count: number }[]) =>
  lines.map((l) => `${vocab(l.item).label}×${l.count}`).join('+');

export default function Shopping({ session }: ModePlayProps) {
  const questions = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [placed, setPlaced] = useState<ShopItem[]>(resume?.placed ?? []);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hint, setHint] = useState<HintView>(null);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const results = useRef<Draft['results']>(resume?.results ?? []);
  const q = useQuestion();
  const question = questions[index]!;
  const restored = useRef(false);

  // 問題の開始
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose({ index, lines: question.lines, shelf: question.shelf });
    const order = orderVoice(question.lines);
    void session.prompt(
      index === 0 && !resume ? ['shop.intro', 300, ...order, 300, 'shop.how'] : order,
      order,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const basket = useMemo(() => {
    const b: Partial<Record<ShopItem, number>> = {};
    for (const it of placed) b[it] = (b[it] ?? 0) + 1;
    return b;
  }, [placed]);

  const saveDraft = (nextPlaced: ShopItem[]) =>
    session.saveDraft({
      index,
      placed: nextPlaced,
      q: q.current,
      results: results.current,
    } satisfies Draft);

  const add = (item: ShopItem) => {
    if (busy || solved) return;
    if (placed.length >= BASKET_MAX) {
      void session.say('shop.basket-full');
      return;
    }
    const next = [...placed, item];
    setPlaced(next);
    setHint(null);
    session.sfx('place');
    const n = next.filter((x) => x === item).length;
    void session.say(`num.${n}`);
    saveDraft(next);
  };

  const remove = (i: number) => {
    if (busy || solved) return;
    const next = placed.filter((_, j) => j !== i);
    setPlaced(next);
    setHint(null);
    session.sfx('remove');
    saveDraft(next);
  };

  const showHint = (level: 1 | 2, issue: Issue | undefined) => {
    const first = issue ?? { kind: 'missing' as const, item: question.lines[0]!.item, diff: 1 };
    let seq: string[];
    if (first.kind === 'wrong-item') {
      seq = ['shop.look-order'];
      setHint(level === 2 ? { kind: 'wrong', item: first.item } : null);
    } else if (first.kind === 'extra') {
      seq = [`shop.item-ga.${first.item}`, 'shop.many'];
      setHint(level === 2 ? { kind: 'count', item: first.item } : null);
    } else {
      seq = [`shop.item-ga.${first.item}`, 'shop.short'];
      setHint(level === 2 ? { kind: 'order', item: first.item } : null);
    }
    setBubble(textOf(seq));
    void session.say(seq);
  };

  const next = (ok: boolean) => {
    results.current = [...results.current, { key: label(question.lines), ok }];
    // 記録と同時に「次の問題」の下書きを保存する（正解直後に離れて再開しても同じ問題を二重に記録しない）
    if (index + 1 >= questions.length) session.clearDraft();
    else
      session.saveDraft({
        index: index + 1,
        placed: [],
        q: initialQuestion(),
        results: results.current,
      } satisfies Draft);
    window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        const last = question.lines;
        const total = totalOf(last);
        session.finish({
          before: ['shop.total', `count.ko.${total}`],
          // 全部「つぎへ」で進んだ回は、行動に基づく声かけにしない（L6）
          praise: results.current.some((r) => r.ok) ? 'praise.gathered' : 'praise.watched',
          showcase: <Showcase lines={last} total={total} />,
        });
        return;
      }
      setIndex(index + 1);
      setPlaced([]);
      setHint(null);
      setBubble(null);
      setSolved(false);
      setBusy(false);
      q.reset();
    }, 1600);
  };

  const submit = () => {
    if (busy || solved || !q.tap()) return;
    const r = judge(basket, question.lines);
    if (r.ok) {
      const s = q.correct();
      setSolved(true);
      setBusy(true);
      setHint(null);
      setBubble(null);
      session.sfx('correct');
      void session.say('shop.thanks');
      session.record({
        itemKey: label(question.lines),
        outcome: s.outcome!,
        wrongTries: s.wrongTries,
        hintsUsed: s.hintsUsed,
        operationIssue: s.operationIssue,
        detail: { total: totalOf(question.lines) },
      });
      next(true);
    } else {
      const s = q.wrong();
      session.sfx('wrong');
      showHint(s.hintLevel === 2 ? 2 : 1, r.issues[0]);
      saveDraft(placed);
    }
  };

  const askHint = () => {
    if (busy || solved) return;
    const r = judge(basket, question.lines);
    if (r.ok) {
      // もう注文どおり: ヒントの回数に数えず、レジを押すよう知らせる
      setBubble(textOf('shop.looks-right'));
      void session.say('shop.looks-right');
      return;
    }
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1, r.issues[0]);
    saveDraft(placed);
  };

  const skip = () => {
    if (busy || solved) return;
    const s = q.skip();
    setBusy(true);
    setSolved(true);
    const answer: ShopItem[] = question.lines.flatMap((l) => Array<ShopItem>(l.count).fill(l.item));
    setPlaced(answer);
    setHint(null);
    setBubble(null);
    void session.say(['shop.answer', ...orderVoice(question.lines).slice(0, -1)]);
    session.record({
      itemKey: label(question.lines),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
    });
    next(false);
  };

  // かごの中の品物ごとの通し番号（ヒント2で「かぞえる」表示に使う）
  const ordinal = (i: number) => placed.slice(0, i + 1).filter((x) => x === placed[i]).length;

  return (
    <div className="shop" data-testid="shopping-board">
      <section className="shop-order" aria-label="ちゅうもん">
        {question.lines.map((l) => (
          <div
            key={l.item}
            className={`shop-order__line ${hint?.kind === 'order' && hint.item === l.item ? 'is-hint' : ''}`}
          >
            <div className="shop-order__pics">
              {Array.from({ length: l.count }, (_, i) => (
                <Illust key={i} id={l.item} className="shop-order__pic" decorative />
              ))}
            </div>
            <span className="shop-order__num" aria-label={`${vocab(l.item).label} ${l.count}こ`}>
              {l.count}
            </span>
          </div>
        ))}
      </section>

      <Bubble text={bubble} style={{ left: 'calc(var(--u) * 36)', top: 'calc(var(--u) * 27)' }} />

      <div className="shop-shelf" role="group" aria-label="たな">
        {question.shelf.map((item) => (
          <button
            key={item}
            type="button"
            className="choice shop-shelf__item"
            aria-label={vocab(item).label}
            onClick={() => add(item)}
            disabled={busy}
            data-testid={`shelf-${item}`}
          >
            <Illust id={item} className="choice__illust" decorative />
          </button>
        ))}
      </div>

      <div className="bottom-left">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy}
          testId="hint-button"
        />
      </div>
      <div className="bottom-right">
        <Tap
          label="これで おねがいします"
          text={<span className="shop-register__text">おねがい します</span>}
          icon="register"
          variant="main"
          className="shop-register"
          disabled={busy}
          onPress={submit}
          testId="register-button"
        />
        {q.state.canSkip && !solved ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : null}
      </div>
      <div className="shop-basket-row">
        <div
          className={`shop-basket ${solved ? 'shop-basket--done' : ''}`}
          aria-label="かご"
          data-testid="basket"
        >
          {placed.length === 0 ? <span className="shop-basket__empty">かご</span> : null}
          {placed.map((item, i) => (
            <button
              key={`${item}-${i}`}
              type="button"
              className={`shop-basket__item ${hint?.kind === 'wrong' && hint.item === item ? 'is-hint' : ''}`}
              aria-label={`${vocab(item).label}を もどす`}
              onClick={() => remove(i)}
              disabled={busy}
              data-testid={`basket-${item}`}
            >
              <Illust id={item} className="shop-basket__pic" decorative />
              {hint?.kind !== null && hint && hint.kind !== 'wrong' && hint.item === item ? (
                <span className="shop-basket__badge">{ordinal(i)}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Showcase({ lines, total }: { lines: { item: ShopItem; count: number }[]; total: number }) {
  return (
    <div className="shop-showcase">
      {lines.map((l) => (
        <div key={l.item} className="shop-showcase__group">
          {Array.from({ length: l.count }, (_, i) => (
            <Illust key={i} id={l.item} className="shop-showcase__pic" decorative />
          ))}
        </div>
      ))}
      <span className="shop-showcase__total">ぜんぶで {total}こ</span>
    </div>
  );
}
