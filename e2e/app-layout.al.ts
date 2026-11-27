/**
 * アプリの全画面 × プロフィール 13 通り × 画面サイズ 4 通り × 状態（fresh・full）の配置の検査。
 * npm run check:app-layout（playwright.app-layout.config.ts）。違反は失敗にしない。docs/test-plan.md 3.3。
 *
 * - 画面の一覧と行き方は helpers/app-layout.ts の screenDefs（AC-4）。開発用の指定 ?dev-open で、起動画面と
 *   保護者ゲートを通らずに開く（src/app/devOpen.ts）。板（ゲート・おえかきの板・確認）は板の中だけを見る。
 * - 1 プロフィール = 1 テスト（workers で並列）。プロフィールの設定と中身は IndexedDB に直接書いて読み込み直す
 *   （helpers/app-layout-fixtures.ts）。fresh と full は別の context（別の IndexedDB）で流す。
 * - 結果はプロフィールごとに .cache/app-layout/<プロフィール>.json に、画面を 1 つ終えるごとに書く。
 *   同じ条件（プロフィール・状態・画面・サイズ・ソースの更新時刻）の結果があれば飛ばす（途中から再開）。
 *   全部が終わると globalTeardown（helpers/app-layout-report.ts）が要約を作る。
 * - 文字の重なり・切れ・改行は textLayoutProbe、アプリの画面に特有のもの（押せない・押す大きさ・スクロールの印）は
 *   appLayoutProbe。保護者画面は scrollTop を clientHeight × 0.8 ずつずらして、そのたびに検査して同じ違反をまとめる。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import {
  APP_SIZES,
  inspectApp,
  openScreen,
  readLegacyVariants,
  screenDefs,
  settleApp,
} from './helpers/app-layout';
import type { ScreenDef, ScreenEnv } from './helpers/app-layout';
import {
  globFilter,
  PROFILES,
  seedArtworks,
  seedProfile,
  UNITS,
  type ProfileSpec,
} from './helpers/app-layout-fixtures';
import { APP_CACHE_DIR, APP_REPORT_DIR } from './helpers/app-layout-report';
import type {
  ProfileResult,
  ReportIssue,
  ScreenResult,
  ScreenRow,
} from './helpers/app-layout-report';
import { inspectText, screenshotWithMarks } from './helpers/text-layout';

const ROOT = path.resolve(import.meta.dirname, '..');
const FRESH = process.env.MNW_FRESH === '1';
const profileOk = globFilter(process.env.MNW_APP_PROFILES);
const screenOk = globFilter(process.env.MNW_APP_SCREENS);
/** 種類ごとの代表のスクリーンショットの枚数（全体）。1 画面 1 種類につき 1 枚まで */
const SHOTS_PER_KIND = Number(process.env.MNW_SHOTS) || 8;

const cacheDir = path.join(ROOT, APP_CACHE_DIR);
const shotsDir = path.join(ROOT, APP_REPORT_DIR, 'shots');

// ---------------------------------------------------------------- 途中からの再開

/** 検査の結果に効くものの更新時刻の最大。これが変わったら、前の結果は使わない */
const STAMP_DIRS = [
  'src/app',
  'src/parent',
  'src/drawing',
  'src/ui',
  'src/styles',
  'src/text',
  'src/curriculum',
  'src/illust',
];
const STAMP_FILES = [
  'e2e/helpers/app-layout.ts',
  'e2e/helpers/app-layout-fixtures.ts',
  'e2e/helpers/text-layout.ts',
];
function newest(p: string): number {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return 0;
  if (!st.isDirectory()) return st.mtimeMs;
  let m = 0;
  for (const name of readdirSync(p)) {
    if (/\.test\.tsx?$/.test(name)) continue;
    m = Math.max(m, newest(path.join(p, name)));
  }
  return m;
}
const STAMP = Math.round(
  Math.max(
    ...STAMP_DIRS.map((d) => newest(path.join(ROOT, d))),
    ...STAMP_FILES.map((f) => newest(path.join(ROOT, f))),
  ),
);
const SIZES_KEY = APP_SIZES.map(([w, h]) => `${w}x${h}`).join(',');
const screenKey = (spec: ProfileSpec, d: ScreenDef) =>
  `${STAMP}|${spec.key}|${d.state}|${d.id}|${SIZES_KEY}`;
