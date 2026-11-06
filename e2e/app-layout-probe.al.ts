/**
 * アプリの全画面の配置の検査（helpers/app-layout.ts と、helpers/text-layout.ts の root・adultSel・pageScroll）自体の確認。
 * わざと壊した見本で検出すること、普通の画面で誤検出しないことを確かめる。npm run check:app-layout:probe
 * （page.setContent の見本だけを使う。アプリの画面は開かない）
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inspectApp } from './helpers/app-layout';
import type { AppIssueKind, AppProbeOptions } from './helpers/app-layout';
import { inspectText } from './helpers/text-layout';
import type { TextIssueKind, TextProbeOptions } from './helpers/text-layout';

const CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
  :root { --u: min(1vw, 1.7778vh); }
  body { font-family: 'Yu Gothic', 'Meiryo', sans-serif; font-weight: 700; }
  .stage { position: relative; width: calc(var(--u) * 100); height: calc(var(--u) * 56.25);
    margin: 0 auto; overflow: hidden; font-size: calc(var(--u) * 2.4); }
  .abs { position: absolute; }
  .box { border: calc(var(--u) * 0.3) solid #333; background: #fff; }
  button { font: inherit; border: calc(var(--u) * 0.3) solid #333; background: #fde; padding: 0; }
  p { margin: 0; }
  .grid { position: absolute; left: calc(var(--u) * 30); top: calc(var(--u) * 8); display: grid;
    grid-template-columns: repeat(3, calc(var(--u) * 14)); gap: calc(var(--u) * 1.6); }
  .home-card { width: calc(var(--u) * 14); height: calc(var(--u) * 14); }
  .parent-root { position: fixed; inset: 0; overflow: auto; background: #fff; font-size: 15px;
    font-weight: 400; font-family: 'Yu Gothic', 'Meiryo', sans-serif; }
  .parent-root button, .parent-root select, .parent-root input { font: inherit; font-size: 14px; }
`;

const SHELL = (body: string) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
  <style>${CSS}</style></head><body>${body}</body></html>`;

async function load(page: Page, body: string, size: [number, number] = [1280, 720]): Promise<void> {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.setContent(SHELL(body));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
const show = (page: Page, stageBody: string, size?: [number, number]) =>
  load(page, `<div class="stage">${stageBody}</div>`, size);

async function appKinds(page: Page, opt: Partial<AppProbeOptions> = {}): Promise<AppIssueKind[]> {
  const r = await inspectApp(page, { viewer: 'g3', ...opt });
  return [...new Set(r.issues.map((i) => i.kind))];
}
async function textKinds(
  page: Page,
  opt: Partial<TextProbeOptions> = {},
): Promise<TextIssueKind[]> {
  const r = await inspectText(page, { stage: 'g3', ...opt });
  return [...new Set(r.issues.map((i) => i.kind))];
}

/** 幼児ホームの札（14u × 14u）を n 枚、3 列の格子に並べる（ほかの がくねん と同じ形） */
const cards = (n: number) =>
  `<div class="grid" role="list">${Array.from(
    { length: n },
    (_, i) =>
      `<button class="home-card" role="listitem" aria-label="札${i + 1}">札${i + 1}</button>`,
  ).join('')}</div>`;

test('普通の画面では何も出さない（3 段の札の格子・印のある一覧・補助の札・ふりがな）', async ({
  page,
}) => {
  await show(
    page,
    `${cards(9)}
     <p class="abs" style="top:calc(var(--u)*2);left:calc(var(--u)*4)">どれで あそぶ？</p>
     <div class="abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);width:calc(var(--u)*20)">
       <div data-scroll-region="list" style="height:calc(var(--u)*20);overflow-y:auto">
         <div style="height:calc(var(--u)*60)">ながい いちらん</div></div>
       <span data-scroll-cue style="display:block;width:calc(var(--u)*2);height:calc(var(--u)*2);background:#333"></span>
       <button data-scroll-btn style="width:calc(var(--u)*6);height:calc(var(--u)*6)">▲</button>
     </div>
     <button class="tap tap--aux abs" aria-label="おうち" style="top:calc(var(--u)*2);right:calc(var(--u)*4);width:calc(var(--u)*5.6);height:calc(var(--u)*5.6)">う</button>`,
  );
  const app = await inspectApp(page, { viewer: 'p4' });
  expect(app.issues).toEqual([]);
  expect(await textKinds(page, { stage: 'p4' })).toEqual([]);
});

