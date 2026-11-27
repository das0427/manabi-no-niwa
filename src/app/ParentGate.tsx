/**
 * 保護者画面の入口（PA-01）。鍵ボタンを2秒長押し → 大人向けの計算問題（または暗証番号）。
 * これは誤操作の防止であり、認証ではない（README・保護者画面に明記）。
 * 計算問題は、まちがえるたびに新しい問題に替わる（同じ問題のまま、答えの範囲を続けて試せない）。
 * まちがいが 3 回続くと板を閉じる（計算問題も暗証番号も）。開き直すには、また2秒の長押しが要る。
 * 板の中はキーボードでも操作できる（FX11）: 数字（0〜9。テンキーも）・Backspace（1字消す）・Enter（OK。「もどる」に
 * フォーカスがあるときは もどる）・Esc（もどる）。
 * 板が開いている間、Tab の移動は板の中のボタンだけを回る（後ろのホームに出ない）。
 */
import { useEffect, useRef, useState } from 'react';
import { isFramed } from '../core/framed';
import * as db from '../core/storage/index';
import { Illust } from '../illust/Illust';
import { useApp } from './AppState';
import { navigate } from './router';
import { checkPin } from './pin';
import './parent-gate.css';

const HOLD_MS = 2000;
/** 答え・暗証番号の入力の最大の桁数 */
const MAX_DIGITS = 6;
/** 計算問題「a ＋ b は？」の範囲（a は 12〜71、b は 11〜40。答えは 23〜111） */
const A_MIN = 12;
const A_COUNT = 60;
const B_MIN = 11;
const B_COUNT = 30;
/**
 * まちがいがこの回数続いたら板を閉じる（開き直すには、また2秒の長押し）。問題を替えるだけでは、同じ数を打ち続けて
 * 通るまでの回数（中央値 約41回）が、答えを順に試す回数（中央値 45回）とほとんど変わらない。数回ごとに長押しを
 * 求めて、続けて試すことを止める（公開前の最後の確かめ SEC-1。docs/expansion/updater-design.md 16.5）
 */
const MAX_MISSES = 3;

interface Question {
  a: number;
  b: number;
  answer: string;
}

/**
 * 新しい計算問題を作る。prev があるときは、答えが prev と同じにならない問題にする
 * （まちがえたあと、同じ数を打ち直して通る、を防ぐ。b を 1 つずらすだけで範囲の中に収まる）。
 */
function makeQuestion(prev?: Question): Question {
  const a = A_MIN + Math.floor(Math.random() * A_COUNT);
  let b = B_MIN + Math.floor(Math.random() * B_COUNT);
  if (prev !== undefined && String(a + b) === prev.answer) {
    b = b === B_MIN + B_COUNT - 1 ? B_MIN : b + 1;
  }
  return { a, b, answer: String(a + b) };
}

/** 押されたキーが数字なら、その数字（テンキーも。IME が先に取った場合は物理キー code から） */
function digitOf(e: KeyboardEvent): string | null {
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (e.key === 'Process' || e.key === 'Unidentified') {
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) return m[1]!;
  }
  return null;
}

