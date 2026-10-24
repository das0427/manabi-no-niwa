/**
 * g1.ja.hiragana-write ひらがなの かき（書き順・お手本比較・似た字の書き分け）。curriculum-matrix 3.4。
 *
 * 到達項目:
 *   seion1   … あ〜と の 20字を書き順でなぞる（trace）。別例 = なぞってから自分で書いてお手本と比べる（trace-free。自由書きは採点しない）
 *   seion2   … な〜ん の 26字（同上）
 *   daku     … 「゛」「゜」の 25字（同上）
 *   kakiwake … 形の似た字の書き分け（ことばの□に入る字を選ぶ）。別例 = 字の形のちがいを問う
 * 手書きの字形は採点しない（curriculum-matrix 2.5）。書き順は KanjiVG 由来の書き順データで追跡する。
 * 同一性キー: なぞり `trace:<字>`、お手本比較 `free:<字>`、書き分け `kakiwake:<語>`。
 */
import type { TraceItem } from '../../engines/trace/trace';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

/** 画数（src/packs/_data/strokes/kana.json の書き順データと同じ数） */
const STROKES: Record<string, number> = {
  あ: 3,
  い: 2,
  う: 2,
  え: 2,
  お: 3,
  か: 3,
  き: 4,
  く: 1,
  け: 3,
  こ: 2,
  さ: 3,
  し: 1,
  す: 2,
  せ: 3,
  そ: 1,
  た: 4,
  ち: 2,
  つ: 1,
  て: 1,
  と: 2,
  な: 4,
  に: 3,
  ぬ: 2,
  ね: 2,
  の: 1,
  は: 3,
  ひ: 1,
  ふ: 4,
  へ: 1,
  ほ: 4,
  ま: 3,
  み: 2,
  む: 3,
  め: 2,
  も: 3,
  や: 3,
  ゆ: 2,
  よ: 2,
  ら: 2,
  り: 2,
  る: 1,
  れ: 2,
  ろ: 1,
  わ: 2,
  を: 3,
  ん: 1,
  が: 5,
  ぎ: 6,
  ぐ: 3,
  げ: 5,
  ご: 4,
  ざ: 5,
  じ: 3,
  ず: 4,
  ぜ: 5,
  ぞ: 3,
  だ: 6,
  ぢ: 4,
  づ: 3,
  で: 3,
  ど: 4,
  ば: 5,
  び: 3,
  ぶ: 6,
  べ: 3,
  ぼ: 6,
  ぱ: 4,
  ぴ: 2,
  ぷ: 5,
  ぺ: 2,
  ぽ: 5,
};

/** 字を使うことば（解説の例） */
const EXAMPLE: Record<string, string> = {
  あ: 'あり',
  い: 'いぬ',
  う: 'うし',
  え: 'えき',
  お: 'おに',
  か: 'かめ',
  き: 'きつね',
  く: 'くま',
  け: 'けむり',
  こ: 'こま',
  さ: 'さる',
  し: 'しか',
  す: 'すいか',
  せ: 'せみ',
  そ: 'そら',
  た: 'たこ',
  ち: 'ちず',
  つ: 'つくえ',
  て: 'てがみ',
  と: 'とり',
  な: 'なす',
  に: 'にじ',
  ぬ: 'ぬりえ',
  ね: 'ねこ',
  の: 'のり',
  は: 'はな',
  ひ: 'ひよこ',
  ふ: 'ふね',
  へ: 'へび',
  ほ: 'ほし',
  ま: 'まめ',
  み: 'みみ',
  む: 'むし',
  め: 'めだか',
  も: 'もも',
  や: 'やま',
  ゆ: 'ゆき',
  よ: 'よる',
  ら: 'らくだ',
  り: 'りんご',
  る: 'はる',
  れ: 'れもん',
  ろ: 'ろうか',
  わ: 'わに',
  を: 'ほんを よむ',
  ん: 'きりん',
  が: 'がけ',
  ぎ: 'うさぎ',
  ぐ: 'ぐみ',
  げ: 'げた',
  ご: 'ごま',
  ざ: 'ざる',
  じ: 'ひつじ',
  ず: 'みみず',
  ぜ: 'かぜ',
  ぞ: 'ぞう',
  だ: 'だんご',
  ぢ: 'はなぢ',
  づ: 'みかづき',
  で: 'でんわ',
  ど: 'どんぐり',
  ば: 'ばら',
  び: 'えび',
  ぶ: 'ぶた',
  べ: 'かべ',
  ぼ: 'ぼうし',
  ぱ: 'ぱん',
  ぴ: 'えんぴつ',
  ぷ: 'てんぷら',
  ぺ: 'ぺたぺた',
  ぽ: 'たんぽぽ',
};

