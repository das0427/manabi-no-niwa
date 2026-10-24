/**
 * 地図記号（このアプリで描いた絵。国土地理院の記号の形に倣っているが、画像は写していない）。
 * 100×100 の枠に、輪郭の色（ink）の線で描く。色では区別しない。
 * 統括への注記: 形は国土地理院「地図記号一覧」と目で見比べて確かめること（未確認の点は最終報告）。
 */
import type { ReactNode } from 'react';

export type SymbolId =
  | 'city-office'
  | 'town-office'
  | 'school'
  | 'high-school'
  | 'police'
  | 'koban'
  | 'fire'
  | 'post'
  | 'hospital'
  | 'shrine'
  | 'temple'
  | 'library'
  | 'museum'
  | 'factory'
  | 'power'
  | 'rice'
  | 'field'
  | 'orchard'
  | 'tea'
  | 'broadleaf'
  | 'conifer'
  | 'elderly'
  | 'onsen'
  | 'castle'
  | 'lighthouse'
  | 'port'
  | 'station';

/** 記号の名前（RichText） */
export const SYMBOL_NAME: Record<SymbolId, string> = {
  'city-office': '市役所《しやくしょ》',
  'town-office': '町村役場《ちょうそんやくば》',
  school: '学校《がっこう》',
  'high-school': '高等学校《こうとうがっこう》',
  police: '警察署《けいさつしょ》',
  koban: '交番《こうばん》',
  fire: '消防署《しょうぼうしょ》',
  post: '郵便局《ゆうびんきょく》',
  hospital: '病院《びょういん》',
  shrine: '神社《じんじゃ》',
  temple: '寺《てら》',
  library: '図書館《としょかん》',
  museum: '博物館《はくぶつかん》',
  factory: '工場《こうじょう》',
  power: '発電所《はつでんしょ》',
  rice: '田《た》',
  field: '畑《はたけ》',
  orchard: '果樹園《かじゅえん》',
  tea: '茶畑《ちゃばたけ》',
  broadleaf: '広葉樹林《こうようじゅりん》',
  conifer: '針葉樹林《しんようじゅりん》',
  elderly: '老人《ろうじん》ホーム',
  onsen: '温泉《おんせん》',
  castle: '城跡《しろあと》',
  lighthouse: '灯台《とうだい》',
  port: '港《みなと》',
  station: '駅《えき》',
};
export const SYMBOL_IDS = Object.keys(SYMBOL_NAME) as SymbolId[];
export const isSymbol = (x: unknown): x is SymbolId => typeof x === 'string' && x in SYMBOL_NAME;

