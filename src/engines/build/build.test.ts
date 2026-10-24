import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseItemErrors, ctxFor } from '../order/testkit';
import {
  answerTextOfBuild,
  answerTiling,
  buildEngine,
  checkBuild,
  judgeBuild,
  romajiSpellings,
  type BuildItem,
} from './build';
import { buildSamples } from './build.samples';

afterEach(cleanup);

const item = (over: Partial<BuildItem> = {}): BuildItem => ({
  engine: 'build',
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'つくろう',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 't',
  tiles: ['と', 'ん', 'ぼ', 'ほ'],
  answer: { kind: 'text', values: ['とんぼ'] },
  wrongAnswers: [{ value: 'とんほ', misconception: 'dakuten' }],
  ...over,
});

describe('judgeBuild: text', () => {
  it('並べた文字列が正解なら正解', () => {
    expect(judgeBuild(item(), [0, 1, 2])).toEqual({ result: 'correct' });
  });
  it('誤答の例の誤概念と、最初に外れた位置の印', () => {
    expect(judgeBuild(item(), [0, 1, 3])).toEqual({
      result: 'wrong',
      misconception: 'dakuten',
      mark: [2],
    });
    expect(judgeBuild(item(), [1, 0, 2])).toMatchObject({ result: 'wrong', mark: [0] });
    // 足りないだけ（前は合っている）は印なし
    expect(judgeBuild(item(), [0, 1])).toMatchObject({ result: 'wrong', mark: [] });
  });
  it('表記ゆれ（複数の正解・式の空白・全角半角）', () => {
    const it2 = item({
      tiles: ['3', '＋', '5', '-'],
      answer: { kind: 'text', values: ['3 + 5', '5+3'] },
    });
    expect(judgeBuild(it2, [0, 1, 2]).result).toBe('correct');
    expect(judgeBuild(it2, [2, 1, 0]).result).toBe('correct');
    expect(judgeBuild(it2, [0, 3, 2]).result).toBe('wrong');
  });
  it('英語の語順（空白でつなぐ・大文字小文字）', () => {
    const it2 = item({
      tiles: ['I', 'like', 'apples', 'you'],
      joiner: ' ',
      answer: { kind: 'text', values: ['i like apples'], ignoreCase: true },
      wrongAnswers: [],
    });
    expect(judgeBuild(it2, [0, 1, 2]).result).toBe('correct');
    expect(judgeBuild(it2, [1, 0, 2])).toMatchObject({ result: 'wrong', mark: [0] });
  });
  it('何も並べていない・同じタイルを2回は「もう一度」', () => {
    expect(judgeBuild(item(), []).result).toBe('retry');
    expect(judgeBuild(item(), [0, 0]).result).toBe('retry');
  });
});

describe('judgeBuild: parts', () => {
  const it2 = item({
    tiles: ['日《ひ》', '寺《てら》', '月《つき》'],
    answer: { kind: 'parts', parts: ['日《ひ》', '寺《てら》'] },
    wrongAnswers: [{ value: '月+寺', misconception: 'hi-tsuki' }],
  });
  it('部品の組は順不同', () => {
    expect(judgeBuild(it2, [0, 1]).result).toBe('correct');
    expect(judgeBuild(it2, [1, 0]).result).toBe('correct');
  });
  it('誤りの部品に印・誤概念', () => {
    expect(judgeBuild(it2, [2, 1])).toEqual({
      result: 'wrong',
      misconception: 'hi-tsuki',
      mark: [0],
    });
    expect(judgeBuild(it2, [0, 1, 2])).toMatchObject({ result: 'wrong', mark: [2] });
  });
});

