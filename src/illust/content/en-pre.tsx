/**
 * en-pre（幼児向けの英語）の絵 26枚（docs/expansion/p2-design/preschool-english.md 6.11）。
 *   enpre-icon … 「えいご」の札の絵（吹き出しの中で手をふる手）
 *   enpre-act-*（8）… うさぎがその動きをしている全身の絵（動きは短い線で示す）
 *   enpre-touch-*（6）… うさぎがその部分をさわっている絵（さわっている所に sun の丸。色だけに頼らず丸の形で）
 *   enpre-ball-*（8）… 色の名前の聞き取りに使うボール（1つの関数で色だけ変える）
 *   enpre-meet / enpre-bye / enpre-gift … あいさつの場面
 *   enpre-touch-tummy / -knees / -shoulders … 版 0.2 で足したさわる部分（p4.en.move・p23.en.move）
 *   enpre-sorry / enpre-birthday … 版 0.2 で足したあいさつの場面（p4.en.hello）
 *   enpre-where-<cat|dog|rabbit>-<in|on|under>（9）… 同じベッドと動物の位置（p4.en.where。P2）
 *   enpre-blocks … つみき3つ（p5.en.abc の札の絵。面には ○・△・□ の形だけ。P2）
 * 画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字・アルファベットを描かない）。
 */
import type { ReactElement } from 'react';
import { CHEEK, HIGHLIGHT, INK, line, type IllustDef, type IllustGroup } from '../types';
import { P } from '../palette';

const def = (id: string, label: string, draw: () => ReactElement): IllustDef => ({
  id,
  label,
  status: 'final',
  draw,
});

type Pt = readonly [number, number];

/** 手（丸） */
function Hand({ at, r = 5.5 }: { at: Pt; r?: number }) {
  return <circle cx={at[0]} cy={at[1]} r={r} fill={P.cream} {...line} strokeWidth="2.5" />;
}

