import { expect, test } from '@playwright/test';
import { attemptsOf, boot, histLen, idbGetAll, openMode, openParent } from './helpers/app';
import { bootWith, CASES } from './helpers/cases';
import { guideToScreen, mouseCtl, placeRoad, playRound } from './helpers/solve';

/**
 * E-02 全9モード（各モードの代表段階＋最上段）、E-05 なぞり作品、E-06 みち。
 * 正解は window.__mnw（session.expose）の内容から計算し、クリックだけで操作する。
 */

test.describe('E-02 全モードを1回遊ぶ', () => {
  test.describe.configure({ mode: 'parallel' });
  for (const c of CASES) {
    test(c.name, async ({ page }) => {
      test.setTimeout(240_000);
      await bootWith(page, c);
      const n0 = await histLen(page);
      await openMode(page, c.mode, c.variant);
      const ctl = mouseCtl(page);
      const r = await playRound(page, { ctl, wrongFirst: true, from: n0 });

      await expect(page.getByTestId('done-screen')).toBeVisible();
      await expect(page.getByTestId('done-caption')).not.toHaveText('');
      expect(r.wrongDone).toBe(true);

      // 1問 = 記録1件（誤答の分は増えない）。1問目には誤答かヒントの印がある
      const attempts = await attemptsOf(page, c.mode);
      expect(attempts.length).toBe(r.indexes.length);
      const first = attempts[0]!;
      expect(first.wrongTries + first.hintsUsed).toBeGreaterThan(0);
      if (!r.usedHintFallback) expect(first.wrongTries).toBeGreaterThan(0);
      if (attempts.length > 1) expect(attempts[1]!.wrongTries).toBe(0);
      const rounds = (
        await idbGetAll<{ modeId: string; completed: boolean }>(page, 'rounds')
      ).filter((x) => x.modeId === c.mode);
      expect(rounds.some((x) => x.completed)).toBe(true);

      // おうちへ
      await page.getByTestId('done-home-button').click();
      await expect(page.getByTestId('home')).toBeVisible();
    });
  }
});

test.describe('E-05 なぞり作品', () => {
  test('なぞって完成した作品が、保護者画面の作品一覧に出る', async ({ page }) => {
    test.setTimeout(180_000);
    await bootWith(page, { levels: { trace: 0 } });
    const n0 = await histLen(page);
    await openMode(page, 'trace', 'lines');
    const r = await playRound(page, { ctl: mouseCtl(page), from: n0 });
    await expect(page.getByTestId('done-screen')).toBeVisible();

    const works = await idbGetAll<{ id: string; kind: string; title: string; modeId: string }>(
      page,
      'works',
    );
    expect(works.length).toBe(r.indexes.length);
    expect(works.every((w) => w.kind === 'trace' && w.modeId === 'trace')).toBe(true);

    await page.getByTestId('done-home-button').click();
    await openParent(page, 'works');
    await expect(page.getByTestId('tab-works')).toBeVisible();
    for (const w of works) await expect(page.getByTestId(`work-${w.id}`)).toBeVisible();
    // 作品の絵（サムネイル）が描かれている
    await expect(
      page.getByTestId(`work-${works[0]!.id}`).locator('svg, canvas, img').first(),
    ).toBeVisible();
  });
});

test.describe('E-06 みち', () => {
  test('しゅっぱつ → 止まる → 直して到着', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWith(page, { levels: { road: 0 } });
    await openMode(page, 'road', 'puzzle');
    await expect(page.getByTestId('road-puzzle')).toBeVisible();
    const d = (await page.evaluate(
      () => (window as unknown as { __mnw: { current: { data: unknown } } }).__mnw.current.data,
    )) as { solutions: { r: number; c: number; kind: 'straight' | 'corner'; rot: number }[][] };
    const ctl = mouseCtl(page);

    // 何も置かずに しゅっぱつ → 止まる（？の印と吹き出し、盤面はそのまま）
    await page.getByTestId('go-button').click();
    await expect(page.getByTestId('stop-mark')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.bubble').first()).toBeVisible();
    await expect(page.getByTestId('road-puzzle')).toHaveAttribute('data-phase', 'build');

    // 直して（道を置いて）もう一度 → 到着
    const sol = d.solutions[0]!;
    await placeRoad(page, ctl, sol);
    await expect(page.getByTestId('stop-mark')).toHaveCount(0);
    await page.getByTestId('go-button').click();
    await expect(page.getByTestId('arrived-ring')).toBeVisible({ timeout: 15_000 });

    const a = await attemptsOf(page, 'road');
    expect(a.length).toBe(1);
    expect(a[0]!.wrongTries).toBeGreaterThanOrEqual(1);
  });

  test('じゆうに つくる: かざる → 作品が保存され、保護者画面の作品一覧に出る', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await openMode(page, 'road', 'free');
    await expect(page.getByTestId('road-free')).toBeVisible();
    const d = (await page.evaluate(
      () =>
        (window as unknown as { __mnw: { current: { data: { board: unknown } } } }).__mnw.current
          .data,
    )) as {
      board: {
        cols: number;
        rows: number;
        cells: { t: string; dir?: number; dirs?: number[] }[][];
      };
    };
    // 置き場所を決める: スタートの隣から1マスだけ置く（つくりかけ → かざる）
    let sr = 0;
    let sc = 0;
    d.board.cells.forEach((row, r) =>
      row.forEach((c, k) => c.t === 'start' && ((sr = r), (sc = k))),
    );
    const dir = d.board.cells[sr]![sc]!.dir!;
    const dr = [-1, 0, 1, 0][dir]!;
    const dc = [0, 1, 0, -1][dir]!;
    await page.getByTestId('tool-straight').click();
    await page.getByTestId(`cell-${sr + dr}-${sc + dc}`).click();
    // 作りかけが保存される
    await expect
      .poll(async () => (await idbGetAll(page, 'works')).length, { timeout: 8000 })
      .toBe(1);
    const draft = (
      await idbGetAll<{ title: string; data: { draft?: boolean } }>(page, 'works')
    )[0]!;
    expect(draft.data.draft).toBe(true);

    // しゅっぱつ（途中で止まってもよい）→ かざる
    await page.getByTestId('go-button').click();
    await expect(page.getByTestId('go-button')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('decorate-button').click();
    await expect(page.getByTestId('done-screen')).toBeVisible();
    const works = await idbGetAll<{ id: string; title: string; data: { draft?: boolean } }>(
      page,
      'works',
    );
    expect(works.length).toBe(1);
    expect(works[0]!.data.draft).toBe(false);

    await page.getByTestId('done-home-button').click();
    await openParent(page, 'works');
    await expect(page.getByTestId(`work-${works[0]!.id}`)).toBeVisible();
    await expect(page.getByTestId('tab-works')).toContainText('じゆうな みち');
    await expect(page.getByTestId(`work-${works[0]!.id}`).locator('.p-badge')).toHaveCount(0);
  });
});

// なぞり: 描画ヘルパーが使えることの確認用（未使用警告の回避）
void guideToScreen;
