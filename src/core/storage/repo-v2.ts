/**
 * スキーマ2で増えたストアの読み書き（単元の進度・おえかきの作品）。
 * 規約は repo.ts と同じ: 通常の保存は reject しない／保護者操作系（削除）は reject する。
 */
import { initialReview } from '../../curriculum/review';
import type { ArtworkBlobKind, ArtworkBlobRecord, ArtworkRecord, UnitProgress } from '../types';
import { STORE, collect, deleteViaIndex, r, runTx, safeRead, safeWrite, strict } from './db';

// ---- 単元の進度 ----
export function emptyUnitProgress(profileId: string, unitId: string): UnitProgress {
  return {
    profileId,
    unitId,
    level: 0,
    window: [],
    mastered: false,
    attempted: false,
    changedAt: 0,
    lastChange: null,
    review: { ...initialReview },
  };
}

export async function getUnitProgress(profileId: string, unitId: string): Promise<UnitProgress> {
  const empty = emptyUnitProgress(profileId, unitId);
  return safeRead(async () => {
    const v = await runTx([STORE.unitProgress], 'readonly', (tx) =>
      r<UnitProgress | undefined>(tx.objectStore(STORE.unitProgress).get([profileId, unitId])),
    );
    return v ?? empty;
  }, empty);
}

export async function listUnitProgress(profileId: string): Promise<UnitProgress[]> {
  return safeRead(
    () =>
      runTx([STORE.unitProgress], 'readonly', (tx) =>
        collect<UnitProgress>(
          tx.objectStore(STORE.unitProgress),
          IDBKeyRange.bound([profileId], [profileId, []]),
        ),
      ),
    [],
  );
}

export async function saveUnitProgress(p: UnitProgress): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.unitProgress], 'readwrite', (tx) => {
      tx.objectStore(STORE.unitProgress).put(p);
    }),
  );
}

// ---- おえかきの作品 ----
/** 作品の一覧（更新の新しい順。文書は含むが画像は含まない） */
export async function listArtworks(profileId: string): Promise<ArtworkRecord[]> {
  return safeRead(
    () =>
      runTx([STORE.artworks], 'readonly', (tx) =>
        collect<ArtworkRecord>(
          tx.objectStore(STORE.artworks).index('profileId_updatedAt'),
          IDBKeyRange.bound([profileId, -Infinity], [profileId, Infinity]),
          'prev',
        ),
      ),
    [],
  );
}

export async function getArtwork(id: string): Promise<ArtworkRecord | undefined> {
  return safeRead(
    () =>
      runTx([STORE.artworks], 'readonly', (tx) =>
        r<ArtworkRecord | undefined>(tx.objectStore(STORE.artworks).get(id)),
      ),
    undefined,
  );
}

export async function getArtworkBlob(
  artId: string,
  kind: ArtworkBlobKind,
): Promise<Blob | undefined> {
  return safeRead(async () => {
    const v = await runTx([STORE.artworkBlobs], 'readonly', (tx) =>
      r<ArtworkBlobRecord | undefined>(tx.objectStore(STORE.artworkBlobs).get(`${artId}:${kind}`)),
    );
    return v?.blob;
  }, undefined);
}

/**
 * 作品と画像を1つのトランザクションで保存する（文書と画像の食い違いを作らない）。
 * 保存の成否を返す（おえかき画面の「ほぞん状態」の表示に使う）。
 */
export async function saveArtwork(
  art: ArtworkRecord,
  blobs: Partial<Record<ArtworkBlobKind, Blob>>,
): Promise<boolean> {
  let ok = false;
  await safeWrite(async () => {
    await runTx([STORE.artworks, STORE.artworkBlobs], 'readwrite', (tx) => {
      tx.objectStore(STORE.artworks).put(art);
      const st = tx.objectStore(STORE.artworkBlobs);
      for (const [kind, blob] of Object.entries(blobs) as [ArtworkBlobKind, Blob][]) {
        const rec: ArtworkBlobRecord = {
          key: `${art.id}:${kind}`,
          artId: art.id,
          profileId: art.profileId,
          kind,
          blob,
        };
        st.put(rec);
      }
    });
    ok = true;
  });
  return ok;
}

export type CheckedSaveResult = 'ok' | 'conflict' | 'error';

/**
 * おえかきの自動保存用（review-1 #33・X-SV-10）。1つのトランザクションで:
 * - 保存済みの updatedAt が expectUpdatedAt より新しければ（別のタブが保存した）何も書かず 'conflict'
 *   （expectUpdatedAt=null は「まだ保存していない新しい作品」。既にあれば conflict）
 * - 作品と画像を書く。keep を渡したときは、keep と blobs のどちらにも無い種類の画像を消す
 *   （焼き付けで無くなったインクの層の画像を残さない）
 */
export async function saveArtworkChecked(
  art: ArtworkRecord,
  blobs: Partial<Record<ArtworkBlobKind, Blob>>,
  opts: { expectUpdatedAt: number | null; keep?: ArtworkBlobKind[] },
): Promise<CheckedSaveResult> {
  let result: CheckedSaveResult = 'error';
  await safeWrite(async () => {
    result = await runTx([STORE.artworks, STORE.artworkBlobs], 'readwrite', async (tx) => {
      const arts = tx.objectStore(STORE.artworks);
      const cur = await r<ArtworkRecord | undefined>(arts.get(art.id));
      if (cur && (opts.expectUpdatedAt === null || cur.updatedAt > opts.expectUpdatedAt)) {
        return 'conflict' as const;
      }
      arts.put(art);
      const st = tx.objectStore(STORE.artworkBlobs);
      for (const [kind, blob] of Object.entries(blobs) as [ArtworkBlobKind, Blob][]) {
        const rec: ArtworkBlobRecord = {
          key: `${art.id}:${kind}`,
          artId: art.id,
          profileId: art.profileId,
          kind,
          blob,
        };
        st.put(rec);
      }
      if (opts.keep) {
        const keep = new Set<string>([...opts.keep, ...Object.keys(blobs)]);
        const keys = await r<IDBValidKey[]>(st.index('artId').getAllKeys(art.id));
        const prefix = `${art.id}:`;
        for (const k of keys) {
          const kind = String(k).slice(prefix.length);
          if (!keep.has(kind)) st.delete(k);
        }
      }
      return 'ok' as const;
    });
  });
  return result;
}

/** 作品の画像の種類の一覧（その作品に保存されている物） */
export async function listArtworkBlobKinds(artId: string): Promise<ArtworkBlobKind[]> {
  return safeRead(async () => {
    const keys = await runTx([STORE.artworkBlobs], 'readonly', (tx) =>
      r<IDBValidKey[]>(tx.objectStore(STORE.artworkBlobs).index('artId').getAllKeys(artId)),
    );
    return keys.map((k) => String(k).slice(artId.length + 1) as ArtworkBlobKind);
  }, []);
}

/** 作品と画像を削除する（保護者操作・子供の「すてる」） */
export async function deleteArtwork(id: string): Promise<void> {
  await strict(() =>
    runTx([STORE.artworks, STORE.artworkBlobs], 'readwrite', async (tx) => {
      tx.objectStore(STORE.artworks).delete(id);
      await deleteViaIndex(tx.objectStore(STORE.artworkBlobs).index('artId'), id);
    }),
  );
}
