import { line, type IllustDef } from '../types';

export const heart: IllustDef = {
  id: 'heart',
  label: 'すき',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 88 C14 64 6 42 12 30 C19 15 40 16 50 33 C60 16 81 15 88 30 C94 42 86 64 50 88 Z"
        fill="none"
        {...line}
      />
    </g>
  ),
};
