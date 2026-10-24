/**
 * 漢字の書き問題の生成器（g3.ja.kanji-write-g3・g4.ja.kanji-write-g4 で共用）。kanji-g12 の write-gen.ts を元に、
 * 3年以上の書き方（分かち書きをしない通常の文）にした。
 *
 * 問題文・ヒントの漢字は1年の配当字だけにしている（3・4年の単元の「書く字」「復習の字」に1年の字は入らないので、
 * 問題文・ヒントに書く字が出てしまうことがない）。それ以外の漢字は使わず、かなで書く。
 *
 * 書く字は、問題文・ヒントに出さない。字は「ほかの漢字をかなにした文（問う字の読みを太字）」か
 * 「ことば（同じ形）」で示す（例: ろうそくに **ひ**を つける）。
 *   tr … なぞって書く（trace、書き順の判定）            objective 'trace'
 *   tf … なぞってから、自分で書く（trace-free）           objective 'trace'   alt
 *   fr … 文を見て、自分で書いてお手本と見比べる（free）     objective 'compare'
 *   fw … ことばを見て、自分で書いてお手本と見比べる         objective 'compare' alt
 *   cs … 文の太字の読みに合う字を、形の似た字・同音の字（文の意味で決まる）から選ぶ  objective 'choose'
 *   cw … ことばの太字の読みに合う字を、形の似た字から選ぶ   objective 'choose'  alt
 *   pt … その字の部品を並べる（build parts）            objective 'choose'  alt
 *   cn … 画数を選ぶ                                     objective 'order'
 *   fs … いちばんはじめに書く画を選ぶ                     objective 'order'   alt
 * 字そのものを出す問い（画数・はじめの画）では、字は図に出し、答えは字ではなく数・画の種類。
 * 読み（太字のかな）を必ず見せる: 文の□だけでは「林」と「森」のように意味が重なる字を選べないため。
 * なぞる・書く問題の問題文は1行にする（なぞり盤が大きく、2行にすると問題文と重なる）。
 *
 * 書きの習熟判定は前の学年の字まで（curriculum-matrix 2.2）: 2年の単元は、2年の字を練習の段階に、
 * 1年の字を最後の段階（仕上げ）に置く。1年の単元は1年の字だけ。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, GenerateContext, Item } from '../../curriculum/types';
import type { BuildItem } from '../../engines/build/build';
import type { TraceItem } from '../../engines/trace/trace';
import { PARTS, PART_DECOYS } from './data/parts';
import { PARTS_G34 } from './data/parts-g34';
import { FIRST_STROKE_LABEL, FIRST_STROKE_OF, STROKES_OF, type FirstStroke } from './data/strokes';
import { HOMOPHONE_OF, SIMILAR_OF, kanjiLabel, poolOf, readingsOf } from './shared';
import { ENTRY_OF, type KanjiEntry, type Occurrence } from './table';

export type WriteForm = 'tr' | 'tf' | 'fr' | 'fw' | 'cs' | 'cw' | 'pt' | 'cn' | 'fs';
type Form = WriteForm;

export interface WriteConfig {
  /** 使う字の学年の上限（選択肢・部品に使える字） */
  maxGrade: 1 | 2 | 3 | 4;
  /** 段階ごとの、書く字の集合 */
  charsAt: KanjiEntry[][];
  /** 段階ごとの形式の割合 */
  weights: [WriteForm, number][][];
  /** 選択肢の数（正解を含む） */
  options: number;
}

const PARTS_OF: ReadonlyMap<string, string[]> = new Map(
  `${PARTS}\n${PARTS_G34}`
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [c, rest] = l.split(':') as [string, string];
      return [c, [...rest]] as const;
    }),
);

const pickWeighted = (rng: Rng, table: [Form, number][]): Form => {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [f, w] of table) {
    r -= w;
    if (r < 0) return f;
  }
  return table[0]![0];
};

/** 「ことば」の手がかりに使えるか（問う字だけの語は、手がかりが無いので使わない） */
const hasContext = (o: Occurrence) => [...o.plain].length > 1;

export interface WriteModel {
  generate(ctx: GenerateContext): Item;
  /** 異なる問題（同一性キー）の総数 */
  domainSize: number;
}

