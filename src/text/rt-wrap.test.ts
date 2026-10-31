import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { nbspUnits, Rt, splitAfterBlank, splitBeforeBlank } from './Rt';

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

describe('数と助数詞・式・1字の並びを nowrap にまとめる（表示だけ）', () => {
  const ctx = { furigana: 'unlearned', learnerGrade: 1 } as const;
  const html = (text: string) => renderToStaticMarkup(createElement(Rt, { text, ctx }));
  const nb = (s: string) => `<span class="rt-nobr">${s}</span>`;
  it('数字の並び＋直後の1字', () => {
    expect(html('1字めと 4音と 7こと 60分')).toBe(
      `<span class="rt ">${nb('1字')}めと ${nb('4音')}と ${nb('7こ')}と ${nb('60分')}</span>`,
    );
  });
  it('前の始め括弧・後ろの終わり括弧と句読点も同じ nowrap に入れる', () => {
    expect(html('（7音）、あ')).toBe(`<span class="rt ">${nb('（7音）、')}あ</span>`);
  });
  it('数字の後ろが句読点・括弧・空白・英字なら付けない', () => {
    expect(html('3、4 5「6」7cm')).toBe('<span class="rt ">3、4 5「6」7cm</span>');
  });
  it('ふりがなを出さない語が続くときも、数字と語の頭の1字を離さない', () => {
    expect(html('1字《!じ》目がい・う')).toContain(`${nb('1字')}目`);
    expect(html('4音《おん》だよ')).toContain('<ruby>');
  });
  it('空白を含まない式（3字以上）', () => {
    expect(html('10＋4＝14 です')).toContain(nb('10＋4＝14'));
    expect(html('□＋3＝5')).toContain(nb('□＋3＝5'));
  });
  it('10字を超える式は包まない', () => {
    expect(html('1＋2＋3＋4＋5＋6＋7＋8')).not.toContain('rt-nobr');
  });
  it('1字ずつ「・」でつないだ並び。語の「・」は包まない', () => {
    expect(html('き・つ・つ・き と あ・い・う・え・お')).toBe(
      `<span class="rt ">${nb('き・つ・つ・き')} と ${nb('あ・い・う・え・お')}</span>`,
    );
    expect(html('「た・け・や・ぶ・や・け・た」')).toContain(nb('「た・け・や・ぶ・や・け・た」'));
    expect(html('くに・まち・ひと')).not.toContain('rt-nobr');
  });
});

describe('まとまりの先頭が行頭禁則の字なら、さらに前の1字を含める', () => {
  const ctx = { furigana: 'unlearned', learnerGrade: 1 } as const;
  const html = (text: string) => renderToStaticMarkup(createElement(Rt, { text, ctx }));
  it('「…のに、{{}}」の「、」を行頭に置かない', () => {
    expect(html('あるのに、{{}}は')).toContain(
      'あるの<span class="rt-nobr">に、<span class="rt-blank" aria-label="あいている ところ"></span>は</span>',
    );
  });
  it('小さい仮名・長音も同じ', () => {
    expect(html('あかっ{{}}')).toContain('あ<span class="rt-nobr">かっ<span');
    expect(html('あかっ{{}}')).not.toContain('あか<span class="rt-nobr">っ<span');
    expect(html('あスキー{{}}')).toContain('あス<span class="rt-nobr">キー<span');
  });
});
