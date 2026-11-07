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
  // 項目が空白を含む句（「ちいさい じ」）でも、「・」のあとは項目の境目なので出さない（選ぶ画面の札の名前。check:app-layout のレビュー）
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:7em;word-break:keep-all">ちいさい じ・<wbr>のばす おと</p>`,
  );
  const phrase = await inspectText(page, { stage: 'p5' });
  expect(phrase.issues.filter((i) => i.kind === 'wakachi-split')).toEqual([]);
  // 1字の並び（き・つ・つ・き）は、「・」のあとの改行でも出す
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:4em;word-break:keep-all">あ き・<wbr>つ・<wbr>つ・<wbr>き</p>`,
  );
  const ng = await inspectText(page, { stage: 'g2' });
  expect(ng.issues.some((i) => i.kind === 'wakachi-split' && i.text.includes('・／'))).toBe(true);
  // 文の終わりのあとの「・」（聞く問題の書き起こしの文と文の区切り）は、後ろが 1 字の語（I）でも出さない（第6回のレビュー）
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:5em;word-break:keep-all">I went to the sea.・<wbr>I swam.</p>`,
  );
  const sentence = await inspectText(page, { stage: 'g5', pack: 'en-g56' });
  expect(sentence.issues.filter((i) => i.kind === 'wakachi-split')).toEqual([]);
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

