/**
 * 全単元 × 見本の問題 × 画面サイズ × 状態（問題・ヒント各段・解説）の文字の配置の検査。
 * npm run check:text-layout（playwright.text-layout.config.ts）。違反は失敗にしない。
 *
 * - 問題: qa.ts の sampleItems（生成器は 段階 × MNW_SEEDS 個、手作りは全件）。開発用の画面
 *   #/dev/unit/<unitId>/<n>（src/dev/UnitSampleView.tsx）で、本物の単元の画面に出す。
 * - 1単元 = 1テスト（workers で並列）。結果は単元ごとに .cache/text-layout/units/<unitId>.json に書き、
 *   同じ条件の結果があれば飛ばす（途中から再開）。全部が終わると text-layout-teardown.ts が要約を作る。
 * - v1 のモードの単元（legacy）は対象外（e2e/layout.spec.ts が受け持つ）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inspectText, screenshotWithMarks } from './helpers/text-layout';
import {
  CACHE_DIR,
  REPORT_DIR,
  SIZES,
  type ReportIssue,
  type UnitResult,
  type UnitRow,
} from './helpers/text-layout-report';

interface Meta {
  id: string;
  pack: string;
  stage: string;
  status: string;
  engine: string;
}

const ROOT = path.resolve(import.meta.dirname, '..');
const INDEX = JSON.parse(
  readFileSync(path.join(ROOT, 'src/curriculum/unit-index.json'), 'utf8'),
) as Meta[];

const SEEDS = Number(process.env.MNW_SEEDS) || 2;
const MAX_ITEMS = Number(process.env.MNW_MAX_ITEMS) || 0;
const FRESH = process.env.MNW_FRESH === '1';
/** 種類ごとの代表のスクリーンショットの枚数（全体）。1単元・1種類につき1枚まで */
const SHOTS_PER_KIND = Number(process.env.MNW_SHOTS) || 6;

function globToRe(g: string): RegExp {
  return new RegExp(
    `^${g
      .trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')}$`,
  );
}
const filters = (process.env.MNW_UNITS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(globToRe);

const UNITS = INDEX.filter(
  (u) =>
    u.status !== 'planned' &&
    u.engine !== 'legacy' &&
    (filters.length === 0 || filters.some((re) => re.test(u.id))),
);

const unitsDir = path.join(ROOT, CACHE_DIR, 'units');
const shotsDir = path.join(ROOT, REPORT_DIR, 'shots');

/** 何番目の問題を見るか（上限があれば等間隔に間引く） */
function pick(count: number): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (!MAX_ITEMS || count <= MAX_ITEMS) return all;
  return Array.from({ length: MAX_ITEMS }, (_, i) => Math.floor((i * count) / MAX_ITEMS));
}

/**
 * 描き直しが終わるのを待つ。次の印が4フレーム続けて同じになるまで（最大 1 秒）。
 * 印: 各 svg の viewBox・--svg-floor・最初の text の font-size、.unit__work の --fit・--fig-max・scrollHeight、
 * 解説の板の高さ、吹き出しの --bubble-h、数の入力の図の段の --num-k。
 * 4フレーム（第4回で2から変えた）の理由: SVG の字の引き上げ（V7）は「ResizeObserver → 次のフレームの rAF」の
 * 2フレームかけて測り直すので、2フレームでは画面サイズを変えた直後の引き上げ前を測り、g5.math.area-formulas で
 * small-text が約 20 画面出ていた（同じ画面を読み込み直して測ると出ない＝子供が見る落ち着いた画面では起きない）。
 * 印が変わり続ける画面は今までどおり unstable として残すので、本当の不具合は隠れない。
 * 理由: reducedMotion: 'reduce' ではアニメーションを待てないので、画面サイズを変えた直後の
 * 「ResizeObserver → React の状態 → 描き直し」の途中を測っていた（g1.math.numbers-10/0 で 1920×1080 → 1280×620
 * にした直後に overlap-text 20 件。600ms 後と撮った画像は正常）。終わらない画面は unstable と書いてそのまま残す
 * （違反の detail の先頭に「unstable: 描き直しが 1 秒たっても終わらない」を付ける）。
 */
