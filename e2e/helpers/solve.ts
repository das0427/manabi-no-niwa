/**
 * 各モードの問題を、window.__mnw.current（session.expose の内容）から正解を計算して解く補助。
 * 操作はクリック（またはタップ）だけ。最初の1問は wrongFirst で「わざと誤答」→ ヒント表示を確かめる。
 */
import { expect } from '@playwright/test';
import type { CDPSession, Locator, Page } from '@playwright/test';
import { histLen } from './app';
import type { Exposed } from './app';

export interface Ctl {
  kind: 'mouse' | 'touch';
  click(l: Locator): Promise<void>;
  clickAt(x: number, y: number): Promise<void>;
  /** なぞり: 点列（画面座標）を1本の線として描く */
  stroke(pts: [number, number][]): Promise<void>;
}

export function mouseCtl(page: Page): Ctl {
  return {
    kind: 'mouse',
    click: (l) => l.click(),
    clickAt: (x, y) => page.mouse.click(x, y),
    async stroke(pts) {
      await page.mouse.move(pts[0]![0], pts[0]![1]);
      await page.mouse.down();
      for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1]);
      await page.mouse.up();
    },
  };
}

/** hasTouch のコンテキスト用。なぞりは CDP の Input.dispatchTouchEvent */
export function touchCtl(page: Page, cdp: CDPSession): Ctl {
  return {
    kind: 'touch',
    click: (l) => l.tap(),
    clickAt: (x, y) => page.touchscreen.tap(x, y),
    async stroke(pts) {
      const tp = (p: [number, number]) => [{ x: p[0], y: p[1], id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]!) });
      for (const p of pts.slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

export interface SolveOpts {
  ctl: Ctl;
  /** 最初の1問でわざと誤答（またはヒント）して、吹き出し等の表示を確かめる */
  wrongFirst?: boolean;
  /** 履歴の長さ。これより後の expose を解く（開く前に histLen で取る） */
  from: number;
  /** 解いた問題数の上限（無限ループ防止） */
  max?: number;
}

export interface SolveResult {
  /** 解いた「問題」の index（重複なし） */
  indexes: number[];
  /** 誤答/ヒントの操作をしたか */
  wrongDone: boolean;
  /** 誤答の代わりにヒントボタンで代用したか（誤答を作れなかった） */
  usedHintFallback: boolean;
}

const hintBubble = (page: Page): Locator => page.locator('.bubble').first();

/** 問題が更新される（履歴が増える）か、完了画面になるまで待つ */
async function waitNext(page: Page, handled: number): Promise<'done' | 'question'> {
  const probe = async (): Promise<'done' | 'question' | 'wait'> => {
    if (await page.getByTestId('done-screen').isVisible()) return 'done';
    if ((await histLen(page)) > handled) return 'question';
    return 'wait';
  };
  await expect.poll(probe, { timeout: 40_000, intervals: [100, 150, 250, 400] }).not.toBe('wait');
  return (await probe()) === 'done' ? 'done' : 'question';
}
export async function playRound(page: Page, opts: SolveOpts): Promise<SolveResult> {
  let handled = opts.from;
  const indexes: number[] = [];
  const res: SolveResult = { indexes, wrongDone: false, usedHintFallback: false };
  let first = true;
  for (let guard = 0; guard < (opts.max ?? 40); guard++) {
    if ((await waitNext(page, handled)) === 'done') return res;
    const snap = await page.evaluate(() => {
      const m = (window as unknown as { __mnw: { history: unknown[] } }).__mnw;
      return { n: m.history.length, cur: m.history[m.history.length - 1] };
    });
    handled = snap.n;
    const cur = snap.cur as Exposed;
    const idx = typeof cur.data.index === 'number' ? cur.data.index : indexes.length;
    if (!indexes.includes(idx)) indexes.push(idx);
    const wrong = !!opts.wrongFirst && first && !res.wrongDone;
    const out = await solveOne(page, opts.ctl, cur, wrong);
    if (wrong) {
      res.wrongDone = true;
      res.usedHintFallback = out.hintFallback;
    }
    first = false;
  }
  throw new Error('問題数が多すぎます（無限ループの疑い）');
}

interface One {
  hintFallback: boolean;
}

async function solveOne(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  switch (cur.modeId) {
    case 'shopping':
      return shopping(page, ctl, cur, wrong);
    case 'hiragana':
      return hiragana(page, ctl, cur, wrong);
    case 'sorting':
      return sorting(page, ctl, cur, wrong);
    case 'shapes':
      return shapes(page, ctl, cur, wrong);
    case 'memory':
      return memory(page, ctl, cur, wrong);
    case 'compare':
      return compare(page, ctl, cur, wrong);
    case 'road':
      return road(page, ctl, cur, wrong);
    case 'trace':
      return trace(page, ctl, cur, wrong);
    case 'math':
      return math(page, ctl, cur, wrong);
    default:
      throw new Error(`未対応のモード: ${cur.modeId}`);
  }
}

const tid = (page: Page, id: string): Locator => page.getByTestId(id);

// ---------------------------------------------------------------- おかいもの
async function shopping(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as { lines: { item: string; count: number }[] };
  if (wrong) {
    // 何も入れずに「これで おねがいします」→ 誤答
    await ctl.click(tid(page, 'register-button'));
    await expect(hintBubble(page)).toBeVisible();
  }
  for (const l of d.lines) {
    for (let i = 0; i < l.count; i++) await ctl.click(tid(page, `shelf-${l.item}`));
  }
  await ctl.click(tid(page, 'register-button'));
  return { hintFallback: false };
}

// ---------------------------------------------------------------- ひらがな
async function hiragana(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as {
    kind: string;
    answerIndex?: number;
    choices?: string[];
    chars?: string[];
    tiles?: string[];
  };
  if (d.kind === 'build') {
    const chars = d.chars!;
    const tiles = d.tiles!;
    if (wrong) {
      const bad = tiles.findIndex((t) => t !== chars[0]);
      await ctl.click(tid(page, `tile-${bad}`));
      await expect(hintBubble(page)).toBeVisible();
    }
    const used = new Set<number>();
    for (const ch of chars) {
      const i = tiles.findIndex((t, k) => t === ch && !used.has(k));
      used.add(i);
      await ctl.click(tid(page, `tile-${i}`));
    }
    return { hintFallback: false };
  }
  const ans = d.answerIndex!;
  if (wrong) {
    const bad = d.choices!.findIndex((_, i) => i !== ans);
    await ctl.click(tid(page, `choice-${bad}`));
    await expect(hintBubble(page)).toBeVisible();
  }
  await ctl.click(tid(page, `choice-${ans}`));
  return { hintFallback: false };
}

// ---------------------------------------------------------------- なかまわけ
/** 箱の当たり判定の中心を押す（箱に入った絵が上にあっても、絵が箱の押下として働く） */
async function clickBox(page: Page, ctl: Ctl, id: string): Promise<void> {
  const b = (await tid(page, id).boundingBox())!;
  await ctl.clickAt(b.x + b.width / 2, b.y + b.height / 2);
}

async function sorting(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as { pics: string[]; boxes: string[]; answer: Record<string, string> };
  if (wrong) {
    const p0 = d.pics[0]!;
    const bad = d.boxes.find((b) => b !== d.answer[p0])!;
    await ctl.click(tid(page, `pic-${p0}`));
    await clickBox(page, ctl, `box-hit-${bad}`);
    await expect(hintBubble(page)).toBeVisible();
  }
  for (const p of d.pics) {
    await ctl.click(tid(page, `pic-${p}`));
    await clickBox(page, ctl, `box-hit-${d.answer[p]}`);
  }
  return { hintFallback: false };
}

// ---------------------------------------------------------------- かたち
async function shapes(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as {
    slots: { shape: string; size: number; x: number; y: number }[];
    pieces: { id: number; shape: string; size: number }[];
    solution: { slot: number; piece: number; turns: number }[];
  };
  const boardBox = async () => (await tid(page, 'shapes-board').boundingBox())!;
  const slotPoint = async (slot: number): Promise<[number, number]> => {
    const b = await boardBox();
    const s = d.slots[slot]!;
    return [b.x + (s.x / 100) * b.width, b.y + (s.y / 100) * b.height];
  };
  const select = async (piece: number) => {
    const el = tid(page, `piece-${piece}`);
    if ((await el.getAttribute('aria-pressed')) !== 'true') await ctl.click(el);
  };
  let fallback = false;
  if (wrong) {
    // 形か大きさの違う置き場所に置く
    let pair: { piece: number; slot: number } | null = null;
    for (const a of d.solution) {
      for (const b of d.solution) {
        const pc = d.pieces[a.piece]!;
        const sl = d.slots[b.slot]!;
        if (pc.shape !== sl.shape || pc.size !== sl.size) {
          pair = { piece: a.piece, slot: b.slot };
          break;
        }
      }
      if (pair) break;
    }
    if (pair) {
      await select(pair.piece);
      const [x, y] = await slotPoint(pair.slot);
      await ctl.clickAt(x, y);
    } else {
      fallback = true;
      await ctl.click(tid(page, 'hint-button'));
    }
    await expect(hintBubble(page)).toBeVisible();
  }
  for (const s of d.solution) {
    await select(s.piece);
    for (let t = 0; t < s.turns; t++) await ctl.click(tid(page, 'rotate-button'));
    const [x, y] = await slotPoint(s.slot);
    await ctl.clickAt(x, y);
  }
  return { hintFallback: fallback };
}

// ---------------------------------------------------------------- おぼえてさがす
async function memory(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as {
    kind: 'pick' | 'place' | 'order';
    answer: string[];
    choices: string[];
    pos: number | null;
  };
  // 覚える画面なら「おぼえた！」を押す（答える画面にいるときは何もしない）
  const memorized = tid(page, 'memorized-button');
  await expect(memorized.or(tid(page, 'answer'))).toBeVisible();
  if (await memorized.isVisible()) await ctl.click(memorized);
  await expect(tid(page, 'answer')).toBeVisible();
  if (d.kind === 'pick') {
    if (wrong) {
      const bad = d.choices.findIndex((c) => !d.answer.includes(c));
      await ctl.click(tid(page, `choice-${bad}`));
      await expect(hintBubble(page)).toBeVisible();
    }
    for (const a of d.answer) await ctl.click(tid(page, `choice-${d.choices.indexOf(a)}`));
  } else if (d.kind === 'place') {
    if (wrong) {
      await ctl.click(tid(page, `card-${d.pos === 0 ? 1 : 0}`));
      await expect(hintBubble(page)).toBeVisible();
    }
    await ctl.click(tid(page, `card-${d.pos}`));
  } else {
    if (wrong) {
      const bad = d.choices.find((c) => c !== d.answer[0])!;
      await ctl.click(tid(page, `tray-${bad}`));
      await expect(hintBubble(page)).toBeVisible();
    }
    for (const a of d.answer) await ctl.click(tid(page, `tray-${a}`));
  }
  return { hintFallback: false };
}

// ---------------------------------------------------------------- くらべっこ
async function compare(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as { answer?: number; order?: number[] };
  if (d.order) {
    if (wrong) {
      for (const c of [...d.order].reverse()) await ctl.click(tid(page, `card-${c}`));
      await expect(hintBubble(page)).toBeVisible();
      // 誤答のあと、マスが空に戻るまで待つ
      await expect(page.locator('.cmp-card--empty')).toHaveCount(0, { timeout: 5000 });
    }
    for (const c of d.order) await ctl.click(tid(page, `card-${c}`));
    return { hintFallback: false };
  }
  const ans = d.answer!;
  if (wrong) {
    await ctl.click(tid(page, `choice-${ans === 0 ? 1 : 0}`));
    await expect(hintBubble(page)).toBeVisible();
  }
  await ctl.click(tid(page, `choice-${ans}`));
  return { hintFallback: false };
}

// ---------------------------------------------------------------- みちを つくろう
interface Placement {
  r: number;
  c: number;
  kind: 'straight' | 'corner' | 'tee';
  rot: number;
}

export async function placeRoad(
  page: Page,
  ctl: Ctl,
  placements: Placement[],
  extraTool?: boolean,
): Promise<void> {
  void extraTool;
  for (const pl of placements) {
    await ctl.click(tid(page, `tool-${pl.kind}`));
    await ctl.click(tid(page, `cell-${pl.r}-${pl.c}`));
    const turns = pl.rot % (pl.kind === 'straight' ? 2 : 4);
    for (let t = 0; t < turns; t++) await ctl.click(tid(page, `cell-${pl.r}-${pl.c}`));
  }
}

async function road(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as { solutions: Placement[][] };
  if (wrong) {
    await ctl.click(tid(page, 'go-button'));
    await expect(tid(page, 'stop-mark')).toBeVisible({ timeout: 10_000 });
    await expect(hintBubble(page)).toBeVisible();
  }
  await placeRoad(page, ctl, d.solutions[0]!);
  await ctl.click(tid(page, 'go-button'));
  return { hintFallback: false };
}

// ---------------------------------------------------------------- なぞって あそぼう
type Pt = [number, number];

/** お手本の点列（0〜1000）を画面座標に直し、間引く */
export async function guideToScreen(page: Page, strokes: Pt[][], every = 2): Promise<Pt[][]> {
  const box = (await tid(page, 'trace-canvas').boundingBox())!;
  const map = (p: Pt): Pt => [
    box.x + (p[0] / 1000) * box.width,
    box.y + (p[1] / 1000) * box.height,
  ];
  return strokes.map((s) => {
    const pts = s.filter((_, i) => i % every === 0 || i === s.length - 1);
    return pts.map(map);
  });
}

async function trace(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as { strokes: Pt[][]; index: number };
  const board = tid(page, 'trace-board');
  if (wrong) {
    // お手本から遠い線を3本 → 誤答1回（3本で1回）
    const all = d.strokes.flat();
    const corners: Pt[] = [
      [60, 60],
      [940, 60],
      [60, 940],
      [940, 940],
    ];
    const far = corners
      .map((c) => ({ c, dist: Math.min(...all.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) }))
      .sort((a, b) => b.dist - a.dist)[0]!.c;
    const dx = far[0] < 500 ? 1 : -1;
    const box = (await tid(page, 'trace-canvas').boundingBox())!;
    const sx = (v: number) => box.x + (v / 1000) * box.width;
    const sy = (v: number) => box.y + (v / 1000) * box.height;
    for (let k = 0; k < 3; k++) {
      const y = far[1] + (far[1] < 500 ? 1 : -1) * k * 30;
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push([sx(far[0] + dx * i * 25), sy(y)]);
      await ctl.stroke(pts);
    }
    await expect(board).toHaveAttribute('data-wrong', '1');
    await expect(hintBubble(page)).toBeVisible();
  }
  const lines = await guideToScreen(page, d.strokes, 2);
  for (const l of lines) await ctl.stroke(l);
  return { hintFallback: false };
}

// ---------------------------------------------------------------- さんすう
async function math(page: Page, ctl: Ctl, cur: Exposed, wrong: boolean): Promise<One> {
  const d = cur.data as {
    stage: string;
    n?: number;
    validSplits?: [number, number][];
    choices?: number[];
    answerIndex?: number;
  };
  if (d.stage === 'D1') {
    let fallback = false;
    if (wrong) {
      // 分け方のない問題には誤答がないので、ヒントで代用
      fallback = true;
      await ctl.click(tid(page, 'hint-button'));
      await expect(hintBubble(page)).toBeVisible();
    }
    const [a] = d.validSplits![0]!;
    const n = d.n!;
    for (let i = 0; i < n; i++) {
      const it = tid(page, `split-item-${i}`);
      await ctl.click(it);
      if (i >= a) await ctl.click(it);
    }
    await ctl.click(tid(page, 'done-button'));
    await ctl.click(tid(page, 'split-next'));
    return { hintFallback: fallback };
  }
  const ans = d.answerIndex!;
  if (wrong) {
    const bad = d.choices!.findIndex((_, i) => i !== ans);
    await ctl.click(tid(page, `choice-${bad}`));
    await expect(hintBubble(page)).toBeVisible();
  }
  await ctl.click(tid(page, `choice-${ans}`));
  return { hintFallback: false };
}
