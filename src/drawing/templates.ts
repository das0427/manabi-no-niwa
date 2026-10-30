/**
 * かみ（テンプレートの背景。architecture.md 7.1 の background.kind = 'template'）。
 * - 絵はこのアプリの自作（DESINGN.md 6.1 のパレットの色、ぼかし・グラデーションなし、文字なし）
 * - 作品には SVG の文字列をそのまま持つ（はんこの素材と同じく、あとで絵を変えても作品は変わらない）
 * - 背景の上に描く。塗りつぶしの境界にもなる（そらだけ・じめんだけを塗れる）
 * - 学習連携（X-DL）の入口からは `#/draw/new/<templateId>` で開ける
 */
import { P } from '../illust/palette';
import { PAPER_COLOR, type ArtBackground } from './model';

export interface PaperTemplate {
  id: string;
  /** 子供に見せる名前（ひらがな） */
  name: string;
  svg: string;
}

const W = 1600;
const H = 1000;
const INK = P.ink;

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="${PAPER_COLOR}"/>${body}</svg>`;

/** 波の線（左から右へ） */
function wave(y: number, amp: number, len: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < W; x += len) {
    d += ` Q${x + len / 4} ${y - amp} ${x + len / 2} ${y} T${x + len} ${y}`;
  }
  return d;
}

export const PAPER_TEMPLATES: readonly PaperTemplate[] = [
  {
    id: 'field',
    name: 'そらと くさはら',
    svg: svg(
      `<rect width="${W}" height="700" fill="${P.sky}" fill-opacity="0.45"/>` +
        `<rect y="700" width="${W}" height="300" fill="${P.green}" fill-opacity="0.5"/>` +
        `<path d="M0 700 L${W} 700" stroke="${INK}" stroke-width="5"/>` +
        `<circle cx="1440" cy="150" r="80" fill="${P.sun}" fill-opacity="0.7" stroke="${INK}" stroke-width="5"/>`,
    ),
  },
  {
    id: 'sea',
    name: 'うみ',
    svg: svg(
      `<rect width="${W}" height="520" fill="${P.sky}" fill-opacity="0.4"/>` +
        `<path d="${wave(520, 24, 200)} L${W} 860 L0 860 Z" fill="${P.blue}" fill-opacity="0.5"/>` +
        `<path d="${wave(520, 24, 200)}" fill="none" stroke="${INK}" stroke-width="5"/>` +
        `<rect y="860" width="${W}" height="140" fill="${P.tan}" fill-opacity="0.6"/>` +
        `<path d="M0 860 L${W} 860" stroke="${INK}" stroke-width="5"/>`,
    ),
  },
  {
    id: 'room',
    name: 'へや',
    svg: svg(
      `<rect width="${W}" height="740" fill="${P.cream}"/>` +
        `<rect y="740" width="${W}" height="260" fill="${P.wood}" fill-opacity="0.55"/>` +
        `<path d="M0 740 L${W} 740" stroke="${INK}" stroke-width="5"/>` +
        `<rect x="140" y="120" width="420" height="320" fill="${P.sky}" fill-opacity="0.45" stroke="${INK}" stroke-width="6"/>` +
        `<path d="M350 120 L350 440 M140 280 L560 280" stroke="${INK}" stroke-width="6"/>`,
    ),
  },
  {
    id: 'road',
    name: 'みち',
    svg: svg(
      `<rect width="${W}" height="560" fill="${P.sky}" fill-opacity="0.4"/>` +
        `<rect y="560" width="${W}" height="440" fill="${P.green}" fill-opacity="0.45"/>` +
        `<rect y="700" width="${W}" height="200" fill="${P.gray}" fill-opacity="0.6"/>` +
        `<path d="M0 560 L${W} 560 M0 700 L${W} 700 M0 900 L${W} 900" stroke="${INK}" stroke-width="5"/>` +
        `<path d="M40 800 L${W} 800" stroke="${PAPER_COLOR}" stroke-width="14" stroke-dasharray="90 70"/>`,
    ),
  },
  {
    id: 'frame',
    name: 'がくぶち',
    svg: svg(
      `<path d="M0 0 H${W} V${H} H0 Z M70 70 V${H - 70} H${W - 70} V70 Z" fill-rule="evenodd" fill="${P.wood}"/>` +
        `<rect x="70" y="70" width="${W - 140}" height="${H - 140}" fill="none" stroke="${INK}" stroke-width="6"/>` +
        `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="${INK}" stroke-width="6"/>`,
    ),
  },
];

export function getTemplate(id: string): PaperTemplate | null {
  return PAPER_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** かみの ID から背景を作る。'plain'・未知の ID は白い紙 */
export function backgroundFor(templateId: string | null | undefined): ArtBackground {
  const t = templateId ? getTemplate(templateId) : null;
  return t
    ? { kind: 'template', templateId: t.id, svg: t.svg }
    : { kind: 'color', color: PAPER_COLOR };
}

/** 文書の背景が同じか（「あたらしく」で同じかみを選んだときは作り直さない） */
export function sameBackground(a: ArtBackground, b: ArtBackground): boolean {
  if (a.kind === 'color' && b.kind === 'color') return a.color === b.color;
  if (a.kind === 'template' && b.kind === 'template') return a.templateId === b.templateId;
  return false;
}
