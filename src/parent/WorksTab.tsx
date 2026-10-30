/**
 * 保護者画面「さくひん」（X-PA-03）: おえかきの作品（artworks）と、なぞり・みち の作品（works）。
 * おえかきの作品は縮小画像・更新日時・大きさ・合計容量を出し、大きく見る・削除ができる（architecture.md 7.4）。
 */
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../app/AppState';
import * as db from '../core/storage/index';
import type { ArtworkRecord, WorkRecord } from '../core/types';
import { WorkThumb } from '../modes/workThumb';
import { ConfirmDialog, Note, Section } from './ui';
import { formatBytes, formatDateTime, modeTitle, useLoad } from './util';

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

const isArtDirty = (a: ArtworkRecord): boolean =>
  (a.doc as { dirty?: boolean } | null)?.dirty === true;

/** 作品の画像（thumb / full）を object URL にして表示する */
function ArtImage({ id, kind, alt }: { id: string; kind: 'thumb' | 'full'; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void db.getArtworkBlob(id, kind).then((b) => {
      if (!alive || !b) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, kind]);
  return url ? (
    <img src={url} alt={alt} className="p-art__img" />
  ) : (
    <span className="p-muted">（画像なし）</span>
  );
}

/** おえかきの作品の一覧（大きく見る・削除・容量） */
function ArtworksSection({ profileId }: { profileId: string }) {
  const load = useCallback(async () => {
    const [arts, bytes] = await Promise.all([
      db.listArtworks(profileId),
      db.artworkBytes(profileId),
    ]);
    return { arts, bytes };
  }, [profileId]);
  const { data, reload } = useLoad(load);
  const [big, setBig] = useState<ArtworkRecord | null>(null);
  const [del, setDel] = useState<ArtworkRecord | null>(null);
  if (!data) return <p>読み込み中…</p>;
  const total = Object.values(data.bytes).reduce((a, b) => a + b, 0);
  return (
    <Section title={`おえかきの作品（${data.arts.length}）`}>
      <Note>
        合計の大きさ: <span data-testid="art-total-bytes">{formatBytes(total)}</span>
        。作品が増えると端末の容量を使います。残したい作品は「データ」タブで書き出してから削除してください。インクの層が6枚を超えると古い線とはんこ・図形は背景に焼き付き、動かせなくなります。
      </Note>
      {data.arts.length === 0 ? <p className="p-muted">まだ作品がありません。</p> : null}
      <ul className="p-works">
        {data.arts.map((a) => (
          <li key={a.id} data-testid={`art-${a.id}`}>
            <div className="p-work__thumb">
              <ArtImage id={a.id} kind="thumb" alt="" />
            </div>
            <div className="p-work__title">
              おえかき
              {isArtDirty(a) ? <span className="p-badge p-badge--idle">つくりかけ</span> : null}
            </div>
            <div className="p-muted p-small">
              {formatDateTime(a.updatedAt)}&emsp;{formatBytes(data.bytes[a.id] ?? 0)}
            </div>
            <div className="p-row">
              <button type="button" onClick={() => setBig(a)} data-testid={`art-big-${a.id}`}>
                大きく見る
              </button>
              <button type="button" onClick={() => setDel(a)} data-testid={`art-delete-${a.id}`}>
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
      {big ? (
        <div className="p-backdrop" role="dialog" aria-modal="true" aria-label="おえかきの作品">
          <div className="p-dialog p-dialog--wide">
            <h3>おえかき（{formatDateTime(big.updatedAt)}）</h3>
            <div className="p-work__big">
              <ArtImage id={big.id} kind="full" alt="おえかきの作品" />
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
          target={`おえかき（${formatDateTime(del.updatedAt)}）`}
          message="削除すると元に戻せません。必要な場合は先に「データ」タブで書き出してください。"
          confirmLabel="削除する"
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await db.deleteArtwork(del.id);
            setDel(null);
            reload();
          }}
        />
      ) : null}
    </Section>
  );
}

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
      <ArtworksSection profileId={pid} />
      <Section title={`なぞり・みちの作品（${works.length}）`}>
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
