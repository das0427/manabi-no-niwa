/**
 * en-g56（外国語 5・6年）の絵: ものの ばしょ 24 点（g5.en.where）。
 * id は en56-<もの>-<ばしょのようす>-<ばしょ>。もの 4（ball・cat・cap・book）× ようす 3（in・on・under）× ばしょ 2（desk・bed）。
 * 画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字なし）。
 * 小さい ものも 太さ 3.5 の線で 描き直す（既存の絵を 縮小して 重ねない）。
 * in は、ものを 先に 描いてから 前面（つくえの 前の ふち・かけぶとん）を 重ねて 下の ぶぶんを かくす。
 */
import type { ReactElement } from 'react';
import { INK, line, type IllustDef, type IllustGroup } from '../types';
import { musicNote } from '../stamps/decor';
import { P } from '../palette';

type Obj = 'ball' | 'cat' | 'cap' | 'book';
type Prep = 'in' | 'on' | 'under';
type Cont = 'desk' | 'bed';

const OBJS: Obj[] = ['ball', 'cat', 'cap', 'book'];
const PREPS: Prep[] = ['in', 'on', 'under'];
const CONTS: Cont[] = ['desk', 'bed'];

const OBJ_JA: Record<Obj, string> = { ball: 'ボール', cat: 'ねこ', cap: 'ぼうし', book: 'ほん' };
const PREP_JA: Record<Prep, string> = { in: 'なか', on: 'うえ', under: 'した' };
const CONT_JA: Record<Cont, string> = { desk: 'つくえ', bed: 'ベッド' };

/** もの。(cx, by) は 下の 中心、s は 高さの めやす。線は いつも 3.5 */
function drawObj(o: Obj, cx: number, by: number, s: number): ReactElement {
  const f = (n: number) => Math.round(n * 100) / 100;
  if (o === 'ball') {
    const r = s / 2;
    const cy = by - r;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={P.red} />
        <path
          d={`M${f(cx)} ${f(cy)} L${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy - r)} Z M${f(cx)} ${f(cy)} L${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy + r)} Z`}
          fill={P.yellow}
        />
        <circle cx={cx} cy={cy} r={r} fill="none" {...line} />
      </g>
    );
  }
  if (o === 'cat') {
    const bodyY = by - s * 0.3;
    const headY = by - s * 0.72;
    const hr = s * 0.26;
    return (
      <g>
        <path
          d={`M${f(cx + s * 0.22)} ${f(by - s * 0.1)} Q${f(cx + s * 0.6)} ${f(by - s * 0.1)} ${f(cx + s * 0.5)} ${f(by - s * 0.5)}`}
          fill="none"
          stroke={INK}
          strokeWidth={7.5}
          strokeLinecap="round"
        />
        <path
          d={`M${f(cx + s * 0.22)} ${f(by - s * 0.1)} Q${f(cx + s * 0.6)} ${f(by - s * 0.1)} ${f(cx + s * 0.5)} ${f(by - s * 0.5)}`}
          fill="none"
          stroke={P.orange}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <ellipse cx={cx} cy={bodyY} rx={s * 0.28} ry={s * 0.3} fill={P.orange} {...line} />
        <path
          d={`M${f(cx - hr * 0.95)} ${f(headY - hr * 0.2)} L${f(cx - hr * 0.8)} ${f(headY - hr * 1.5)} L${f(cx - hr * 0.1)} ${f(headY - hr * 0.8)} Z M${f(cx + hr * 0.95)} ${f(headY - hr * 0.2)} L${f(cx + hr * 0.8)} ${f(headY - hr * 1.5)} L${f(cx + hr * 0.1)} ${f(headY - hr * 0.8)} Z`}
          fill={P.orange}
          {...line}
        />
        <circle cx={cx} cy={headY} r={hr} fill={P.orange} {...line} />
        <circle cx={cx - hr * 0.4} cy={headY - hr * 0.1} r={1.5} fill={INK} />
        <circle cx={cx + hr * 0.4} cy={headY - hr * 0.1} r={1.5} fill={INK} />
      </g>
    );
  }
  if (o === 'cap') {
    const w = s * 0.4;
    return (
      <g>
        <path
          d={`M${f(cx - w)} ${f(by)} A${f(w)} ${f(s * 0.55)} 0 0 1 ${f(cx + w)} ${f(by)} Z`}
          fill={P.blue}
          {...line}
        />
        <path
          d={`M${f(cx + w * 0.1)} ${f(by - s * 0.14)} L${f(cx + w * 1.45)} ${f(by - s * 0.14)} Q${f(cx + w * 1.5)} ${f(by)} ${f(cx + w * 1.3)} ${f(by)} L${f(cx + w * 0.1)} ${f(by)} Z`}
          fill={P.blue}
          {...line}
        />
        <circle cx={cx} cy={by - s * 0.52} r={1.6} fill={INK} />
      </g>
    );
  }
  const w = s * 0.32;
  return (
    <g>
      <rect x={cx - w} y={by - s} width={w * 2} height={s} rx={1.5} fill={P.green} {...line} />
      <rect x={cx + w * 0.55} y={by - s + 2} width={w * 0.45} height={s - 4} fill={P.white} />
      <path
        d={`M${f(cx - w * 0.45)} ${f(by - s)} L${f(cx - w * 0.45)} ${f(by)}`}
        fill="none"
        {...line}
      />
      <rect x={cx - w} y={by - s} width={w * 2} height={s} rx={1.5} fill="none" {...line} />
    </g>
  );
}