describe('judgeBuild: romaji', () => {
  const it2 = item({
    tiles: ['shi', 'si', 'n', 'm', 'bu', 'n'],
    answer: { kind: 'romaji', kana: 'しんぶん' },
    wrongAnswers: [{ value: 'shimbun', misconception: 'n-as-m' }],
  });
  it('告示のつづりは正解、訓令式は「もう一度」、m は誤り', () => {
    expect(judgeBuild(it2, [0, 2, 4, 5]).result).toBe('correct');
    const r = judgeBuild(it2, [1, 2, 4, 5]);
    expect(r.result).toBe('retry');
    expect(r.result === 'retry' && r.message).toMatch('shinbun');
    expect(judgeBuild(it2, [0, 3, 4, 2])).toEqual({
      result: 'wrong',
      misconception: 'n-as-m',
      mark: [1],
    });
  });
  it('長音は ō・ou・oo を許容', () => {
    const t = item({
      tiles: ['to', 'u', 'kyō', 'kyo', 'o'],
      answer: { kind: 'romaji', kana: 'とうきょう' },
      wrongAnswers: [],
    });
    expect(romajiSpellings('とうきょう')).toContain('toukyou');
    expect(judgeBuild(t, [0, 1, 2]).result).toBe('correct'); // toukyō
    expect(judgeBuild(t, [0, 1, 3, 1]).result).toBe('retry'); // u を2回は使えない（重複）
    expect(judgeBuild(t, [0, 4, 3, 1]).result).toBe('correct'); // tookyou
  });
  it('語頭を大文字にする問題', () => {
    const t = item({
      tiles: ['Ō', 'ō', 'saka'],
      answer: { kind: 'romaji', kana: 'おおさか', capital: true },
      wrongAnswers: [],
    });
    expect(judgeBuild(t, [0, 2]).result).toBe('correct');
    expect(judgeBuild(t, [1, 2]).result).toBe('retry');
    expect(answerTextOfBuild(t)).toBe('Ōsaka');
  });
});

describe('checkBuild', () => {
  it('正しいデータは誤りなし', () => {
    expect(checkBuild(item())).toEqual([]);
  });
  it('データの誤りを見つける', () => {
    expect(checkBuild(item({ tiles: ['と', 'ぼ'] })).join()).toMatch('作れない');
    expect(
      checkBuild(item({ wrongAnswers: [{ value: 'とんぼ', misconception: 'x' }] })).join(),
    ).toMatch('正解と判定される');
    expect(checkBuild(item({ tiles: ['山', 'と', 'ん', 'ぼ'] })).join()).toMatch('よみの無い漢字');
    expect(checkBuild(item({ answer: { kind: 'romaji', kana: 'きゃx' } })).join()).toMatch(
      'ローマ字にできない',
    );
    expect(
      checkBuild(
        item({
          tiles: ['si', 'n', 'bu', 'n'],
          answer: { kind: 'romaji', kana: 'しんぶん' },
          wrongAnswers: [],
        }),
      ).join(),
    ).toMatch('作れない');
  });
  it('正答の並び（枠の数・正答表示）', () => {
    expect(answerTiling(item())).toEqual([0, 1, 2]);
  });
});

describe('見本', () => {
  it('checkBuild と共通項目に誤りが無い', () => {
    for (const s of buildSamples) {
      expect(checkBuild(s), s.id).toEqual([]);
      expect(baseItemErrors(s, s.id === 'sample-build:tonbo'), s.id).toEqual([]);
    }
  });
});

describe('画面', () => {
  it('タップで並べ、上のタイルをタップで戻す（後ろはつめる）', () => {
    const p = {
      item: item(),
      ctx: ctxFor('g1'),
      revealed: false,
      wrongMark: null,
      disabled: false,
      submit: vi.fn(),
    };
    render(createElement(buildEngine.Component, p));
    fireEvent.click(screen.getByTestId('tile-0'));
    fireEvent.click(screen.getByTestId('tile-3'));
    fireEvent.click(screen.getByTestId('tile-1'));
    fireEvent.click(screen.getByTestId('placed-1')); // ほ を戻す → と ん
    fireEvent.click(screen.getByTestId('tile-2'));
    fireEvent.click(screen.getByTestId('check'));
    expect(p.submit).toHaveBeenCalledWith([0, 1, 2]);
  });
  it('revealed のときは正答の並びを見せる', () => {
    const p = {
      item: item(),
      ctx: ctxFor('g1'),
      revealed: true,
      wrongMark: null,
      disabled: false,
      submit: vi.fn(),
    };
    render(createElement(buildEngine.Component, p));
    expect(screen.getByTestId('placed-2').textContent).toContain('ぼ');
    expect(screen.queryByTestId('check')).toBeNull();
  });
});
