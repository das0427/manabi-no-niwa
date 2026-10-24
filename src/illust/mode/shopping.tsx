import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const shopping: IllustDef = {
  id: 'mode-shopping',
  label: 'おかいものごっこ',
  status: 'final',
  draw: () => (
    <g>
      {/* かごの持ち手 */}
      <path d="M26 54 C26 8 74 8 74 54" fill="none" {...line} />
      {/* バナナ */}
      <path d="M54 56 C56 42 70 31 85 33 L87 40 C75 41 67 47 67 56 Z" fill={P.yellow} {...line} />
      <circle cx="85" cy="36" r="2.2" fill={P.brown} />
      {/* りんご */}
      <path d="M32 33 C33 28 34 26 36 24 L39 26 C37 28 37 30 37 33 Z" fill={P.brown} {...line} />
      <path d="M37 29 C40 22 47 22 49 25 C46 31 40 32 37 29 Z" fill={P.green} {...line} />
      <path
        d="M34 38 C30 33 19 35 19 47 C19 58 26 64 32 63 C34 62.5 36 62.5 38 63 C44 64 50 58 50 47 C50 35 39 33 34 38 Z"
        fill={P.red}
        {...line}
      />
      {/* かご本体 */}
      <path d="M12 52 L88 52 L80 90 L20 90 Z" fill={P.wood} {...line} />
      <path d="M17 68 L83 68" fill="none" {...line} />
    </g>
  ),
};
