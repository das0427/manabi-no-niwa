import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStateValue } from './AppState';
import { defaultSettings, type ChildSettings, type Profile } from '../core/types';
import { PRESCHOOL_HOMES } from '../curriculum/preschoolHome';

/**
 * 幼児ホームの「えいご」の札・「ほかの がくねん」の位置・Explore の札（設計書 8章・11.2）。
 * アプリの状態・保存・画面遷移は偽物にして、画面の出し分けだけを見る。
 */
const h = vi.hoisted(() => ({ app: {} as unknown, navigate: vi.fn() }));
vi.mock('./AppState', () => ({ useApp: () => h.app }));
vi.mock('./router', () => ({ navigate: h.navigate }));
vi.mock('../core/storage/index', () => ({
  listRounds: vi.fn(async () => []),
}));

import { Explore } from './Explore';
import { CardChooser } from './UnitEntry';
import { PreschoolHome } from './PreschoolHome';

function setApp(opts: {
  audience: 'toddler' | 'p4' | 'p5';
  stage?: 2 | 3;
  settings?: Partial<ChildSettings>;
}) {
  const profile: Profile = {
    id: 'p1',
    name: 'こども',
    avatar: 'rabbit',
    createdAt: 0,
    audience: opts.audience,
    ...(opts.stage ? { toddlerStage: opts.stage } : {}),
  };
  h.app = {
    ready: true,
    profile,
    settings: { ...defaultSettings('p1', opts.audience), ...opts.settings },
    favorites: [],
  } as unknown as AppStateValue;
}

beforeEach(() => {
  h.navigate.mockClear();
});
afterEach(() => cleanup());

const stageOf = (a: 'toddler' | 'p4' | 'p5') => (a === 'toddler' ? 'p23' : a);

function home(a: 'toddler' | 'p4' | 'p5') {
  return render(<PreschoolHome def={PRESCHOOL_HOMES[stageOf(a)]!} />);
}

describe('幼児ホームの「えいご」の札', () => {
  it('4歳・5歳・3歳段階のホームにある。「きょうの おすすめ」には入らない', async () => {
    for (const [audience, stage] of [
      ['p4', undefined],
      ['p5', undefined],
      ['toddler', 3],
    ] as const) {
      setApp({ audience, stage });
      home(audience);
      expect(screen.getByTestId('home-eigo').getAttribute('aria-label')).toBe('えいご');
      await waitFor(() =>
        expect(document.querySelectorAll('[data-testid^="home-rec-"]').length).toBeGreaterThan(0),
      );
      expect(screen.queryByTestId('home-rec-eigo')).toBeNull();
      cleanup();
    }
  });

  it('2歳段階のホームには出さない', () => {
    setApp({ audience: 'toddler', stage: 2 });
    home('toddler');
    expect(screen.queryByTestId('home-eigo')).toBeNull();
  });

  it('保護者の設定で隠せる（省略時は出す）', () => {
    setApp({ audience: 'p4', settings: { showPreschoolEnglish: false } });
    home('p4');
    expect(screen.queryByTestId('home-eigo')).toBeNull();
    cleanup();
    setApp({ audience: 'p4', settings: { showPreschoolEnglish: true } });
    home('p4');
    expect(screen.getByTestId('home-eigo')).toBeTruthy();
  });

  it('押すと、単元が複数なら選ぶ画面（card eigo）。3歳段階も words・move の2つなので選ぶ画面', () => {
    setApp({ audience: 'p4' });
    home('p4');
    screen.getByTestId('home-eigo').click();
    expect(h.navigate).toHaveBeenCalledWith({ name: 'card', stage: 'p4', cardId: 'eigo' });
    cleanup();
    h.navigate.mockClear();
    setApp({ audience: 'toddler', stage: 3 });
    home('toddler');
    screen.getByTestId('home-eigo').click();
    expect(h.navigate).toHaveBeenCalledWith({ name: 'card', stage: 'p23', cardId: 'eigo' });
  });

  it('「ほかの がくねん」は上の帯にある（2歳段階も）。押すと ほかの がくねん へ', () => {
    for (const [audience, stage] of [
      ['p4', undefined],
      ['toddler', 2],
    ] as const) {
      setApp({ audience, stage });
      const { container } = home(audience);
      const btn = screen.getByTestId('home-explore');
      expect(container.querySelector('.home-top')!.contains(btn)).toBe(true);
      expect(container.querySelector('.home-side')!.contains(btn)).toBe(false);
      btn.click();
      expect(h.navigate).toHaveBeenCalledWith({ name: 'explore' });
      cleanup();
    }
  });
});

describe('ほかの がくねん（Explore）の「えいご」の札', () => {
  it('2〜3さい・4さい・5さい のタブにある。2歳段階のプロフィール・設定で隠していても出す', () => {
    setApp({ audience: 'toddler', stage: 2, settings: { showPreschoolEnglish: false } });
    for (const st of ['p23', 'p4', 'p5']) {
      render(<Explore stage={st} />);
      expect(screen.getByTestId('explore-card-eigo')).toBeTruthy();
      cleanup();
    }
  });

  it('小学生の学年のタブには出ない', () => {
    setApp({ audience: 'p4' });
    render(<Explore stage="g3" />);
    expect(screen.queryByTestId('explore-card-eigo')).toBeNull();
  });
});

describe('えいごの選ぶ画面（CardChooser）', () => {
  it('えいごの札の単元（ready・partial）が並び、押すと単元が開く', () => {
    setApp({ audience: 'p4' });
    render(<CardChooser stage="p4" cardId="eigo" />);
    expect(screen.getByTestId('card-chooser-eigo')).toBeTruthy();
    for (const id of [
      'p4.en.words',
      'p4.en.colors-numbers',
      'p4.en.move',
      'p4.en.hello',
      'p4.en.picture-book',
      'p4.en.where',
    ])
      expect(screen.getByTestId(`card-unit-${id}`)).toBeTruthy();
    screen.getByTestId('card-unit-p4.en.hello').click();
    expect(h.navigate).toHaveBeenCalledWith({ name: 'unit', unitId: 'p4.en.hello' });
  });
});
