/**
 * 使いやすさの直し・小学生の組（F4。FX04・FX07・FX15・FX16）。
 *
 * - FX07: 単元の地図の列が、前提の順（習う順）に並ぶ。前は ID のアルファベット順で、列の中の前提の組 68 組のうち 32 組が逆転していた。
 * - FX15: 地図の札に仮の枠（赤い破線）の絵が無い。前は 3 枚（むかしばなし・ことばあそび・方言と共通語）。
 * - FX04: 地図の札が縮まず、題が札の外にあふれない（配置の作業 0ceda44 で直った分を守る）。
 * - FX16: 保存に問題があるとき、小学生ホームにも v1 と同じ保護者向けの「!」を鍵の左に出す。
 *
 * 本番ビルドの画面で見る（開発サーバーでは draft・未登録の絵が出る出ないが変わるので、仮の枠は本番ビルドで数える）。
 */
import { expect, test, type Page } from '@playwright/test';
import { SUBJECTS } from '../src/curriculum/subjects';
import { UNITS } from './helpers/app-layout-fixtures';
import { activeProfileId, clickUntil, gotoApp, idbGetAll, idbPutMany } from './helpers/app';

/** 小学生（g3）のプロフィールにして、ホームまで進む（explore.spec.ts と同じ手順） */
async function bootSchool(page: Page): Promise<void> {
  await gotoApp(page);
  const pid = await activeProfileId(page);
  const profile = (await idbGetAll<Record<string, unknown>>(page, 'profiles')).find(
    (p) => p.id === pid,
  )!;
  await idbPutMany(page, 'profiles', [{ ...profile, audience: 'g3', enrolledGrade: 3 }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
  await clickUntil(page, page.getByTestId('start-button'), page.getByTestId('school-home'));
}

/** 地図を開く（hash を直接変える。画面遷移の 400ms の間引きに当たらない） */
async function openMap(page: Page, subject: string, grade: number): Promise<void> {
  await page.evaluate((h) => {
    location.hash = h;
  }, `#/subject/${subject}/g${grade}`);
  await expect(page.getByTestId(`subject-map-${subject}`)).toBeVisible();
  await expect(page.getByTestId(`grade-tab-${grade}`)).toHaveAttribute('aria-selected', 'true');
}

interface MapDom {
  /** 領域の列ごとの、札の単元 ID（上から） */
  columns: { name: string; ids: string[] }[];
  /** 仮の枠（赤い破線の四角）の絵の札 */
  placeholders: string[];
}

async function readMap(page: Page): Promise<MapDom> {
  return page.evaluate(() => {
    const columns = [...document.querySelectorAll('.smap-col')].map((col) => ({
      name: col.querySelector('.smap-col__name')?.textContent ?? '',
      ids: [...col.querySelectorAll('.smap-unit')].map((c) =>
        c.getAttribute('data-testid')!.replace('unit-card-', ''),
      ),
    }));
    const placeholders = [...document.querySelectorAll('.smap-unit')]
      .filter((c) => c.querySelector('svg[data-illust] > rect[stroke="#c00"]'))
      .map((c) => c.getAttribute('data-testid')!.replace('unit-card-', ''));
    return { columns, placeholders };
  });
}

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));
/** 前提の前提まで（索引にある単元） */
function ancestorsOf(id: string): Set<string> {
  const out = new Set<string>();
  const stack = [...(BY_ID.get(id)?.prereq ?? [])];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (out.has(p) || !BY_ID.has(p)) continue;
    out.add(p);
    stack.push(...BY_ID.get(p)!.prereq);
  }
  return out;
}

const MAPS = SUBJECTS.flatMap((s) => s.grades.map((g) => ({ subject: s.id, grade: g })));

