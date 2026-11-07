/**
 * g1.ja.word-play ことばあそび（curriculum-matrix 3.2・P2）: しりとり・かぞえうた・かいぶん。
 * 設計: docs/expansion/p2-design/g1-ja.md 1章。問題文・選択肢・ヒント・解説は ひらがな（カタカナ）だけ。
 * 数え歌『にわの かぞえうた』は本アプリのオリジナル。回文の語は言い習わされた短い語句と自作の語句。
 * 同一性キー: しりとりは 前の語、数え歌は 数の語、回文は 正解の語句（空白を除く）。別例は名前。
 */
import type { ChoiceItem, ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { ListenItem } from '../../engines/listen/listen';
import { opts, type Wrong } from './util';

const REVISED_P2 = '2026-10-30';

const HEAD = 'wp-shiri-head';
const MID = 'wp-shiri-mid';
const NN = 'wp-shiri-n';
const TAIL = 'wp-shiri-tail';
const ONEWAY = 'wp-shiri-oneway';
const YOMI = 'wp-kz-yomi';
const SECOND = 'wp-kz-second';
const ORDER = 'wp-kz-order';
const OTHER = 'wp-kai-other';
const REPEAT = 'wp-kai-repeat';
const NEAR = 'wp-kai-near';
const WORDORDER = 'wp-kai-wordorder';
const KMID = 'wp-kai-mid';
const KNOWN = 'wp-kai-known';

type H3 = [string, string, string];

interface ChoiceArgs {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  correct: string;
  wrong: Wrong[];
  hints: H3;
  explain: string;
  alt?: boolean;
  figure?: Figure;
  layout?: 'row' | 'grid' | 'column';
  options?: ChoiceOption[];
}

function choice(a: ChoiceArgs): ChoiceItem {
  return {
    engine: 'choice',
    id: a.id,
    objective: a.obj,
    level: a.level,
    prompt: a.prompt,
    ...(a.figure ? { figure: a.figure } : {}),
    options: a.options ?? opts(a.correct, a.wrong),
    layout: a.layout ?? 'column',
    hints: a.hints,
    explain: a.explain,
    identity: a.id,
    ...(a.alt ? { alt: true } : {}),
  };
}

interface ListenArgs extends Omit<ChoiceArgs, 'figure'> {
  audio: { text: string }[];
  gapMs?: number;
  fixedOrder?: boolean;
}

function listen(a: ListenArgs): ListenItem {
  return {
    engine: 'listen',
    id: a.id,
    objective: a.obj,
    level: a.level,
    prompt: a.prompt,
    audio: a.audio,
    ...(a.gapMs ? { gapMs: a.gapMs } : {}),
    options: a.options ?? opts(a.correct, a.wrong),
    ...(a.fixedOrder ? { fixedOrder: true } : {}),
    layout: a.layout ?? 'column',
    hints: a.hints,
    explain: a.explain,
    identity: a.id,
    ...(a.alt ? { alt: true } : {}),
  };
}

const text = (t: string, size: 'm' | 'l' | 'xl'): Figure => ({ kind: 'text', text: t, size });
const illust = (id: string): Figure => ({ kind: 'illust', id });

// ---- しりとり ----

type ShiriRow = [prev: string, correct: string, wrongs: Wrong[], last: string];
const SHIRI: ShiriRow[] = [
  [
    'すいか',
    'かめ',
    [
      ['すずめ', HEAD],
      ['かばん', NN],
      ['いるか', MID],
    ],
    'か',
  ],
  [
    'たぬき',
    'きつね',
    [
      ['たいこ', HEAD],
      ['きりん', NN],
      ['ぬりえ', MID],
    ],
    'き',
  ],
  [
    'めだか',
    'かえる',
    [
      ['めがね', HEAD],
      ['かいだん', NN],
      ['だるま', MID],
    ],
    'か',
  ],
  [
    'ねずみ',
    'みみず',
    [
      ['ねこ', HEAD],
      ['みかん', NN],
    ],
    'み',
  ],
  [
    'からす',
    'すいか',
    [
      ['かもめ', HEAD],
      ['すいせん', NN],
      ['らっぱ', MID],
    ],
    'す',
  ],
  [
    'はさみ',
    'みのむし',
    [
      ['はなび', HEAD],
      ['みかん', NN],
      ['さかな', MID],
    ],
    'み',
  ],
  [
    'つくえ',
    'えんぴつ',
    [
      ['つばめ', HEAD],
      ['えほん', NN],
      ['くつ', MID],
    ],
    'え',
  ],
  [
    'ごりら',
    'らくだ',
    [
      ['ごま', HEAD],
      ['らいおん', NN],
      ['りす', MID],
    ],
    'ら',
  ],
  [
    'いちご',
    'ごぼう',
    [
      ['いるか', HEAD],
      ['ごはん', NN],
      ['ちくわ', MID],
    ],
    'ご',
  ],
  [
    'でんしゃ',
    'やま',
    [
      ['でんわ', HEAD],
      ['やかん', NN],
    ],
    'や',
  ],
];

const shiriItems: Item[] = SHIRI.map(([prev, correct, wrong, last]) => {
  const small = prev === 'でんしゃ';
  const hints: H3 = small
    ? [
        '「でんしゃ」の さいごの おとを、こえに だして いって みよう。',
        'さいごは ちいさい「ゃ」。おおきい「や」に して つなぐよ。',
        '「や」で はじまる ことばは 2つ あるね。「ん」で おわらない ほうは どれかな。',
      ]
    : [
        `「${prev}」の さいごの おとを、こえに だして いって みよう。`,
        `さいごの おとは「${last}」。「${last}」で はじまる ことばを さがそう。`,
        `「${last}」で はじまる ことばは 2つ あるね。「ん」で おわらない ほうは どれかな。`,
      ];
  const explain = small
    ? '「でんしゃ」の さいごは ちいさい「ゃ」。おおきい「や」に して、「やま」と つなぐよ。「やかん」は「ん」で おわるので、しりとりが おわって しまうね。'
    : `「${prev}」の さいごは「${last}」。「${correct}」は「${last}」で はじまって、「ん」で おわらないので つづけられるね。`;
  return choice({
    id: `shiri:${prev}`,
    obj: 'shiri',
    level: 0,
    prompt: `しりとり。「${prev}」の つぎに いえる ことばは どれ？`,
    correct,
    wrong,
    hints,
    explain,
  });
});

const shiriAlt: Item[] = [
  choice({
    id: 'shiri-alt:chain',
    obj: 'shiri',
    level: 0,
    alt: true,
    prompt: 'しりとりに なって いる ならびは どれ？',
    correct: 'りす → すいか → かめ',
    wrong: [
      ['りす → りんご → ごま', HEAD],
      ['りす → すいか → いか', MID],
    ],
    hints: [
      'やじるしの まえの ことばの さいごの おとを みよう。',
      '「りす」の さいごは「す」。つぎの ことばは「す」で はじまって いるかな。',
      '2つめから 3つめへの つながりも たしかめよう。「すいか」の さいごの おとは？',
    ],
    explain:
      '「りす」→「すいか」→「かめ」。さいごの おとと はじめの おとが ぜんぶ つながって いるね。',
  }),
  choice({
    id: 'shiri-alt:blank',
    obj: 'shiri',
    level: 0,
    alt: true,
    prompt: 'しりとりの □に はいる ことばは どれ？',
    figure: text('くつ → □ → めがね', 'l'),
    correct: 'つばめ',
    wrong: [
      ['つみき', ONEWAY],
      ['くるま', HEAD],
    ],
    hints: [
      '□の まえの「くつ」と、うしろの「めがね」を みよう。',
      '□は「つ」で はじまって、「め」で おわる ことばだよ。',
      '「つ」で はじまる ことばは 2つ。さいごが「め」なのは どちらかな。',
    ],
    explain: '「くつ」→「つばめ」→「めがね」。まえにも うしろにも つながるのは「つばめ」だね。',
  }),
  listen({
    id: 'shiri-alt:listen',
    obj: 'shiri',
    level: 0,
    alt: true,
    prompt: 'よく きいてね。つぎに いえる ことばは どれ？',
    audio: [{ text: 'しりとり。りんご、ごりら、らっぱ、ぱんだ。' }],
    correct: 'だるま',
    wrong: [
      ['ぱじゃま', HEAD],
      ['だいこん', NN],
    ],
    hints: [
      '「もういちど きく」で、もう いちど きいて みよう。',
      'さいごに きこえた ことばは「ぱんだ」。その さいごの おとを いって みよう。',
      '「だ」で はじまる ことばは 2つ。「ん」で おわらない ほうは どれかな。',
    ],
    explain:
      '「ぱんだ」の さいごは「だ」。「だるま」で つづけられるね。「だいこん」は「ん」で おわって しまうよ。',
  }),
  choice({
    id: 'shiri-alt:ship',
    obj: 'shiri',
    level: 0,
    alt: true,
    prompt: 'えで しりとり。「ふね」の つぎは どれ？',
    figure: illust('ship'),
    correct: '',
    wrong: [],
    layout: 'row',
    options: [
      { label: 'ねこ', figure: illust('cat'), correct: true },
      // 'balloon' ははんこ用の絵（stamps/）で素材一覧に無く、本番でも赤い破線の枠になる。同じ絵を登録した p5-balloon を使う
      { label: 'ふうせん', figure: illust('p5-balloon'), misconception: HEAD },
      { label: 'きつね', figure: illust('fox'), misconception: TAIL },
    ],
    hints: [
      '「ふね」の さいごの おとを いって みよう。',
      'さいごの おとは「ね」。「ね」で はじまる ものを さがそう。',
      '「ね」で おわる ものでは なくて、「ね」で はじまる ものだよ。',
    ],
    explain:
      '「ふね」の さいごは「ね」。「ねこ」は「ね」で はじまるね。「きつね」は「ね」で おわる ことばだよ。',
  }),
  choice({
    id: 'shiri-alt:flower',
    obj: 'shiri',
    level: 0,
    alt: true,
    prompt: 'えで しりとり。「はな」の つぎは どれ？',
    figure: illust('flower'),
    correct: '',
    wrong: [],
    layout: 'row',
    options: [
      { label: 'なす', figure: illust('eggplant'), correct: true },
      { label: 'はさみ', figure: illust('scissors'), misconception: HEAD },
      { label: 'バナナ', figure: illust('banana'), misconception: TAIL },
    ],
    hints: [
      '「はな」の さいごの おとを いって みよう。',
      'さいごの おとは「な」。「な」で はじまる ものを さがそう。',
      '「な」で おわる ものでは なくて、「な」で はじまる ものだよ。',
    ],
    explain:
      '「はな」の さいごは「な」。「なす」は「な」で はじまるね。「バナナ」は「な」で おわる ことばだよ。',
  }),
];

// ---- 数え歌 ----

const SONG = [
  'ひとつ ひよこが ぴよと なく',
  'ふたつ ふねが ぷかぷか うかぶ',
  'みっつ みかんが ころころ ころがる',
  'よっつ よぞらに おほしさま',
  'いつつ いるかが ざぶんと はねる',
  'むっつ むしが りんりん なく',
  'ななつ なすびが ならんでる',
  'やっつ やぎさん めえと なく',
  'ここのつ こまが くるくる まわる',
  'とおで とんぼが すいすい とぶ',
];
const SONG_FIG: Figure = {
  kind: 'column',
  gap: 0.5,
  items: SONG.map((t) => ({ kind: 'text' as const, text: t, size: 'm' as const })),
};

type KzRow = [num: string, head: string, correct: string, wrong: Wrong[]];
const KAZOE: KzRow[] = [
  [
    'ひとつ',
    'ひ',
    'ひよこ',
    [
      ['いちご', YOMI],
      ['とり', SECOND],
    ],
  ],
  [
    'ふたつ',
    'ふ',
    'ふね',
    [
      ['にじ', YOMI],
      ['たこ', SECOND],
    ],
  ],
  [
    'みっつ',
    'み',
    'みかん',
    [
      ['さる', YOMI],
      ['つくえ', SECOND],
    ],
  ],
  [
    'よっつ',
    'よ',
    'よぞら',
    [
      ['しか', YOMI],
      ['つき', SECOND],
    ],
  ],
  [
    'いつつ',
    'い',
    'いるか',
    [
      ['ごま', YOMI],
      ['つる', SECOND],
    ],
  ],
  [
    'むっつ',
    'む',
    'むし',
    [
      ['ろうそく', YOMI],
      ['つみき', SECOND],
    ],
  ],
  [
    'ななつ',
    'な',
    'なすび',
    [
      ['やぎ', ORDER],
      ['つばめ', SECOND],
    ],
  ],
  [
    'やっつ',
    'や',
    'やぎ',
    [
      ['はち', YOMI],
      ['つり', SECOND],
    ],
  ],
  [
    'ここのつ',
    'こ',
    'こま',
    [
      ['くり', YOMI],
      ['とんぼ', ORDER],
    ],
  ],
  [
    'とお',
    'と',
    'とんぼ',
    [
      ['ジュース', YOMI],
      ['おにぎり', SECOND],
    ],
  ],
];

const kazoeItems: Item[] = KAZOE.map(([num, head, correct, wrong], i) =>
  choice({
    id: `kazoe:${num}`,
    obj: 'kazoe',
    level: 1,
    prompt: `かぞえうたの きまりで、「${num}」の つぎに くる ことばは どれ？`,
    correct,
    wrong,
    hints: [
      'かぞえうたの きまりを おもいだそう。かずの ことばと、つぎの ことばの はじめの おとが おなじだよ。',
      `「${num}」を ゆっくり いって みよう。はじめの おとは なにかな。`,
      `「${num}」の はじめの おとは「${head}」。その おとで はじまる ことばは どれかな。`,
    ],
    explain: `「${num}」の はじめの おとは「${head}」。だから「${correct}」が つづくよ。うたでは「${SONG[i]}」。`,
  }),
);

const sg = (i: number) => ({ text: `${SONG[i]}。` });
const LISTEN_HINT = '「もういちど きく」で、もう いちど きいて みよう。';

const kazoeAlt: Item[] = [
  listen({
    id: 'kazoe-alt:listen-3',
    obj: 'kazoe',
    level: 1,
    alt: true,
    prompt: 'かぞえうたを きこう。「みっつ」の ところで でて きた ものは どれ？',
    audio: [sg(0), sg(1), sg(2)],
    gapMs: 600,
    correct: 'みかん',
    wrong: [
      ['ふね', ORDER],
      ['ひよこ', ORDER],
    ],
    hints: [
      LISTEN_HINT,
      '「みっつ」と きこえた すぐ あとを きこう。',
      '「みっつ」と おなじ「み」で はじまる ものだよ。',
    ],
    explain: '「みっつ みかんが ころころ ころがる」と うたって いたね。',
  }),
  listen({
    id: 'kazoe-alt:listen-7',
    obj: 'kazoe',
    level: 1,
    alt: true,
    prompt: 'かぞえうたを きこう。「ななつ」の ところで でて きた ものは どれ？',
    audio: [sg(5), sg(6)],
    gapMs: 600,
    correct: 'なすび',
    wrong: [
      ['むし', ORDER],
      ['ふね', ORDER],
    ],
    hints: [
      LISTEN_HINT,
      '「ななつ」と きこえた すぐ あとを きこう。',
      '「ななつ」と おなじ「な」で はじまる ものだよ。',
    ],
    explain: '「ななつ なすびが ならんでる」と うたって いたね。',
  }),
  listen({
    id: 'kazoe-alt:listen-next',
    obj: 'kazoe',
    level: 1,
    alt: true,
    prompt: 'かぞえうたを きこう。つぎに うたう かずは どれ？',
    audio: [sg(4), sg(5)],
    gapMs: 600,
    correct: 'ななつ',
    wrong: [
      ['やっつ', ORDER],
      ['しち', YOMI],
    ],
    hints: [
      LISTEN_HINT,
      'さいごに きこえた かずは「むっつ」だね。',
      '「いつつ、むっつ、……」と つづけて いって みよう。',
    ],
    explain:
      '「いつつ、むっつ」の つぎは「ななつ」。「しち」も 7の よみかただけれど、この うたは「ひとつ、ふたつ」の よみかたで うたうよ。',
  }),
];

type DigitRow = [
  name: string,
  digit: string,
  correct: string,
  wrong: Wrong[],
  h3: string,
  ex: string,
];
const DIGITS: DigitRow[] = [
  [
    'digit-4',
    '4',
    'よぞら',
    [
      ['しか', YOMI],
      ['いるか', ORDER],
    ],
    '4は「よっつ」。はじめの おとは「よ」だよ。',
    '4は「よっつ」。「よっつ よぞらに おほしさま」。「し」も 4の よみかただけれど、この うたでは「よっつ」と うたうよ。',
  ],
  [
    'digit-8',
    '8',
    'やぎ',
    [
      ['はち', YOMI],
      ['なすび', ORDER],
    ],
    '8は「やっつ」。はじめの おとは「や」だよ。',
    '8は「やっつ」。「やっつ やぎさん めえと なく」。「はち」も 8の よみかただけれど、この うたでは「やっつ」と うたうよ。',
  ],
  [
    'digit-3',
    '3',
    'みかん',
    [
      ['さる', YOMI],
      ['よぞら', ORDER],
    ],
    '3は「みっつ」。はじめの おとは「み」だよ。',
    '3は「みっつ」。「みっつ みかんが ころころ ころがる」。「さん」も 3の よみかただけれど、この うたでは「みっつ」と うたうよ。',
  ],
];

const digitItems: Item[] = DIGITS.map(([name, digit, correct, wrong, h3, ex]) =>
  choice({
    id: `kazoe-alt:${name}`,
    obj: 'kazoe',
    level: 1,
    alt: true,
    prompt: 'この かずを かぞえうたで うたうと、どの ことばが つづく？',
    figure: text(digit, 'xl'),
    correct,
    wrong,
    layout: 'row',
    hints: [
      'すうじを、「ひとつ、ふたつ」の よみかたで いって みよう。',
      `${digit}は「ひとつ、ふたつ……」で かぞえると なんと いうかな。`,
      h3,
    ],
    explain: ex,
  }),
);

// ---- 回文 ----

const rev = (s: string): string => [...s.replace(/\s/g, '')].reverse().join('');
const dotted = (s: string): string => [...s.replace(/\s/g, '')].join('・');

type KaRow = [correct: string, wrong: Wrong[]];
const KAIBUN_WORD: KaRow[] = [
  [
    'とまと',
    [
      ['ころころ', REPEAT],
      ['いか', OTHER],
    ],
  ],
  [
    'きつつき',
    [
      ['ぴかぴか', REPEAT],
      ['くつ', OTHER],
    ],
  ],
  [
    'しんぶんし',
    [
      ['ぐるぐる', REPEAT],
      ['かさ', OTHER],
    ],
  ],
  [
    'やおや',
    [
      ['ぶらぶら', REPEAT],
      ['かい', OTHER],
    ],
  ],
  [
    'みなみ',
    [
      ['ゆらゆら', REPEAT],
      ['たき', OTHER],
    ],
  ],
  [
    'こねこ',
    [
      ['くるくる', REPEAT],
      ['きく', OTHER],
    ],
  ],
];
const KAIBUN_SENT: KaRow[] = [
  [
    'たけやぶ やけた',
    [
      ['たけやぶ やいた', NEAR],
      ['やぶの たけ', WORDORDER],
    ],
  ],
  [
    'いか たべたかい',
    [
      ['いか たべたよ', NEAR],
      ['たべた いか', WORDORDER],
    ],
  ],
  [
    'にわの わに',
    [
      ['にわの かに', NEAR],
      ['にわの わにだ', NEAR],
    ],
  ],
  [
    'たいやき やいた',
    [
      ['たいやき やけた', NEAR],
      ['やいた たいやき', WORDORDER],
    ],
  ],
  [
    'かるい いるか',
    [
      ['かるい いるかだ', NEAR],
      ['おもい いるか', NEAR],
    ],
  ],
  [
    'なつまで まつな',
    [
      ['なつまで まってね', NEAR],
      ['まつな なつまで', WORDORDER],
    ],
  ],
];

const kaibunItems: Item[] = [...KAIBUN_WORD, ...KAIBUN_SENT].map(([correct, wrong], i) =>
  choice({
    id: `kaibun:${correct.replace(/\s/g, '')}`,
    obj: 'kaibun',
    level: 2,
    prompt:
      i < 6
        ? 'さかさに よんでも おなじに なる ことばは どれ？'
        : 'さかさに よんでも おなじに なる ものは どれ？',
    correct,
    wrong,
    hints: [
      'ことばを うしろから 1もじずつ よんで みよう。',
      `たとえば「${wrong[0]![0]}」を うしろから よむと「${rev(wrong[0]![0])}」。もとと ちがうね。`,
      'はじめと おわり、2ばんめと うしろから 2ばんめ……が おなじ ものを さがそう。',
    ],
    explain: `「${correct}」を うしろから よむと「${dotted(rev(correct))}」。もとと おなじに なるね。`,
  }),
);

const FILL_HINTS: H3 = [
  '□の ところを とばして、うしろから よんで みよう。',
  'さかさに よんでも おなじに なるには、はじめの おとと おわりの おと、2ばんめと うしろから 2ばんめ……が おなじに なるよ。',
  '□は、はじめから かぞえて なんばんめの おとと むかいあって いるかな。',
];

type FillRow = [name: string, fig: string, correct: string, wrong: Wrong[], explain: string];
const FILLS: FillRow[] = [
  [
    'fill-tomato',
    'と ま □',
    'と',
    [
      ['ま', KMID],
      ['る', KNOWN],
    ],
    '「と・ま・と」。うしろから よんでも「と・ま・と」に なるね。',
  ],
  [
    'fill-kitsutsuki',
    'き つ □ き',
    'つ',
    [
      ['き', KMID],
      ['ね', KNOWN],
    ],
    '「き・つ・つ・き」。うしろから よんでも「き・つ・つ・き」に なるね。',
  ],
  [
    'fill-takeyabu',
    'た け や ぶ や □ た',
    'け',
    [
      ['や', KMID],
      ['い', KNOWN],
    ],
    '「た・け・や・ぶ・や・け・た」。うしろから よんでも おなじに なるね。',
  ],
];

const fillItems: Item[] = FILLS.map(([name, fig, correct, wrong, explain]) =>
  choice({
    id: `kaibun-alt:${name}`,
    obj: 'kaibun',
    level: 2,
    alt: true,
    prompt: 'さかさに よんでも おなじに なるように、□に はいる おとは どれ？',
    figure: text(fig, 'xl'),
    correct,
    wrong,
    layout: 'row',
    hints: FILL_HINTS,
    explain,
  }),
);

type KlRow = [name: string, a: string, b: string, answer: 1 | 2, wrongMis: string, explain: string];
const KLISTEN: KlRow[] = [
  [
    'listen-tomato',
    'とまと',
    'とまる',
    1,
    NEAR,
    '「とまと」は うしろから よんでも「とまと」。「とまる」は「るまと」に なって しまうね。',
  ],
  [
    'listen-koneko',
    'こねる',
    'こねこ',
    2,
    NEAR,
    '「こねこ」は うしろから よんでも「こねこ」。「こねる」は「るねこ」に なって しまうね。',
  ],
  [
    'listen-minami',
    'ころころ',
    'みなみ',
    2,
    REPEAT,
    '「みなみ」は うしろから よんでも「みなみ」。「ころころ」は「ろころこ」に なって しまうね。',
  ],
];

const listenKaibun: Item[] = KLISTEN.map(([name, a, b, answer, mis, explain]) => {
  const labels = ['いちばん', 'にばん'];
  const options: ChoiceOption[] = labels.map((label, i) =>
    i + 1 === answer ? { label, correct: true } : { label, misconception: mis },
  );
  return listen({
    id: `kaibun-alt:${name}`,
    obj: 'kaibun',
    level: 2,
    alt: true,
    prompt: 'よく きいてね。さかさに よんでも おなじ ことばは なんばん？',
    audio: [{ text: `いちばん、${a}。` }, { text: `にばん、${b}。` }],
    gapMs: 800,
    fixedOrder: true,
    options,
    correct: '',
    wrong: [],
    layout: 'column',
    hints: [
      LISTEN_HINT,
      'きこえた 2つの ことばを、こえに だして いって みよう。',
      'それぞれ うしろから 1つずつ いって、もとの ことばと くらべよう。',
    ],
    explain,
  });
});

const ITEMS: Item[] = [
  ...shiriItems,
  ...shiriAlt,
  ...kazoeItems,
  ...kazoeAlt,
  ...digitItems,
  ...kaibunItems,
  ...fillItems,
  ...listenKaibun,
];

export const wordPlay: UnitSpec = {
  id: 'g1.ja.word-play',
  title: 'ことばあそび',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'music-note', // ja-g16.tsx（FX15）の音符の絵
  prereq: ['p4.ja.word-play'],
  objectives: [
    { id: 'shiri', title: 'しりとりで ことばを つなぐ' },
    { id: 'kazoe', title: 'かぞえうたの きまりを みつける' },
    { id: 'kaibun', title: 'さかさに よんでも おなじ ことば（かいぶん）' },
  ],
  misconceptions: [
    {
      id: HEAD,
      explain:
        'まえの ことばの はじめの おとで つないだのかな。しりとりは、まえの ことばの さいごの おとで つなぐよ。',
    },
    {
      id: MID,
      explain: 'ことばの まんなかの おとで つないだのかな。いちばん さいごの おとを たしかめよう。',
    },
    {
      id: NN,
      explain:
        '「ん」で おわる ことばを えらんだのかな。「ん」で はじまる ことばは ほとんど ないので、しりとりが おわって しまうよ。',
    },
    {
      id: TAIL,
      explain:
        'おなじ おとで おわる ことばを えらんだのかな。つぎの ことばは、さいごの おとで「はじまる」ことばだよ。',
    },
    {
      id: ONEWAY,
      explain:
        'まえの ことばと だけ つないだのかな。うしろの ことばにも つながるか、たしかめよう。',
    },
    {
      id: YOMI,
      explain:
        '「いち・に・さん」の よみかたで かんがえたのかな。この かぞえうたは「ひとつ・ふたつ・みっつ」の よみかたで うたうよ。',
    },
    {
      id: SECOND,
      explain:
        'かずの ことばの とちゅうや さいごの おとで えらんだのかな。かずの ことばの はじめの おとと おなじ おとで はじまるよ。',
    },
    {
      id: ORDER,
      explain:
        'となりの かずと とりちがえたのかな。「ひとつ、ふたつ、みっつ……」と じゅんに いって たしかめよう。',
    },
    {
      id: OTHER,
      explain:
        'さかさに すると べつの ことばに なる ものを えらんだのかな。「いか」は さかさに すると「かい」。もとと おなじに なる ものを さがそう。',
    },
    {
      id: REPEAT,
      explain:
        'おなじ おとが くりかえす ことばを えらんだのかな。「ころころ」は うしろから よむと「ろころこ」で、もとと ちがうよ。',
    },
    {
      id: NEAR,
      explain:
        'おしい！ にて いるけれど、うしろから よむと ちがう おとが あるよ。1もじずつ ゆびで たどって たしかめよう。',
    },
    {
      id: WORDORDER,
      explain:
        'ことばの じゅんばんを ぎゃくに したのかな。さかさに よむ ときは、1もじずつ うしろから よむよ。',
    },
    {
      id: KMID,
      explain:
        'となりの おとを そのまま いれたのかな。はじめと おわり、2ばんめと うしろから 2ばんめが おなじに なるように かんがえよう。',
    },
    {
      id: KNOWN,
      explain:
        'しって いる ことばに ひっぱられたのかな。うしろから よんでも おなじに なるかを たしかめよう。',
    },
  ],
  levels: [
    { label: 'しりとり', chance: 0.1 },
    { label: 'かぞえうた', chance: 0.1 },
    { label: 'かいぶん（さかさに よんでも おなじ）', chance: 0.1 },
  ],
  intro: [
    {
      text: 'しりとりは、まえの ことばの さいごの おとで はじまる ことばを つなぐ あそびだよ。「すいか」の つぎは「か」で はじまる ことば。「ん」で おわる ことばを いうと、そこで おわりだよ。',
    },
    {
      text: '「でんしゃ」の ように ちいさい「ゃ」で おわる ときは、この あそびでは おおきい「や」に して、「や」で はじまる ことばを つなぐよ。',
    },
    {
      text: 'かぞえうたは、かずの ことばと おなじ おとで はじまる ことばを ならべた うただよ。「ひとつ ひよこが ぴよと なく」。「ひとつ」も「ひよこ」も「ひ」で はじまるね。',
      figure: SONG_FIG,
    },
    {
      text: '「たけやぶ やけた」を うしろから 1もじずつ よむと、「た・け・や・ぶ・や・け・た」。さかさに よんでも おなじに なる ことばや ぶんを「かいぶん」と いうよ。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'none',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(3) イ（長く親しまれている言葉遊びを通して、言葉の豊かさに気付くこと）',
  gradeIsAppProposal: true,
  revised: REVISED_P2,
};
