/**
 * clock エンジン: 時計。
 *  read    … 時計を読む（何時何分。選択肢から選ぶ、または数字キーで「□じ □ふん」）
 *  pick    … 時刻に合う時計を選ぶ（幼児の「3じの とけいは どれ？」）
 *  set     … 針を合わせる（はりを選んで文字盤をタップ、または「5ふん すすむ／もどる」の札。ドラッグ不要）
 *  elapsed … 時間の経過（はじめと おわりの2つの時計と経過の帯。かかった時間／おわりの時刻を答える）
 * 短針は長針に連動する（実際の時計と同じ: 針の状態は 0:00 からの分 0〜719 の1つの値）。
 */
import { useState } from 'react';
import { parseNumberInput, RETRY_MESSAGE } from '../../core/answer/number';
import type { ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { svgPoint, type KitEngineDef, type KitProps } from '../numberline/kit';
import { NumFields, NumKeys, useNumEntry, type PadField } from '../numberline/NumPad';
import type { Judgement } from '../types';
import './clock.css';

/** 時刻（h は 0〜23、m は 0〜59。文字盤は12時間なので h と h+12 は同じ針） */
export interface ClockTime {
  h: number;
  m: number;
}

/** 合わせる問題の針の動かし方の細かさ（分）。1: 1分ずつ、5: 5分きざみ、60: 何時ちょうどだけ */
export type ClockStep = 1 | 5 | 10 | 15 | 30 | 60;

export type ClockTask =
  | {
      kind: 'read';
      time: ClockTime;
      answerBy: 'choice';
      /** 選択肢の時刻（正答の時刻を1つだけ含める） */
      options: ClockTime[];
      /** 30分を「はん」と書く（小1の「7じはん」） */
      halfWord?: boolean;
    }
  | {
      kind: 'read';
      time: ClockTime;
      answerBy: 'input';
      /** 「□じ」だけを答える（何時ちょうどの問題） */
      hourOnly?: boolean;
    }
  | {
      kind: 'pick';
      /** この時刻の時計を選ぶ（時刻は問題文に書く） */
      time: ClockTime;
      /** 選択肢の時計（正答を1つだけ含める） */
      options: ClockTime[];
    }
  | {
      kind: 'set';
      /** 合わせる時刻（分単位で一致したら正答） */
      target: ClockTime;
      /** 針の最初の位置（省略時 12:00） */
      start?: ClockTime;
      /** 針の動かし方の細かさ（既定 1） */
      step?: ClockStep;
    }
  | {
      kind: 'elapsed';
      start: ClockTime;
      end: ClockTime;
      /** かかった時間を答える */
      ask: 'duration';
      /** min: 「□ふん」、hm: 「□じかん □ふん」（既定 min） */
      unit?: 'min' | 'hm';
    }
  | {
      kind: 'elapsed';
      start: ClockTime;
      end: ClockTime;
      /** おわりの時刻を答える（数字キー、または2つ目の時計の針を合わせる） */
      ask: 'end';
      answerBy: 'input' | 'set';
      step?: ClockStep;
    };

/** 自動で推定する誤り（問題ごとに誤概念IDを結ぶ） */
export type ClockMis =
  /** 長針と短針を取り違えた（3:00 → 12:15） */
  | 'swapHands'
  /** 次の時刻を読んだ（7:45 → 8:45） */
  | 'hourNext'
  /** 前の時刻を読んだ */
  | 'hourPrev'
  /** 長針の指す数字をそのまま分とした（3:20 → 3:04） */
  | 'minuteNumeral'
  /** 60分で繰り上げない（8:40 の 30分後 → 8:70） */
  | 'noCarry'
  /** 時刻を100進法の数とみて引いた（9:50→10:25 を 75分） */
  | 'base100';

export interface ClockItem extends ItemBase {
  engine: 'clock';
  task: ClockTask;
  /** 文字盤の外側に 5・10・15… の分の数字を書く */
  minuteNumbers?: boolean;
  /** 時計の下に ごぜん／ごご を書く（h で決める） */
  dayHalf?: boolean;
  misconceptions?: Partial<Record<ClockMis, string>>;
  /** 決まった誤答 → 誤概念（time: 時刻の誤答、minutes: かかった時間の誤答） */
  wrongAnswers?: { time?: ClockTime; minutes?: number; misconception: string }[];
}

/** pick: 選んだ番号、fields: 数字キーの欄、total: 針の位置（0:00 からの分 0〜719） */
export type ClockResponse = { pick: number } | { fields: string[] } | { total: number };

// ---- 時刻の計算 ----
const DIAL = 720;
/** 文字盤の上の位置（0:00 からの分。12時間で一周） */
export function dialOf(t: ClockTime): number {
  return (((t.h * 60 + t.m) % DIAL) + DIAL) % DIAL;
}
function fromDial(total: number): ClockTime {
  const v = ((total % DIAL) + DIAL) % DIAL;
  return { h: Math.floor(v / 60), m: v % 60 };
}
/** かかった時間（分）。おわりが はじめより前なら日をまたぐとみる */
export function durationOf(start: ClockTime, end: ClockTime): number {
  const d = end.h * 60 + end.m - (start.h * 60 + start.m);
  return d > 0 ? d : d + 1440;
}
function endOf(task: Extract<ClockTask, { kind: 'elapsed' }>): ClockTime {
  return task.end;
}

function minuteWord(m: number): string {
  return [0, 1, 3, 4, 6, 8].includes(m % 10) ? 'ぷん' : 'ふん';
}

/** 時刻の文（ひらがな）。例 3じ、3じはん、3じ20ぷん、ごご3じ5ふん */
export function timeText(
  t: ClockTime,
  opts: { halfWord?: boolean; dayHalf?: boolean } = {},
): string {
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  const pre = opts.dayHalf ? (t.h < 12 ? 'ごぜん' : 'ごご') : '';
  // 文字盤だけなら 0時は「12じ」。ごぜん／ごご を付けるときは 0〜11（ごぜん0じ・ごご0じ）
  const hour = opts.dayHalf ? t.h % 12 : h12;
  if (t.m === 0) return `${pre}${hour}じ`;
  if (t.m === 30 && opts.halfWord) return `${pre}${hour}じはん`;
  return `${pre}${hour}じ${t.m}${minuteWord(t.m)}`;
}

export function durationText(min: number, unit: 'min' | 'hm' = 'min'): string {
  if (unit === 'min' || min < 60) return `${min}${minuteWord(min)}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}じかん` : `${h}じかん${m}${minuteWord(m)}`;
}

function sameDial(a: ClockTime, b: ClockTime): boolean {
  return dialOf(a) === dialOf(b);
}

/** 誤りの時刻から誤概念を推定する */
function classifyTime(item: ClockItem, want: ClockTime, got: ClockTime): string | undefined {
  const known = item.wrongAnswers?.find(
    (w) => w.time && dialOf(w.time) === dialOf(got) && w.time.m === got.m,
  );
  if (known) return known.misconception;
  const mis = item.misconceptions ?? {};
  const h = (x: number) => ((x % 12) + 12) % 12;
  if (mis.noCarry && got.m >= 60 && dialOf(got) === dialOf(want)) return mis.noCarry;
  if (
    mis.swapHands &&
    want.m % 5 === 0 &&
    h(got.h) === h(want.m / 5) &&
    got.m === h(want.h) * 5 &&
    !sameDial(got, want)
  )
    return mis.swapHands;
  if (
    mis.minuteNumeral &&
    want.m % 5 === 0 &&
    want.m >= 10 &&
    h(got.h) === h(want.h) &&
    got.m === want.m / 5
  )
    return mis.minuteNumeral;
  if (mis.hourNext && got.m === want.m && h(got.h) === h(want.h + 1)) return mis.hourNext;
  if (mis.hourPrev && got.m === want.m && h(got.h) === h(want.h - 1)) return mis.hourPrev;
  return undefined;
}

/** 欄の文字列を0以上の整数に（読めなければ null） */
function intOf(s: string | undefined): number | null {
  const p = parseNumberInput(s ?? '');
  if (!p || p.form !== 'int' || p.value.n < 0) return null;
  return p.value.n;
}

const UNREADABLE: Judgement = { result: 'retry', message: RETRY_MESSAGE.unreadable };

/** 「□じ □ふん」の入力を判定 */
function judgeTimeInput(
  item: ClockItem,
  want: ClockTime,
  fields: string[],
  hourOnly: boolean,
): Judgement {
  const h = intOf(fields[0]);
  const m = hourOnly ? 0 : intOf(fields[1]);
  if (h === null || m === null || h > 24) return UNREADABLE;
  const got = { h, m };
  if (m < 60 && sameDial(got, want) && m === want.m) return { result: 'correct' };
  return { result: 'wrong', misconception: classifyTime(item, want, got), mark: true };
}

function choiceOptions(task: ClockTask): ClockTime[] {
  return task.kind === 'pick' || (task.kind === 'read' && task.answerBy === 'choice')
    ? task.options
    : [];
}

export function judgeClock(item: ClockItem, res: ClockResponse): Judgement {
  const t = item.task;
  if (t.kind === 'pick' || (t.kind === 'read' && t.answerBy === 'choice')) {
    if (!('pick' in res)) return { result: 'wrong', mark: [] };
    const got = t.options[res.pick];
    if (!got) return { result: 'wrong', mark: [] };
    if (sameDial(got, t.time)) return { result: 'correct' };
    return { result: 'wrong', misconception: classifyTime(item, t.time, got), mark: [res.pick] };
  }
  if (t.kind === 'read') {
    if (!('fields' in res)) return UNREADABLE;
    return judgeTimeInput(item, t.time, res.fields, !!t.hourOnly);
  }
  if (t.kind === 'set' || (t.kind === 'elapsed' && t.ask === 'end' && t.answerBy === 'set')) {
    if (!('total' in res) || !Number.isInteger(res.total)) return UNREADABLE;
    const want = t.kind === 'set' ? t.target : endOf(t);
    const got = fromDial(res.total);
    if (dialOf(got) === dialOf(want)) return { result: 'correct' };
    return { result: 'wrong', misconception: classifyTime(item, want, got), mark: res.total };
  }
  if (t.ask === 'end') {
    if (!('fields' in res)) return UNREADABLE;
    return judgeTimeInput(item, endOf(t), res.fields, false);
  }
  // かかった時間
  if (!('fields' in res)) return UNREADABLE;
  const want = durationOf(t.start, t.end);
  let got: number;
  if ((t.unit ?? 'min') === 'min') {
    const m = intOf(res.fields[0]);
    if (m === null) return UNREADABLE;
    got = m;
  } else {
    const h = intOf(res.fields[0]);
    const m = intOf(res.fields[1]);
    if (h === null || m === null) return UNREADABLE;
    got = h * 60 + m;
    // 1じかん15ふん を 0じかん75ふん と書いた: 値は合っている
    if (got === want && m >= 60) return { result: 'retry', message: RETRY_MESSAGE.form };
  }
  if (got === want) return { result: 'correct' };
  const known = item.wrongAnswers?.find((w) => w.minutes === got);
  let mis = known?.misconception;
  if (!mis && item.misconceptions?.base100) {
    const raw = t.end.h * 100 + t.end.m - (t.start.h * 100 + t.start.m);
    if (raw === got) mis = item.misconceptions.base100;
  }
  return { result: 'wrong', misconception: mis, mark: true };
}

function validTime(t: ClockTime | undefined): boolean {
  return (
    !!t &&
    Number.isInteger(t.h) &&
    Number.isInteger(t.m) &&
    t.h >= 0 &&
    t.h <= 23 &&
    t.m >= 0 &&
    t.m <= 59
  );
}

export function checkClock(item: ClockItem): string[] {
  const errs: string[] = [];
  const t = item.task;
  const times: [string, ClockTime | undefined][] =
    t.kind === 'set'
      ? [
          ['target', t.target],
          ['start', t.start ?? { h: 0, m: 0 }],
        ]
      : t.kind === 'elapsed'
        ? [
            ['start', t.start],
            ['end', t.end],
          ]
        : [['time', t.time]];
  for (const [k, v] of times)
    if (!validTime(v)) errs.push(`${k} の時刻が範囲外（h 0〜23・m 0〜59）`);
  const opts = choiceOptions(t);
  if (t.kind === 'pick' || (t.kind === 'read' && t.answerBy === 'choice')) {
    if (opts.length < 2) errs.push('選択肢が2つ未満');
    const nCorrect = opts.filter((o) => sameDial(o, t.time)).length;
    if (nCorrect !== 1) errs.push(`正答の時刻の選択肢が${nCorrect}つ（1つにする）`);
    if (new Set(opts.map(dialOf)).size !== opts.length) errs.push('同じ時刻の選択肢が重複している');
    for (const o of opts) if (!validTime(o)) errs.push('選択肢の時刻が範囲外');
  }
  const stepOf = (s?: ClockStep) => s ?? 1;
  if (t.kind === 'set') {
    const s = stepOf(t.step);
    if (t.target.m % s !== 0) errs.push(`合わせる時刻が ${s}分きざみで作れない`);
    if (t.start && t.start.m % s !== 0) errs.push(`針の最初の位置が ${s}分きざみでない`);
    if (sameDial(t.start ?? { h: 0, m: 0 }, t.target)) errs.push('針が最初から正答の位置にある');
  }
  if (t.kind === 'elapsed') {
    const d = durationOf(t.start, t.end);
    if (d >= 720) errs.push('かかった時間が12時間以上（文字盤で表せない）');
    if (t.ask === 'end' && t.answerBy === 'set') {
      const s = stepOf(t.step);
      if (t.end.m % s !== 0 || t.start.m % s !== 0) errs.push(`時刻が ${s}分きざみでない`);
    }
  }
  for (const w of item.wrongAnswers ?? []) {
    if (w.time === undefined && w.minutes === undefined)
      errs.push('誤答の例に time も minutes も無い');
    if (w.time) {
      const want = t.kind === 'set' ? t.target : t.kind === 'elapsed' ? t.end : t.time;
      if (dialOf(w.time) === dialOf(want) && w.time.m === want.m)
        errs.push(`誤答の例 ${timeText(w.time)} が正答と同じ`);
    }
    if (w.minutes !== undefined && t.kind === 'elapsed' && w.minutes === durationOf(t.start, t.end))
      errs.push(`誤答の例 ${w.minutes}分 が正答と同じ`);
  }
  return errs;
}

export function clockAnswerText(item: ClockItem): RichText {
  const t = item.task;
  const dh = { dayHalf: item.dayHalf };
  switch (t.kind) {
    case 'read':
      return timeText(t.time, { ...dh, halfWord: t.answerBy === 'choice' && t.halfWord });
    case 'pick':
      return timeText(t.time, dh);
    case 'set':
      return timeText(t.target, dh);
    case 'elapsed':
      return t.ask === 'end'
        ? timeText(t.end, dh)
        : durationText(durationOf(t.start, t.end), t.unit ?? 'min');
  }
}

// ---- 画面 ----
const R = 100;
type Hand = 'minute' | 'hour';

function polar(deg: number, len: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: Math.cos(rad) * len, y: Math.sin(rad) * len };
}

