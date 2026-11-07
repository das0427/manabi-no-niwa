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

describe('記号・分数・式の演算子のまとまり（V6）', () => {
  const ctx = { furigana: 'unlearned', learnerGrade: 1 } as const;
  const html = (text: string) => renderToStaticMarkup(createElement(Rt, { text, ctx }));
  const nb = (s: string) => `<span class="rt-nobr">${s}</span>`;
  it('記号と、すぐ後ろの空白までの仮名（g1.math.picture-graph・g2.ja.subject-predicate・g2.math.tables-graphs）', () => {
    expect(html('○が つまれるよ')).toContain(nb('○が'));
    expect(html('〜が どうする')).toContain(nb('〜が'));
    expect(html('○を かぞえる')).toContain(nb('○を'));
    expect(html('△は さんかく')).toContain(nb('△は'));
  });
  it('12字を超える仮名のまとまりは作らない', () => {
    expect(html('○あいうえおかきくけこさし')).not.toContain('rt-nobr');
  });
  it('分数と、すぐ後ろの仮名（g2.math.fraction-simple）', () => {
    const h = html('[[1/2]]は ぜんぶの はんぶん');
    expect(h).toMatch(
      /<span class="rt-nobr"><span class="rt-frac-wrap">.*<\/span>は<\/span> ぜんぶ/,
    );
  });
  it('演算子と後ろの1つの数・□を空白ごとまとめる（g4.math.order-ops・g6.math.approx-area）', () => {
    expect(html('3 ＝ □ です')).toContain(nb('＝ □'));
    expect(html('12 ÷ 2 です')).toContain(nb('÷ 2'));
    expect(html('□＝□')).toContain('rt-nobr');
  });
  it('演算子と後ろの空欄（{{}}）も空白ごとまとめる', () => {
    expect(html('3 ＝ {{}}')).toContain(
      `3 ${nb('＝ <span class="rt-blank" aria-label="あいている ところ"></span>')}`,
    );
  });
});

describe('分数の直前の始め括弧を分数と離さない（X7。g2.math.fraction-simple の題）', () => {
  const ctx = { furigana: 'unlearned', learnerGrade: 1 } as const;
  const html = (text: string) => renderToStaticMarkup(createElement(Rt, { text, ctx }));
  const frac = (n: number, d: number) =>
    `<span class="rt-frac-wrap"><span class="rt-frac" role="math" aria-label="${d}ぶんの${n}"><span class="rt-frac__num">${n}</span><span class="rt-frac__den">${d}</span></span></span>`;
  it('「ぶんすう（[[1/2]]・[[1/4]]・[[1/3]]）」の「（」は最初の分数と、続く「・」「）」は各分数と同じ nowrap に入る', () => {
    const h = html('ぶんすう（[[1/2]]・[[1/4]]・[[1/3]]）');
    expect(h).toBe(
      `<span class="rt ">ぶんすう<span class="rt-nobr">（${frac(1, 2)}・</span><span class="rt-nobr">${frac(1, 4)}・</span><span class="rt-nobr">${frac(1, 3)}）</span></span>`,
    );
  });
  it('始め括弧が無いときは、前の字を付けない（隣の字までは付けない）', () => {
    expect(html('ぶんすう[[1/2]]')).toBe(`<span class="rt ">ぶんすう${frac(1, 2)}</span>`);
  });
  it('始め括弧が2つ重なっても、分数に付ける', () => {
    expect(html('あ「（[[1/2]]')).toContain(`あ<span class="rt-nobr">「（${frac(1, 2)}</span>`);
  });
  it('始め括弧と、分数のすぐ後ろの仮名は両方とも同じ nowrap に入る', () => {
    expect(html('（[[1/2]]は')).toBe(
      `<span class="rt "><span class="rt-nobr">（${frac(1, 2)}は</span></span>`,
    );
  });
  it('分数のすぐ後ろの終わり括弧・句読点・「・」は分数と離さない（行頭に来ない）。仮名の後ろの句読点もいっしょ', () => {
    expect(html('[[1/2]]、[[1/3]]')).toContain(`<span class="rt-nobr">${frac(1, 2)}、</span>`);
    expect(html('（[[1/2]]）')).toContain(`<span class="rt-nobr">（${frac(1, 2)}）</span>`);
    expect(html('[[1/2]]は、つぎ')).toContain(`<span class="rt-nobr">${frac(1, 2)}は、</span>つぎ`);
  });
  it('分数の直前が閉じ括弧・空白・句読点なら付けない', () => {
    expect(html('あ） [[1/2]]')).not.toContain('rt-nobr');
  });
});

describe('ふりがな付きの語（ruby）は、隣の字を包みに取り込めなくても親字の途中で折らない（X7）', () => {
  it('rt.css が .rt ruby を nowrap にしている', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/text/rt.css', 'utf8');
    const block = /\.rt ruby\s*\{([^}]*)\}/.exec(css);
    expect(block?.[1]).toMatch(/white-space:\s*nowrap/);
  });
  it('「と」が前の語の包みに取られて、後ろの ruby が1つだけ残っても、ruby は包みの外の素の <ruby> のまま', () => {
    const html = renderToStaticMarkup(
      createElement(Rt, {
        text: 'わたしたちの生活《せいかつ》と食料生産《しょくりょうせいさん》',
        ctx: { furigana: 'all', learnerGrade: 1 },
      }),
    );
    // 食料生産 は包みに入らない（隣の「と」は前の ruby の包みに入っている）。折れないようにするのは CSS（上）
    expect(html).toContain('</span><ruby>食料生産<rt>しょくりょうせいさん</rt></ruby>');
    expect(html).toContain('<span class="rt-nobr">の<ruby>生活<rt>せいかつ</rt></ruby>と</span>');
  });
});
