/**
 * 絵の札の幅と絵の大きさ（text-layout-fixes 第7回 X2）。DOM に触らない計算だけ（測った寸法は choice.tsx の
 * usePicsGeometry が px で渡し、結果の --pic-max・--card-w・並べ方を CSS に書く）。
 *
 * - 札の中の絵は、絵 1 種類のまとまり（kind: 'illust'。絵を並べた行 kind: 'row' は、まとまりを並べたもの）。
 *   選択肢のどれかに絵が 6 こ以上ある問題（数える札）は、まとまりごとに 5 こずつの行にする（6〜10 こは 5＋残り。
 *   11 こ以上は今の 5 のまとまり）。まとまりが 2 つ以上の札（りんご 3 こ・バナナ 6 こ）は、まとまりを縦に積む。
 *   数える札でない問題は、札の中の絵を 1 行に並べる。
 * - 絵の大きさ s を、「札の幅の合計 ≦ 列の幅」と「並べた高さ ≦ 高さの上限」を満たす最大にする（2 分探索。上限 15u）。
 *   絵 1 つの実際の大きさは min(s, 絵の既定の大きさ)（Figure.tsx の IllustGroup が絵の数で決める）。
 * - 並べ方（1 段／2×2、聞く問題は「きく」の札が上／左）は、s が最大のものを選ぶ。今の並べ方から替えるのは、
 *   はっきり大きくなるときだけ（わずかな差で行き来しない）。
 */

/** 数える札の 1 行の絵の数（text-layout-fixes 第7回 X2） */
export const PER_ROW = 5;
/** 絵の大きさ s の上限（u） */
export const PIC_MAX_U = 15;
/** 絵の大きさ s の下限（u）。これ以下には縮めない（収まらないときは作業領域のスクロールが残り、検査に出る） */
export const PIC_MIN_U = 1;
/**
 * 数える札の絵の下限（u。DESINGN.md 17 章）。寸法の計算では使わない（下限に届かなくても s が最大の並べ方のまま描き、
 * 検査 small-figure〔e2e/helpers/text-layout.ts の COUNT_MIN_U〕が見る）。1 つの札に絵が 1 つだけの問題は --pic-floor
 * （幼児 10u・ほか 6u。choice.css）だが、絵だけの札の列（data-fit）では JS が 0 にする
 */
export const COUNT_FLOOR_U = 4;
/** 札の影（0 var(--step) 0）の分の余白（u）。--pic-h と同じ */
export const SHADOW_U = 1;
/** 絵と絵のすき間（u。figure.css の .fig-illust__group） */
export const PIC_GAP_U = 0.6;
/** 数える札で、まとまり（絵 1 種類）を縦に積むときの、まとまりの間のすき間（u。choice.css の .fig-row の row-gap と同じ） */
export const STACK_GAP_U = 1.2;
/** 並べ方を替えるのに要る大きくなり方（割合） */
export const SWITCH_RATIO = 1.1;

/** 絵 1 種類のまとまり（Figure の kind: 'illust' 1 つ） */
export interface PicGroup {
  /** 絵の数 */
  n: number;
  /** 絵 1 つの既定の大きさ（u）。Figure.tsx の IllustGroup（絵の数が 3 まで 12・10 まで 8・それ以上 6）と同じ */
  cap: number;
}

/** 札の中の図に並ぶ絵 */
export interface PicSpec {
  /** 絵の数の合計 */
  n: number;
  /** まとまり（絵 1 種類ずつ。絵を並べた行は、中の絵ごと） */
  groups: PicGroup[];
  /** まとまりの間のすき間（u）。絵を並べた行（kind: 'row'）の gap（既定 2u）。まとまりが 1 つなら 0。1 行に並べるときの幅に使う */
  gap: number;
  /** 絵 1 つの既定の大きさのうち、いちばん大きいもの（u） */
  cap: number;
  /** 絵 1 つの既定の大きさのうち、いちばん小さいもの（u。5 こぶんの幅を決める CSS の --pic-cap） */
  minCap: number;
}

/** Figure.tsx の IllustGroup が絵に付ける大きさ（u）。そちらを変えたらここも合わせる */
export const illustSize = (count: number): number => (count <= 3 ? 12 : count <= 10 ? 8 : 6);

interface FigLike {
  kind?: string;
  count?: number;
  gap?: number;
  items?: unknown[];
}

/** 図の中の絵のまとまり（絵だけの図のとき）と、まとまりの間のすき間（u）。絵のほかが混じるときは null */
function groupsOf(fig: unknown): { groups: PicGroup[]; gap: number } | null {
  const f = fig as FigLike | undefined;
  if (!f || typeof f !== 'object') return null;
  if (f.kind === 'illust') {
    const n = Math.max(1, f.count ?? 1);
    return { groups: [{ n, cap: illustSize(n) }], gap: 0 };
  }
  if (f.kind === 'row' && Array.isArray(f.items) && f.items.length > 0) {
    const groups: PicGroup[] = [];
    for (const it of f.items) {
      const g = groupsOf(it);
      if (!g) return null;
      groups.push(...g.groups);
    }
    return { groups, gap: typeof f.gap === 'number' ? f.gap : 2 };
  }
  return null;
}