test('字を横切る正解の輪: 輪の線の帯に字の中心が1つでも入れば出す（札の字数では外さない）・輪の中に収まる文は出さない（C16・C21）', async ({
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
  // 1行・5字の短い札でも、字の中心が帯に入れば出す（C21。幼児の英語の札の「な」「こ」が輪に切られていた）
  await show(page, card('あいうえお', ring(14)));
  expect(await crossing()).toHaveLength(1);
  // 短い語が輪の中に収まり、帯に字の中心が入らなければ出さない
  await show(page, card('あい', ring(14)));
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

test('絵とラベルのある札（C21・第6回 W1）: 絵の段の輪がラベルの字を横切れば出す・絵の段に収まれば出さない', async ({
  page,
}) => {
  // 札（.choice）の中に絵の段（.eng-opts__pic）とラベル。輪は絵の段の中に描くが、字は札の字として見る（包みの中だけを見ない）
  const opt = (ringU: number) =>
    `<button class="choice abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*10);width:calc(var(--u)*20);display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*0.4);padding:calc(var(--u)*0.8)"><span class="eng-opts__pic" style="position:relative;display:flex;align-items:center;justify-content:center;align-self:stretch;height:calc(var(--u)*10)"><span class="mark mark--correct" aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(var(--u)*${ringU});height:calc(var(--u)*${ringU});border:calc(var(--u)*0.9) solid #0a0;border-radius:50%;box-sizing:border-box;z-index:-1"></span><span style="display:block;width:calc(var(--u)*8);height:calc(var(--u)*8);background:#fc9"></span></span><span class="eng-opts__label" style="font-size:calc(var(--u)*2.6)">なかの ねこ</span></button>`;
  const crossing = async () =>
    (await inspectText(page, { stage: 'p4' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '正解の ○ が字を横切る',
    );
  // 絵の段（10u）＋1.6u の輪: ラベルの字にかからない
  await show(page, opt(11.6));
  expect(await crossing()).toEqual([]);
  // 札を囲む大きさの輪（17u）: 輪の下の線がラベルの字を横切る
  await show(page, opt(17));
  expect(await crossing()).toHaveLength(1);
});

test('角の ○（C21）: 字・ふりがなの矩形に円が重なれば出す・離れていれば出さない', async ({
  page,
}) => {
  const corner = (pos: string) =>
    `<span class="mark mark--correct" aria-hidden="true" style="position:absolute;${pos};width:calc(var(--u)*3.2);height:calc(var(--u)*3.2);box-sizing:border-box;border:calc(var(--u)*0.6) solid #0a0;border-radius:50%;background:#fff;pointer-events:none;z-index:2"></span>`;
  const card = (text: string, inner: string) =>
    `<div class="abs box" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*30);height:calc(var(--u)*12);position:absolute"><span style="position:absolute;${text};white-space:nowrap">みず<ruby>湖<rt>うみ</rt></ruby></span>${inner}</div>`;
  const hits = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '角の ○ が字・ふりがなに重なる',
    );
  // 右上の ○ が右上のふりがなにかかる
  await show(
    page,
    card(
      'top:calc(var(--u)*0.5);right:calc(var(--u)*1)',
      corner('top:calc(var(--u)*-1.4);right:calc(var(--u)*-1.4)'),
    ),
  );
  expect(await hits()).toHaveLength(1);
  // 字が左にあり、○ が右下の角にあれば重ならない
  await show(
    page,
    card(
      'top:calc(var(--u)*3);left:calc(var(--u)*1)',
      corner('bottom:calc(var(--u)*-1.4);right:calc(var(--u)*-1.4)'),
    ),
  );
  expect(await hits()).toEqual([]);
});

test('正解の輪が隣の札にかかる（C21）', async ({ page }) => {
  const ring = `<span class="mark mark--correct" aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(var(--u)*16);height:calc(var(--u)*16);border:calc(var(--u)*0.9) solid #0a0;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:0"></span>`;
  const cards = (gap: number) =>
    `<div class="abs box tk-card" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*10);height:calc(var(--u)*10);display:grid;place-items:center"><span>あ</span>${ring}</div>
     <div class="abs box tk-card" style="top:calc(var(--u)*10);left:calc(var(--u)*(20 + ${gap}));width:calc(var(--u)*10);height:calc(var(--u)*10);display:grid;place-items:center"><span>い</span></div>`;
  const hits = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '正解の ○ が隣の札にかかる',
    );
  await show(page, cards(1));
  expect(await hits()).toHaveLength(1);
  await show(page, cards(8));
  expect(await hits()).toEqual([]);
});

test('線でむすぶ問題（C25）: 線が両端以外の札の後ろを通れば出す・通らなければ出さない', async ({
  page,
}) => {
  const html = (midLeft: number) =>
    `<div class="eng-match abs" style="inset:0">
       <svg class="abs" style="inset:0;width:100%;height:100%" viewBox="0 0 100 56.25"><line class="eng-match__line is-correct" x1="15" y1="15" x2="15" y2="40" stroke="#0a0" stroke-width="0.7"/></svg>
       <div class="abs box tk-card" style="top:calc(var(--u)*5);left:calc(var(--u)*10);width:calc(var(--u)*10);height:calc(var(--u)*10)">あ</div>
       <div class="abs box tk-card" style="top:calc(var(--u)*22);left:calc(var(--u)*${midLeft});width:calc(var(--u)*10);height:calc(var(--u)*8)">い</div>
       <div class="abs box tk-card" style="top:calc(var(--u)*40);left:calc(var(--u)*10);width:calc(var(--u)*10);height:calc(var(--u)*10)">う</div>
     </div>`;
  const hits = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '線が別の札の後ろを通る',
    );
  await show(page, html(10));
  expect(await hits()).toHaveLength(1);
  await show(page, html(40));
  expect(await hits()).toEqual([]);
});

test('記法の漏れ（C24）: [[ ]] が画面に出ていたら出す', async ({ page }) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5)">[[3/x]]の しき</p>`,
  );
  const r = await inspectText(page, { stage: 'g3' });
  expect(r.issues.filter((i) => i.kind === 'markup-leak')).toHaveLength(1);
});

test('図の overflow: visible（C20）: svg の枠の外の字は、svg が visible なら出さず hidden なら出す', async ({
  page,
}) => {
  const fig = (ov: string) =>
    `<svg class="abs" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*20);height:calc(var(--u)*10);overflow:${ov}" viewBox="0 0 100 50"><rect width="100" height="50" fill="#cde"/><text x="20" y="75" font-size="14">いち</text></svg>`;
  const clipped = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter((i) => i.kind === 'clipped');
  await show(page, fig('visible'));
  expect(await clipped()).toEqual([]);
  await show(page, fig('hidden'));
  expect((await clipped()).length).toBeGreaterThan(0);
});