async function settle(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const mark = (): string => {
      const parts: string[] = [];
      for (const svg of Array.from(document.querySelectorAll('.stage svg'))) {
        const t = svg.querySelector('text');
        parts.push(
          [
            svg.getAttribute('viewBox') ?? '',
            getComputedStyle(svg).getPropertyValue('--svg-floor'),
            t ? getComputedStyle(t).fontSize : '',
          ].join('/'),
        );
      }
      const work = document.querySelector('.unit__work') as HTMLElement | null;
      if (work) {
        const w = getComputedStyle(work);
        parts.push(
          `work:${w.getPropertyValue('--fit')}/${w.getPropertyValue('--fig-max')}/${work.scrollHeight}`,
        );
      }
      const ex = document.querySelector('[data-testid="explain"]') as HTMLElement | null;
      if (ex) parts.push(`explain:${ex.getBoundingClientRect().height}`);
      const unit = document.querySelector('.unit') as HTMLElement | null;
      if (unit) parts.push(`bubble:${unit.style.getPropertyValue('--bubble-h')}`);
      const fig = document.querySelector(
        '.unit__work--number > .unit__figure',
      ) as HTMLElement | null;
      if (fig) parts.push(`num:${fig.style.getPropertyValue('--num-k')}/${fig.scrollHeight}`);
      return parts.join('|');
    };
    // 有限のアニメーション（reduce でも残るもの）は、今までどおり終わるまで待つ（最大 1 秒）。印だけでは
    // transform・opacity の動きは見えないので、待たないと動きの途中を測る
    const anims = document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
    if (anims.length)
      await Promise.race([
        Promise.all(anims.map((a) => a.finished.catch(() => null))),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    const t0 = performance.now();
    let prev = mark();
    let same = 0;
    // 4フレーム続けて同じ印になるまで。1 秒たっても変わり続けるときは、そのまま測る
    while (same < 4 && performance.now() - t0 < 1000) {
      await frame();
      const now = mark();
      same = now === prev ? same + 1 : 0;
      prev = now;
    }
    return same >= 4;
  });
}

async function setHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
}

/** 代表のスクリーンショット: 種類ごとに全体 SHOTS_PER_KIND 枚・1単元1枚まで */
function wantShot(kind: string, unitId: string): string | null {
  const dir = path.join(shotsDir, kind);
  const have = existsSync(dir) ? readdirSync(dir) : [];
  if (have.length >= SHOTS_PER_KIND) return null;
  if (have.some((f) => f.startsWith(`${unitId}__`))) return null;
  return dir;
}

test.describe.configure({ mode: 'parallel' });

