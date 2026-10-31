import { describe, expect, it } from 'vitest';
import {
  autoLayout,
  displayOrder,
  optionTraits,
  picsProps,
  splitParen,
  visibleOptionIndices,
  wordTrait,
} from './choice';

describe('選択肢の並び', () => {
  const opts = (labels: string[]) => labels.map((label, i) => ({ label, correct: i === 0 }));
  it('同じ問題は毎回同じ順・中身は同じ', () => {
    const item = { id: 'x:1', options: opts(['1', '2', '3', '4']) };
    const a = displayOrder(item, [0, 1, 2, 3]);
    expect(displayOrder(item, [0, 1, 2, 3])).toEqual(a);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
  });
  it('正解が先頭に書かれた問題でも、多くの問題で先頭以外に出る', () => {
    let first = 0;
    for (let k = 0; k < 400; k++)
      if (displayOrder({ id: `q:${k}`, options: opts(['a', 'b', 'c']) }, [0, 1, 2])[0] === 0)
        first++;
    expect(first / 400).toBeGreaterThan(0.2);
    expect(first / 400).toBeLessThan(0.47);
  });
  it('絵だけの選択肢は、解説・ヒントが「1ばん」と位置で指すときだけ並べ替えない', () => {
    const options = [{ correct: true }, {}, {}];
    expect(
      displayOrder({ id: 'q:1', options, explain: '1ばんの えが ただしい' }, [0, 1, 2]),
    ).toEqual([0, 1, 2]);
    let moved = 0;
    for (let k = 0; k < 50; k++)
      if (displayOrder({ id: `p:${k}`, options }, [0, 1, 2])[0] !== 0) moved++;
    expect(moved).toBeGreaterThan(20);
  });
  it('fixedOrder と「あ・い」は並べ替えない', () => {
    expect(
      displayOrder({ id: 'q', fixedOrder: true, options: opts(['3', '2', '1']) }, [0, 1, 2]),
    ).toEqual([0, 1, 2]);
    expect(displayOrder({ id: 'q', options: opts(['あ', 'い', 'う']) }, [0, 1, 2])).toEqual([
      0, 1, 2,
    ]);
  });
});

describe('選択肢を減らすとき正解を残す（コードレビュー #3）', () => {
  it('正解が後ろにあっても残る', () => {
    expect(visibleOptionIndices([{}, {}, { correct: true }], 2)).toEqual([0, 2]);
  });
  it('上限以内ならそのまま・元の順', () => {
    expect(visibleOptionIndices([{ correct: true }, {}, {}], 3)).toEqual([0, 1, 2]);
    expect(visibleOptionIndices([{}, { correct: true }, {}, {}], 2)).toEqual([0, 1]);
  });
});

describe('autoLayout（選択肢の並び。text-layout-fixes S3）', () => {
  const t = (n: number, len: number) =>
    Array.from({ length: n }, (_, i) => ({ label: String(i).repeat(1).padEnd(len, 'あ') }));
  it('文字だけの4つ以上は2列のグリッド（図があって全部8字以下なら横一列）', () => {
    expect(autoLayout(t(4, 12), undefined, false)).toBe('grid');
    expect(autoLayout(t(4, 12), 'column', false)).toBe('grid');
    expect(autoLayout(t(4, 6), undefined, true)).toBe('row');
  });
  it('問題に図がある・全部8字以下は横一列', () => {
    expect(autoLayout(t(3, 14), 'column', true)).toBe('row');
    expect(autoLayout(t(3, 6), 'column', false)).toBe('row');
  });
  it('column は16字超かつ3つ以下のときだけ', () => {
    expect(autoLayout(t(3, 20), undefined, false)).toBe('column');
    expect(autoLayout(t(3, 12), 'column', false)).toBe('row');
  });
  it('絵・図の選択肢が混じるときは指定のまま', () => {
    expect(
      autoLayout(
        [{ figure: {} }, { figure: {} }, { figure: {} }, { figure: {} }],
        undefined,
        false,
      ),
    ).toBe('row');
    expect(autoLayout([{ figure: {} }, { label: 'あ' }], 'column', false)).toBe('column');
  });
});

describe('絵・図だけの選択肢（text-layout-fixes R3）', () => {
  const pic = { figure: { kind: 'illust', id: 'cat' } };
  it('label が無い、または 4字以下なら、パックの column でも横一列', () => {
    expect(autoLayout([pic, pic, pic], 'column', true)).toBe('row');
    expect(autoLayout([{ ...pic, label: '3こ' }, pic, pic], 'column', true)).toBe('row');
    // 5字以上の文が付く選択肢は指定のまま
    expect(autoLayout([{ ...pic, label: 'ながいことば' }, pic, pic], 'column', true)).toBe(
      'column',
    );
  });
  it('picsProps は横一列の絵だけのときに、数と1つの中の絵の最大数を渡す', () => {
    const f = (n: number) => ({ figure: { kind: 'illust', id: 'cat', count: n } });
    const p = picsProps([f(1), f(2), f(12)], 'row');
    expect(p.className).toBe(' is-pics');
    expect(p.style).toMatchObject({ '--pics-n': 3, '--pics-total': 8 });
    expect(picsProps([f(1), f(2)], 'column').className).toBe('');
    expect(picsProps([f(1), { label: 'あ' }], 'row').className).toBe('');
  });
});

