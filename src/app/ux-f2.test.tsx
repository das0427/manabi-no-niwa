import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStateValue } from './AppState';
import { defaultSettings, type Profile } from '../core/types';
import { PRESCHOOL_HOMES } from '../curriculum/preschoolHome';

/**
 * 使いやすさの直し（F2 幼児の入口。FX02・FX16）。
 *  - FX02: 札・遊び方の名前の声は、遷移のあとに鳴る（前は audio.play のすぐあとに navigate が audio.stop して、
 *    鳴り始める前に止まっていた）。本物のルーターを使い、audio の呼ばれた順を見る。
 *  - FX16: 保存に問題があるとき、幼児ホームにも v1 のホームと同じ「!」（鍵の左。部品は StorageHealthMark）を出す。
 */
const au = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../core/audio/index', () => ({
  audio: {
    play: vi.fn((seq: unknown) => {
      au.calls.push(`play:${JSON.stringify(seq)}`);
      return Promise.resolve('done');
    }),
    stop: vi.fn(() => {
      au.calls.push('stop');
    }),
  },
  useAudioState: () => ({ unlocked: true, speaking: false, health: 'ok', currentKeys: [] }),
}));

const st = vi.hoisted(() => ({
  health: 'ok' as 'ok' | 'full' | 'error' | 'unavailable',
  listeners: new Set<(h: string) => void>(),
}));
vi.mock('../core/storage/index', () => ({
  listRounds: vi.fn(async () => []),
  listProgress: vi.fn(async () => []),
  getDraft: vi.fn(async () => null),
  getStorageHealth: () => st.health,
  onStorageHealth: (cb: (h: string) => void) => {
    st.listeners.add(cb);
    return () => {
      st.listeners.delete(cb);
    };
  },
}));

const h = vi.hoisted(() => ({ app: {} as unknown }));
vi.mock('./AppState', () => ({ useApp: () => h.app }));

import { PreschoolHome } from './PreschoolHome';
import { useRoute } from './router';
import { LegacyEntry } from './UnitEntry';

function setHealth(next: 'ok' | 'full' | 'error' | 'unavailable') {
  st.health = next;
  for (const cb of [...st.listeners]) cb(next);
}

function setApp(audience: 'toddler' | 'p4' | 'p5', stage?: 2 | 3) {
  const profile: Profile = {
    id: 'p1',
    name: 'こども',
    avatar: 'rabbit',
    createdAt: 0,
    audience,
    ...(stage ? { toddlerStage: stage } : {}),
  };
  h.app = {
    ready: true,
    profile,
    settings: defaultSettings('p1', audience),
    favorites: [],
  } as unknown as AppStateValue;
}

/** ハッシュの変化を購読する（本物のルーターは useRoute の購読の中で hashchange のあとに声を鳴らす） */
function RouteProbe() {
  const r = useRoute();
  return <span data-testid="route">{r.name}</span>;
}

const playOf = (key: string) => `play:${JSON.stringify(key)}`;
/** 呼ばれた順の中で、最後の stop より後に鳴らしたか（= 止められない） */
function playedAfterLastStop(key: string): boolean {
  const i = au.calls.indexOf(playOf(key));
  return i >= 0 && i > au.calls.lastIndexOf('stop');
}

