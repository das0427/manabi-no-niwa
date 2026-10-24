/**
 * reading エンジン: 読解。左に本文（段落・文）、右に設問の選択肢（choice と同じ判定）。
 *
 * - 観点（順序・人物・中心文・要旨 など。curriculum-matrix 1.3）を問題データに持つ。
 * - ヒントに本文の場所（段落番号・文番号）を結び付けられる（hintFocus）。ヒントを見せると、その文を破線で囲む。
 *   ※ 見せたヒントの数は実行枠から hintsShown で受け取る（EngineProps への追加を提案中。無ければ強調しない）。
 * - 正答を見せるとき（revealed）は答えの根拠（evidence）の文に下線を引く。
 * - 本文の読み上げは任意の札（自動では読まない）。読み上げの設定が off のときは札を出さない。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio/index';
import type { ChoiceOption, Item, ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { findBareKanji } from '../../text/rich';
import { Tap } from '../../ui/Tap';
import type { VoiceSeq } from '../../voice/catalog/index';
import { registerRich } from '../../voice/dynamic';
import type { ChoiceResponse } from '../choice/choice';
import { Figure } from '../figure/Figure';
import type { Figure as FigureData } from '../figure/types';
import type { EngineProps, Judgement } from '../types';
import { flatSeq } from '../listen/listen';
import { checkOptions, ChoiceOptions, correctLabels, judgeOptions } from '../listen/options';
import './reading.css';

/** 文種（curriculum-matrix 1.3: 2種以上） */
export type ReadingGenre = 'story' | 'explain' | 'record' | 'letter' | 'poem' | 'chart';
/** 観点（curriculum-matrix 1.3: 観点ごとに5問） */
export type ReadingAspect =
  'order' | 'character' | 'main-sentence' | 'gist' | 'detail' | 'reason' | 'feeling';

export interface ReadingPassage {
  /** 本文のID（同じ本文を複数の設問で共有する。復習で同じ本文を30日空けるのに使う） */
  id: string;
  title?: RichText;
  genre: ReadingGenre;
  /** 段落 → 文。文は RichText（漢字は《よみ》付き） */
  paragraphs: RichText[][];
  /** 段落に番号（①②…）を付ける（説明文の形式段落） */
  numbered?: boolean;
  /** 図表（図表つきの文種） */
  figure?: FigureData;
}

/** 本文の場所。p = 段落番号、s = 段落の中の文番号（どちらも1から）。s を省くと段落全体 */
export interface ReadingLoc {
  p: number;
  s?: number;
}

export interface ReadingItem extends ItemBase {
  engine: 'reading';
  passage: ReadingPassage;
  aspect: ReadingAspect;
  options: ChoiceOption[];
  multi?: boolean;
  fixedOrder?: boolean;
  /** 選択肢の並び（既定 column。文の選択肢は縦に並べる） */
  layout?: 'row' | 'grid' | 'column';
  /** hintFocus[i] = hints[i] を見せたときに囲む場所（null は囲まない）。長さは hints 以下 */
  hintFocus?: (ReadingLoc[] | null)[];
  /** 答えの根拠の場所（正答を見せるときに下線） */
  evidence?: ReadingLoc[];
}

export type ReadingResponse = ChoiceResponse;

export function judgeReading(item: ReadingItem, picked: ReadingResponse): Judgement {
  return judgeOptions(item, picked);
}

function checkLoc(p: ReadingPassage, l: ReadingLoc, what: string): string | null {
  const para = p.paragraphs[l.p - 1];
  if (!Number.isInteger(l.p) || !para) return `${what}: 段落 ${l.p} が無い`;
  if (l.s !== undefined && (!Number.isInteger(l.s) || !para[l.s - 1]))
    return `${what}: 段落 ${l.p} の文 ${l.s} が無い`;
  return null;
}

export function checkReading(item: ReadingItem): string[] {
  const errs = checkOptions(item);
  const p = item.passage;
  if (!p.id) errs.push('本文のIDが無い');
  if (p.paragraphs.length === 0) errs.push('本文が無い');
  p.paragraphs.forEach((para, i) => {
    if (para.length === 0) errs.push(`段落 ${i + 1} に文が無い`);
    for (const s of para) {
      if (!s.trim()) errs.push(`段落 ${i + 1} に空の文がある`);
      for (const k of findBareKanji(s)) errs.push(`本文: よみの無い漢字「${k}」`);
    }
  });
  if (p.title) for (const k of findBareKanji(p.title)) errs.push(`題: よみの無い漢字「${k}」`);
  for (const o of item.options)
    if (o.label)
      for (const k of findBareKanji(o.label)) errs.push(`選択肢: よみの無い漢字「${k}」`);
  if ((item.hintFocus?.length ?? 0) > item.hints.length)
    errs.push('hintFocus がヒントの数より多い');
  item.hintFocus?.forEach((locs, i) => {
    for (const l of locs ?? []) {
      const e = checkLoc(p, l, `ヒント${i + 1}の場所`);
      if (e) errs.push(e);
    }
  });
  for (const l of item.evidence ?? []) {
    const e = checkLoc(p, l, '根拠の場所');
    if (e) errs.push(e);
  }
  return errs;
}