test('始め括弧の前の改行（C23）: ボタンの「種子の 中／（子葉）」は出さない', async ({ page }) => {
  await show(
    page,
    `<button class="abs" style="top:calc(var(--u)*3);left:calc(var(--u)*3);width:calc(var(--u)*13.5);height:calc(var(--u)*30);line-height:1.4">種子の 中（子葉）</button>`,
  );
  const r = await inspectText(page, { stage: 'g5' });
  expect(r.issues.filter((i) => i.kind === 'button-split')).toEqual([]);
});

test('分かち書きの教材（C22）: 小3以上でも pack が en-g34・en-g56 なら語の途中の改行を出す', async ({
  page,
}) => {
  await show(
    page,
    `<p class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*19.5);line-height:1.7;font-size:calc(var(--u)*3)">もういちど 聞こう。</p>`,
  );
  const split = async (pack?: string) =>
    (await inspectText(page, { stage: 'g5', pack })).issues.filter(
      (i) => i.kind === 'wakachi-split',
    );
  expect((await split('en-g56')).length).toBeGreaterThan(0);
  expect((await split('en-g34')).length).toBeGreaterThan(0);
  expect(await split('g5-ja')).toEqual([]);
  expect(await split()).toEqual([]);
});

test('正解の輪と字（C27）: 字の矩形が輪の線の帯と交われば出す（中心が帯の外でも）・ふりがなも数える・帯に触れない字は出さない', async ({
  page,
}) => {
  const crossing = async () =>
    (await inspectText(page, { stage: 'g3' })).issues.filter(
      (i) => i.kind === 'covered' && i.detail === '正解の ○ が字を横切る',
    );
  const ring = (
    diameter: number,
    line: number,
    pos = 'left:50%;top:50%;transform:translate(-50%,-50%)',
  ) =>
    `<span class="mark mark--correct" aria-hidden="true" style="position:absolute;${pos};width:calc(var(--u)*${diameter});height:calc(var(--u)*${diameter});border:calc(var(--u)*${line}) solid #0a0;border-radius:50%;box-sizing:border-box;pointer-events:none;z-index:0"></span>`;
  const card = (text: string, inner: string, place = 'place-items:center') =>
    `<div class="abs box" style="top:calc(var(--u)*10);left:calc(var(--u)*10);width:calc(var(--u)*40);height:calc(var(--u)*16);display:grid;${place}"><span style="position:relative;z-index:1;white-space:nowrap">${text}</span>${inner}</div>`;
  // 「すいか」（9u）の真ん中に、直径 9.6u・線 0.9u の細い輪。「す」「か」の中心は帯（半径 3.9〜4.8u）の内側にあるが、
  // 字の矩形が帯を横切る。字の中心だけを見ていた C21 までは通り抜けた（g1.math.shapes/1・2 の「すいか」「かん」）
  await show(page, card('すいか', ring(9.6, 0.9)));
  const thin = await crossing();
  expect(thin).toHaveLength(1);
  expect(thin[0]!.text).toMatch(/[すか]/);
  // 輪の中に字が収まる（内の円に入りきっている）: 出さない
  await show(page, card('あい', ring(14, 3)));
  expect(await crossing()).toEqual([]);
  // 輪から離れた字（外の円の外）: 出さない
  await show(page, card('あい', ring(6, 0.9), 'place-items:start start;padding:calc(var(--u)*1)'));
  expect(await crossing()).toEqual([]);
  // ふりがな（rt）だけを輪の線が横切る: 出す（C27 までは rt を除いていた。listen の絵の段の輪とふりがな）。
  // 輪の上の弧の帯（線 0.8u）の中央を rt の縦の中央に合わせる。親字は輪の内の円に入りきる
  const withRuby = () =>
    card('<ruby>湖<rt>うみ</rt></ruby>', ring(16, 0.8, 'left:0;top:0'), 'place-items:center');
  await show(page, withRuby());
  await page.evaluate(() => {
    const c = document.querySelector('.abs.box') as HTMLElement;
    const rt = c.querySelector('rt') as HTMLElement;
    const ring = c.querySelector('.mark') as HTMLElement;
    const cr = c.getBoundingClientRect();
    const rr = rt.getBoundingClientRect();
    const u = Math.min(window.innerWidth / 100, (window.innerHeight * 1.7778) / 100);
    ring.style.left = `${rr.left + rr.width / 2 - cr.left - 8 * u}px`;
    ring.style.top = `${(rr.top + rr.bottom) / 2 - cr.top - 0.4 * u}px`;
  });
  const rtHit = await crossing();
  expect(rtHit).toHaveLength(1);
  expect(rtHit[0]!.text).toBe('うみ');
  // 輪が字から離れていれば（ふりがなにもかからない）出さない
  await show(page, withRuby());
  await page.evaluate(() => {
    const ring = document.querySelector('.abs.box .mark') as HTMLElement;
    ring.style.left = '0px';
    ring.style.top = '-60px';
  });
  expect(await crossing()).toEqual([]);
});