describe('optionTraits（text-layout-fixes T3）', () => {
  const t = (label: string) => ({ label });
  it('文字だけで12字を超えるラベルがあれば long', () => {
    expect(optionTraits([t('あいうえおかきくけこさしす'), t('あ')], 'grid', false).long).toBe(true);
    expect(optionTraits([t('あいうえおかきくけこさし'), t('あ')], 'grid', false).long).toBe(false);
  });
  it('絵が付く選択肢は long にしない', () => {
    expect(
      optionTraits([{ label: 'あいうえおかきくけこさしすせ', figure: {} }, t('あ')], 'row', false)
        .long,
    ).toBe(false);
  });
  it('絵に5字以上の文が付く4つ以下の横一列は caption', () => {
    const o = [1, 2, 3].map(() => ({ label: 'アイスを たべた', figure: {} }));
    expect(optionTraits(o, 'row', false).caption).toBe(true);
    expect(optionTraits(o, 'row', true).caption).toBe(false);
    expect(optionTraits([...o, ...o], 'row', false).caption).toBe(false);
    expect(
      optionTraits(
        o.map((x) => ({ ...x, label: 'あか' })),
        'row',
        false,
      ).caption,
    ).toBe(false);
  });
});

describe('wordTrait（語のラベルは語の途中で折らない。V2 1）', () => {
  it('空白なし8字以下は一語（札の幅は字数）', () => {
    expect(wordTrait('じてんしゃ')).toEqual({ kind: 'word', len: 5 });
    expect(wordTrait('パイロット')).toEqual({ kind: 'word', len: 5 });
    expect(wordTrait('すいぞくかん')).toEqual({ kind: 'word', len: 6 });
    expect(wordTrait('あいうえおかきく')?.kind).toBe('word');
    // ふりがなの書き方（《》）は字数に入れない
    expect(wordTrait('医者《いしゃ》')).toEqual({ kind: 'word', len: 2 });
  });
  it('9字以上の一語は語ではない（横1行の列だけ 9字まで）', () => {
    expect(wordTrait('あいうえおかきくけ')).toBeNull();
    expect(wordTrait('オーストラリア大陸', 9)).toEqual({ kind: 'word', len: 9 });
  });
  it('空白で区切った短い句は、各語8字以下・全体14字以下', () => {
    expect(wordTrait('つくえの 中')).toEqual({ kind: 'phrase', len: 6 });
    expect(wordTrait('アイスクリームを たべた')).toEqual({ kind: 'phrase', len: 8 });
    expect(wordTrait('ベッドの 上の ボール')).toEqual({ kind: 'phrase', len: 4 });
    expect(wordTrait('したの いぬ')?.kind).toBe('phrase');
    expect(wordTrait('あいうえおかきくけ こ')).toBeNull();
    expect(wordTrait('あいうえお かきくけこ さしすせそ')).toBeNull();
  });
  it('括弧で読みを足したラベルは括弧の前で折る', () => {
    expect(wordTrait('はな（くさばな）')).toEqual({ kind: 'paren', len: 8 });
    expect(splitParen('はな（くさばな）')).toEqual(['はな', '（くさばな）']);
    expect(splitParen('はな')).toEqual(['はな', '']);
  });
  it('文・ラベルなしは語ではない', () => {
    expect(wordTrait('これは ながい ぶんしょうの せんたくしです')).toBeNull();
    expect(wordTrait(undefined)).toBeNull();
    expect(wordTrait('  ')).toBeNull();
  });
});

describe('optionTraits row4（文字だけの4つで最長9字以下は横1行。V2 3）', () => {
  const t = (...labels: string[]) => labels.map((label) => ({ label }));
  it('文字だけ4つ・9字以下なら row4', () => {
    expect(
      optionTraits(
        t('北アメリカ大陸', 'アフリカ大陸', 'ユーラシア大陸', 'オーストラリア大陸'),
        'grid',
        false,
      ).row4,
    ).toBe(true);
  });
  it('10字以上・4つでない・絵がある・long のときは row4 にしない', () => {
    expect(optionTraits(t('あ', 'い', 'う', 'あいうえおかきくけこ'), 'grid', false).row4).toBe(
      false,
    );
    expect(optionTraits(t('あ', 'い', 'う'), 'row', false).row4).toBe(false);
    expect(optionTraits(t('あ', 'い', 'う', 'え', 'お'), 'grid', false).row4).toBe(false);
    expect(
      optionTraits([{ label: 'あ', figure: {} }, ...t('い', 'う', 'え')], 'row', false).row4,
    ).toBe(false);
  });
});