export const readingAnswerText = (item: ReadingItem): RichText => correctLabels(item);

/** 場所の一覧に、段落 p（1から）の文 s（1から）が含まれるか */
export function locHas(locs: readonly ReadingLoc[] | null | undefined, p: number, s: number) {
  return (locs ?? []).some((l) => l.p === p && (l.s === undefined || l.s === s));
}

/** 本文の読み上げの列（題 → 段落ごとに少し間をあける） */
export function passageSeq(p: ReadingPassage, packId: string): VoiceSeq {
  const out: (string | number)[] = [];
  if (p.title) out.push(...flatSeq(registerRich(packId, p.title)), 500);
  p.paragraphs.forEach((para, i) => {
    if (i > 0) out.push(400);
    for (const s of para) out.push(...flatSeq(registerRich(packId, s)));
  });
  return out;
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

// ---- 画面 ----

type Props = Omit<EngineProps<Item, ReadingResponse>, 'item'> & {
  item: ReadingItem;
  /** 見せたヒントの数（実行枠から。提案中の追加） */
  hintsShown?: number;
};

function ReadingView({ item, ctx, revealed, wrongMark, disabled, submit, hintsShown = 0 }: Props) {
  const p = item.passage;
  const [reading, setReading] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const seq = useMemo(() => passageSeq(p, ctx.packId), [p, ctx.packId]);
  const toggleRead = () => {
    if (reading) {
      audio.stop();
      setReading(false);
      return;
    }
    setReading(true);
    void audio.play(seq).then(() => {
      if (alive.current) setReading(false);
    });
  };
  // 最後に見せたヒントの場所
  const focus = hintsShown > 0 ? (item.hintFocus?.[hintsShown - 1] ?? null) : null;
  const evidence = revealed ? item.evidence : null;
  const focusRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [hintsShown, revealed]);
  const marks = (pi: number, si: number) => ({
    focus: locHas(focus, pi + 1, si + 1),
    evidence: locHas(evidence, pi + 1, si + 1),
  });
  // 強調する最初の文（見える所までスクロールする）
  let firstKey = '';
  p.paragraphs.forEach((para, pi) =>
    para.forEach((_, si) => {
      const m = marks(pi, si);
      if (!firstKey && (m.focus || m.evidence)) firstKey = `${pi}-${si}`;
    }),
  );

  const size = ctx.learnerGrade >= 5 ? 's' : ctx.learnerGrade >= 3 ? 'm' : 'l';
  return (
    <div className="eng-reading">
      <section
        className={`eng-reading__passage eng-reading__passage--${size}`}
        aria-label="ほんぶん"
        data-testid="reading-passage"
      >
        {p.title ? (
          <h3 className="eng-reading__title">
            <Rt text={p.title} ctx={ctx} />
          </h3>
        ) : null}
        {p.figure ? (
          <div className="eng-reading__figure">
            <Figure fig={p.figure} ctx={ctx} />
          </div>
        ) : null}
        {p.paragraphs.map((para, pi) => (
          <p key={pi} className="eng-reading__para" data-p={pi + 1}>
            {p.numbered ? (
              <span className="eng-reading__num" aria-label={`だん ${pi + 1}`}>
                {CIRCLED[pi] ?? `(${pi + 1})`}
              </span>
            ) : null}
            {para.map((s, si) => {
              const { focus: isFocus, evidence: isEvidence } = marks(pi, si);
              return (
                <span
                  key={si}
                  ref={firstKey === `${pi}-${si}` ? focusRef : undefined}
                  className={[
                    'eng-reading__s',
                    isFocus ? 'is-focus' : '',
                    isEvidence ? 'is-evidence' : '',
                  ].join(' ')}
                  data-testid={`s-${pi + 1}-${si + 1}`}
                  data-mark={isEvidence ? 'evidence' : isFocus ? 'focus' : undefined}
                >
                  <Rt text={s} ctx={ctx} />
                </span>
              );
            })}
          </p>
        ))}
      </section>
      <div className="eng-reading__side">
        {ctx.readAloud !== 'off' ? (
          <Tap
            label={reading ? 'よむのを とめる' : 'ほんぶんを きく'}
            icon="listen"
            variant="white"
            size="aux"
            state={reading ? 'selected' : null}
            text={
              <span className="eng-reading__read-text">
                {reading ? 'とめる' : 'ほんぶんを きく'}
              </span>
            }
            onPress={toggleRead}
            testId="read-passage"
            className="eng-reading__read"
          />
        ) : null}
        <ChoiceOptions
          part={{ ...item, layout: item.layout ?? 'column' }}
          ctx={ctx}
          revealed={revealed}
          wrongMark={wrongMark}
          locked={disabled}
          submit={submit}
          className="eng-reading__opts"
        />
      </div>
    </div>
  );
}

export interface ReadingEngineDef {
  id: 'reading';
  Component: (props: Props) => ReactNode;
  judge(item: ReadingItem, response: ReadingResponse): Judgement;
  check(item: ReadingItem): string[];
  answerText(item: ReadingItem): RichText;
}

export const readingEngine: ReadingEngineDef = {
  id: 'reading',
  Component: ReadingView,
  judge: judgeReading,
  check: checkReading,
  answerText: readingAnswerText,
};
