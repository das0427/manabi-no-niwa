/** explain の見本の問題（統括が画面で確かめる用） */
import type { ExplainItem } from './explain';

export const EXPLAIN_SAMPLES: ExplainItem[] = [
  {
    id: 'sample-explain-draw',
    engine: 'explain',
    objective: 'o1',
    level: 0,
    prompt: 'すきな くだものの えを かいてみよう',
    canvas: { aspect: 4 / 3 },
    hints: ['まるい くだものかな、ながい くだものかな', 'いろも えらべるよ'],
    explain: 'すてきな えが かけたね',
    identity: 'explain:fruit',
  },
  {
    id: 'sample-explain-reason',
    engine: 'explain',
    objective: 'o2',
    level: 0,
    prompt:
      'あさがおの つるが ぼうに まきつくのは なぜだと おもう？ わけを えらんで、えでも かいてみよう',
    reasons: [
      { label: 'たかい ところへ のびるため' },
      { label: 'かぜで たおれないため' },
      { label: 'ほかの わけ（えで かこう）' },
    ],
    multiReasons: true,
    canvas: { aspect: 4 / 3, colors: true },
    require: { reason: true, drawing: false },
    hints: [
      'つるの さきは どちらを むいて いたかな',
      'ぼうが なかったら どうなるかな',
      'じぶんの かんがえで いいよ',
    ],
    explain: 'じぶんの かんがえを かけたね。おうちの ひとにも おはなし してみよう',
    identity: 'explain:asagao-reason',
  },
  {
    id: 'sample-explain-write',
    engine: 'explain',
    objective: 'o3',
    level: 0,
    prompt: 'きょう たのしかった ことを かいてみよう',
    canvas: { aspect: 16 / 9, guide: 'lines', colors: false },
    hints: ['だれと なにを したかな', 'どんな きもちだったかな', 'みじかくて いいよ'],
    explain: 'かけたね。あとで おうちの ひとと みてみよう',
    identity: 'explain:diary',
  },
];
