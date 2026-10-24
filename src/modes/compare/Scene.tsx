/**
 * くらべっこの描画。2つ（または3つ）の量を **1つの SVG・同じ座標系（単位 u）・同じ倍率** で描く。
 * この SVG は舞台の描画領域（100u × 48.25u）にそのまま重ねる。表示の大きさが変わっても全体が同じ倍率で変わるだけで、
 * 大小・長短は逆転しない（M6-07）。
 */
import type { ReactElement } from 'react';
import { Illust } from '../../illust/Illust';
import { getIllust } from '../../illust/registry';
import {
  cardBoxes,
  itemBoxes,
  slotBoxes,
  STAGE_H,
  STAGE_W,
  type Box,
  type CompareQuestion,
  type Kind,
} from './logic';

interface SceneProps {
  q: CompareQuestion;
  hintLevel: 0 | 1 | 2;
  /** 誤答で薄くしたカード（2択・3択） */
  wrong: readonly number[];
  /** P5: 並べ替え先のマス1・2・3 に入れたカードの番号 */
  placed: readonly number[];
  /** 数えてつけた番号。キーは `${カード}-${何番目の物}` */
  nums: Readonly<Record<string, number>>;
  /** 数の物のタップ（数の2択・3択のみ） */
  onCount?: (card: number, i: number) => void;
}

const inkLine = { stroke: 'var(--ink)', strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** 長さの物（同じ太さのリボン／えんぴつ）。b.x が左端 */
export function LengthThing({ thing, b }: { thing: string; b: Box }): ReactElement {
  if (thing === 'pencil') {
    const tip = Math.min(3.6, b.w * 0.3);
    const mid = b.y + b.h / 2;
    return (
      <g {...inkLine} strokeWidth={0.35}>
        <rect
          x={b.x}
          y={b.y}
          width={b.w - tip}
          height={b.h}
          style={{ fill: 'var(--mat-yellow)' }}
        />
        <polygon
          points={`${b.x + b.w - tip},${b.y} ${b.x + b.w},${mid} ${b.x + b.w - tip},${b.y + b.h}`}
          style={{ fill: 'var(--wood)' }}
        />
        <polygon
          points={`${b.x + b.w - 1.3},${mid - 0.45} ${b.x + b.w},${mid} ${b.x + b.w - 1.3},${mid + 0.45}`}
          style={{ fill: 'var(--ink)' }}
        />
      </g>
    );
  }
  const fill = thing === 'ribbon-green' ? 'var(--mat-green)' : 'var(--mat-red)';
  return (
    <g {...inkLine} strokeWidth={0.35}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.5} style={{ fill }} />
    </g>
  );
}

function ThingShape({ kind, thing, b }: { kind: Kind; thing: string; b: Box }): ReactElement {
  if (kind === 'length') return <LengthThing thing={thing} b={b} />;
  const def = getIllust(thing);
  return (
    <g transform={`translate(${b.x} ${b.y}) scale(${b.w / 100})`}>{def ? def.draw() : null}</g>
  );
}

function Badge({ b, n }: { b: Box; n: number }): ReactElement {
  const cx = b.x + b.w - 0.4;
  const cy = b.y + 0.4;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={1.9}
        style={{ fill: 'var(--white)', stroke: 'var(--ink)', strokeWidth: 0.35 }}
      />
      <text
        x={cx}
        y={cy + 0.95}
        textAnchor="middle"
        style={{ fontSize: 2.6, fill: 'var(--ink)', fontFamily: 'var(--font-child)' }}
      >
        {n}
      </text>
    </g>
  );
}

/** 1つの量を描いた結果（寸法 + 図形） */
interface Drawn {
  card: number;
  boxes: Box[];
  frame: Box;
  value: number;
}

