import { describe, expect, it } from 'vitest';
import { vocab } from '../../content/vocab';
import { getIllust } from '../../illust/registry';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import { voiceText } from '../../voice/types';
import { textOf } from '../../app/voiceText';
import {
  areSimilar,
  INCLUDED_KANA,
  KANA_TABLE,
  kanaOf,
  SIMILAR_GROUPS,
  TILE_KANA,
  WORDS_2,
  WORDS_3,
} from './kana-table';
import {
  displayOf,
  showsExample,
  generateRound,
  hintSeq,
  hintText,
  judgeChoice,
  judgePlace,
  promptOf,
  recapSeq,
  thatIsSeq,
  wordChars,
  type BuildQuestion,
  type ChoiceQuestion,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const LEVEL_NAMES = ['H1', 'H2', 'H3', 'H4', 'H5'];
const SIZES = [3, 4, 5];

function seqKeys(seq: unknown): string[] {
  const arr = Array.isArray(seq) ? seq : [seq];
  return arr.filter((k): k is string => typeof k === 'string');
}

describe('収録表（kana-table）', () => {
  it('清音46字＋濁音・半濁音25字', () => {
    expect(KANA_TABLE.filter((e) => 'あかさたなはまやらわ'.includes(e.row)).length).toBe(46);
    expect(KANA_TABLE).toHaveLength(71);
    expect(new Set(KANA_TABLE.map((e) => e.char)).size).toBe(71);
    expect(new Set(KANA_TABLE.map((e) => e.romaji)).size).toBe(71);
  });
  it('収録は20字、タイル専用は8字', () => {
    expect(INCLUDED_KANA).toHaveLength(20);
    expect(KANA_TABLE.filter((e) => e.tileOnly)).toHaveLength(8);
    expect(TILE_KANA).toHaveLength(28);
  });
  it('例語の語頭がその字で、vocab に存在し、絵が final', () => {
    for (const e of INCLUDED_KANA) {
      expect(e.word, e.char).toBeDefined();
      expect([...vocab(e.word!).label][0], `${e.char}:${e.word}`).toBe(e.char);
      expect(getIllust(e.word!)?.status, e.word).toBe('final');
    }
  });
  it('言葉づくりの語: 2文字13語・3文字4語、絵が final、字がすべて収録字かタイル専用字', () => {
    expect(WORDS_2).toHaveLength(13);
    expect(WORDS_3).toHaveLength(4);
    for (const id of WORDS_2) expect(wordChars(id), id).toHaveLength(2);
    for (const id of WORDS_3) expect(wordChars(id), id).toHaveLength(3);
    for (const id of [...WORDS_2, ...WORDS_3]) {
      expect(getIllust(id)?.status, id).toBe('final');
      for (const c of wordChars(id)) expect(TILE_KANA, `${id}:${c}`).toContain(c);
    }
  });
  it('語頭の問題に出す字は、20字の例語だけ（点検表の不採用語を含まない）', () => {
    const labels = INCLUDED_KANA.map((e) => vocab(e.word!).label);
    for (const bad of ['はし', 'かき', 'くも', 'はな']) expect(labels).not.toContain(bad);
  });
  it('似た形の組は収録字から作られている', () => {
    for (const g of SIMILAR_GROUPS)
      for (const c of g) expect(KANA_TABLE.some((e) => e.char === c)).toBe(true);
    expect(areSimilar('あ', 'お')).toBe(true);
    expect(areSimilar('あ', 'い')).toBe(false);
  });
});

describe('generateRound（seed 1..200 × 全段階）', () => {
  for (let level = 0; level < 5; level++) {
    for (const size of SIZES) {
      it(`${LEVEL_NAMES[level]} size=${size}`, () => {
        for (const seed of SEEDS) {
          const ctx = `level=${LEVEL_NAMES[level]} size=${size} seed=${seed}`;
          const qs = generateRound(level, seed, size);
          const expected = level === 4 ? Math.min(size, WORDS_3.length) : size;
          expect(qs, ctx).toHaveLength(expected);
          const keys = qs.map((x) => x.itemKey);
          expect(new Set(keys).size, `${ctx} 重複`).toBe(qs.length);
          for (const x of qs) {
            if (x.kind === 'build') {
              expectBuild(x, level, ctx);
            } else {
              expectChoice(x, level, ctx);
            }
          }
        }
      });
    }
  }

  it('同じ seed なら同じ問題', () => {
    for (let level = 0; level < 5; level++) {
      expect(generateRound(level, 7, 4)).toEqual(generateRound(level, 7, 4));
    }
  });

  it('H1〜H3: 正解位置が偏らない（各位置の差が1回の中で1以下、3連続しない）', () => {
    for (const level of [0, 1, 2]) {
      const n = level === 1 ? 3 : 2;
      for (const size of SIZES) {
        const total = new Array<number>(n).fill(0);
        for (const seed of SEEDS) {
          const qs = generateRound(level, seed, size) as ChoiceQuestion[];
          const counts = new Array<number>(n).fill(0);
          qs.forEach((x, i) => {
            counts[x.answerIndex]! += 1;
            total[x.answerIndex]! += 1;
            if (i >= 2 && x.answerIndex === qs[i - 1]!.answerIndex) {
              expect(x.answerIndex, `level=${level} seed=${seed}`).not.toBe(qs[i - 2]!.answerIndex);
            }
          });
          expect(
            Math.max(...counts) - Math.min(...counts),
            `level=${level} seed=${seed}`,
          ).toBeLessThanOrEqual(1);
        }
        const avg = (SEEDS.length * size) / n;
        for (const t of total) expect(Math.abs(t - avg)).toBeLessThan(avg * 0.15);
      }
    }
  });

  it('H4・H5: ひっかけタイルの位置が偏らない', () => {
    for (const level of [3, 4]) {
      const size = level === 3 ? 4 : 4;
      const n = level === 3 ? 3 : 4;
      const total = new Array<number>(n).fill(0);
      for (const seed of SEEDS) {
        const qs = generateRound(level, seed, size) as BuildQuestion[];
        for (const x of qs) {
          const rest = [...x.chars];
          const idx = x.tiles.findIndex((t) => {
            const k = rest.indexOf(t);
            if (k >= 0) {
              rest.splice(k, 1);
              return false;
            }
            return true;
          });
          expect(idx, `level=${level} seed=${seed}`).toBeGreaterThanOrEqual(0);
          total[idx]! += 1;
        }
      }
      const avg = (SEEDS.length * size) / n;
      for (const t of total) expect(Math.abs(t - avg), `level=${level}`).toBeLessThan(avg * 0.2);
    }
  });

  it('全20字・全17語が出題されうる', () => {
    const chars = new Set<string>();
    const words = new Set<string>();
    for (const seed of SEEDS) {
      for (const x of generateRound(0, seed, 5)) if (x.kind !== 'build') chars.add(x.answer);
      for (const x of generateRound(3, seed, 5)) words.add(x.itemKey);
      for (const x of generateRound(4, seed, 5)) words.add(x.itemKey);
    }
    expect(chars.size).toBe(20);
    expect(words.size).toBe(17);
  });
});

function expectChoice(x: ChoiceQuestion | BuildQuestion, level: number, ctx: string) {
  if (x.kind === 'build') throw new Error(ctx);
  const n = level === 1 ? 3 : 2;
  expect(x.kind, ctx).toBe(level === 2 ? 'first' : 'pick');
  expect(x.choices, ctx).toHaveLength(n);
  expect(new Set(x.choices).size, ctx).toBe(n);
  expect(x.choices[x.answerIndex], ctx).toBe(x.answer);
  // 語頭が正しい
  expect([...vocab(x.word).label][0], ctx).toBe(x.answer);
  // 選択肢はすべて収録字
  for (const c of x.choices)
    expect(
      INCLUDED_KANA.some((e) => e.char === c),
      `${ctx} ${c}`,
    ).toBe(true);
  // 似た形の組が同時に出ない
  for (let i = 0; i < x.choices.length; i++)
    for (let j = i + 1; j < x.choices.length; j++)
      expect(
        areSimilar(x.choices[i]!, x.choices[j]!),
        `${ctx} ${x.choices[i]}-${x.choices[j]}`,
      ).toBe(false);
  // 判定
  x.choices.forEach((_, i) => expect(judgeChoice(x, i), ctx).toBe(i === x.answerIndex));
}

function expectBuild(x: BuildQuestion, level: number, ctx: string) {
  const len = level === 3 ? 2 : 3;
  expect(x.chars, ctx).toHaveLength(len);
  expect(x.chars.join(''), ctx).toBe(vocab(x.word).label);
  expect(x.tiles, ctx).toHaveLength(len + 1);
  // タイルに正解の字がすべてある（重複する字も数が足りる）
  const rest = [...x.tiles];
  for (const c of x.chars) {
    const k = rest.indexOf(c);
    expect(k, `${ctx} 字 ${c}`).toBeGreaterThanOrEqual(0);
    rest.splice(k, 1);
  }
  // 残り1枚がひっかけ: 言葉の字と同じでなく、形も似ていない
  expect(rest, ctx).toHaveLength(1);
  const extra = rest[0]!;
  for (const c of x.chars)
    expect(areSimilar(extra, c), `${ctx} ひっかけ ${extra}-${c}`).toBe(false);
  // 並べると一発で言葉にならない
  if (!x.chars.every((c) => c === x.chars[0])) {
    expect(x.tiles.slice(0, len).join(''), ctx).not.toBe(x.chars.join(''));
  }
  // 判定: 正しい順に置けば完成し、違う字は弾かれる
  x.chars.forEach((c, i) => {
    expect(judgePlace(x, i, c), ctx).toBe(true);
    expect(judgePlace(x, i, extra), ctx).toBe(false);
  });
}

describe('判定の境界', () => {
  it('judgePlace は次のマスの字だけを受け付ける', () => {
    const [q] = generateRound(3, 1, 1) as BuildQuestion[];
    expect(judgePlace(q!, 0, q!.chars[0]!)).toBe(true);
    expect(judgePlace(q!, 2, q!.chars[0]!)).toBe(false);
  });
});

describe('音声と表示の一致', () => {
  it('問題文・ヒント・誤答・完了の読み上げキーがすべて台本にある', () => {
    for (let level = 0; level < 5; level++) {
      for (const seed of SEEDS.slice(0, 50)) {
        const qs = generateRound(level, seed, 5);
        for (const q of qs) {
          const all: unknown[] = [promptOf(q)];
          for (const h of [1, 2] as const) {
            const n = q.kind === 'build' ? q.chars.length : 1;
            for (let f = 0; f < n; f++) all.push(hintSeq(q, h, f));
          }
          if (q.kind !== 'build') for (const c of q.choices) all.push(thatIsSeq(c));
          else for (const c of q.tiles) all.push(thatIsSeq(c));
          for (const s of all) {
            for (const k of seqKeys(s)) {
              expect(VOICE_CATALOG[k], `${k} level=${level} seed=${seed}`).toBeDefined();
            }
          }
          expect(hintText(q, 1)).not.toBe('');
          expect(hintText(q, 2)).not.toBe('');
        }
        for (const k of seqKeys(recapSeq(qs))) expect(VOICE_CATALOG[k], k).toBeDefined();
      }
    }
  });
  it('H1/H2 の1段目のヒントの文は答えの字を含まない', () => {
    for (const seed of SEEDS) {
      for (const q of generateRound(0, seed, 5) as ChoiceQuestion[]) {
        expect(hintText(q, 1)).toBe('もういちど きいてね');
      }
    }
  });
  it('収録字・タイル専用字の音声がある', () => {
    for (const e of KANA_TABLE.filter((x) => x.included || x.tileOnly)) {
      expect(voiceText(VOICE_CATALOG[`kana.char.${e.romaji}`]!), e.char).toBe(e.char);
    }
  });
  it('音が使えるときの上部の文・ヒント2の吹き出しは答えの字を含まない', () => {
    for (const level of [0, 1, 2]) {
      for (const seed of SEEDS) {
        for (const q of generateRound(level, seed, 5) as ChoiceQuestion[]) {
          const shown = textOf(displayOf(q, false));
          expect(shown, `level=${level} seed=${seed}`).not.toContain(`『${q.answer}』`);
          expect(shown).toBe(
            q.kind === 'pick' ? 'こえを きいて えらぼう' : 'はじめの おとは どれかな',
          );
          if (q.kind === 'pick') expect(hintText(q, 2)).not.toContain('『');
          // 字入りの文は silent のときだけ
          if (q.kind === 'pick') expect(textOf(displayOf(q, true))).toContain(q.answer);
        }
      }
    }
  });
  it('H4/H5 ヒント2: 例語が語そのもの・例語なしのときは絵を出さず位置を言う', () => {
    for (const level of [3, 4]) {
      for (const seed of SEEDS.slice(0, 60)) {
        for (const q of generateRound(level, seed, 5) as BuildQuestion[]) {
          q.chars.forEach((c, i) => {
            const w = kanaOf(c).word;
            const shows = showsExample(q, i);
            expect(shows, `${q.word}:${c}`).toBe(w !== undefined && w !== q.word);
            const seq = hintSeq(q, 2, i);
            expect(seq).toEqual(
              shows ? [`kana.ex.${kanaOf(c).romaji}`] : [`kana.pos.${q.word}.${i + 1}`],
            );
            expect(hintText(q, 2, i)).not.toBe(hintText(q, 1, i));
          });
        }
      }
    }
  });
  it('似た形の組を広げた（ね ぬ め れ わ / る ろ ぬ）', () => {
    for (const [a, b] of [
      ['ね', 'ぬ'],
      ['め', 'わ'],
      ['ぬ', 'ろ'],
      ['る', 'ぬ'],
    ]) {
      expect(areSimilar(a!, b!)).toBe(true);
    }
  });
  it('H3 の問題文は語の名前を言ってから「はじめの おと」を聞く', () => {
    const [q] = generateRound(2, 3, 1);
    const s = promptOf(q!) as (string | number)[];
    expect(s[0]).toBe(`item.${(q as ChoiceQuestion).word}`);
  });
});