for (const meta of UNITS) {
  test(meta.id, async ({ page }) => {
    const file = path.join(unitsDir, `${meta.id}.json`);
    if (!FRESH && existsSync(file)) {
      const prev = JSON.parse(readFileSync(file, 'utf8')) as UnitResult;
      if (prev.seeds === SEEDS && prev.maxItems === MAX_ITEMS && !prev.fatal) {
        test.skip(true, '前回の結果あり（MNW_FRESH=1 ではじめから）');
        return;
      }
    }
    const t0 = Date.now();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => {
      if (pageErrors.length < 20) pageErrors.push(String(e.message).slice(0, 300));
    });
    const result: UnitResult = {
      unitId: meta.id,
      pack: meta.pack,
      stage: meta.stage,
      engine: meta.engine,
      seeds: SEEDS,
      maxItems: MAX_ITEMS,
      total: 0,
      checked: 0,
      screens: 0,
      startedAt: t0,
      ms: 0,
      errors: [],
      rows: [],
    };
    const save = () => {
      result.ms = Date.now() - t0;
      result.errors.push(...pageErrors.splice(0).map((m) => `pageerror: ${m}`));
      mkdirSync(unitsDir, { recursive: true });
      writeFileSync(file, `${JSON.stringify(result)}\n`);
    };

    // 操作・読み込みが止まったままにならないように
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    try {
      await boot(page);
      // 一覧（問題の数とヒントの数）
      await setHash(page, `#/dev/unit/${meta.id}?seeds=${SEEDS}`);
      await page.waitForSelector(
        '[data-testid="dev-unit-index"], [data-testid="dev-unit-missing"]',
        { timeout: 60_000 },
      );
      const info = await page.evaluate(() => window.__mnwDevUnit ?? null);
      if (!info) {
        result.fatal = '単元を開けない（dev-unit-missing）';
        save();
        return;
      }
      result.total = info.count;
      const ns = pick(info.count);
      if (ns.length < info.count) {
        result.capped = true;
        console.log(
          `[text-layout] ${meta.id}: 問題 ${info.count} 問のうち ${ns.length} 問だけ検査（MNW_MAX_ITEMS=${MAX_ITEMS}）`,
        );
      }

      let sizeIdx = 0;
      for (const n of ns) {
        const it = info.items[n]!;
        const one = async () => {
          await setHash(page, `#/dev/unit/${meta.id}/${n}?seeds=${SEEDS}`);
          await page.waitForFunction(
            (k) =>
              window.__mnwDevUnit?.ready === 'q' &&
              document.querySelector('.screen.unit')?.getAttribute('data-index') === '0' &&
              location.hash.includes(`/${k}?`),
            n,
            { timeout: 15_000 },
          );
          const states = [
            'q',
            ...Array.from({ length: it.hints }, (_, i) => `h${i + 1}`),
            'explain',
          ];
          for (const st of states) {
            if (st.startsWith('h')) {
              const k = Number(st.slice(1));
              await page.evaluate(() =>
                (
                  document.querySelector('[data-testid="hint-button"]') as HTMLElement | null
                )?.click(),
              );
              await page.waitForFunction(
                (kk) =>
                  document.querySelector('[data-testid="hint-text"] .unit__hint-mark')
                    ?.textContent === String(kk),
                k,
                { timeout: 5_000 },
              );
            } else if (st === 'explain') {
              await page.evaluate(() =>
                (
                  document.querySelector('[data-testid="next-button"]') as HTMLElement | null
                )?.click(),
              );
              await page.waitForSelector('[data-testid="explain"]', { timeout: 5_000 });
            }
            // 画面サイズは往復の順（前の状態の最後のサイズから始めて、変える回数を減らす）
            const order = sizeIdx === 0 ? SIZES : [...SIZES].reverse();
            for (const [w, h] of order) {
              const vp = page.viewportSize();
              if (!vp || vp.width !== w || vp.height !== h)
                await page.setViewportSize({ width: w, height: h });
              const stable = await settle(page);
              const r = await inspectText(page, { stage: meta.stage });
              result.screens++;
              if (r.issues.length === 0) continue;
              if (!stable)
                for (const i of r.issues)
                  i.detail = `unstable: 描き直しが 1 秒たっても終わらない${i.detail ? `／${i.detail}` : ''}`;
              const row: UnitRow = {
                n,
                level: it.level,
                engine: it.engine,
                identity: it.identity.slice(0, 120),
                size: `${w}x${h}`,
                state: st,
                issues: r.issues,
              };
              result.rows.push(row);
              await shoot(page, meta.id, row);
            }
            sizeIdx = 1 - sizeIdx;
          }
          result.checked++;
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // 1問が止まったとき（ページの固まり等）に全体が止まらないように、時間の上限を付ける
          await Promise.race([
            one(),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('1問の検査が 120 秒を超えた')), 120_000);
            }),
          ]);
        } catch (e) {
          result.errors.push(`n=${n}: ${String((e as Error).message).split('\n')[0]}`);
          // 開き直して続ける
          await boot(page).catch(() => undefined);
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (e) {
      result.fatal = String((e as Error).message).split('\n')[0];
    }
    save();
  });
}

/** 起動して「はじめる」を押す（開発用の画面は起動後に hash で開く） */
async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: SIZES[0]![0], height: SIZES[0]![1] });
  await page.goto('/?seed=1', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('start-button').click({ timeout: 60_000 });
  await page
    .getByTestId('home')
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 10_000))]).then(
      () => undefined,
    ),
  );
}

/** 違反の種類ごとに、代表のスクリーンショットを撮る（違反の位置に赤い枠） */
async function shoot(page: Page, unitId: string, row: UnitRow): Promise<void> {
  const byKind = new Map<string, ReportIssue[]>();
  for (const i of row.issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
  for (const [kind, list] of byKind) {
    const dir = wantShot(kind, unitId);
    if (!dir) continue;
    mkdirSync(dir, { recursive: true });
    const name = `${unitId}__${row.n}__${row.size}__${row.state}.png`;
    await screenshotWithMarks(
      page,
      list.map((i) => i.rect),
      path.join(dir, name),
    );
    for (const i of list) i.shot = `shots/${kind}/${name}`;
  }
}