/** 歯車（工場・発電所） */
function gear(cx: number, cy: number, r: number): string {
  const teeth = 8;
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r * 0.78;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

const SHAPES: Record<SymbolId, ReactNode> = {
  'city-office': (
    <>
      <circle cx={50} cy={50} r={38} />
      <circle cx={50} cy={50} r={22} />
    </>
  ),
  'town-office': <circle cx={50} cy={50} r={34} />,
  school: (
    // 「文」の字の形
    <>
      <line x1={50} y1={10} x2={50} y2={24} />
      <line x1={16} y1={28} x2={84} y2={28} />
      <path d="M30 32 Q 48 70 84 90" />
      <path d="M70 32 Q 52 70 16 90" />
    </>
  ),
  'high-school': (
    <>
      <circle cx={50} cy={50} r={42} />
      <line x1={50} y1={18} x2={50} y2={28} />
      <line x1={26} y1={31} x2={74} y2={31} />
      <path d="M38 34 Q 50 60 74 76" />
      <path d="M62 34 Q 50 60 26 76" />
    </>
  ),
  police: (
    <>
      <circle cx={50} cy={50} r={38} />
      <line x1={30} y1={30} x2={70} y2={70} />
      <line x1={70} y1={30} x2={30} y2={70} />
    </>
  ),
  koban: (
    <>
      <line x1={24} y1={24} x2={76} y2={76} />
      <line x1={76} y1={24} x2={24} y2={76} />
    </>
  ),
  fire: (
    // むかしの火消しの道具（さすまた）の形
    <>
      <path d="M22 18 Q 22 52 50 52 Q 78 52 78 18" />
      <line x1={50} y1={52} x2={50} y2={90} />
    </>
  ),
  post: (
    <>
      <circle cx={50} cy={50} r={40} />
      <line x1={28} y1={32} x2={72} y2={32} />
      <line x1={28} y1={46} x2={72} y2={46} />
      <line x1={50} y1={46} x2={50} y2={76} />
    </>
  ),
  hospital: (
    <>
      <circle cx={50} cy={50} r={38} />
      <line x1={50} y1={24} x2={50} y2={76} />
      <line x1={24} y1={50} x2={76} y2={50} />
    </>
  ),
  shrine: (
    // 鳥居
    <>
      <path d="M12 22 Q 50 14 88 22" />
      <line x1={22} y1={38} x2={78} y2={38} />
      <line x1={32} y1={20} x2={30} y2={90} />
      <line x1={68} y1={20} x2={70} y2={90} />
    </>
  ),
  temple: (
    // まんじ
    <>
      <line x1={50} y1={18} x2={50} y2={82} />
      <line x1={18} y1={50} x2={82} y2={50} />
      <line x1={50} y1={18} x2={22} y2={18} />
      <line x1={18} y1={50} x2={18} y2={80} />
      <line x1={50} y1={82} x2={78} y2={82} />
      <line x1={82} y1={50} x2={82} y2={20} />
    </>
  ),
  library: (
    // ひらいた本
    <>
      <path d="M50 30 Q 32 20 12 26 L 12 78 Q 32 72 50 82 Z" />
      <path d="M50 30 Q 68 20 88 26 L 88 78 Q 68 72 50 82 Z" />
    </>
  ),
  museum: (
    // 屋根と柱の建物
    <>
      <path d="M12 38 L 50 14 L 88 38 Z" />
      <line x1={26} y1={44} x2={26} y2={78} />
      <line x1={42} y1={44} x2={42} y2={78} />
      <line x1={58} y1={44} x2={58} y2={78} />
      <line x1={74} y1={44} x2={74} y2={78} />
      <line x1={12} y1={84} x2={88} y2={84} />
    </>
  ),
  factory: (
    <>
      <polygon points={gear(50, 50, 40)} />
      <circle cx={50} cy={50} r={12} />
    </>
  ),
  power: (
    // 歯車と電気の回路の線
    <>
      <polygon points={gear(50, 50, 38)} />
      <line x1={50} y1={22} x2={50} y2={78} />
      <line x1={38} y1={40} x2={62} y2={40} />
      <line x1={42} y1={58} x2={58} y2={58} />
    </>
  ),
  rice: (
    // 稲をかったあとの株（2本の線）
    <>
      <line x1={36} y1={26} x2={36} y2={74} />
      <line x1={64} y1={26} x2={64} y2={74} />
    </>
  ),
  field: (
    // 植物の ふたば
    <>
      <path d="M50 84 L 50 50" />
      <path d="M50 52 Q 26 50 18 22 Q 44 26 50 52" />
      <path d="M50 52 Q 74 50 82 22 Q 56 26 50 52" />
    </>
  ),
  orchard: (
    // 実の形
    <>
      <circle cx={50} cy={58} r={28} />
      <line x1={50} y1={30} x2={50} y2={10} />
    </>
  ),
  tea: (
    // 茶の実（3つの丸）
    <>
      <circle cx={50} cy={28} r={13} />
      <circle cx={28} cy={68} r={13} />
      <circle cx={72} cy={68} r={13} />
    </>
  ),
  broadleaf: (
    <>
      <circle cx={50} cy={40} r={28} />
      <line x1={50} y1={68} x2={50} y2={92} />
    </>
  ),
  conifer: (
    <>
      <path d="M22 70 L 50 14 L 78 70" />
      <line x1={50} y1={14} x2={50} y2={92} />
    </>
  ),
  elderly: (
    // 建物の中に つえ
    <>
      <path d="M12 46 L 50 14 L 88 46" />
      <path d="M22 40 L 22 88 L 78 88 L 78 40" />
      <path d="M58 82 L 58 52 Q 58 42 48 42 Q 40 42 40 50" />
    </>
  ),
  onsen: (
    <>
      <ellipse cx={50} cy={74} rx={34} ry={14} />
      <path d="M32 58 Q 24 46 32 36 Q 40 26 32 14" />
      <path d="M50 58 Q 42 46 50 36 Q 58 26 50 14" />
      <path d="M68 58 Q 60 46 68 36 Q 76 26 68 14" />
    </>
  ),
  castle: (
    // 城の なわばりの形
    <path d="M16 84 L 16 40 L 32 40 L 32 22 L 68 22 L 68 40 L 84 40 L 84 84 Z" />
  ),
  lighthouse: (
    <>
      <circle cx={50} cy={50} r={14} />
      <line x1={50} y1={10} x2={50} y2={28} />
      <line x1={50} y1={72} x2={50} y2={90} />
      <line x1={10} y1={50} x2={28} y2={50} />
      <line x1={72} y1={50} x2={90} y2={50} />
      <line x1={22} y1={22} x2={34} y2={34} />
      <line x1={78} y1={22} x2={66} y2={34} />
      <line x1={22} y1={78} x2={34} y2={66} />
      <line x1={78} y1={78} x2={66} y2={66} />
    </>
  ),
  port: (
    // いかり
    <>
      <circle cx={50} cy={20} r={9} />
      <line x1={50} y1={29} x2={50} y2={88} />
      <line x1={32} y1={42} x2={68} y2={42} />
      <path d="M16 62 Q 22 88 50 88 Q 78 88 84 62" />
    </>
  ),
  station: (
    <>
      <rect x={14} y={36} width={72} height={28} />
      <line x1={50} y1={36} x2={50} y2={64} />
    </>
  ),
};

/** 地図記号の絵。x, y, size を渡すと SVG の中に置く（渡さなければ単独の svg） */
export function MapSymbol({
  id,
  x,
  y,
  size,
  className,
}: {
  id: SymbolId;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
}) {
  const g = (
    <g className={`map-sym map-sym--${id}`} strokeLinecap="round" strokeLinejoin="round">
      {SHAPES[id]}
    </g>
  );
  if (x === undefined || y === undefined || size === undefined)
    return (
      <svg viewBox="0 0 100 100" className={className ?? 'map-symsvg'} aria-hidden>
        <rect x={0} y={0} width={100} height={100} className="map-sym__bg" />
        {g}
      </svg>
    );
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}>
      <rect x={0} y={0} width={100} height={100} rx={12} className="map-sym__bg" />
      {g}
    </g>
  );
}
