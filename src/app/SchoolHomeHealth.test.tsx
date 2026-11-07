import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStateValue } from './AppState';
import { defaultSettings, type Profile } from '../core/types';

/**
 * 小学生ホームの「!」（FX16・P-12）。記録の保存に問題があるとき、v1 のホームと同じ保護者向けの印を鍵の左に出す。
 * 前は、この印がたどり着かない v1 のホーム（Home.tsx の幼児用の旧い分岐）にだけあり、
 * 幼児ホーム・小学生ホームでは容量いっぱいの保存失敗に保護者が気づけなかった。
 * 保存の状態は本物（core/storage/db の setHealth で動かす）。IndexedDB の読み書きだけ差し替える。
 */
const h = vi.hoisted(() => ({ app: {} as unknown }));
vi.mock('./AppState', () => ({ useApp: () => h.app }));
vi.mock('./router', () => ({ navigate: vi.fn() }));
vi.mock('../core/storage/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/storage/index')>()),
  listUnitProgress: vi.fn(async () => []),
}));

import { setHealth } from '../core/storage/db';
import { SchoolHome } from './SchoolHome';

function setup() {
  const profile: Profile = {
    id: 'p1',
    name: 'こども',
    avatar: 'rabbit',
    createdAt: 0,
    audience: 'g3',
    enrolledGrade: 3,
  };
  h.app = {
    ready: true,
    profile,
    settings: defaultSettings('p1', 'g3'),
    favorites: [],
  } as unknown as AppStateValue;
}

beforeEach(() => {
  setHealth('ok');
  setup();
});
afterEach(() => {
  cleanup();
  setHealth('ok');
});

describe('小学生ホームの保存の問題の「!」', () => {
  it('保存が使えるときは出さない', async () => {
    render(<SchoolHome />);
    await screen.findByTestId('school-home');
    expect(screen.queryByTestId('home-health')).toBeNull();
  });

  it.each(['full', 'error', 'unavailable'] as const)(
    '保存の状態が %s のとき、鍵の左に保護者向けの印を出す（押せない・文は aria-label）',
    async (state) => {
      setHealth(state);
      render(<SchoolHome />);
      const mark = await screen.findByTestId('home-health');
      // v1 の Home.tsx と同じ作り: 見た目は .home-health（home.css）、中身は「!」、読み上げは保護者向けの文
      expect(mark.className).toBe('home-health');
      expect(mark.textContent).toBe('!');
      expect(mark.getAttribute('role')).toBe('img');
      expect(mark.getAttribute('aria-label')).toBe(
        '（保護者の方へ）記録の保存に問題があります。保護者画面のデータを見てください',
      );
      // 押せない（ボタンでも、キーボードで届く物でもない。子供の操作を止めない）
      expect(mark.tagName).toBe('SPAN');
      expect(mark.closest('button, a, [tabindex]')).toBeNull();
      // 鍵（保護者ゲートのボタン）の左: 同じ箱（.home-top__right）の中で、鍵の直前
      const key = screen.getByTestId('parent-key');
      expect(mark.parentElement).toBe(key.parentElement);
      expect(mark.parentElement?.classList.contains('home-top__right')).toBe(true);
      expect(mark.nextElementSibling).toBe(key);
    },
  );

  it('保存の状態が変わると、出たり消えたりする（開いたまま）', async () => {
    render(<SchoolHome />);
    await screen.findByTestId('school-home');
    expect(screen.queryByTestId('home-health')).toBeNull();
    act(() => setHealth('full'));
    expect(screen.getByTestId('home-health')).toBeTruthy();
    act(() => setHealth('ok'));
    expect(screen.queryByTestId('home-health')).toBeNull();
  });
});
