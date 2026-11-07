/**
 * 記録の保存に問題があるときに出す、保護者向けの小さな「!」の印（FX16・P-12）。
 * 場所は上の帯の鍵の左、大きさは 3u の円、押せない（子供の操作は止めない）、文は aria-label。
 * v1 のホーム（Home.tsx）にだけあったものと同じ（見た目は home.css の .home-health）。
 * 小学生ホームが使う（幼児ホームも同じ考えで置く）。保存が使えるときは何も出さない。
 */
import { useSyncExternalStore } from 'react';
import * as db from '../core/storage/index';

export function StorageHealthMark() {
  const health = useSyncExternalStore(db.onStorageHealth, db.getStorageHealth);
  if (health === 'ok') return null;
  return (
    <span
      className="home-health"
      role="img"
      aria-label="（保護者の方へ）記録の保存に問題があります。保護者画面のデータを見てください"
      data-testid="home-health"
    >
      !
    </span>
  );
}
