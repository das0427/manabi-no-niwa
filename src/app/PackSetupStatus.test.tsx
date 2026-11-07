import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SetupState } from '../core/offline/setup';
import { PackSetupStatus, setupParentNote } from './PackSetupStatus';

afterEach(cleanup);

const KANJI = /[一-鿿]/;

const packs = (over: Partial<SetupState>): SetupState => ({
  stage: 'packs',
  progress: { done: 40, total: 100 },
  missing: ['g3-math', 'g3-ja'],
  outdated: [],
  failures: [],
  downloading: true,
  checking: false,
  unsupported: false,
  ...over,
});

describe('PackSetupStatus（起動画面の きょうざいの じゅんび）', () => {
  it('出さないときは何も描かない', () => {
    const { container } = render(<PackSetupStatus view={{ kind: 'hidden' }} onRetry={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('取得中: ひらがなの文・割合・棒・「さきに あそんで いいよ」', () => {
    render(
      <PackSetupStatus
        view={{ kind: 'preparing', percent: 40, renewing: false }}
        onRetry={() => {}}
      />,
    );
    const box = screen.getByTestId('pack-setup');
    expect(box.dataset.state).toBe('preparing');
    expect(screen.getByTestId('pack-setup-text').textContent).toContain(
      'きょうざいを じゅんびちゅう',
    );
    expect(screen.getByTestId('pack-setup-percent').textContent).toBe('40%');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(box.textContent).toContain('さきに あそんで いいよ');
    expect(KANJI.test(box.textContent ?? '')).toBe(false);
    expect(screen.queryByTestId('pack-setup-retry')).toBeNull();
  });

  it('バージョンが古いものの取り直しは「あたらしい きょうざい」', () => {
    render(
      <PackSetupStatus
        view={{ kind: 'preparing', percent: 0, renewing: true }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId('pack-setup-text').textContent).toContain('あたらしい きょうざいを');
  });

  it('失敗: おうちの ひとへの案内と「もういちど」。押すと取り直す', () => {
    const onRetry = vi.fn();
    render(<PackSetupStatus view={{ kind: 'failed', offline: false }} onRetry={onRetry} />);
    const box = screen.getByTestId('pack-setup');
    expect(box.dataset.state).toBe('failed');
    expect(box.textContent).toContain('おうちの ひとに みてもらってね');
    expect(KANJI.test(box.textContent ?? '')).toBe(false);
    fireEvent.click(screen.getByTestId('pack-setup-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('オフラインで止まったときは「つながったら じゅんび するね」', () => {
    render(<PackSetupStatus view={{ kind: 'failed', offline: true }} onRetry={() => {}} />);
    expect(screen.getByTestId('pack-setup-text').textContent).toBe('つながったら じゅんび するね');
  });
});

describe('setupParentNote（保護者向けの小さな表示）', () => {
  it('本体の準備中は割合、失敗は保護者画面へ', () => {
    expect(setupParentNote({ ...packs({}), stage: 'core', progress: { done: 1, total: 4 } })).toBe(
      'オフラインの準備中 25%',
    );
    expect(setupParentNote({ ...packs({}), stage: 'core', progress: null })).toBeNull();
    expect(setupParentNote({ ...packs({}), stage: 'error' })).toContain('失敗');
  });

  it('既定パックがそろうまで「オフラインで使えます」を出さない', () => {
    expect(setupParentNote(packs({}))).toBe('教材パックの準備中 40%（2件）');
    expect(setupParentNote(packs({ checking: true }))).toBeNull();
    expect(setupParentNote({ ...packs({}), stage: 'ready', missing: [] })).toBe(
      'オフラインで使えます',
    );
    expect(setupParentNote({ ...packs({}), stage: 'ready', unsupported: true })).toBeNull();
  });

  it('バージョンが古いものの取り直し・オフライン・その他の失敗', () => {
    expect(setupParentNote(packs({ outdated: ['g3-ja'] }))).toContain('取得し直しています 40%');
    expect(
      setupParentNote(
        packs({ downloading: false, failures: [{ packId: 'g3-ja', reason: 'offline' }] }),
      ),
    ).toContain('つながると自動で続けます');
    const quota = setupParentNote(
      packs({ downloading: false, failures: [{ packId: 'g3-ja', reason: 'quota' }] }),
    );
    expect(quota).toContain('容量が足りません');
    expect(quota).toContain('きょうざい');
  });
});
