/**
 * アプリ全体の状態（いま遊んでいるプロフィール・設定・すき）。保存は core/storage。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import { clearLegacyHand, hasLegacyHand, localKeyStore, migrateLegacyHand } from '../drawing/hand';
import { defaultSettings, type ChildSettings, type ModeId, type Profile } from '../core/types';

export interface AppStateValue {
  ready: boolean;
  /** 保存が使えない（古い版で新しいデータを開いた等） */
  storageUnavailable: boolean;
  profiles: Profile[];
  profile: Profile | null;
  settings: ChildSettings | null;
  favorites: ModeId[];
  /** 「はじめる」を押して音声が有効になったか（このページの間だけ） */
  started: boolean;
  /** 保護者ゲートを通過したか（このページの間だけ。再読み込みで戻る） */
  parentUnlocked: boolean;
  setStarted(v: boolean): void;
  setParentUnlocked(v: boolean): void;
  selectProfile(id: string): Promise<void>;
  updateSettings(s: ChildSettings): Promise<void>;
  toggleFavorite(modeId: ModeId): Promise<boolean>;
  reload(): Promise<void>;
  reduceMotion: boolean;
}

const Ctx = createContext<AppStateValue | null>(null);

/** 初回は架空のプロフィールを1つ作る（名前は保護者画面で変えられる） */
const DEFAULT_PROFILE = { name: 'こども', avatar: 'rabbit' };

/**
 * 起動時の準備（保存を開き、プロフィールが無ければ1つ作る）を1回だけ行う。
 * React の StrictMode などで同時に2回呼ばれても、プロフィールを二重に作らない。
 */
let initPromise: Promise<void> | null = null;
function initOnce(): Promise<void> {
  initPromise ??= (async () => {
    await db.openStorage();
    if (db.getStorageHealth() === 'unavailable') return;
    if ((await db.listProfiles()).length === 0) {
      await db.createProfile(DEFAULT_PROFILE.name, DEFAULT_PROFILE.avatar);
    }
  })();
  return initPromise;
}

function systemReduceMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setUnavailable] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<ChildSettings | null>(null);
  const [favorites, setFavorites] = useState<ModeId[]>([]);
  const [started, setStarted] = useState(false);
  const [parentUnlocked, setParentUnlocked] = useState(false);

  const load = useCallback(async () => {
    await initOnce();
    if (db.getStorageHealth() === 'unavailable') {
      // 保存が使えなくても子供は遊べるようにする（DA-07）。記録は残らない一時的なプロフィールを使う。
      // 新しい版のデータ（version）の場合も、書き込まないので壊さない。
      const temp: Profile = { id: 'temp', name: 'こども', avatar: 'rabbit', createdAt: 0 };
      setUnavailable(true);
      setProfiles([temp]);
      setProfile(temp);
      setSettings(defaultSettings(temp.id));
      setReady(true);
      return;
    }
    let list = await db.listProfiles();
    if (list.length === 0) {
      // 置き換えや削除でプロフィールが無くなった場合も、子供の画面が空にならないように
      await db.createProfile(DEFAULT_PROFILE.name, DEFAULT_PROFILE.avatar);
      list = await db.listProfiles();
    }
    const app = await db.getAppRecord();
    const active = list.find((p) => p.id === app.activeProfileId) ?? list[0] ?? null;
    // おえかきの描く手: 2.0 までの端末内の値を設定へ移す（保護者画面・バックアップの対象にする）。
    // 選んでいないプロフィールも移す（保護者画面の表示と書き出しに入れるため）
    const store = localKeyStore();
    const handMoved = new Map<string, ChildSettings>();
    if (store) {
      for (const p of list) {
        if (!hasLegacyHand(p.id, store)) continue;
        const moved = migrateLegacyHand(await db.getSettings(p.id), store);
        if (moved.next) {
          handMoved.set(p.id, moved.next);
          await db.saveSettings(moved.next);
        }
        if (moved.clear && db.getStorageHealth() === 'ok') clearLegacyHand(p.id, store);
      }
    }
    setProfiles(list);
    setProfile(active);
    if (active) {
      // 保存に失敗しても、今回は移した値で使う（端末内の古い値は消していないので次回また移す）
      const s = handMoved.get(active.id) ?? (await db.getSettings(active.id));
      setSettings(s);
      audio.setVolume(s.volume);
      audio.setSfxEnabled(s.sfx);
      setFavorites(await db.getFavorites(active.id));
      if (app.activeProfileId !== active.id) {
        await db.saveAppRecord({ ...app, activeProfileId: active.id });
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectProfile = useCallback(
    async (id: string) => {
      const app = await db.getAppRecord();
      await db.saveAppRecord({ ...app, activeProfileId: id });
      await load();
    },
    [load],
  );

  const updateSettings = useCallback(async (s: ChildSettings) => {
    await db.saveSettings(s);
    setSettings(s);
    audio.setVolume(s.volume);
    audio.setSfxEnabled(s.sfx);
  }, []);

  const toggleFavorite = useCallback(
    async (modeId: ModeId) => {
      if (!profile) return false;
      const on = !favorites.includes(modeId);
      const next = on ? [...favorites, modeId] : favorites.filter((m) => m !== modeId);
      setFavorites(next);
      await db.saveFavorites(profile.id, next);
      return on;
    },
    [favorites, profile],
  );

  const reduceMotion = (settings?.reduceMotion ?? false) || systemReduceMotion();

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      storageUnavailable,
      profiles,
      profile,
      settings,
      favorites,
      started,
      parentUnlocked,
      setStarted,
      setParentUnlocked,
      selectProfile,
      updateSettings,
      toggleFavorite,
      reload: load,
      reduceMotion,
    }),
    [
      ready,
      storageUnavailable,
      profiles,
      profile,
      settings,
      favorites,
      started,
      parentUnlocked,
      selectProfile,
      updateSettings,
      toggleFavorite,
      load,
      reduceMotion,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStateProvider がありません');
  return v;
}
