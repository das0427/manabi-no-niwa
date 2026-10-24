import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckedSaveResult } from '../core/storage/repo-v2';
import type { ArtworkRecord } from '../core/types';
import { AUTOSAVE_DELAY_MS, AutoSaver, type Prepared, type SaveState } from './autosave';

/** 1つの「DB」（updatedAt の確認つき書き込みの再現）を2つのタブで共有する */
class FakeDb {
  rec: ArtworkRecord | null = null;
  writes: { updatedAt: number; dirty: boolean; blobs: string[] }[] = [];
  async write(
    rec: ArtworkRecord,
    blobs: Record<string, Blob>,
    opts: { expectUpdatedAt: number | null },
  ): Promise<CheckedSaveResult> {
    await Promise.resolve();
    const cur = this.rec;
    if (cur && (opts.expectUpdatedAt === null || cur.updatedAt > opts.expectUpdatedAt)) {
      return 'conflict';
    }
    this.rec = rec;
    this.writes.push({
      updatedAt: rec.updatedAt,
      dirty: (rec.doc as { dirty?: boolean }).dirty === true,
      blobs: Object.keys(blobs),
    });
    return 'ok';
  }
}

function tab(dbx: FakeDb, opts: { known: number | null; clock: () => number }) {
  let rev = 0;
  const states: SaveState[] = [];
  let prepares = 0;
  const saver = new AutoSaver(
    {
      now: opts.clock,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      rev: () => rev,
      prepare: async (): Promise<Prepared> => {
        prepares++;
        const r = rev;
        await Promise.resolve();
        return {
          rev: r,
          blobs: { 'ink:L': new Blob(['x']) },
          keep: ['ink:L', 'full'],
          record: (updatedAt, dirty) => ({
            id: 'a1',
            profileId: 'p',
            title: 't',
            createdAt: 0,
            updatedAt,
            doc: dirty ? { rev: r, dirty: true } : { rev: r },
          }),
        };
      },
      preview: async () => ({ full: new Blob(['f']) }),
      quick: (p) => ({
        record: (updatedAt, dirty) => ({
          id: 'a1',
          profileId: 'p',
          title: 't',
          createdAt: 0,
          updatedAt,
          doc: { rev, dirty },
        }),
        blobs: p ? p.blobs : {},
      }),
      write: (r, b, o) => dbx.write(r, b as Record<string, Blob>, o),
      onState: (s) => states.push(s),
    },
    { knownUpdatedAt: opts.known, savedRev: 0 },
  );
  return {
    saver,
    states,
    edit() {
      rev++;
      saver.touch();
    },
    get prepares() {
      return prepares;
    },
  };
}

describe('自動保存（review-1 #9）', () => {
  let t = 1000;
  const clock = () => t;
  beforeEach(() => {
    vi.useFakeTimers();
    t = 1000;
  });
  afterEach(() => vi.useRealTimers());
  const finals = (d: FakeDb) => d.writes.filter((w) => !w.dirty);

  it('操作の区切りから 1.5 秒後に保存する。待っている間に画像を作り、下書き（ダーティ印つき）を書く', async () => {
    const dbx = new FakeDb();
    const a = tab(dbx, { known: null, clock });
    a.edit();
    expect(a.saver.state).toBe('pending');
    expect(a.prepares).toBe(1); // すぐに作り始める
    await vi.advanceTimersByTimeAsync(10);
    expect(dbx.writes).toEqual([{ updatedAt: 1000, dirty: true, blobs: ['ink:L'] }]);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 200);
    a.edit(); // また描いた → 予約し直し
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(finals(dbx)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(finals(dbx)).toHaveLength(1);
    // 下書きで層の画像を書いた後なので、本保存は閲覧用の画像だけ
    expect(dbx.writes.at(-1)).toMatchObject({ dirty: false, blobs: ['full'] });
    expect(a.saver.state).toBe('saved');
    expect(a.states).toEqual(['pending', 'saving', 'saved']);
  });

  it('ページを閉じるときは JSON とダーティ印だけ（作り終えた画像があれば一緒に）', async () => {
    const dbx = new FakeDb();
    const a = tab(dbx, { known: null, clock });
    a.edit();
    a.saver.pageHide(); // 画像を作り終える前
    await vi.advanceTimersByTimeAsync(0);
    expect(dbx.writes[0]).toEqual({ updatedAt: 1000, dirty: true, blobs: [] });
    // 閉じなかった（隠しただけ）ときは、下書き → 本保存へ進み、ダーティ印が消える
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(dbx.writes.at(-1)).toMatchObject({ dirty: false });
    expect(a.saver.state).toBe('saved');
    expect(dbx.rec!.doc).not.toHaveProperty('dirty');
  });

  it('同じ作品を2つのタブで開いたら、古い方のタブの保存を止める（review-1 #33）', async () => {
    const dbx = new FakeDb();
    dbx.rec = { id: 'a1', profileId: 'p', title: 't', createdAt: 0, updatedAt: 500, doc: {} };
    const a = tab(dbx, { known: 500, clock });
    const b = tab(dbx, { known: 500, clock });
    a.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(a.saver.state).toBe('saved');
    const n = dbx.writes.length;
    t += 10;
    b.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(b.saver.state).toBe('conflict');
    expect(b.saver.isStopped).toBe(true);
    expect(dbx.writes).toHaveLength(n); // b は書いていない
    // 止まったタブはそれ以降も書かない
    b.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    b.saver.pageHide();
    await vi.advanceTimersByTimeAsync(0);
    expect(dbx.writes).toHaveLength(n);
    // a は続けて保存できる
    a.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(dbx.writes.length).toBeGreaterThan(n);
    expect(a.saver.state).toBe('saved');
  });

  it('時計が戻っても updatedAt は増え続ける', async () => {
    const dbx = new FakeDb();
    const a = tab(dbx, { known: null, clock });
    a.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    t = 10;
    a.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(dbx.writes.map((w) => w.updatedAt)).toEqual([1000, 1001, 1002, 1003]);
    expect(a.saver.state).toBe('saved');
  });

  it('自分の書き込みの最中にページを隠しても、自分を「別のタブ」と取り違えない', async () => {
    const dbx = new FakeDb();
    const a = tab(dbx, { known: null, clock });
    a.edit();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    a.edit();
    void a.saver.flush(); // 書き込み中
    a.edit();
    a.saver.pageHide();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(a.saver.state).not.toBe('conflict');
    expect(dbx.writes.at(-1)!.dirty).toBe(false);
  });

  it('flush は予約を待たずに保存する', async () => {
    const dbx = new FakeDb();
    const a = tab(dbx, { known: null, clock });
    a.edit();
    await a.saver.flush();
    expect(finals(dbx)).toHaveLength(1);
    expect(a.saver.state).toBe('saved');
  });
});
