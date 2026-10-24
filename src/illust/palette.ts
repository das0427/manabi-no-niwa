/** イラスト用パレット（正本: DESINGN.md 6.1）。ここにない色はイラストに使わない */
export const P = {
  red: '#D9534A',
  redDark: '#B23A33',
  yellow: '#F2C230',
  orange: '#EE9A3A',
  green: '#6BAA4F',
  greenDark: '#4A8236',
  brown: '#A8743E',
  tan: '#E3B98A',
  cream: '#FFF4DC',
  white: '#FFFDF8',
  gray: '#9AA3A8',
  blue: '#6FA8D6',
  pink: '#F4A7B9',
  purple: '#7B5AA6',
  ink: '#4A3B32',
  cheek: '#F2A99A',
  /** UI トークンと共通の色（アイコン用） */
  wood: '#D9A86C',
  leaf: '#5E9E5B',
  sky: '#8CC3E0',
  sun: '#F2C14E',
  paper: '#FBF5E9',
} as const;

export const PALETTE_VALUES: readonly string[] = Object.values(P).map((v) => v.toUpperCase());
