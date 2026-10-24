/**
 * 実験の道具の絵（SVG）。result が null のときは「まだ やっていない」形（てこは ささえで水平、豆電球は消えている）。
 * 色だけにしない: 明るさは光の線の数と長さ、速さは羽根の回る速さと文、てこは傾き。
 */
import type { ExpResult, ExpSetup, Cond } from './model';
import { circuitCurrent } from './model';

export function Apparatus({
  setup,
  cond,
  result,
  run,
}: {
  setup: ExpSetup;
  cond: Cond;
  result: ExpResult | null;
  /** やってみるたびに変わる番号（動きを始めからにする） */
  run: number;
}) {
  if (setup.kind === 'pendulum')
    return <Pendulum setup={setup} cond={cond} result={result} run={run} />;
  if (setup.kind === 'lever') return <Lever cond={cond} result={result} />;
  if (setup.kind === 'circuit')
    return <Circuit setup={setup} cond={cond} result={result} run={run} />;
  return null;
}

function Pendulum({
  setup,
  cond,
  result,
  run,
}: {
  setup: Extract<ExpSetup, { kind: 'pendulum' }>;
  cond: Cond;
  result: ExpResult | null;
  run: number;
}) {
  const maxL = Math.max(...setup.length, 1);
  const L = 40 + (Number(cond.length) / maxL) * 170;
  const amp = Number(cond.amplitude);
  const maxW = Math.max(...setup.weight, 1);
  const r = 9 + Math.sqrt(Number(cond.weight) / maxW) * 13;
  const a = (amp * Math.PI) / 180;
  const sx = Math.sin(a) * L;
  const sy = Math.cos(a) * L;
  const swing = result && result.amount ? result.amount : 0;
  return (
    <svg viewBox="-120 -20 240 285" className="exp-svg" role="img" aria-label="ふりこ">
      <line x1={-90} y1={0} x2={90} y2={0} className="exp-bar" />
      <line x1={0} y1={0} x2={-sx} y2={sy} className="exp-guide" />
      <line x1={0} y1={0} x2={sx} y2={sy} className="exp-guide" />
      <path d={`M${-sx} ${sy} A ${L} ${L} 0 0 0 ${sx} ${sy}`} className="exp-guide" />
      <g
        key={run}
        className={swing ? 'exp-swing' : ''}
        style={
          swing
            ? ({
                ['--amp' as string]: `${amp}deg`,
                animationDuration: `${swing / 2}s`,
              } as React.CSSProperties)
            : { transform: `rotate(${amp}deg)` }
        }
      >
        <line x1={0} y1={0} x2={0} y2={L} className="exp-string" />
        <circle cx={0} cy={L + r} r={r} className="exp-bob" />
      </g>
      <circle r={5} className="exp-pivot" />
      {result ? (
        <text x={0} y={258} className="exp-svgtext">
          {`1おうふく ${result.key}びょう`}
        </text>
      ) : null}
    </svg>
  );
}

