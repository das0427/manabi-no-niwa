/**
 * 保護者画面の入口（PA-01）。鍵ボタンを2秒長押し → 大人向けの計算問題（または暗証番号）。
 * これは誤操作の防止であり、認証ではない（README・保護者画面に明記）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../core/storage/index';
import { Illust } from '../illust/Illust';
import { useApp } from './AppState';
import { navigate } from './router';
import { checkPin } from './pin';
import './parent-gate.css';

const HOLD_MS = 2000;

export function ParentGateButton() {
  const [holding, setHolding] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const start = () => {
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
  const question = useMemo(() => {
    const a = 12 + Math.floor(Math.random() * 60);
    const b = 11 + Math.floor(Math.random() * 30);
    return { a, b, answer: String(a + b) };
  }, []);

  useEffect(() => {
    void db.getAppRecord().then((r) => setPinHash(r.parentPinHash));
  }, []);

  if (pinHash === undefined) return null;
  const usePin = pinHash !== null;

  const submit = async () => {
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

  return (
    <div
      className="gate-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="保護者の確認"
      data-testid="parent-gate"
    >
      <div className="gate-panel">
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
              onClick={() => {
                setError(false);
                if (k === 'けす') setInput('');
                else if (k === 'OK') void submit();
                else if (input.length < 6) setInput(input + k);
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <button type="button" className="gate-cancel" onClick={onClose} data-testid="gate-cancel">
          もどる
        </button>
        <p className="gate-note">
          これは子供の誤操作を防ぐためのもので、強固な保護ではありません。
        </p>
      </div>
    </div>
  );
}
