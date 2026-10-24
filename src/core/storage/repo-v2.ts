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

/** 作品と画像を削除する（保護者操作・子供の「すてる」） */
export async function deleteArtwork(id: string): Promise<void> {
  await strict(() =>
    runTx([STORE.artworks, STORE.artworkBlobs], 'readwrite', async (tx) => {
      tx.objectStore(STORE.artworks).delete(id);
      await deleteViaIndex(tx.objectStore(STORE.artworkBlobs).index('artId'), id);
    }),
  );
}