/** 文字盤（操作できる）。total は 0:00 からの分（短針は長針に連動） */
export function ClockFace({
  total,
  minuteNumbers,
  hidden,
  selected,
  ghost,
  wrong,
  label,
  onTapAngle,
  onSelectHand,
  className,
}: {
  total: number | null;
  minuteNumbers?: boolean;
  /** 針を描かずに「？」を出す */
  hidden?: boolean;
  selected?: Hand | null;
  /** 正答の針（revealed）。子の針と違うときだけ点線で重ねる */
  ghost?: number | null;
  wrong?: boolean;
  label: string;
  onTapAngle?: (deg: number) => void;
  onSelectHand?: (h: Hand) => void;
  className?: string;
}) {
  const vb = { x: -130, y: -130, w: 260, h: 260 };
  const hands = (tot: number, cls: string, sel?: Hand | null) => {
    const hr = polar((tot / DIAL) * 360, 52);
    const mn = polar((tot % 60) * 6, 82);
    const s = sel === 'hour' ? hr : sel === 'minute' ? mn : null;
    return (
      <g className={cls}>
        {s ? (
          <>
            <line x1={0} y1={0} x2={s.x} y2={s.y} className="clk2-halo-edge" />
            <line x1={0} y1={0} x2={s.x} y2={s.y} className="clk2-halo" />
          </>
        ) : null}
        <line x1={0} y1={0} x2={hr.x} y2={hr.y} className="clk2-hour" />
        <line x1={0} y1={0} x2={mn.x} y2={mn.y} className="clk2-min" />
      </g>
    );
  };
  const tap = onTapAngle
    ? (e: React.MouseEvent<SVGSVGElement>) => {
        const p = svgPoint(e, vb);
        if (Math.hypot(p.x, p.y) < 14) return; // 中心のピン
        const deg = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 90 + 360) % 360;
        onTapAngle(deg);
      }
    : undefined;
  const selectHand = (h: Hand) => (e: React.MouseEvent) => {
    if (!onSelectHand) return;
    e.stopPropagation();
    onSelectHand(h);
  };
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={['mk-svg', 'clk2', wrong ? 'is-wrong' : '', className ?? ''].join(' ')}
      role="img"
      aria-label={label}
      onClick={tap}
    >
      <circle r={R} className="clk2-face" />
      {onTapAngle ? <circle r={R + 28} className="mk-hit" /> : null}
      {Array.from({ length: 60 }, (_, i) => {
        const long = i % 5 === 0;
        const a = polar(i * 6, long ? R - 14 : R - 7);
        const b = polar(i * 6, R - 2);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={long ? 'clk2-tick-l' : 'clk2-tick'}
          />
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const p = polar((i + 1) * 30, R - 30);
        return (
          <text key={i} x={p.x} y={p.y + 7} className="clk2-num">
            {i + 1}
          </text>
        );
      })}
      {minuteNumbers
        ? Array.from({ length: 12 }, (_, i) => {
            const p = polar(i * 30, R + 15);
            return (
              <text key={`m${i}`} x={p.x} y={p.y + 5} className="clk2-mnum">
                {i * 5}
              </text>
            );
          })
        : null}
      {ghost !== null && ghost !== undefined && ghost !== total ? hands(ghost, 'clk2-ghost') : null}
      {hidden ? (
        <text x={0} y={20} className="clk2-q">
          ？
        </text>
      ) : total !== null ? (
        <>
          {hands(total, ['clk2-hands', wrong ? 'is-wrong' : ''].join(' '), selected)}
          {onSelectHand ? (
            <>
              <line
                x1={0}
                y1={0}
                {...xy2(polar((total / DIAL) * 360, 52))}
                className="clk2-handhit"
                onClick={selectHand('hour')}
              />
              <line
                x1={0}
                y1={0}
                {...xy2(polar((total % 60) * 6, 82))}
                className="clk2-handhit"
                onClick={selectHand('minute')}
              />
            </>
          ) : null}
        </>
      ) : null}
      <circle r={6} className="clk2-pin" />
    </svg>
  );
}