let clock = 1_000_000_000_000;
beforeEach(() => {
  au.calls.length = 0;
  st.health = 'ok';
  st.listeners.clear();
  // ルーターは 400ms 以内の連続の遷移を無視する（OP-05）。試験ごとに十分あける
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
  location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FX02: 札・遊び方の名前の声は遷移のあとに鳴る', () => {
  it('単元が1つの札（4さい おかいもの ごっこ）: 声は最後の stop のあとで、1回だけ', async () => {
    setApp('p4');
    render(
      <>
        <RouteProbe />
        <PreschoolHome def={PRESCHOOL_HOMES.p4!} />
      </>,
    );
    fireEvent.click(screen.getByTestId('home-mode-shopping'));
    await waitFor(() => expect(playedAfterLastStop('title.shopping')).toBe(true));
    expect(au.calls.filter((c) => c.startsWith('play:'))).toEqual([playOf('title.shopping')]);
    expect(location.hash).toMatch(/^#\/(legacy|unit)\//);
  });

  it('単元が2つ以上の札（4さい さんすう → 選ぶ画面）も、声は遷移のあと', async () => {
    setApp('p4');
    render(
      <>
        <RouteProbe />
        <PreschoolHome def={PRESCHOOL_HOMES.p4!} />
      </>,
    );
    fireEvent.click(screen.getByTestId('home-mode-math'));
    await waitFor(() => expect(playedAfterLastStop('title.math')).toBe(true));
    expect(location.hash).toBe('#/card/p4/math');
  });

  it('名前の声が無い札（2〜3さい・5さい）は、何も鳴らさない（今までどおり）', async () => {
    for (const [audience, stage, testid] of [
      ['toddler', 3, 'home-card-shape-match'],
      ['p5', undefined, 'home-card-clock'],
    ] as const) {
      setApp(audience, stage);
      const def = PRESCHOOL_HOMES[audience === 'toddler' ? 'p23' : 'p5']!;
      render(
        <>
          <RouteProbe />
          <PreschoolHome def={def} />
        </>,
      );
      au.calls.length = 0;
      fireEvent.click(screen.getByTestId(testid));
      await waitFor(() => expect(location.hash).not.toBe(''));
      expect(au.calls.filter((c) => c.startsWith('play:'))).toEqual([]);
      cleanup();
      location.hash = '';
    }
  });

  it('v1 の遊び方を選ぶ画面（たす）: 遊び方の名前の声は遷移のあと。選ぶ画面は先に鳴らさない', async () => {
    setApp('p4');
    render(
      <>
        <RouteProbe />
        <LegacyEntry unitId="p4.math.classic" />
      </>,
    );
    fireEvent.click(await screen.findByTestId('variant-add'));
    await waitFor(() => expect(playedAfterLastStop('math.variant.add')).toBe(true));
    // 声は遷移の say の1回だけ（ModeEntry が先に鳴らして止められることはない）
    expect(au.calls.filter((c) => c === playOf('math.variant.add'))).toHaveLength(1);
    expect(location.hash).toMatch(/^#\/legacy\/p4\.math\.classic\/.+/);
  });
});

describe('FX16: 保存の問題の「!」が幼児ホームにも出る', () => {
  function renderHome() {
    setApp('p4');
    return render(<PreschoolHome def={PRESCHOOL_HOMES.p4!} />);
  }

  it('問題が無いときは出さない。問題が起きると出て、直ると消える', () => {
    renderHome();
    expect(screen.queryByTestId('home-health')).toBeNull();
    act(() => setHealth('full'));
    expect(screen.getByTestId('home-health')).toBeTruthy();
    act(() => setHealth('ok'));
    expect(screen.queryByTestId('home-health')).toBeNull();
  });

  it('ホームを開く前から問題があるときも出す（full・error・unavailable のどれでも）', () => {
    for (const health of ['full', 'error', 'unavailable'] as const) {
      st.health = health;
      renderHome();
      expect(screen.getByTestId('home-health')).toBeTruthy();
      cleanup();
    }
  });

  it('鍵の左（上の帯の右のまとまりで、鍵の直前）にある。押せる物ではなく、保護者向けの文を持つ', () => {
    st.health = 'full';
    const { container } = renderHome();
    const mark = screen.getByTestId('home-health');
    const right = container.querySelector('.home-top__right')!;
    expect(right.contains(mark)).toBe(true);
    // 並び: ほかの がくねん → ! → 鍵
    const order = [...right.children].map((e) => e.getAttribute('data-testid'));
    expect(order).toEqual(['home-explore', 'home-health', 'parent-key']);
    expect(mark.tagName).toBe('SPAN');
    expect(mark.getAttribute('role')).toBe('img');
    expect(mark.className).toBe('home-health');
    expect(mark.textContent).toBe('!');
    expect(mark.getAttribute('aria-label')).toMatch(/^（保護者の方へ）/);
    // 押しても何も起きない（遷移しない）
    fireEvent.click(mark);
    expect(location.hash).toBe('');
  });

  it('2歳段階のホームにも出す', () => {
    st.health = 'error';
    setApp('toddler', 2);
    render(<PreschoolHome def={PRESCHOOL_HOMES.p23!} />);
    expect(screen.getByTestId('home-health')).toBeTruthy();
  });

  it('幼児ホーム・小学生ホーム・v1 のホームは同じ部品（StorageHealthMark）を使い、自分で「!」を書かない', () => {
    // 文（文言の直しで片方だけ変えない）・見た目・動きを1か所で揃えるため
    for (const file of [
      'src/app/PreschoolHome.tsx',
      'src/app/SchoolHome.tsx',
      'src/app/Home.tsx',
    ]) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toMatch(/import \{ StorageHealthMark \} from '\.\/StorageHealthMark'/);
      expect(src, file).toMatch(/<StorageHealthMark\s*\/>/);
      expect(src, file).not.toContain('data-testid="home-health"');
    }
  });
});
