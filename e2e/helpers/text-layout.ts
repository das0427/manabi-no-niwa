/**
 * 文字の配置の検査（文字の重なり・変な改行・はみ出し）。違反は失敗にせず一覧にして返す。
 * 子供画面の舞台（.stage、100u × 56.25u）の中を、ページの中で調べる（page.evaluate）。
 * 使い方は e2e/text-layout.tl.ts（全単元を巡る）と e2e/text-layout-probe.tl.ts（検査自体の確認）。
 *
 * 見るもの（kind）:
 *   はみ出し
 *   - page-scroll      … 文書に横・縦スクロールが出る
 *   - out-of-stage     … 文字・ボタン・図が舞台（または画面）の外に出る
 *   - clipped          … 親の overflow: hidden / clip で文字・ボタン・図が切れる（隠れた文字）
 *   - scroll-hidden    … 親の overflow: auto / scroll の枠の中で、スクロールしないと見えない文字・ボタン
 *   - text-outside-box … 文字が、線や背景のある枠（札・吹き出し・ボタン）の外に出る（overflow: visible）
 *   - figure-outside-box … 札（ボタン・.tk-card・.choice）の中の絵（外の svg・img・.fig-illust__group の子）が、札の外に
 *                         出る・札の中の overflow の枠で切れる（C28。札ごとに 1 件。字の検査では見えない）
 *   重なり
 *   - overlap-text     … 文字どうしが重なる（ふりがなが前の行や隣のふりがなに重なる場合を含む）
 *   - covered          … 文字・ボタンの上に、別の要素（ボタン・枠・図）がかぶさって隠れる
 *   - text-on-figure   … 文字の下に図（SVG の線・面、画像）がある（意図した重ねもあるため参考）
 *   - overlap-button   … ボタンどうしが重なる
 *   - ruby-overlap     … ふりがなが自分の親字に重なる
 *   - label-gap        … 横軸の札の列・数直線の印のラベルで、同じ行の隣どうしの字のすき間が字の 0.25 倍未満
 *                         （重ならなくても札がつながって読める。C30。文の中の span は対象外）
 *   変な改行（自動の折り返しだけ。\n・<br>・ブロックの区切りによる改行は見ない）
 *   - kinsoku-start    … 行頭禁則の字（、。」）！？ ゃゅょっー〜・ 等）で始まる行
 *   - kinsoku-end      … 行末禁則の字（「『（ 等）で終わる行
 *   - orphan           … 2行以上の文で、最後の行が1文字だけ
 *   - wakachi-split    … 分かち書き（幼児・小1・小2）の語の途中で改行
 *   - word-split       … 英単語・数・数と単位（3 cm・12:30・100円）・ふりがな付きの語の途中で改行
 *   - button-split     … 選択肢・ボタンの中で語が途中で折れる
 *   - narrow-wrap      … 1行1〜2文字で縦に並ぶような極端に狭い折り返し
 *   文字の大きさ
 *   - small-text       … DESINGN.md 17章の最小（補助の文字・ふりがな 1.1u）より小さい
 *   - small-figure     … 絵・札が小さすぎる（C29）。(a) 数える札（1 つの札に .fig-illust__group の絵が 2 つ以上）の絵が 4u 未満
 *                         (b) パックの SVG の同じ大きさの正方形か角丸の札（縦横比 1.5 倍以内）が 3 つ以上並ぶ（手順の札・盤のます）
 *                         短い辺が 2.4u 未満
 *                         (c) 選択肢の札（.choice）の中の絵が 1 つで登録の絵（svg[data-illust]）のとき、短い辺が 6u 未満
 *                         （同じ列に数える札があれば、その列の 1 この札は 4u。C32）
 *   記法の漏れ
 *   - markup-leak      … 画面に《》・{{・}} の記法（ふりがな・差し込みの書き方）がそのまま出ている
 */
import type { Page } from '@playwright/test';

export const TEXT_ISSUE_KINDS = [
  'page-scroll',
  'out-of-stage',
  'clipped',
  'scroll-hidden',
  'text-outside-box',
  'figure-outside-box',
  'overlap-text',
  'covered',
  'text-on-figure',
  'overlap-button',
  'ruby-overlap',
  'label-gap',
  'kinsoku-start',
  'kinsoku-end',
  'orphan',
  'wakachi-split',
  'word-split',
  'button-split',
  'narrow-wrap',
  'small-text',
  'small-figure',
  'markup-leak',
] as const;
export type TextIssueKind = (typeof TEXT_ISSUE_KINDS)[number];

/** 種類の日本語の名前（要約に使う） */
export const TEXT_ISSUE_LABEL: Record<TextIssueKind, string> = {
  'page-scroll': '画面のスクロール',
  'out-of-stage': '舞台の外にはみ出し',
  clipped: '親の枠で切れる',
  'scroll-hidden': 'スクロールしないと見えない',
  'text-outside-box': '文字が枠の外に出る',
  'figure-outside-box': '絵が札の外に出る・札で切れる',
  'overlap-text': '文字どうしの重なり',
  covered: '文字・ボタンが隠れる',
  'text-on-figure': '文字が図に重なる（参考）',
  'overlap-button': 'ボタンどうしの重なり',
  'ruby-overlap': 'ふりがなが親字に重なる',
  'label-gap': '札がつながって見える',
  'kinsoku-start': '行頭禁則',
  'kinsoku-end': '行末禁則',
  orphan: '最後の行が1文字',
  'wakachi-split': '分かち書きの語の途中で改行',
  'word-split': '語・数・単位の途中で改行',
  'button-split': 'ボタン・選択肢の中で語が折れる',
  'narrow-wrap': '極端に狭い折り返し',
  'small-text': '文字が小さすぎる',
  'small-figure': '絵・札が小さすぎる',
  'markup-leak': '《》・{{ }} の記法がそのまま出る',
};

export interface TextIssue {
  kind: TextIssueKind;
  /** 該当の文字列（改行の検査では「前の行の終わり／次の行の始め」） */
  text: string;
  /** 要素の説明（tag[data-testid].class） */
  where: string;
  /** 目印を付ける位置（viewport の px。x, y, w, h） */
  rect: [number, number, number, number];
  detail?: string;
}

export interface TextProbeOptions {
  /** 単元の段階（p23 / p4 / p5 / g1〜g6）。分かち書きと文字の最小の大きさを決める */
  stage: string;
  /** 教材（pack。unit-index の pack）。分かち書きの教材（C22）の判定に使う。画面の data-wakachi は見ない */
  pack?: string;
  /** 1画面で1種類あたり返す件数の上限 */
  maxPerKind?: number;
  /**
   * 調べる範囲の CSS セレクタ（アプリの画面の検査 e2e/app-layout.al.ts が使う。省略時は今までどおり `.stage`、無ければ body）。
   * 板（aria-modal・.draw-panel・.draw-confirm）が出ているときは、その板を渡して中だけを見る
   * （後ろの画面は板で隠すのが設計なので、covered・overlap-button に数えない）。
   * 舞台の外の判定の範囲は、root が舞台の中なら舞台、外（保護者画面など）なら画面
   */
  root?: string;
  /**
   * 大人の文字の範囲の CSS セレクタ（保護者画面・ゲートの板・起動画面の保護者向けの表示）。
   * この中と、「（保護者の方へ）」で始まる文は、最小の大きさを px（minAdultPx）で見る。
   * 分かち書き（wakachi-split）とボタンの中の語の折れ（button-split）は見ない（大人の文は漢字かな交じりで書くため）。
   * 行頭・行末の禁則、数と単位の折れ（word-split）、重なり、切れは見る
   */
  adultSel?: string;
  /** 大人の文字の最小（px）。既定 12 */
  minAdultPx?: number;
  /**
   * 画面全体のスクロールの枠の CSS セレクタ（保護者画面の `.parent-root`）。
   * この枠の縦のはみ出し（画面の下にあって見えない字・ボタン）は検査の対象外にする。
   * 呼び出し側が scrollTop をずらして、そのたびに検査する。横にスクロールが出るときは page-scroll にする
   */
  pageScroll?: string;
}

export interface TextProbeResult {
  u: number;
  viewport: [number, number];
  /** 調べた文字の数（空白を除く） */
  chars: number;
  issues: TextIssue[];
}

/** ページの中で検査する */
export function inspectText(page: Page, opt: TextProbeOptions): Promise<TextProbeResult> {
  return page.evaluate(textLayoutProbe, opt);
}

/** 違反の位置に赤い枠を付けて撮る（枠は撮ったあと消す） */
export async function screenshotWithMarks(
  page: Page,
  rects: [number, number, number, number][],
  file: string,
): Promise<void> {
  await page.evaluate((rs) => {
    for (const [x, y, w, h] of rs) {
      const d = document.createElement('div');
      d.className = 'mnw-tl-mark';
      d.style.cssText = `position:fixed;left:${x - 3}px;top:${y - 3}px;width:${w + 6}px;height:${h + 6}px;outline:3px solid #e00000;outline-offset:0;pointer-events:none;z-index:2147483647;`;
      document.body.appendChild(d);
    }
  }, rects);
  try {
    await page.screenshot({ path: file });
  } finally {
    await page.evaluate(() => document.querySelectorAll('.mnw-tl-mark').forEach((e) => e.remove()));
  }
}

/**
 * 検査の本体（page.evaluate で文字列にして送るため、外の名前を使わない）。
 * e2e/text-layout-probe.tl.ts で、壊した見本を検出すること・普通の画面で誤検出しないことを確かめる。
 */