/**
 * 図が絵だけ（kind: 'illust'、または絵だけを並べた kind: 'row'）なら、その絵の情報。それ以外（時計・図・文字・表など）は null
 * （寸法の計算の対象にしない。今までどおり choice.css の式に任せる）
 */
export function picSpecOf(fig: unknown): PicSpec | null {
  const g = groupsOf(fig);
  if (!g) return null;
  const caps = g.groups.map((x) => x.cap);
  return {
    n: g.groups.reduce((a, x) => a + x.n, 0),
    groups: g.groups,
    gap: g.groups.length > 1 ? g.gap : 0,
    cap: Math.max(...caps),
    minCap: Math.min(...caps),
  };
}

/** 選択肢の絵の情報。全部が絵だけの図のときだけ返す（そうでなければ null） */
export function picSpecsOf(options: readonly { figure?: unknown }[]): PicSpec[] | null {
  if (options.length === 0) return null;
  const out: PicSpec[] = [];
  for (const o of options) {
    const s = picSpecOf(o.figure);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

/** 数える札の問題か: 選択肢のどれかに、絵が 6 こ以上ある */
export const isCounting = (specs: readonly { n: number }[]): boolean =>
  specs.some((s) => s.n > PER_ROW);

/**
 * 札の中の絵の行。数える札の問題は、まとまりごとに 5 こずつ（まとまりは縦に積む）。
 * それ以外は、まとまりを 1 行に並べる（行の幅は絵の数の合計）。r: 1 行の絵の数（いちばん多い行）、k: 行の数
 */
export function picLines(spec: PicSpec, counting: boolean): { r: number; k: number } {
  if (!counting) return { r: spec.n, k: 1 };
  return {
    r: Math.max(...spec.groups.map((g) => Math.min(g.n, PER_ROW))),
    k: spec.groups.reduce((a, g) => a + Math.ceil(g.n / PER_ROW), 0),
  };
}

/** 並べ方。shape: 1 段か 2×2 の格子。ear: 聞く問題の「きく」の札の場所（聞く問題でなければ無し） */
export interface PicsArrange {
  shape: 'row' | 'grid';
  ear?: 'top' | 'left';
}

/** 測った札（px） */
export interface PicsCard extends PicSpec {
  /** 札の最小の幅（語のラベルの札の --word-min-w。無ければ 0） */
  minW: number;
  /** 札の左右の余白と枠 */
  padX: number;
  /** 札の最小の高さ */
  minH: number;
  /** 札のうち絵の下にある分（上下の余白と枠・ラベルの行・間隔） */
  below: number;
}

/** 並べる場所の寸法（px） */
export interface PicsEnv {
  /** 札を並べられる幅 */
  width: number;
  /** 札を並べられる高さ（作業領域の高さ − 列より上のもの − 影） */
  height: number;
  /** 札のすき間 */
  gapX: number;
  gapY: number;
  /** 絵と絵のすき間 */
  picGap: number;
  /** 1u の px（絵の大きさの上限・下限を u で持つため） */
  u: number;
}

/** 絵 r こを 1 行に並べた幅（絵の大きさ e ＋ すき間） */
const lineW = (r: number, e: number, env: PicsEnv) => r * e + (r - 1) * env.picGap;

/**
 * 札の幅（絵の列と余白。語のラベルの札は最小の幅以上）。s は絵の大きさの上限（px）。
 * 数える札は、まとまりごとの 5 こずつの行のうち いちばん広い行。そうでなければ まとまりを 1 行に並べた幅
 */
export function cardWidth(c: PicsCard, counting: boolean, s: number, env: PicsEnv): number {
  const e = (g: PicGroup) => Math.min(s, g.cap * env.u);
  const body = counting
    ? Math.max(...c.groups.map((g) => lineW(Math.min(g.n, PER_ROW), e(g), env)))
    : c.groups.reduce((a, g) => a + lineW(g.n, e(g), env), 0) +
      (c.groups.length - 1) * c.gap * env.u;
  return Math.max(c.minW, body + c.padX);
}

/**
 * 札の高さ（絵の行と、絵の下の分。最小の高さ以上）。数える札は まとまりを縦に積む（まとまりの間は STACK_GAP_U）。
 * そうでなければ 1 行の高さ（いちばん大きい絵）
 */
export function cardHeight(c: PicsCard, counting: boolean, s: number, env: PicsEnv): number {
  const e = (g: PicGroup) => Math.min(s, g.cap * env.u);
  const body = counting
    ? c.groups.reduce((a, g) => {
        const k = Math.ceil(g.n / PER_ROW);
        return a + k * e(g) + (k - 1) * env.picGap;
      }, 0) +
      (c.groups.length - 1) * STACK_GAP_U * env.u
    : Math.max(...c.groups.map(e));
  return Math.max(c.minH, body + c.below);
}

/**
 * s で並べたときの、札の幅の合計と高さの合計（px）。1 段は全部が 1 行、2×2 は 2 列（右の列は 2 つ目・4 つ目の札）。
 * 幅は 列ごとの札の幅の最大の合計 ＋ 列のすき間、高さは 行ごとの札の高さの最大の合計 ＋ 行のすき間
 */
export function layoutSize(
  cards: readonly PicsCard[],
  shape: 'row' | 'grid',
  s: number,
  env: PicsEnv,
): { w: number; h: number } {
  const counting = isCounting(cards);
  const cols = shape === 'grid' ? Math.min(2, cards.length) : cards.length;
  const colW: number[] = Array.from({ length: cols }, () => 0);
  const rowH: number[] = [];
  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colW[col] = Math.max(colW[col]!, cardWidth(c, counting, s, env));
    rowH[row] = Math.max(rowH[row] ?? 0, cardHeight(c, counting, s, env));
  });
  return {
    w: colW.reduce((a, x) => a + x, 0) + (cols - 1) * env.gapX,
    h: rowH.reduce((a, x) => a + x, 0) + (rowH.length - 1) * env.gapY,
  };
}