test('舞台の下に 4 段目の札がある格子（explore と同じ形）: screen-overflow と unreachable を出す・3 段なら出さない', async ({
  page,
}) => {
  await show(page, cards(10));
  const r = await inspectApp(page, { viewer: 'p4' });
  const kinds = r.issues.map((i) => i.kind);
  expect(kinds).toContain('screen-overflow');
  expect(kinds).toContain('unreachable');
  const so = r.issues.find((i) => i.kind === 'screen-overflow')!;
  expect(so.detail).toMatch(/下に \d+(\.\d)?u/);
  expect(so.detail).toContain('札10');
  // 文字の検査側も、舞台の外を出す（今までどおり）
  expect(await textKinds(page, { stage: 'p4' })).toContain('out-of-stage');

  await show(page, cards(9));
  const ok = await inspectApp(page, { viewer: 'p4' });
  expect(ok.issues.filter((i) => i.kind === 'screen-overflow' || i.kind === 'unreachable')).toEqual(
    [],
  );
});

test('押せない札: 別の要素が中心にかぶさる札は出す・pointer-events: none の飾りは出さない', async ({
  page,
}) => {
  await show(
    page,
    `<button class="tap abs" aria-label="かくれる" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*14);height:calc(var(--u)*10)">かくれる</button>
     <div class="abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*8);width:calc(var(--u)*18);height:calc(var(--u)*14)"></div>
     <button class="tap abs" aria-label="だいじょうぶ" style="top:calc(var(--u)*30);left:calc(var(--u)*10);width:calc(var(--u)*14);height:calc(var(--u)*10)">だいじょうぶ</button>
     <div class="abs box" style="pointer-events:none;top:calc(var(--u)*28);left:calc(var(--u)*8);width:calc(var(--u)*18);height:calc(var(--u)*14)"></div>`,
  );
  const r = await inspectApp(page, { viewer: 'g3' });
  const un = r.issues.filter((i) => i.kind === 'unreachable');
  expect(un.map((i) => i.text)).toEqual(['かくれる']);
});

test('スクロールの枠: 印の無い一覧は scroll-no-cue・印があれば出さない・幼児は ▲▼ の札が無ければ scroll-no-button', async ({
  page,
}) => {
  const tall = Array.from(
    { length: 8 },
    (_, i) => `<div style="height:calc(var(--u)*10)">いちらん ${i + 1}</div>`,
  ).join('');
  await show(
    page,
    `<div class="abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);width:calc(var(--u)*30);height:calc(var(--u)*20);overflow-y:auto">${tall}</div>`,
  );
  expect(await appKinds(page, { viewer: 'g3' })).toContain('scroll-no-cue');
  // 幼児では ▲▼ の札も要る
  const kinds = await appKinds(page, { viewer: 'p4' });
  expect(kinds).toContain('scroll-no-cue');
  expect(kinds).toContain('scroll-no-button');
  // 文字の検査側は、印の無い枠の中の字を scroll-hidden で出す（今までどおり）
  expect(await textKinds(page, { stage: 'g3' })).toContain('scroll-hidden');

  // 印のある list: 小学生は ▼ の印だけ・幼児は ▲▼ の札も
  const region = (cue: boolean, btn: boolean) =>
    `<div class="abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);width:calc(var(--u)*30);height:calc(var(--u)*20)">
       <div data-scroll-region="list" ${cue ? 'data-scroll-cue' : ''} style="height:100%;overflow-y:auto">${tall}</div>
       ${btn ? '<button data-scroll-btn class="tap tap--aux" style="position:absolute;right:0;top:0;width:calc(var(--u)*5.6);height:calc(var(--u)*5.6)">▲</button>' : ''}
     </div>`;
  await show(page, region(true, false));
  expect(await appKinds(page, { viewer: 'g3' })).toEqual([]);
  expect(await appKinds(page, { viewer: 'p4' })).toEqual(['scroll-no-button']);
  expect(await textKinds(page, { stage: 'g3' })).not.toContain('scroll-hidden');
  await show(page, region(true, true));
  expect(await appKinds(page, { viewer: 'p4' })).toEqual([]);
  // data-scroll-region はあるが印が無い
  await show(page, region(false, true));
  const noCue = await inspectApp(page, { viewer: 'p4' });
  expect(noCue.issues.map((i) => i.kind)).toEqual(['scroll-no-cue']);
  expect(noCue.issues[0]!.detail).toContain('data-scroll-cue');
});

