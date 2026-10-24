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
import type { ChildSettings, ModeId, Profile } from '../core/types';

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
      setUnavailable(true);
      setReady(true);
      return;
    }
    const list = await db.listProfiles();
    const app = await db.getAppRecord();
    const active = list.find((p) => p.id === app.activeProfileId) ?? list[0] ?? null;
    setProfiles(list);
    setProfile(active);
    if (active) {
      const s = await db.getSettings(active.id);
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
