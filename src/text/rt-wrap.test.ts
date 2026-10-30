import { describe, expect, it } from 'vitest';
import { nbspUnits, splitAfterBlank, splitBeforeBlank } from './Rt';

describe('nbspUnits', () => {
  it('数字＋空白＋単位の空白を U+00A0 にする', () => {
    expect(nbspUnits('3 cm と 12 kg')).toBe('3\u00a0cm と 12\u00a0kg');
    expect(nbspUnits('5 ％ 20 ℃ 3 度 2 mL')).toBe('5\u00a0％ 20\u00a0℃ 3\u00a0度 2\u00a0mL');
  });
  it('単位でない語・数字でない前は変えない', () => {
    expect(nbspUnits('3 mother')).toBe('3 mother');
    expect(nbspUnits('a cm')).toBe('a cm');
  });
});

describe('空欄の前後の分割', () => {
  it('直前の始め括弧だけ切り出す', () => {
    expect(splitBeforeBlank('ぼくは「')).toEqual(['ぼくは', '「']);
    expect(splitBeforeBlank('ぼくは')).toEqual(['ぼくは', '']);
  });
  it('直後の終わり括弧・句読点だけ切り出す', () => {
    expect(splitAfterBlank('」と いう。')).toEqual(['」', 'と いう。']);
    expect(splitAfterBlank('。つぎ')).toEqual(['。', 'つぎ']);
    expect(splitAfterBlank('と')).toEqual(['', 'と']);
  });
});

describe('空欄と括弧・句読点を1つの nowrap にまとめる', () => {
  it('始め括弧・空欄・終わり括弧と句読点が同じ span.rt-nobr の中にある', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { Rt } = await import('./Rt');
    const html = renderToStaticMarkup(
      createElement(Rt, {
        text: 'ぼくは「{{}}」と いった。',
        ctx: { furigana: 'unlearned', learnerGrade: 1 },
      }),
    );
    expect(html).toContain(
      'ぼくは<span class="rt-nobr">「<span class="rt-blank" aria-label="あいている ところ"></span>」</span>と いった。',
    );
    // 括弧が無いときは、隣の1字（空白でない）と離さない。空白の隣は付けない
    const word = renderToStaticMarkup(
      createElement(Rt, {
        text: 'かおを あらいました{{}} つぎ{{}}と',
        ctx: { furigana: 'unlearned', learnerGrade: 1 },
      }),
    );
    expect(word).toContain(
      'かおを あらいまし<span class="rt-nobr">た<span class="rt-blank" aria-label="あいている ところ"></span></span> つ',
    );
    expect(word).toContain(
      'つ<span class="rt-nobr">ぎ<span class="rt-blank" aria-label="あいている ところ"></span>と</span>',
    );
    const alone = renderToStaticMarkup(
      createElement(Rt, { text: 'あ {{}} い', ctx: { furigana: 'unlearned', learnerGrade: 1 } }),
    );
    expect(alone).not.toContain('rt-nobr');
  });
});
