/**
 * 文字の配置の検査（helpers/text-layout.ts）自体の確認。わざと壊した見本で検出すること、
 * 普通の画面で誤検出しないことを確かめる。npm run check:text-layout:probe
 * （page.setContent の見本だけを使う。アプリの画面は開かない）
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inspectText } from './helpers/text-layout';
import type { TextIssueKind } from './helpers/text-layout';

const CSS = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
  :root { --u: min(1vw, 1.7778vh); }
  body { font-family: 'Yu Gothic', 'Meiryo', sans-serif; font-weight: 700; }
  .stage { position: relative; width: calc(var(--u) * 100); height: calc(var(--u) * 56.25);
    margin: 0 auto; overflow: hidden; font-size: calc(var(--u) * 3); }
  .abs { position: absolute; }
  .box { border: calc(var(--u) * 0.3) solid #333; background: #fff; }
  button { font: inherit; border: calc(var(--u) * 0.3) solid #333; background: #fde; padding: 0; }
  p { margin: 0; }
  rt { font-size: 0.5em; }
`;

async function show(page: Page, body: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head>
    <body><div class="stage">${body}</div></body></html>`);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function kinds(page: Page, stage = 'g3'): Promise<TextIssueKind[]> {
  const r = await inspectText(page, { stage });
  return [...new Set(r.issues.map((i) => i.kind))];
}

test('普通の画面では何も出さない（ふりがな・分かち書き・ボタン・2行の問題文）', async ({
  page,
}) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);right:calc(var(--u)*4);text-align:center;line-height:1.7">
       <span><ruby>大<rt>おお</rt></ruby>きな かぶを みんなで ひっぱりました。</span></p>
     <p class="abs" style="top:calc(var(--u)*16);left:calc(var(--u)*30);width:calc(var(--u)*40);line-height:1.7;white-space:pre-line">いちばん ながい ものは
どれかな？</p>
     <div class="abs" style="top:calc(var(--u)*30);left:calc(var(--u)*10);display:flex;gap:calc(var(--u)*2)">
       <button style="width:calc(var(--u)*14);height:calc(var(--u)*8)">りんご</button>
       <button style="width:calc(var(--u)*14);height:calc(var(--u)*8)">3 cm</button>
       <button style="width:calc(var(--u)*14);height:calc(var(--u)*8)">12:30</button>
     </div>
     <div class="abs box" style="bottom:calc(var(--u)*2);left:calc(var(--u)*12);width:calc(var(--u)*50);padding:calc(var(--u)*1);font-size:calc(var(--u)*2.1);line-height:1.4">
       <p>ひとつずつ かぞえると、ぜんぶで 5こ あります。</p></div>
     <svg class="abs" style="top:calc(var(--u)*40);left:calc(var(--u)*70);width:calc(var(--u)*20);height:calc(var(--u)*10)" viewBox="0 0 200 100">
       <rect x="10" y="10" width="80" height="80" fill="#cde"/><text x="120" y="60" font-size="24">5cm</text></svg>`,
  );
  const r0 = await inspectText(page, { stage: 'g1' });
  expect(r0.issues).toEqual([]);
});

test('はみ出し: 親の枠で切れる・枠の外に出る・舞台の外に出る', async ({ page }) => {
  await show(
    page,
    `<div class="abs box" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*20);height:calc(var(--u)*5);overflow:hidden">
       <p>とても ながい ぶんしょうが はこに はいりきらずに したの ほうで きれて しまう</p></div>
     <div class="abs box" style="top:calc(var(--u)*20);left:calc(var(--u)*5);width:calc(var(--u)*20);height:calc(var(--u)*5)">
       <p>とても ながい ぶんしょうが わくの そとに はみだして しまう</p></div>
     <div class="abs box" style="top:calc(var(--u)*35);left:calc(var(--u)*5);width:calc(var(--u)*20);height:calc(var(--u)*5);overflow:auto">
       <p>スクロールしないと みえない ぶんしょうが したの ほうに つづいて いる</p></div>
     <p class="abs" style="top:calc(var(--u)*50);left:calc(var(--u)*90);white-space:nowrap">ぶたいの そとへ</p>`,
  );
  const k = await kinds(page);
  expect(k).toContain('clipped');
  expect(k).toContain('text-outside-box');
  expect(k).toContain('scroll-hidden');
  expect(k).toContain('out-of-stage');
});

test('重なり: 文字どうし・文字の上の枠・ボタンどうし・ふりがな', async ({ page }) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">かさなる もじ</p>
     <p class="abs" style="top:calc(var(--u)*5.5);left:calc(var(--u)*7)">うえの もじ</p>
     <p class="abs" style="top:calc(var(--u)*15);left:calc(var(--u)*5)">かくれる もじ</p>
     <div class="abs box" style="top:calc(var(--u)*14);left:calc(var(--u)*8);width:calc(var(--u)*10);height:calc(var(--u)*6)"></div>
     <button class="abs" style="top:calc(var(--u)*30);left:calc(var(--u)*5);width:calc(var(--u)*12);height:calc(var(--u)*8)">あ</button>
     <button class="abs" style="top:calc(var(--u)*32);left:calc(var(--u)*12);width:calc(var(--u)*12);height:calc(var(--u)*8)">い</button>
     <p class="abs" style="top:calc(var(--u)*45);left:calc(var(--u)*5)"><ruby>漢字<rt style="position:relative;top:1em">かんじ</rt></ruby></p>`,
  );
  const k = await kinds(page);
  expect(k).toContain('overlap-text');
  expect(k).toContain('covered');
  expect(k).toContain('overlap-button');
  expect(k).toContain('ruby-overlap');
});

test('改行: 行頭の「。」・小さい「ゃ」・行末の「「」・最後の1文字・狭い折り返し', async ({
  page,
}) => {
  await show(
    page,
    // line-break: anywhere は、禁則をわざと破るための見本
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:4em;line-break:anywhere">あいうえ。かきくけ</p>
     <p class="abs" style="top:calc(var(--u)*13);left:calc(var(--u)*3);width:3em;line-break:anywhere">あいきゃくう</p>
     <p class="abs" style="top:calc(var(--u)*23);left:calc(var(--u)*3);width:4em;line-break:anywhere">あいう「えおかき」</p>
     <p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*40);width:6em">あいうえおかき</p>
     <p class="abs" style="top:calc(var(--u)*13);left:calc(var(--u)*40);width:1em">たてに ならぶ</p>`,
  );
  const r = await inspectText(page, { stage: 'g3' });
  const k = new Set(r.issues.map((i) => i.kind));
  expect(k).toContain('kinsoku-start');
  expect(r.issues.some((i) => i.kind === 'kinsoku-start' && i.text.includes('／。'))).toBe(true);
  expect(r.issues.some((i) => i.kind === 'kinsoku-start' && i.text.includes('／ゃ'))).toBe(true);
  expect(k).toContain('kinsoku-end');
  expect(k).toContain('orphan');
  expect(k).toContain('narrow-wrap');
});

test('改行: 分かち書きの語の途中・数と単位・ボタンの中の語', async ({ page }) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:5em">おおきな かぶを みんなで ひっぱる</p>
     <p class="abs" style="top:calc(var(--u)*23);left:calc(var(--u)*3);width:2.5em">12 cm</p>
     <p class="abs" style="top:calc(var(--u)*33);left:calc(var(--u)*3);width:2.5em">100円</p>
     <button class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*50);width:4em;height:calc(var(--u)*12)">チョコレート</button>`,
  );
  const r = await inspectText(page, { stage: 'g1' });
  const k = new Set(r.issues.map((i) => i.kind));
  expect(k).toContain('wakachi-split');
  expect(r.issues.filter((i) => i.kind === 'word-split').length).toBeGreaterThanOrEqual(2);
  expect(k).toContain('button-split');
});

test('文字の大きさ・画面のスクロール', async ({ page }) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);font-size:calc(var(--u)*1.2)">ちいさい もじ</p>`,
  );
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'visible';
    const d = document.createElement('div');
    d.style.cssText = 'width:200vw;height:10px';
    document.body.appendChild(d);
  });
  const k = await kinds(page, 'g1');
  expect(k).toContain('small-text');
  expect(k).toContain('page-scroll');
});

test('ふりがな: 長いふりがなの張り出しは出さない・行間不足で前の行に重なるときは出す', async ({
  page,
}) => {
  // 親字より長い rt は隣の仮名の上に張り出す（Chrome は親字の Range の外接も rt の幅まで広げる）。許される組み方
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*10);left:calc(var(--u)*5);line-height:2.2">
       <ruby>園<rt>ようち</rt></ruby><ruby>長<rt>ちょう</rt></ruby>せんせい、<ruby>正月<rt>しょうがつ</rt></ruby>に あいました。</p>`,
  );
  const ok = await inspectText(page, { stage: 'g2' });
  expect(ok.issues.filter((i) => /overlap/.test(i.kind))).toEqual([]);
  // 行間 1.0 でふりがなが前の行まで上がると、前の行の字に重なる
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*10);left:calc(var(--u)*5);width:calc(var(--u)*30);line-height:1.0">
       あいうえおかきくけこさしすせそ<br><ruby>漢字<rt style="position:relative;top:-0.5em">かんじ</rt></ruby>のよみかた</p>`,
  );
  const k = await kinds(page, 'g2');
  expect(k.some((x) => x === 'overlap-text' || x === 'ruby-overlap')).toBe(true);
});

test('スクロールさせる枠（data-scroll-region）: 枠ごとに印と高さを見る・ふつうの枠は 1 字ずつ出す', async ({
  page,
}) => {
  const long = 'ながい ぶんしょうが つづいて います。'.repeat(8);
  const region = (extra: string, h: number, inner = '') =>
    `<div class="abs box" data-scroll-region style="left:calc(var(--u)*5);width:calc(var(--u)*40);height:calc(var(--u)*${h});overflow:auto;font-size:calc(var(--u)*2.4);line-height:1.5;${extra}">
       <p>${long}</p></div>${inner}`;
  // 印があり、高さも 4 行以上: 何も出さない
  await show(
    page,
    region(
      'top:calc(var(--u)*3)',
      20,
      `<span class="abs" data-scroll-cue style="top:calc(var(--u)*24);left:calc(var(--u)*5)">▼</span>`,
    ),
  );
  const ok = await inspectText(page, { stage: 'g3' });
  expect(ok.issues.filter((i) => i.kind === 'scroll-hidden' || i.kind === 'clipped')).toEqual([]);
  // 印が無い: 枠につき 1 件（字ごとには出さない）
  await show(page, region('top:calc(var(--u)*3)', 20));
  const r1 = await inspectText(page, { stage: 'g3' });
  expect(r1.issues.filter((i) => i.kind === 'scroll-hidden')).toHaveLength(1);
  expect(r1.issues.filter((i) => i.kind === 'clipped')).toEqual([]);
  // 高さが 4 行未満: clipped
  await show(
    page,
    region(
      'top:calc(var(--u)*3)',
      8,
      `<span class="abs" data-scroll-cue style="top:calc(var(--u)*12);left:calc(var(--u)*5)">▼</span>`,
    ),
  );
  expect(await kinds(page, 'g3')).toContain('clipped');
  // data-scroll-region の無い枠は、今までどおり字ごとに scroll-hidden
  await show(
    page,
    `<div class="abs box" style="top:calc(var(--u)*3);left:calc(var(--u)*5);width:calc(var(--u)*40);height:calc(var(--u)*20);overflow:auto;font-size:calc(var(--u)*2.4)"><p>${long}</p></div>`,
  );
  const r2 = await inspectText(page, { stage: 'g3' });
  expect(r2.issues.filter((i) => i.kind === 'scroll-hidden').length).toBeGreaterThan(1);
});

test('不透明な板の下に隠れた字は covered だけ・透明な枠どうしの重なりは overlap-text に出す', async ({
  page,
}) => {
  // 板（不透明な背景）の下に隠れた選択肢の字が、板の字と重なっても、overlap-text には数えない（covered で出る）
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*20);left:calc(var(--u)*10)">かくれる せんたくし</p>
     <div class="abs box" style="top:calc(var(--u)*19);left:calc(var(--u)*8);width:calc(var(--u)*30);height:calc(var(--u)*6)">
       <p style="position:absolute;top:calc(var(--u)*1);left:calc(var(--u)*2)">かいせつの ぶん</p></div>`,
  );
  const hidden = await kinds(page, 'g3');
  expect(hidden).toContain('covered');
  expect(hidden).not.toContain('overlap-text');
  // 背景も線も透明な枠どうし（どちらも手前でも奥でもない）は、今までどおり overlap-text
  await show(
    page,
    `<div class="abs" style="top:calc(var(--u)*20);left:calc(var(--u)*10)"><p>かさなる もじ</p></div>
     <div class="abs" style="top:calc(var(--u)*20.5);left:calc(var(--u)*12)"><p>うえの もじ</p></div>`,
  );
  expect(await kinds(page, 'g3')).toContain('overlap-text');
});

test('スクロールの枠の種類: work・explain・figure は印があっても1件・transcript は印だけ', async ({
  page,
}) => {
  const long = 'ながい ぶんしょうが つづいて います。'.repeat(8);
  const region = (kind: string, withCue: boolean) =>
    `<div class="abs box" data-scroll-region="${kind}" style="top:calc(var(--u)*3);left:calc(var(--u)*5);width:calc(var(--u)*40);height:calc(var(--u)*12);overflow:auto;font-size:calc(var(--u)*2.4);line-height:1.5">
       <p>${long}</p></div>
     ${withCue ? `<span class="abs" data-scroll-cue style="top:calc(var(--u)*16);left:calc(var(--u)*5)">▼</span>` : ''}`;
  for (const kind of ['work', 'explain']) {
    await show(page, region(kind, true));
    const r = await inspectText(page, { stage: 'g3' });
    const sh = r.issues.filter((i) => i.kind === 'scroll-hidden');
    expect(sh).toHaveLength(1);
    expect(sh[0]!.detail).toMatch(kind === 'work' ? /作業領域が .*u 足りず/ : /解説が板に .*行分/);
    expect(r.issues.filter((i) => i.kind === 'clipped')).toEqual([]);
  }
  // 数の入力の図の段（figure。T7）: 印があっても1件。見える高さが4行未満（12u ÷ 3.6u ＝ 3.3行）の clipped も今までどおり出す
  await show(page, region('figure', true));
  const fig = await inspectText(page, { stage: 'g3' });
  const figSh = fig.issues.filter((i) => i.kind === 'scroll-hidden');
  expect(figSh).toHaveLength(1);
  expect(figSh[0]!.detail).toMatch(/図の段が .*u 足りず/);
  expect(fig.issues.filter((i) => i.kind === 'clipped')).toHaveLength(1);
  await show(page, region('transcript', true));
  expect(
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'scroll-hidden' || i.kind === 'clipped',
    ),
  ).toEqual([]);
  await show(page, region('transcript', false));
  expect(
    (await inspectText(page, { stage: 'g3' })).issues.filter((i) => i.kind === 'scroll-hidden'),
  ).toHaveLength(1);
});

test('分かち書きの「・」: 2字以上の語のあとは出さない・1字の並びは出す', async ({ page }) => {
  // 「・」のあとで折れる（<wbr> + keep-all）。「くに・／まち・／ひと」は語と語の区切りなので出さない
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:5.5em;word-break:keep-all">ある くに・<wbr>まち・<wbr>ひと</p>`,
  );
  const ok = await inspectText(page, { stage: 'g2' });
  expect(ok.issues.filter((i) => i.kind === 'wakachi-split')).toEqual([]);
  // 1字の並び（き・つ・つ・き）は、「・」のあとの改行でも出す
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:4em;word-break:keep-all">あ き・<wbr>つ・<wbr>つ・<wbr>き</p>`,
  );
  const ng = await inspectText(page, { stage: 'g2' });
  expect(ng.issues.some((i) => i.kind === 'wakachi-split' && i.text.includes('・／'))).toBe(true);
});

test('文字の大きさ: 最小の 1% までの差は出さない・それ以上は出す（小数2桁）', async ({ page }) => {
  // g1 の最小は 2u。1.99u は丸めの誤差、1.9u は小さすぎる
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);font-size:calc(var(--u)*1.99)">まるめの さ</p>`,
  );
  expect((await inspectText(page, { stage: 'g1' })).issues).toEqual([]);
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);font-size:calc(var(--u)*1.9)">ちいさい</p>`,
  );
  const r = await inspectText(page, { stage: 'g1' });
  expect(r.issues.find((i) => i.kind === 'small-text')?.detail).toContain('1.9u（最小 2u');
});

test('スクロールの枠の下端で半分切れた行: 枠の外の段に当たっても covered にしない（C9）・枠の中にかぶされば出す', async ({
  page,
}) => {
  const long = 'ながい ぶんしょうが つづいて います。'.repeat(8);
  const build = async (cueOverlapPx: number) => {
    await show(
      page,
      `<div id="reg" class="abs" data-scroll-region="passage" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*40);height:calc(var(--u)*20);overflow:auto;font-size:calc(var(--u)*2.4);line-height:1.5;border:0;padding:0">
         <p>${long}</p></div>
       <button id="cue" class="abs" aria-label="つづき" style="left:calc(var(--u)*5);width:calc(var(--u)*40);height:calc(var(--u)*4)"></button>`,
    );
    // 3 行目の字の中心がちょうど枠の下端（+0.3px）になるように枠の高さを決め、「つづき」の段を枠の下端に置く
    await page.evaluate((overlap) => {
      const reg = document.getElementById('reg') as HTMLElement;
      const node = reg.querySelector('p')!.firstChild as Text;
      const rg = document.createRange();
      let line = 0;
      let lastTop = -1;
      let cy = 0;
      for (let i = 0; i < node.data.length; i++) {
        if (/\s/.test(node.data[i]!)) continue;
        rg.setStart(node, i);
        rg.setEnd(node, i + 1);
        const r = rg.getBoundingClientRect();
        if (lastTop >= 0 && Math.abs(r.top - lastTop) > 2) line++;
        lastTop = r.top;
        if (line === 2) {
          cy = (r.top + r.bottom) / 2;
          break;
        }
      }
      const top = reg.getBoundingClientRect().top;
      reg.style.height = `${cy + 0.3 - top}px`;
      const cue = document.getElementById('cue') as HTMLElement;
      // 枠の下端より 0.4px 上から始める（当たり判定は画面のピクセルに丸まる）
      cue.style.top = `${cy + 0.3 - 0.4 - overlap}px`;
    }, cueOverlapPx);
  };
  await build(0);
  const edge = await inspectText(page, { stage: 'g3' });
  expect(edge.issues.filter((i) => i.kind === 'covered')).toEqual([]);
  // 枠の中に 60px かぶさる段は、字の真上なので出す
  await build(60);
  expect((await inspectText(page, { stage: 'g3' })).issues.some((i) => i.kind === 'covered')).toBe(
    true,
  );
});

test('ボタンの上の飾り: pointer-events: none・同じ親・文字なしのボタンは出さない（C10）・文字のあるボタンは出す', async ({
  page,
}) => {
  const decor =
    '<div class="box" style="position:absolute;inset:0;pointer-events:none;border-radius:50%"></div>';
  const wrap = (label: string, inner: string) =>
    `<div class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">
       <button ${label ? '' : 'aria-label="あか"'} style="display:block;width:calc(var(--u)*14);height:calc(var(--u)*8)">${label}</button>${inner}</div>`;
  const covered = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter((i) => i.kind === 'covered');
  // 文字なし（aria-label だけ）のボタンの上の飾り: 出さない
  await show(page, wrap('', decor));
  expect(await covered()).toEqual([]);
  // 文字のあるボタンの上の飾り: 出す
  await show(page, wrap('あか', decor));
  expect((await covered()).length).toBeGreaterThan(0);
  // pointer-events が none でない飾り（押せなくなる）: 出す
  await show(page, wrap('', decor.replace('pointer-events:none;', '')));
  expect((await covered()).length).toBeGreaterThan(0);
  // ボタンの親の外にある飾り: 出す
  await show(
    page,
    `${wrap('', '')}<div class="abs box" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*14);height:calc(var(--u)*8);pointer-events:none"></div>`,
  );
  expect((await covered()).length).toBeGreaterThan(0);
  // 祖先の overflow の枠で切ると、ボタンより小さくなる札（外接はボタンより大きい）: 出さない。枠が無ければ出す
  const big = (clip: boolean) =>
    `<div class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">
       <button style="display:block;width:calc(var(--u)*14);height:calc(var(--u)*8)">あか</button>
       <div style="position:absolute;left:0;top:0;${clip ? 'width:calc(var(--u)*5);height:calc(var(--u)*4);overflow:hidden' : ''}">
         <div class="box" style="width:calc(var(--u)*30);height:calc(var(--u)*30)"></div></div></div>`;
  await show(page, big(true));
  expect(await covered()).toEqual([]);
  await show(page, big(false));
  expect((await covered()).length).toBeGreaterThan(0);
});

test('ボタンの中の空白でない所の改行: 空白が1つの文は出さない・空白の多いラベルは出す（C11）', async ({
  page,
}) => {
  const btn = (w: string, label: string) =>
    `<button class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:${w};height:calc(var(--u)*20)">${label}</button>`;
  // 名前の空白が1つ（空白の数 × 12 < 字数）: 文節の切れ目でも「空白でない所で改行」にしない
  await show(page, btn('7em', 'もりかわ はるかさんがきょうのおはなしをしてくれる'));
  const one = await inspectText(page, { stage: 'g4' });
  expect(one.issues.filter((i) => i.detail === '空白でない所で改行')).toEqual([]);
  // 空白が多い（空白の数 ≧ 字数 ÷ 12）: 空白でない所の改行を出す（分かち書きでない段階でも）
  await show(page, btn('4.5em', 'あいうえおか きくけこさし たちつてとな'));
  const many = await inspectText(page, { stage: 'g4' });
  expect(
    many.issues.some((i) => i.kind === 'button-split' && i.detail === '空白でない所で改行'),
  ).toBe(true);
});

test('記法の漏れ: 《》・{{ }} が画面に出ていたら出す（C12）・ふつうの文は出さない', async ({
  page,
}) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">終《お》わり</p>
     <p class="abs" style="top:calc(var(--u)*15);left:calc(var(--u)*5)">{{name}}さん</p>`,
  );
  const r = await inspectText(page, { stage: 'g3' });
  expect(r.issues.filter((i) => i.kind === 'markup-leak')).toHaveLength(2);
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">おわり（おしまい）</p>`,
  );
  expect(
    (await inspectText(page, { stage: 'g3' })).issues.filter((i) => i.kind === 'markup-leak'),
  ).toEqual([]);
});

test('正誤の印（.mark）: 誤答の ？と字の後ろの ○ は出さない・字の上の ○ は出す（C13）', async ({
  page,
}) => {
  const mark = (cls: string, style: string) =>
    `<span class="mark ${cls}" aria-hidden="true" style="position:absolute;pointer-events:none;${style}"></span>`;
  const card = (inner: string) =>
    `<div class="abs box" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*14);height:calc(var(--u)*8)"><span style="position:relative;z-index:1">ここ</span>${inner}</div>`;
  const covered = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter((i) => i.kind === 'covered');
  const over = 'inset:0;background:#cfc;z-index:2';
  // 誤答の ？: 札の上に重ねる設計
  await show(page, card(mark('mark--wrong', over)));
  expect(await covered()).toEqual([]);
  // 正解の ○ が字の後ろ（z-index 0、字は 1）: 出さない
  await show(page, card(mark('mark--correct', 'inset:0;background:#cfc;z-index:0')));
  expect(await covered()).toEqual([]);
  // 正解の ○ が字の上: 出す
  await show(page, card(mark('mark--correct', over)));
  expect((await covered()).length).toBeGreaterThan(0);
});

test('数のあとの助詞: 数と助詞の境目の改行は出さない・仮名の助数詞と単位は出す（C14）', async ({
  page,
}) => {
  // 幅 1em: 数字の次の字は必ず次の行になる（「7／で」のような境目）
  const narrow = (s: string, top: number) =>
    `<p class="abs" style="top:calc(var(--u)*${top});left:calc(var(--u)*3);width:1em;line-break:anywhere">${s}</p>`;
  const wordSplit = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'word-split' && i.detail === '数と単位・助数詞の間',
    );
  // 助詞（で・は・が・に・を・と・の・も・や・へ・か）: 数えない
  await show(
    page,
    narrow('7で', 3) + narrow('2は', 3).replace('left:calc(var(--u)*3)', 'left:calc(var(--u)*10)'),
  );
  expect(await wordSplit()).toEqual([]);
  await show(
    page,
    narrow('9に', 3) + narrow('5の', 3).replace('left:calc(var(--u)*3)', 'left:calc(var(--u)*10)'),
  );
  expect(await wordSplit()).toEqual([]);
  // 仮名の助数詞の頭（に＋ん・と＋う・は＋い・か＋い・か＋げつ）: 数える
  // （助数詞の仮名は nowrap の塊にして、数の直後でだけ折れるようにする）
  for (const [n, k] of [
    ['3', 'にん'],
    ['2', 'とう'],
    ['5', 'はい'],
    ['4', 'かい'],
    ['6', 'かげつ'],
    ['3', 'にち'],
    ['2', 'か所'],
  ] as const) {
    const s = n + k;
    await show(page, narrow(`${n}<span style="white-space:nowrap">${k}</span>`, 3));
    expect(await wordSplit(), s).not.toEqual([]);
  }
  // 助詞でない仮名（こ）・漢字の助数詞・英字の単位は今までどおり数える
  for (const s of ['2こ', '3年', '3 <span style="white-space:nowrap">cm</span>']) {
    await show(page, narrow(s, 3));
    expect(await wordSplit(), s).not.toEqual([]);
  }
});

test('0×0 の図: 子があるのに大きさが 0 の svg・img・.fig-svg・.fig-illust を1件出す（C15）', async ({
  page,
}) => {
  const zeroFig = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.detail === '図の大きさが 0（見えない）',
    );
  const all = async () => (await inspectText(page, { stage: 'g3' })).issues;
  // 字のある図（text ⊂ svg の clipped を1字ずつ出さず、1件にまとめる）
  await show(
    page,
    `<div class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5);display:flex">
       <svg class="fig-svg" style="width:0;height:0" viewBox="0 0 100 50"><rect width="100" height="50" fill="#cde"/><text x="10" y="30" font-size="20">A地てん</text><text x="10" y="45" font-size="20">B地てん</text></svg></div>`,
  );
  expect(await zeroFig()).toHaveLength(1);
  expect((await all()).filter((i) => i.kind === 'clipped')).toHaveLength(1);
  expect((await all()).filter((i) => i.kind === 'small-text' || i.kind === 'overlap-text')).toEqual(
    [],
  );
  // 字の無い図（図形だけ）
  await show(
    page,
    `<div class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5);height:calc(var(--u)*10)">
       <svg style="width:0;height:calc(var(--u)*10)" viewBox="0 0 100 50"><circle cx="50" cy="25" r="20" fill="#cde"/></svg></div>`,
  );
  expect(await zeroFig()).toHaveLength(1);
  // .fig-illust（子のあるラッパー）が高さ 0
  await show(
    page,
    `<div class="abs fig-illust" style="top:calc(var(--u)*5);left:calc(var(--u)*5);height:0;overflow:hidden"><span style="display:block;width:calc(var(--u)*10);height:calc(var(--u)*5);background:#cde"></span></div>`,
  );
  expect(await zeroFig()).toHaveLength(1);
  // 普通の図・display:none・visibility:hidden・aria-hidden の祖先・defs だけの svg・.sr-only は出さない
  await show(
    page,
    `<svg class="abs fig-svg" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*20);height:calc(var(--u)*10)" viewBox="0 0 100 50"><rect width="100" height="50" fill="#cde"/></svg>
     <svg style="display:none;width:0;height:0"><rect width="9" height="9"/></svg>
     <svg style="visibility:hidden;width:0;height:0"><rect width="9" height="9"/></svg>
     <div aria-hidden="true"><svg style="width:0;height:0"><rect width="9" height="9"/></svg></div>
     <svg width="0" height="0" style="position:absolute"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs></svg>
     <div class="sr-only"><svg style="width:0;height:0"><rect width="9" height="9"/></svg></div>`,
  );
  expect(await zeroFig()).toEqual([]);
});

test('字を横切る正解の輪: 輪の線の帯に字の中心が2つ以上入れば出す・1行6字以下の札と輪の中に収まる文は出さない（C16）', async ({
  page,
}) => {
  const crossing = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '正解の ○ が字を横切る',
    );
  const ring = (diameter: number, z = 0) =>
    `<span class="mark mark--correct" aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(var(--u)*${diameter});height:calc(var(--u)*${diameter});border:calc(var(--u)*3) solid #0a0;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:${z}"></span>`;
  const card = (text: string, inner: string) =>
    `<div class="abs box" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*40);height:calc(var(--u)*16);display:grid;place-items:center"><span style="position:relative;z-index:1;white-space:nowrap">${text}</span>${inner}</div>`;
  // 10字の1行の文の真ん中に直径 14u の輪（線 3u）: 左右の字が帯に入る（字の後ろ・z-index 0 でも出す）
  await show(page, card('あいうえおかきくけこ', ring(14)));
  expect(await crossing()).toHaveLength(1);
  // 1行・6字以下の札（絵の札・短い語）は数えない
  await show(page, card('あいうえお', ring(14)));
  expect(await crossing()).toEqual([]);
  // 輪が文より外（直径 36u）にあって字の帯に入らない
  await show(page, card('あいうえおかきくけこ', ring(36)));
  expect(await crossing()).toEqual([]);
  // 輪の線が無い（背景だけの印）は数えない
  await show(
    page,
    card(
      'あいうえおかきくけこ',
      `<span class="mark mark--correct" aria-hidden="true" style="position:absolute;inset:0;background:#cfc;z-index:0"></span>`,
    ),
  );
  expect(await crossing()).toEqual([]);
});

test('複合辞の切れ目: 頭の助詞の直後の「と／いう」「に／ついて」は出さない・同じ語のほかの位置とほかの語の途中は出す（C17）', async ({
  page,
}) => {
  const btn = (w: string, label: string) =>
    `<button class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:${w};height:calc(var(--u)*30)">${label}</button>`;
  const splits = async (w: string, label: string) => {
    await show(page, btn(w, label));
    return (await inspectText(page, { stage: 'g4' })).issues.filter(
      (i) => i.kind === 'button-split',
    );
  };
  // 「はなすと／いうこと」「はなすに／ついて」: 助詞と動詞の境目（文節の切れ目）。数えない
  expect(await splits('5em', 'ことばをはなすということ')).toEqual([]);
  expect(await splits('5em', 'はなすについて')).toEqual([]);
  // 同じ語のほかの位置（「につい／て」）は今までどおり出す
  const inner = await splits('4em', 'はなすについて');
  expect(inner.map((i) => i.detail)).toEqual(['語「について」の途中']);
  // ほかの語の途中（「方／向」）は今までどおり出す
  const other = await splits('1em', '方向');
  expect(other.map((i) => i.detail)).toEqual(['語「方向」の途中']);
});