test('絵が札の外に出る・札で切れる（C28）: 札の外へ 0.3u を超えて出れば札ごとに 1 件・収まる絵と正誤の印・バッジは出さない', async ({
  page,
}) => {
  const pic = (sizeU: number) =>
    `<svg viewBox="0 0 100 100" style="flex:none;width:calc(var(--u)*${sizeU});height:calc(var(--u)*${sizeU})"><rect width="100" height="100" fill="#fc9"/></svg>`;
  const figs = async () =>
    (await inspectText(page, { stage: 'p5' })).issues.filter(
      (i) => i.kind === 'figure-outside-box',
    );
  const choice = (left: number, inner: string) =>
    `<div class="choice abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*${left});width:calc(var(--u)*14);height:calc(var(--u)*14);display:flex;align-items:center;justify-content:center">${inner}</div>`;
  const row = (n: number, sizeU: number) =>
    `<div class="fig-illust__group" style="display:flex;gap:calc(var(--u)*0.6)">${pic(sizeU).repeat(n)}</div>`;
  // 札（14u）より広い絵の列（5 ひき × 7u ＋すき間 ＝ 37.4u。p5.en.picture-book/42 の いぬ）: 札ごとに 1 件
  await show(page, choice(10, row(5, 7)) + choice(40, row(2, 5)));
  const out = await figs();
  expect(out).toHaveLength(1);
  expect(out[0]!.detail).toMatch(/^絵が札の外に 1\d\.\du 出る$/);
  // 札に収まる絵・0.3u 以内の出（線の太さ・丸め）は出さない
  await show(page, choice(10, row(2, 5)) + choice(40, pic(14.2)));
  expect(await figs()).toEqual([]);
  // 札の中の枠（overflow: hidden）で切れる（p5.math.measure-compare/8 の塔。16u×68u の絵が 16u×9u の枠）: 「札の枠で切れる」
  await show(
    page,
    `<div class="tk-card abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*10);width:calc(var(--u)*18);height:calc(var(--u)*12)">
       <div class="tk-card__fig" style="width:calc(var(--u)*16);height:calc(var(--u)*9);overflow:hidden;margin:calc(var(--u)*1) auto">
         <svg viewBox="0 0 40 170" style="display:block;width:calc(var(--u)*16);height:calc(var(--u)*68)"><rect width="40" height="170" fill="#9cf"/></svg></div></div>`,
  );
  const clip = await figs();
  expect(clip).toHaveLength(1);
  expect(clip[0]!.detail).toBe('絵が札の枠で 59u 切れる'); // 68u − 9u（上は枠の上端から始まるので下だけ）
  // 札の角の正誤の印・番号のバッジは、札の外に半分出ていても絵に数えない
  await show(
    page,
    choice(
      10,
      `${pic(6)}<span class="mark mark--wrong" aria-hidden="true" style="position:absolute;right:calc(var(--u)*-2);top:calc(var(--u)*-2)">${pic(4)}</span>
       <span class="tk-badge" style="position:absolute;left:calc(var(--u)*-2);top:calc(var(--u)*-2)">${pic(4)}</span>`,
    ),
  );
  expect(await figs()).toEqual([]);
});