export function Scene({ q, hintLevel, placed, nums, onCount }: SceneProps): ReactElement {
  const cards = cardBoxes(q);
  const slots = slotBoxes();
  const drawn: Drawn[] = [];
  if (q.type === 'pair') {
    cards.forEach((c, i) =>
      drawn.push({
        card: i,
        frame: c,
        value: q.values[i]!,
        boxes: itemBoxes(q.kind, q.values[i]!, c, false),
      }),
    );
  } else {
    // 並べ替え: マスに入ったカードはマスの枠で描く。残りはカードの枠
    cards.forEach((c, d) => {
      const s = placed.indexOf(d);
      const frame = s >= 0 ? slots[s]! : c;
      drawn.push({
        card: d,
        frame,
        value: q.values[d]!,
        boxes: itemBoxes(q.kind, q.values[d]!, frame, true),
      });
    });
  }
  const isCountPair = q.type === 'pair' && q.kind === 'count';
  const autoNumbers = q.type === 'order' && q.kind === 'count' && hintLevel >= 1;

  return (
    <svg
      className="cmp-scene"
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
      focusable="false"
      data-testid="cmp-scene"
    >
      {/* ヒント2: 数の1対1の線（物の後ろ）。ペアのない物は破線の輪 */}
      {hintLevel === 2 && q.type === 'pair' && q.kind === 'count'
        ? (() => {
            const [a, b] = drawn;
            const n = Math.min(a!.value, b!.value);
            return (
              <g>
                {Array.from({ length: n }, (_, i) => {
                  const l = a!.boxes[i]!;
                  const r = b!.boxes[i]!;
                  // 1段目は物の右の隙間から、2段目は物の下から、カードの下の余白へ降りて弧でつなぐ
                  const start = (bx: Box) =>
                    i < 3
                      ? { x: bx.x + bx.w + 1, y: bx.y + bx.h / 2 }
                      : { x: bx.x + bx.w / 2, y: bx.y + bx.h + 0.4 };
                  const s1 = start(l);
                  const s2 = start(r);
                  const ys = a!.frame.y + 22.8;
                  const yd = ys + 1.5 + i * 2.2;
                  return (
                    <g key={i} style={{ stroke: 'var(--ink)', strokeWidth: 0.45, fill: 'none' }}>
                      <path
                        d={`M${s1.x} ${s1.y} L${s1.x} ${ys} C${s1.x} ${yd} ${s2.x} ${yd} ${s2.x} ${ys} L${s2.x} ${s2.y}`}
                      />
                      <circle cx={s1.x} cy={s1.y} r={0.55} style={{ fill: 'var(--ink)' }} />
                      <circle cx={s2.x} cy={s2.y} r={0.55} style={{ fill: 'var(--ink)' }} />
                    </g>
                  );
                })}
              </g>
            );
          })()
        : null}
      {/* ヒント2: 大きさ。もう一方の輪郭（破線の正方形）を重ねる */}
      {hintLevel === 2 && q.type === 'pair' && q.kind === 'size'
        ? drawn.map((d) => {
            const other = q.values[1 - d.card]!;
            const cx = d.frame.x + d.frame.w / 2;
            const cy = d.frame.y + d.frame.h / 2;
            return (
              <rect
                key={d.card}
                x={cx - other / 2}
                y={cy - other / 2}
                width={other}
                height={other}
                rx={1}
                style={{
                  fill: 'none',
                  stroke: 'var(--ink)',
                  strokeWidth: 0.4,
                  strokeDasharray: '1 1',
                }}
              />
            );
          })
        : null}
      {drawn.map((d) => {
        return (
          <g key={d.card}>
            {d.boxes.map((b, i) => {
              const key = `${d.card}-${i}`;
              const n = nums[key] ?? (autoNumbers ? i + 1 : undefined);
              return (
                <g key={i}>
                  <ThingShape kind={q.kind} thing={q.thing} b={b} />
                  {hintLevel === 2 &&
                  q.type === 'pair' &&
                  q.kind === 'count' &&
                  i >= Math.min(...q.values) ? (
                    <rect
                      x={b.x - 0.2}
                      y={b.y - 0.2}
                      width={b.w + 0.4}
                      height={b.h + 0.4}
                      rx={1.4}
                      style={{
                        fill: 'none',
                        stroke: 'var(--ink)',
                        strokeWidth: 0.4,
                        strokeDasharray: '1 1',
                      }}
                    />
                  ) : null}
                  {n !== undefined ? <Badge b={b} n={n} /> : null}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* ヒント2: 長さ。右端に縦の線。もう一方の長い端の位置も破線で */}
      {hintLevel === 2 && q.kind === 'length'
        ? drawn.map((d) => {
            const b = d.boxes[0]!;
            const x = b.x + b.w;
            return (
              <g key={d.card}>
                {q.type === 'pair' ? (
                  <line
                    x1={d.frame.x + 3 + Math.max(...q.values)}
                    x2={d.frame.x + 3 + Math.max(...q.values)}
                    y1={d.frame.y + 2}
                    y2={d.frame.y + d.frame.h - 2}
                    style={{
                      stroke: 'var(--ink-soft)',
                      strokeWidth: 0.35,
                      strokeDasharray: '1 1',
                    }}
                  />
                ) : null}
                <line
                  x1={x}
                  x2={x}
                  y1={b.y - 3.5}
                  y2={b.y + b.h + 3.5}
                  style={{ stroke: 'var(--ink)', strokeWidth: 0.6, strokeLinecap: 'round' }}
                />
              </g>
            );
          })
        : null}
      {/* ヒント2: P5 の数は数字で見せる */}
      {hintLevel === 2 && q.type === 'order' && q.kind === 'count'
        ? drawn.map((d) => (
            <text
              key={d.card}
              x={d.frame.x + d.frame.w - 1}
              y={d.frame.y + d.frame.h - 1.4}
              textAnchor="end"
              style={{ fontSize: 3.6, fill: 'var(--ink)', fontFamily: 'var(--font-child)' }}
            >
              {d.value}
            </text>
          ))
        : null}
      {/* P5: マスの番号 */}
      {q.type === 'order'
        ? slots.map((s, i) => (
            <text
              key={i}
              x={s.x + 1.8}
              y={s.y + 4}
              style={{ fontSize: 3.4, fill: 'var(--ink-soft)', fontFamily: 'var(--font-child)' }}
            >
              {i + 1}
            </text>
          ))
        : null}
      {/* 数の物をタップして数える（番号がつく） */}
      {isCountPair && onCount
        ? drawn.map((d) =>
            d.boxes.map((b, i) => (
              <rect
                key={`${d.card}-${i}`}
                x={b.x - 0.5}
                y={b.y - 0.5}
                width={b.w + 1}
                height={b.h + 1}
                fill="transparent"
                data-testid={`count-${d.card}-${i}`}
                style={{ pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation' }}
                onClick={() => onCount(d.card, i)}
              />
            )),
          )
        : null}
    </svg>
  );
}

/** 完了画面に並べる、比べた物の絵 */
export function Showcase({ things }: { things: { kind: Kind; thing: string }[] }): ReactElement {
  return (
    <div className="cmp-showcase">
      {things.map((t, i) =>
        t.kind === 'length' ? (
          <svg key={i} viewBox="0 0 24 10" className="cmp-showcase__pic" aria-hidden="true">
            <LengthThing thing={t.thing} b={{ x: 1, y: 3, w: 22, h: 4 }} />
          </svg>
        ) : (
          <Illust key={i} id={t.thing} className="cmp-showcase__pic" decorative />
        ),
      )}
    </div>
  );
}
