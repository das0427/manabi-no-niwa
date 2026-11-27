import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStateValue } from './AppState';
import { defaultSettings, type Profile, type UnitProgress } from '../core/types';

/**
 * 小学生ホームのおすすめの札（text-layout-fixes「アプリの画面」A3）。
 * 「ふくしゅう」は題の中の字の札ではなく、絵の右下の時計の印。題は AppLabel（中身の段階で折る）。
 * 札に入るまで縮める値は、実際の大きさが要るので e2e・検査（check:text-layout）で見る。ここでは作りだけを見る。
 */
const h = vi.hoisted(() => ({ app: {} as unknown, progress: [] as unknown[] }));
vi.mock('./AppState', () => ({ useApp: () => h.app }));
vi.mock('./router', () => ({ navigate: vi.fn() }));
vi.mock('../core/storage/index', () => ({
  listUnitProgress: vi.fn(async () => h.progress),
  // 記録の保存の状態（StorageHealthMark。FX16）。ここでは問題なし
  getStorageHealth: () => 'ok',
  onStorageHealth: () => () => undefined,
}));

import { SchoolHome } from './SchoolHome';

const DAY = 24 * 60 * 60 * 1000;

function progressRow(
  unitId: string,
  review: UnitProgress['review'],
  at = Date.now(),
): UnitProgress {
  return {
    profileId: 'p1',
    unitId,
    level: 0,
    window: [],
    mastered: false,
    attempted: true,
    changedAt: at,
    lastChange: null,
    review,
  };
}

function setup(textScale: 1 | 1.15 | 1.3) {
  const now = Date.now();
  const profile: Profile = {
    id: 'p1',
    name: 'こども',
    avatar: 'rabbit',
    createdAt: 0,
    audience: 'g3',
    enrolledGrade: 3,
  };
  const base = defaultSettings('p1', 'g3');
  h.app = {
    ready: true,
    profile,
    settings: { ...base, support: { ...base.support, textScale, furigana: 'all' } },
    favorites: [],
  } as unknown as AppStateValue;
  const due: UnitProgress['review'] = {
    stage: 'learned',
    reviewStep: 0,
    reviewDue: now - DAY,
    lastReviewAt: now - 2 * DAY,
  };
  h.progress = [
    progressRow('g3.math.large-numbers', due),
    progressRow('g3.en.alphabet-upper', due),
    progressRow('g3.ja.reference-connectives', {
      stage: 'learning',
      reviewStep: 0,
      reviewDue: null,
      lastReviewAt: null,
    }),
  ];
}

afterEach(() => cleanup());

describe('小学生ホームのおすすめの札', () => {
  it('ふくしゅうの札は、絵の右下に時計の印（aria-label「ふくしゅう」）を持ち、題の中に字の札を出さない', async () => {
    setup(1);
    render(<SchoolHome />);
    const review = await screen.findByTestId('rec-g3.math.large-numbers');
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="rec-"]').length).toBe(3));
    // 時計の印は絵の箱（.school-rec__icon）の中。題（.school-rec__name）の中ではない
    const mark = review.querySelector('.school-rec__icon .umark--review-due');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('aria-label')).toBe('ふくしゅう');
    expect(review.querySelector('.school-rec__name .umark')).toBeNull();
    expect(review.getAttribute('aria-label')).toContain('ふくしゅう');
    // 字の札（.school-rec__tag）はやめた
    expect(document.querySelector('.school-rec__tag')).toBeNull();
    // ふくしゅうでない札（つづき）には印を出さない
    const cont = screen.getByTestId('rec-g3.ja.reference-connectives');
    expect(cont.querySelector('.umark')).toBeNull();
    expect(cont.getAttribute('aria-label')).not.toContain('ふくしゅう');
  });

  it('題は AppLabel（単元の段階で折る）。画面の根に data-stage と、文字の大きさの設定（--ts）', async () => {
    setup(1.3);
    render(<SchoolHome />);
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="rec-"]').length).toBe(3));
    const root = screen.getByTestId('school-home');
    expect(root.getAttribute('data-stage')).toBe('g3');
    expect(root.style.getPropertyValue('--ts')).toBe('1.3');
    // 空白で区切って書いた題は data-spaced、そうでなければ文節で折る（data-phrase）
    const names = (id: string) =>
      screen.getByTestId(id).querySelector('.school-rec__name.app-label') as HTMLElement;
    expect(names('rec-g3.math.large-numbers').hasAttribute('data-spaced')).toBe(true);
    expect(names('rec-g3.ja.reference-connectives').hasAttribute('data-phrase')).toBe(true);
    // 教科の札の名前も AppLabel
    expect(
      screen.getByTestId('subject-math').querySelector('.school-subject__name.app-label'),
    ).not.toBeNull();
  });
});
