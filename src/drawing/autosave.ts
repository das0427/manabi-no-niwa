/**
 * 自動保存（architecture.md 7.4、review-1 #9 #33）。描画基盤に依存しない状態機械（テストできる）。
 * - 操作の区切り（touch）から 1.5 秒後に保存する（閲覧用・縮小の画像もこのとき作る）
 * - 待っている間に、変わった層の画像（PNG）を先に作る（prepare）。作り終えたら、アイテムの JSON・
 *   その画像・ダーティ印を「下書き」として書いておく。1.5 秒を待たずにページが閉じられても、
 *   再開時に「つくりかけ」として開ける（Chromium はページを離れるときの IndexedDB の書き込みを
 *   打ち切るため、pagehide だけには頼らない。E2E で確認）
 * - pagehide / visibilitychange(hidden) では、アイテムの JSON とダーティ印だけを書く（quick）
 * - 別のタブが新しく保存していたら（updatedAt が新しい）保存を止め、'conflict' にする
 * - 書き込みは1本の列に並べる（同時に2つ書かない）
 */
import type { ArtworkBlobKind, ArtworkRecord } from '../core/types';
import type { CheckedSaveResult } from '../core/storage/repo-v2';

export const AUTOSAVE_DELAY_MS = 1500;

export type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

type Blobs = Partial<Record<ArtworkBlobKind, Blob>>;

/** ある時点の文書から作った保存の材料（変わった層の画像は作り終えている） */
export interface Prepared {
  rev: number;
  /** updatedAt と dirty を入れて作品の記録を作る */
  record(updatedAt: number, dirty: boolean): ArtworkRecord;
  blobs: Blobs;
  /** 保存後に残す画像の種類（これ以外は消す） */
  keep: ArtworkBlobKind[];
}

export interface QuickPayload {
  record(updatedAt: number, dirty: boolean): ArtworkRecord;
  blobs: Blobs;
}

export interface AutoSaverDeps {
  delayMs?: number;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(h: unknown): void;
  /** いまの文書の rev */
  rev(): number;
  /** いまの文書の、変わった層の画像を作る */
  prepare(): Promise<Prepared>;
  /** 閲覧用（full）と縮小（thumb）の画像を作る（1.5 秒後の保存のときだけ） */
  preview?(): Promise<Blobs>;
  /** ページを閉じるときの材料（同期。先に作ってある画像があれば使う） */
  quick(prepared: Prepared | null): QuickPayload;
  write(
    rec: ArtworkRecord,
    blobs: Blobs,
    opts: { expectUpdatedAt: number | null; keep?: ArtworkBlobKind[] },
  ): Promise<CheckedSaveResult>;
  /** 書けたとき（作った画像を基盤に知らせる。下書きでも呼ぶ） */
  onSaved?(p: Prepared | null, updatedAt: number): void;
  /** 初めて書けたとき（navigator.storage.persist の要求に使う） */
  onFirstSave?(): void;
  onState?(s: SaveState): void;
}

export class AutoSaver {
  state: SaveState = 'clean';
  /** 自分が最後に書いた（または開いたときの）updatedAt。null = まだ保存していない新しい作品 */
  knownUpdatedAt: number | null;
  private timer: unknown = null;
  /** ダーティ印なしで保存した rev */
  private savedRev: number;
  /** 下書き（ダーティ印つき）を書いた rev */
  private draftRev = -1;
  private prepared: { rev: number; p: Promise<Prepared> } | null = null;
  private lastPrepared: Prepared | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private firstDone = false;
  private stopped = false;
  /** 書き込み中の updatedAt（pageHide が自分の書き込みを「別のタブ」と取り違えないため） */
  private inflight: number | null = null;

  constructor(
    private readonly d: AutoSaverDeps,
    opts: { knownUpdatedAt: number | null; savedRev: number },
  ) {
    this.knownUpdatedAt = opts.knownUpdatedAt;
    this.savedRev = opts.savedRev;
    this.firstDone = opts.knownUpdatedAt !== null;
  }

  private set(s: SaveState): void {
    if (this.state === s) return;
    this.state = s;
    this.d.onState?.(s);
  }

  /** 操作の区切り。1.5秒後の保存を予約し、画像づくり（と下書き）を先に始める */
  touch(): void {
    if (this.stopped) return;
    if (this.d.rev() === this.savedRev) return;
    this.set('pending');
    this.startPrepare();
    if (this.timer !== null) this.d.clearTimer(this.timer);
    this.timer = this.d.setTimer(() => {
      this.timer = null;
      void this.save();
    }, this.d.delayMs ?? AUTOSAVE_DELAY_MS);
  }

  private startPrepare(): Promise<Prepared> {
    const rev = this.d.rev();
    if (this.prepared?.rev === rev) return this.prepared.p;
    const p = this.d.prepare();
    this.prepared = { rev, p };
    p.then(
      (x) => {
        if (!this.lastPrepared || x.rev >= this.lastPrepared.rev) this.lastPrepared = x;
        if (x.rev === this.d.rev()) this.writeDraft(x);
      },
      () => {},
    );
    return p;
  }