const SEION1 = [...'あいうえおかきくけこさしすせそたちつてと'];
const SEION2 = [...'なにぬねのはひふへほまみむめもやゆよらりるれろわをん'];
const DAKU = [...'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'];
/** お手本比較（別例）にする字: 形をくらべる意味の大きい字 */
const FREE: Record<'seion1' | 'seion2' | 'daku', string[]> = {
  seion1: ['あ', 'き', 'さ', 'ち', 'て'],
  seion2: ['ぬ', 'ね', 'ま', 'る', 'を'],
  daku: ['が', 'ぢ', 'ば', 'ぱ'],
};

function traceItem(k: string, objective: string, level: number, free: boolean): TraceItem {
  const n = STROKES[k]!;
  const daku = DAKU.includes(k);
  return {
    engine: 'trace',
    id: `${free ? 'free' : 'trace'}:${k}`,
    objective,
    level,
    prompt: free
      ? `「${k}」を なぞったら、じぶんで かいて おてほんと くらべよう。`
      : `「${k}」を かきじゅんどおりに なぞろう。`,
    char: k,
    mode: free ? 'trace-free' : 'trace',
    misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' },
    hints: [
      'みどりの まるから かきはじめよう。',
      daku
        ? '「゛」や「゜」は さいごに かくよ。すうじの じゅんに なぞろう。'
        : 'すうじの じゅんに、うえから したへ、ひだりから みぎへ なぞるよ。',
      `ぜんぶで ${n}かく。さいごの かくまで ていねいに なぞろう。`,
    ],
    explain: free
      ? `「${k}」は ${n}かく。おてほんと くらべて、にて いる ところを みつけよう。（「${EXAMPLE[k]}」の「${k}」）`
      : `「${k}」は ${n}かくで かくよ。「${EXAMPLE[k]}」の「${k}」だね。`,
    identity: `${free ? 'free' : 'trace'}:${k}`,
    ...(free ? { alt: true } : {}),
  };
}

function traceGroup(
  chars: string[],
  objective: 'seion1' | 'seion2' | 'daku',
  level: number,
): Item[] {
  return [
    ...chars.map((k) => traceItem(k, objective, level, false)),
    ...FREE[objective].map((k) => traceItem(k, objective, level, true)),
  ];
}

// ---- kakiwake: ことばの□に入る字を選ぶ（読み上げで語を聞いて、正しい字を選ぶ = 書き分け） ----
type K = [word: string, at: number, wrongs: string[]];
const KAKIWAKE: K[] = [
  ['いぬ', 1, ['め']],
  ['あめ', 1, ['ぬ', 'あ']],
  ['ねこ', 0, ['れ', 'わ']],
  ['わに', 0, ['ね', 'れ']],
  ['れもん', 0, ['ね', 'わ']],
  ['さる', 1, ['ろ']],
  ['ろうか', 0, ['る']],
  ['はな', 0, ['ほ']],
  ['ほし', 0, ['は', 'ま']],
  ['さかな', 0, ['ち', 'き']],
  ['ちず', 0, ['さ', 'ら']],
  ['きつね', 0, ['さ']],
  ['おに', 0, ['あ', 'す']],
  ['あり', 0, ['お', 'め']],
  ['てがみ', 0, ['そ']],
  ['そら', 0, ['て']],
];
function kakiwakeItem([word, at, wrongs]: K): ChoiceItem {
  const chars = [...word];
  const ans = chars[at]!;
  const blanked = chars.map((c, i) => (i === at ? '□' : c)).join('');
  return {
    engine: 'choice',
    id: `kakiwake:${word}`,
    objective: 'kakiwake',
    level: 1,
    prompt: `「${word}」と かくよ。□に はいる じは どれ？`,
    figure: { kind: 'text', text: blanked, size: 'xl' },
    options: opts(
      ans,
      wrongs.map((w): Wrong => [w, 'shape-similar']),
    ),
    hints: [
      `「${word}」を ゆっくり こえに だして、□の ところの おとを きこう。`,
      'かたちの にて いる じが ならんで いるよ。まがりかたや むすびかたを みくらべよう。',
      `□は ${at === 0 ? 'はじめ' : `${at + 1}ばんめ`}の おと。その おとの じを えらぼう。`,
    ],
    explain: `「${word}」の □は「${ans}」。「${wrongs.join('」「')}」と にて いるので、かたちに きを つけて かこう。`,
    identity: `kakiwake:${word}`,
  };
}