test('絵・札が小さすぎる（C29）: 数える札の絵が 4u 未満・同じ大きさの正方形が 3 つ以上並ぶ札の 1 つが 2.4u 未満は出す・間をあけた図形は出さない', async ({
  page,
}) => {
  const small = async () =>
    (await inspectText(page, { stage: 'p5' })).issues.filter((i) => i.kind === 'small-figure');
  const pic = (sizeU: number) =>
    `<svg viewBox="0 0 100 100" style="flex:none;width:calc(var(--u)*${sizeU});height:calc(var(--u)*${sizeU})"><rect width="100" height="100" fill="#fc9"/></svg>`;
  const counting = (left: number, n: number, sizeU: number, group = true) =>
    `<div class="choice abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*${left});width:calc(var(--u)*24);height:calc(var(--u)*12);display:flex;align-items:center;justify-content:center">
       <div class="${group ? 'fig-illust__group' : 'icons'}" style="display:flex;gap:calc(var(--u)*0.4)">${pic(sizeU).repeat(n)}</div></div>`;
  // (a) 数える札: 絵が 5 つで 1 つ 2u（p5.en.phrases/92 の くるま 5 ほん）は出す。4.2u なら出さない
  await show(page, counting(10, 5, 2) + counting(40, 5, 4.2));
  const a = await small();
  expect(a).toHaveLength(1);
  expect(a[0]!.detail).toBe('数える絵が 2u（最小 4u・5こ）');
  // 絵が 1 つの札（C29 は数える札だけを見る。登録の絵が 1 つの札は C32）と、.fig-illust__group でない小さな絵（アイコン）は数える札ではない
  await show(page, counting(10, 1, 2) + counting(40, 3, 2, false));
  expect(await small()).toEqual([]);

  // (b) パックの SVG の正方形の列。viewBox 200×100 を 20u×10u に描く（1 単位 ＝ 0.1u）
  const fig = (rects: string) =>
    `<div class="fig-svg abs" role="img" aria-label="てじゅん" style="top:calc(var(--u)*10);left:calc(var(--u)*10)"><svg viewBox="0 0 200 100" style="display:block;width:calc(var(--u)*20);height:calc(var(--u)*10)">${rects}</svg></div>`;
  const sq = (x: number, y: number, s: number) =>
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#cde" stroke="#333"/>`;
  const row3 = (s: number, step: number) => [0, 1, 2].map((i) => sq(10 + i * step, 30, s)).join('');
  // 一辺 2u（20 単位）の札が、すき間 0.5u（辺の 1/4）で 3 つ並ぶ（g6.prog.efficient/9 の手順の札）: 出す
  await show(page, fig(row3(20, 25)));
  const b = await small();
  expect(b).toHaveLength(1);
  expect(b[0]!.detail).toBe('手順の札・盤のますの短い辺が 2u（最小 2.4u・3こ並ぶ）');
  // 3×3 の盤のます（1 ます 2u）: 出す
  await show(
    page,
    fig([0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => sq(10 + c * 20, 10 + r * 20, 20))).join('')),
  );
  expect(await small()).toHaveLength(1);
  // 2.5u（25 単位）なら出さない
  await show(page, fig(row3(25, 30)));
  expect(await small()).toEqual([]);
  // 手順の札は正方形でない角丸の矩形（prog の stripFigure。1.5u×1.8u）: 短い辺で見て出す。2.5u×3u なら出さない
  const card = (x: number, w: number, h: number) =>
    `<rect x="${x}" y="20" width="${w}" height="${h}" rx="3" fill="#fff" stroke="#333"/>`;
  await show(page, fig([0, 1, 2, 3].map((i) => card(10 + i * 18, 15, 18)).join('')));
  const cards = await small();
  expect(cards).toHaveLength(1);
  expect(cards[0]!.detail).toBe('手順の札・盤のますの短い辺が 1.5u（最小 2.4u・4こ並ぶ）');
  await show(page, fig([0, 1, 2].map((i) => card(10 + i * 30, 25, 30)).join('')));
  expect(await small()).toEqual([]);
  // 角のない長方形の分割（分数の帯の等分。g4.math.fraction-kinds の 24 等分の 2.2u）は札でも盤のますでもない
  const strip = (i: number) =>
    `<rect x="${10 + i * 15}" y="20" width="15" height="18" fill="#cde" stroke="#333"/>`;
  await show(page, fig([0, 1, 2, 3].map(strip).join('')));
  expect(await small()).toEqual([]);
  // 横長の絵（p23.math.compare の電車。角丸の 40×24 の 1 両が 4 つ並ぶ。縦横比 1.7 倍）は札・ますではない
  await show(
    page,
    fig(
      [0, 1, 2, 3]
        .map((i) => `<rect x="${4 + i * 46}" y="30" width="40" height="24" rx="5" fill="#9cf"/>`)
        .join(''),
    ),
  );
  expect(await small()).toEqual([]);
  // 細長い帯（縦横比 1.5 倍超。枠・バー）は札・ますではない
  await show(page, fig([0, 1, 2].map((i) => card(10 + i * 62, 60, 20)).join('')));
  expect(await small()).toEqual([]);
  // 辺の半分より離して置いた正方形（p5.think.pattern の 「ちいさい しかく」）・2 つだけ・大きさの違う正方形は数えない
  await show(page, fig(row3(20, 50)));
  expect(await small()).toEqual([]);
  await show(page, fig([sq(10, 30, 20), sq(40, 30, 20)].join('')));
  expect(await small()).toEqual([]);
  await show(page, fig([sq(10, 30, 20), sq(40, 30, 14), sq(65, 30, 26)].join('')));
  expect(await small()).toEqual([]);
});