const slot = (d: ScreenDef) => `${d.state}:${d.id}`;

// ---------------------------------------------------------------- スクリーンショット

function shotFiles(): string[] {
  if (!existsSync(shotsDir)) return [];
  return readdirSync(shotsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) =>
      readdirSync(path.join(shotsDir, e.name)).map((f) => path.join(shotsDir, e.name, f)),
    );
}
/** 前の実行の画像を消す（違反が 0 になった種類に古い画像が残らないように）。prefix で始まる名前だけ */
function removeShots(prefix: string): void {
  for (const f of shotFiles()) if (path.basename(f).startsWith(prefix)) rmSync(f, { force: true });
}
/** 種類ごとに全体 SHOTS_PER_KIND 枚・同じ画面 ID は 1 枚まで */
function wantShot(kind: string, id: string): string | null {
  const dir = path.join(shotsDir, kind);
  const have = existsSync(dir) ? readdirSync(dir) : [];
  if (have.length >= SHOTS_PER_KIND) return null;
  if (have.some((f) => f.includes(`__${id}__`))) return null;
  return dir;
}

// ---------------------------------------------------------------- 検査

type Shoot = (issues: ReportIssue[], scrollY: number) => Promise<void>;

/** 1 つの状態（画面サイズ・スクロールの位置）で、文字の配置の検査とアプリの画面の検査を当てる */
async function inspectOnce(
  page: Page,
  def: ScreenDef,
  spec: ProfileSpec,
  stable: boolean,
): Promise<ReportIssue[]> {
  const common = {
    ...(def.root ? { root: def.root } : {}),
    ...(def.adultSel ? { adultSel: def.adultSel } : {}),
    ...(def.pageScroll ? { pageScroll: def.pageScroll } : {}),
    maxPerKind: 40,
  };
  const t = await inspectText(page, { stage: def.stage, ...common });
  const a = await inspectApp(page, { viewer: spec.stage, ...common });
  let issues: ReportIssue[] = [...a.issues, ...t.issues];
  // 同じ枠の二重の報告を除く: 印の無いスクロールの枠は、アプリの画面の scroll-no-cue に任せる
  const noCue = new Set(a.issues.filter((i) => i.kind === 'scroll-no-cue').map((i) => i.where));
  issues = issues.filter(
    (i) =>
      !(
        i.kind === 'scroll-hidden' &&
        /data-scroll-cue/.test(i.detail ?? '') &&
        noCue.has(i.where.replace('（data-scroll-region）', ''))
      ),
  );
  if (!stable)
    for (const i of issues)
      i.detail = `unstable: 描き直しが 1 秒たっても終わらない${i.detail ? `／${i.detail}` : ''}`;
  return issues;
}

/**
 * 画面全体がスクロールする画面（保護者画面）は、scrollTop を 0 から clientHeight × 0.8 ずつずらして、
 * そのたびに検査する。同じ違反（種類・文字・場所）は最初の位置の 1 件にまとめる。
 */
