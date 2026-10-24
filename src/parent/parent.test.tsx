import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import * as db from '../core/storage/index';
import ParentApp from './index';
import { readFileText } from './util';

let blobs: Blob[] = [];

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return 'blob:test';
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});

afterEach(() => {
  cleanup();
});

async function seedProfile(name = 'こども') {
  const p = await db.createProfile(name, 'cat');
  await db.addAttempt({
    profileId: p.id,
    modeId: 'math',
    variantId: 'add',
    skillId: 'add',
    level: 0,
    itemKey: '1+1',
    outcome: 'independent',
    wrongTries: 0,
    hintsUsed: 0,
    reviewsUsed: 0,
    operationIssue: false,
    inputKind: 'mouse',
    at: Date.now(),
  });
  return p;
}

async function show(tab: string) {
  render(
    <AppStateProvider>
      <ParentApp tab={tab} />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(`tab-${tab}`)).toBeTruthy());
}

describe('データ: 書き出し→読み込み', () => {
  it('全体を書き出し、プロフィールとして追加できる', async () => {
    await seedProfile('はな');
    await show('data');
    fireEvent.click(screen.getByTestId('export-all'));
    await waitFor(() => expect(blobs.length).toBe(1));
    const text = await readFileText(blobs[0]!);
    expect(JSON.parse(text).format).toBe('manabi-no-niwa-backup');

    const file = new File([text], 'b.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeTruthy());
    expect(screen.getByTestId('import-preview').textContent).toContain('はな');
    fireEvent.click(screen.getByTestId('import-add'));
    await waitFor(async () => expect((await db.listProfiles()).length).toBe(2));
    const names = (await db.listProfiles()).map((p) => p.name);
    expect(names).toContain('はな（2）');
    const added = (await db.listProfiles()).find((p) => p.name === 'はな（2）')!;
    expect((await db.listAttempts(added.id)).length).toBe(1);
  });

  it('不正なファイルでは何も変わらず理由を表示する', async () => {
    await seedProfile('はな');
    await show('data');
    const before = await db.listProfiles();
    const file = new File(['これはJSONではありません'], 'x.json');
    fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-error')).toBeTruthy());
    expect(screen.getByTestId('import-error').textContent).toContain('何も変更していません');
    expect(screen.queryByTestId('import-add')).toBeNull();
    expect(await db.listProfiles()).toEqual(before);
  });
});

describe('プロフィール', () => {
  it('削除は名前を入力するまで押せず、最後の1人は削除できない', async () => {
    const a = await seedProfile('はな');
    const b = await seedProfile('たろう');
    await show('profiles');
    fireEvent.click(screen.getByTestId(`profile-delete-${b.id}`));
    const ok = screen.getByTestId('confirm-ok') as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('confirm-input'), { target: { value: 'たろ' } });
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('confirm-input'), { target: { value: 'たろう' } });
    expect(ok.disabled).toBe(false);
    fireEvent.click(ok);
    await waitFor(async () => expect((await db.listProfiles()).map((p) => p.id)).toEqual([a.id]));
    await waitFor(() =>
      expect((screen.getByTestId(`profile-delete-${a.id}`) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
  });
});

describe('せってい', () => {
  it('段階の固定が progress と settings に反映される', async () => {
    const p = await seedProfile();
    await show('settings');
    const select = await screen.findByTestId('level-select-add');
    fireEvent.change(select, { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('level-lock-add'));
    await waitFor(async () => expect((await db.getProgress(p.id, 'add')).level).toBe(2));
    expect((await db.getSettings(p.id)).levelLocks.add).toBe(2);
    expect((await db.getProgress(p.id, 'add')).lastChange?.reason).toBe('parent');

    fireEvent.click(screen.getByTestId('level-lock-add'));
    await waitFor(async () => expect((await db.getSettings(p.id)).levelLocks.add).toBeUndefined());
    expect((await db.getProgress(p.id, 'add')).level).toBe(2);
  });

  it('音量とほかの設定がすぐ保存される', async () => {
    const p = await seedProfile();
    await show('settings');
    fireEvent.change(screen.getByTestId('setting-sessionMinutes'), { target: { value: '20' } });
    await waitFor(async () => expect((await db.getSettings(p.id)).sessionMinutes).toBe(20));
    fireEvent.change(screen.getByTestId('setting-volume'), { target: { value: '30' } });
    await waitFor(async () => expect((await db.getSettings(p.id)).volume).toBeCloseTo(0.3));
  });
});

describe('きろく', () => {
  it('未実施と記録ありを区別して表示する', async () => {
    await seedProfile();
    await show('records');
    await waitFor(() => expect(screen.getByTestId('skill-table')).toBeTruthy());
    expect(screen.getByTestId('skill-shop').getAttribute('data-state')).toBe('not-started');
    expect(screen.getByTestId('recent-table').textContent).toContain('1+1');
  });
});