test.describe('単元の地図（小学生）', () => {
  test('どの地図でも、前提の単元が上にあり（FX07）、仮の枠の絵が無い（FX15）', async ({ page }) => {
    test.setTimeout(180_000);
    await bootSchool(page);
    let columns = 0;
    let pairs = 0;
    let cards = 0;
    const inversions: string[] = [];
    const firstNeeds: string[] = [];
    const placeholders: string[] = [];
    for (const m of MAPS) {
      await openMap(page, m.subject, m.grade);
      const dom = await readMap(page);
      // 画面の札は、その教科・学年の（既定で見える）単元とちょうど同じ
      const shown = dom.columns.flatMap((c) => c.ids).sort();
      const expected = UNITS.filter(
        (u) =>
          u.stage === `g${m.grade}` &&
          u.subject === m.subject &&
          u.status !== 'planned' &&
          !u.hiddenByDefault,
      )
        .map((u) => u.id)
        .sort();
      expect(shown, `${m.subject}/g${m.grade} の札`).toEqual(expected);
      cards += shown.length;
      placeholders.push(...dom.placeholders);
      for (const col of dom.columns) {
        columns++;
        const pos = new Map(col.ids.map((id, i) => [id, i]));
        for (const id of col.ids) {
          for (const p of ancestorsOf(id)) {
            if (!pos.has(p)) continue;
            pairs++;
            if (pos.get(p)! > pos.get(id)!)
              inversions.push(`${m.subject}/g${m.grade}/${col.name}: ${p} → ${id}`);
          }
        }
        const first = col.ids[0]!;
        for (const p of ancestorsOf(first))
          if (pos.has(p)) firstNeeds.push(`${m.subject}/g${m.grade}/${col.name}: ${first} ← ${p}`);
      }
    }
    // 見落とし防止: 全部の地図の列・札・前提の組を数えている
    expect(columns).toBeGreaterThanOrEqual(70);
    expect(cards).toBeGreaterThanOrEqual(250);
    expect(pairs).toBeGreaterThanOrEqual(60);
    expect(inversions).toEqual([]);
    expect(firstNeeds).toEqual([]);
    expect(placeholders).toEqual([]);
  });

  test('習う順の例: 小1 算数・小3 算数・小5 算数・小6 算数（前は逆だった組）', async ({ page }) => {
    await bootSchool(page);
    const before: [string, string][] = [
      ['g1.math.compose-10', 'g1.math.add-basic'],
      ['g1.math.numbers-20', 'g1.math.add-carry'],
      ['g1.math.numbers-120', 'g1.math.add-sub-2digit'],
      ['g3.math.large-numbers', 'g3.math.abacus'],
      ['g3.math.mult-rules', 'g3.math.mult-1digit'],
      ['g5.math.decimal-mult', 'g5.math.decimal-div'],
      ['g6.math.fraction-mult', 'g6.math.fraction-div'],
    ];
    const grades = [...new Set(before.map(([a]) => Number(a.slice(1, 2))))];
    for (const g of grades) {
      await openMap(page, 'math', g);
      const ids = (await readMap(page)).columns.flatMap((c) => c.ids);
      for (const [pre, post] of before.filter(([a]) => a.startsWith(`g${g}.`))) {
        expect(ids.indexOf(pre), `${pre} が見える`).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(pre), `${pre} は ${post} より前`).toBeLessThan(ids.indexOf(post));
      }
    }
    // 小1 算数「かず・けいさん」の列は、10までの数から始まる
    await openMap(page, 'math', 1);
    const col = (await readMap(page)).columns[0]!;
    expect(col.ids[0]).toBe('g1.math.numbers-10');
  });

  test('絵の無かった 3 単元の札に、完成した絵が出る（FX15）', async ({ page }) => {
    await bootSchool(page);
    const cases: [string, number, string, string][] = [
      ['ja', 1, 'g1.ja.folktales', 'book'],
      ['ja', 1, 'g1.ja.word-play', 'music-note'],
      ['ja', 6, 'g6.ja.language-change', 'book'],
    ];
    for (const [subject, grade, unitId, illust] of cases) {
      await openMap(page, subject, grade);
      const svg = page.getByTestId(`unit-card-${unitId}`).locator('svg[data-illust]').first();
      await expect(svg).toHaveAttribute('data-illust', illust);
      // 絵の中身（形）がある。仮の枠は、赤い破線の四角（rect）が 1 つだけ
      await expect(svg.locator('path, ellipse, circle').first()).toBeAttached();
      await expect(svg.locator('rect[stroke="#c00"]')).toHaveCount(0);
    }
  });

  // 札が縮まず（FX04）、題が札の外にあふれず、札どうしが重ならない。4 つの画面の大きさで
  const SIZES: [number, number][] = [
    [1280, 620],
    [1280, 720],
    [1536, 864],
    [1920, 1080],
  ];
  const TALL: { subject: string; grade: number }[] = [
    { subject: 'math', grade: 1 },
    { subject: 'math', grade: 3 },
    { subject: 'ja', grade: 1 },
    { subject: 'ja', grade: 6 },
    { subject: 'math', grade: 5 },
  ];
  for (const [w, h] of SIZES) {
    test(`地図の札は縮まず、題が札の外にあふれない（${w}×${h}。FX04）`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await bootSchool(page);
      const u = Math.min(w / 100, (h * 1.7778) / 100);
      for (const m of TALL) {
        await openMap(page, m.subject, m.grade);
        const bad = await page.evaluate((unit) => {
          const out: string[] = [];
          for (const col of document.querySelectorAll('.smap-col')) {
            const cards = [...col.querySelectorAll<HTMLElement>('.smap-unit')];
            cards.forEach((c, i) => {
              const r = c.getBoundingClientRect();
              const id = c.getAttribute('data-testid');
              // 札は 8u 以上（縮めない）
              if (r.height < unit * 8 - 1) out.push(`${id}: 高さ ${(r.height / unit).toFixed(1)}u`);
              // 題は札の中（下の端の線の内側）に収まる
              const t = c.querySelector<HTMLElement>('.smap-unit__title')!.getBoundingClientRect();
              if (t.bottom > r.bottom - 1) out.push(`${id}: 題が札の下にはみ出す`);
              if (t.top < r.top - 1) out.push(`${id}: 題が札の上にはみ出す`);
              // 下の札と重ならない
              const next = cards[i + 1];
              if (next && next.getBoundingClientRect().top < r.bottom - 0.5)
                out.push(`${id}: 下の札と重なる`);
            });
          }
          return out;
        }, u);
        expect(bad, `${m.subject}/g${m.grade}`).toEqual([]);
      }
    });
  }
});

