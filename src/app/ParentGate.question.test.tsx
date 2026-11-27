import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 保護者ゲートの計算問題は、まちがえるたびに新しい問題に替わる（R3）。
 * 同じ問題のまま、答えの範囲（23〜111）を続けて試せないようにする。暗証番号の道は変えない。
 */
const m = vi.hoisted(() => ({
  pinHash: null as string | null,
  unlocked: vi.fn(),
}));
vi.mock('../core/framed', () => ({ isFramed: () => false }));
vi.mock('../core/storage/index', () => ({
  getAppRecord: () => Promise.resolve({ parentPinHash: m.pinHash }),
}));
vi.mock('./AppState', () => ({ useApp: () => ({ setParentUnlocked: m.unlocked }) }));
// 暗証番号の照合は、保存した文字列と同じ数字かどうかだけにする（SHA-256 は jsdom では使わない）
vi.mock('./pin', () => ({
  checkPin: (pin: string, stored: string) => Promise.resolve(pin === stored),
}));

const { ParentGateButton } = await import('./ParentGate');

beforeEach(() => {
  vi.useFakeTimers();
  m.pinHash = null;
  m.unlocked.mockClear();
  location.hash = '#/home';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** 鍵を2秒長押しして板を開く（描いたあとの鍵のボタンで） */
async function holdKey(): Promise<void> {
  const k = screen.getByTestId('parent-key');
  fireEvent.pointerUp(k);
  fireEvent.pointerDown(k);
  await act(async () => {
    vi.advanceTimersByTime(2100);
    await Promise.resolve();
  });
  expect(screen.getByTestId('parent-gate')).toBeTruthy();
}

async function openGate(): Promise<void> {
  render(<ParentGateButton />);
  await holdKey();
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
  });
const typed = () => document.querySelector('.gate-input')?.textContent?.trim() ?? '';
const key = (k: string) => fireEvent.keyDown(window, { key: k });
const tapKeys = (digits: string) => {
  for (const ch of digits) fireEvent.click(screen.getByTestId(`gate-key-${ch}`));
};
/** 数字を押して OK（答え合わせが終わるまで待つ） */
async function submitDigits(digits: string): Promise<void> {
  tapKeys(digits);
  fireEvent.click(screen.getByTestId('gate-key-OK'));
  await settle();
}

/** いま出ている問題の文と答え（「a ＋ b は？」） */
function current(): { text: string; answer: number } {
  const text = screen.getByTestId('gate-question').textContent ?? '';
  const mm = /(\d+)\s*＋\s*(\d+)/.exec(text);
  expect(mm).not.toBeNull();
  return { text, answer: Number(mm![1]) + Number(mm![2]) };
}

/** Math.random を決まった値の並びで繰り返し返す。問題を作るたびに a 用・b 用の順に 2 回引かれる */
function fixRandom(...values: number[]): void {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => values[i++ % values.length]!);
}