/** うで（輪郭つきの細い管）と手。from → to を ctrl で曲げる */
function Arm({ from, to, ctrl }: { from: Pt; to: Pt; ctrl: Pt }) {
  const d = `M${from[0]} ${from[1]} Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <path d={d} fill="none" stroke={P.cream} strokeWidth="4" strokeLinecap="round" />
      <Hand at={to} />
    </g>
  );
}

/** 動きを示す短い線（INK） */
function Motion({ d, w = 3 }: { d: string; w?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={INK}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

interface BunnyProps {
  /** すわった姿（背が低い） */
  squat?: boolean;
  /** 全体を上下に動かす */
  dy?: number;
  /** 手のあげた足 */
  footUp?: boolean;
  /** うで（左は見る人から見て左）。省略時は体の横に下ろす */
  armL?: { to: Pt; ctrl: Pt };
  armR?: { to: Pt; ctrl: Pt };
  /** うでの後ろ（顔・体の手前）に描く追加（さわった所の丸など） */
  behindArms?: ReactElement;
  /** うさぎの後ろに描く追加 */
  back?: ReactElement;
  /** 大きさ（中心 50,92 を基準） */
  scale?: number;
}

const SH_L: Pt = [38, 58];
const SH_R: Pt = [62, 58];

/** 正面のうさぎ（既存の rabbit と同じ cream・pink の配色。ink の輪郭） */
function Bunny({
  squat,
  dy = 0,
  footUp,
  armL = { to: [30, 80], ctrl: [30, 66] },
  armR = { to: [70, 80], ctrl: [70, 66] },
  behindArms,
  back,
  scale = 1,
}: BunnyProps) {
  const earY = squat ? 31 : 17;
  const headY = squat ? 52 : 38;
  const bodyY = squat ? 77 : 68;
  const bodyRx = squat ? 22 : 17;
  const bodyRy = squat ? 14 : 19;
  const footY = 92;
  const sh = squat ? 70 : 58;
  const shL: Pt = [SH_L[0], sh];
  const shR: Pt = [SH_R[0], sh];
  return (
    <g transform={`translate(0 ${dy}) translate(50 92) scale(${scale}) translate(-50 -92)`}>
      {back}
      {/* 耳 */}
      <ellipse
        cx="41"
        cy={earY}
        rx="5.5"
        ry="12"
        transform={`rotate(-6 41 ${earY})`}
        fill={P.cream}
        {...line}
      />
      <ellipse
        cx="41"
        cy={earY + 1}
        rx="2.4"
        ry="7.5"
        transform={`rotate(-6 41 ${earY + 1})`}
        fill={P.pink}
      />
      <ellipse
        cx="59"
        cy={earY}
        rx="5.5"
        ry="12"
        transform={`rotate(6 59 ${earY})`}
        fill={P.cream}
        {...line}
      />
      <ellipse
        cx="59"
        cy={earY + 1}
        rx="2.4"
        ry="7.5"
        transform={`rotate(6 59 ${earY + 1})`}
        fill={P.pink}
      />
      {/* 足 */}
      <ellipse cx="40" cy={footY} rx="8.5" ry="4.5" fill={P.cream} {...line} />
      {footUp ? (
        <ellipse
          cx="66"
          cy="80"
          rx="8.5"
          ry="4.5"
          transform="rotate(-30 66 80)"
          fill={P.cream}
          {...line}
        />
      ) : (
        <ellipse cx="60" cy={footY} rx="8.5" ry="4.5" fill={P.cream} {...line} />
      )}
      {/* 体 */}
      <ellipse cx="50" cy={bodyY} rx={bodyRx} ry={bodyRy} fill={P.cream} {...line} />
      <ellipse cx="50" cy={bodyY + 3} rx={bodyRx - 8} ry={bodyRy - 8} fill={P.white} />
      {/* 頭 */}
      <ellipse cx="50" cy={headY} rx="17" ry="14.5" fill={P.cream} {...line} />
      <circle cx="43.5" cy={headY - 2} r="2.4" fill={INK} />
      <circle cx="56.5" cy={headY - 2} r="2.4" fill={INK} />
      <ellipse
        cx="50"
        cy={headY + 3}
        rx="2.6"
        ry="2"
        fill={P.pink}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path
        d={`M45.5 ${headY + 7} Q50 ${headY + 11} 54.5 ${headY + 7}`}
        fill="none"
        {...line}
        strokeWidth="2.5"
      />
      <circle cx="38.5" cy={headY + 4} r="3.4" fill={CHEEK} opacity="0.7" />
      <circle cx="61.5" cy={headY + 4} r="3.4" fill={CHEEK} opacity="0.7" />
      {behindArms}
      <Arm from={shL} to={armL.to} ctrl={armL.ctrl} />
      <Arm from={shR} to={armR.to} ctrl={armR.ctrl} />
    </g>
  );
}

/** さわっている所を示す sun の丸（色だけに頼らず、丸の形で示す） */
const Spot = ({ at, r = 10 }: { at: Pt; r?: number }) => (
  <circle cx={at[0]} cy={at[1]} r={r} fill={P.sun} {...line} strokeWidth="2.5" />
);

// ---- うごき（8） ----
const actJump = def('enpre-act-jump', 'とぶ うさぎ', () => (
  <g>
    <ellipse cx="50" cy="96" rx="20" ry="3" fill={P.gray} opacity="0.5" />
    <Bunny
      dy={-5}
      scale={0.9}
      armL={{ to: [22, 40], ctrl: [24, 58] }}
      armR={{ to: [78, 40], ctrl: [76, 58] }}
    />
    <Motion d="M20 74 Q15 84 20 94" />
    <Motion d="M80 74 Q85 84 80 94" />
  </g>
));

const actClap = def('enpre-act-clap', 'てを たたく うさぎ', () => (
  <g>
    <Bunny armL={{ to: [46, 62], ctrl: [32, 70] }} armR={{ to: [54, 62], ctrl: [68, 70] }} />
    <Motion d="M30 56 L23 51" />
    <Motion d="M70 56 L77 51" />
    <Motion d="M27 66 L19 66" />
    <Motion d="M73 66 L81 66" />
  </g>
));

const actStand = def('enpre-act-stand', 'たつ うさぎ', () => (
  <g>
    <Bunny />
    <Motion d="M88 78 L88 44" />
    <Motion d="M81 52 L88 44 L95 52" />
  </g>
));

const actSit = def('enpre-act-sit', 'すわる うさぎ', () => (
  <g>
    <Bunny squat armL={{ to: [31, 84], ctrl: [28, 74] }} armR={{ to: [69, 84], ctrl: [72, 74] }} />
    <Motion d="M88 44 L88 78" />
    <Motion d="M81 70 L88 78 L95 70" />
  </g>
));

const actTurn = def('enpre-act-turn', 'くるっと まわる うさぎ', () => (
  <g>
    <Bunny scale={0.78} />
    <Motion d="M10 62 A40 15 0 1 1 18 82" />
    <Motion d="M9 72 L10 62 L19 66" />
  </g>
));

const actStomp = def('enpre-act-stomp', 'あしを どんどん する うさぎ', () => (
  <g>
    <Bunny footUp armL={{ to: [34, 68], ctrl: [20, 62] }} armR={{ to: [66, 68], ctrl: [80, 62] }} />
    <Motion d="M24 86 L16 82" />
    <Motion d="M24 94 L15 95" />
    <Motion d="M30 80 L26 72" />
  </g>
));

const actWave = def('enpre-act-wave', 'てを ふる うさぎ', () => (
  <g>
    <Bunny armR={{ to: [76, 36], ctrl: [82, 54] }} />
    <Motion d="M86 32 Q92 40 86 48" />
    <Motion d="M92 26 Q100 40 92 54" />
  </g>
));

const actHandsUp = def('enpre-act-handsup', 'りょうてを あげる うさぎ', () => (
  <g>
    <Bunny armL={{ to: [24, 20], ctrl: [20, 48] }} armR={{ to: [76, 20], ctrl: [80, 48] }} />
    <Motion d="M12 28 L9 20" />
    <Motion d="M88 28 L91 20" />
  </g>
));

// ---- からだをさわる（6） ----
const touchNose = def('enpre-touch-nose', 'はなを さわる うさぎ', () => (
  <Bunny behindArms={<Spot at={[51, 41]} r={9} />} armR={{ to: [52, 42], ctrl: [76, 50] }} />
));

const touchHead = def('enpre-touch-head', 'あたまを さわる うさぎ', () => (
  <Bunny behindArms={<Spot at={[50, 23]} r={9} />} armR={{ to: [51, 24], ctrl: [86, 40] }} />
));

const touchEars = def('enpre-touch-ears', 'みみを さわる うさぎ', () => (
  <Bunny
    behindArms={
      <g>
        <Spot at={[39, 15]} r={9} />
        <Spot at={[61, 15]} r={9} />
      </g>
    }
    armL={{ to: [38, 16], ctrl: [14, 40] }}
    armR={{ to: [62, 16], ctrl: [86, 40] }}
  />
));

const touchMouth = def('enpre-touch-mouth', 'くちを さわる うさぎ', () => (
  <Bunny behindArms={<Spot at={[50, 46]} r={8} />} armR={{ to: [51, 47], ctrl: [78, 54] }} />
));

const touchToes = def('enpre-touch-toes', 'あしの ゆびを さわる うさぎ', () => (
  <Bunny
    behindArms={
      <g>
        <Spot at={[38, 91]} r={9} />
        <Spot at={[62, 91]} r={9} />
      </g>
    }
    armL={{ to: [38, 90], ctrl: [16, 76] }}
    armR={{ to: [62, 90], ctrl: [84, 76] }}
  />
));

const touchHands = def('enpre-touch-hands', 'りょうてを だす うさぎ', () => (
  <Bunny
    behindArms={
      <g>
        <Spot at={[27, 70]} r={11} />
        <Spot at={[73, 70]} r={11} />
      </g>
    }
    armL={{ to: [27, 70], ctrl: [26, 62] }}
    armR={{ to: [73, 70], ctrl: [74, 62] }}
  />
));

// 版 0.2 で足した3つ（既存と同じ形: うさぎがその部分を両手でさわり、後ろに sun の丸）
const touchTummy = def('enpre-touch-tummy', 'おなかを さわる うさぎ', () => (
  <Bunny
    behindArms={<Spot at={[50, 72]} r={11} />}
    armL={{ to: [45, 72], ctrl: [28, 70] }}
    armR={{ to: [55, 72], ctrl: [72, 70] }}
  />
));

const touchKnees = def('enpre-touch-knees', 'ひざを さわる うさぎ', () => (
  <g>
    <Bunny
      behindArms={
        <g>
          <Spot at={[30, 82]} r={9} />
          <Spot at={[70, 82]} r={9} />
        </g>
      }
      armL={{ to: [30, 82], ctrl: [14, 66] }}
      armR={{ to: [70, 82], ctrl: [86, 66] }}
    />
    {/* すこし かがむ しるし */}
    <Motion d="M8 52 Q4 62 8 72" />
    <Motion d="M92 52 Q96 62 92 72" />
  </g>
));

const touchShoulders = def('enpre-touch-shoulders', 'かたを さわる うさぎ', () => (
  <Bunny
    behindArms={
      <g>
        <Spot at={[35, 57]} r={9} />
        <Spot at={[65, 57]} r={9} />
      </g>
    }
    armL={{ to: [35, 57], ctrl: [10, 52] }}
    armR={{ to: [65, 57], ctrl: [90, 52] }}
  />
));

// ---- ボール（8色） ----
function Ball({ color }: { color: string }) {
  return (
    <g>
      <circle cx="50" cy="52" r="38" fill={color} {...line} />
      {/* ぬいめ（色が白でもボールと分かる） */}
      <path d="M14 46 Q50 66 86 46" fill="none" {...line} strokeWidth="2.5" />
      <path d="M22 76 Q50 56 78 76" fill="none" {...line} strokeWidth="2.5" />
      <ellipse
        cx="33"
        cy="30"
        rx="4"
        ry="8"
        transform="rotate(45 33 30)"
        fill={HIGHLIGHT}
        opacity="0.6"
      />
    </g>
  );
}
const ballOf = (name: string, label: string, color: string) =>
  def(`enpre-ball-${name}`, label, () => <Ball color={color} />);

// ---- あいさつの場面 ----
/** 横向きの小さな動物（耳の形でうさぎ・くまを描き分ける） */
function Pal({
  x,
  kind,
  hand,
}: {
  x: number;
  kind: 'rabbit' | 'bear';
  hand: { to: Pt; ctrl: Pt };
}) {
  const body = kind === 'rabbit' ? P.cream : P.tan;
  const sh: Pt = [x, 72];
  return (
    <g>
      {kind === 'rabbit' ? (
        <g>
          <ellipse cx={x - 6} cy="22" rx="5" ry="12" fill={P.cream} {...line} />
          <ellipse cx={x + 6} cy="22" rx="5" ry="12" fill={P.cream} {...line} />
        </g>
      ) : (
        <g>
          <circle cx={x - 12} cy="36" r="6" fill={P.tan} {...line} />
          <circle cx={x + 12} cy="36" r="6" fill={P.tan} {...line} />
        </g>
      )}
      <ellipse cx={x} cy="80" rx="15" ry="16" fill={body} {...line} />
      <circle cx={x} cy="48" r="14" fill={body} {...line} />
      <circle cx={x - 5} cy="46" r="2.2" fill={INK} />
      <circle cx={x + 5} cy="46" r="2.2" fill={INK} />
      <ellipse
        cx={x}
        cy="51"
        rx="2.6"
        ry="2"
        fill={kind === 'rabbit' ? P.pink : P.brown}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d={`M${x - 4} 55 Q${x} 58 ${x + 4} 55`} fill="none" {...line} strokeWidth="2.5" />
      <Arm from={sh} to={hand.to} ctrl={hand.ctrl} />
    </g>
  );
}

const meet = def('enpre-meet', 'むかいあって てを あげる うさぎと くま', () => (
  <g>
    <Pal x={27} kind="rabbit" hand={{ to: [43, 52], ctrl: [44, 68] }} />
    <Pal x={73} kind="bear" hand={{ to: [57, 52], ctrl: [56, 68] }} />
    <Motion d="M48 38 L50 32" w={2.5} />
    <Motion d="M52 38 L50 32" w={2.5} />
  </g>
));

const bye = def('enpre-bye', 'ふりかえって てを ふる うさぎ', () => (
  <g>
    {/* とおざかる あしあと */}
    <ellipse cx="14" cy="92" rx="4" ry="2.4" fill={P.gray} opacity="0.7" />
    <ellipse cx="24" cy="86" rx="4" ry="2.4" fill={P.gray} opacity="0.7" />
    <ellipse cx="34" cy="92" rx="4" ry="2.4" fill={P.gray} opacity="0.7" />
    <g transform="translate(14 0)">
      <Bunny scale={0.86} armR={{ to: [76, 38], ctrl: [82, 56] }} />
    </g>
    <Motion d="M90 36 Q95 44 90 52" />
  </g>
));

const gift = def('enpre-gift', 'リボンの はこを さしだす て', () => (
  <g>
    <rect x="26" y="40" width="48" height="38" rx="4" fill={P.red} {...line} />
    <rect x="26" y="40" width="48" height="9" rx="3" fill={P.redDark} {...line} />
    <path d="M50 40 L50 78" stroke={INK} strokeWidth="3" />
    <rect x="44" y="40" width="12" height="38" fill={P.yellow} {...line} strokeWidth="2.5" />
    <path d="M50 40 C40 22 28 28 38 38 Z" fill={P.yellow} {...line} />
    <path d="M50 40 C60 22 72 28 62 38 Z" fill={P.yellow} {...line} />
    {/* さしだす 両手 */}
    <path d="M12 94 Q16 84 28 80" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
    <path
      d="M12 94 Q16 84 28 80"
      fill="none"
      stroke={P.cream}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="M88 94 Q84 84 72 80" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
    <path
      d="M88 94 Q84 84 72 80"
      fill="none"
      stroke={P.cream}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Hand at={[30, 79]} r={6} />
    <Hand at={[70, 79]} r={6} />
  </g>
));

const sorry = def('enpre-sorry', 'ごめんね（たおれた コップと うさぎ）', () => (
  <g>
    {/* みている くま */}
    <g transform="translate(62 34) scale(0.46)">
      <Pal x={20} kind="bear" hand={{ to: [4, 90], ctrl: [8, 82] }} />
    </g>
    {/* ぺこりと あたまを さげる うさぎ */}
    <g transform="translate(-18 4) rotate(18 50 92)">
      <Bunny scale={0.8} />
    </g>
    {/* こぼれた みず */}
    <ellipse cx="68" cy="94" rx="22" ry="3.5" fill={P.sky} {...line} strokeWidth="2.5" />
    {/* たおれた コップ */}
    <g transform="translate(-2 6) rotate(-78 56 86)">
      <path d="M47 68 L67 68 L64 92 L50 92 Z" fill={P.white} {...line} />
    </g>
  </g>
));

const birthday = def('enpre-birthday', 'おたんじょうびの ケーキと くま', () => (
  <g>
    {/* とんがりぼうしの くま */}
    <Pal x={30} kind="bear" hand={{ to: [48, 76], ctrl: [44, 84] }} />
    <path d="M21 38 L30 12 L39 38 Z" fill={P.blue} {...line} />
    <circle cx="30" cy="12" r="4" fill={P.yellow} {...line} strokeWidth="2.5" />
    {/* ろうそくを たてた ケーキ */}
    <rect x="50" y="68" width="40" height="26" rx="4" fill={P.pink} {...line} />
    <path
      d="M50 74 Q56 82 62 74 Q68 82 74 74 Q80 82 86 74 L90 74 L90 68 L50 68 Z"
      fill={P.white}
      {...line}
      strokeWidth="2.5"
    />
    <rect x="67" y="50" width="6" height="18" rx="2" fill={P.yellow} {...line} strokeWidth="2.5" />
    <path d="M70 36 Q76 44 70 49 Q64 44 70 36 Z" fill={P.orange} {...line} strokeWidth="2.5" />
  </g>
));

// ---- ベッドと どうぶつ（where。P2） ----
type Kind = 'cat' | 'dog' | 'rabbit';
type Pos = 'in' | 'on' | 'under';
const FUR: Record<Kind, string> = { cat: P.orange, dog: P.tan, rabbit: P.cream };
const KIND_JA: Record<Kind, string> = { cat: 'ねこ', dog: 'いぬ', rabbit: 'うさぎ' };
const POS_JA: Record<Pos, string> = { in: 'なか', on: 'うえ', under: 'した' };
const thin = { ...line, strokeWidth: 2.5 } as const;

interface HeadProps {
  kind: Kind;
  hx: number;
  hy: number;
  r: number;
  /** ねている（目をとじる） */
  closed?: boolean;
  /** ふせている（うさぎの耳を うしろへ ねかせる） */
  lie?: boolean;
}

/** 耳（ねこ: とがった耳／いぬ: たれ耳／うさぎ: 長い耳） */
function Ears({ kind, hx, hy, r, lie }: HeadProps) {
  if (kind === 'cat') {
    const ear = (sx: number) =>
      `M${hx + sx * r * 0.95} ${hy - r * 0.2} L${hx + sx * r * 0.75} ${hy - r * 1.55} L${hx + sx * r * 0.05} ${hy - r * 0.85} Z`;
    return (
      <g>
        <path d={ear(-1)} fill={P.orange} {...thin} />
        <path d={ear(1)} fill={P.orange} {...thin} />
      </g>
    );
  }
  if (kind === 'dog') {
    const ear = (sx: number) => (
      <ellipse
        cx={hx + sx * r * 0.95}
        cy={hy + r * 0.1}
        rx={r * 0.4}
        ry={r * 0.75}
        transform={`rotate(${-sx * 12} ${hx + sx * r * 0.95} ${hy + r * 0.1})`}
        fill={P.brown}
        {...thin}
      />
    );
    return (
      <g>
        {ear(-1)}
        {ear(1)}
      </g>
    );
  }
  if (lie)
    return (
      <g>
        <ellipse
          cx={hx - r * 1.1}
          cy={hy - r * 0.9}
          rx={r}
          ry={r * 0.38}
          transform={`rotate(-18 ${hx - r * 1.1} ${hy - r * 0.9})`}
          fill={P.cream}
          {...thin}
        />
        <ellipse
          cx={hx - r * 0.9}
          cy={hy - r * 0.3}
          rx={r}
          ry={r * 0.38}
          transform={`rotate(-6 ${hx - r * 0.9} ${hy - r * 0.3})`}
          fill={P.cream}
          {...thin}
        />
      </g>
    );
  const ear = (sx: number) => (
    <g>
      <ellipse
        cx={hx + sx * r * 0.5}
        cy={hy - r * 1.3}
        rx={r * 0.38}
        ry={r * 0.95}
        fill={P.cream}
        {...thin}
      />
      <ellipse cx={hx + sx * r * 0.5} cy={hy - r * 1.2} rx={r * 0.16} ry={r * 0.6} fill={P.pink} />
    </g>
  );
  return (
    <g>
      {ear(-1)}
      {ear(1)}
    </g>
  );
}

/** あたま（顔は既存の どうぶつと同じ: 点の目・はな・ほっぺ） */
function Head(p: HeadProps) {
  const { kind, hx, hy, r, closed } = p;
  const eye = (sx: number) =>
    closed ? (
      <path
        d={`M${hx + sx * r * 0.65} ${hy - r * 0.1} Q${hx + sx * r * 0.4} ${hy + r * 0.2} ${hx + sx * r * 0.15} ${hy - r * 0.1}`}
        fill="none"
        {...thin}
        strokeWidth="2"
      />
    ) : (
      <circle cx={hx + sx * r * 0.4} cy={hy - r * 0.1} r={r * 0.17} fill={INK} />
    );
  return (
    <g>
      <Ears {...p} />
      <circle cx={hx} cy={hy} r={r} fill={FUR[kind]} {...thin} />
      {eye(-1)}
      {eye(1)}
      <ellipse
        cx={hx}
        cy={hy + r * 0.28}
        rx={r * 0.2}
        ry={r * 0.14}
        fill={kind === 'dog' ? INK : P.pink}
        stroke={INK}
        strokeWidth="1.2"
      />
      <circle cx={hx - r * 0.62} cy={hy + r * 0.4} r={r * 0.2} fill={CHEEK} opacity="0.7" />
      <circle cx={hx + r * 0.62} cy={hy + r * 0.4} r={r * 0.2} fill={CHEEK} opacity="0.7" />
    </g>
  );
}

/** すわっている どうぶつ（baseY が足もと） */
function Sitter({ kind, cx, baseY, s }: { kind: Kind; cx: number; baseY: number; s: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={baseY - 10 * s} rx={10 * s} ry={11 * s} fill={FUR[kind]} {...thin} />
      <Head kind={kind} hx={cx} hy={baseY - 27 * s} r={11 * s} />
    </g>
  );
}

/** ふせている どうぶつ（ベッドの下。全身が見える） */
function Lier({ kind, cx, baseY }: { kind: Kind; cx: number; baseY: number }) {
  return (
    <g>
      {kind === 'cat' ? (
        <path
          d={`M${cx - 22} ${baseY - 6} Q${cx - 34} ${baseY - 10} ${cx - 30} ${baseY - 22}`}
          fill="none"
          stroke={P.orange}
          strokeWidth="5"
          strokeLinecap="round"
        />
      ) : null}
      <ellipse cx={cx - 6} cy={baseY - 8} rx="17" ry="8" fill={FUR[kind]} {...thin} />
      <Head kind={kind} hx={cx + 14} hy={baseY - 12} r={10} lie />
    </g>
  );
}

/** ベッド（木の枠・脚4本（横から見て2本）・白い ふとん・まくら）。3つの絵で同じ形・同じ位置 */
function Bed({ kind, pos }: { kind: Kind; pos: Pos }) {
  return (
    <g>
      <rect x="9" y="62" width="6" height="32" rx="2" fill={P.wood} {...thin} />
      <rect x="85" y="62" width="6" height="32" rx="2" fill={P.wood} {...thin} />
      <rect x="6" y="30" width="12" height="40" rx="4" fill={P.brown} {...line} />
      <rect x="82" y="46" width="12" height="24" rx="4" fill={P.brown} {...line} />
      <rect x="14" y="58" width="72" height="8" rx="2" fill={P.wood} {...line} />
      {pos === 'under' ? <Lier kind={kind} cx={50} baseY={93} /> : null}
      <ellipse cx="28" cy="48" rx="12" ry="6" fill={P.cream} {...thin} />
      <rect
        x="16"
        y={pos === 'in' ? 50 : 46}
        width="68"
        height={pos === 'in' ? 8 : 12}
        rx="4"
        fill={P.white}
        {...line}
      />
      {pos === 'in' ? (
        <g>
          <Head kind={kind} hx={28} hy={38} r={10} closed />
          <path
            d="M38 58 L38 44 Q38 36 48 36 L78 38 Q86 38 86 48 L86 58 Z"
            fill={P.white}
            {...line}
          />
        </g>
      ) : null}
      {pos === 'on' ? <Sitter kind={kind} cx={56} baseY={46} s={0.8} /> : null}
    </g>
  );
}

const whereDef = (kind: Kind, pos: Pos) =>
  def(`enpre-where-${kind}-${pos}`, `ベッドの ${POS_JA[pos]}の ${KIND_JA[kind]}`, () => (
    <Bed kind={kind} pos={pos} />
  ));

// ---- つみき（abc の札の絵。面に ○・△・□ の形だけ） ----
const blocks = def('enpre-blocks', 'つみき', () => (
  <g>
    <rect x="10" y="56" width="38" height="38" rx="4" fill={P.blue} {...line} />
    <circle cx="29" cy="75" r="9" fill={P.white} {...thin} />
    <rect x="52" y="56" width="38" height="38" rx="4" fill={P.yellow} {...line} />
    <path d="M71 64 L81 85 L61 85 Z" fill={P.white} {...thin} />
    <rect x="31" y="16" width="38" height="38" rx="4" fill={P.orange} {...line} />
    <rect x="41" y="26" width="18" height="18" rx="1" fill={P.white} {...thin} />
  </g>
));

// ---- 札の絵 ----
const icon = def('enpre-icon', 'えいご（ふきだしの なかで てを ふる）', () => (
  <g>
    <path
      d="M16 18 H84 Q92 18 92 26 V62 Q92 70 84 70 H58 L40 88 L42 70 H16 Q8 70 8 62 V26 Q8 18 16 18 Z"
      fill={P.white}
      {...line}
    />
    {/* 手: てのひら＋ゆび4本＋おやゆび */}
    <rect x="30" y="26" width="8" height="20" rx="4" fill={P.tan} {...line} strokeWidth="2.5" />
    <rect x="39" y="22" width="8" height="24" rx="4" fill={P.tan} {...line} strokeWidth="2.5" />
    <rect x="48" y="22" width="8" height="24" rx="4" fill={P.tan} {...line} strokeWidth="2.5" />
    <rect x="57" y="26" width="8" height="20" rx="4" fill={P.tan} {...line} strokeWidth="2.5" />
    <path d="M30 46 H65 V52 Q65 62 48 62 Q30 62 30 52 Z" fill={P.tan} {...line} strokeWidth="2.5" />
    <path d="M30 50 Q22 44 24 38 Q26 34 32 42" fill={P.tan} {...line} strokeWidth="2.5" />
    {/* ふっている しるし */}
    <path d="M72 30 Q78 40 72 50" fill="none" {...line} strokeWidth="3" />
    <path d="M78 26 Q86 40 78 54" fill="none" {...line} strokeWidth="3" />
  </g>
));

export const enPreIllust: IllustGroup = Object.fromEntries(
  [
    icon,
    actJump,
    actClap,
    actStand,
    actSit,
    actTurn,
    actStomp,
    actWave,
    actHandsUp,
    touchNose,
    touchHead,
    touchEars,
    touchMouth,
    touchToes,
    touchHands,
    touchTummy,
    touchKnees,
    touchShoulders,
    ballOf('red', 'あかい ボール', P.red),
    ballOf('blue', 'あおい ボール', P.blue),
    ballOf('yellow', 'きいろい ボール', P.yellow),
    ballOf('green', 'みどりの ボール', P.green),
    ballOf('pink', 'ピンクの ボール', P.pink),
    ballOf('orange', 'オレンジの ボール', P.orange),
    ballOf('purple', 'むらさきの ボール', P.purple),
    ballOf('white', 'しろい ボール', P.white),
    meet,
    bye,
    gift,
    sorry,
    birthday,
    ...(['cat', 'dog', 'rabbit'] as const).flatMap((k) =>
      (['in', 'on', 'under'] as const).map((p) => whereDef(k, p)),
    ),
    blocks,
  ].map((d) => [d.id, d]),
);
