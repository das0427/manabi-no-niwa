/**
 * おえかきの作品一覧（さくひん。DESINGN.md 19章）。
 * 縮小画像の格子・日付・つくりかけの印。ひらく（再編集）・うつして かく（複製）・すてる（確認つき）。
 * 確認は幼児では2段階（「すてる？」→「ほんとうに？」。X-DR-08）。
 */
import { useEffect, useState } from 'react';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import type { ArtworkRecord } from '../core/types';
import { Illust } from '../illust/Illust';
import { DrawIcon } from './icons';
import { duplicateArtwork } from './persist';
import './drawing.css';

interface Card {
  rec: ArtworkRecord;
  url: string | null;
  dirty: boolean;
}

export function GalleryScreen() {
  const app = useApp();
  const profile = app.profile;
  const [cards, setCards] = useState<Card[] | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; step: 1 | 2 } | null>(null);
  const [reload, setReload] = useState(0);
  // 複製の最中（連打で2つ作らない）
  const [busy, setBusy] = useState(false);
  const preschool = !profile?.audience || ['toddler', 'p4', 'p5'].includes(profile.audience);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const urls: string[] = [];
    void (async () => {
      const t0 = performance.now();
      const list = await db.listArtworks(profile.id);
      const out: Card[] = [];
      for (const rec of list) {
        const b = await db.getArtworkBlob(rec.id, 'thumb');
        const url = b ? URL.createObjectURL(b) : null;
        if (url) urls.push(url);
        out.push({ rec, url, dirty: (rec.doc as { dirty?: boolean } | null)?.dirty === true });
      }
      if (!alive) return;
      setCards(out);
      document.documentElement.dataset.galleryMs = String(Math.round(performance.now() - t0));
    })();
    return () => {
      alive = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [profile, reload]);

  if (!profile) return null;

  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const remove = async (id: string) => {
    try {
      await db.deleteArtwork(id);
      audio.sfx('remove');
    } catch {
      /* 保存の問題は保護者画面に出る */
    }
    setConfirm(null);
    setReload((n) => n + 1);
  };

  return (
    <div className="screen gallery" data-testid="gallery">
      <header className="draw-top">
        <div className="draw-top__group">
          <button
            type="button"
            className="tap tap--wood tap--aux"
            aria-label="おうち"
            data-testid="home-button"
            onClick={() => navigate({ name: 'home' })}
          >
            <Illust id="home" className="tap__icon" decorative />
          </button>
          <p className="draw-state">
            <Illust id="picture" className="tap__icon" decorative />
            <span>さくひん</span>
          </p>
        </div>
        <button
          type="button"
          className="tap tap--main"
          aria-label="あたらしく かく"
          data-testid="gallery-new"
          onClick={() => navigate({ name: 'draw', artId: 'new' })}
        >
          <DrawIcon id="new" className="tap__icon" />
          あたらしく かく
        </button>
      </header>
      <div
        className="gallery-grid"
        role="list"
        data-testid="gallery-grid"
        data-count={cards?.length ?? -1}
      >
        {cards?.map((c) => (
          <div
            key={c.rec.id}
            className="gallery-card"
            role="listitem"
            data-testid="gallery-card"
            data-id={c.rec.id}
          >
            <button
              type="button"
              className="gallery-thumb"
              aria-label={`ひらく ${fmt(c.rec.updatedAt)}`}
              data-testid="gallery-open"
              onClick={() => {
                audio.sfx('tap');
                navigate({ name: 'draw', artId: c.rec.id });
              }}
            >
              {c.url ? <img src={c.url} alt="" draggable={false} /> : null}
              {c.dirty ? (
                <span className="gallery-wip" data-testid="gallery-wip">
                  つくりかけ
                </span>
              ) : null}
            </button>
            <div className="gallery-card__row">
              <span className="gallery-date">{fmt(c.rec.updatedAt)}</span>
              <button
                type="button"
                className="tap tap--white tap--aux"
                aria-label="うつして かく"
                data-testid="gallery-copy"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  audio.sfx('tap');
                  const id = await duplicateArtwork(c.rec.id);
                  setBusy(false);
                  // 複製が終わってからの移動なので、連続の遷移の制限（400ms）は使わない
                  if (id) navigate({ name: 'draw', artId: id }, { force: true });
                }}
              >
                <DrawIcon id="new" className="tap__icon" />
              </button>
              <button
                type="button"
                className="tap tap--white tap--aux"
                aria-label="すてる"
                data-testid="gallery-delete"
                onClick={() => {
                  audio.sfx('tap');
                  setConfirm({ id: c.rec.id, step: 1 });
                }}
              >
                <DrawIcon id="trash" className="tap__icon" />
              </button>
            </div>
          </div>
        ))}
        {cards && cards.length === 0 ? (
          <p className="label-text gallery-empty" data-testid="gallery-empty">
            まだ さくひんが ないよ
          </p>
        ) : null}
      </div>
      {confirm ? (
        <div className="draw-confirm" role="dialog" aria-label="すてる？" data-testid="confirm">
          <div className="draw-confirm__box">
            <DrawIcon id="trash" className="draw-confirm__icon" />
            <p className="label-text">
              {confirm.step === 1 ? 'この えを すてる？' : 'ほんとうに？'}
            </p>
            <div className="row">
              <button
                type="button"
                className="tap tap--white tap--big"
                aria-label="やめる"
                data-testid="confirm-no"
                onClick={() => setConfirm(null)}
              >
                やめる
              </button>
              <button
                type="button"
                className="tap tap--wood tap--big"
                aria-label="すてる"
                data-testid="confirm-yes"
                onClick={() => {
                  if (confirm.step === 1 && preschool) setConfirm({ id: confirm.id, step: 2 });
                  else void remove(confirm.id);
                }}
              >
                すてる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