test('スクロールの枠の中の札: 印のある枠からはみ出した札はスクロールで届くので押せない札に数えない・枠が無ければ数える', async ({
  page,
}) => {
  const list = (region: boolean) => `
    <div class="abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);width:calc(var(--u)*30);height:calc(var(--u)*20)">
      <div ${region ? 'data-scroll-region="list" data-scroll-cue' : ''} style="height:100%;overflow-y:auto">
        ${Array.from({ length: 6 }, (_, k) => `<button class="smap-unit" aria-label="たんげん${k + 1}" style="display:block;width:calc(var(--u)*26);height:calc(var(--u)*8);margin-bottom:calc(var(--u)*1.6)">たんげん${k + 1}</button>`).join('')}
      </div>
    </div>`;
  await show(page, list(true));
  const ok = await inspectApp(page, { viewer: 'g3' });
  expect(ok.issues.filter((i) => i.kind === 'unreachable' || i.kind === 'screen-overflow')).toEqual(
    [],
  );
  expect(ok.issues.filter((i) => i.kind === 'scroll-no-cue')).toEqual([]);
  // 枠の印も data-scroll-region も無いと、見えない札は押せない札になり、枠も印が無いと出る
  await show(page, list(false));
  const ng = await inspectApp(page, { viewer: 'g3' });
  expect(ng.issues.filter((i) => i.kind === 'unreachable').length).toBeGreaterThanOrEqual(3);
  expect(ng.issues.some((i) => i.kind === 'scroll-no-cue')).toBe(true);
});

test('押す大きさ（子供）: 補助 5.5u・主操作 6u 未満を出す・鍵とくわしくの色の札は出さない', async ({
  page,
}) => {
  const btn = (cls: string, u: number, left: number, extra = '') =>
    `<button class="${cls} abs" aria-label="${cls}-${u}" ${extra} style="top:calc(var(--u)*20);left:calc(var(--u)*${left});width:calc(var(--u)*${u});height:calc(var(--u)*${u})">x</button>`;
  await show(
    page,
    `${btn('tap tap--main', 5, 4)}${btn('tap tap--main', 6.2, 14)}${btn('tap tap--aux', 5, 24)}${btn('tap tap--aux', 5.6, 34)}
     ${btn('gate-key', 4.5, 44)}
     <div class="draw-screen--detailed">${btn('draw-color', 4.5, 54, 'data-testid="color-red"')}
       <button class="draw-color abs" aria-label="shape-detailed" data-testid="shape-color-red" style="top:calc(var(--u)*30);left:calc(var(--u)*54);width:calc(var(--u)*4.5);height:calc(var(--u)*4.5)">x</button></div>
     ${btn('draw-color', 4.5, 64, 'data-testid="color-blue"')}
     <div class="draw-screen--simple">
       <button class="draw-color abs" aria-label="shape-simple" data-testid="shape-color-blue" style="top:calc(var(--u)*30);left:calc(var(--u)*64);width:calc(var(--u)*4.5);height:calc(var(--u)*4.5)">x</button></div>`,
  );
  const r = await inspectApp(page, { viewer: 'g3' });
  const small = r.issues.filter((i) => i.kind === 'tap-size').map((i) => i.text);
  // 主操作 5u（6u 未満）・補助 5u（5.5u 未満）・くわしくの外の色の札 4.5u（かんたん の図形の選択板の色の札も）は出す。
  // 鍵・くわしくの色の札（道具欄 color-*・図形の選択板 shape-color-*）・6.2u・5.6u は出さない
  expect(small.sort()).toEqual(
    ['draw-color-4.5', 'shape-simple', 'tap tap--aux-5', 'tap tap--main-5'].sort(),
  );
});

