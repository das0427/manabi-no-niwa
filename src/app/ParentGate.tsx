/**
 * 保護者画面の入口（PA-01）。鍵ボタンを2秒長押し → 大人向けの計算問題（または暗証番号）。
 * これは誤操作の防止であり、認証ではない（README・保護者画面に明記）。
 * 板の中はキーボードでも操作できる（FX11）: 数字（0〜9。テンキーも）・Backspace（1字消す）・Enter（OK。「もどる」に
 * フォーカスがあるときは もどる）・Esc（もどる）。
 * 板が開いている間、Tab の移動は板の中のボタンだけを回る（後ろのホームに出ない）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const question = useMemo(() => {
    const a = 12 + Math.floor(Math.random() * 60);
    const b = 11 + Math.floor(Math.random() * 30);
    return { a, b, answer: String(a + b) };
  }, []);

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
      setError(true);
      setInput('');
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
        <p
          className="gate-q"
          data-testid="gate-question"
          data-answer-length={question.answer.length}
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
