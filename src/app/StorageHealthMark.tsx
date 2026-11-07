/**
 * 記録の保存に問題があるときに出す、保護者向けの小さな「!」の印（FX16・P-12）。
 * 場所は上の帯の鍵の左、大きさは 3u の円、押せない（子供の操作は止めない）、文は aria-label。
 * 見た目は home.css の .home-health。幼児ホーム（PreschoolHome）・小学生ホーム（SchoolHome）・
 * v1 のホーム（Home）の3つがこの部品を使う（文・見た目・動きを1か所で揃える）。保存が使えるときは何も出さない。
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
