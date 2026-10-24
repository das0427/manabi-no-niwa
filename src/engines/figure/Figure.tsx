/**
 * 図の描画（データ → SVG/DOM）。色は DESINGN.md のトークン（CSS 変数）だけ。
 * 色だけで区別しない: tone の違いは線の太さ・模様（斜線）・形でも示す。
 */
import { Fragment, type ReactNode } from 'react';
import { Illust } from '../../illust/Illust';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import type { RenderCtx } from '../types';
import type { Figure as FigureData, Tone } from './types';
import './figure.css';

type Ctx = Pick<RenderCtx, 'furigana' | 'learnerGrade'>;

export function Figure({ fig, ctx }: { fig: FigureData; ctx: Ctx }): ReactNode {
  switch (fig.kind) {
    case 'text':
      return (
        <div className={`fig-text fig-text--${fig.size ?? 'l'}`}>
          <Rt text={fig.text} ctx={ctx} />
        </div>
      );
    case 'illust':
      return <IllustGroup id={fig.id} count={fig.count ?? 1} tone={fig.tone} />;
    case 'blocks':
      return <Blocks {...fig} />;
    case 'tape':
      return <Tape fig={fig} ctx={ctx} />;
    case 'numberline':
      return <NumberLine fig={fig} ctx={ctx} />;
    case 'clock':
      return <Clock h={fig.h} m={fig.m} minuteNumbers={fig.minuteNumbers} />;
    case 'table':
      return (
        <table className="fig-table">
          <thead>
            <tr>
              {fig.header.map((h, i) => (
                <th key={i}>
                  <Rt text={h} ctx={ctx} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fig.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>
                    <Rt text={c} ctx={ctx} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'bar':
    case 'line':
      return <Chart fig={fig} ctx={ctx} />;
    case 'shape':
      return <Shape fig={fig} />;
    case 'row':
    case 'column':
      return (
        <div className={`fig-${fig.kind}`} style={{ gap: `calc(var(--u) * ${fig.gap ?? 2})` }}>
          {fig.items.map((f, i) => (
            <Fragment key={i}>
              <Figure fig={f} ctx={ctx} />
            </Fragment>
          ))}
        </div>
      );
    case 'svg':
      return (
        <div
          className="fig-svg"
          role="img"
          aria-label={plainText(fig.label)}
          // パックが用意した図（スクリプトを含まない SVG。check で検査）
          dangerouslySetInnerHTML={{ __html: fig.markup }}
        />
      );
  }
}

/** 絵を count 個。10を超えたら5ずつのまとまりで並べる（数えやすさ） */
function IllustGroup({ id, count, tone }: { id: string; count: number; tone?: Tone }) {
  const groups: number[] = [];
  const per = count > 10 ? 5 : count;
  for (let left = count; left > 0; left -= per) groups.push(Math.min(per, left));
  const size = count <= 3 ? 12 : count <= 10 ? 8 : 6;
  return (
    <div className={`fig-illust fig-tone--${tone ?? 'plain'}`} role="img" aria-label={`${count}こ`}>
      {groups.map((n, gi) => (
        <div key={gi} className="fig-illust__group">
          {Array.from({ length: n }, (_, i) => (
            <Illust
              key={i}
              id={id}
              decorative
              style={{ width: `calc(var(--u) * ${size})`, height: `calc(var(--u) * ${size})` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** ブロック: 100の板・10の棒・1の粒。10のわく（5＋5）も描ける */
function Blocks({
  hundreds = 0,
  tens = 0,
  ones,
  frame,
  tone,
}: {
  hundreds?: number;
  tens?: number;
  ones: number;
  frame?: boolean;
  tone?: Tone;
}) {
  const c = 10; // 粒の大きさ（viewBox 単位）
  const items: ReactNode[] = [];
  let x = 0;
  for (let i = 0; i < hundreds; i++) {
    items.push(
      <g key={`h${i}`} transform={`translate(${x},0)`}>
        <rect width={c * 10} height={c * 10} className="blk blk--h" />
        {Array.from({ length: 9 }, (_, k) => (
          <Fragment key={k}>
            <line x1={(k + 1) * c} y1={0} x2={(k + 1) * c} y2={c * 10} className="blk-grid" />
            <line x1={0} y1={(k + 1) * c} x2={c * 10} y2={(k + 1) * c} className="blk-grid" />
          </Fragment>
        ))}
      </g>,
    );
    x += c * 10 + c;
  }
  for (let i = 0; i < tens; i++) {
    items.push(
      <g key={`t${i}`} transform={`translate(${x},0)`}>
        <rect width={c} height={c * 10} className="blk blk--t" />
        {Array.from({ length: 9 }, (_, k) => (
          <line key={k} x1={0} y1={(k + 1) * c} x2={c} y2={(k + 1) * c} className="blk-grid" />
        ))}
      </g>,
    );
    x += c * 1.6;
  }
  if (tens > 0 || hundreds > 0) x += c * 0.6;
  if (frame) {
    // 10のわく: 2段×5
    for (let k = 0; k < 10; k++) {
      const cx = x + (k % 5) * c * 1.2;
      const cy = Math.floor(k / 5) * c * 1.2;
      items.push(
        <rect key={`f${k}`} x={cx} y={cy} width={c * 1.2} height={c * 1.2} className="blk-frame" />,
      );
      if (k < ones)
        items.push(
          <circle
            key={`o${k}`}
            cx={cx + c * 0.6}
            cy={cy + c * 0.6}
            r={c * 0.42}
            className="blk blk--o"
          />,
        );
    }
    x += c * 6;
  } else {
    for (let k = 0; k < ones; k++) {
      const col = Math.floor(k / 5);
      const row = k % 5;
      items.push(
        <circle
          key={`o${k}`}
          cx={x + col * c * 1.3 + c * 0.5}
          cy={row * c * 1.3 + c * 0.5 + (tens || hundreds ? c * 3.5 : 0)}
          r={c * 0.45}
          className="blk blk--o"
        />,
      );
    }
    x += Math.ceil(ones / 5) * c * 1.3;
  }
  const h = hundreds || tens ? c * 10 : frame ? c * 2.4 : Math.min(5, Math.max(ones, 1)) * c * 1.3;
  const total = hundreds * 100 + tens * 10 + ones;
  return (
    <svg
      className={`fig-svgbox fig-tone--${tone ?? 'plain'}`}
      viewBox={`-2 -2 ${Math.max(x, c) + 4} ${h + 4}`}
      role="img"
      aria-label={`${total}`}
      style={{ height: `calc(var(--u) * ${Math.min(20, (h / c) * 2 + 2)})` }}
    >
      {items}
    </svg>
  );
}

function Tape({ fig, ctx }: { fig: Extract<FigureData, { kind: 'tape' }>; ctx: Ctx }) {
  const total = fig.parts.reduce((s, p) => s + p.length, 0) || 1;
  return (
    <div className="fig-tape-wrap">
      <div className="fig-tape">
        {fig.parts.map((p, i) => (
          <div
            key={i}
            className={`fig-tape__part fig-tone--${p.tone ?? 'plain'}`}
            style={{ flexGrow: p.length, flexBasis: 0 }}
          >
            {p.label ? <Rt text={p.label} ctx={ctx} /> : null}
          </div>
        ))}
      </div>
      {fig.total ? (
        <div className="fig-tape__total" aria-label={plainText(fig.total)}>
          <span className="fig-tape__brace" aria-hidden />
          <Rt text={fig.total} ctx={ctx} />
        </div>
      ) : null}
      <span hidden>{total}</span>
    </div>
  );
}

function NumberLine({ fig, ctx }: { fig: Extract<FigureData, { kind: 'numberline' }>; ctx: Ctx }) {
  const W = 1000;
  const pad = 40;
  const span = fig.max - fig.min || 1;
  const X = (v: number) => pad + ((v - fig.min) / span) * (W - pad * 2);
  const ticks: ReactNode[] = [];
  const minor = fig.minorStep;
  const eps = 1e-9;
  if (minor) {
    for (let v = fig.min; v <= fig.max + eps; v += minor)
      ticks.push(<line key={`m${v}`} x1={X(v)} y1={52} x2={X(v)} y2={68} className="nl-minor" />);
  }
  const every = fig.labelEvery ?? fig.step;
  for (let v = fig.min; v <= fig.max + eps; v += fig.step) {
    const r = Math.round(v * 1e6) / 1e6;
    const labeled = Math.abs(Math.round((r - fig.min) / every) * every - (r - fig.min)) < 1e-6;
    ticks.push(
      <g key={`s${r}`}>
        <line x1={X(r)} y1={44} x2={X(r)} y2={76} className="nl-major" />
        {labeled ? (
          <text x={X(r)} y={108} className="nl-label">
            {r}
          </text>
        ) : null}
      </g>,
    );
  }
  return (
    <div className="fig-nl">
      <svg viewBox={`0 0 ${W} 150`} className="fig-svgbox" role="img" aria-label="すうちょくせん">
        <line x1={pad - 20} y1={60} x2={W - pad + 24} y2={60} className="nl-axis" />
        <path d={`M ${W - pad + 24} 60 l -16 -9 v 18 z`} className="nl-arrow" />
        {ticks}
        {fig.jump ? (
          <path
            d={`M ${X(fig.jump.from)} 40 Q ${(X(fig.jump.from) + X(fig.jump.to)) / 2} -10 ${X(fig.jump.to)} 40`}
            className="nl-jump"
          />
        ) : null}
        {(fig.marks ?? []).map((mk, i) => (
          <g key={`k${i}`}>
            <path
              d={`M ${X(mk.at)} 40 l -12 -20 h 24 z`}
              className={`nl-mark fig-tone--${mk.tone ?? 'focus'}`}
            />
          </g>
        ))}
      </svg>
      {(fig.marks ?? []).some((m) => m.label) ? (
        <div className="fig-nl__labels">
          {(fig.marks ?? []).map((mk, i) =>
            mk.label ? (
              <span key={i} style={{ left: `${(X(mk.at) / W) * 100}%` }}>
                <Rt text={mk.label} ctx={ctx} />
              </span>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Clock({ h, m, minuteNumbers }: { h: number; m: number; minuteNumbers?: boolean }) {
  const R = 100;
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  const hand = (deg: number, len: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x2: Math.cos(rad) * len, y2: Math.sin(rad) * len };
  };
  return (
    <svg
      viewBox="-120 -120 240 240"
      className="fig-svgbox fig-clock"
      role="img"
      aria-label={`${h}じ${m === 0 ? '' : `${m}ふん`}`}
    >
      <circle r={R} className="clk-face" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = ((i * 6 - 90) * Math.PI) / 180;
        const long = i % 5 === 0;
        return (
          <line
            key={i}
            x1={Math.cos(a) * (long ? R - 14 : R - 7)}
            y1={Math.sin(a) * (long ? R - 14 : R - 7)}
            x2={Math.cos(a) * (R - 2)}
            y2={Math.sin(a) * (R - 2)}
            className={long ? 'clk-tick-l' : 'clk-tick'}
          />
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const a = ((n * 30 - 90) * Math.PI) / 180;
        return (
          <text
            key={n}
            x={Math.cos(a) * (R - 30)}
            y={Math.sin(a) * (R - 30) + 7}
            className="clk-num"
          >
            {n}
          </text>
        );
      })}
      {minuteNumbers
        ? Array.from({ length: 12 }, (_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <text
                key={`mn${i}`}
                x={Math.cos(a) * (R + 12)}
                y={Math.sin(a) * (R + 12) + 4}
                className="clk-mnum"
              >
                {i * 5}
              </text>
            );
          })
        : null}
      <line x1={0} y1={0} {...hand(hourAngle, 52)} className="clk-hour" />
      <line x1={0} y1={0} {...hand(minAngle, 80)} className="clk-min" />
      <circle r={6} className="clk-pin" />
    </svg>
  );
}

function Chart({ fig, ctx }: { fig: Extract<FigureData, { kind: 'bar' | 'line' }>; ctx: Ctx }) {
  const W = 800;
  const H = 420;
  const left = 70;
  const bottom = 60;
  const top = 20;
  const min = fig.kind === 'line' ? (fig.min ?? 0) : 0;
  const rawMax = Math.max(...fig.values, min + fig.scaleStep);
  const max = Math.ceil(rawMax / fig.scaleStep) * fig.scaleStep;
  const Y = (v: number) => top + (1 - (v - min) / (max - min)) * (H - top - bottom);
  const n = fig.values.length;
  const slot = (W - left - 20) / n;
  const grid: ReactNode[] = [];
  for (let v = min; v <= max + 1e-9; v += fig.scaleStep) {
    grid.push(
      <g key={v}>
        <line x1={left} y1={Y(v)} x2={W - 10} y2={Y(v)} className="ch-grid" />
        <text x={left - 10} y={Y(v) + 7} className="ch-ylabel">
          {Math.round(v * 1e6) / 1e6}
        </text>
      </g>,
    );
  }
  return (
    <div className="fig-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svgbox" role="img" aria-label="グラフ">
        {grid}
        <line x1={left} y1={top} x2={left} y2={H - bottom} className="ch-axis" />
        <line x1={left} y1={H - bottom} x2={W - 10} y2={H - bottom} className="ch-axis" />
        {fig.kind === 'bar' ? (
          fig.values.map((v, i) => (
            <rect
              key={i}
              x={left + slot * i + slot * 0.2}
              y={Y(v)}
              width={slot * 0.6}
              height={H - bottom - Y(v)}
              className="ch-bar"
            />
          ))
        ) : (
          <>
            <polyline
              points={fig.values.map((v, i) => `${left + slot * (i + 0.5)},${Y(v)}`).join(' ')}
              className="ch-line"
            />
            {fig.values.map((v, i) => (
              <circle key={i} cx={left + slot * (i + 0.5)} cy={Y(v)} r={7} className="ch-dot" />
            ))}
          </>
        )}
      </svg>
      <div className="fig-chart__labels" style={{ paddingLeft: `${(left / W) * 100}%` }}>
        {fig.labels.map((l, i) => (
          <span key={i}>
            <Rt text={l} ctx={ctx} />
          </span>
        ))}
      </div>
      {fig.unit ? (
        <div className="fig-chart__unit">
          （<Rt text={fig.unit} ctx={ctx} />）
        </div>
      ) : null}
    </div>
  );
}

function Shape({ fig }: { fig: Extract<FigureData, { kind: 'shape' }> }) {
  const w = fig.w ?? 100;
  const h = fig.h ?? 100;
  let el: ReactNode;
  switch (fig.shape) {
    case 'circle':
      el = <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 3} ry={h / 2 - 3} className="sh" />;
      break;
    case 'triangle':
      el = <polygon points={`${w / 2},3 ${w - 3},${h - 3} 3,${h - 3}`} className="sh" />;
      break;
    case 'square':
    case 'rect':
      el = <rect x={3} y={3} width={w - 6} height={h - 6} className="sh" />;
      break;
    case 'polygon':
      el = (
        <polygon
          points={(fig.points ?? []).map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(' ')}
          className="sh"
        />
      );
      break;
  }
  return (
    <svg
      viewBox={`-6 -6 ${w + 12} ${h + 12}`}
      className={`fig-svgbox fig-shape fig-tone--${fig.tone ?? 'plain'}`}
      role="img"
      aria-label={fig.shape}
    >
      {el}
    </svg>
  );
}