function xy2(p: { x: number; y: number }) {
  return { x2: p.x, y2: p.y };
}

/** 針を合わせる部品（はりの選択・文字盤のタップ・すすむ／もどる の札） */
function useHands(start: ClockTime, step: ClockStep) {
  const [total, setTotal] = useState(dialOf(start));
  const [hand, setHand] = useState<Hand>(step >= 60 ? 'hour' : 'minute');
  const tapAngle = (deg: number) => {
    if (hand === 'minute') {
      const m = (Math.round(deg / 6 / step) * step) % 60;
      setTotal((t) => Math.floor(t / 60) * 60 + m);
    } else {
      const n = Math.round(deg / 30) % 12;
      setTotal((t) => n * 60 + (t % 60));
    }
  };
  const move = (d: number) => setTotal((t) => (((t + d) % DIAL) + DIAL) % DIAL);
  return { total, hand, setHand, tapAngle, move };
}

function stepLabel(s: number): string {
  return s >= 60 ? `${s / 60}じかん` : `${s}${minuteWord(s)}`;
}

function HandControls({
  ctl,
  step,
  locked,
  onSubmit,
}: {
  ctl: ReturnType<typeof useHands>;
  step: ClockStep;
  locked: boolean;
  onSubmit(): void;
}) {
  const steps = step === 1 ? [5, 1] : [step];
  return (
    <div className="mk__side eng-clock__side">
      {step < 60 ? (
        <div className="mk-row" role="group" aria-label="うごかす はり">
          {(['minute', 'hour'] as const).map((h) => (
            <button
              key={h}
              type="button"
              className={`mk-btn eng-clock__hand${ctl.hand === h ? ' is-on' : ''}`}
              aria-pressed={ctl.hand === h}
              onClick={() => ctl.setHand(h)}
              disabled={locked}
              data-testid={`hand-${h}`}
            >
              <svg
                viewBox="0 0 40 20"
                className={`eng-clock__handicon eng-clock__handicon--${h}`}
                aria-hidden
              >
                <line x1={4} y1={10} x2={h === 'minute' ? 36 : 24} y2={10} />
              </svg>
              {h === 'minute' ? 'ながい はり' : 'みじかい はり'}
            </button>
          ))}
        </div>
      ) : null}
      <div className="eng-clock__moves">
        {steps
          .flatMap((s) => [-s, s])
          .sort((a, b) => a - b)
          .map((d) => (
            <button
              key={d}
              type="button"
              className="mk-btn"
              onClick={() => ctl.move(d)}
              disabled={locked}
              data-testid={`move-${d}`}
            >
              {stepLabel(Math.abs(d))}
              <br />
              {d < 0 ? 'もどる' : 'すすむ'}
            </button>
          ))}
      </div>
      <button
        type="button"
        className="mk-btn mk-btn--ok"
        onClick={onSubmit}
        disabled={locked}
        data-testid="check"
      >
        こたえあわせ
      </button>
    </div>
  );
}