test('絵が 1 つの札の下限（C32）: 選択肢の札の登録の絵が 6u 未満なら札ごとに 1 件・数える札の列の 1 この札は 4u で見る', async ({
  page,
}) => {
  const small = async () =>
    (await inspectText(page, { stage: 'p5' })).issues.filter((i) => i.kind === 'small-figure');
  // 登録の絵（svg[data-illust]。Illust.tsx）を、本物の選択肢の札と同じ入れ物（.fig-illust__group の中）に 1 つ置く
  const illust = (sizeU: number) =>
    `<svg data-illust="apple" role="img" viewBox="0 0 100 100" style="flex:none;width:calc(var(--u)*${sizeU});height:calc(var(--u)*${sizeU})"><circle cx="50" cy="50" r="46" fill="#f66"/></svg>`;
  const card = (sizeU: number, label: string, n = 1) =>
    `<div class="choice box" aria-label="${label}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:calc(var(--u)*24);height:calc(var(--u)*18);font-size:calc(var(--u)*2.4)">
       <div class="fig-illust"><div class="fig-illust__group" style="display:flex;gap:calc(var(--u)*0.4)">${illust(sizeU).repeat(n)}</div></div><span>${label}</span></div>`;
  const list = (...cards: string[]) =>
    `<div class="eng-opts__list abs" style="top:calc(var(--u)*8);left:calc(var(--u)*4);display:flex;gap:calc(var(--u)*2)">${cards.join('')}</div>`;

  // 聞いて選ぶ問題の解説の絵と語の札（g1.ja.listen/21 の 3.4u）: 札ごとに 1 件。6u 以上の札は出さない
  await show(page, list(card(3.4, 'りんご'), card(6.4, 'みかん'), card(5.5, 'ぶどう')));
  const a = await small();
  expect(a).toHaveLength(2);
  expect(a.map((i) => i.text).sort()).toEqual(['ぶどう', 'りんご']);
  expect(a.find((i) => i.text === 'りんご')!.detail).toBe('絵が 3.4u（最小 6u・1 つの札）');
  expect(a.find((i) => i.text === 'ぶどう')!.detail).toBe('絵が 5.5u（最小 6u・1 つの札）');
  // 幼児（p23・p4・p5）も 6u（10u は並べ方を選ぶときの目標で、検査の下限ではない）。ちょうど 6u と丸めの 1% 以内は出さない
  await show(page, list(card(6, 'りんご'), card(5.95, 'みかん')));
  expect(await small()).toEqual([]);

  // 数える札の列（絵が 2 つ以上の札がある。p5.en.phrases の「1 こ」の札）の絵が 1 つの札は、数える札として 4u で見る
  await show(page, list(card(3.5, '1 こ'), card(4.5, '2 こ', 2), card(4.5, '3 こ', 3)));
  const c = await small();
  expect(c).toHaveLength(1);
  expect(c[0]!.text).toBe('1 こ');
  expect(c[0]!.detail).toBe('絵が 3.5u（最小 4u・数える札の列の 1 つの札）');
  // 4.5u の「1 こ」の札は出さない（数える札の 4u を満たす）
  await show(page, list(card(4.5, '1 こ'), card(4.5, '2 こ', 2), card(4.5, '3 こ', 3)));
  expect(await small()).toEqual([]);
  // 数える札のない列（絵が 1 つの札だけ）の 4.5u は、6u に届かないので出す
  await show(page, list(card(4.5, 'りんご'), card(4.5, 'みかん')));
  const d = await small();
  expect(d).toHaveLength(2);
  expect(d[0]!.detail).toBe('絵が 4.5u（最小 6u・1 つの札）');
});

