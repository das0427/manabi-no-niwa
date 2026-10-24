/**
 * はんこの SVG → 画像（キャンバス）のキャッシュ（review-1 #10）。
 * キーは（素材キー, 大きさの段階）。SVG には width/height=100 が付いている（Firefox の drawImage 対策）。
 * 読み込みは非同期。読み込み前は小さい段階か null を返し、読めたら onReady で描き直してもらう。
 */
const STEPS = [64, 128, 256, 512, 1024] as const;
/** 当たり判定（不透明な画素）に使う段階 */
const HIT_STEP = 128;

type Entry = { canvas: HTMLCanvasElement | null; loading: Promise<void> | null };

export function stepFor(px: number): number {
  for (const s of STEPS) if (s >= px) return s;
  return STEPS[STEPS.length - 1]!;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('stamp image failed'));
    };
    img.src = url;
  });
}

export class StampImages {
  private cache = new Map<string, Entry>();
  private hitData = new Map<string, Uint8ClampedArray>();

  constructor(private readonly onReady: () => void = () => {}) {}

  private key(asset: string, step: number): string {
    return `${asset}#${step}`;
  }

  private load(asset: string, svg: string, step: number): Promise<void> {
    const k = this.key(asset, step);
    let e = this.cache.get(k);
    if (e?.canvas) return Promise.resolve();
    if (e?.loading) return e.loading;
    e = { canvas: null, loading: null };
    this.cache.set(k, e);
    const entry = e;
    entry.loading = loadImage(svg)
      .then((img) => {
        const c = document.createElement('canvas');
        c.width = step;
        c.height = step;
        const ctx = c.getContext(
          '2d',
          step === HIT_STEP ? { willReadFrequently: true } : undefined,
        );
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, step, step);
        entry.canvas = c;
        if (step === HIT_STEP) {
          this.hitData.set(asset, ctx.getImageData(0, 0, step, step).data);
        }
        this.onReady();
      })
      .catch(() => {
        this.cache.delete(k);
      })
      .finally(() => {
        entry.loading = null;
      });
    return entry.loading;
  }

  /** 表示の一辺 px に合う画像。まだ無ければ読み込みを始め、ある中で一番近いものか null */
  get(asset: string, svg: string, px: number): HTMLCanvasElement | null {
    const step = stepFor(px);
    const exact = this.cache.get(this.key(asset, step))?.canvas;
    if (exact) return exact;
    void this.load(asset, svg, step);
    for (let i = STEPS.length - 1; i >= 0; i--) {
      const c = this.cache.get(this.key(asset, STEPS[i]!))?.canvas;
      if (c) return c;
    }
    return null;
  }

  /** 局所座標（0〜100）の不透明度。まだ読めていなければ 0 */
  alphaAt(asset: string, svg: string, lx: number, ly: number): number {
    const d = this.hitData.get(asset);
    if (!d) {
      void this.load(asset, svg, HIT_STEP);
      return 0;
    }
    const x = Math.min(HIT_STEP - 1, Math.max(0, Math.floor((lx / 100) * HIT_STEP)));
    const y = Math.min(HIT_STEP - 1, Math.max(0, Math.floor((ly / 100) * HIT_STEP)));
    return d[(y * HIT_STEP + x) * 4 + 3]!;
  }

  /** 書き出し・焼き付けの前に、必要な画像をそろえる */
  async ensure(assets: Record<string, string>, px: number): Promise<void> {
    const step = stepFor(px);
    await Promise.all(
      Object.entries(assets).flatMap(([a, svg]) => [
        this.load(a, svg, step),
        this.load(a, svg, HIT_STEP),
      ]),
    );
  }
}