function DayHalf({ t, on }: { t: ClockTime; on?: boolean }) {
  if (!on) return null;
  return <span className="eng-clock__dayhalf">{t.h < 12 ? 'ごぜん' : 'ごご'}</span>;
}

function ClockView(props: KitProps<ClockItem, ClockResponse>) {
  const t = props.item.task;
  if (t.kind === 'pick' || (t.kind === 'read' && t.answerBy === 'choice'))
    return <PickView {...props} />;
  if (t.kind === 'read') return <ReadInputView {...props} />;
  if (t.kind === 'set') return <SetView {...props} />;
  return <ElapsedView {...props} />;
}

function PickView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<ClockItem, ClockResponse>) {
  const t = item.task as Extract<ClockTask, { kind: 'pick' | 'read' }> & { options: ClockTime[] };
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  // 選択肢の数の上限（正答は必ず残す）
  const max = Math.max(2, ctx.ux.maxChoices);
  const shown: number[] = [];
  t.options.forEach((o, i) => {
    if (sameDial(o, t.time)) shown.push(i);
  });
  t.options.forEach((o, i) => {
    if (!sameDial(o, t.time) && shown.length < max) shown.push(i);
  });
  shown.sort((a, b) => a - b);
  const stateOf = (i: number): TapState => {
    if (revealed && sameDial(t.options[i]!, t.time)) return 'correct';
    if (wrong.has(i)) return 'wrong';
    return null;
  };
  const halfWord = t.kind === 'read' && t.answerBy === 'choice' && t.halfWord;
  return (
    <div className={`eng-clock eng-clock--${t.kind}`}>
      {t.kind === 'read' ? (
        <div className="eng-clock__one">
          <ClockFace
            total={dialOf(t.time)}
            minuteNumbers={item.minuteNumbers}
            label="とけい"
            className="eng-clock__big"
          />
          <DayHalf t={t.time} on={item.dayHalf} />
        </div>
      ) : null}
      <div className="eng-clock__options">
        {shown.map((i) => {
          const o = t.options[i]!;
          const text = timeText(o, { halfWord, dayHalf: item.dayHalf });
          return (
            <Choice
              key={i}
              label={t.kind === 'pick' ? `${i + 1}ばんの とけい` : text}
              state={stateOf(i)}
              disabled={disabled || revealed}
              onPress={() => !disabled && !revealed && submit({ pick: i })}
              testId={`opt-${i}`}
              className="eng-clock__opt"
            >
              {t.kind === 'pick' ? (
                <ClockFace
                  total={dialOf(o)}
                  minuteNumbers={item.minuteNumbers}
                  label={`${i + 1}ばんの とけい`}
                  className="eng-clock__mini"
                />
              ) : (
                <span className="eng-clock__optlabel">
                  <Rt text={text} ctx={ctx} />
                </span>
              )}
            </Choice>
          );
        })}
      </div>
    </div>
  );
}