describe('保護者ゲートの計算問題: まちがえたら新しい問題', () => {
  it('ボタンでまちがえると問題が替わり、新しい問題の答えで開く', async () => {
    await openGate();
    const q1 = current();
    tapKeys(String(q1.answer + 1));
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();

    // まちがい: 「ちがいます」・入力は空・開かない・板は開いたまま。問題は替わっている
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    expect(typed()).toBe('');
    expect(m.unlocked).not.toHaveBeenCalled();
    expect(location.hash).toBe('#/home');
    const q2 = current();
    expect(q2.text).not.toBe(q1.text);
    expect(q2.answer).not.toBe(q1.answer);
    // 替わったことは読み上げソフトにも伝わる（問題の文は aria-live）
    expect(screen.getByTestId('gate-question').getAttribute('aria-live')).toBe('polite');

    // 前の問題の答えでは開かない（新しい問題の答えだけが通る）
    tapKeys(String(q1.answer));
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(m.unlocked).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent-gate')).toBeTruthy();

    const q3 = current();
    tapKeys(String(q3.answer));
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it('キーボードでも同じ: まちがえて Enter で問題が替わり、新しい答えを打って Enter で開く', async () => {
    await openGate();
    const q1 = current();
    for (const ch of String(q1.answer + 1)) key(ch);
    key('Enter');
    await settle();
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    expect(typed()).toBe('');
    const q2 = current();
    expect(q2.text).not.toBe(q1.text);
    expect(m.unlocked).not.toHaveBeenCalled();

    for (const ch of String(q2.answer)) key(ch);
    expect(typed()).toBe(String(q2.answer));
    key('Enter');
    await settle();
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
  });

  it('正しく答えたら、問題は替わらずに開く（答え合わせの前に問題は替わらない）', async () => {
    await openGate();
    const q1 = current();
    // 入力・Backspace・「けす」・打ち直しでは問題は替わらない
    key('1');
    key('Backspace');
    fireEvent.click(screen.getByTestId('gate-key-けす'));
    expect(current().text).toBe(q1.text);
    for (const ch of String(q1.answer)) key(ch);
    expect(current().text).toBe(q1.text);
    key('Enter');
    await settle();
    expect(m.unlocked).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it('何度まちがえても、そのたびに答えが前と違う問題になる（答えは 23〜111 のまま。開き直しても同じ）', async () => {
    await openGate();
    for (let round = 0; round < 30; round++) {
      let prev = current();
      // 板が開いている間に替わるのは 2 回まで（3 回目のまちがいで板が閉じる）
      for (let i = 0; i < 2; i++) {
        // 今の答えの次の数（今の答えとは違うので、まちがいになる）
        await submitDigits(String(prev.answer + 1));
        const next = current();
        expect(next.answer).not.toBe(prev.answer);
        expect(next.answer).toBeGreaterThanOrEqual(23);
        expect(next.answer).toBeLessThanOrEqual(111);
        prev = next;
      }
      await submitDigits(String(prev.answer + 1));
      expect(screen.queryByTestId('parent-gate')).toBeNull();
      await holdKey();
    }
    expect(m.unlocked).not.toHaveBeenCalled();
  });

  it('乱数が同じ値を返しても、答えは前と同じにならない（b をずらす）', async () => {
    // a=12・b=11（答え 23）が続けて出る乱数。1 回目はそのまま、まちがえたあとは b をずらして 24
    fixRandom(0, 0);
    await openGate();
    expect(current().answer).toBe(23);
    tapKeys('1');
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(current().text).toBe('12 ＋ 12 は？');
    // 続けてまちがえると、また乱数どおり 23（前の 24 とは違うのでそのまま）
    tapKeys('1');
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(current().text).toBe('12 ＋ 11 は？');
  });

  it('b が上限（40）で答えが同じになるときは、b を下限（11）に戻す（範囲の外に出ない）', async () => {
    // a=12・b=40（答え 52）が続けて出る乱数。まちがえたあとは b=41 ではなく 11 に戻して 23
    fixRandom(0, 0.999);
    await openGate();
    expect(current().text).toBe('12 ＋ 40 は？');
    tapKeys('1');
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(current().text).toBe('12 ＋ 11 は？');
  });

  it('暗証番号があるときは、まちがえても問題を作り直さない（暗証番号の道は変わらない）', async () => {
    m.pinHash = '4321';
    const rand = vi.spyOn(Math, 'random');
    await openGate();
    const before = rand.mock.calls.length;
    const label = screen.getByTestId('gate-question').textContent;
    expect(label).toBe('暗証番号を入力してください');

    tapKeys('1111');
    expect(typed()).toBe('●●●●');
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    expect(typed()).toBe('');
    expect(m.unlocked).not.toHaveBeenCalled();
    expect(rand.mock.calls.length).toBe(before);
    expect(screen.getByTestId('gate-question').textContent).toBe(label);

    tapKeys('4321');
    fireEvent.click(screen.getByTestId('gate-key-OK'));
    await settle();
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
  });

  it('まちがえたあとも、Enter・Backspace・Esc・Tab のキーボード操作は同じ', async () => {
    await openGate();
    const q1 = current();
    key('1');
    key('Enter');
    await settle();
    expect(current().text).not.toBe(q1.text);
    // 「ちがいます」は、打ち直すと消える
    key('2');
    key('3');
    key('Backspace');
    expect(typed()).toBe('2');
    expect(screen.queryByText('ちがいます。もう一度どうぞ。')).toBeNull();
    // Tab は板の中のボタンだけを回る
    const last = screen.getByTestId('gate-cancel');
    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('gate-key-1'));
    // Esc で閉じる
    key('Escape');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();
  });
});

/**
 * まちがいが 3 回続くと板を閉じる（公開前の最後の確かめ SEC-1）。問題を替えるだけでは、同じ数を打ち続けて
 * 通れてしまう（通るまでの回数は、答えを順に試すのとほとんど変わらない）。数回ごとに2秒の長押しを求める。
 */
describe('保護者ゲート: まちがいが 3 回続くと板を閉じる', () => {
  it('2 回までは板が開いたまま。3 回目で閉じ、開かない。開き直すと数え直しで、正しい答えで開く', async () => {
    await openGate();
    await submitDigits(String(current().answer + 1));
    await submitDigits(String(current().answer + 1));
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();

    await submitDigits(String(current().answer + 1));
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();
    expect(location.hash).toBe('#/home');
    // 閉じたあとは数字キー・Enter を受けない（後ろの画面に何も起きない）
    key('1');
    key('Enter');
    await settle();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();

    // 開き直すには長押しが要る。開き直した板は、まちがいの数も「ちがいます」も残っていない
    await holdKey();
    expect(screen.queryByText('ちがいます。もう一度どうぞ。')).toBeNull();
    expect(typed()).toBe('');
    await submitDigits(String(current().answer + 1));
    await submitDigits(String(current().answer + 1));
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    await submitDigits(String(current().answer));
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
  });

  it('同じ数を打ち続けても、長押しなしでは 3 回までしか試せない（4 問目が当たる並びでも開かない）', async () => {
    // 問題の答えが 23 → 24（同じにならないよう b をずらす）→ 23 → 55 と並ぶ乱数。「55」を打ち続ける
    fixRandom(0, 0, 0, 0, 0, 0, 0.5, 0.07);
    await openGate();
    for (let i = 0; i < 3; i++) {
      expect(current().answer).not.toBe(55);
      for (const ch of '55') key(ch);
      key('Enter');
      await settle();
    }
    // 3 回目のまちがいで閉じたので、4 回目の「55」は届かない
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    for (const ch of '55') key(ch);
    key('Enter');
    await settle();
    expect(m.unlocked).not.toHaveBeenCalled();
    // 長押しで開き直したときに初めて、次の問題（答え 55）になる
    await holdKey();
    expect(current().answer).toBe(55);
  });

  it('暗証番号のときも、3 回続けてまちがえると閉じる。開き直して正しい番号で開く', async () => {
    m.pinHash = '4321';
    await openGate();
    for (let i = 0; i < 2; i++) {
      await submitDigits('1111');
      expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    }
    await submitDigits('1111');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();

    await holdKey();
    await submitDigits('4321');
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
  });

  it('入力・Backspace・「けす」・Esc はまちがいに数えない。Esc で閉じて開き直すと数え直し', async () => {
    await openGate();
    await submitDigits(String(current().answer + 1));
    await submitDigits(String(current().answer + 1));
    // 入力して消すだけ・「けす」は数えない（板は開いたまま）
    key('9');
    key('Backspace');
    fireEvent.click(screen.getByTestId('gate-key-けす'));
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    // Esc で閉じて開き直すと、また 2 回までまちがえられる
    key('Escape');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    await holdKey();
    await submitDigits(String(current().answer + 1));
    await submitDigits(String(current().answer + 1));
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    expect(m.unlocked).not.toHaveBeenCalled();
  });
});
