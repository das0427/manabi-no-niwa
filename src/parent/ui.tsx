/** 保護者画面の小さな部品（確認ダイアログなど。window.confirm は使わない） */
import { useState, type ReactNode } from 'react';

export function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="p-section" data-testid={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="p-note">{children}</p>;
}

/**
 * 破壊操作の確認（DA-08）。対象名を示す。requireText があれば、その文字を入力するまで押せない。
 */
export function ConfirmDialog({
  title,
  target,
  message,
  confirmLabel,
  requireText,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** 対象の名前（題名・プロフィール名など） */
  target: string;
  message?: ReactNode;
  confirmLabel: string;
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = (requireText === undefined || text === requireText) && !busy;
  return (
    <div className="p-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="p-dialog" data-testid="confirm-dialog">
        <h3>{title}</h3>
        <p className="p-target" data-testid="confirm-target">
          {target}
        </p>
        {message ? <div className="p-dialog__msg">{message}</div> : null}
        {requireText !== undefined ? (
          <label className="p-field">
            確認のため「{requireText}」と入力してください
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="confirm-input"
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="p-row p-row--end">
          <button type="button" onClick={onCancel} data-testid="confirm-cancel">
            やめる
          </button>
          <button
            type="button"
            className="p-danger"
            disabled={!ok}
            data-testid="confirm-ok"
            onClick={() => {
              setBusy(true);
              void Promise.resolve(onConfirm()).finally(() => setBusy(false));
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
