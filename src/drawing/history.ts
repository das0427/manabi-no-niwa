/**
 * 取り消し・やり直し（architecture.md 7.3、X-SV-09）。
 * 上限は 50手 かつ 合計 64MB（差分の画素のバイト数で数える）。超えたら古い手から捨てる。
 * 再起動後の undo は持たない（メモリ上だけ）。
 */
export interface Command {
  /** 何の操作か（線・塗り・消し・はんこ・図形・移動・変形・削除・重なり順・焼き付け） */
  label: string;
  /** この手が持つ差分のバイト数（画素の差分。オブジェクトだけの手は小さな値） */
  bytes: number;
  undo(): void;
  redo(): void;
  /** 履歴から捨てられたとき（古くて捨てた・やり直しの枝を捨てた）。持っている資源を放す */
  dispose?(): void;
}

export const MAX_STEPS = 50;
export const MAX_BYTES = 64 * 1024 * 1024;

export class History {
  private done: Command[] = [];
  private undone: Command[] = [];
  private total = 0;

  constructor(
    readonly maxSteps = MAX_STEPS,
    readonly maxBytes = MAX_BYTES,
  ) {}

  push(c: Command): void {
    for (const u of this.undone) {
      this.total -= u.bytes;
      u.dispose?.();
    }
    this.undone = [];
    this.done.push(c);
    this.total += c.bytes;
    // 古い手から捨てる（最新の1手は大きくても残す）
    while (
      this.done.length > 1 &&
      (this.done.length > this.maxSteps || this.total > this.maxBytes)
    ) {
      const old = this.done.shift()!;
      this.total -= old.bytes;
      old.dispose?.();
    }
  }

  undo(): Command | null {
    const c = this.done.pop();
    if (!c) return null;
    c.undo();
    this.undone.push(c);
    return c;
  }

  redo(): Command | null {
    const c = this.undone.pop();
    if (!c) return null;
    c.redo();
    this.done.push(c);
    return c;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    return this.undone.length > 0;
  }
  get steps(): number {
    return this.done.length;
  }
  /** やり直し分を含めた合計バイト数 */
  get bytes(): number {
    return this.total;
  }
  clear(): void {
    this.done = [];
    this.undone = [];
    this.total = 0;
  }
}