function Lever({ cond, result }: { cond: Cond; result: ExpResult | null }) {
  const step = 17;
  const tilt = result ? (result.amount ?? 0) * 8 : 0;
  const block = (side: -1 | 1, pos: number, w: number) => {
    const x = side * pos * step;
    const n = Math.max(1, Math.min(6, Math.round(w / 10)));
    const hgt = 7;
    return (
      <g>
        <line x1={x} y1={4} x2={x} y2={26} className="exp-string" />
        {Array.from({ length: n }, (_, i) => (
          <rect
            key={i}
            x={x - 7}
            y={26 + i * hgt}
            width={14}
            height={hgt - 1}
            className="exp-weight"
          />
        ))}
        <text x={x} y={26 + n * hgt + 14} className="exp-svgtext exp-svgtext--small">
          {`${w}g`}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox="-125 -40 250 190" className="exp-svg" role="img" aria-label="てこ">
      <polygon points="0,6 -14,60 14,60" className="exp-stand" />
      <line x1={-40} y1={60} x2={40} y2={60} className="exp-bar" />
      <g transform={`rotate(${tilt})`}>
        <rect x={-112} y={-4} width={224} height={8} rx={3} className="exp-beam" />
        {[1, 2, 3, 4, 5, 6].flatMap((p) => [
          <line key={`l${p}`} x1={-p * step} y1={-4} x2={-p * step} y2={4} className="exp-tick" />,
          <line key={`r${p}`} x1={p * step} y1={-4} x2={p * step} y2={4} className="exp-tick" />,
          <text key={`tl${p}`} x={-p * step} y={-9} className="exp-svgtext exp-svgtext--tiny">
            {p}
          </text>,
          <text key={`tr${p}`} x={p * step} y={-9} className="exp-svgtext exp-svgtext--tiny">
            {p}
          </text>,
        ])}
        {block(-1, Number(cond.leftPos), Number(cond.leftWeight))}
        {block(1, Number(cond.rightPos), Number(cond.rightWeight))}
      </g>
      <circle r={4} className="exp-pivot" />
      {!result ? (
        // まだ やっていない: 両はしを ささえで 止めている
        <g className="exp-support">
          <rect x={-118} y={8} width={10} height={70} />
          <rect x={108} y={8} width={10} height={70} />
        </g>
      ) : null}
      {result ? (
        <text x={0} y={-24} className="exp-svgtext">
          {result.text}
        </text>
      ) : null}
    </svg>
  );
}

function Circuit({
  setup,
  cond,
  result,
  run,
}: {
  setup: Extract<ExpSetup, { kind: 'circuit' }>;
  cond: Cond;
  result: ExpResult | null;
  run: number;
}) {
  const two = cond.cells === 2;
  const parallel = two && cond.connection === 'parallel';
  const rev = cond.direction === 'reverse';
  const cur = result ? circuitCurrent(cond) : 0;
  // 乾電池（長い方が ＋）。x は左はし
  const cell = (x: number, y: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y})${rev ? ` rotate(180 30 0)` : ''}`}>
      <rect x={0} y={-12} width={52} height={24} rx={4} className="exp-cell" />
      <rect x={52} y={-5} width={7} height={10} className="exp-cell__tip" />
      <line x1={10} y1={0} x2={18} y2={0} className="exp-cell__mark" />
      <line x1={36} y1={0} x2={44} y2={0} className="exp-cell__mark" />
      <line x1={40} y1={-4} x2={40} y2={4} className="exp-cell__mark" />
    </g>
  );
  const cells = !two
    ? [cell(-30, 110, 'a')]
    : parallel
      ? [cell(-30, 95, 'a'), cell(-30, 135, 'b')]
      : [cell(-64, 110, 'a'), cell(4, 110, 'b')];
  const rays = cur >= 2 ? 10 : cur >= 1 ? 6 : 0;
  const rayLen = cur >= 2 ? 26 : 14;
  return (
    <svg viewBox="-120 -80 240 240" className="exp-svg" role="img" aria-label="かいろ">
      {/* 導線: 上の器具から左右へおりて、下の電池へ */}
      <polyline points="-20,-20 -90,-20 -90,110 -64,110" className="exp-wire" />
      <polyline points="20,-20 90,-20 90,110 66,110" className="exp-wire" />
      {two && !parallel ? <line x1={-6} y1={110} x2={4} y2={110} className="exp-wire" /> : null}
      {parallel ? (
        <>
          <polyline points="-64,110 -64,95 -30,95" className="exp-wire" />
          <polyline points="-64,110 -64,135 -30,135" className="exp-wire" />
          <polyline points="66,110 66,95 29,95" className="exp-wire" />
          <polyline points="66,110 66,135 29,135" className="exp-wire" />
        </>
      ) : !two ? (
        <>
          <line x1={-64} y1={110} x2={-30} y2={110} className="exp-wire" />
          <line x1={29} y1={110} x2={66} y2={110} className="exp-wire" />
        </>
      ) : null}
      {cells}
      {setup.device === 'bulb' ? (
        <g>
          {Array.from({ length: rays }, (_, i) => {
            const a = (i / rays) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={Math.cos(a) * 26}
                y1={-38 + Math.sin(a) * 26}
                x2={Math.cos(a) * (26 + rayLen)}
                y2={-38 + Math.sin(a) * (26 + rayLen)}
                className="exp-ray"
              />
            );
          })}
          <circle cx={0} cy={-38} r={20} className={cur ? 'exp-bulb is-on' : 'exp-bulb'} />
          <path d="M-7 -30 L-4 -44 L0 -36 L4 -44 L7 -30" className="exp-filament" />
          <rect x={-12} y={-20} width={24} height={10} className="exp-socket" />
        </g>
      ) : (
        <g>
          <rect x={-22} y={-40} width={44} height={30} rx={8} className="exp-motor" />
          <line x1={0} y1={-40} x2={0} y2={-52} className="exp-wire" />
          <g transform="translate(0 -56)">
            <g
              key={run}
              className={cur ? `exp-spin${rev ? ' is-rev' : ''}` : ''}
              style={cur ? { animationDuration: cur >= 2 ? '0.5s' : '1.2s' } : undefined}
            >
              {[0, 120, 240].map((d) => (
                <ellipse
                  key={d}
                  cx={0}
                  cy={-16}
                  rx={6}
                  ry={16}
                  transform={`rotate(${d})`}
                  className="exp-blade"
                />
              ))}
            </g>
            <circle r={4} className="exp-pivot" />
          </g>
        </g>
      )}
      {result ? (
        <text x={0} y={155} className="exp-svgtext">
          {result.text.replace(/（.*）/, '')}
        </text>
      ) : null}
    </svg>
  );
}