function deskBase(): ReactElement {
  return (
    <g>
      <rect x="20" y="43" width="5" height="51" fill={P.gray} {...line} />
      <rect x="75" y="43" width="5" height="51" fill={P.gray} {...line} />
      <rect x="18" y="43" width="64" height="17" fill={P.brown} {...line} />
      <rect x="14" y="36" width="72" height="7" fill={P.wood} {...line} />
    </g>
  );
}
const deskFront = <rect x="18" y="55" width="64" height="5" fill={P.wood} {...line} />;

function bedBase(): ReactElement {
  return (
    <g>
      <rect x="16" y="64" width="5" height="30" fill={P.wood} {...line} />
      <rect x="86" y="64" width="5" height="30" fill={P.wood} {...line} />
      <rect x="8" y="34" width="9" height="60" fill={P.wood} {...line} />
      <rect x="14" y="54" width="80" height="10" fill={P.white} {...line} />
      <ellipse cx="27" cy="50" rx="10" ry="5" fill={P.white} {...line} />
    </g>
  );
}
const bedFront = (
  <path d="M34 66 L34 52 Q50 44 64 49 Q80 54 94 48 L94 66 Z" fill={P.blue} {...line} />
);

function scene(o: Obj, p: Prep, c: Cont): ReactElement {
  if (c === 'desk') {
    if (p === 'on')
      return (
        <g>
          {deskBase()}
          {drawObj(o, 50, 36, 24)}
        </g>
      );
    if (p === 'in')
      return (
        <g>
          {deskBase()}
          {drawObj(o, 50, 58, 15)}
          {deskFront}
        </g>
      );
    return (
      <g>
        {deskBase()}
        {drawObj(o, 50, 94, 20)}
      </g>
    );
  }
  if (p === 'on')
    return (
      <g>
        {bedBase()}
        {bedFront}
        {drawObj(o, 62, 48, 22)}
      </g>
    );
  if (p === 'in')
    return (
      <g>
        {bedBase()}
        {drawObj(o, 60, 64, 26)}
        {bedFront}
      </g>
    );
  return (
    <g>
      {bedBase()}
      {drawObj(o, 55, 94, o === 'cat' ? 18 : 20)}
    </g>
  );
}

const defs: IllustDef[] = [];
for (const o of OBJS)
  for (const p of PREPS)
    for (const c of CONTS)
      defs.push({
        id: `en56-${o}-${p}-${c}`,
        label: `${CONT_JA[c]}の ${PREP_JA[p]}の ${OBJ_JA[o]}`,
        status: 'final',
        draw: () => scene(o, p, c),
      });

/** 歌手（g6.en.future）の絵。はんこ用の おんぷは ILLUST に 入っていないので、同じ絵を en56- の id で使う */
defs.push({ ...musicNote, id: 'en56-music-note', label: 'おんぷ' });

export const enG56Illust: IllustGroup = Object.fromEntries(defs.map((d) => [d.id, d]));
