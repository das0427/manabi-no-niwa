import { Component, useCallback, useState, type ReactNode } from 'react';
import { useApp } from '../app/AppState';
import * as db from '../core/storage/index';
import type { WorkRecord } from '../core/types';
import { WorkThumb } from '../modes/workThumb';
import { ConfirmDialog, Note, Section } from './ui';
import { formatDateTime, modeTitle, useLoad } from './util';

class Safe extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <span className="p-muted">（表示できませんでした）</span>
    ) : (
      this.props.children
    );
  }
}

const isDraft = (w: WorkRecord): boolean =>
  typeof w.data === 'object' && w.data !== null && (w.data as { draft?: unknown }).draft === true;

export function WorksTab() {
  const app = useApp();
  const pid = app.profile?.id ?? '';
  const load = useCallback(() => db.listWorks(pid), [pid]);
  const { data: works, reload } = useLoad(load);
  const [big, setBig] = useState<WorkRecord | null>(null);
  const [del, setDel] = useState<WorkRecord | null>(null);
  if (!app.profile) return null;
  if (!works) return <p>読み込み中…</p>;

  return (
    <div data-testid="tab-works">
      <Section title={`${app.profile.name}さんの さくひん（${works.length}）`}>
        <Note>
          「つくりかけ」は、作っている途中で自動的に保存されたものです。削除するとお子さんのノートからも消えます。
        </Note>
        {works.length === 0 ? <p className="p-muted">まだ作品がありません。</p> : null}
        <ul className="p-works">
          {works.map((w) => (
            <li key={w.id} data-testid={`work-${w.id}`}>
              <div className="p-work__thumb">
                <Safe>
                  <WorkThumb work={w} />
                </Safe>
              </div>
              <div className="p-work__title">
                {w.title}
                {isDraft(w) ? <span className="p-badge p-badge--idle">つくりかけ</span> : null}
              </div>
              <div className="p-muted p-small">
                {modeTitle(w.modeId)}&emsp;{formatDateTime(w.createdAt)}
              </div>
              <div className="p-row">
                <button type="button" onClick={() => setBig(w)} data-testid={`work-big-${w.id}`}>
                  大きく見る
                </button>
                <button type="button" onClick={() => setDel(w)} data-testid={`work-delete-${w.id}`}>
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {big ? (
        <div className="p-backdrop" role="dialog" aria-modal="true" aria-label={big.title}>
          <div className="p-dialog p-dialog--wide">
            <h3>{big.title}</h3>
            <div className="p-work__big">
              <Safe>
                <WorkThumb work={big} />
              </Safe>
            </div>
            <div className="p-row p-row--end">
              <button type="button" onClick={() => setBig(null)}>
                とじる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {del ? (
        <ConfirmDialog
          title="作品を削除します"
          target={`「${del.title}」（${formatDateTime(del.createdAt)}）`}
          message="削除すると元に戻せません。必要な場合は先に「データ」タブで書き出してください。"
          confirmLabel="削除する"
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await db.deleteWork(del.id);
            setDel(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