/** s で並べると、幅と高さが収まるか */
export function fits(
  cards: readonly PicsCard[],
  shape: 'row' | 'grid',
  s: number,
  env: PicsEnv,
): boolean {
  const { w, h } = layoutSize(cards, shape, s, env);
  return w <= env.width + 0.01 && h <= env.height + 0.01;
}

/**
 * 幅・高さが収まる最大の絵の大きさ s（px。2 分探索。上限 PIC_MAX_U・下限 PIC_MIN_U）。
 * 絵を下限まで小さくしても収まらないとき（札の最小の幅・高さが空きより大きい）は、絵が小さいうちは変わらない札の寸法
 * （最小の幅・高さ）を空きとみなして、それを増やさない最大の s にする（絵を 1u にまで潰さない。収まらない分は作業領域の
 * スクロールが残り、検査に出る）
 */
export function solveS(cards: readonly PicsCard[], shape: 'row' | 'grid', env: PicsEnv): number {
  return solveFit(cards, shape, env).s;
}

/** solveS と、絵を下限にしても収まるか（ok。収まらない並べ方は、並べ方を選ぶときに後回しにする） */
export function solveFit(
  cards: readonly PicsCard[],
  shape: 'row' | 'grid',
  env: PicsEnv,
): { s: number; ok: boolean } {
  const lo0 = PIC_MIN_U * env.u;
  const hi0 = PIC_MAX_U * env.u;
  const base = layoutSize(cards, shape, lo0, env);
  const ok = base.w <= env.width + 0.01 && base.h <= env.height + 0.01;
  const limit: PicsEnv = {
    ...env,
    width: Math.max(env.width, base.w),
    height: Math.max(env.height, base.h),
  };
  if (fits(cards, shape, hi0, limit)) return { s: hi0, ok };
  let lo = lo0;
  let hi = hi0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(cards, shape, mid, limit)) lo = mid;
    else hi = mid;
  }
  return { s: lo, ok };
}

/** 札の幅（px）。--card-w に書く（0.1px 単位に切り上げる。切り捨てると 1 行に並べた絵がわずかに入らず折れる） */
export function cardWidths(cards: readonly PicsCard[], s: number, env: PicsEnv): number[] {
  const counting = isCounting(cards);
  return cards.map((c) => Math.ceil(cardWidth(c, counting, s, env) * 10) / 10);
}

/** 並べ方の候補と、その s（px）。ok: 絵を下限にしても収まる（false は、札の最小の幅・高さが空きより大きい） */
export interface PicsOption extends PicsArrange {
  s: number;
  ok?: boolean;
}

/**
 * 並べ方を選ぶ。収まる並べ方（ok）のうち s が最大のもの（絵の既定の大きさ以上は同じとみなす。どれも収まらないときは
 * s が最大のもの）。同じなら、今の並べ方、なければ先頭（初めの並べ方）。
 * 今の並べ方から替えるのは、収まらない並べ方から収まる並べ方へ替えるとき、またははっきり大きくなる（SWITCH_RATIO 倍）ときだけ。
 */
export function chooseArrange(
  options: readonly PicsOption[],
  current: PicsArrange,
  capPx: number,
): PicsOption {
  const eff = (o: PicsOption) => Math.min(o.s, capPx);
  const okOf = (o: PicsOption) => o.ok !== false;
  const same = (o: PicsOption) => o.shape === current.shape && o.ear === current.ear;
  const cur = options.find(same) ?? options[0]!;
  let best = cur;
  for (const o of options) {
    if (okOf(o) !== okOf(best)) {
      if (okOf(o)) best = o;
    } else if (eff(o) > eff(best) + 0.01) best = o;
  }
  if (best === cur) return cur;
  // 収まらない並べ方から収まる並べ方へは、大きさに関わらず替える。収まる同士は、はっきり大きくなるときだけ
  if (okOf(best) === okOf(cur) && eff(best) < eff(cur) * SWITCH_RATIO) return cur;
  return best;
}