test('主操作どうしの間: 1.6u 未満は tap-gap・1.6u 以上は出さない', async ({ page }) => {
  const two = (gap: number) =>
    `<button class="home-card abs" aria-label="あ" style="top:calc(var(--u)*10);left:calc(var(--u)*10)">あ</button>
     <button class="home-card abs" aria-label="い" style="top:calc(var(--u)*10);left:calc(var(--u)*${24 + gap})">い</button>`;
  await show(page, two(1));
  expect(await appKinds(page)).toContain('tap-gap');
  await show(page, two(1.6));
  expect(await appKinds(page)).not.toContain('tap-gap');
  // 選んでいる札（.is-selected）の 8章の持ち上がり（translateY(-1u)）は戻して測る: 置いた間 1.6u なら出さない。
  // 選んでいない札が 1u 上にずれて間が 0.6u なら出す
  const stack = (cls: string) =>
    `<button class="home-card abs" aria-label="うえ" style="top:calc(var(--u)*10);left:calc(var(--u)*10)">うえ</button>
     <button class="home-card abs ${cls}" aria-label="した" style="top:calc(var(--u)*25.6);left:calc(var(--u)*10);transform:translateY(calc(var(--u)*-1))">した</button>`;
  await show(page, stack('is-selected'));
  expect(await appKinds(page)).not.toContain('tap-gap');
  await show(page, stack(''));
  expect(await appKinds(page)).toContain('tap-gap');
});

test('縮めても入らない題: data-fit-overflow を fit-overflow で出す・data-fit だけなら出さない', async ({
  page,
}) => {
  await show(
    page,
    `<button class="home-rec abs" aria-label="題" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*30);height:calc(var(--u)*8.6)">
       <span data-fit="2.2" data-fit-overflow>ながい ながい 題</span></button>
     <button class="home-rec abs" aria-label="題2" style="top:calc(var(--u)*30);left:calc(var(--u)*10);width:calc(var(--u)*30);height:calc(var(--u)*8.6)">
       <span data-fit="2.4">みじかい 題</span></button>`,
  );
  const r = await inspectApp(page, { viewer: 'g3' });
  const f = r.issues.filter((i) => i.kind === 'fit-overflow');
  expect(f.map((i) => i.text)).toEqual(['ながい ながい 題']);
  expect(f[0]!.detail).toContain('2.2');
});

test('参考: 舞台の端に近い札は edge-margin・絵が無い点線の枠は missing-illust', async ({
  page,
}) => {
  await show(
    page,
    `<button class="home-card abs" aria-label="した" style="bottom:calc(var(--u)*1);left:calc(var(--u)*10);width:calc(var(--u)*14);height:calc(var(--u)*14)">した</button>
     <button class="home-card abs" aria-label="ゆとり" style="top:calc(var(--u)*10);left:calc(var(--u)*30)">ゆとり</button>
     <svg data-illust="book" class="abs" viewBox="0 0 100 100" style="top:calc(var(--u)*10);left:calc(var(--u)*60);width:calc(var(--u)*10);height:calc(var(--u)*10)">
       <rect x="4" y="4" width="92" height="92" fill="none" stroke="#c00" stroke-dasharray="6 4"></rect></svg>
     <svg data-illust="apple" class="abs" viewBox="0 0 100 100" style="top:calc(var(--u)*10);left:calc(var(--u)*75);width:calc(var(--u)*10);height:calc(var(--u)*10)">
       <circle cx="50" cy="50" r="40" fill="#e55"></circle></svg>`,
  );
  const r = await inspectApp(page, { viewer: 'g3' });
  const edge = r.issues.filter((i) => i.kind === 'edge-margin');
  expect(edge.map((i) => i.text)).toEqual(['した']);
  const miss = r.issues.filter((i) => i.kind === 'missing-illust');
  expect(miss.map((i) => i.text)).toEqual(['book']);
});