export function textLayoutProbe(opt: TextProbeOptions): TextProbeResult {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const u = Math.min(W / 100, (H * 1.7778) / 100);
  const maxPerKind = opt.maxPerKind ?? 20;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // ---- 規則の表
  /** 行頭に来てはいけない字（JIS X 4051 の行頭禁則＋小書きの仮名・長音・中黒） */
  const START_NG = new Set(
    Array.from(
      '、。，．,.：；:;!?！？）)」』】］〕〉》”’ゝゞ々ーぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ〜～・…‥',
    ),
  );
  /** 行末に来てはいけない字（始め括弧） */
  const END_NG = new Set(Array.from('「『（(【［〔〈《“‘'));
  /** 分かち書きで、空白が無くても後ろで改行してよい字（句読点・閉じ括弧） */
  const BREAK_OK_AFTER = new Set(Array.from('、。，．！？!?」』）)…:：'));
  /** 数字のあとに来る助詞。数との境目の改行は組版として正しい（C14） */
  const NUM_PARTICLES = new Set(Array.from('はがをにでとのもやへか'));
  /** 仮名で書いた助数詞の頭（に＋ん=人・に＋ち=日・と＋う=頭・は＋い=杯・か＋い=回・か＋げつ=か月・か＋しょ／所=か所・
   * か＋国=か国）。助詞でなく助数詞なので、数との間の改行は数える */
  const KANA_COUNTER_NEXT: Record<string, Set<string>> = {
    に: new Set(['ん', 'ち']),
    と: new Set(['う']),
    は: new Set(['い']),
    か: new Set(['い', 'げ', 'し', '所', '国']),
  };
  /** 複合辞（Intl.Segmenter が1語として返す）。頭の助詞の直後は、助詞と動詞の境目で改行してよい（C17） */
  const COMPOUND_PARTICLES = new Set([
    'という',
    'といった',
    'として',
    'について',
    'にとって',
    'によって',
    'にして',
    'にたいして',
    'をして',
    'とする',
    'とした',
    'とともに',
    'のように',
  ]);
  const preschool = /^p/.test(opt.stage);
  // 分かち書きで書く段階（p23〜g2）と、小3以上でも分かち書きで書く教材（英語 en-g34・en-g56。C22）。
  // 画面の data-wakachi には頼らない（画面が分かち書きにしていない不具合を隠さないため）
  const wakachi = /^(p23|p4|p5|g1|g2)$/.test(opt.stage) || /^en-g(34|56)$/.test(opt.pack ?? '');
  /** 補助の文字の最小（DESINGN.md 17章）。ふりがなは 1.1u */
  const MIN_TEXT_U = preschool
    ? 2.2
    : /^g[12]$/.test(opt.stage)
      ? 2.0
      : /^g[34]$/.test(opt.stage)
        ? 1.8
        : 1.7;
  const MIN_RUBY_U = 1.1;

  const stageEl = document.querySelector('.stage');
  // 調べる範囲（opt.root。省略時と見つからないときは今までどおり .stage、無ければ body）
  const rootEl = opt.root ? document.querySelector(opt.root) : null;
  const root: Element = rootEl ?? stageEl ?? document.body;
  // 舞台の外の判定の範囲: root が舞台の中なら舞台、外（保護者画面など）なら画面
  const inStage = !!stageEl && stageEl.contains(root);
  const sr = inStage && stageEl ? stageEl.getBoundingClientRect() : new DOMRect(0, 0, W, H);
  // 画面全体のスクロールの枠（保護者画面）。縦に画面の外にある字・ボタンは、その位置では検査しない
  const pageScrollEl = opt.pageScroll ? document.querySelector(opt.pageScroll) : null;
  const inPageScroll = (el: Element) => !!pageScrollEl && pageScrollEl.contains(el);
  const minAdultPx = opt.minAdultPx ?? 12;
  const B = {
    l: Math.max(0, sr.left),
    t: Math.max(0, sr.top),
    r: Math.min(W, sr.right),
    b: Math.min(H, sr.bottom),
  };

  // 当たり判定（elementsFromPoint）で描く順を調べるため、検査の間だけ pointer-events を全部有効にする
  // （pointer-events: none の文字の札が、下のボタンに隠れていると誤って判定しないように）
  const peStyle = document.createElement('style');
  peStyle.textContent =
    opt.root && !inStage
      ? `.stage, .stage *, ${opt.root}, ${opt.root} * { pointer-events: auto !important; }`
      : '.stage, .stage * { pointer-events: auto !important; }';
  document.head.appendChild(peStyle);
  /** 元の pointer-events（検査用に全部 auto にする前の値）。覆うものが pointer-events: none の飾りかを見る */
  const originalPointerEvents = (el: Element): string => {
    peStyle.disabled = true;
    try {
      return getComputedStyle(el).pointerEvents;
    } finally {
      peStyle.disabled = false;
    }
  };
  try {
    return probeBody();
  } finally {
    peStyle.remove();
  }

  function probeBody(): TextProbeResult {
    const issues: TextIssue[] = [];
    const perKind = new Map<string, number>();
    const seen = new Set<string>();
    const add = (
      kind: TextIssueKind,
      text: string,
      where: string,
      rect: { left: number; top: number; right: number; bottom: number },
      detail?: string,
    ) => {
      const key = `${kind}|${text}|${where}`;
      if (seen.has(key)) return;
      seen.add(key);
      const n = perKind.get(kind) ?? 0;
      if (n >= maxPerKind) return;
      perKind.set(kind, n + 1);
      issues.push({
        kind,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 80),
        where,
        rect: [
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.right - rect.left),
          Math.round(rect.bottom - rect.top),
        ],
        ...(detail ? { detail } : {}),
      });
    };

    // ---- 補助
    const csCache = new Map<Element, CSSStyleDeclaration>();
    const cs = (el: Element) => {
      let s = csCache.get(el);
      if (!s) {
        s = getComputedStyle(el);
        csCache.set(el, s);
      }
      return s;
    };
    const describe = (el: Element): string => {
      const id = el.getAttribute('data-testid');
      const cls =
        typeof (el as HTMLElement).className === 'string'
          ? (el as HTMLElement).className
              .split(/\s+/)
              .filter((c) => c && c !== 'mnw-tl-mark')
              .slice(0, 2)
              .join('.')
          : '';
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`;
    };
    const textOf = (el: Element) => {
      // ふりがな（rt）は除いた文字（親字だけ）
      let s = '';
      const walk = (n: Node) => {
        if (n.nodeType === 3) s += n.textContent ?? '';
        else if (
          n.nodeType === 1 &&
          (n as Element).tagName !== 'RT' &&
          (n as Element).tagName !== 'RP'
        )
          n.childNodes.forEach(walk);
      };
      walk(el);
      return s.replace(/\s+/g, ' ').trim().slice(0, 60);
    };
    const shown = (el: Element): boolean => {
      const e = el as Element & {
        checkVisibility?: (o: Record<string, boolean>) => boolean;
      };
      if (e.checkVisibility)
        return e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      const s = cs(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
    };
    /** 透明な色か */
    const clear = (c: string) =>
      c === 'transparent' || /rgba\([^)]*,\s*0(\.0+)?\)$/.test(c) || /\/\s*0\)$/.test(c);
    /** 線か背景が見える「枠」か */
    const framed = (el: Element): boolean => {
      const s = cs(el);
      if (!clear(s.backgroundColor) || s.backgroundImage !== 'none') return true;
      const bw = ['Top', 'Right', 'Bottom', 'Left'].some(
        (side) =>
          parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
          s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none' &&
          !clear(s.getPropertyValue(`border-${side.toLowerCase()}-color`)),
      );
      return bw;
    };
    /** 要素がその点で何かを描くか（重なりの判定。透明な当たり判定の札などは描かない） */
    const paints = (el: Element, x?: number, y?: number): boolean => {
      if (el.classList.contains('mnw-tl-mark')) return false;
      if (Number(cs(el).opacity) < 0.05) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'canvas' || tag === 'video') return true;
      // SVG の図形（点が図形の上にあるときだけ elementsFromPoint に出る）
      if (el instanceof SVGElement && tag !== 'svg' && tag !== 'g' && tag !== 'foreignobject')
        return true;
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
      if (hasText) return true;
      if (!framed(el)) return false;
      // 線だけの枠（中が透明。正解の○の輪など）は、点が線の上にあるときだけ描く
      const s = cs(el);
      if (
        x !== undefined &&
        y !== undefined &&
        clear(s.backgroundColor) &&
        s.backgroundImage === 'none'
      ) {
        const r = el.getBoundingClientRect();
        const bw = parseFloat(s.borderTopWidth) || 0;
        const round = parseFloat(s.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 1;
        if (round) {
          const rx = r.width / 2;
          const ry = r.height / 2;
          const d = Math.hypot((x - r.left - rx) / rx, (y - r.top - ry) / ry);
          return d <= 1 && d >= 1 - bw / Math.min(rx, ry);
        }
        return x - r.left <= bw || r.right - x <= bw || y - r.top <= bw || r.bottom - y <= bw;
      }
      return true;
    };
    /**
     * 大人の文字か（opt.adultSel の中、または「（保護者の方へ）」で始まる文）。大人の文字は、最小の大きさを px で見て、
     * 分かち書き・ボタンの中の語の折れは見ない（子供の規則を大人の文に当てた誤検出になるため）
     */
    const ADULT_MARK = '（保護者の方へ）';
    const adultCache = new Map<Element, boolean>();
    const markCache = new Map<Element, boolean>();
    const isAdult = (el: Element): boolean => {
      const hit = adultCache.get(el);
      if (hit !== undefined) return hit;
      let v = !!opt.adultSel && !!el.closest(opt.adultSel);
      if (!v) {
        const blk = el.closest('p, li, h1, h2, h3, div');
        if (blk) {
          let m = markCache.get(blk);
          if (m === undefined) {
            m = (blk.textContent ?? '').trimStart().startsWith(ADULT_MARK);
            markCache.set(blk, m);
          }
          v = m;
        }
      }
      adultCache.set(el, v);
      return v;
    };
    const INLINE = new Set([
      'inline',
      'ruby',
      'ruby-base',
      'ruby-text',
      'ruby-base-container',
      'ruby-text-container',
      'contents',
    ]);
    const isInline = (el: Element) => INLINE.has(cs(el).display) || el.tagName === 'RT';
    const BTN_SEL = 'button, [role="button"], [role="option"], [role="radio"], [role="checkbox"]';

    // ---- (1) 画面のスクロール
    const de = document.documentElement;
    if (
      de.scrollWidth > de.clientWidth + 1 ||
      de.scrollHeight > de.clientHeight + 1 ||
      document.body.scrollWidth > document.body.clientWidth + 1
    ) {
      add(
        'page-scroll',
        `scroll ${de.scrollWidth}×${de.scrollHeight} / client ${de.clientWidth}×${de.clientHeight}`,
        'document',
        { left: 0, top: 0, right: W, bottom: H },
      );
    }

    if (pageScrollEl && pageScrollEl.scrollWidth > pageScrollEl.clientWidth + 1) {
      add(
        'page-scroll',
        `横にスクロール scroll ${pageScrollEl.scrollWidth} / client ${pageScrollEl.clientWidth}`,
        describe(pageScrollEl),
        pageScrollEl.getBoundingClientRect(),
      );
    }

    // ---- (2) 文字を集める（1字ずつの位置）
    interface Ch {
      ch: string;
      node: Text;
      /** 字の外接（Range）。縦は em の高さに詰めた値（行間の分を含めない） */
      l: number;
      t: number;
      r: number;
      b: number;
      rt: boolean;
      ruby: Element | null;
    }
    const range = document.createRange();
    const charsOfNode = new Map<Text, (Ch | null)[]>();
    const textNodes: Text[] = [];
    {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest('script, style, noscript, .visually-hidden, .mnw-tl-mark'))
            return NodeFilter.FILTER_REJECT;
          if (!(n.textContent ?? '').trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const p = (n as Text).parentElement!;
        if (!shown(p)) continue;
        textNodes.push(n as Text);
      }
    }
    let charCount = 0;
    const charsOf = (node: Text): (Ch | null)[] => {
      const hit = charsOfNode.get(node);
      if (hit) return hit;
      const out: (Ch | null)[] = [];
      const p = node.parentElement!;
      const fs = parseFloat(cs(p).fontSize) || 16;
      const isRt = !!p.closest('rt');
      const ruby = p.closest('ruby');
      const s = node.data;
      let i = 0;
      for (const ch of s) {
        const len = ch.length;
        if (/\s/.test(ch)) {
          out.push(null);
          i += len;
          continue;
        }
        range.setStart(node, i);
        range.setEnd(node, i + len);
        const rs = range.getClientRects();
        let best: DOMRect | null = null;
        for (const r of Array.from(rs)) if (!best || r.width > best.width) best = r;
        if (best && best.width > 0 && best.height > 0) {
          const cy = (best.top + best.bottom) / 2;
          const h = Math.min(best.height, fs);
          let cl = best.left;
          let cr = best.right;
          // Chrome は rt が親字より長いとき、親字の Range の外接を rt の幅まで広げる。字形は ruby の箱の中にあり、
          // rt が隣の仮名の上に張り出すのは JIS X 4051 で許される組み方なので、親字は ruby の箱に詰める
          if (!isRt && ruby) {
            let rr: DOMRect | null = null;
            for (const q of Array.from(ruby.getClientRects()))
              if (cy >= q.top - 1 && cy <= q.bottom + 1 && (!rr || q.width > rr.width)) rr = q;
            if (rr && rr.width > 0) {
              cl = Math.max(cl, rr.left);
              cr = Math.min(cr, rr.right);
            }
          }
          out.push({
            ch,
            node,
            l: cl,
            r: cr,
            t: cy - h / 2,
            b: cy + h / 2,
            rt: isRt,
            ruby: isRt ? p.closest('ruby') : ruby,
          });
          charCount++;
        } else out.push(null);
        i += len;
      }
      charsOfNode.set(node, out);
      return out;
    };

    // ---- (3) 字の行ごとの箱（テキストノード単位）
    interface LineBox {
      l: number;
      t: number;
      r: number;
      b: number;
      node: Text | null;
      el: Element;
      rt: boolean;
      ruby: Element | null;
      text: string;
      svg: boolean;
      /**
       * SVG の text だけ（C31）: 上下を字の大きさ（font-size × 図の拡大率）の高さに詰めた箱。外接の箱（ascent＋descent、
       * 約 1.47em）は字の上下の余白を含むので、縦軸の数のように字の 1.1 倍だけ離して並べた字が「重なる」と出ていた。
       * 重なりの判定（(6)）の SVG の text どうしだけが使う。切れ・はみ出し（(5)）は外接の箱のまま
       */
      core?: { t: number; b: number };
    }
    const boxes: LineBox[] = [];
    for (const node of textNodes) {
      // 図の中の文字（svg の text）は下で要素の外接で扱う
      if (node.parentElement!.closest('svg')) continue;
      const cs0 = charsOf(node).filter((c): c is Ch => c !== null);
      let cur: LineBox | null = null;
      for (const c of cs0) {
        const cy = (c.t + c.b) / 2;
        if (cur && cy > cur.t && cy < cur.b && c.l >= cur.l - 1) {
          cur.r = Math.max(cur.r, c.r);
          cur.l = Math.min(cur.l, c.l);
          cur.t = Math.min(cur.t, c.t);
          cur.b = Math.max(cur.b, c.b);
          cur.text += c.ch;
        } else {
          cur = {
            l: c.l,
            t: c.t,
            r: c.r,
            b: c.b,
            node,
            el: node.parentElement!,
            rt: c.rt,
            ruby: c.ruby,
            text: c.ch,
            svg: false,
          };
          boxes.push(cur);
        }
      }
    }
    // ---- (3b) 大きさが 0 の図（C15）: 子（図形・字・絵）があるのに幅か高さが 1px 未満で、見えない。
    // 解説の図（width の無いパックの SVG）が 0×0 になる不具合が、字の無い図では何も出ず、字のある図では
    // 「text ⊂ svg」「small-text」という原因の分からない形で出ていた。図ごとに1件にまとめ、中の text は1字ずつ数えない。
    // 除く: display:none・visibility:hidden・opacity 0（shown）、aria-hidden の祖先、.sr-only・.visually-hidden、
    // display:contents（箱が無い）、defs・symbol だけの svg（グラデーションなどの置き場）
    const zeroFigs: Element[] = [];
    {
      const NON_DRAWN = 'defs, symbol, clipPath, mask, pattern, marker, style, title, desc';
      const drawn = (el: Element): boolean => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'img') {
          const im = el as HTMLImageElement;
          return im.complete && im.naturalWidth > 0;
        }
        if (el instanceof SVGElement) {
          return Array.from(
            el.querySelectorAll(
              'text, path, rect, circle, ellipse, line, polyline, polygon, image, use, foreignObject',
            ),
          ).some((c) => !c.closest(NON_DRAWN));
        }
        return el.childElementCount > 0 || (el.textContent ?? '').trim().length > 0;
      };
      for (const el of Array.from(root.querySelectorAll('svg, img, .fig-svg, .fig-illust'))) {
        if (el.parentElement?.closest('svg')) continue; // 入れ子の svg は外側で見る
        if (zeroFigs.some((z) => z.contains(el))) continue; // 外側の枠が 0 なら、中は数えない
        if (!shown(el)) continue;
        if (el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, .mnw-tl-mark')) continue;
        if (cs(el).display === 'contents') continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 1 && r.height >= 1) continue;
        if (!drawn(el)) continue;
        zeroFigs.push(el);
        add(
          'clipped',
          el.getAttribute('aria-label') ?? textOf(el),
          describe(el),
          r,
          '図の大きさが 0（見えない）',
        );
      }
    }
    // SVG の <text>（図の文字）: 要素の外接で扱う
    for (const t of Array.from(root.querySelectorAll('svg text'))) {
      if (!shown(t) || !(t.textContent ?? '').trim()) continue;
      if (zeroFigs.some((z) => z.contains(t))) continue; // 大きさが 0 の図の中の字は、図の1件にまとめた
      const r = t.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // C31: 字の大きさの高さに詰めた箱（外接の箱の縦の中央に置く。HTML の字の Range と同じ詰め方）
      let fsPx = parseFloat(cs(t).fontSize) || 0;
      const ctm = (t as unknown as SVGGraphicsElement).getScreenCTM?.();
      if (ctm) fsPx *= Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c));
      const coreH = fsPx > 0 ? Math.min(r.height, fsPx) : r.height;
      const mid = (r.top + r.bottom) / 2;
      boxes.push({
        l: r.left,
        t: r.top,
        r: r.right,
        b: r.bottom,
        node: null,
        el: t,
        rt: false,
        ruby: null,
        text: (t.textContent ?? '').trim(),
        svg: true,
        core: { t: mid - coreH / 2, b: mid + coreH / 2 },
      });
    }

    // ---- (4) ボタン・図
    const buttons: { el: Element; r: DOMRect }[] = [];
    for (const el of Array.from(root.querySelectorAll(BTN_SEL))) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      buttons.push({ el, r });
    }
    const figures: { el: Element; r: DOMRect }[] = [];
    for (const el of Array.from(root.querySelectorAll('svg, img, canvas'))) {
      if (el.parentElement?.closest('svg')) continue; // 入れ子の svg は外側で見る
      if (el.closest(BTN_SEL)) continue; // ボタンの中の絵はボタンとして見る
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      figures.push({ el, r });
    }

    /** 要素の内側（スクロールの枠・切り取りの範囲。線の内側） */
    const clientBox = (a: Element) => {
      const ar = a.getBoundingClientRect();
      const he = a as HTMLElement;
      const l = ar.left + (he.clientLeft || 0);
      const t = ar.top + (he.clientTop || 0);
      return {
        l,
        t,
        r: l + (he.clientWidth || ar.width),
        b: t + (he.clientHeight || ar.height),
      };
    };
    /** 要素の見えている範囲（舞台と、overflow が visible でない祖先の内側の重なり）。重なりの判定に使う */
    const visCache = new Map<Element, { l: number; t: number; r: number; b: number }>();
    const visClip = (el: Element) => {
      const hit = visCache.get(el);
      if (hit) return hit;
      const v = { l: B.l, t: B.t, r: B.r, b: B.b };
      for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
        const s = cs(a);
        const oy = a === pageScrollEl ? 'visible' : s.overflowY;
        if (s.overflowX === 'visible' && oy === 'visible') continue;
        const c = clientBox(a);
        if (s.overflowX !== 'visible') {
          v.l = Math.max(v.l, c.l);
          v.r = Math.min(v.r, c.r);
        }
        if (oy !== 'visible') {
          v.t = Math.max(v.t, c.t);
          v.b = Math.min(v.b, c.b);
        }
      }
      visCache.set(el, v);
      return v;
    };
    /** 舞台と、overflow が visible でない祖先の padding box（小数のまま）の重なり。当たり判定の点を切るのに使う */
    const paddingClip = (el: Element) => {
      const v = { l: B.l, t: B.t, r: B.r, b: B.b };
      for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
        const s = cs(a);
        const oy = a === pageScrollEl ? 'visible' : s.overflowY;
        if (s.overflowX === 'visible' && oy === 'visible') continue;
        const ar = a.getBoundingClientRect();
        const he = a as HTMLElement;
        const bl = parseFloat(s.borderLeftWidth) || 0;
        const br = parseFloat(s.borderRightWidth) || 0;
        const bt = parseFloat(s.borderTopWidth) || 0;
        const bb = parseFloat(s.borderBottomWidth) || 0;
        // 縦・横のスクロールバーの分（offset − client − 線）
        const sbX = Math.max(0, he.offsetWidth - he.clientWidth - bl - br);
        const sbY = Math.max(0, he.offsetHeight - he.clientHeight - bt - bb);
        if (s.overflowX !== 'visible') {
          v.l = Math.max(v.l, ar.left + bl);
          v.r = Math.min(v.r, ar.right - br - sbX);
        }
        if (oy !== 'visible') {
          v.t = Math.max(v.t, ar.top + bt);
          v.b = Math.min(v.b, ar.bottom - bb - sbY);
        }
      }
      return v;
    };
    /** 見えている部分だけに切った箱（見えなければ null） */
    const visible = (el: Element, r: { l: number; t: number; r: number; b: number }) => {
      const v = visClip(el);
      const o = {
        l: Math.max(r.l, v.l),
        t: Math.max(r.t, v.t),
        r: Math.min(r.r, v.r),
        b: Math.min(r.b, v.b),
      };
      return o.r - o.l > 1 && o.b - o.t > 1 ? o : null;
    };

    // ---- (5) はみ出し: 親の overflow で切れる・スクロールが要る・舞台の外・枠の外
    const outOfStage = (r: { l: number; t: number; r: number; b: number }, el?: Element) =>
      r.l < B.l - 1 ||
      r.r > B.r + 1 ||
      // 画面全体のスクロールの枠の中は、縦に画面の外にあるのは当たり前（スクロールの位置ごとに検査する）
      (!(el && inPageScroll(el)) && (r.t < B.t - 1 || r.b > B.b + 1));
    /** 画面全体のスクロールの枠の中で、いまの位置では縦に全部画面の外にある（この位置では検査しない） */
    const offscreen = (el: Element, r: { l: number; t: number; r: number; b: number }) =>
      inPageScroll(el) && (r.b <= B.t + 1 || r.t >= B.b - 1);
    /** 祖先の overflow で切れるか（切れる祖先と種類） */
    const clipBy = (
      el: Element,
      r: { l: number; t: number; r: number; b: number },
    ): { anc: Element; kind: 'clipped' | 'scroll-hidden' | 'region'; detail?: string } | null => {
      let region: Element | null = null;
      for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
        const s = cs(a);
        const ox = s.overflowX;
        const oy = a === pageScrollEl ? 'visible' : s.overflowY;
        if (ox === 'visible' && oy === 'visible') continue;
        const c = clientBox(a);
        const outX = ox !== 'visible' && (r.l < c.l - 1 || r.r > c.r + 1);
        const outY = oy !== 'visible' && (r.t < c.t - 1 || r.b > c.b + 1);
        if (outX || outY) {
          const mode = outX ? ox : oy;
          const scroll = mode === 'auto' || mode === 'scroll';
          // スクロールの枠の上・左へのはみ出し（align-items: center 等）は、スクロールしても見えない
          const he = a as HTMLElement;
          const unreachable =
            scroll &&
            ((outY && r.t < c.t - 1 && he.scrollTop <= 0) ||
              (outX && r.l < c.l - 1 && he.scrollLeft <= 0));
          if (unreachable)
            return {
              anc: a,
              kind: 'clipped',
              detail: 'スクロールの枠の上・左にはみ出し（スクロールしても見えない）',
            };
          // スクロールさせる設計の枠（data-scroll-region）の中は 1 字ずつ出さず、枠ごとに (5b) で見る。
          // 外側の枠で切れるかは続けて見る
          if (scroll && a.hasAttribute('data-scroll-region')) {
            region ??= a;
            continue;
          }
          return { anc: a, kind: scroll ? 'scroll-hidden' : 'clipped' };
        }
      }
      return region ? { anc: region, kind: 'region' } : null;
    };
    /** 文字の箱が出てはいけない、いちばん近い枠（線・背景のある祖先。ボタンを含む） */
    const frameOf = (el: Element): Element | null => {
      for (let a: Element | null = el; a && a !== root; a = a.parentElement) {
        if (a instanceof SVGElement) return null; // 図の文字は図の中で見る（下の SVG の確認）
        if (isInline(a)) continue;
        if (a.matches(BTN_SEL) || framed(a)) return a;
      }
      return null;
    };
    for (const bx of boxes) {
      const rr = { left: bx.l, top: bx.t, right: bx.r, bottom: bx.b };
      if (offscreen(bx.el, bx)) continue;
      // 先に祖先の枠で切れるかを見る（スクロールの枠の中の文字は、舞台の外にあっても枠の問題として出す）
      const c = clipBy(bx.el, bx);
      if (c) {
        if (c.kind === 'region') continue;
        add(c.kind, bx.text, `${describe(bx.el)} ⊂ ${describe(c.anc)}`, rr, c.detail);
        continue;
      }
      if (outOfStage(bx, bx.el)) {
        add('out-of-stage', bx.text, describe(bx.el), rr);
        continue;
      }
      if (bx.svg) {
        // 図の文字が図（svg の表示範囲）の外に出る（svg は overflow: hidden が既定）
        const owner = (bx.el as SVGElement).ownerSVGElement;
        if (owner) {
          let o: SVGSVGElement = owner;
          while (o.ownerSVGElement) o = o.ownerSVGElement;
          const or = o.getBoundingClientRect();
          // C20: いちばん外の svg の計算された overflow が visible なら、svg の表示範囲では切れない
          // （祖先の枠で切れるかは上の clipBy で見た）
          if (
            cs(o).overflowX !== 'visible' &&
            (bx.l < or.left - 1 || bx.r > or.right + 1 || bx.t < or.top - 1 || bx.b > or.bottom + 1)
          )
            add('clipped', bx.text, `${describe(bx.el)} ⊂ svg`, rr, '図の表示範囲の外');
        }
        continue;
      }
      const f = frameOf(bx.el);
      if (f) {
        const fr = f.getBoundingClientRect();
        if (bx.l < fr.left - 1 || bx.r > fr.right + 1 || bx.t < fr.top - 1 || bx.b > fr.bottom + 1)
          add(
            'text-outside-box',
            bx.text,
            `${describe(bx.el)} ⊂ ${describe(f)}`,
            rr,
            `枠 ${r1(fr.width / u)}u×${r1(fr.height / u)}u`,
          );
      }
    }
    for (const { el, r } of [...buttons, ...figures]) {
      const b = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      if (offscreen(el, b)) continue;
      const label = el.getAttribute('aria-label') ?? textOf(el);
      const c = clipBy(el, b);
      if (c) {
        if (c.kind !== 'region')
          add(c.kind, label, `${describe(el)} ⊂ ${describe(c.anc)}`, r, c.detail);
      } else if (outOfStage(b, el)) add('out-of-stage', label, describe(el), r);
    }

    // ---- (5b) スクロールさせる設計の枠（data-scroll-region）: 枠ごとに、スクロールできる印と高さを見る
    for (const reg of Array.from(root.querySelectorAll('[data-scroll-region]'))) {
      if (!shown(reg)) continue;
      const he = reg as HTMLElement;
      const s = cs(reg);
      const ovY = he.scrollHeight > he.clientHeight + 2 && s.overflowY !== 'visible';
      const ovX = he.scrollWidth > he.clientWidth + 2 && s.overflowX !== 'visible';
      if (!ovY && !ovX) continue;
      const rr = reg.getBoundingClientRect();
      const rect = { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom };
      const scope = reg.parentElement ?? reg;
      const hasCue = Array.from(scope.querySelectorAll('[data-scroll-cue]')).some((q) => {
        if (!shown(q)) return false;
        const qr = q.getBoundingClientRect();
        return qr.width >= 1 && qr.height >= 1;
      });
      const kindOfReg = reg.getAttribute('data-scroll-region') ?? '';
      if (kindOfReg === 'work' || kindOfReg === 'explain') {
        // 作業領域（work）・解説の板（explain）は、印があっても枠につき1件を残す。設計で受け入れたスクロールではなく、
        // パックの文・図を短くする手がかりなので消さない（1行ずつ数えると文の長さに比例して膨らむだけ）
        const needY = he.scrollHeight - he.clientHeight;
        const needX = he.scrollWidth - he.clientWidth;
        const fs0 = parseFloat(s.fontSize) || 16;
        const lh0 = parseFloat(s.lineHeight) || fs0 * 1.5;
        const detail =
          kindOfReg === 'explain' && ovY
            ? `解説が板に ${r1(needY / lh0)} 行分入らずスクロール`
            : kindOfReg === 'explain'
              ? `解説が板に ${r1(needX / u)}u 分入らずスクロール（横）`
              : `作業領域が ${r1(Math.max(ovY ? needY : 0, ovX ? needX : 0) / u)}u 足りずスクロール`;
        add(
          'scroll-hidden',
          textOf(reg),
          `${describe(reg)}（data-scroll-region=${kindOfReg}）`,
          rect,
          detail,
        );
        continue;
      }
      if (kindOfReg === 'figure' && ovY) {
        // 数の入力の図の段（number。text-layout-fixes 第3回 T7）: 問題文・回答欄に重ねないための逃げなので、
        // 印があっても枠につき1件を残す（第4回の content で図を直す手がかり）。印・4行の高さも下で今までどおり見る
        add(
          'scroll-hidden',
          textOf(reg),
          `${describe(reg)}（data-scroll-region=figure）`,
          rect,
          `図の段が ${r1((he.scrollHeight - he.clientHeight) / u)}u 足りずスクロール`,
        );
      }
      if (!hasCue)
        add(
          'scroll-hidden',
          textOf(reg),
          `${describe(reg)}（data-scroll-region）`,
          rect,
          'スクロールできる印（data-scroll-cue）が無い',
        );
      // 4 行の高さは、本文を読む枠（passage・strip）だけ見る（書き起こしは印だけ）
      if (ovY && kindOfReg !== 'transcript') {
        const fs = parseFloat(s.fontSize) || 16;
        const lh = parseFloat(s.lineHeight) || fs * 1.5;
        if (he.clientHeight < 4 * lh - 1)
          add(
            'clipped',
            textOf(reg),
            `${describe(reg)}（data-scroll-region）`,
            rect,
            `枠の見える高さが本文の4行未満（${r1(he.clientHeight / lh)}行）`,
          );
      }
    }

    // ---- (6) 重なり: 文字どうし（em の高さに詰めた箱で比べる）
    // 枠で隠れた部分は重なりに数えない（隠れたことは (5) で出す）
    /** 背景が不透明（alpha 1）で、見えているか */
    const opaqueBg = (el: Element): boolean => {
      const st = cs(el);
      const c = st.backgroundColor;
      if (clear(c) || Number(st.opacity) < 1) return false;
      const m = /(?:,|\/)\s*([\d.]+)(%?)\s*\)$/.exec(c);
      if (!m) return true;
      const a = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      return a >= 0.999;
    };
    /** 重なりの中心で、片方の字を含む不透明な背景の要素が、もう片方を含まずに手前にあるか */
    const hiddenUnderOpaque = (
      A: { el: Element },
      Bx: { el: Element },
      x: number,
      y: number,
    ): boolean => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const stack = document.elementsFromPoint(x, y);
      const topOf = (t: Element) => {
        const i = stack.findIndex((e) => e === t || t.contains(e));
        return i < 0 ? Infinity : i;
      };
      const over = (hide: Element, other: Element): boolean => {
        const idxOther = topOf(other);
        for (let i = 0; i < stack.length && i < idxOther; i++) {
          const e = stack[i]!;
          if (e.contains(hide) && !e.contains(other) && opaqueBg(e)) return true;
        }
        return false;
      };
      return over(A.el, Bx.el) || over(Bx.el, A.el);
    };
    /** 見えている部分の箱。SVG の text は、詰めた箱（core）を枠で切った箱（cv。C31）も持つ */
    type ShownBox = LineBox & { cv?: { l: number; t: number; r: number; b: number } | null };
    const shownBoxes = boxes
      .map((bx): ShownBox | null => {
        const v = visible(bx.el, bx);
        if (!v) return null;
        const cv = bx.core
          ? visible(bx.el, { l: bx.l, t: bx.core.t, r: bx.r, b: bx.core.b })
          : undefined;
        return { ...bx, ...v, cv };
      })
      .filter((x): x is ShownBox => x !== null);
    for (let i = 0; i < shownBoxes.length; i++) {
      const A = shownBoxes[i]!;
      for (let j = i + 1; j < shownBoxes.length; j++) {
        const Bx = shownBoxes[j]!;
        if (A.node && A.node === Bx.node) continue;
        // 意図した重ね: ふりがな（rt）と自分の親字（同じ ruby）。位置は (7) で別に見る
        if (A.ruby && A.ruby === Bx.ruby && A.rt !== Bx.rt) continue;
        // 図の文字と、その図の中の文字（svg の中の text と tspan）: 同じ要素の入れ子
        if (A.el.contains(Bx.el) && A.svg && Bx.svg) continue;
        if (Bx.el.contains(A.el) && A.svg && Bx.svg) continue;
        // C31: SVG の text どうしは、上下を字の大きさの高さに詰めた箱で比べ、閾値（低いほうの 0.3 倍）は、スクロールの枠で
        // 切る前の詰めた箱で決める。外接の箱（約 1.47em）では、字の 1.1 倍だけ離して並べた縦軸の数が重なるうえ、
        // 本文の枠で切れた箱が低くなって閾値が 4px まで下がり、重なっていない「10｜15」を出していた
        // （g5.ja.text-figure/8 のヒント①・1920×1080）。HTML の字は今までどおり（Range で字の高さに詰めてある）
        const core = !!(A.svg && Bx.svg && A.core && Bx.core);
        if (core && (!A.cv || !Bx.cv)) continue; // 字の本体が枠で隠れている（隠れたことは (5) で出る）
        const ba = core ? A.cv! : A;
        const bb = core ? Bx.cv! : Bx;
        const ow = Math.min(ba.r, bb.r) - Math.max(ba.l, bb.l);
        const oh = Math.min(ba.b, bb.b) - Math.max(ba.t, bb.t);
        const oMin = core
          ? Math.min(A.core!.b - A.core!.t, Bx.core!.b - Bx.core!.t)
          : Math.min(A.b - A.t, Bx.b - Bx.t);
        // 長いふりがなの張り出し: rt が上（相手の字の行の上側）で、横の重なりが rt の字の 0.5 字以内なら、
        // 同じ行の隣の字の上に張り出しているだけ。前の行に重なる（rt の中心が相手より下）ときは出す
        if (A.rt !== Bx.rt) {
          const rtB = A.rt ? A : Bx;
          const other = A.rt ? Bx : A;
          const rtFs = rtB.b - rtB.t;
          if ((rtB.t + rtB.b) / 2 < (other.t + other.b) / 2 && ow <= 0.5 * rtFs + 1) continue;
        }
        if (ow > 1.5 && oh > 0.3 * oMin) {
          // 一方が、不透明な背景の板・吹き出しの下に隠れているときは、文字どうしの重なりに数えない
          // （隠れたことは (8) の covered で出る。二重に出さない）
          if (
            hiddenUnderOpaque(
              A,
              Bx,
              (Math.max(ba.l, bb.l) + Math.min(ba.r, bb.r)) / 2,
              (Math.max(ba.t, bb.t) + Math.min(ba.b, bb.b)) / 2,
            )
          )
            continue;
          add(
            'overlap-text',
            `${A.text}｜${Bx.text}`,
            `${describe(A.el)} と ${describe(Bx.el)}`,
            {
              left: Math.min(A.l, Bx.l),
              top: Math.min(A.t, Bx.t),
              right: Math.max(A.r, Bx.r),
              bottom: Math.max(A.b, Bx.b),
            },
            `${r1(ow / u)}u×${r1(oh / u)}u`,
          );
        }
      }
    }

    // ---- (7) ふりがなと親字
    for (const rb of Array.from(root.querySelectorAll('ruby'))) {
      const rt = rb.querySelector('rt');
      if (!rt || !shown(rt)) continue;
      const rtR = rt.getBoundingClientRect();
      if (rtR.width < 1) continue;
      const base: Ch[] = [];
      for (const n of Array.from(rb.childNodes))
        if (n.nodeType === 3) for (const c of charsOf(n as Text)) if (c) base.push(c);
      const rtChars: Ch[] = [];
      for (const n of Array.from(rt.childNodes))
        if (n.nodeType === 3) for (const c of charsOf(n as Text)) if (c) rtChars.push(c);
      for (const c of base) {
        for (const k of rtChars) {
          const ow = Math.min(c.r, k.r) - Math.max(c.l, k.l);
          const oh = Math.min(c.b, k.b) - Math.max(c.t, k.t);
          if (ow > 0.5 && oh > 0.25 * (k.b - k.t)) {
            add('ruby-overlap', `${textOf(rb)}《${rt.textContent ?? ''}》`, describe(rb), rtR);
            break;
          }
        }
      }
    }

    // ---- (8) 隠れる: 文字・ボタンの上に描く要素があるか（elementsFromPoint）
    {
      const samples: { x: number; y: number; target: Node; label: string; where: Element }[] = [];
      for (const node of textNodes) {
        const p = node.parentElement!;
        if (p.closest('svg')) continue;
        for (const c of charsOf(node)) {
          if (!c) continue;
          // 見える範囲は、overflow が visible でない祖先の padding box（線の内側。スクロールバーを除く）を
          // 小数のまま使い、1px 内側に寄せる。clientHeight は整数に丸まる（最大 0.5px 外へ出る）うえ、当たり判定は
          // 画面のピクセルに丸まるので、枠の下端でちょうど半分切れた行の字の中心は、枠の外の段（「▼ つづき」）に当たる。
          // 枠で切れて見えない字は (5) の clipped・scroll-hidden で出すので、ここでは数えない
          const v = paddingClip(p);
          const cx = (c.l + c.r) / 2;
          const cy = (c.t + c.b) / 2;
          if (cx < v.l + 1 || cx > v.r - 1 || cy < v.t + 1 || cy > v.b - 1) continue; // 枠で隠れた字
          samples.push({
            x: (c.l + c.r) / 2,
            y: (c.t + c.b) / 2,
            target: node,
            label: c.ch,
            where: p,
          });
        }
      }
      // 多すぎるときは間引く（1画面 1200 点まで）
      const step = Math.max(1, Math.ceil(samples.length / 1200));
      const coveredBy = new Map<Element, { text: string; rect: DOMRect | null; who: Element }>();
      const onFigure = new Map<Element, { text: string; fig: Element }>();
      for (let i = 0; i < samples.length; i += step) {
        const s = samples[i]!;
        if (s.x < 0 || s.y < 0 || s.x >= W || s.y >= H) continue;
        const stack = document.elementsFromPoint(s.x, s.y);
        let reached = false;
        for (const e of stack) {
          if (e.contains(s.target)) {
            reached = true;
            continue;
          }
          if (!reached) {
            // 意図した重ね: 誤答の ？（.mark--wrong）は札の角に重ねる設計。正解の ○（.mark--correct）は字の後ろに
            // 置く設計なので、字の上に来ていれば数える（match の解説で ○ が字に重なっていた）
            if (e.classList.contains('mark--wrong')) continue;
            if (paints(e, s.x, s.y)) {
              const k = coveredBy.get(s.where);
              if (k) k.text += s.label;
              else coveredBy.set(s.where, { text: s.label, rect: null, who: e });
              break;
            }
          } else {
            // root を指定したとき（板の中だけを見るとき）は、板の外（後ろの画面）の図は文字の下に数えない
            if (opt.root && !root.contains(e)) break;
            // 文字の下にある図（SVG の線・面、画像）。図の中の foreignObject 等の文字は除く
            const tag = e.tagName.toLowerCase();
            const fig =
              (e instanceof SVGElement && tag !== 'svg' && tag !== 'g' && tag !== 'text') ||
              tag === 'img' ||
              tag === 'canvas';
            if (fig && !e.contains(s.target)) {
              const owner = e instanceof SVGElement ? (e.ownerSVGElement ?? e) : e;
              // 意図した重ね: ボタンの中の絵の上の文字（ボタンの文字と絵は ボタンが配置を受け持つ）
              if (owner.closest(BTN_SEL) && owner.closest(BTN_SEL) === s.where.closest(BTN_SEL))
                break;
              const k = onFigure.get(s.where);
              if (k) k.text += s.label;
              else onFigure.set(s.where, { text: s.label, fig: owner });
              break;
            }
            // 文字の箱の背景（札など）まで来たら、それより下は見ない
            if (framed(e)) break;
          }
        }
      }
      for (const [el, v] of coveredBy)
        add(
          'covered',
          v.text,
          `${describe(el)} の上に ${describe(v.who)}`,
          el.getBoundingClientRect(),
        );
      for (const [el, v] of onFigure)
        add(
          'text-on-figure',
          v.text,
          `${describe(el)} の下に ${describe(v.fig)}`,
          el.getBoundingClientRect(),
        );

      // ボタン: 見えている部分の中心と四隅の内側（1/4）の5点
      for (const { el, r: r0 } of buttons) {
        const v = visible(el, { l: r0.left, t: r0.top, r: r0.right, b: r0.bottom });
        if (!v) continue;
        const r = new DOMRect(v.l, v.t, v.r - v.l, v.b - v.t);
        const pts: [number, number][] = [
          [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
          [r.left + r.width / 4, r.top + r.height / 4],
          [r.right - r.width / 4, r.top + r.height / 4],
          [r.left + r.width / 4, r.bottom - r.height / 4],
          [r.right - r.width / 4, r.bottom - r.height / 4],
        ];
        for (const [x, y] of pts) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          let who: Element | null = null;
          for (const e of document.elementsFromPoint(x, y)) {
            if (el.contains(e) || e.contains(el)) break;
            // 意図した重ね: 透明な当たり判定の札（sort-box__hit 等）は paints が false
            if (e.classList.contains('mark--wrong')) continue;
            if (paints(e, x, y)) {
              // 意図した重ね: ボタンの上に置いた、ボタンより小さい札（箱の中のカード・印など）。
              // 上に来た要素の外接は、祖先の overflow の枠で切ってから比べる（枠からはみ出す部分は見えない）
              const er0 = e.getBoundingClientRect();
              const er = visible(e, { l: er0.left, t: er0.top, r: er0.right, b: er0.bottom }) ?? {
                l: er0.left,
                t: er0.top,
                r: er0.right,
                b: er0.bottom,
              };
              if (
                er.l >= r0.left - 1 &&
                er.t >= r0.top - 1 &&
                er.r <= r0.right + 1 &&
                er.b <= r0.bottom + 1 &&
                (er.r - er.l) * (er.b - er.t) < 0.9 * r0.width * r0.height
              )
                break;
              // 意図した重ね: ボタンの飾り（押せることも文字も損なわない）。元の pointer-events が none で、
              // ボタンと同じ親の中にあり、ボタンに見える文字が無い（aria-label だけ）。文字のあるボタンの上の飾りは数える
              if (
                originalPointerEvents(e) === 'none' &&
                !!el.parentElement?.contains(e) &&
                textOf(el) === ''
              )
                continue;
              who = e;
              break;
            }
          }
          if (who) {
            add(
              'covered',
              el.getAttribute('aria-label') ?? textOf(el),
              `${describe(el)} の上に ${describe(who)}`,
              r,
            );
            break;
          }
        }
      }
    }

    // ---- (9) ボタンどうしの重なり（入れ子・透明な当たり判定の札を除く）
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const A = buttons[i]!;
        const Bb = buttons[j]!;
        if (A.el.contains(Bb.el) || Bb.el.contains(A.el)) continue;
        if (!paints(A.el) || !paints(Bb.el)) continue;
        const va = visible(A.el, { l: A.r.left, t: A.r.top, r: A.r.right, b: A.r.bottom });
        const vb = visible(Bb.el, { l: Bb.r.left, t: Bb.r.top, r: Bb.r.right, b: Bb.r.bottom });
        if (!va || !vb) continue;
        // 意図した重ね: 大きな札（箱のふた等）の上に、まるごと載せた小さな札
        const inside = (p: typeof va, q: typeof va) =>
          p.l >= q.l - 1 && p.t >= q.t - 1 && p.r <= q.r + 1 && p.b <= q.b + 1;
        if (inside(va, vb) || inside(vb, va)) continue;
        const ow = Math.min(va.r, vb.r) - Math.max(va.l, vb.l);
        const oh = Math.min(va.b, vb.b) - Math.max(va.t, vb.t);
        if (ow > 2 && oh > 2)
          add(
            'overlap-button',
            `${A.el.getAttribute('aria-label') ?? textOf(A.el)}｜${Bb.el.getAttribute('aria-label') ?? textOf(Bb.el)}`,
            `${describe(A.el)} と ${describe(Bb.el)}`,
            {
              left: Math.max(A.r.left, Bb.r.left),
              top: Math.max(A.r.top, Bb.r.top),
              right: Math.min(A.r.right, Bb.r.right),
              bottom: Math.min(A.r.bottom, Bb.r.bottom),
            },
            `${r1(ow / u)}u×${r1(oh / u)}u`,
          );
      }
    }

    // ---- (10) 文字の大きさ
    {
      const done = new Set<Element>();
      for (const node of textNodes) {
        const p = node.parentElement!;
        if (done.has(p)) continue;
        done.add(p);
        if (zeroFigs.some((z) => z.contains(p))) continue; // 大きさが 0 の図の中の字は、図の1件（C15）にまとめた
        const isRt = !!p.closest('rt');
        let px = parseFloat(cs(p).fontSize) || 0;
        if (p instanceof SVGElement) {
          // 図の文字: viewBox の拡大・縮小をかけた大きさ
          const m = (p as unknown as SVGGraphicsElement).getScreenCTM?.();
          if (m) px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
        }
        // 大人の文字は px で見る（ふりがな付きの大人の文は無い）
        if (!isRt && !(p instanceof SVGElement) && isAdult(p)) {
          if (px > 0 && px < minAdultPx * 0.99) {
            const r = p.getBoundingClientRect();
            add(
              'small-text',
              (node.textContent ?? '').trim(),
              describe(p),
              r,
              `${r2(px)}px（大人の文字の最小 ${minAdultPx}px）`,
            );
          }
          continue;
        }
        const min = isRt ? MIN_RUBY_U : MIN_TEXT_U;
        // 最小の 1% までの差は px の丸め・SVG の拡大率の誤差なので数えない（1.998u を「1.9u」と出していた）
        if (px > 0 && px / u < min * 0.99) {
          const r = p.getBoundingClientRect();
          add(
            'small-text',
            (node.textContent ?? '').trim(),
            describe(p),
            r,
            `${r2(px / u)}u（最小 ${min}u${isRt ? '・ふりがな' : ''}）`,
          );
        }
      }
    }

    // ---- (10b) 記法の漏れ: ふりがな《よみ》・差し込み {{ }} がそのまま出ている
    {
      const done = new Set<Element>();
      for (const node of textNodes) {
        const m = /《|》|\{\{|\}\}|\[\[|\]\]/.exec(node.data);
        if (!m) continue;
        const p = node.parentElement!;
        if (done.has(p)) continue;
        done.add(p);
        add(
          'markup-leak',
          node.data.trim(),
          describe(p),
          p.getBoundingClientRect(),
          `「${m[0]}」が画面に出ている`,
        );
      }
    }

    // ---- (11) 改行: 流れ（ブロック）ごとに、字と区切りを順に並べて行に分ける
    {
      type Item =
        | { k: 'ch'; c: Ch }
        | { k: 'space' }
        | { k: 'forced' }
        | { k: 'atom'; el: Element; l: number; t: number; r: number; b: number };
      const flowRootOf = (el: Element): Element => {
        let a: Element = el;
        while (a.parentElement && a !== root && isInline(a)) a = a.parentElement;
        return a;
      };
      const roots = new Set<Element>();
      for (const n of textNodes) {
        const p = n.parentElement!;
        if (p.closest('svg') || p.closest('rt')) continue;
        roots.add(flowRootOf(p));
      }
      const PRE = /^(pre|pre-wrap|pre-line|break-spaces)$/;
      for (const fr of roots) {
        const seq: Item[] = [];
        const walk = (n: Node) => {
          if (n.nodeType === 3) {
            const t = n as Text;
            const pre = PRE.test(cs(t.parentElement!).whiteSpace);
            const cl = charsOf(t);
            let idx = 0;
            for (const ch of t.data) {
              if (ch === '\n' && pre) seq.push({ k: 'forced' });
              else if (/\s/.test(ch)) seq.push({ k: 'space' });
              else {
                const c = cl[idx];
                if (c) seq.push({ k: 'ch', c });
              }
              idx++;
            }
            return;
          }
          if (n.nodeType !== 1) return;
          const e = n as Element;
          if (e.tagName === 'RT' || e.tagName === 'RP') return;
          if (e.tagName === 'BR') {
            seq.push({ k: 'forced' });
            return;
          }
          if (!shown(e) && cs(e).display === 'none') return;
          if (isInline(e)) {
            e.childNodes.forEach(walk);
            return;
          }
          // 行の中の塊（分数・空欄・inline-block 等）は1字として扱う。ブロックは行を区切る
          const d = cs(e).display;
          if (/^(inline-|inline$)/.test(d)) {
            const r = e.getBoundingClientRect();
            if (r.width > 0)
              seq.push({ k: 'atom', el: e, l: r.left, t: r.top, r: r.right, b: r.bottom });
          } else seq.push({ k: 'forced' });
        };
        fr.childNodes.forEach(walk);

        // 段落（強制改行で区切る）→ 行
        interface Pos {
          l: number;
          t: number;
          r: number;
          b: number;
          ch: string;
          ruby: Element | null;
          spaceBefore: boolean;
          i: number;
        }
        const paras: Pos[][] = [];
        let cur: Pos[] = [];
        let sp = false;
        let str = '';
        for (const it of seq) {
          if (it.k === 'forced') {
            if (cur.length) paras.push(cur);
            cur = [];
            sp = false;
            str += '\n';
            continue;
          }
          if (it.k === 'space') {
            sp = true;
            str += ' ';
            continue;
          }
          const p: Pos =
            it.k === 'ch'
              ? { ...it.c, spaceBefore: sp, i: str.length }
              : {
                  l: it.l,
                  t: it.t,
                  r: it.r,
                  b: it.b,
                  ch: '□',
                  ruby: null,
                  spaceBefore: sp,
                  i: str.length,
                };
          str += p.ch;
          cur.push(p);
          sp = false;
        }
        if (cur.length) paras.push(cur);

        const inBtn = fr.closest(BTN_SEL);
        // 大人の文は、分かち書き・ボタンの中の語の折れを見ない（禁則・語や数の折れ・最後の行は見る）
        const adult = isAdult(fr);
        const where = describe(fr);
        const full = textOf(fr);
        let seg: Intl.Segmenter | null = null;
        for (const para of paras) {
          // 行に分ける: 次の字の中心が今の行の下端より下 → 新しい行
          const lines: Pos[][] = [];
          let line: Pos[] = [];
          let lb = 0;
          for (const p of para) {
            const cy = (p.t + p.b) / 2;
            const prev = line[line.length - 1];
            if (prev && cy > lb && p.l < prev.r + 1) {
              lines.push(line);
              line = [];
            }
            lb = line.length === 0 ? p.b : Math.max(lb, p.b);
            line.push(p);
          }
          if (line.length) lines.push(line);
          if (lines.length < 2) continue;

          const paraText = para.map((p) => (p.spaceBefore ? ' ' : '') + p.ch).join('');
          const hasSpaces = /\S \S/.test(paraText.trim());
          const spaceCount = para.filter((p) => p.spaceBefore).length;
          const box = (a: Pos, b: Pos) => ({
            left: Math.min(a.l, b.l),
            top: Math.min(a.t, b.t),
            right: Math.max(a.r, b.r),
            bottom: Math.max(a.b, b.b),
          });
          /**
           * 改行の直前が「・」で、前後の項目（「・」か文の始め・終わりで区切った部分）がどちらも2字以上か。1字の並び（き・つ・つ・き）は数える。
           * 項目は空白を含む句でもよい（「ちいさい じ・のばす おと」の「ちいさい じ」。アプリの画面の選ぶ画面の札の名前）。
           * 前の部分を空白の所で止めて「じ」の 1 字と数えると、項目の境目の自然な改行（「ちいさい じ・／のばす おと」）を
           * 語の途中として出す誤検出だった（check:app-layout のレビュー）。字の数は空白を除いて数える。
           * 文の終わり（。．.!?！？）のすぐ後ろの「・」は、文と文の区切り（聞く問題の書き起こし。listen.tsx）なので、後ろの部分が
           * 1字（英語の「I」）でも改行してよい（第6回のレビュー。「・」を字にしたあと「summer.・／I swam」が出た）
           */
          const nakaguroBreak = (ps: Pos[], a: Pos, b: Pos): boolean => {
            if (a.ch !== '・') return false;
            const ai = ps.indexOf(a);
            const bi = ps.indexOf(b);
            if (ai < 0 || bi !== ai + 1) return false;
            if (ai > 0 && /^[。．.!?！？]$/.test(ps[ai - 1]!.ch)) return true;
            let before = 0;
            for (let k = ai - 1; k >= 0; k--) {
              if (ps[k]!.ch === '・') break;
              before++;
            }
            let after = 0;
            for (let k = bi; k < ps.length; k++) {
              if (ps[k]!.ch === '・') break;
              after++;
            }
            return before >= 2 && after >= 2;
          };
          const ctx = (li: number) => {
            const a = lines[li]!.map((p) => (p.spaceBefore ? ' ' : '') + p.ch).join('');
            const b = lines[li + 1]!.map((p) => (p.spaceBefore ? ' ' : '') + p.ch).join('');
            return `${a.trim().slice(-10)}／${b.trim().slice(0, 10)}`;
          };

          // (g) 極端に狭い折り返し
          const maxPerLine = Math.max(...lines.map((l) => l.length));
          if (lines.length >= 3 && maxPerLine <= 2) {
            add(
              'narrow-wrap',
              paraText.trim(),
              where,
              box(lines[0]![0]!, lines[lines.length - 1]![0]!),
              `${lines.length}行・1行 ${maxPerLine}字まで`,
            );
            continue;
          }
          // (c) 最後の行が1文字
          const last = lines[lines.length - 1]!;
          if (last.length === 1)
            add('orphan', `${ctx(lines.length - 2)}`, where, box(last[0]!, last[0]!), full);

          for (let li = 0; li + 1 < lines.length; li++) {
            const a = lines[li]![lines[li]!.length - 1]!;
            const b = lines[li + 1]![0]!;
            const rect = box(a, b);
            const text = ctx(li);
            // (a)(b) 禁則
            if (START_NG.has(b.ch)) add('kinsoku-start', text, where, rect, full);
            if (END_NG.has(a.ch)) add('kinsoku-end', text, where, rect, full);
            // (e) 語・数・単位・ふりがな付きの語
            const alnum = /^[A-Za-z0-9]$/;
            if (!b.spaceBefore && alnum.test(a.ch) && alnum.test(b.ch))
              add('word-split', text, where, rect, '英単語・数の途中');
            else if (
              /^[0-9]$/.test(a.ch) &&
              (/^(cm|mm|km|m|kg|mg|g|mL|dL|kL|L|ha|a|%|℃|°|度)/.test(
                str.slice(b.i, b.i + 3).replace(/\s/g, ''),
              ) ||
                (!b.spaceBefore &&
                  /^[ぁ-ゖァ-ヺ一-鿿㐀-䶿]$/.test(b.ch) &&
                  // 数のあとの助詞（「11／で」「7／は芸術」）は、数と助詞の境目で改行してよい（C14）。
                  // 仮名で書いた助数詞の頭（に＋ん・と＋う・は＋い・か＋い・か＋げつ）は、今までどおり数える
                  !(NUM_PARTICLES.has(b.ch) && !KANA_COUNTER_NEXT[b.ch]?.has(str[b.i + 1] ?? ''))))
            )
              add('word-split', text, where, rect, '数と単位・助数詞の間');
            else if (
              !b.spaceBefore &&
              ((/^[0-9]$/.test(a.ch) && /^[:：.,，．/／]$/.test(b.ch)) ||
                (/^[:：.,，．/／]$/.test(a.ch) && /^[0-9]$/.test(b.ch)))
            )
              add('word-split', text, where, rect, '時刻・小数・分数の途中');
            else if (a.ruby && a.ruby === b.ruby)
              add('word-split', text, where, rect, 'ふりがな付きの語の途中');
            // 分かち書きの「・」のあとの改行（語と語の区切り。JIS X 4051 で改行してよい）
            else if (nakaguroBreak(para, a, b)) {
              /* 数えない */
            }
            // (d) 分かち書きの語の途中
            else if (
              !adult &&
              wakachi &&
              hasSpaces &&
              !b.spaceBefore &&
              !BREAK_OK_AFTER.has(a.ch) &&
              !END_NG.has(a.ch) &&
              !START_NG.has(b.ch) &&
              // 始め括弧の直前は、空白が無くても改行してよい（「…は／「…」」。誤検出だった）
              !END_NG.has(b.ch)
            ) {
              if (inBtn) add('button-split', text, where, rect, '分かち書きの語の途中');
              else add('wakachi-split', text, where, rect, full);
            }
            // (f) ボタン・選択肢の中で語が途中で折れる（分かち書きでない語は Intl.Segmenter の単語で見る）
            // 始め括弧の前の改行は組版として正しい（C23。JIS X 4051。(d) と同じ扱い）
            else if (
              !adult &&
              inBtn &&
              !b.spaceBefore &&
              !START_NG.has(b.ch) &&
              !BREAK_OK_AFTER.has(a.ch) &&
              !END_NG.has(b.ch)
            ) {
              // 空白でない所の改行を見るのは、分かち書きの段階か、空白が多い（空白の数 ≧ 字数 ÷ 12）ラベルだけ。
              // 名前の空白（森川 はるか）が1つあるだけの普通の文は、文節の切れ目の改行まで違反にしない
              if (hasSpaces && (wakachi || spaceCount * 12 >= para.length))
                add('button-split', text, where, rect, '空白でない所で改行');
              else if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
                seg ??= new Intl.Segmenter('ja', { granularity: 'word' });
                const pText = para.map((p) => p.ch).join('');
                const at = para.indexOf(b);
                for (const sgm of seg.segment(pText)) {
                  const end = sgm.index + sgm.segment.length;
                  if (at > sgm.index && at < end && sgm.isWordLike) {
                    // 複合辞（という・について…）の頭の助詞の直後は文節の切れ目（C17）。同じ語のほかの位置は出す
                    if (at === sgm.index + 1 && COMPOUND_PARTICLES.has(sgm.segment)) break;
                    add('button-split', text, where, rect, `語「${sgm.segment}」の途中`);
                    break;
                  }
                  if (end > at) break;
                }
              }
            }
          }
        }
      }
    }

    // ---- (8b) 正解の印 .mark--correct（C16・C21）。輪の中は透明で当たり判定（elementsFromPoint）が通り抜けるので、
    // (8) では数えられない。字の後ろか前かは問わない（線は字の後ろでも字を横切って読みにくい）。
    //   - 大きな輪（札の中央に置く真円）: 字の矩形（上下左右を 15% ずつ内側。ふりがなを含む）が輪の線の帯（外の円 − 内の円）と
    //     交わる字が 1 つでもあれば covered（C27。C21 までは字の中心だけで、rt を除いていた）。
    //     札の字数では外さない（C21。幼児の英語の短い札で「輪は字の上下を通るだけ」が成り立たなかった）。
    //     輪が札の枠からはみ出して、隣の札の矩形に入るものも covered
    //   - 角の小さな ○（transform なし。白地）: 字（ふりがなを含む）の矩形と ○ の円が重なれば covered
    // 輪・円は円の式で判定する（paints と同じ式）
    /** 円（中心 cx,cy・半径 r）と矩形が重なるか（矩形の外へ 0、辺に触れるだけは重なりとしない） */
    const circleHitsRect = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      q: { l: number; t: number; r: number; b: number },
    ): boolean => {
      // 楕円は半径で割って真円にして比べる
      const nx = Math.max(q.l, Math.min(cx, q.r));
      const ny = Math.max(q.t, Math.min(cy, q.b));
      return Math.hypot((nx - cx) / rx, (ny - cy) / ry) < 1;
    };
    const cardSelector = `${BTN_SEL}, .tk-card, .choice`;
    for (const mk of Array.from(root.querySelectorAll('.mark--correct'))) {
      if (!shown(mk)) continue;
      const parent = mk.parentElement;
      if (!parent) continue;
      // 印の札。絵とラベルのある札（listen の .eng-opts__pic の中の輪。第6回 W1）は、包みでなく札（.choice）の字と隣の札を見る
      // （包みの中だけを見ると、輪がラベルの字や隣の札にかかっても出なかった。レビュー）
      const card = parent.matches(cardSelector) ? parent : (parent.closest(cardSelector) ?? parent);
      const mr = mk.getBoundingClientRect();
      if (mr.width < 2 || mr.height < 2) continue;
      const rx = mr.width / 2;
      const ry = mr.height / 2;
      const cx = mr.left + rx;
      const cy = mr.top + ry;
      // 角の小さな ○ は 3.2u 前後。札と同じ大きさの背景だけの印・大きな輪とは大きさで分ける
      const corner = mr.width <= 4.5 * u && mr.height <= 4.5 * u;
      const where = `${describe(card)} の上に ${describe(mk)}`;
      const cardChars: Ch[] = [];
      for (const node of textNodes) {
        if (!card.contains(node)) continue;
        for (const c of charsOf(node)) if (c) cardChars.push(c);
      }
      if (corner) {
        // 角の ○ と字（rt を含む）の矩形。1px 内側で比べる（接するだけは数えない）
        const hit = cardChars.filter((c) =>
          circleHitsRect(cx, cy, rx, ry, { l: c.l + 1, t: c.t + 1, r: c.r - 1, b: c.b - 1 }),
        );
        if (hit.length >= 1)
          add(
            'covered',
            hit.map((c) => c.ch).join(''),
            where,
            card.getBoundingClientRect(),
            '角の ○ が字・ふりがなに重なる',
          );
        continue;
      }
      const bw = parseFloat(cs(mk).borderTopWidth) || 0;
      if (bw > 0) {
        // 線の無い印（背景だけ）は帯が無い。
        // C27: 字の中心でなく、字の矩形（上下左右を 15% ずつ内側）が帯（外の円 − 内の円）と交わるかで見る。外の円の外、
        // 内の円に入りきった字は数えない。ふりがな（rt）の字も数える。中心だけでは、輪が字を横切るのに中心が帯の外で
        // 通り抜けた（g1.math.shapes/1・2 の「すいか」「かん」）うえ、rt を除いていたので、listen の絵の段の輪が
        // ふりがなにかかるものが出なかった
        const irx = rx - bw;
        const iry = ry - bw;
        const hit = cardChars.filter((c) => {
          const dw = (c.r - c.l) * 0.15;
          const dh = (c.b - c.t) * 0.15;
          const q = { l: c.l + dw, t: c.t + dh, r: c.r - dw, b: c.b - dh };
          if (!circleHitsRect(cx, cy, rx, ry, q)) return false; // 外の円の外
          if (irx <= 0 || iry <= 0) return true; // 線が半径いっぱい（塗りつぶし）
          const far = Math.max(
            ...(
              [
                [q.l, q.t],
                [q.r, q.t],
                [q.l, q.b],
                [q.r, q.b],
              ] as const
            ).map(([x, y]) => Math.hypot((x - cx) / irx, (y - cy) / iry)),
          );
          return far > 1; // 内の円に入りきっていない
        });
        if (hit.length >= 1)
          add(
            'covered',
            hit.map((c) => c.ch).join(''),
            where,
            card.getBoundingClientRect(),
            '正解の ○ が字を横切る',
          );
        // 輪が隣の札の矩形（2px 内側）に入る
        const neighbors: Element[] = [];
        for (const o of Array.from(root.querySelectorAll(cardSelector))) {
          if (o.contains(card) || card.contains(o) || !shown(o)) continue;
          const or = o.getBoundingClientRect();
          if (or.width < 4 || or.height < 4) continue;
          if (
            circleHitsRect(cx, cy, rx, ry, {
              l: or.left + 2,
              t: or.top + 2,
              r: or.right - 2,
              b: or.bottom - 2,
            })
          )
            neighbors.push(o);
        }
        // 輪の中に入りきった小さな要素（札の中の絵・印など）は隣の札ではない。同じ親の中の兄弟の札だけ見る
        const sibs = neighbors.filter(
          (o) =>
            o.parentElement === card.parentElement ||
            o.parentElement?.parentElement === card.parentElement?.parentElement,
        );
        for (const o of sibs.slice(0, 1))
          add(
            'covered',
            textOf(o).slice(0, 20),
            `${describe(o)} の上に ${describe(mk)}（${describe(card)} の正解の ○）`,
            o.getBoundingClientRect(),
            '正解の ○ が隣の札にかかる',
          );
      }
    }

    // ---- (8c) 線でむすぶ問題（match）の線が、両端の札以外の札の後ろを通る（C25）: 線分が、両端以外の札の矩形
    // （2px 内側）と交わるもの。正解の線（is-correct）も子供が引いた線も見る。札は左右の列の TapCard
    for (const line of Array.from(root.querySelectorAll('line.eng-match__line'))) {
      const ln = line as SVGLineElement;
      const m = ln.getScreenCTM();
      if (!m) continue;
      const pt = (x: string, y: string) => {
        const p = new DOMPoint(
          parseFloat(ln.getAttribute(x) ?? '0'),
          parseFloat(ln.getAttribute(y) ?? '0'),
        ).matrixTransform(m);
        return [p.x, p.y] as const;
      };
      const [x1, y1] = pt('x1', 'y1');
      const [x2, y2] = pt('x2', 'y2');
      const wrap = ln.closest('.eng-match');
      if (!wrap) continue;
      const cards = Array.from(wrap.querySelectorAll('.tk-card')).filter(
        (c) => shown(c) && !c.parentElement?.closest('.tk-card'),
      );
      /** 線分と矩形が交わるか（Liang-Barsky） */
      const segHits = (q: { l: number; t: number; r: number; b: number }): boolean => {
        let t0 = 0;
        let t1 = 1;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const clip = (p: number, qv: number): boolean => {
          if (p === 0) return qv >= 0;
          const t = qv / p;
          if (p < 0) {
            if (t > t1) return false;
            if (t > t0) t0 = t;
          } else {
            if (t < t0) return false;
            if (t < t1) t1 = t;
          }
          return true;
        };
        return (
          clip(-dx, x1 - q.l) &&
          clip(dx, q.r - x1) &&
          clip(-dy, y1 - q.t) &&
          clip(dy, q.b - y1) &&
          t0 <= t1
        );
      };
      const rects = cards.map((c) => c.getBoundingClientRect());
      const near = (p: readonly [number, number], r: DOMRect) =>
        p[0] >= r.left - 4 && p[0] <= r.right + 4 && p[1] >= r.top - 4 && p[1] <= r.bottom + 4;
      cards.forEach((c, i) => {
        const r = rects[i]!;
        if (near([x1, y1], r) || near([x2, y2], r)) return; // 両端の札
        if (r.width < 6 || r.height < 6) return;
        if (segHits({ l: r.left + 2, t: r.top + 2, r: r.right - 2, b: r.bottom - 2 }))
          add(
            'covered',
            textOf(c).slice(0, 20),
            `${describe(c)} の上に ${describe(ln)}`,
            r,
            '線が別の札の後ろを通る',
          );
      });
    }

    // ---- (12) 札の中の絵（C28・C29 a・C32）・パックの SVG の札の列（C29 b）・並んだ札のすき間（C30）
    // 字の検査は字しか見ないので、絵が札の外に出ても、小さくても、札がつながっても何も出なかった（第7回の点検 1〜5・19〜22）
    {
      /** 札ごとの絵。絵は、いちばん外の svg・img・.fig-illust__group の子（入れ子は外側の 1 つ）。.mark・.tk-badge は絵に数えない */
      const picsOf = new Map<Element, Element[]>();
      {
        const cands: Element[] = [];
        for (const el of Array.from(root.querySelectorAll('svg, img, .fig-illust__group > *'))) {
          if (el.closest('.mark, .tk-badge')) continue;
          if (el.parentElement?.closest('svg')) continue; // 入れ子の svg は外側で見る
          if (!shown(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue; // 大きさが 0 の図は (3b)
          cands.push(el);
        }
        for (const el of cands) {
          if (cands.some((o) => o !== el && o.contains(el))) continue; // 絵の中の絵
          const card = el.closest(cardSelector);
          if (!card || !root.contains(card)) continue;
          const list = picsOf.get(card);
          if (list) list.push(el);
          else picsOf.set(card, [el]);
        }
      }
      let allCards: Element[] | null = null;
      /** 札の名前（ボタンの文字か aria-label。無ければ、札の並びの何番目か） */
      const cardLabel = (card: Element): string => {
        const t = card.getAttribute('aria-label') ?? textOf(card);
        if (t) return t;
        allCards ??= Array.from(root.querySelectorAll(cardSelector));
        return `札${allCards.indexOf(card) + 1}`;
      };

      // C28 絵が札の外に出る・札で切れる: 絵の矩形が (b) 札の中の overflow が visible でない祖先の枠（札自身を含む）から
      // 0.3u を超えて出る（その枠で切れる）か、(a) 札の矩形（枠線の内側）から 0.3u を超えて出る。札ごとに 1 件（いちばん大きいもの）
      const FIG_TOL = 0.3 * u;
      for (const [card, list] of picsOf) {
        const cb = clientBox(card);
        let best: { amt: number; kind: 'out' | 'clip'; el: Element; r: DOMRect } | null = null;
        for (const p of list) {
          const pr = p.getBoundingClientRect();
          let hit: { amt: number; kind: 'out' | 'clip' } | null = null;
          for (let a: Element | null = p.parentElement; a; a = a.parentElement) {
            const s = cs(a);
            if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
              const c = clientBox(a);
              const amt = Math.max(
                s.overflowX !== 'visible' ? Math.max(c.l - pr.left, pr.right - c.r) : 0,
                s.overflowY !== 'visible' ? Math.max(c.t - pr.top, pr.bottom - c.b) : 0,
              );
              if (amt > FIG_TOL) {
                hit = { amt, kind: 'clip' };
                break;
              }
            }
            if (a === card) break;
          }
          if (!hit) {
            const amt = Math.max(cb.l - pr.left, pr.right - cb.r, cb.t - pr.top, pr.bottom - cb.b);
            if (amt > FIG_TOL) hit = { amt, kind: 'out' };
          }
          if (hit && (!best || hit.amt > best.amt)) best = { ...hit, el: p, r: pr };
        }
        if (best)
          add(
            'figure-outside-box',
            `${cardLabel(card)}（絵 ${list.length}）`,
            `${describe(best.el)} ⊂ ${describe(card)}`,
            best.r,
            best.kind === 'clip'
              ? `絵が札の枠で ${r1(best.amt / u)}u 切れる`
              : `絵が札の外に ${r1(best.amt / u)}u 出る`,
          );
      }

      // C29 (a) 数える札: 1 つの札に .fig-illust__group の絵が 2 つ以上あるとき、絵の短い辺が 4u 未満（段階を問わない）。
      // 下限は DESINGN.md 17 章（第7回 X2）。丸めの 1% は数えない
      const COUNT_MIN_U = 4;
      /** 札の絵のうち、数える絵（.fig-illust__group の子）。2 つ以上ある札が数える札 */
      const countedIn = (list: Element[]): Element[] =>
        list.filter((p) => p.parentElement?.classList.contains('fig-illust__group'));
      for (const [card, list] of picsOf) {
        const counted = countedIn(list);
        if (counted.length < 2) continue;
        let small: Element = counted[0]!;
        let side = Infinity;
        for (const p of counted) {
          const pr = p.getBoundingClientRect();
          const sd = Math.min(pr.width, pr.height);
          if (sd < side) {
            side = sd;
            small = p;
          }
        }
        if (side < COUNT_MIN_U * u * 0.99)
          add(
            'small-figure',
            `${cardLabel(card)}（${counted.length}こ）`,
            `${describe(small)} ⊂ ${describe(card)}`,
            small.getBoundingClientRect(),
            `数える絵が ${r1(side / u)}u（最小 ${COUNT_MIN_U}u・${counted.length}こ）`,
          );
      }

      // C32（small-figure の (c)）絵が 1 つの札: 選択肢の札（.choice）の中の絵が 1 つで、それが登録の絵（svg[data-illust]）のとき、
      // 絵の短い辺が 6u 未満（段階を問わない）。6u は DESINGN.md 17 章の幼児以外の --pic-floor で、1280×620 でも約 66px
      // （絵の形が分かる大きさ）。幼児の 10u は並べ方を選ぶときの目標で、ここでは見ない。同じ選択肢の列（札の親）に数える札
      // （(a)）があるときは、その列の絵が 1 つの札も数える札として 4u で見る（第7回 X2 は列ごとに数える札として大きさを
      // 決める。p5.en.phrases の「1 こ」の札）。対象にしないもの: パックの SVG の図（時計・図形・札の列。data-illust がない）、
      // 札の飾りのアイコン（.tap__icon）、.choice でない札（単元の札 .tk-card・ボタン。.tk-card は札の設計の大きさ 5.6u・
      // 箱の中 4.6u × --fit で決まり、絵だけの札の下限は次の回に決める）。丸めの 1% は数えない
      const ONE_MIN_U = 6;
      const countParents = new Set<Element | null>();
      for (const [card, list] of picsOf)
        if (countedIn(list).length >= 2) countParents.add(card.parentElement);
      for (const [card, list] of picsOf) {
        if (!card.classList.contains('choice') || list.length !== 1) continue;
        const pic = list[0]!;
        if (!pic.matches('svg[data-illust]') || pic.classList.contains('tap__icon')) continue;
        const min = countParents.has(card.parentElement) ? COUNT_MIN_U : ONE_MIN_U;
        const pr = pic.getBoundingClientRect();
        const side = Math.min(pr.width, pr.height);
        if (side < min * u * 0.99)
          add(
            'small-figure',
            cardLabel(card),
            `${describe(pic)} ⊂ ${describe(card)}`,
            pr,
            `絵が ${r1(side / u)}u（最小 ${min}u・${min === COUNT_MIN_U ? '数える札の列の ' : ''}1 つの札）`,
          );
      }

      // C29 (b) パックの SVG（.fig-svg の svg）の中の、同じ大きさの矩形（rect。縦横比 1.5 倍以内）が 3 つ以上、
      // すき間が短い辺の半分以下で縦か横に並ぶもの（手順の札・盤のます）の短い辺が 2.4u 未満。矩形は、正方形（盤のます）か
      // 角丸（rx > 0）の札。手順の札（prog の stripFigure の rx=5 の角丸の札、1.5u×1.7u など）は正方形ではない（点検 22 の
      // g6.prog.efficient・g5.prog.debug-plan）ので、正方形だけに絞ると、検査の目的の札が出ない。角のない長方形の分割
      // （分数の帯の 24 等分）と、細長い帯・枠・横長の絵（縦横比 1.5 倍超）は札・ますではない。
      // 間をあけて置いた図形（p5.think.pattern の「ちいさい しかく」）は並んでいないので数えない。
      // 下限は DESINGN.md 17 章（第6回 W8・第7回 X4）の盤の 1 ます
      const CELL_MIN_U = 2.4;
      for (const svg of Array.from(root.querySelectorAll('.fig-svg svg'))) {
        if (svg.parentElement?.closest('svg') || !shown(svg)) continue;
        interface Cell {
          l: number;
          t: number;
          w: number;
          h: number;
        }
        const cells: Cell[] = [];
        for (const rc of Array.from(svg.querySelectorAll('rect'))) {
          if (rc.closest('defs, symbol, clipPath, mask, pattern, marker')) continue;
          const r = rc.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const long = Math.max(r.width, r.height);
          const short = Math.min(r.width, r.height);
          if (long > 1.5 * short) continue; // 細長い帯・枠・横長の絵（p23.math.compare の電車の 1 両は 1.7 倍）
          // 正方形（盤のます）か、角丸の札（手順の札。rx > 0）だけ。角のない長方形の分割（分数の帯のます。
          // g4.math.fraction-kinds の 24 等分など）は札でも盤のますでもないので数えない
          const rounded =
            (parseFloat(rc.getAttribute('rx') ?? '') || parseFloat(cs(rc).rx) || 0) > 0;
          if (long - short > 0.04 * long && !rounded) continue;
          cells.push({ l: r.left, t: r.top, w: r.width, h: r.height });
        }
        // 同じ大きさ（幅・高さがどちらも 4% 以内）のまとまり。同じ位置の重ね描き（面と枠など）は 1 つ
        const groups: Cell[][] = [];
        for (const c of cells) {
          const g = groups.find(
            (x) =>
              Math.abs(x[0]!.w - c.w) <= 0.04 * x[0]!.w &&
              Math.abs(x[0]!.h - c.h) <= 0.04 * x[0]!.h,
          );
          const tol = 0.1 * Math.min(c.w, c.h);
          if (!g) groups.push([c]);
          else if (!g.some((q) => Math.abs(q.l - c.l) <= tol && Math.abs(q.t - c.t) <= tol))
            g.push(c);
        }
        let worst = Infinity;
        let worstN = 0;
        for (const group of groups) {
          if (group.length < 3) continue;
          const w = group[0]!.w;
          const h = group[0]!.h;
          const s = Math.min(w, h);
          const tol = 0.1 * s;
          const parent = group.map((_, k) => k);
          const find = (k: number): number =>
            parent[k] === k ? k : (parent[k] = find(parent[k]!));
          for (let a = 0; a < group.length; a++) {
            for (let b = a + 1; b < group.length; b++) {
              const dx = Math.abs(group[b]!.l - group[a]!.l);
              const dy = Math.abs(group[b]!.t - group[a]!.t);
              // 同じ行（縦のずれが小さい）で横のすき間が、または同じ列で縦のすき間が、短い辺の半分以下
              const gap = dy <= tol ? dx - w : dx <= tol ? dy - h : Infinity;
              if (gap >= -tol && gap <= 0.5 * s + 0.5) parent[find(a)] = find(b);
            }
          }
          const comp = new Map<number, number>();
          group.forEach((_, k) => comp.set(find(k), (comp.get(find(k)) ?? 0) + 1));
          const n = Math.max(...comp.values());
          if (n >= 3 && s < worst) {
            worst = s;
            worstN = n;
          }
        }
        if (worst < CELL_MIN_U * u * 0.99) {
          const fig = svg.closest('.fig-svg') ?? svg;
          add(
            'small-figure',
            fig.getAttribute('aria-label') ?? textOf(fig),
            describe(fig),
            svg.getBoundingClientRect(),
            `手順の札・盤のますの短い辺が ${r1(worst / u)}u（最小 ${CELL_MIN_U}u・${worstN}こ並ぶ）`,
          );
        }
      }

      // C30 並んだ札のすき間: 横軸の札の列（.fig-chart__labels・graph の .gr-xlabels の子）と数直線の印のラベル
      // （.fig-nl__labels の子）で、同じ行の隣どうしの字の矩形（ふりがな rt は除く）のすき間が字の大きさの 0.25 倍未満。
      // 重ならなくても、すき間が無いと「9時10時11時」のようにつながって読める（overlap-text は重なりしか見ない）。
      // 文の中の span どうし（Rt の ruby・nobr の包み）はすき間 0 で並ぶのが正しいので、札の列に絞る
      const GAP_MIN = 0.25;
      for (const lab of Array.from(
        root.querySelectorAll('.fig-chart__labels, .gr-xlabels, .fig-nl__labels'),
      )) {
        if (!shown(lab)) continue;
        const inLab = textNodes.filter((n) => lab.contains(n));
        const items: { l: number; t: number; r: number; b: number; fs: number; text: string }[] =
          [];
        for (const ch of Array.from(lab.children)) {
          if (!shown(ch)) continue;
          let l = Infinity;
          let t = Infinity;
          let r = -Infinity;
          let b = -Infinity;
          let fs = 0;
          let text = '';
          for (const node of inLab) {
            if (!ch.contains(node)) continue;
            for (const c of charsOf(node)) {
              if (!c || c.rt) continue;
              l = Math.min(l, c.l);
              t = Math.min(t, c.t);
              r = Math.max(r, c.r);
              b = Math.max(b, c.b);
              fs = Math.max(fs, c.b - c.t);
              text += c.ch;
            }
          }
          if (text) items.push({ l, t, r, b, fs, text });
        }
        if (items.length < 2) continue;
        // 行に分ける（縦の中心が字の 0.5 倍以内。1 つおきに下へずらした段は別の行）
        items.sort((a, b) => (a.t + a.b) / 2 - (b.t + b.b) / 2);
        const rows: (typeof items)[] = [];
        for (const it of items) {
          const row = rows[rows.length - 1];
          const first = row?.[0];
          if (
            row &&
            first &&
            Math.abs((it.t + it.b) / 2 - (first.t + first.b) / 2) <= 0.5 * first.fs
          )
            row.push(it);
          else rows.push([it]);
        }
        let worstGap = Infinity;
        let wa: (typeof items)[number] | null = null;
        let wb: (typeof items)[number] | null = null;
        for (const row of rows) {
          row.sort((a, b) => a.l - b.l);
          for (let k = 0; k + 1 < row.length; k++) {
            const a = row[k]!;
            const b = row[k + 1]!;
            const ratio = (b.l - a.r) / Math.max(a.fs, b.fs);
            if (ratio < GAP_MIN && ratio < worstGap) {
              worstGap = ratio;
              wa = a;
              wb = b;
            }
          }
        }
        if (wa && wb)
          add(
            'label-gap',
            items
              .slice()
              .sort((a, b) => a.l - b.l)
              .map((x) => x.text)
              .join('｜'),
            describe(lab),
            {
              left: Math.min(wa.l, wb.l),
              top: Math.min(wa.t, wb.t),
              right: Math.max(wa.r, wb.r),
              bottom: Math.max(wa.b, wb.b),
            },
            `隣の札「${wa.text}」「${wb.text}」のすき間が字の ${r2(worstGap)} 倍（最小 ${GAP_MIN} 倍）`,
          );
      }
    }

    return { u: r1(u), viewport: [W, H], chars: charCount, issues };
  }
}
