/**
 * アプリ全体の状態（いま遊んでいるプロフィール・設定・すき）。保存は core/storage。
 *
 * 「遊ぶ人」（profile。子供の画面が使う。保存は AppRecord.activeProfileId）と、保護者画面で「見る人」は別。
 * 保護者画面の中では ParentViewScope が profile・settings・favorites を「見る人」のものに差し替えるので、
 * 保護者画面の各タブ（useApp() を読む）は何も変えずに見る人の記録を扱える。遊ぶ人は替わらない（FX09）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import { clearLegacyHand, hasLegacyHand, localKeyStore, migrateLegacyHand } from '../drawing/hand';
import { defaultSettings, type ChildSettings, type ModeId, type Profile } from '../core/types';
import { DEV_OPEN, devOpenParent } from './devOpen';

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
  /**
   * 保護者画面から戻ったとき、起動画面を「だれが あそぶ？」から始める（2人以上のとき。このページの間だけ）。
   * 起動画面（StartScreen）が読み、選んだら下ろす。
   */
  choosePlayer: boolean;
  setStarted(v: boolean): void;
  setParentUnlocked(v: boolean): void;
  setChoosePlayer(v: boolean): void;
  /** 遊ぶ人を替える（起動画面の「だれが あそぶ？」だけが呼ぶ。保護者画面で見る人を替えるときは使わない） */
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
  // 開発用の ?dev-open（開発サーバーだけ。本番では false に畳まれる）は、起動画面とゲートを通らずに hash の画面を開く
  const [started, setStarted] = useState(DEV_OPEN);
  const [parentUnlocked, setParentUnlocked] = useState(devOpenParent);
  const [choosePlayer, setChoosePlayer] = useState(false);

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
      choosePlayer,
      setStarted,
      setParentUnlocked,
      setChoosePlayer,
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
      choosePlayer,
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

/* ---- 保護者画面で「見る人」（遊ぶ人とは別） ---- */

export interface ParentViewValue {
  /** 保護者画面で見ているプロフィールの id（読み込み前は null）。遊ぶ人（子供の画面のプロフィール）とは別 */
  viewProfileId: string | null;
  /** 見るプロフィールを替える。遊ぶ人は替わらない（保存の activeProfileId も書かない） */
  viewProfile(id: string): void;
}

const ViewCtx = createContext<ParentViewValue | null>(null);

export function useParentView(): ParentViewValue {
  const v = useContext(ViewCtx);
  if (!v) throw new Error('ParentViewScope がありません');
  return v;
}

const NO_FAVORITES: ModeId[] = [];

/** 見る人が遊ぶ人と別のときに読み込む、見る人の設定とすき */
interface OtherView {
  id: string;
  settings: ChildSettings;
  favorites: ModeId[];
}

/**
 * 保護者画面の中だけで、useApp() の profile・settings・favorites を「見る人」のものに差し替える。
 * 保護者画面の各タブはこれまでどおり useApp() を読むだけで、見ているプロフィールの記録・設定を扱える。
 * 見る人を替えても、遊ぶ人（子供の画面のプロフィール。保存の activeProfileId）は替わらない。
 * 保護者画面を開き直すと、見る人は遊ぶ人から始まる。
 *
 * - updateSettings: 見る人が遊ぶ人なら今までどおり。別の人なら、その人の設定だけを保存する（遊ぶ人の設定は変えない）。
 * - reload: 保存を読み直して、見る人の分も読み直す。見る人が削除されたら遊ぶ人に戻る。
 * - 音: 設定の音量・効果音は、見ている人の値で鳴らす（設定を試し聞きできるように）。保護者画面を出るときは、
 *   遊ぶ人の値へ戻す。
 */
export function ParentViewScope({ children }: { children: ReactNode }) {
  const base = useApp();
  const [viewId, setViewId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [other, setOther] = useState<OtherView | null>(null);
  const playing = base.profile;
  const viewed = base.profiles.find((p) => p.id === viewId) ?? playing;
  const viewedId = viewed?.id ?? null;
  const isPlaying = viewedId === (playing?.id ?? null);
  const { storageUnavailable, profiles } = base;

  // 見る人が遊ぶ人と別のとき、その人の設定とすきを読む（保存を読み直したとき・見る人を替えたときにも）
  useEffect(() => {
    if (!viewedId || isPlaying || storageUnavailable) return;
    let alive = true;
    void (async () => {
      const [settings, favorites] = await Promise.all([
        db.getSettings(viewedId),
        db.getFavorites(viewedId),
      ]);
      if (alive) setOther({ id: viewedId, settings, favorites });
    })();
    return () => {
      alive = false;
    };
    // profiles: 保存を読み直す（reload）と新しい配列になる。tick: reload の完了
  }, [viewedId, isPlaying, storageUnavailable, profiles, tick]);

  const viewedSettings = isPlaying
    ? base.settings
    : other && other.id === viewedId
      ? other.settings
      : null;
  const viewedFavorites = isPlaying
    ? base.favorites
    : other && other.id === viewedId
      ? other.favorites
      : NO_FAVORITES;

  const { updateSettings: updatePlaying, reload: reloadBase } = base;
  const updateSettings = useCallback(
    async (s: ChildSettings) => {
      if (isPlaying) return updatePlaying(s);
      await db.saveSettings(s);
      setOther((o) => (o && o.id === s.profileId ? { ...o, settings: s } : o));
    },
    [isPlaying, updatePlaying],
  );
  const reload = useCallback(async () => {
    await reloadBase();
    setTick((t) => t + 1);
  }, [reloadBase]);

  // 音は見ている人の設定で鳴らす。保護者画面を出るときは遊ぶ人の設定へ戻す
  useEffect(() => {
    if (!viewedSettings) return;
    audio.setVolume(viewedSettings.volume);
    audio.setSfxEnabled(viewedSettings.sfx);
  }, [viewedSettings]);
  const playingSettings = useRef(base.settings);
  useEffect(() => {
    playingSettings.current = base.settings;
  }, [base.settings]);
  useEffect(
    () => () => {
      const s = playingSettings.current;
      if (!s) return;
      audio.setVolume(s.volume);
      audio.setSfxEnabled(s.sfx);
    },
    [],
  );

  const appValue = useMemo<AppStateValue>(
    () => ({
      ...base,
      profile: viewed ?? null,
      settings: viewedSettings,
      favorites: viewedFavorites,
      updateSettings,
      reload,
    }),
    [base, viewed, viewedSettings, viewedFavorites, updateSettings, reload],
  );
  const viewValue = useMemo<ParentViewValue>(
    () => ({ viewProfileId: viewedId, viewProfile: setViewId }),
    [viewedId],
  );
  return (
    <Ctx.Provider value={appValue}>
      <ViewCtx.Provider value={viewValue}>{children}</ViewCtx.Provider>
    </Ctx.Provider>
  );
}