test('板（aria-modal）: 後ろの札は root を板にすると見ない・板の中で重なった字は出す', async ({
  page,
}) => {
  const body = (overlap: boolean) => `
    <button class="tap abs" aria-label="うしろ" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*14);height:calc(var(--u)*10)">うしろ</button>
    <p class="abs" style="top:calc(var(--u)*30);left:calc(var(--u)*10)">うしろの もじ</p>
    <svg class="abs" viewBox="0 0 10 10" style="top:calc(var(--u)*14);left:calc(var(--u)*30);width:calc(var(--u)*40);height:calc(var(--u)*26)"><rect width="10" height="10" fill="#cde"></rect></svg>
    <div class="abs" role="dialog" aria-modal="true" data-testid="modal" style="inset:0;background:#fff">
      <div class="abs box" style="top:calc(var(--u)*14);left:calc(var(--u)*30);width:calc(var(--u)*40);height:calc(var(--u)*26)">
        <p class="abs" style="top:calc(var(--u)*2);left:calc(var(--u)*2)">ほごしゃの かくにん</p>
        ${overlap ? '<p class="abs" style="top:calc(var(--u)*2.5);left:calc(var(--u)*5)">かさなる もじ</p>' : ''}
        <button class="tap abs" aria-label="もどる" style="top:calc(var(--u)*12);left:calc(var(--u)*4);width:calc(var(--u)*14);height:calc(var(--u)*8)">もどる</button>
      </div>
    </div>`;
  await show(page, body(false));
  // root なし: 後ろの札と字は板に隠れている
  expect(await textKinds(page)).toContain('covered');
  expect(await appKinds(page)).toContain('unreachable');
  // 板の中だけを見る: 隠れていない
  const root = '[aria-modal="true"]';
  expect(await textKinds(page, { root })).toEqual([]);
  expect(await appKinds(page, { root })).toEqual([]);
  // 板の後ろの図（おえかきの紙・後ろの画面の絵）は、板の字の「下の図」に数えない。root なしでは数える
  expect(await textKinds(page)).toContain('text-on-figure');
  expect(await textKinds(page, { root })).not.toContain('text-on-figure');
  // 板の中で字が重なる
  await show(page, body(true));
  expect(await textKinds(page, { root })).toContain('overlap-text');
});

test('大人の範囲（adultSel）: 11px の字は small-text・13px は出さない・分かち書きは見ない・高さ 44px 未満のボタンは tap-size', async ({
  page,
}) => {
  const adult = (fs: number, h: number) => `
    <div class="adult abs" style="top:calc(var(--u)*6);left:calc(var(--u)*6);width:calc(var(--u)*50);font-weight:400">
      <p style="font-size:${fs}px">これは大人の文です。数と単位は 3 cm のように書きます。</p>
      <button style="height:${h}px;font-size:14px;padding:0 12px">ボタン</button>
      <select style="height:${h}px"><option>えらぶ</option></select>
      <label><input type="checkbox" style="width:20px;height:20px"> チェック</label>
    </div>`;
  await show(page, adult(11, 34));
  const t11 = await inspectText(page, { stage: 'g3', adultSel: '.adult' });
  const small = t11.issues.filter((i) => i.kind === 'small-text');
  expect(small).toHaveLength(1);
  expect(small[0]!.detail).toContain('11px');
  const a34 = await inspectApp(page, { viewer: 'g3', adultSel: '.adult' });
  const tap = a34.issues.filter((i) => i.kind === 'tap-size');
  // ボタン・選ぶ欄は出す。checkbox は出さない
  expect(tap.map((i) => i.where.split('.')[0]).sort()).toEqual(['button', 'select']);
  expect(tap[0]!.detail).toContain('44px');

  await show(page, adult(13, 44));
  const t13 = await inspectText(page, { stage: 'g3', adultSel: '.adult' });
  expect(t13.issues.filter((i) => i.kind === 'small-text')).toEqual([]);
  const a44 = await inspectApp(page, { viewer: 'g3', adultSel: '.adult' });
  expect(a44.issues.filter((i) => i.kind === 'tap-size')).toEqual([]);
  // 大人の範囲を指定しないと、同じ 13px の字は子供の規則（u）で小さいと出る
  const child = await inspectText(page, { stage: 'g3' });
  expect(child.issues.some((i) => i.kind === 'small-text')).toBe(true);
});