/** kakiwake の別例: 形のちがいを問う */
const FEATURE: {
  id: string;
  prompt: string;
  ans: string;
  wrongs: string[];
  hint3: string;
  explain: string;
}[] = [
  {
    id: 'nu-me',
    prompt: '「ぬ」と「め」。さいごに くるんと まるく むすぶのは どっち？',
    ans: 'ぬ',
    wrongs: ['め'],
    hint3: '「いぬ」の さいごの じを おもいだそう。',
    explain: '「ぬ」は さいごに くるんと むすぶ。「め」は むすばないよ。',
  },
  {
    id: 'ru-ro',
    prompt: '「る」と「ろ」。さいごに くるんと まるく むすぶのは どっち？',
    ans: 'る',
    wrongs: ['ろ'],
    hint3: '「はる」の さいごの じを おもいだそう。',
    explain: '「る」は さいごに くるんと むすぶ。「ろ」は むすばないよ。',
  },
  {
    id: 'ne-re-wa',
    prompt: '「ね」「れ」「わ」。さいごに くるんと まるく むすぶのは どれ？',
    ans: 'ね',
    wrongs: ['れ', 'わ'],
    hint3: '「ねこ」の はじめの じを おもいだそう。',
    explain:
      '「ね」は さいごに むすぶ。「れ」は さいごを みぎに のばす。「わ」は まるく おわるよ。',
  },
  {
    id: 'ha-ho',
    prompt: '「は」と「ほ」。みぎがわに よこの せんが 2ほん あるのは どっち？',
    ans: 'ほ',
    wrongs: ['は'],
    hint3: '「ほし」の はじめの じを おもいだそう。',
    explain: '「ほ」は よこの せんが 2ほん。「は」は 1ぽんだよ。',
  },
  {
    id: 'sa-chi',
    prompt: '「さ」と「ち」。いちばん したの まがった せんが、みぎに ふくらんで いるのは どっち？',
    ans: 'ち',
    wrongs: ['さ'],
    hint3: '「ちず」の はじめの じを おもいだそう。',
    explain: '「ち」は したの せんが みぎに ふくらむ。「さ」は ひだりに ふくらむよ。',
  },
];
function featureItem(f: (typeof FEATURE)[number]): ChoiceItem {
  return {
    engine: 'choice',
    id: `kakiwake-feature:${f.id}`,
    objective: 'kakiwake',
    level: 2,
    prompt: f.prompt,
    options: opts(
      f.ans,
      f.wrongs.map((w): Wrong => [w, 'shape-similar']),
    ),
    hints: [
      'ゆびで くうに かいて みよう。',
      'さいごの かくが どう おわるかを くらべよう。',
      f.hint3,
    ],
    explain: f.explain,
    identity: `kakiwake-feature:${f.id}`,
    alt: true,
  };
}

const items: Item[] = [
  ...traceGroup(SEION1, 'seion1', 0),
  ...traceGroup(SEION2, 'seion2', 1),
  ...traceGroup(DAKU, 'daku', 2),
  ...KAKIWAKE.map(kakiwakeItem),
  ...FEATURE.map(featureItem),
];

export const hiraganaWrite: UnitSpec = {
  id: 'g1.ja.hiragana-write',
  title: 'ひらがなを かこう',
  stage: 'g1',
  subject: 'ja',
  domain: 'kaku',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p5.hand.kana-trace'],
  objectives: [
    { id: 'seion1', title: '「あ」から「と」を かく' },
    { id: 'seion2', title: '「な」から「ん」を かく' },
    { id: 'daku', title: '「゛」「゜」の つく じを かく' },
    { id: 'kakiwake', title: 'にて いる じを かきわける' },
  ],
  misconceptions: [
    {
      id: 'stroke-order',
      explain: 'かく じゅんばんが ちがったのかな。すうじの じゅんに なぞろう。',
    },
    {
      id: 'stroke-direction',
      explain: 'はんたいの むきから かいたのかな。みどりの まるから かきはじめよう。',
    },
    {
      id: 'shape-similar',
      explain:
        'かたちの にて いる じと まちがえたのかな。さいごの かくの おわりかたを くらべよう。',
    },
  ],
  levels: [
    { label: '「あ」〜「と」', chance: 0.02 },
    { label: '「な」〜「ん」、かきわけ', chance: 0.02 },
    { label: '「゛」「゜」', chance: 0.02 },
  ],
  intro: [
    {
      text: 'じは かく じゅんばんが きまって いるよ。みどりの まるから、すうじの じゅんに なぞろう。',
      figure: { kind: 'text', text: 'あ', size: 'xl' },
    },
    {
      text: '「゛」（てんてん）や「゜」（まる）は、さいごに みぎうえに かくよ。',
      figure: { kind: 'text', text: 'か → が　は → ぱ', size: 'xl' },
    },
    {
      text: 'じぶんで かいたら、おてほんと くらべよう。にて いれば だいじょうぶ。',
    },
  ],
  source: { kind: 'items', items },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(1)ウ（平仮名を書くこと）、(3)ウ 書写（点画の書き方、筆順）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
