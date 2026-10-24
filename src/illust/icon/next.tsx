import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const next: IllustDef = {
  id: 'next',
  label: 'つぎへ',
  status: 'final',
  draw: () => (
    <g>
      <path d="M8 36 H52 V14 L94 50 L52 86 V64 H8 Z" fill={P.leaf} {...line} />
    </g>
  ),
};