export function ParentGateButton() {
  const [holding, setHolding] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const start = () => {
    // ほかのページの枠の中では開かない（見えない枠を重ねて保護者の操作を押させる、を防ぐ）
    if (isFramed()) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setOpen(true);
    }, HOLD_MS);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <>
      <button
        type="button"
        className={`gate-key ${holding ? 'gate-key--holding' : ''}`}
        aria-label="おとなの ひと（ながおし）"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="parent-key"
      >
        <svg className="gate-key__ring" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="17" />
        </svg>
        <Illust id="lock" className="gate-key__icon" decorative />
      </button>
      {open ? <GateDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GateDialog({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [pinHash, setPinHash] = useState<string | null | undefined>(undefined);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [question, setQuestion] = useState<Question>(() => makeQuestion());
  /** この板を開いてからのまちがいの数（板を閉じると数え直し。正しく答えると板は閉じる） */
  const misses = useRef(0);

  useEffect(() => {
    void db.getAppRecord().then((r) => setPinHash(r.parentPinHash));
  }, []);

  const loaded = pinHash !== undefined;
  const usePin = pinHash !== null && pinHash !== undefined;

  const submit = async () => {
    if (!loaded) return;
    const ok = usePin ? await checkPin(input, pinHash) : input === question.answer;
    if (ok) {
      app.setParentUnlocked(true);
      onClose();
      navigate({ name: 'parent', tab: 'records' }, { force: true });
    } else {
      misses.current += 1;
      if (misses.current >= MAX_MISSES) {
        // まちがいが続いたら板を閉じる。開き直すには、また鍵を2秒長押しする（フォーカスは鍵のボタンへ戻る）
        onClose();
        return;
      }
      setError(true);
      setInput('');
      // まちがえるたびに問題を作り直す（同じ問題のまま、答えの範囲 23〜111 を続けて試せないように）。
      // 暗証番号のときは問題を使わないので、そのまま
      if (!usePin) setQuestion(makeQuestion(question));
    }
  };

  /** ボタンと同じ操作（キーボードも同じ道を通す） */
  const press = (k: string) => {
    setError(false);
    if (k === 'けす') setInput('');
    else if (k === 'OK') void submit();
    else setInput((cur) => (cur.length < MAX_DIGITS ? cur + k : cur));
  };

  // キーボード: 数字・Backspace・Enter・Esc。数字のボタンにフォーカスがあっても、Enter でそのボタンを押したことにしない
  // （マウスで数字を押したあとの Enter で、数字が1つ増えない）。「もどる」にフォーカスがあるときの Enter は「もどる」
  const onKey = (e: KeyboardEvent) => {
    if (!loaded || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const d = digitOf(e);
    if (d !== null) {
      e.preventDefault();
      if (!e.repeat) press(d);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setError(false);
      setInput((cur) => cur.slice(0, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (cancel.current && document.activeElement === cancel.current) onClose();
      else void submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // フォーカスを板の中のボタンの間だけで回す（aria-modal の板の外へ出さない）
      const list = [
        ...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []),
      ];
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const at = document.activeElement;
      // 板そのもの（開いた直後のフォーカス先。tabIndex=-1）も「ボタンの外」として扱う。
      // そうしないと、開いた直後の Shift+Tab がブラウザの通常の動きで後ろのホーム（鍵のボタン）へ出る
      const onButton = at instanceof HTMLElement && list.includes(at);
      if (e.shiftKey && (!onButton || at === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!onButton || at === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const latestKey = useRef(onKey);
  useEffect(() => {
    latestKey.current = onKey;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => latestKey.current(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // 開いたら板にフォーカスを移し、閉じたら元（鍵のボタン）へ戻す
  useEffect(() => {
    if (!loaded) return;
    const before = document.activeElement;
    panel.current?.focus();
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, [loaded]);

  if (!loaded) return null;

  return (
    <div
      className="gate-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="保護者の確認"
      data-testid="parent-gate"
    >
      <div className="gate-panel" ref={panel} tabIndex={-1}>
        <p className="gate-title">保護者の方へ</p>
        {/* aria-live: まちがえて問題が替わったことを、読み上げソフトにも伝える（見た目は変わらない） */}
        <p
          className="gate-q"
          data-testid="gate-question"
          data-answer-length={question.answer.length}
          aria-live="polite"
        >
          {usePin ? '暗証番号を入力してください' : `${question.a} ＋ ${question.b} は？`}
        </p>
        <p className="gate-input" aria-live="polite">
          {usePin ? '●'.repeat(input.length) : input || ' '}
        </p>
        {error ? <p className="gate-error">ちがいます。もう一度どうぞ。</p> : null}
        <div className="gate-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'けす', '0', 'OK'].map((k) => (
            <button
              key={k}
              type="button"
              className="gate-num"
              data-testid={`gate-key-${k}`}
              onClick={() => press(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="gate-cancel"
          ref={cancel}
          onClick={onClose}
          data-testid="gate-cancel"
        >
          もどる
        </button>
        <p className="gate-note">
          これは子供の誤操作を防ぐためのもので、強固な保護ではありません。
        </p>
      </div>
    </div>
  );
}
