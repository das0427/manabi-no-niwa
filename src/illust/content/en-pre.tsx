/**
 * en-pre（幼児向けの英語）の絵 26枚（docs/expansion/p2-design/preschool-english.md 6.11）。
 *   enpre-icon … 「えいご」の札の絵（吹き出しの中で手をふる手）
 *   enpre-act-*（8）… うさぎがその動きをしている全身の絵（動きは短い線で示す）
 *   enpre-touch-*（6）… うさぎがその部分をさわっている絵（さわっている所に sun の丸。色だけに頼らず丸の形で）
 *   enpre-ball-*（8）… 色の名前の聞き取りに使うボール（1つの関数で色だけ変える）
 *   enpre-meet / enpre-bye / enpre-gift … あいさつの場面
 * 画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・palette の色だけ・文字・アルファベットを描かない）。
 * P2 の絵（enpre-cat-in など）は、その単元を作るときに足す。
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
  ].map((d) => [d.id, d]),
);