export function makeWriteModel(cfg: WriteConfig): WriteModel {
  const pool = poolOf(cfg.maxGrade);
  const poolSet = new Set(pool.map((e) => e.ch));

  /** 部品で組み立てられる字（字も部品も、使える学年の字） */
  const partsChars = (entries: KanjiEntry[]) =>
    entries.filter((e) => {
      const ps = PARTS_OF.get(e.ch);
      return ps !== undefined && ps.every((p) => poolSet.has(p));
    });

  // ---- 共通の部品 ----
  const strokeCount = (ch: string): number => STROKES_OF.get(ch)!;
  const hintStroke = (ch: string) => `${strokeCount(ch)}かくでかくよ。`;

  /** 書く字の見出し（解説用） */
  const shownChar = (e: KanjiEntry, part: string) => `${e.ch}《${part}》`;

  /** なぞる・書く問題の問題文は1行にする（なぞり盤は大きく、2行にすると問題文と重なる） */
  const kanaPrompt = (occ: Occurrence, verb: string) => `${occ.kana}（${verb}）`;
  // 書く字の読みを示す文は、ほかの漢字をかなにしてある（occ.kana）

  const baseOf = (
    e: KanjiEntry,
    objective: string,
    level: number,
    form: Form,
    alt: boolean,
    extra: string,
  ) => ({
    objective,
    level,
    identity: `${e.ch}|write|${form}${extra ? `|${extra}` : ''}`,
    ...(alt ? { alt: true as const } : {}),
  });

  // ---- なぞる・書く ----
  function traceOf(
    e: KanjiEntry,
    level: number,
    mode: 'trace' | 'trace-free' | 'free',
    occ: Occurrence,
    form: Form,
    objective: 'trace' | 'compare',
    alt: boolean,
    verb: string,
    extra: string,
  ): TraceItem {
    const hasTrace = mode !== 'free';
    return {
      engine: 'trace',
      id: `${form}:${e.ch}${extra ? `:${extra}` : ''}`,
      prompt: kanaPrompt(occ, verb),
      char: e.ch,
      mode,
      ...(hasTrace
        ? { misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' } }
        : {}),
      hints: hasTrace
        ? [
            'ふといところの字《じ》を、はじめのまるからなぞろう。',
            '「みる」ボタンで、おてほんをもういちど見《み》られるよ。',
            `${hintStroke(e.ch)}かくじゅんばんをまもろう。`,
          ]
        : [
            'ふといところの字《じ》のかたちをおもいだそう。',
            '上《うえ》から下《した》、左《ひだり》から右《みぎ》へかいていくよ。',
            hintStroke(e.ch),
          ],
      explain: `「${shownChar(e, occ.part)}」は${strokeCount(e.ch)}かくだよ。上《うえ》から下《した》、左《ひだり》から右《みぎ》のじゅんでかこうね。`,
      ...baseOf(e, objective, level, form, alt, extra),
    };
  }

  // ---- 選ぶ ----
  /** 誤りの字（形の似た字と同音の字）を、必要な数だけ */
  function wrongChars(
    e: KanjiEntry,
    occ: Occurrence,
    rng: Rng,
    n: number,
    useHomophone: boolean,
  ): { ch: string; misconception: 'similar-shape' | 'same-sound' }[] {
    const out: { ch: string; misconception: 'similar-shape' | 'same-sound' }[] = [];
    const used = new Set<string>([e.ch]);
    if (useHomophone) {
      const homo = rng.shuffle(
        (HOMOPHONE_OF.get(e.ch) ?? []).filter((c) => poolSet.has(c) && !used.has(c)),
      );
      if (homo[0]) {
        used.add(homo[0]);
        out.push({ ch: homo[0], misconception: 'same-sound' });
      }
    }
    // 形の似た字: この文・語の読みと同じ読みを持つ字は、□に入ってしまうので使わない
    const sims = (SIMILAR_OF.get(e.ch) ?? []).filter((c) => {
      const x = ENTRY_OF.get(c);
      return !!x && poolSet.has(c) && !used.has(c) && !readingsOf(x).includes(occ.part);
    });
    // 似ている順の先頭を中心に、少し混ぜる
    const head = sims.slice(0, n + 1);
    for (const c of rng.shuffle(head).concat(sims.slice(n + 1))) {
      if (out.length >= n) break;
      used.add(c);
      out.push({ ch: c, misconception: 'similar-shape' });
    }
    // それでも足りないとき（まれ）: この字の読みと重ならない字から
    for (let t = 0; out.length < n && t < 80; t++) {
      const x = rng.pick(pool);
      if (used.has(x.ch) || readingsOf(x).includes(occ.part)) continue;
      used.add(x.ch);
      out.push({ ch: x.ch, misconception: 'similar-shape' });
    }
    return out;
  }

  function chooseOf(
    e: KanjiEntry,
    level: number,
    rng: Rng,
    occ: Occurrence,
    form: 'cs' | 'cw',
  ): ChoiceItem {
    const wrongs = wrongChars(e, occ, rng, cfg.options - 1, form === 'cs');
    const options = rng.shuffle([
      { label: kanjiLabel(e.ch), correct: true as const },
      ...wrongs.map((w) => ({ label: kanjiLabel(w.ch), misconception: w.misconception })),
    ]);
    const eliminate = wrongs[0]!.ch;
    const er = ENTRY_OF.get(eliminate)!;
    const isSent = form === 'cs';
    return {
      engine: 'choice',
      id: `${form}:${e.ch}${isSent ? '' : `:${occ.plain}`}`,
      prompt: `ふといひらがなにあてはまる字《じ》は、どれ？\n${occ.kana}`,
      hints: [
        isSent
          ? 'この文《ぶん》がなにをいっているか、かんがえてあてはまる字《じ》をえらぼう。'
          : 'ふといひらがなを、こえにだしてよんでみよう。',
        'かたちがにている字《じ》がならんでいるよ。よく見《み》くらべよう。',
        `「${eliminate}《${er.kun[0] ?? er.on[0]!}》」ではないよ。`,
      ],
      options,
      layout: 'row',
      explain: isSent
        ? `ふといところは「${shownChar(e, occ.part)}」だよ。\n${occ.shown}`
        : `「${occ.shown}」のふといところは「${shownChar(e, occ.part)}」だよ。`,
      ...baseOf(e, 'choose', level, form, form === 'cw', isSent ? '' : occ.plain),
    };
  }

  function partsOf(e: KanjiEntry, level: number, rng: Rng): BuildItem {
    const parts = PARTS_OF.get(e.ch)!;
    const decoyChars = [...PART_DECOYS].filter((c) => poolSet.has(c) && !parts.includes(c));
    const decoys = rng.sample(decoyChars, 2);
    const tiles = rng.shuffle([...parts, ...decoys]).map(kanjiLabel);
    const swap = parts.map((_, i) => {
      const d = decoys[i % decoys.length]!;
      return {
        value: parts.map((p, j) => kanjiLabel(j === i ? d : p)).join('+'),
        misconception: 'wrong-part',
      };
    });
    const seen = new Set<string>();
    const occ = e.sentence;
    return {
      engine: 'build',
      id: `pt:${e.ch}`,
      prompt: `ふといひらがなにあてはまる字《じ》の、ぶひんをならべよう。\n${occ.kana}`,
      tiles,
      answer: { kind: 'parts', parts: parts.map(kanjiLabel) },
      wrongAnswers: swap.filter((w) => {
        const k = w.value
          .split('+')
          .map((x) => x[0]!)
          .sort()
          .join('+');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
      hints: [
        'まず、ふといひらがなにあてはまる字《じ》をおもいだそう。',
        '字《じ》を二《ふた》つ、三《みっ》つのかたまりにわけてかんがえよう。',
        `ぶひんは${parts.length}つだよ。`,
      ],
      explain: `「${shownChar(e, occ.part)}」は${parts.map((p) => `「${kanjiLabel(p).replace('《!', '《')}」`).join('と')}でできているよ。`,
      ...baseOf(e, 'choose', level, 'pt', true, ''),
    };
  }

  // ---- 画数・はじめの画 ----
  const charFigure = (e: KanjiEntry) => ({
    kind: 'text' as const,
    text: `${e.ch}《!${e.kun[0] ?? e.on[0]!}》`,
    size: 'xl' as const,
  });

  function countOf(e: KanjiEntry, level: number, rng: Rng): ChoiceItem {
    const n = strokeCount(e.ch);
    const near = [n - 2, n - 1, n + 1, n + 2].filter((k) => k >= 1);
    // 近い数ほど出やすく
    const weighted = [n - 1, n + 1, n - 1, n + 1, n - 2, n + 2].filter((k) => near.includes(k));
    const wrong: number[] = [];
    for (const k of rng.shuffle(weighted)) {
      if (!wrong.includes(k) && wrong.length < cfg.options - 1) wrong.push(k);
    }
    for (const k of near) if (!wrong.includes(k) && wrong.length < cfg.options - 1) wrong.push(k);
    const options = rng.shuffle([
      { label: `${n}かく`, correct: true as const },
      ...wrong.map((k) => ({ label: `${k}かく`, misconception: 'stroke-count' })),
    ]);
    const lo = Math.max(0, n - 2);
    return {
      engine: 'choice',
      id: `cn:${e.ch}`,
      prompt: 'この字《じ》は、なんかくでかくかな？',
      figure: charFigure(e),
      hints: [
        'おてほんのうごきをおもいだして、一《ひと》つずつかぞえよう。',
        'よこ・たて・はらい…と、ゆびでたどってかぞえてみよう。',
        `${lo}かくよりおおくて、${n + 2}かくよりすくないよ。`,
      ],
      options,
      layout: 'row',
      explain: `「${shownChar(e, e.kun[0] ?? e.on[0]!)}」は${n}かくだよ。`,
      explainFigure: { kind: 'text', text: shownChar(e, e.kun[0] ?? e.on[0]!), size: 'xl' },
      ...baseOf(e, 'order', level, 'cn', false, ''),
    };
  }

  function firstOf(e: KanjiEntry, level: number, rng: Rng): ChoiceItem {
    const right = FIRST_STROKE_OF.get(e.ch)!;
    const all = Object.keys(FIRST_STROKE_LABEL) as FirstStroke[];
    const wrongs = rng.shuffle(all.filter((k) => k !== right)).slice(0, cfg.options - 1);
    const options = rng.shuffle([
      { label: FIRST_STROKE_LABEL[right], correct: true as const },
      ...wrongs.map((k) => ({ label: FIRST_STROKE_LABEL[k], misconception: 'stroke-order' })),
    ]);
    return {
      engine: 'choice',
      id: `fs:${e.ch}`,
      prompt: 'この字《じ》で、いちばんはじめにかく線《せん》はどれ？',
      figure: charFigure(e),
      hints: [
        '上《うえ》から下《した》、左《ひだり》から右《みぎ》へかくよ。',
        'この字《じ》をなぞったときの、はじめのうごきをおもいだしてみよう。',
        `「${FIRST_STROKE_LABEL[wrongs[0]!]}」ではじまらないよ。`,
      ],
      options,
      layout: 'row',
      explain: `「${shownChar(e, e.kun[0] ?? e.on[0]!)}」は「${FIRST_STROKE_LABEL[right]}」からかきはじめるよ。`,
      explainFigure: { kind: 'text', text: shownChar(e, e.kun[0] ?? e.on[0]!), size: 'xl' },
      ...baseOf(e, 'order', level, 'fs', true, ''),
    };
  }

  // ---- 定義域（同一性キーの全体） ----
  const allKeys = new Set<string>();
  for (const e of new Set(cfg.charsAt.flat())) {
    allKeys.add(`${e.ch}|write|tr`);
    allKeys.add(`${e.ch}|write|tf`);
    allKeys.add(`${e.ch}|write|fr`);
    allKeys.add(`${e.ch}|write|cs`);
    allKeys.add(`${e.ch}|write|cn`);
    if (FIRST_STROKE_OF.has(e.ch)) allKeys.add(`${e.ch}|write|fs`);
    if (partsChars([e]).length > 0) allKeys.add(`${e.ch}|write|pt`);
    for (const w of e.words) {
      allKeys.add(`${e.ch}|write|cw|${w.plain}`);
      if (hasContext(w)) allKeys.add(`${e.ch}|write|fw|${w.plain}`);
    }
  }

  function generate({ level, rng }: GenerateContext): Item {
    const lv = Math.min(level, cfg.weights.length - 1);
    const chars = cfg.charsAt[lv]!;
    let form = pickWeighted(rng, cfg.weights[lv]!);
    // その形式を作れる字の集合
    const cands = (f: Form): KanjiEntry[] =>
      f === 'fs'
        ? chars.filter((c) => FIRST_STROKE_OF.has(c.ch))
        : f === 'pt'
          ? partsChars(chars)
          : f === 'fw'
            ? chars.filter((c) => c.words.some(hasContext))
            : chars;
    if (cands(form).length === 0) form = 'cs';
    const e = rng.pick(cands(form));
    const sent = e.sentence;
    switch (form) {
      case 'tr':
        return traceOf(e, lv, 'trace', sent, 'tr', 'trace', false, 'なぞろう', '');
      case 'tf':
        return traceOf(e, lv, 'trace-free', sent, 'tf', 'trace', true, 'なぞってかこう', '');
      case 'fr':
        return traceOf(e, lv, 'free', sent, 'fr', 'compare', false, 'かこう', '');
      case 'fw': {
        const w = rng.pick(e.words.filter(hasContext));
        return traceOf(e, lv, 'free', w, 'fw', 'compare', true, 'かこう', w.plain);
      }
      case 'cs':
        return chooseOf(e, lv, rng, sent, 'cs');
      case 'cw':
        return chooseOf(e, lv, rng, rng.pick(e.words), 'cw');
      case 'pt':
        return partsOf(e, lv, rng);
      case 'cn':
        return countOf(e, lv, rng);
      case 'fs':
        return firstOf(e, lv, rng);
    }
  }

  return { generate, domainSize: allKeys.size };
}
