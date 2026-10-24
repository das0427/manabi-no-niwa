/**
 * アプリ本体の E2E で共通に使う補助（起動・IndexedDB の読み書き・保護者ゲート）。
 * IndexedDB の直接操作はテスト専用（architecture.md 10章の仕組みとあわせて使う）。
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { defaultSettings } from '../../src/core/types';
import type { ChildSettings, SkillId } from '../../src/core/types';

export const DB_NAME = 'manabi-no-niwa';

/** テスト用フラグ（window.__mnw）を有効にして開く。「はじめる」が押せるまで待つ */
export async function gotoApp(page: Page, opts: { seed?: number } = {}): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mnw:test', '1');
    } catch {
      /* 無視 */
    }
  });
  await page.goto(`/?seed=${opts.seed ?? 1}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
}

/** 「はじめる」→ ホーム */
export async function start(page: Page): Promise<void> {
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('home')).toBeVisible();
}

/** gotoApp + start */
export async function boot(page: Page, opts: { seed?: number } = {}): Promise<void> {
  await gotoApp(page, opts);
  await start(page);
}

// ---------------------------------------------------------------- IndexedDB（テスト専用）

export function idbGetAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    ([name, s]) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open(name!);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(s!, 'readonly').objectStore(s!).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        };
      }),
    [DB_NAME, store],
  ) as Promise<T[]>;
}

export function idbPutMany(page: Page, store: string, values: unknown[]): Promise<void> {
  return page.evaluate(
    ([name, s, vals]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name as string);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(s as string, 'readwrite');
          const os = tx.objectStore(s as string);
          for (const v of vals as unknown[]) os.put(v);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    [DB_NAME, store, values] as const,
  );
}

export interface AttemptRow {
  id: number;
  profileId: string;
  modeId: string;
  variantId: string;
  skillId: string | null;
  level: number;
  itemKey: string;
  outcome: string;
  wrongTries: number;
  hintsUsed: number;
  operationIssue: boolean;
  inputKind: string;
  at: number;
}

export async function attemptsOf(page: Page, modeId?: string): Promise<AttemptRow[]> {
  const all = await idbGetAll<AttemptRow>(page, 'attempts');
  return all.filter((a) => modeId === undefined || a.modeId === modeId).sort((a, b) => a.at - b.at);
}

export async function activeProfileId(page: Page): Promise<string> {
  const app = (await idbGetAll<{ activeProfileId: string | null }>(page, 'app'))[0];
  if (app?.activeProfileId) return app.activeProfileId;
  const profiles = await idbGetAll<{ id: string }>(page, 'profiles');
  return profiles[0]!.id;
}

export interface PrepareOpts {
  /** スキルの段階の固定（levelLocks）と、進度の段階を同時に設定する */
  levels?: Partial<Record<SkillId, number>>;
  /** 「取り組んだ」印だけ付ける（しき（たす）等の解放に使う） */
  attempted?: SkillId[];
  settings?: Partial<ChildSettings>;
  rounds?: {
    modeId: string;
    variantId: string;
    startedAt: number;
    endedAt: number;
    count: number;
  }[];
  /** 進度の記録をそのまま入れる */
  progress?: Record<string, unknown>[];
  attempts?: Record<string, unknown>[];
}

/**
 * 起動画面の状態（初回プロフィール作成済み）から、設定・進度・記録を書き込んで再読み込みする。
 * 呼び出し後は「はじめる」を押す前の状態。
 */
export async function prepare(page: Page, opts: PrepareOpts): Promise<string> {
  const pid = await activeProfileId(page);
  const existing = (await idbGetAll<ChildSettings>(page, 'settings')).find(
    (s) => s.profileId === pid,
  );
  const base: ChildSettings = existing ?? defaultSettings(pid);
  const locks = { ...base.levelLocks };
  for (const [k, v] of Object.entries(opts.levels ?? {})) locks[k as SkillId] = v;
  const settings: ChildSettings = { ...base, ...opts.settings, levelLocks: locks };
  await idbPutMany(page, 'settings', [settings]);

  const now = Date.now();
  const progress: Record<string, unknown>[] = [];
  for (const [k, v] of Object.entries(opts.levels ?? {})) {
    progress.push({
      profileId: pid,
      skillId: k,
      level: v,
      window: [],
      mastered: false,
      attempted: false,
      changedAt: now,
      lastChange: null,
    });
  }
  for (const k of opts.attempted ?? []) {
    progress.push({
      profileId: pid,
      skillId: k,
      level: 0,
      window: [],
      mastered: false,
      attempted: true,
      changedAt: now,
      lastChange: null,
    });
  }
  for (const p of opts.progress ?? []) progress.push({ profileId: pid, ...p });
  if (progress.length > 0) await idbPutMany(page, 'progress', progress);
  if (opts.rounds?.length) {
    await idbPutMany(
      page,
      'rounds',
      opts.rounds.map((r) => ({ profileId: pid, completed: true, ...r })),
    );
  }
  if (opts.attempts?.length) {
    await idbPutMany(
      page,
      'attempts',
      opts.attempts.map((a) => ({ profileId: pid, inputKind: 'mouse', ...a })),
    );
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
  return pid;
}

// ---------------------------------------------------------------- 画面の移動

/**
 * 画面遷移のボタンを押す。アプリは直前の遷移から 400ms 以内の遷移を無視する（OP-05）ため、
 * 目的の画面が出るまで押し直す（固定の待ちは使わない）。
 */
export async function clickUntil(
  page: Page,
  button: Locator,
  target: Locator,
  tap = false,
): Promise<void> {
  void page;
  await expect(async () => {
    if (await button.isVisible()) {
      if (tap) await button.tap({ timeout: 2000 });
      else await button.click({ timeout: 2000 });
    }
    await expect(target).toBeVisible({ timeout: 1200 });
  }).toPass({ timeout: 15_000, intervals: [100, 300, 500] });
}

/** 4歳のホームの札から、初期版のモードをそのまま使う単元（src/packs/p4） */
const CLASSIC_UNIT_OF: Record<string, string> = {
  hiragana: 'p4.ja.hiragana-classic',
  math: 'p4.math.classic',
  sorting: 'p4.think.sort',
  trace: 'p4.hand.lines',
};

/**
 * ホームから遊びを開く。遊び方が複数あって選択画面が出たときだけ variantId を選ぶ
 * （解放前は1つしかなく、選択画面を飛ばして始まる）。
 */
export async function openMode(
  page: Page,
  modeId: string,
  variantId?: string,
  tap = false,
): Promise<void> {
  const modeScreen = page.getByTestId(`mode-${modeId}`).or(page.getByTestId('resume-prompt'));
  const picker = page.getByTestId('variant-picker');
  const chooser = page.locator('[data-testid^="card-chooser-"]');
  await clickUntil(
    page,
    page.getByTestId(`home-mode-${modeId}`),
    modeScreen.or(picker).or(chooser),
    tap,
  );
  // 4歳のホーム: 札に単元が複数あるときは選ぶ画面が出る。初期版のモードを使う単元を選ぶ
  if (await chooser.isVisible()) {
    const unitId =
      modeId === 'trace' && variantId === 'letters'
        ? 'p4.hand.letters-classic'
        : CLASSIC_UNIT_OF[modeId];
    if (!unitId) throw new Error(`初期版の単元が無い: ${modeId}`);
    await clickUntil(page, page.getByTestId(`card-unit-${unitId}`), modeScreen.or(picker), tap);
  }
  if (variantId && (await picker.isVisible())) {
    await clickUntil(page, page.getByTestId(`variant-${variantId}`), modeScreen, tap);
  }
  await expect(modeScreen).toBeVisible();
}
export async function histLen(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __mnw?: { history: unknown[] } }).__mnw?.history.length ?? 0,
  );
}

export interface Exposed {
  modeId: string;
  variantId: string;
  level: number;
  data: Record<string, unknown>;
}

export async function currentExposed(page: Page): Promise<Exposed> {
  return page.evaluate(
    () => (window as unknown as { __mnw: { current: unknown } }).__mnw.current,
  ) as Promise<Exposed>;
}

/** 保護者ゲートを通って保護者画面を開く（2秒長押し → 計算問題） */
export async function openParent(page: Page, tab?: string): Promise<void> {
  const key = page.getByTestId('parent-key');
  await expect(key).toBeVisible();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('parent-gate')).toBeVisible({ timeout: 6000 });
  await page.mouse.up();
  await answerGate(page);
  await expect(page.getByTestId('parent-app')).toBeVisible();
  if (tab && tab !== 'records') {
    await page.getByTestId(`parent-tab-${tab}`).click();
  }
}

/** 計算問題の文（「a ＋ b は？」）から足し算して入力する */
export async function answerGate(page: Page, opts: { wrongFirst?: boolean } = {}): Promise<void> {
  const q = page.getByTestId('gate-question');
  await expect(q).toContainText('＋');
  const m = /(\d+)\s*＋\s*(\d+)/.exec((await q.textContent()) ?? '');
  expect(m).not.toBeNull();
  const answer = String(Number(m![1]) + Number(m![2]));
  if (opts.wrongFirst) {
    await page.getByTestId('gate-key-1').click();
    await page.getByTestId('gate-key-OK').click();
    await expect(page.locator('.gate-error')).toBeVisible();
    await page.getByTestId('gate-key-けす').click();
  }
  for (const ch of answer) await page.getByTestId(`gate-key-${ch}`).click();
  await page.getByTestId('gate-key-OK').click();
}

export async function lastBubble(page: Page): Promise<Locator> {
  return page.locator('.bubble').first();
}