test('絵が 1 つの札の下限（C32）の対象外: パックの SVG（時計・図形）・アイコン・.choice でない札（tk-card・ボタン）は出さない', async ({
  page,
}) => {
  const small = async () =>
    (await inspectText(page, { stage: 'p5' })).issues.filter((i) => i.kind === 'small-figure');
  const registered = (sizeU: number, cls = '') =>
    `<svg data-illust="apple" class="${cls}" role="img" viewBox="0 0 100 100" style="flex:none;width:calc(var(--u)*${sizeU});height:calc(var(--u)*${sizeU})"><circle cx="50" cy="50" r="46" fill="#f66"/></svg>`;
  const box = (cls: string, inner: string, left: number, tag = 'div') =>
    `<${tag} class="${cls} abs box" style="top:calc(var(--u)*8);left:calc(var(--u)*${left});display:flex;align-items:center;justify-content:center;width:calc(var(--u)*16);height:calc(var(--u)*14)">${inner}</${tag}>`;
  // パックの SVG の図（時計。.fig-svg の svg。data-illust がない）の 3u は絵の札ではない
  await show(
    page,
    box(
      'choice',
      `<div class="fig-svg"><svg viewBox="0 0 100 100" style="display:block;width:calc(var(--u)*3);height:calc(var(--u)*3)"><circle cx="50" cy="50" r="46" fill="none" stroke="#333" stroke-width="6"/><path d="M50 50V20M50 50L72 60" stroke="#333" stroke-width="6"/></svg></div>`,
      4,
    ),
  );
  expect(await small()).toEqual([]);
  // 札の中の飾りのアイコン（.tap__icon）は、登録の絵でも出さない。.choice でないボタンの中のアイコン・単元の札（.tk-card）の
  // 小さな絵も出さない（この回は .choice だけ。.tk-card は札の設計の大きさで決まり、次の回に決める）
  await show(
    page,
    box('choice', `${registered(3, 'tap__icon')}<span>きく</span>`, 4) +
      box('tap', `${registered(3, 'tap__icon')}<span>きく</span>`, 24, 'button') +
      box('tk-card', `${registered(3)}`, 44),
  );
  expect(await small()).toEqual([]);
});