test('大人の範囲: 「（保護者の方へ）」で始まる文も px で見る・分かち書きの規則は当てない', async ({
  page,
}) => {
  const note = (text: string) =>
    `<p class="abs" style="top:calc(var(--u)*6);left:calc(var(--u)*6);width:calc(var(--u)*14);font-size:13px;font-weight:400;font-family:sans-serif">${text}</p>`;
  const body = 'ひょうじに もんだいが おきました。きろくは きえません。';
  // 分かち書きの段階（p4）で、空白の無い所で折れる文は wakachi-split（子供の文の規則）
  await show(page, note(body));
  const plain = await inspectText(page, { stage: 'p4' });
  expect(plain.issues.some((i) => i.kind === 'wakachi-split')).toBe(true);
  expect(plain.issues.some((i) => i.kind === 'small-text')).toBe(true);
  // 「（保護者の方へ）」で始まる大人の文は、同じ折れでも分かち書きを見ず、13px は小さいと数えない
  await show(page, note(`（保護者の方へ）${body}`));
  const adult = await inspectText(page, { stage: 'p4' });
  expect(adult.issues.filter((i) => i.kind === 'wakachi-split' || i.kind === 'small-text')).toEqual(
    [],
  );
  // 11px なら px の最小（12px）に足りない
  await show(page, note('（保護者の方へ）ちいさい もじ').replace('13px', '11px'));
  const tiny = await inspectText(page, { stage: 'p4' });
  expect(tiny.issues.filter((i) => i.kind === 'small-text')).toHaveLength(1);
});

test('画面全体のスクロール（pageScroll）: 画面の外の字の重なりもスクロールして出す・横のスクロールは page-scroll', async ({
  page,
}) => {
  const tall = (wide: boolean) =>
    `<div class="parent-root" data-testid="parent-app">
       <div style="height:1200px">せいじょうな ぶぶん</div>
       <button style="position:absolute;top:690px;left:20px;height:50px">へりの ボタン</button>
       <p style="position:absolute;top:1300px;left:20px">かさなる もじ</p>
       <p style="position:absolute;top:1304px;left:40px">かさなる もじ2</p>
       ${wide ? '<div style="width:2400px;height:10px;background:#ccc"></div>' : ''}
       <div style="height:300px"></div>
     </div>`;
  await load(page, tall(false));
  const opt = { root: '.parent-root', pageScroll: '.parent-root', adultSel: '.parent-root' };
  // いちばん上では、画面の外にある重なりは見えない（out-of-stage にもしない）
  const top = await inspectText(page, { stage: 'g3', ...opt });
  expect(top.issues.map((i) => i.kind)).toEqual([]);
  // 画面の端で半分切れた札は、その位置では押せない札にしない（スクロールすれば全部見える）
  const edge = await inspectApp(page, { viewer: 'g3', ...opt });
  expect(edge.issues.map((i) => i.kind)).not.toContain('unreachable');
  // 下までずらすと見える
  await page.evaluate(() => {
    document.querySelector('.parent-root')!.scrollTop = 800;
  });
  const down = await inspectText(page, { stage: 'g3', ...opt });
  expect(down.issues.map((i) => i.kind)).toContain('overlap-text');
  expect(down.issues.map((i) => i.kind)).not.toContain('out-of-stage');
  // pageScroll を渡さないと、画面の下の字を舞台の外（画面の外）と数える
  await page.evaluate(() => {
    document.querySelector('.parent-root')!.scrollTop = 0;
  });
  const plain = await inspectText(page, { stage: 'g3', root: '.parent-root' });
  expect(plain.issues.map((i) => i.kind)).toContain('out-of-stage');
  // 横にスクロールが出る
  await load(page, tall(true));
  const wide = await inspectText(page, { stage: 'g3', ...opt });
  expect(wide.issues.map((i) => i.kind)).toContain('page-scroll');
  const app = await inspectApp(page, { viewer: 'g3', ...opt });
  expect(app.issues.map((i) => i.kind)).not.toContain('scroll-no-cue');
});