function ReadInputView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<ClockItem, ClockResponse>) {
  const t = item.task as Extract<ClockTask, { kind: 'read'; answerBy: 'input' }>;
  const locked = disabled || revealed;
  const fields: PadField[] = t.hourOnly ? [{ unit: 'じ' }] : [{ unit: 'じ' }, { unit: 'ふん' }];
  const entry = useNumEntry(fields.length, locked);
  const h12 = t.time.h % 12 === 0 ? 12 : t.time.h % 12;
  return (
    <div className="mk eng-clock">
      <div className="mk__main">
        <ClockFace
          total={dialOf(t.time)}
          minuteNumbers={item.minuteNumbers}
          label="とけい"
          className="eng-clock__mid"
        />
        <DayHalf t={t.time} on={item.dayHalf} />
        <NumFields
          entry={entry}
          fields={fields}
          ctx={ctx}
          wrong={!!wrongMark}
          revealed={revealed}
          answers={[String(h12), String(t.time.m)]}
        />
      </div>
      <NumKeys entry={entry} disabled={locked} onSubmit={() => submit({ fields: entry.vals })} />
    </div>
  );
}

function SetView({
  item,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<ClockItem, ClockResponse>) {
  const t = item.task as Extract<ClockTask, { kind: 'set' }>;
  const step = t.step ?? 1;
  const locked = disabled || revealed;
  const ctl = useHands(t.start ?? { h: 0, m: 0 }, step);
  const wrongNow = typeof wrongMark === 'number' && wrongMark === ctl.total && !revealed;
  return (
    <div className="mk eng-clock">
      <div className="mk__main">
        <ClockFace
          total={ctl.total}
          minuteNumbers={item.minuteNumbers}
          selected={locked ? null : ctl.hand}
          ghost={revealed ? dialOf(t.target) : null}
          wrong={wrongNow}
          label="はりを あわせる とけい"
          className="eng-clock__big"
          onTapAngle={locked ? undefined : ctl.tapAngle}
          onSelectHand={locked || step >= 60 ? undefined : ctl.setHand}
        />
      </div>
      <HandControls
        ctl={ctl}
        step={step}
        locked={locked}
        onSubmit={() => submit({ total: ctl.total })}
      />
    </div>
  );
}

/** 経過の帯: はじめ〜おわりを、時（ちょうど）の目盛りの上に */
function ElapsedBand({ start, end, label }: { start: ClockTime; end: ClockTime; label: string }) {
  const s = start.h * 60 + start.m;
  const e = s + durationOf(start, end);
  const from = Math.floor(s / 60) * 60;
  const to = Math.ceil(e / 60) * 60;
  const W = 600;
  const L = 30;
  const X = (v: number) => L + ((v - from) / Math.max(60, to - from)) * (W - L * 2);
  const ticks = [];
  for (let v = from; v <= to; v += 10) {
    const hour = v % 60 === 0;
    ticks.push(
      <g key={v}>
        <line
          x1={X(v)}
          y1={hour ? 52 : 60}
          x2={X(v)}
          y2={76}
          className={hour ? 'clk2-band-h' : 'clk2-band-m'}
        />
        {hour ? (
          <text x={X(v)} y={102} className="clk2-band-label">
            {`${(v / 60) % 12 === 0 ? 12 : (v / 60) % 12}じ`}
          </text>
        ) : null}
      </g>,
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} 110`}
      className="mk-svg eng-clock__band"
      role="img"
      aria-label={`けいかの おび ${label}`}
    >
      <line x1={L - 10} y1={68} x2={W - L + 10} y2={68} className="clk2-band-axis" />
      {ticks}
      <rect
        x={X(s)}
        y={28}
        width={Math.max(4, X(e) - X(s))}
        height={22}
        className="clk2-band-bar"
      />
      <text x={(X(s) + X(e)) / 2} y={20} className="clk2-band-dur">
        {label}
      </text>
    </svg>
  );
}

function ElapsedView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<ClockItem, ClockResponse>) {
  const t = item.task as Extract<ClockTask, { kind: 'elapsed' }>;
  const locked = disabled || revealed;
  const step = t.ask === 'end' && t.answerBy === 'set' ? (t.step ?? 1) : 1;
  const setting = t.ask === 'end' && t.answerBy === 'set';
  const ctl = useHands(t.start, step);
  const dur = durationOf(t.start, t.end);
  const fields: PadField[] =
    t.ask === 'end'
      ? [{ unit: 'じ' }, { unit: 'ふん' }]
      : (t.unit ?? 'min') === 'min'
        ? [{ unit: 'ふん' }]
        : [{ unit: 'じかん' }, { unit: 'ふん' }];
  const entry = useNumEntry(fields.length, locked);
  const endH12 = t.end.h % 12 === 0 ? 12 : t.end.h % 12;
  const answers =
    t.ask === 'end'
      ? [String(endH12), String(t.end.m)]
      : (t.unit ?? 'min') === 'min'
        ? [String(dur)]
        : [String(Math.floor(dur / 60)), String(dur % 60)];
  const durLabel =
    t.ask === 'duration' && !revealed
      ? '？'
      : durationText(dur, t.ask === 'duration' ? (t.unit ?? 'min') : 'hm');
  const wrongNow = setting && typeof wrongMark === 'number' && wrongMark === ctl.total && !revealed;
  return (
    <div className="mk eng-clock eng-clock--elapsed">
      <div className="mk__main">
        <div className="eng-clock__pair">
          <figure className="eng-clock__fig">
            <ClockFace
              total={dialOf(t.start)}
              minuteNumbers={item.minuteNumbers}
              label="はじめの とけい"
              className="eng-clock__small"
            />
            <figcaption>
              はじめ <DayHalf t={t.start} on={item.dayHalf} />
            </figcaption>
          </figure>
          <figure className="eng-clock__fig">
            {setting ? (
              <ClockFace
                total={ctl.total}
                minuteNumbers={item.minuteNumbers}
                selected={locked ? null : ctl.hand}
                ghost={revealed ? dialOf(t.end) : null}
                wrong={wrongNow}
                label="おわりの とけい（はりを あわせる）"
                className="eng-clock__small"
                onTapAngle={locked ? undefined : ctl.tapAngle}
                onSelectHand={locked || step >= 60 ? undefined : ctl.setHand}
              />
            ) : (
              <ClockFace
                total={dialOf(t.end)}
                hidden={t.ask === 'end' && !revealed}
                minuteNumbers={item.minuteNumbers}
                label="おわりの とけい"
                className="eng-clock__small"
              />
            )}
            <figcaption>
              おわり <DayHalf t={t.end} on={item.dayHalf && (t.ask !== 'end' || revealed)} />
            </figcaption>
          </figure>
        </div>
        {!setting ? (
          <NumFields
            entry={entry}
            fields={fields}
            ctx={ctx}
            wrong={!!wrongMark}
            revealed={revealed}
            answers={answers}
          />
        ) : null}
        <ElapsedBand start={t.start} end={t.end} label={durLabel} />
      </div>
      {setting ? (
        <HandControls
          ctl={ctl}
          step={step}
          locked={locked}
          onSubmit={() => submit({ total: ctl.total })}
        />
      ) : (
        <NumKeys entry={entry} disabled={locked} onSubmit={() => submit({ fields: entry.vals })} />
      )}
    </div>
  );
}

export const clockEngine: KitEngineDef<ClockItem, ClockResponse> = {
  id: 'clock',
  Component: ClockView,
  judge: judgeClock,
  check: checkClock,
  answerText: clockAnswerText,
};