test('並んだ札のすき間（C30）: 横軸の札・数直線の印のラベルの隣どうしが字の 0.25 倍未満なら出す・離れていれば出さない・文の中の span は出さない', async ({
  page,
}) => {
  const gaps = async () =>
    (await inspectText(page, { stage: 'g4' })).issues.filter((i) => i.kind === 'label-gap');
  const labels = (cls: string, style: string, items: string[], spanStyle = (_i: number) => '') =>
    `<div class="${cls} abs" style="top:calc(var(--u)*10);left:calc(var(--u)*10);display:flex;font-size:calc(var(--u)*2.2);${style}">${items
      .map((t, i) => `<span style="${spanStyle(i)}">${t}</span>`)
      .join('')}</div>`;
  const hours = ['9時', '10時', '11時', '12時'];
  // 札のすき間が 0（g4.sci.weather/9 の「9時10時11時12時」）: 列ごとに 1 件
  await show(page, labels('fig-chart__labels', '', hours));
  const tight = await gaps();
  expect(tight).toHaveLength(1);
  expect(tight[0]!.text).toBe('9時｜10時｜11時｜12時');
  expect(tight[0]!.detail).toMatch(/すき間が字の -?\d+(\.\d+)? 倍（最小 0\.25 倍）/);
  // graph の横軸の札・数直線の印のラベルも見る
  await show(page, labels('gr-xlabels', '', hours));
  expect(await gaps()).toHaveLength(1);
  await show(page, labels('fig-nl__labels', '', hours));
  expect(await gaps()).toHaveLength(1);
  // 字の 0.25 倍以上あいていれば出さない（0.5em）
  await show(page, labels('fig-chart__labels', 'gap:calc(var(--u)*1.1)', hours));
  expect(await gaps()).toEqual([]);
  // 1 つおきに下へずらした段（data-stagger）: 隣どうしは別の行。同じ行の札は離れているので出さない
  await show(
    page,
    labels('fig-chart__labels', 'align-items:flex-start', hours, (i) =>
      i % 2 ? 'margin-top:calc(var(--u)*3)' : '',
    ),
  );
  expect(await gaps()).toEqual([]);
  // 札の列でない文の中の span（Rt の ruby・nobr の包みのように、すき間 0 で並ぶのが正しい）は対象にしない
  await show(page, labels('', '', hours));
  expect(await gaps()).toEqual([]);
});

test('SVG の text の重なり（C31）: 字の高さに詰めた箱で比べる・枠で切れた箱で閾値を下げない・本当に重なる字は出す', async ({
  page,
}) => {
  const overlaps = async () =>
    (await inspectText(page, { stage: 'g5' })).issues.filter((i) => i.kind === 'overlap-text');
  // 縦軸の数「10」「15」を字（24px）の 1.1 倍だけ離して並べる。外接の箱（約 1.47em）は 0.37em 重なるが、字の本体は重ならない。
  // 下の「15」は本文の枠（overflow: hidden）で半分切れている（g5.ja.text-figure/8 のヒント①・1920×1080）
  const build = async (pitch: number, clip: boolean) => {
    await show(
      page,
      `<div id="clip" class="abs" style="top:calc(var(--u)*5);left:calc(var(--u)*5);width:calc(var(--u)*20);${clip ? 'overflow:hidden;' : ''}">
         <svg width="300" height="200" viewBox="0 0 300 200" style="display:block;overflow:visible">
           <text x="20" y="40" font-size="24">10</text><text x="20" y="${40 + pitch}" font-size="24">15</text></svg></div>`,
    );
    if (clip)
      // 枠の下端を「15」の外接の箱の上から 40% の所にする（切れた箱が低くなり、旧い閾値は 0.3 × その高さに下がる）
      await page.evaluate(() => {
        const box = document.getElementById('clip') as HTMLElement;
        const t = box.querySelectorAll('text')[1]!.getBoundingClientRect();
        box.style.height = `${t.top + t.height * 0.4 - box.getBoundingClientRect().top}px`;
      });
  };
  // 字の 1.1 倍（26.4px）離れた 2 つ: 出さない（枠で切れていても）
  await build(26.4, false);
  expect(await overlaps()).toEqual([]);
  await build(26.4, true);
  expect(await overlaps()).toEqual([]);
  // 字の 0.5 倍（12px）しか離れていない 2 つ: 本当に重なっているので出す（枠が無くても、切れていても）
  await build(12, false);
  expect(await overlaps()).toHaveLength(1);
  await build(12, true);
  expect((await overlaps()).length).toBeGreaterThanOrEqual(1);
});
