/**
 * build エンジン: タイル（かな・数字・部首・語）を並べて答えを作る。
 * 下のタイルをタップすると上の答えの列の後ろに並ぶ。上のタイルをタップすると下へ戻る（後ろのタイルは前へつめる）。
 * 正答の種類:
 *   text   … 並べた文字列（タイルを joiner でつなぐ）が values のどれかと同じ（表記ゆれを複数持てる）
 *   parts  … 部品の組（順不同。部首の組み立て）
 *   romaji … ローマ字（src/core/answer/romaji.ts。長音 ō/ou/oo を許容、訓令式は「もう一度」）
 */
import { useState } from 'react';
import { canonicalRomaji, judgeRomaji, segmentKana } from '../../core/answer/romaji';
import type { ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import type { Judgement } from '../types';
import {
  CheckButton,
  kanjiErrors,
  norm,
  shuffledIndices,
  TapCard,
  useMarks,
  type TapEngineDef,
  type TapProps,
} from '../order/shared';
import './build.css';

export type BuildAnswer =
  /** values: 正解の文字列（表記ゆれを並べる。先頭が正答の表記）。ignoreCase: 英字の大文字・小文字を区別しない */
  | { kind: 'text'; values: RichText[]; ignoreCase?: boolean }
  /** 部品の組（順不同）。例 ['日', '寺']（時） */
  | { kind: 'parts'; parts: RichText[] }
  /** ローマ字。kana の語を告示のつづりで（ō・ou・oo を許容）。capital: 語頭を大文字（地名・人名） */
  | { kind: 'romaji'; kana: string; capital?: boolean };

export interface BuildItem extends ItemBase {
  engine: 'build';
  /** タイル（RichText）。正解に要るものと、まぎらわしいもの。2〜12。同じ字が2回要るときは2枚書く */
  tiles: RichText[];
  answer: BuildAnswer;
  /** タイルをつなぐ文字（既定 ''。英語の語順は ' '） */
  joiner?: '' | ' ';
  /** タイルを混ぜない（五十音順・アルファベット順に並べたタイルなど） */
  fixedOrder?: boolean;
  /** 答えの長さ（空いている枠の数）を見せない */
  hideLength?: boolean;
  /**
   * よくある誤りと誤概念。value は並べた文字列（joiner でつないだもの）。
   * parts のときは部品を '+' でつなぐ（例 '日+守'）
   */
  wrongAnswers?: { value: string; misconception: string }[];
}

/** 答え: 並べたタイルの番号（前から順に） */
export type BuildResponse = number[];

const MAX_TILES = 12;

/** 比べるための形（joiner が '' なら空白を除く。ignoreCase なら小文字） */
function keyOf(item: BuildItem, s: string): string {
  let k = norm(s);
  if ((item.joiner ?? '') === '') k = k.replace(/\s+/g, '');
  if (item.answer.kind === 'text' && item.answer.ignoreCase) k = k.toLowerCase();
  if (item.answer.kind === 'romaji') k = k.toLowerCase();
  return k;
}
const tileKey = (item: BuildItem, i: number) => keyOf(item, item.tiles[i] ?? '');
function joined(item: BuildItem, res: number[]): string {
  return res.map((i) => norm(item.tiles[i] ?? '')).join(item.joiner ?? '');
}
const partsKey = (ks: string[]) => [...ks].sort().join('+');

/** ローマ字の、正解になるつづり（訓令式を除く）をすべて */
export function romajiSpellings(kana: string): string[] {
  let out = [''];
  for (const seg of segmentKana(kana)) {
    const alts = seg.filter((a) => !a.kunrei).map((a) => a.s);
    out = out.flatMap((p) => alts.map((a) => p + a));
    if (out.length > 512) break;
  }
  return out;
}

/** 正解の形（比べる形）の一覧。parts は部品の組の形 */
function acceptedKeys(item: BuildItem): string[] {
  const a = item.answer;
  if (a.kind === 'text') return a.values.map((v) => keyOf(item, v));
  if (a.kind === 'parts') return [partsKey(a.parts.map((p) => keyOf(item, p)))];
  try {
    return romajiSpellings(a.kana);
  } catch {
    return [];
  }
}

/** target を作るタイルの並び（各タイル1回まで）。見つからなければ null */
export function tilingFor(item: BuildItem, target: string): number[] | null {
  const n = item.tiles.length;
  const keys = item.tiles.map((_, i) => tileKey(item, i));
  const j = (item.joiner ?? '') === '' ? '' : ' ';
  const used = new Set<number>();
  const seq: number[] = [];
  const go = (s: string): boolean => {
    if (s === target) return true;
    for (let i = 0; i < n; i++) {
      if (used.has(i) || !keys[i]) continue;
      const t = s === '' ? keys[i]! : s + j + keys[i]!;
      if (!target.startsWith(t)) continue;
      used.add(i);
      seq.push(i);
      if (go(t)) return true;
      used.delete(i);
      seq.pop();
    }
    return false;
  };
  return go('') ? [...seq] : null;
}

/** 正答の並び（画面の正答表示・枠の数に使う）。作れなければ null */
export function answerTiling(item: BuildItem): number[] | null {
  const a = item.answer;
  if (a.kind === 'parts') {
    const left = item.tiles.map((_, i) => i);
    const out: number[] = [];
    for (const p of a.parts) {
      const k = keyOf(item, p);
      const at = left.findIndex((i) => tileKey(item, i) === k);
      if (at < 0) return null;
      out.push(left[at]!);
      left.splice(at, 1);
    }
    return out;
  }
  for (const target of acceptedKeys(item)) {
    const t = tilingFor(item, target);
    if (t) return t;
  }
  return null;
}

/** 並べた文字列の判定（wrongAnswers の検査にも使う） */
function judgeString(item: BuildItem, s: string, partKeys?: string[]): Judgement {
  const a = item.answer;
  if (a.kind === 'romaji') {
    const v = judgeRomaji(a.kana, s);
    if (v.result === 'retry')
      return { result: 'retry', message: `あたらしい かきかたでは ${v.canonical} と かくよ。` };
    if (v.result === 'correct') {
      if (a.capital && !/^[A-ZĀĪŪĒŌ]/.test(s.normalize('NFKC')))
        return { result: 'retry', message: 'はじめの もじは おおもじで かこう。' };
      return { result: 'correct' };
    }
    return { result: 'wrong' };
  }
  const key = a.kind === 'parts' ? partsKey(partKeys ?? []) : keyOf(item, s);
  return acceptedKeys(item).includes(key) ? { result: 'correct' } : { result: 'wrong' };
}

/** 最初に正答から外れた位置（印に使う） */
function firstOffPosition(item: BuildItem, res: number[]): number[] {
  const a = item.answer;
  if (a.kind === 'parts') {
    const need = a.parts.map((p) => keyOf(item, p));
    return res.flatMap((i, pos) => {
      const at = need.indexOf(tileKey(item, i));
      if (at < 0) return [pos];
      need.splice(at, 1);
      return [];
    });
  }
  const targets = acceptedKeys(item);
  const j = (item.joiner ?? '') === '' ? '' : ' ';
  let s = '';
  for (let pos = 0; pos < res.length; pos++) {
    s = pos === 0 ? tileKey(item, res[pos]!) : s + j + tileKey(item, res[pos]!);
    if (!targets.some((t) => t.startsWith(s))) return [pos];
  }
  return [];
}

export function judgeBuild(item: BuildItem, res: BuildResponse): Judgement {
  if (res.length === 0 || new Set(res).size !== res.length || res.some((i) => !item.tiles[i]))
    return { result: 'retry', message: 'ならべてから こたえあわせ しよう。' };
  const s = joined(item, res);
  const j = judgeString(
    item,
    s,
    res.map((i) => tileKey(item, i)),
  );
  if (j.result !== 'wrong') return j;
  const key =
    item.answer.kind === 'parts' ? partsKey(res.map((i) => tileKey(item, i))) : keyOf(item, s);
  const known = item.wrongAnswers?.find(
    (w) =>
      (item.answer.kind === 'parts'
        ? partsKey(w.value.split('+').map((p) => keyOf(item, p)))
        : keyOf(item, w.value)) === key,
  );
  return {
    result: 'wrong',
    misconception: known?.misconception,
    mark: firstOffPosition(item, res),
  };
}

export function checkBuild(item: BuildItem): string[] {
  const errs: string[] = [];
  const n = item.tiles.length;
  if (n < 2) errs.push('タイルが2つ未満');
  if (n > MAX_TILES) errs.push(`タイルは${MAX_TILES}まで（今 ${n}）`);
  if (item.tiles.some((t) => !norm(t))) errs.push('空のタイルがある');
  errs.push(...kanjiErrors(item.tiles));
  const a = item.answer;
  if (a.kind === 'text') {
    if (a.values.length === 0) errs.push('正解の文字列が無い');
    errs.push(...kanjiErrors(a.values));
  }
  if (a.kind === 'parts') {
    if (a.parts.length < 2) errs.push('部品の組は2つ以上');
    errs.push(...kanjiErrors(a.parts));
  }
  if (a.kind === 'romaji') {
    try {
      segmentKana(a.kana);
    } catch {
      errs.push(`ローマ字にできない かな: ${a.kana}`);
      return errs;
    }
    if ((item.joiner ?? '') !== '') errs.push('ローマ字のタイルは joiner を使わない');
  }
  const tiling = answerTiling(item);
  if (!tiling) errs.push('タイルで正答が作れない');
  else if (judgeBuild(item, tiling).result !== 'correct')
    errs.push('正答の並びが正解と判定されない');
  for (const w of item.wrongAnswers ?? []) {
    if (!w.misconception) errs.push(`誤答の例 ${w.value} に誤概念IDが無い`);
    const parts = a.kind === 'parts' ? w.value.split('+').map((p) => keyOf(item, p)) : undefined;
    if (judgeString(item, w.value, parts).result === 'correct')
      errs.push(`誤答の例 ${w.value} が正解と判定される`);
  }
  return errs;
}

export function answerTextOfBuild(item: BuildItem): RichText {
  const a = item.answer;
  if (a.kind === 'text') return a.values[0] ?? '';
  if (a.kind === 'parts') return a.parts.join(' ＋ ');
  const c = canonicalRomaji(a.kana);
  return a.capital ? c.charAt(0).toUpperCase() + c.slice(1) : c;
}

function BuildView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: TapProps<BuildItem, BuildResponse>) {
  const n = item.tiles.length;
  const order = item.fixedOrder
    ? item.tiles.map((_, i) => i)
    : shuffledIndices(item.id, 'build', n);
  const tiling = answerTiling(item);
  const slotCount = tiling?.length ?? n;
  const [placed, setPlaced] = useState<number[]>([]);
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const locked = disabled || revealed;
  const row = revealed && tiling ? tiling : placed;
  const empties = revealed
    ? 0
    : item.hideLength
      ? placed.length < n
        ? 1
        : 0
      : Math.max(0, slotCount - placed.length);

  const add = (i: number) => {
    if (locked || placed.includes(i)) return;
    setPlaced([...placed, i]);
    marks.clear(placed.length);
  };
  const remove = (pos: number) => {
    if (locked) return;
    setPlaced(placed.filter((_, p) => p !== pos));
    // つめた後ろの位置の印も消す（位置がずれるため）
    marks.clear(...Array.from({ length: placed.length - pos }, (_, k) => pos + k));
  };

  return (
    <div className="tk-frame eng-build">
      <div className="tk-frame__main">
        <div className="eng-build__answer" role="group" aria-label="こたえ">
          {revealed && !tiling ? (
            <span className="eng-build__text">
              <Rt text={answerTextOfBuild(item)} ctx={ctx} />
            </span>
          ) : (
            row.map((i, pos) => (
              <TapCard
                key={`${pos}-${i}`}
                card={{ label: item.tiles[i]! }}
                ctx={ctx}
                state={revealed ? 'correct' : marks.has(pos) ? 'wrong' : null}
                disabled={locked}
                onPress={() => remove(pos)}
                testId={`placed-${pos}`}
                className="eng-build__tile"
              />
            ))
          )}
          {Array.from({ length: empties }, (_, k) => (
            <span
              key={`e${k}`}
              className={['tk-slot', 'eng-build__slot', k === 0 ? 'is-next' : ''].join(' ')}
              aria-hidden
            />
          ))}
        </div>
        {!revealed ? (
          <div className="eng-build__pool" role="group" aria-label="ならべる もの">
            {order.map((i) =>
              placed.includes(i) ? (
                <span key={i} className="tk-slot eng-build__slot eng-build__ghost" aria-hidden />
              ) : (
                <TapCard
                  key={i}
                  card={{ label: item.tiles[i]! }}
                  ctx={ctx}
                  disabled={locked}
                  onPress={() => add(i)}
                  testId={`tile-${i}`}
                  className="eng-build__tile"
                />
              ),
            )}
          </div>
        ) : null}
      </div>
      {!revealed ? (
        <CheckButton disabled={disabled || placed.length === 0} onPress={() => submit(placed)} />
      ) : null}
    </div>
  );
}

export const buildEngine: TapEngineDef<BuildItem, BuildResponse> = {
  id: 'build',
  Component: BuildView,
  judge: judgeBuild,
  check: checkBuild,
  answerText: answerTextOfBuild,
};

export function buildMisconceptions(item: BuildItem): string[] {
  return (item.wrongAnswers ?? []).map((w) => w.misconception);
}
export function buildTexts(item: BuildItem): RichText[] {
  const a = item.answer;
  return [...item.tiles, ...(a.kind === 'text' ? a.values : a.kind === 'parts' ? a.parts : [])];
}