  private nextUpdatedAt(): number {
    return Math.max(this.d.now(), (this.knownUpdatedAt ?? 0) + 1);
  }

  private enqueue(run: () => Promise<void>): Promise<void> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  /** 1回の書き込み（updatedAt の確認つき）。結果に応じて状態を進める */
  private async writeOnce(
    rec: (updatedAt: number) => ArtworkRecord,
    blobs: Blobs,
    keep: ArtworkBlobKind[] | undefined,
  ): Promise<{ ok: boolean; updatedAt: number }> {
    const updatedAt = this.nextUpdatedAt();
    this.inflight = updatedAt;
    let res: CheckedSaveResult;
    try {
      res = await this.d.write(rec(updatedAt), blobs, {
        expectUpdatedAt: this.knownUpdatedAt,
        keep,
      });
    } finally {
      this.inflight = null;
    }
    if (res === 'conflict') {
      this.stop();
      return { ok: false, updatedAt };
    }
    if (res === 'error') return { ok: false, updatedAt };
    // pageHide が先に新しい updatedAt を書いていることがある（大きい方を覚える）
    this.knownUpdatedAt = Math.max(updatedAt, this.knownUpdatedAt ?? 0);
    if (!this.firstDone) {
      this.firstDone = true;
      this.d.onFirstSave?.();
    }
    return { ok: true, updatedAt };
  }

  /** 下書き: アイテムの JSON・作り終えた層の画像・ダーティ印 */
  private writeDraft(p: Prepared): void {
    void this.enqueue(async () => {
      if (this.stopped || p.rev <= this.savedRev || p.rev <= this.draftRev) return;
      if (p.rev !== this.d.rev()) return; // もう次の操作をした（次の下書きに任せる）
      const r = await this.writeOnce((u) => p.record(u, true), p.blobs, undefined);
      if (r.ok) {
        this.draftRev = p.rev;
        this.d.onSaved?.(p, r.updatedAt);
      }
    });
  }

  /** 今すぐ保存する（予約を取り消して）。画面を離れるときに待つ */
  flush(): Promise<void> {
    if (this.timer !== null) {
      this.d.clearTimer(this.timer);
      this.timer = null;
    }
    return this.save();
  }

  private save(): Promise<void> {
    return this.enqueue(async () => {
      if (this.stopped) return;
      if (this.d.rev() === this.savedRev) {
        if (this.state === 'pending') this.set('saved');
        return;
      }
      this.set('saving');
      let p: Prepared;
      let extra: Blobs;
      try {
        p = await this.startPrepare();
        extra = (await this.d.preview?.()) ?? {};
      } catch {
        this.set('error');
        return;
      }
      if (this.stopped) return;
      // 下書きで画像を書いた rev なら、画像は書き直さない
      const blobs: Blobs = { ...(this.draftRev === p.rev ? {} : p.blobs), ...extra };
      const r = await this.writeOnce((u) => p.record(u, false), blobs, p.keep);
      if (!r.ok) {
        if (!this.stopped) this.set('error');
        return;
      }
      this.savedRev = p.rev;
      this.d.onSaved?.(p, r.updatedAt);
      if (this.d.rev() !== p.rev)
        this.touch(); // 保存の間にまた描いた
      else this.set('saved');
    });
  }

  /**
   * ページを閉じる・隠れるとき（同期で書き込みを始める）。未保存の変更があれば、
   * アイテムの JSON とダーティ印、作り終えた画像だけを書く。
   */
  pageHide(): void {
    const rev = this.d.rev();
    if (this.stopped || rev === this.savedRev || rev === this.draftRev) return;
    const prepared = this.lastPrepared && this.lastPrepared.rev === rev ? this.lastPrepared : null;
    const q = this.d.quick(prepared);
    const expect =
      this.inflight !== null
        ? Math.max(this.inflight, this.knownUpdatedAt ?? 0)
        : this.knownUpdatedAt;
    const updatedAt = Math.max(this.nextUpdatedAt(), (expect ?? 0) + 1);
    // 書いたものとして扱う（閉じなかった場合も次の保存が conflict にならないよう）
    this.knownUpdatedAt = updatedAt;
    const write = this.d.write(q.record(updatedAt, true), q.blobs, { expectUpdatedAt: expect });
    this.queue = this.queue.then(() => write).catch(() => {});
    void write.then((res) => {
      if (res === 'conflict') this.stop();
      else if (res === 'ok' && !this.firstDone) {
        this.firstDone = true;
        this.d.onFirstSave?.();
      }
    });
  }

  /** 別のタブが保存した（このタブの保存を止める） */
  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      this.d.clearTimer(this.timer);
      this.timer = null;
    }
    this.set('conflict');
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  dispose(): void {
    if (this.timer !== null) this.d.clearTimer(this.timer);
    this.timer = null;
  }
}