test.describe('小学生ホームの保存の問題の「!」（FX16）', () => {
  /** 単元の進度の読み込みを、容量いっぱい（QuotaExceededError）で失敗させる。保存の状態が full になる */
  async function failUnitProgress(page: Page): Promise<void> {
    await page.evaluate(() => {
      const orig = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        names: string | string[],
        mode?: IDBTransactionMode,
        opts?: IDBTransactionOptions,
      ) {
        const list = Array.isArray(names) ? names : [names];
        if (list.includes('unitProgress')) throw new DOMException('quota', 'QuotaExceededError');
        return orig.call(this, names, mode, opts);
      } as typeof orig;
    });
  }

  test('ふだんは出ない。保存に問題が起きたあとのホームで、鍵の左に出る（押せない）', async ({
    page,
  }) => {
    await bootSchool(page);
    await expect(page.getByTestId('home-health')).toHaveCount(0);

    // 保存に問題が起きる（地図を開くと単元の進度が読めず、容量いっぱいの扱いになる）
    await failUnitProgress(page);
    await clickUntil(page, page.getByTestId('subject-math'), page.getByTestId('subject-map-math'));
    await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('school-home'));
    const mark = page.getByTestId('home-health');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveText('!');
    await expect(mark).toHaveAttribute('role', 'img');
    await expect(mark).toHaveAttribute('aria-label', /保護者の方へ.*記録の保存に問題があります/);

    // 押しても何も起きない（ボタンではない。画面は動かず、保護者ゲートも開かない）
    const hash = await page.evaluate(() => location.hash);
    await mark.click({ force: true });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => location.hash)).toBe(hash);
    await expect(page.getByTestId('school-home')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('鍵の左・3u の円・舞台の内側（4 つの画面の大きさ）', async ({ page }) => {
    await bootSchool(page);
    await failUnitProgress(page);
    await clickUntil(page, page.getByTestId('subject-math'), page.getByTestId('subject-map-math'));
    await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('school-home'));
    await expect(page.getByTestId('home-health')).toBeVisible();
    for (const [w, h] of [
      [1280, 620],
      [1280, 720],
      [1536, 864],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      const u = Math.min(w / 100, (h * 1.7778) / 100);
      const g = await page.evaluate(() => {
        const rect = (sel: string) => {
          const r = document.querySelector(sel)!.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
        };
        return {
          mark: rect('[data-testid="home-health"]'),
          key: rect('[data-testid="parent-key"]'),
        };
      });
      // v1 と同じ大きさ（3u の円）
      expect(g.mark.w / u).toBeCloseTo(3, 1);
      expect(g.mark.h / u).toBeCloseTo(3, 1);
      // 鍵の左（間は 0.8u。重ならない）・上の帯の高さの中ほどにそろう
      expect(g.mark.r).toBeLessThanOrEqual(g.key.l + 0.5);
      expect((g.key.l - g.mark.r) / u).toBeGreaterThan(0.5);
      expect((g.key.l - g.mark.r) / u).toBeLessThan(1.2);
      expect(Math.abs((g.mark.t + g.mark.b) / 2 - (g.key.t + g.key.b) / 2) / u).toBeLessThan(0.6);
      // 画面の内側（右の端から 2u 以上）
      expect(g.mark.t).toBeGreaterThanOrEqual(0);
      expect(w - g.key.r).toBeGreaterThanOrEqual(u * 1.5);
    }
  });
});
