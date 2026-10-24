/** trace の見本の問題（統括が画面で確かめる用） */
import type { TraceItem } from './trace';

export const TRACE_SAMPLES: TraceItem[] = [
  {
    id: 'sample-trace-shi',
    engine: 'trace',
    objective: 'o1',
    level: 0,
    prompt: '「し」を なぞろう',
    char: 'し',
    mode: 'trace',
    hints: ['みどりの まるから かこう', 'おてほんを みてね'],
    explain: 'うえから したへ、くるんと まがるね',
    identity: 'trace:し',
  },
  {
    id: 'sample-trace-ki',
    engine: 'trace',
    objective: 'o2',
    level: 0,
    prompt: '「木《き》」を 書《か》こう',
    char: '木',
    mode: 'trace-free',
    misconceptionIds: { order: 'm-stroke-order', direction: 'm-stroke-direction' },
    hints: [
      '1の ばんごうから 書《か》こう',
      'よこの 画《かく》から 書《か》くよ',
      'よこ → たて → ひだりはらい → みぎはらい',
    ],
    explain: '「木《き》」は 4画《かく》。よこ、たて、ひだりはらい、みぎはらい の じゅんだね',
    identity: 'trace:木',
  },
  {
    id: 'sample-trace-en-a',
    engine: 'trace',
    objective: 'o3',
    level: 0,
    prompt: 'おおもじの 「A」を かこう',
    char: 'A',
    mode: 'free',
    hints: [
      'まず おてほんを みよう',
      'やまの かたちを かいて、まんなかに よこぼう',
      'さいごに よこぼうを かこう',
    ],
    explain: 'A は やまの かたちに よこぼう だね',
    identity: 'trace:A',
  },
];
