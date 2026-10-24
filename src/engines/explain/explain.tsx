/**
 * explain エンジン: かいてみよう（採点しない記録。curriculum-matrix 2.5）。
 * 絵や字を描く小さな盤、または理由の選択肢を選ぶ＋描く。答えは常に「できた」（judge は correct）。
 * 描いたものは response に入れて返す（線の点列と PNG の dataURL。保存の仕組みは統括が後で作る）。
 * 何も描かずに「できた」を押したときは誤答にせず「もう一度」（require の指定があるときだけ）。
 */
import { useState, type ReactNode } from 'react';
import type { Item, ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { findBareKanji, plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import { Tap } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import type { Figure as FigureData } from '../figure/types';
import type { EngineProps, Judgement } from '../types';
import {
  DrawPad,
  INK_COLORS,
  INK_NAMES,
  renderPng,
  type DrawLine,
  type InkColor,
  type PadGuide,
} from './DrawPad';
import './explain.css';

export interface ExplainReason {
  label?: RichText;
  figure?: FigureData;
}

export interface ExplainItem extends ItemBase {
  engine: 'explain';
  /** 描く盤。省くと描かない（理由を選ぶだけ） */
  canvas?: {
    /** 横 ÷ 縦（既定 4/3。0.5〜3） */
    aspect?: number;
    /** 補助線（none・cross〔字〕・lines〔文〕。既定 none） */
    guide?: PadGuide;
    /** 色を選べる（既定 true。false はくろだけ） */
    colors?: boolean;
  };
  /** 理由の選択肢（採点しない。選んだ番号を記録する）。2つ以上 */
  reasons?: ExplainReason[];
  /** 理由を複数選べる */
  multiReasons?: boolean;
  /** 「できた」の前に求めること（既定: 盤があれば描くこと、理由があれば選ぶこと） */
  require?: { drawing?: boolean; reason?: boolean };
}

export interface ExplainResponse {
  /** 描いた線（書いた順。座標は横 0〜1000、縦 0〜1000/aspect の整数） */
  lines: DrawLine[];
  aspect: number;
  /** 選んだ理由の番号 */
  reasons: number[];
  /** 保存用の PNG（dataURL。描けない環境では無い） */
  png?: string;
}

export const DEFAULT_ASPECT = 4 / 3;

const needDrawing = (it: ExplainItem) => it.require?.drawing ?? it.canvas !== undefined;
const needReason = (it: ExplainItem) => it.require?.reason ?? (it.reasons?.length ?? 0) > 0;

export const NEED_DRAWING: RichText = 'なにか かいてから 「できた」を おしてね。';
export const NEED_REASON: RichText = 'わけを えらんでから 「できた」を おしてね。';

export function judgeExplain(item: ExplainItem, r: ExplainResponse): Judgement {
  if (needDrawing(item) && item.canvas && r.lines.length === 0)
    return { result: 'retry', message: NEED_DRAWING };
  if (needReason(item) && item.reasons && r.reasons.length === 0)
    return { result: 'retry', message: NEED_REASON };
  return { result: 'correct' };
}

export function checkExplain(item: ExplainItem): string[] {
  const errs: string[] = [];
  const rs = item.reasons ?? [];
  if (!item.canvas && rs.length === 0) errs.push('描く盤も理由の選択肢も無い');
  if (item.reasons && rs.length < 2) errs.push('理由の選択肢が2つ未満');
  if (item.require?.drawing && !item.canvas) errs.push('描くことを求めているのに盤が無い');
  if (item.require?.reason && rs.length === 0) errs.push('理由を求めているのに選択肢が無い');
  const a = item.canvas?.aspect;
  if (a !== undefined && !(a >= 0.5 && a <= 3)) errs.push('盤の aspect は 0.5〜3');
  const labels = rs.map((o) =>
    o.label !== undefined ? plainText(o.label) : JSON.stringify(o.figure),
  );
  if (new Set(labels).size !== labels.length) errs.push('同じ理由が重複している');
  for (const o of rs) {
    if (o.label === undefined && o.figure === undefined) errs.push('理由に文も図も無い');
    if (o.label) for (const k of findBareKanji(o.label)) errs.push(`理由: よみの無い漢字「${k}」`);
  }
  return errs;
}

export const explainAnswerText = (): RichText => 'できた（じぶんの かんがえを かいたよ）';

// ---- 画面 ----

type Props = Omit<EngineProps<Item, ExplainResponse>, 'item'> & { item: ExplainItem };

function ExplainView({ item, ctx, revealed, disabled, submit }: Props) {
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [color, setColor] = useState<InkColor>('ink');
  const [picked, setPicked] = useState<number[]>([]);
  const locked = disabled || revealed;
  const cv = item.canvas;
  const aspect = cv?.aspect ?? DEFAULT_ASPECT;
  const reasons = item.reasons ?? [];

  const pick = (i: number) => {
    if (locked) return;
    setPicked((p) =>
      item.multiReasons ? (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]) : [i],
    );
  };
  const done = () => {
    if (locked) return;
    const png =
      cv && lines.length > 0 ? renderPng({ aspect, guide: cv.guide ?? 'none', lines }) : null;
    submit({ lines, aspect, reasons: picked, ...(png ? { png } : {}) });
  };
  const ready =
    (!needDrawing(item) || !cv || lines.length > 0) &&
    (!needReason(item) || reasons.length === 0 || picked.length > 0);

  return (
    <div className={`eng-explain${cv ? '' : ' eng-explain--nopad'}`}>
      {cv ? (
        <div className="eng-explain__board">
          <DrawPad
            aspect={aspect}
            guide={cv.guide ?? 'none'}
            lines={lines}
            color={color}
            locked={locked}
            onLine={(l) => setLines((ls) => [...ls, l])}
            label="かく ところ"
            testId="explain-pad"
          />
        </div>
      ) : null}
      <div className="eng-explain__side">
        {reasons.length > 0 ? (
          <div className="eng-explain__reasons" role="group" aria-label="わけ">
            {reasons.map((o, i) => (
              <Choice
                key={i}
                label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
                state={picked.includes(i) ? 'selected' : null}
                disabled={locked}
                onPress={() => pick(i)}
                testId={`reason-${i}`}
                className="eng-explain__reason"
              >
                {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
                {o.label !== undefined ? (
                  <span className="eng-explain__reason-label">
                    <Rt text={o.label} ctx={ctx} />
                  </span>
                ) : null}
              </Choice>
            ))}
          </div>
        ) : null}
        {cv ? (
          <div className="eng-explain__tools">
            {cv.colors !== false
              ? INK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`eng-explain__color eng-explain__color--${c}${c === color ? ' is-on' : ''}`}
                    aria-label={INK_NAMES[c]}
                    aria-pressed={c === color}
                    disabled={locked}
                    onClick={() => setColor(c)}
                    data-testid={`color-${c}`}
                  />
                ))
              : null}
            <Tap
              label="ひとつ もどす"
              icon="undo"
              size="aux"
              variant="white"
              disabled={locked || lines.length === 0}
              onPress={() => setLines((ls) => ls.slice(0, -1))}
              testId="undo-button"
            />
            <Tap
              label="ぜんぶ けす"
              icon="eraser"
              size="aux"
              variant="white"
              disabled={locked || lines.length === 0}
              onPress={() => setLines([])}
              testId="clear-button"
            />
          </div>
        ) : null}
        {!revealed ? (
          <Tap
            label="できた"
            icon="done"
            variant="main"
            text="できた"
            disabled={disabled || !ready}
            onPress={done}
            testId="done-button"
            className="eng-explain__done"
          />
        ) : null}
      </div>
    </div>
  );
}

export interface ExplainEngineDef {
  id: 'explain';
  Component: (props: Props) => ReactNode;
  judge(item: ExplainItem, response: ExplainResponse): Judgement;
  check(item: ExplainItem): string[];
  answerText(item: ExplainItem): RichText;
}

export const explainEngine: ExplainEngineDef = {
  id: 'explain',
  Component: ExplainView,
  judge: judgeExplain,
  check: checkExplain,
  answerText: explainAnswerText,
};