async function inspectScreen(
  page: Page,
  def: ScreenDef,
  spec: ProfileSpec,
  stable: boolean,
  shoot: Shoot,
): Promise<{ rows: { scrollY: number; issues: ReportIssue[] }[]; checks: number }> {
  if (!def.pageScroll) {
    const issues = await inspectOnce(page, def, spec, stable);
    await shoot(issues, 0);
    return { rows: issues.length ? [{ scrollY: 0, issues }] : [], checks: 1 };
  }
  const dims = await page.evaluate((sel) => {
    const e = document.querySelector(sel);
    return e ? { sh: e.scrollHeight, ch: e.clientHeight } : null;
  }, def.pageScroll);
  const rows: { scrollY: number; issues: ReportIssue[] }[] = [];
  const seen = new Set<string>();
  let checks = 0;
  const step = Math.max(50, Math.floor((dims?.ch ?? 600) * 0.8));
  const maxY = dims ? Math.max(0, dims.sh - dims.ch) : 0;
  try {
    for (let y = 0; ; y += step) {
      const at = Math.min(y, maxY);
      await page.evaluate(
        ([sel, top]) => {
          const e = document.querySelector(sel as string);
          if (e) e.scrollTop = top as number;
        },
        [def.pageScroll, at] as const,
      );
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
      const issues = (await inspectOnce(page, def, spec, stable)).filter((i) => {
        const key = `${i.kind}|${i.text}|${i.where}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      checks++;
      for (const i of issues) i.scrollY = at;
      await shoot(issues, at);
      if (issues.length) rows.push({ scrollY: at, issues });
      if (at >= maxY) break;
    }
  } finally {
    await page.evaluate((sel) => {
      const e = document.querySelector(sel);
      if (e) e.scrollTop = 0;
    }, def.pageScroll);
  }
  return { rows, checks };
}

// ---------------------------------------------------------------- 1 プロフィール

test.describe.configure({ mode: 'parallel' });

for (const spec of PROFILES.filter((p) => profileOk(p.key))) {
  test(spec.key, async ({ browser, baseURL }) => {
    const file = path.join(cacheDir, `${spec.key}.json`);
    const result: ProfileResult =
      !FRESH && existsSync(file)
        ? (JSON.parse(readFileSync(file, 'utf8')) as ProfileResult)
        : {
            profile: spec.key,
            note: spec.note,
            stage: spec.stage,
            startedAt: 0,
            ms: 0,
            screens: {},
            errors: [],
          };
    result.note = spec.note;
    result.stage = spec.stage;

    const defs = screenDefs(spec).filter((d) => screenOk(d.id));
    const todo = defs.filter((d) => FRESH || result.screens[slot(d)]?.key !== screenKey(spec, d));
    if (todo.length === 0) {
      test.skip(true, '前回の結果あり（MNW_FRESH=1 ではじめから）');
      return;
    }
    // この実行で作り直す画面の古い画像を消す。全部を作り直すとき（FRESH・画面を絞らない）は、このプロフィールの画像を全部
    if (FRESH && !process.env.MNW_APP_SCREENS) removeShots(`${spec.key}__`);
    for (const d of todo) removeShots(`${spec.key}__${d.state}__${d.id}__`);

    const t0 = Date.now();
    result.startedAt = t0;
    // この実行で作り直さない画面の結果は残す。作り直す画面は消す
    for (const d of todo) delete result.screens[slot(d)];
    const prevMs = result.ms;
    const errored: string[] = [];
    const save = () => {
      result.ms = prevMs + (Date.now() - t0);
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, `${JSON.stringify(result)}\n`);
    };

    for (const state of ['fresh', 'full'] as const) {
      const list = todo.filter((d) => d.state === state);
      if (list.length === 0) continue;
      await runState(browser, baseURL!, spec, state, list, result, errored, save);
    }
    save();
    if (errored.length)
      throw new Error(
        `画面を開けない／検査できない ${errored.length} 件（結果は .cache に残した）: ${errored.slice(0, 5).join(' ／ ')}`,
      );
  });
}

/** 1 つの状態（fresh・full）の context を作り、プロフィールを書き込んで、画面を順に検査する */
async function runState(
  browser: Browser,
  baseURL: string,
  spec: ProfileSpec,
  state: 'fresh' | 'full',
  list: ScreenDef[],
  result: ProfileResult,
  errored: string[],
  save: () => void,
): Promise<void> {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: APP_SIZES[0]![0], height: APP_SIZES[0]![1] },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  page.on('pageerror', (e) => {
    if (result.errors.length < 40)
      result.errors.push(`pageerror (${state}): ${String(e.message).slice(0, 300)}`);
  });
  try {
    // 起動して（プロフィールが 1 人できる）、設定と中身を書き込んで読み込み直す
    let legacy: Record<string, string[]>;
    try {
      await page.goto('/?seed=1', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="start-button"]:not([disabled])');
      legacy = await readLegacyVariants(
        page,
        UNITS.filter((u) => u.legacy && u.stage === spec.stage).map((u) => ({
          id: u.id,
          modeId: u.legacy!.modeId,
          ...(u.legacy!.variants ? { variants: u.legacy!.variants } : {}),
        })),
      );
      await seedProfile(page, spec, state, { legacyVariants: legacy });
      await page.goto('about:blank');
      if (state === 'full' && list.some((d) => /^(gallery|parent-works)/.test(d.id))) {
        await page.goto('/?dev-open&seed=1#/home', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="home"], [data-testid="school-home"]');
        await seedArtworks(page, 18);
      }
    } catch (e) {
      // 準備に失敗したら、この状態の画面は全部「開けない」として残す（もう一方の状態は続ける）
      const note = `準備に失敗: ${String((e as Error).message).split('\n')[0]}`;
      for (const def of list) {
        result.screens[slot(def)] = {
          id: def.id,
          state: def.state,
          stage: def.stage,
          key: screenKey(spec, def),
          status: 'error',
          note,
          rows: [],
          checks: 0,
          ms: 0,
        };
        errored.push(`${spec.key} ${state}:${def.id}: ${note}`);
      }
      save();
      return;
    }

    const env: ScreenEnv = { spec, state, legacy };
    const dirty = { value: true };
    let flip = false;
    for (const def of list) {
      const t0 = Date.now();
      const sr: ScreenResult = {
        id: def.id,
        state: def.state,
        stage: def.stage,
        key: screenKey(spec, def),
        status: 'ok',
        rows: [],
        checks: 0,
        ms: 0,
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          runScreen(page, def, env, dirty, sr, flip),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('1 画面の検査が 180 秒を超えた')), 180_000);
          }),
        ]);
        flip = !flip;
      } catch (e) {
        sr.status = 'error';
        sr.note = String((e as Error).message).split('\n')[0];
        errored.push(`${spec.key} ${state}:${def.id}: ${sr.note}`);
        dirty.value = true;
        // 固まった画面から抜ける
        await page.goto('about:blank').catch(() => undefined);
      } finally {
        clearTimeout(timer);
      }
      sr.ms = Date.now() - t0;
      result.screens[slot(def)] = sr;
      save();
    }
  } finally {
    await ctx.close().catch(() => undefined);
  }

  /** 画面を 1 つ開いて、4 つの画面サイズで検査する */
  async function runScreen(
    p: Page,
    def: ScreenDef,
    e: ScreenEnv,
    dirty: { value: boolean },
    sr: ScreenResult,
    reverse: boolean,
  ): Promise<void> {
    const st = await openScreen(p, def, e, dirty);
    if (st === 'skipped') {
      sr.status = 'skipped';
      sr.note = 'このプロフィールには出ない画面（遊び方の選ぶ画面が出ない単元）';
      return;
    }
    if (st === 'unsupported') {
      sr.status = 'unsupported';
      sr.note = '未対応（開発用の指定 ?dev-setup が画面に効いていない。A5 のあとに出る）';
      return;
    }
    const order = reverse ? [...APP_SIZES].reverse() : APP_SIZES;
    for (const [w, h] of order) {
      const vp = p.viewportSize();
      if (!vp || vp.width !== w || vp.height !== h)
        await p.setViewportSize({ width: w, height: h });
      const stable = await settleApp(p);
      const size = `${w}x${h}`;
      const shoot: Shoot = async (issues, scrollY) => {
        const byKind = new Map<string, ReportIssue[]>();
        for (const i of issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
        for (const [kind, ls] of byKind) {
          const dir = wantShot(kind, def.id);
          if (!dir) continue;
          mkdirSync(dir, { recursive: true });
          const name = `${spec.key}__${def.state}__${def.id}__${size}.png`;
          await screenshotWithMarks(
            p,
            ls.map((i) => i.rect),
            path.join(dir, name),
          );
          for (const i of ls) i.shot = `shots/${kind}/${name}`;
          void scrollY;
        }
      };
      const r = await inspectScreen(p, def, spec, stable, shoot);
      sr.checks += r.checks;
      for (const row of r.rows)
        sr.rows.push({ size, scrollY: row.scrollY, issues: row.issues } satisfies ScreenRow);
    }
  }
}
