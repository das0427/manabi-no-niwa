/**
 * g6.soc.world 世界と日本（大陸と海洋、日本とつながりの深い国、国際協力）（curriculum-matrix 3.9、社6(3)）。
 *
 * 世界地図は map エンジンに無いので、この単元の SVG で「かんたんな 世界の 図」を描く（日本が中央の配置。
 * 大陸は番号 ①〜⑥、海洋はカタカナ ア〜ウ、国は ひらがな あ〜お の印。漢字は描き込まない。色だけで区別しない）。
 * 形は位置関係を示すための模式で、正確な形・面積ではない（intro と図の label に明記）。
 * 国旗は扱わない（色で区別させないため）。統計の数値・順位は答えにしない。
 * 外国のくらしは「〜という くらしの 例も ある」の書き方で、ひとくくりにしない。
 *
 * 到達項目:
 *   continents … 6つの大陸の名前と位置。別例 = 文だけ・特徴と線でむすぶ・方角から
 *   oceans     … 3つの海洋の名前と位置。別例 = 線でむすぶ・空欄・地図の端のつながり
 *   countries  … 日本とつながりの深い国の位置（大陸・方角）。別例 = 線でむすぶ・文から
 *   life       … くらしや文化の違いの尊重と国際協力。別例 = なかま分け・線でむすぶ・調べる記録（採点しない）
 * 同一性キー: 問題の id。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import {
  baseSoc,
  choiceItem,
  explainItem,
  fillItem,
  matchItem,
  sortItem,
  svg,
  textFig,
  type Allow,
  type Hints,
} from './util';

// ---- 名前 ----
const C = {
  eurasia: 'ユーラシア大陸《たいりく》',
  africa: 'アフリカ大陸《たいりく》',
  namerica: '北《きた》アメリカ大陸《たいりく》',
  samerica: '南《みなみ》アメリカ大陸《たいりく》',
  australia: 'オーストラリア大陸《たいりく》',
  antarctica: '南極大陸《なんきょくたいりく》',
} as const;
type Ck = keyof typeof C;
const CK: Ck[] = ['eurasia', 'africa', 'namerica', 'samerica', 'australia', 'antarctica'];

const O = {
  pacific: '太平洋《たいへいよう》',
  atlantic: '大西洋《たいせいよう》',
  indian: 'インド洋《よう》',
} as const;
type Ok = keyof typeof O;
const SEA_OF_JAPAN = '日本海《にほんかい》';

const N = {
  usa: 'アメリカ合衆国《がっしゅうこく》',
  china: '中華人民共和国《ちゅうかじんみんきょうわこく》',
  korea: '大韓民国《だいかんみんこく》',
  brazil: 'ブラジル',
  saudi: 'サウジアラビア',
} as const;
type Nk = keyof typeof N;

// ---- 世界の図（模式） ----
const NUM: Record<Ck, string> = {
  eurasia: '①',
  africa: '②',
  namerica: '③',
  samerica: '④',
  australia: '⑤',
  antarctica: '⑥',
};
const KANA_O: Record<Ok, string> = { pacific: 'ア', atlantic: 'イ', indian: 'ウ' };
const KANA_N: Record<Nk, string> = {
  usa: 'あ',
  china: 'い',
  korea: 'う',
  brazil: 'え',
  saudi: 'お',
};

const SHAPES: Record<Ck, string> = {
  eurasia:
    '30,30 120,15 220,12 240,20 238,40 232,60 225,80 210,95 190,100 175,86 160,105 140,95 125,82 105,76 90,70 70,65 50,60 35,50',
  africa: '60,80 100,80 115,95 112,125 95,160 80,165 70,140 55,110 50,90',
  namerica: '290,20 360,15 385,30 375,55 350,70 330,90 315,95 300,75 285,50 275,30',
  samerica: '320,105 345,105 365,120 355,150 340,175 330,185 322,160 315,125',
  australia: '200,140 240,135 255,150 245,170 210,170 198,158',
  antarctica: '20,194 380,194 380,206 20,206',
};
const NUM_AT: Record<Ck, [number, number]> = {
  eurasia: [150, 50],
  africa: [85, 120],
  namerica: [345, 38],
  samerica: [336, 160],
  australia: [226, 157],
  antarctica: [200, 204],
};
const OCEAN_AT: [Ok, number, number][] = [
  ['pacific', 275, 115],
  ['atlantic', 14, 120],
  ['atlantic', 392, 100],
  ['indian', 155, 140],
];
const PIN_AT: Record<Nk, [number, number]> = {
  usa: [330, 58],
  china: [195, 58],
  korea: [229, 46],
  brazil: [345, 130],
  saudi: [113, 72],
};
const JAPAN = '247,42 254,48 251,62 244,70 240,66 246,56';

function worldMap(show: { cont?: boolean; ocean?: boolean; pins?: Nk[] }): Figure {
  const t = (x: number, y: number, s: string, size = 14) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink)" font-weight="bold">${s}</text>`;
  const body = [
    '<rect x="0" y="0" width="400" height="210" fill="var(--sky)"/>',
    ...CK.map(
      (k) =>
        `<polygon points="${SHAPES[k]}" fill="${k === 'antarctica' ? 'var(--white)' : 'var(--leaf)'}" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`,
    ),
    `<polygon points="${JAPAN}" fill="var(--sun)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`,
    ...(show.cont
      ? CK.map((k) => t(NUM_AT[k][0], NUM_AT[k][1], NUM[k], k === 'antarctica' ? 11 : 16))
      : []),
    ...(show.ocean ? OCEAN_AT.map(([k, x, y]) => t(x, y, KANA_O[k], 16)) : []),
    ...(show.pins ?? []).map((k) => {
      const [x, y] = PIN_AT[k];
      return `<circle cx="${x}" cy="${y}" r="4" fill="var(--white)" stroke="var(--ink)" stroke-width="2"/>${t(x + 9, y - 8, KANA_N[k], 13)}`;
    }),
  ].join('');
  const what = [
    show.cont ? '大陸《たいりく》に①〜⑥の番号《ばんごう》' : '',
    show.ocean ? '海洋《かいよう》にア〜ウ' : '',
    show.pins?.length ? '国《くに》にあ〜おのしるし' : '',
  ]
    .filter(Boolean)
    .join('、');
  return svg(
    '0 0 400 210',
    body,
    `日本《にっぽん》をまん中《なか》にしたかんたんな世界《せかい》の図《ず》（形《かたち》はおおよそ。日本《にっぽん》は黄色《きいろ》でぬった細長《ほそなが》い形《かたち》）。${what}`,
  );
}

const MAP_C = worldMap({ cont: true });
const MAP_O = worldMap({ ocean: true });
const MAP_P = worldMap({ pins: ['usa', 'china', 'korea', 'brazil', 'saudi'] });

// ---- continents ----
const CONT_HINTS: Record<Ck, Hints> = {
  eurasia: [
    '日本《にっぽん》の西《にし》に広《ひろ》がっている大陸《たいりく》だよ。',
    'アジアとヨーロッパの国《くに》ぐにがある大陸《たいりく》だよ。',
    '6つの大陸《たいりく》の中《なか》でいちばん大《おお》きいよ。',
  ],
  africa: [
    '①の大陸《たいりく》の南西《なんせい》にあるよ。',
    '赤道《せきどう》が大陸《たいりく》のまん中《なか》あたりを通《とお》っているよ。',
    'ヨーロッパの南《みなみ》にある大陸《たいりく》だよ。',
  ],
  namerica: [
    '太平洋《たいへいよう》をはさんで、日本《にっぽん》の東《ひがし》のほうにあるよ。',
    '南《みなみ》にもう一《ひと》つの大陸《たいりく》がつながっているよ。',
    '二《ふた》つならんだアメリカの大陸《たいりく》の、北《きた》のほうだよ。',
  ],
  samerica: [
    '③の大陸《たいりく》と細《ほそ》い陸地《りくち》でつながっているよ。',
    '日本《にっぽん》から見《み》て、地球《ちきゅう》のほぼ反対側《はんたいがわ》のあたりをふくむよ。',
    '二《ふた》つならんだアメリカの大陸《たいりく》の、南《みなみ》のほうだよ。',
  ],
  australia: [
    '日本《にっぽん》の南《みなみ》のほうにあるよ。',
    '6つの大陸《たいりく》の中《なか》でいちばん小《ちい》さいよ。',
    '一《ひと》つの大陸《たいりく》が、ほぼ一《ひと》つの国《くに》になっているよ。',
  ],
  antarctica: [
    '図《ず》のいちばん下《した》にあるよ。',
    '一年《いちねん》じゅう、厚《あつ》い氷《こおり》におおわれているよ。',
    '地球《ちきゅう》のいちばん南《みなみ》の大陸《たいりく》だよ。',
  ],
};
const CONT_EXPLAIN: Record<Ck, string> = {
  eurasia:
    '①はユーラシア大陸《たいりく》。アジアとヨーロッパがあり、6つの中《なか》でいちばん大《おお》きい大陸《たいりく》だよ。',
  africa:
    '②はアフリカ大陸《たいりく》。ユーラシア大陸《たいりく》の南西《なんせい》にあり、赤道《せきどう》がまん中《なか》あたりを通《とお》るよ。',
  namerica:
    '③は北《きた》アメリカ大陸《たいりく》。太平洋《たいへいよう》をはさんで日本《にっぽん》の東《ひがし》のほうにあるよ。',
  samerica:
    '④は南《みなみ》アメリカ大陸《たいりく》。北《きた》アメリカ大陸《たいりく》の南《みなみ》につながっているよ。',
  australia:
    '⑤はオーストラリア大陸《たいりく》。日本《にっぽん》の南《みなみ》のほうにある、いちばん小《ちい》さい大陸《たいりく》だよ。',
  antarctica:
    '⑥は南極大陸《なんきょくたいりく》。地球《ちきゅう》のいちばん南《みなみ》にあり、厚《あつ》い氷《こおり》におおわれているよ。',
};
/** 正解と取りちがえやすい大陸（近いもの・名前の似たもの）を先に */
const CONT_WRONG: Record<Ck, Ck[]> = {
  eurasia: ['africa', 'australia', 'namerica'],
  africa: ['eurasia', 'samerica', 'australia'],
  namerica: ['samerica', 'eurasia', 'australia'],
  samerica: ['namerica', 'africa', 'australia'],
  australia: ['antarctica', 'africa', 'samerica'],
  antarctica: ['australia', 'samerica', 'africa'],
};
const contItems: Item[] = CK.map((k, i) =>
  choiceItem({
    id: `cont-map-${k}`,
    obj: 'continents',
    level: i < 3 ? 0 : 1,
    prompt: `図《ず》の${NUM[k]}はどの大陸《たいりく》？`,
    figure: MAP_C,
    right: C[k],
    wrongs: CONT_WRONG[k].map((w) => [C[w], 'mis-continent'] as const),
    hints: CONT_HINTS[k],
    explain: CONT_EXPLAIN[k],
  }),
);
const contAlts: Item[] = [
  choiceItem({
    id: 'cont-alt-ice',
    obj: 'continents',
    level: 1,
    alt: true,
    prompt:
      '一年《いちねん》じゅう厚《あつ》い氷《こおり》におおわれ、各国《かっこく》の観測《かんそく》の基地《きち》がある大陸《たいりく》は？',
    right: C.antarctica,
    wrongs: [
      [C.australia, 'mis-continent'],
      [C.eurasia, 'mis-continent'],
      [C.samerica, 'mis-continent'],
    ],
    hints: CONT_HINTS.antarctica,
    explain:
      '南極大陸《なんきょくたいりく》は地球《ちきゅう》のいちばん南《みなみ》にあり、厚《あつ》い氷《こおり》におおわれているよ。日本《にっぽん》も観測《かんそく》の基地《きち》をおいているよ。',
  }),
  choiceItem({
    id: 'cont-alt-south',
    obj: 'continents',
    level: 2,
    alt: true,
    prompt:
      '図《ず》を見《み》よう。日本《にっぽん》（黄色《きいろ》の細長《ほそなが》い形《かたち》）から見《み》て、南《みなみ》のほうにある大陸《たいりく》は？',
    figure: worldMap({}),
    right: C.australia,
    wrongs: [
      [C.namerica, 'mis-direction'],
      [C.africa, 'mis-direction'],
      [C.eurasia, 'mis-direction'],
    ],
    hints: [
      '図《ず》の上《うえ》が北《きた》、下《した》が南《みなみ》だよ。',
      '日本《にっぽん》からまっすぐ下《した》へ指《ゆび》でたどろう。',
      '海《うみ》をこえた先《さき》にある、小《ちい》さめの大陸《たいりく》だよ。',
    ],
    explain:
      '日本《にっぽん》の南《みなみ》のほうにはオーストラリア大陸《たいりく》があるよ。北《きた》アメリカ大陸《たいりく》は東《ひがし》、アフリカ大陸《たいりく》とユーラシア大陸《たいりく》は西《にし》のほうだね。',
  }),
  matchItem({
    id: 'cont-alt-match',
    obj: 'continents',
    level: 2,
    alt: true,
    prompt: '大陸《たいりく》と、そのようすを線《せん》でむすぼう。',
    pairs: [
      [
        C.eurasia,
        'アジアとヨーロッパの国《くに》ぐにがある、いちばん大《おお》きい大陸《たいりく》',
      ],
      [
        C.australia,
        'ほぼ一《ひと》つの国《くに》でできている、いちばん小《ちい》さい大陸《たいりく》',
      ],
      [
        C.antarctica,
        '厚《あつ》い氷《こおり》におおわれた、いちばん南《みなみ》の大陸《たいりく》',
      ],
    ],
    extras: ['日本《にっぽん》がある大陸《たいりく》'],
    mis: 'mis-continent',
    hints: [
      '大《おお》きさと位置《いち》を思《おも》い出《だ》そう。',
      'いちばん大《おお》きい大陸《たいりく》と、いちばん小《ちい》さい大陸《たいりく》はどれかな。',
      '日本《にっぽん》は島国《しまぐに》で、大陸《たいりく》の上《うえ》にはないよ。',
    ],
    explain:
      'ユーラシア大陸《たいりく》はいちばん大《おお》きく、オーストラリア大陸《たいりく》はいちばん小《ちい》さい大陸《たいりく》、南極大陸《なんきょくたいりく》は氷《こおり》におおわれているよ。日本《にっぽん》は海《うみ》にかこまれた島国《しまぐに》で、大陸《たいりく》にはふくまれないね。',
  }),
];

// ---- oceans ----
const OCEAN_HINTS: Record<Ok, Hints> = {
  pacific: [
    '日本《にっぽん》の東《ひがし》に広《ひろ》がる海洋《かいよう》だよ。',
    'アジアとアメリカの大陸《たいりく》の間《あいだ》にあるよ。',
    '3つの海洋《かいよう》の中《なか》でいちばん広《ひろ》いよ。',
  ],
  atlantic: [
    '図《ず》の左《ひだり》はしと右《みぎ》はしはつながっているよ。',
    'アメリカの大陸《たいりく》と、ヨーロッパ・アフリカの間《あいだ》にあるよ。',
    '名前《なまえ》に方角《ほうがく》の「西《にし》」が入《はい》っているよ。',
  ],
  indian: [
    'アフリカ大陸《たいりく》とオーストラリア大陸《たいりく》の間《あいだ》にあるよ。',
    'ユーラシア大陸《たいりく》の南《みなみ》に広《ひろ》がっているよ。',
    'アジアの国《くに》の名前《なまえ》がついた海洋《かいよう》だよ。',
  ],
};
const OCEAN_LIST: Ok[] = ['pacific', 'atlantic', 'indian'];
const oceanOpts = (right: Ok) =>
  [
    ...OCEAN_LIST.filter((k) => k !== right).map((k) => [O[k], 'mis-ocean'] as const),
    [SEA_OF_JAPAN, 'mis-sea'] as const,
  ] as const;
const oceanItems: Item[] = [
  ...OCEAN_LIST.map((k, i) =>
    choiceItem({
      id: `ocean-map-${k}`,
      obj: 'oceans',
      level: i === 0 ? 0 : 1,
      prompt: `図《ず》の${KANA_O[k]}はどの海洋《かいよう》？`,
      figure: MAP_O,
      right: O[k],
      wrongs: oceanOpts(k),
      hints: OCEAN_HINTS[k],
      explain: {
        pacific:
          'アは太平洋《たいへいよう》。日本《にっぽん》の東《ひがし》に広《ひろ》がる、いちばん広《ひろ》い海洋《かいよう》だよ。',
        atlantic:
          'イは大西洋《たいせいよう》。アメリカの大陸《たいりく》とヨーロッパ・アフリカの間《あいだ》にあるよ。図《ず》の左《ひだり》はしと右《みぎ》はしのイは同《おな》じ海洋《かいよう》だよ。',
        indian:
          'ウはインド洋《よう》。アフリカ大陸《たいりく》とオーストラリア大陸《たいりく》の間《あいだ》にあるよ。',
      }[k],
    }),
  ),
  choiceItem({
    id: 'ocean-japan-usa',
    obj: 'oceans',
    level: 0,
    prompt: `日本《にっぽん》と${N.usa}の間《あいだ》にある海洋《かいよう》は？`,
    right: O.pacific,
    wrongs: oceanOpts('pacific'),
    hints: OCEAN_HINTS.pacific,
    explain: `日本《にっぽん》と${N.usa}の間《あいだ》には太平洋《たいへいよう》があるよ。日本海《にほんかい》は、日本《にっぽん》とユーラシア大陸《たいりく》の間《あいだ》の海《うみ》だね。`,
  }),
  choiceItem({
    id: 'ocean-af-sa',
    obj: 'oceans',
    level: 1,
    prompt: `${C.africa}と${C.samerica}の間《あいだ》にある海洋《かいよう》は？`,
    right: O.atlantic,
    wrongs: oceanOpts('atlantic'),
    hints: OCEAN_HINTS.atlantic,
    explain:
      'アフリカ大陸《たいりく》と南《みなみ》アメリカ大陸《たいりく》の間《あいだ》には大西洋《たいせいよう》があるよ。',
  }),
  choiceItem({
    id: 'ocean-af-au',
    obj: 'oceans',
    level: 1,
    prompt: `${C.africa}と${C.australia}の間《あいだ》にある海洋《かいよう》は？`,
    right: O.indian,
    wrongs: oceanOpts('indian'),
    hints: OCEAN_HINTS.indian,
    explain:
      'アフリカ大陸《たいりく》とオーストラリア大陸《たいりく》の間《あいだ》にはインド洋《よう》があるよ。',
  }),
  choiceItem({
    id: 'ocean-largest',
    obj: 'oceans',
    level: 2,
    prompt: '3つの海洋《かいよう》の中《なか》で、いちばん広《ひろ》いものは？',
    right: O.pacific,
    wrongs: oceanOpts('pacific'),
    hints: [
      '図《ず》で、いちばん大《おお》きく広《ひろ》がっている海《うみ》をさがそう。',
      '日本《にっぽん》が面《めん》している海洋《かいよう》だよ。',
      'アジアとアメリカの大陸《たいりく》の間《あいだ》にあるよ。',
    ],
    explain:
      '3つの海洋《かいよう》の中《なか》でいちばん広《ひろ》いのは太平洋《たいへいよう》だよ。日本《にっぽん》は太平洋《たいへいよう》に面《めん》しているね。',
  }),
];
const oceanAlts: Item[] = [
  matchItem({
    id: 'ocean-alt-match',
    obj: 'oceans',
    level: 1,
    alt: true,
    prompt:
      '海洋《かいよう》と、その海洋《かいよう》をはさむ大陸《たいりく》を線《せん》でむすぼう。',
    pairs: [
      [O.pacific, 'ユーラシア大陸《たいりく》と北《きた》アメリカ大陸《たいりく》'],
      [O.atlantic, 'アフリカ大陸《たいりく》と南《みなみ》アメリカ大陸《たいりく》'],
      [O.indian, 'アフリカ大陸《たいりく》とオーストラリア大陸《たいりく》'],
    ],
    mis: 'mis-ocean',
    hints: [
      '日本《にっぽん》から東《ひがし》へ進《すす》むと、どの海洋《かいよう》をわたるかな。',
      'アメリカの大陸《たいりく》の東《ひがし》がわにある海洋《かいよう》はどれかな。',
      'オーストラリア大陸《たいりく》の西《にし》がわにある海洋《かいよう》はどれかな。',
    ],
    explain:
      '太平洋《たいへいよう》はユーラシア大陸《たいりく》と北《きた》アメリカ大陸《たいりく》の間《あいだ》、大西洋《たいせいよう》はアフリカ大陸《たいりく》と南《みなみ》アメリカ大陸《たいりく》の間《あいだ》、インド洋《よう》はアフリカ大陸《たいりく》とオーストラリア大陸《たいりく》の間《あいだ》だよ。',
  }),
  fillItem({
    id: 'ocean-alt-fill',
    obj: 'oceans',
    level: 0,
    alt: true,
    prompt: '空《あ》いているところに入《はい》ることばを選《えら》ぼう。',
    text: '日本《にっぽん》は、東《ひがし》がわを{{}}に面《めん》した島国《しまぐに》です。',
    blanks: [
      [
        O.pacific,
        [
          [O.atlantic, 'mis-ocean'],
          [O.indian, 'mis-ocean'],
        ],
      ],
    ],
    options: [O.pacific, O.atlantic, O.indian],
    hints: OCEAN_HINTS.pacific,
    explain:
      '日本《にっぽん》は東《ひがし》がわを太平洋《たいへいよう》に面《めん》した島国《しまぐに》だよ。',
  }),
  choiceItem({
    id: 'ocean-alt-edge',
    obj: 'oceans',
    level: 2,
    alt: true,
    prompt:
      '図《ず》の左《ひだり》はしと右《みぎ》はしに、同《おな》じ「イ」があるよ。どうしてかな？',
    figure: MAP_O,
    right:
      '地球《ちきゅう》は丸《まる》く、図《ず》の左《ひだり》はしと右《みぎ》はしはつながっているから',
    wrongs: [
      ['同《おな》じ名前《なまえ》の海洋《かいよう》が二《ふた》つあるから', 'mis-map-edge'],
      ['図《ず》のまちがいだから', 'mis-map-edge'],
    ],
    hints: [
      '地球儀《ちきゅうぎ》を思《おも》いうかべよう。',
      '地球《ちきゅう》は丸《まる》いので、平《たい》らな図《ず》にするとどこかで切《き》れ目《め》ができるね。',
      '右《みぎ》はしからさらに右《みぎ》へ進《すす》むと、どこに出《で》るかな。',
    ],
    explain:
      '地球《ちきゅう》は丸《まる》いので、平《たい》らな世界《せかい》の図《ず》では左《ひだり》はしと右《みぎ》はしがつながっているよ。だからイの大西洋《たいせいよう》は両《りょう》はしに分《わ》かれて見《み》えるんだ。',
  }),
];

// ---- countries ----
const N_CONT: Record<Nk, Ck> = {
  usa: 'namerica',
  china: 'eurasia',
  korea: 'eurasia',
  brazil: 'samerica',
  saudi: 'eurasia',
};
const N_HINTS: Record<Nk, Hints> = {
  usa: [
    'しるしがある大陸《たいりく》をたしかめよう。',
    '太平洋《たいへいよう》をはさんで、日本《にっぽん》の東《ひがし》のほうだよ。',
    '北《きた》アメリカ大陸《たいりく》にある国《くに》だよ。',
  ],
  china: [
    'しるしがある大陸《たいりく》をたしかめよう。',
    '日本《にっぽん》の西《にし》のほう、ユーラシア大陸《たいりく》の東《ひがし》がわだよ。',
    '日本《にっぽん》に漢字《かんじ》が伝《つた》わったもとの地域《ちいき》がある国《くに》だよ。',
  ],
  korea: [
    'しるしがある大陸《たいりく》をたしかめよう。',
    '日本《にっぽん》にとても近《ちか》い、日本海《にほんかい》をはさんだ西《にし》のほうだよ。',
    'ユーラシア大陸《たいりく》からつき出《で》た半島《はんとう》にある国《くに》だよ。',
  ],
  brazil: [
    'しるしがある大陸《たいりく》をたしかめよう。',
    '南《みなみ》アメリカ大陸《たいりく》の東《ひがし》がわだよ。',
    '日本《にっぽん》から見《み》て、地球《ちきゅう》のほぼ反対側《はんたいがわ》の国《くに》だよ。',
  ],
  saudi: [
    'しるしがある大陸《たいりく》をたしかめよう。',
    'ユーラシア大陸《たいりく》の西《にし》のほう、アフリカ大陸《たいりく》の近《ちか》くだよ。',
    '日本《にっぽん》が石油《せきゆ》を多《おお》く輸入《ゆにゅう》している国《くに》の一《ひと》つだよ。',
  ],
};
const N_EXPLAIN: Record<Nk, string> = {
  usa: `あは${N.usa}。北《きた》アメリカ大陸《たいりく》にあり、太平洋《たいへいよう》をはさんで日本《にっぽん》の東《ひがし》のほうにあるよ。`,
  china: `いは${N.china}。ユーラシア大陸《たいりく》の東《ひがし》がわ、日本《にっぽん》の西《にし》のほうにあるよ。`,
  korea: `うは${N.korea}。日本海《にほんかい》をはさんで、日本《にっぽん》のすぐ西《にし》のほうにある国《くに》だよ。`,
  brazil: `えは${N.brazil}。南《みなみ》アメリカ大陸《たいりく》にあり、日本《にっぽん》から見《み》て地球《ちきゅう》のほぼ反対側《はんたいがわ》の国《くに》だよ。`,
  saudi: `おは${N.saudi}。ユーラシア大陸《たいりく》の西《にし》のほう（アラビア半島《はんとう》）にある国《くに》だよ。`,
};
const N_WRONG: Record<Nk, Nk[]> = {
  usa: ['brazil', 'china', 'saudi'],
  china: ['korea', 'saudi', 'usa'],
  korea: ['china', 'saudi', 'brazil'],
  brazil: ['usa', 'saudi', 'korea'],
  saudi: ['china', 'brazil', 'korea'],
};
const NK: Nk[] = ['usa', 'china', 'korea', 'brazil', 'saudi'];
const countryItems: Item[] = [
  ...NK.map((k, i) =>
    choiceItem({
      id: `country-map-${k}`,
      obj: 'countries',
      level: i < 2 ? 0 : 1,
      prompt: `図《ず》の「${KANA_N[k]}」のしるしがある国《くに》はどれ？`,
      figure: MAP_P,
      right: N[k],
      wrongs: N_WRONG[k].map((w) => [N[w], 'mis-country'] as const),
      hints: N_HINTS[k],
      explain: N_EXPLAIN[k],
    }),
  ),
  ...(['korea', 'brazil', 'saudi'] as Nk[]).map((k) => {
    const right = N_CONT[k];
    const wrongs: Ck[] = (['eurasia', 'africa', 'namerica', 'samerica', 'australia'] as Ck[])
      .filter((c) => c !== right)
      .slice(0, 3);
    if (k === 'saudi') wrongs.splice(0, 3, 'africa', 'australia', 'samerica');
    return choiceItem({
      id: `country-cont-${k}`,
      obj: 'countries',
      level: 2,
      prompt: `${N[k]}はどの大陸《たいりく》にある？`,
      right: C[right],
      wrongs: wrongs.map((w) => [C[w], 'mis-continent'] as const),
      hints: [
        '地図帳《ちずちょう》や地球儀《ちきゅうぎ》で、国《くに》の位置《いち》をさがそう。',
        N_HINTS[k].slice(1).find((h) => !h.includes(C[right]))!,
        '日本《にっぽん》から見《み》た方角《ほうがく》も手《て》がかりにしよう。',
      ],
      explain: N_EXPLAIN[k].replace(/^[あいうえお]は /, ''),
    });
  }),
];
const countryAlts: Item[] = [
  matchItem({
    id: 'country-alt-match',
    obj: 'countries',
    level: 1,
    alt: true,
    prompt: '国《くに》と、その国《くに》がある大陸《たいりく》を線《せん》でむすぼう。',
    pairs: [
      [N.usa, C.namerica],
      [N.brazil, C.samerica],
      [N.china, C.eurasia],
    ],
    extras: [C.africa],
    mis: 'mis-continent',
    hints: [
      '地図帳《ちずちょう》で国《くに》の位置《いち》を思《おも》い出《だ》そう。',
      '名前《なまえ》がにている二《ふた》つのアメリカの大陸《たいりく》に気《き》をつけよう。',
      '日本《にっぽん》の西《にし》のほうの国《くに》は、大《おお》きな大陸《たいりく》にあるよ。',
    ],
    explain: `${N.usa}は北《きた》アメリカ大陸《たいりく》、${N.brazil}は南《みなみ》アメリカ大陸《たいりく》、${N.china}はユーラシア大陸《たいりく》にあるよ。`,
  }),
  choiceItem({
    id: 'country-alt-east',
    obj: 'countries',
    level: 1,
    alt: true,
    prompt:
      '日本《にっぽん》から見《み》て、太平洋《たいへいよう》をはさんで東《ひがし》のほうにある国《くに》は？',
    right: N.usa,
    wrongs: [
      [N.china, 'mis-direction'],
      [N.korea, 'mis-direction'],
      [N.saudi, 'mis-direction'],
    ],
    hints: [
      '地図《ちず》の右《みぎ》が東《ひがし》だよ。',
      '日本《にっぽん》から太平洋《たいへいよう》をわたった先《さき》の大陸《たいりく》を考《かんが》えよう。',
      '北《きた》アメリカ大陸《たいりく》にある国《くに》だよ。',
    ],
    explain: `${N.usa}は、太平洋《たいへいよう》をはさんで日本《にっぽん》の東《ひがし》のほうにあるよ。ほかの三《みっ》つは日本《にっぽん》の西《にし》のほうだね。`,
  }),
  choiceItem({
    id: 'country-alt-near',
    obj: 'countries',
    level: 0,
    alt: true,
    prompt:
      '日本海《にほんかい》をはさんで、日本《にっぽん》のすぐ西《にし》のほうにある国《くに》は？',
    right: N.korea,
    wrongs: [
      [N.brazil, 'mis-direction'],
      [N.usa, 'mis-direction'],
      [N.saudi, 'mis-direction'],
    ],
    hints: [
      '日本《にっぽん》にとても近《ちか》い国《くに》だよ。',
      '日本海《にほんかい》は日本《にっぽん》の西《にし》がわの海《うみ》だよ。',
      'ユーラシア大陸《たいりく》からつき出《で》た半島《はんとう》にある国《くに》だよ。',
    ],
    explain: `${N.korea}は、日本海《にほんかい》をはさんで日本《にっぽん》のすぐ西《にし》のほうにある国《くに》だよ。`,
  }),
  choiceItem({
    id: 'country-alt-opposite',
    obj: 'countries',
    level: 2,
    alt: true,
    prompt:
      '地球儀《ちきゅうぎ》で見《み》ると、日本《にっぽん》のほぼ反対側《はんたいがわ》にある国《くに》は？',
    right: N.brazil,
    wrongs: [
      [N.korea, 'mis-direction'],
      [N.china, 'mis-direction'],
      [N.usa, 'mis-direction'],
    ],
    hints: [
      '地球儀《ちきゅうぎ》で日本《にっぽん》に指《ゆび》をおき、そのうら側《がわ》を見《み》よう。',
      '日本《にっぽん》は北半球《きたはんきゅう》にあるから、反対側《はんたいがわ》は南半球《みなみはんきゅう》だね。',
      '南《みなみ》アメリカ大陸《たいりく》にある国《くに》だよ。',
    ],
    explain: `日本《にっぽん》のほぼ反対側《はんたいがわ》は南《みなみ》アメリカ大陸《たいりく》のあたりで、${N.brazil}があるよ。季節《きせつ》も日本《にっぽん》と反対《はんたい》になるよ。`,
  }),
];

// ---- life ----
const lifeItems: Item[] = [
  choiceItem({
    id: 'life-view',
    obj: 'life',
    level: 0,
    prompt:
      '外国《がいこく》のくらしを調《しら》べるときの考《かんが》え方《かた》として、よいものは？',
    right: 'その国《くに》の中《なか》にも、いろいろなくらしがあると考《かんが》える',
    wrongs: [
      [
        'その国《くに》の人《ひと》はみんな同《おな》じくらしだと決《き》めつける',
        'mis-stereotype',
      ],
      [
        '自分《じぶん》の国《くに》とちがうくらしは、まちがいだと考《かんが》える',
        'mis-stereotype',
      ],
      [
        '写真《しゃしん》一枚《いちまい》だけを見《み》て、その国《くに》のことを決《き》める',
        'mis-stereotype',
      ],
    ],
    hints: [
      '日本《にっぽん》の中《なか》でも、地域《ちいき》や家《いえ》によってくらしはちがうね。',
      '外国《がいこく》でも同《おな》じように、いろいろな人《ひと》がいるよ。',
      'ひとくくりにしない考《かんが》え方《かた》を選《えら》ぼう。',
    ],
    explain:
      'どの国《くに》の中《なか》にも、いろいろな人《ひと》といろいろなくらしがあるよ。決《き》めつけずに、ちがいを大切《たいせつ》にして調《しら》べよう。',
  }),
  choiceItem({
    id: 'life-un',
    obj: 'life',
    level: 0,
    prompt: '国際連合《こくさいれんごう》の主《おも》な目的《もくてき》は？',
    right:
      '世界《せかい》の平和《へいわ》と安全《あんぜん》を守《まも》り、国《くに》どうしの協力《きょうりょく》を進《すす》める',
    wrongs: [
      ['一《ひと》つの国《くに》の政治《せいじ》を決《き》める', 'mis-intl-org'],
      ['スポーツの大会《たいかい》だけを開《ひら》く', 'mis-intl-org'],
      ['世界《せかい》のお金《かね》を一《ひと》つにまとめる', 'mis-intl-org'],
    ],
    hints: [
      '多《おお》くの国《くに》が集《あつ》まって作《つく》った仕組《しく》みだよ。',
      '大《おお》きな戦争《せんそう》のあと、二度《にど》と戦争《せんそう》を起《お》こさないために作《つく》られたよ。',
      '「平和《へいわ》」と「協力《きょうりょく》」がかぎだよ。',
    ],
    explain:
      '国際連合《こくさいれんごう》は、世界《せかい》の平和《へいわ》と安全《あんぜん》を守《まも》り、国《くに》どうしの協力《きょうりょく》を進《すす》めるために、多《おお》くの国《くに》が集《あつ》まって作《つく》った仕組《しく》みだよ。日本《にっぽん》も加盟《かめい》しているよ。',
  }),
  choiceItem({
    id: 'life-unicef',
    obj: 'life',
    level: 1,
    prompt: 'ユニセフ（国連児童基金《こくれんじどうききん》）の主《おも》な活動《かつどう》は？',
    right: '世界《せかい》の子《こ》どもの命《いのち》と健康《けんこう》を守《まも》る',
    wrongs: [
      ['世界遺産《せかいいさん》を登録《とうろく》する', 'mis-intl-org'],
      ['国《くに》どうしの貿易《ぼうえき》の量《りょう》を決《き》める', 'mis-intl-org'],
      ['国《くに》の選挙《せんきょ》を行《おこな》う', 'mis-intl-org'],
    ],
    hints: [
      '「児童《じどう》」は子《こ》どものことだよ。',
      '栄養《えいよう》や予防接種《よぼうせっしゅ》、学《まな》びを支《ささ》える活動《かつどう》をしているよ。',
      '子《こ》どもを守《まも》る活動《かつどう》を選《えら》ぼう。',
    ],
    explain:
      'ユニセフは、世界《せかい》の子《こ》どもの命《いのち》と健康《けんこう》を守《まも》る活動《かつどう》をしているよ。世界遺産《せかいいさん》の登録《とうろく》はユネスコの仕事《しごと》だね。',
  }),
  choiceItem({
    id: 'life-unesco',
    obj: 'life',
    level: 1,
    prompt:
      '教育《きょういく》・科学《かがく》・文化《ぶんか》の協力《きょうりょく》を進《すす》め、世界遺産《せかいいさん》の登録《とうろく》も行《おこな》っている国際連合《こくさいれんごう》の機関《きかん》は？',
    right: 'ユネスコ',
    wrongs: [
      ['ユニセフ', 'mis-intl-org'],
      ['オリンピック', 'mis-intl-org'],
    ],
    hints: [
      '子《こ》どもの命《いのち》を守《まも》る機関《きかん》とは別《べつ》だよ。',
      '学校《がっこう》や文化《ぶんか》に関《かか》わる機関《きかん》だよ。',
      '「ユ」で始《はじ》まる、もう一《ひと》つの機関《きかん》だよ。',
    ],
    explain:
      'ユネスコは、教育《きょういく》・科学《かがく》・文化《ぶんか》の協力《きょうりょく》をとおして平和《へいわ》をめざす機関《きかん》だよ。世界遺産《せかいいさん》の登録《とうろく》もしているよ。',
  }),
  choiceItem({
    id: 'life-coop',
    obj: 'life',
    level: 1,
    prompt:
      '日本《にっぽん》の人《ひと》が外国《がいこく》へ行《い》き、農業《のうぎょう》や教育《きょういく》、健康《けんこう》づくりなどの技術《ぎじゅつ》を伝《つた》えて、いっしょに働《はたら》く活動《かつどう》を何《なん》という？',
    right: '国際協力《こくさいきょうりょく》',
    wrongs: [
      ['観光《かんこう》', 'mis-coop'],
      ['輸出《ゆしゅつ》', 'mis-coop'],
    ],
    hints: [
      '外国《がいこく》の人《ひと》と力《ちから》を合《あ》わせる活動《かつどう》だよ。',
      '国《くに》と国《くに》の「間《あいだ》」を表《あらわ》すことばが入《はい》るよ。',
      '「協力《きょうりょく》」ということばが入《はい》るよ。',
    ],
    explain:
      '外国《がいこく》で技術《ぎじゅつ》を伝《つた》え、いっしょに働《はたら》く活動《かつどう》は国際協力《こくさいきょうりょく》だよ。国《くに》の活動《かつどう》のほか、民間《みんかん》の団体《だんたい》の活動《かつどう》もあるよ。',
  }),
  choiceItem({
    id: 'life-china',
    obj: 'life',
    level: 2,
    prompt:
      '日本《にっぽん》の文字《もじ》のもとになった漢字《かんじ》が、むかし伝《つた》わってきた地域《ちいき》にある今《いま》の国《くに》は？',
    right: N.china,
    wrongs: [
      [N.brazil, 'mis-country'],
      [N.usa, 'mis-country'],
      [N.saudi, 'mis-country'],
    ],
    hints: N_HINTS.china
      .slice(0, 2)
      .concat([
        'ユーラシア大陸《たいりく》の東《ひがし》がわの、大《おお》きな国《くに》だよ。',
      ]) as Hints,
    explain: `漢字《かんじ》は、今《いま》の${N.china}がある地域《ちいき》から伝《つた》わったよ。日本《にっぽん》と${N.china}は古《ふる》くから文化《ぶんか》の交流《こうりゅう》があり、今《いま》も貿易《ぼうえき》などでつながりが深《ふか》いよ。`,
  }),
  choiceItem({
    id: 'life-korea',
    obj: 'life',
    level: 2,
    prompt: `${N.korea}でふだん使《つか》われている文字《もじ》は？`,
    right: 'ハングル',
    wrongs: [
      ['ひらがな', 'mis-country'],
      ['アラビア文字《もじ》', 'mis-country'],
    ],
    hints: [
      '日本《にっぽん》のひらがなとはちがう文字《もじ》だよ。',
      'まるや線《せん》を組《く》み合《あ》わせた形《かたち》の文字《もじ》だよ。',
      'カタカナ4文字《もじ》の名前《なまえ》だよ。',
    ],
    explain: `${N.korea}ではハングルという文字《もじ》が使《つか》われているよ。日本《にっぽん》と近《ちか》く、文化《ぶんか》や人《ひと》の行《い》き来《き》がさかんな国《くに》だよ。`,
  }),
  choiceItem({
    id: 'life-brazil',
    obj: 'life',
    level: 2,
    prompt:
      'むかし日本《にっぽん》から移《うつ》り住《す》んだ人《ひと》の子《こ》や孫《まご》が多《おお》くくらしている、南《みなみ》アメリカ大陸《たいりく》の国《くに》は？',
    right: N.brazil,
    wrongs: [
      [N.korea, 'mis-country'],
      [N.saudi, 'mis-country'],
      [N.china, 'mis-country'],
    ],
    hints: [
      '南《みなみ》アメリカ大陸《たいりく》にある国《くに》を選《えら》ぼう。',
      '日本《にっぽん》から見《み》て、地球《ちきゅう》のほぼ反対側《はんたいがわ》の国《くに》だよ。',
      'ポルトガル語《ご》が使《つか》われている国《くに》だよ。',
    ],
    explain: `${N.brazil}には、むかし日本《にっぽん》から移《うつ》り住《す》んだ人《ひと》の子《こ》や孫《まご》（日系人《にっけいじん》）が多《おお》くくらしているよ。日本《にっぽん》で働《はたら》き、くらしている人《ひと》もいるよ。`,
  }),
  choiceItem({
    id: 'life-saudi',
    obj: 'life',
    level: 2,
    prompt:
      '日本《にっぽん》が石油《せきゆ》を多《おお》く輸入《ゆにゅう》している国《くに》の一《ひと》つで、ユーラシア大陸《たいりく》の西《にし》のほうにある国《くに》は？',
    right: N.saudi,
    wrongs: [
      [N.brazil, 'mis-country'],
      [N.korea, 'mis-country'],
      [N.usa, 'mis-country'],
    ],
    hints: [
      'アフリカ大陸《たいりく》に近《ちか》いあたりをさがそう。',
      'すなの多《おお》い、雨《あめ》の少《すく》ない地域《ちいき》にある国《くに》だよ。',
      'アラビア半島《はんとう》にある国《くに》だよ。',
    ],
    explain: `${N.saudi}は、日本《にっぽん》が石油《せきゆ》を輸入《ゆにゅう》している主《おも》な国《くに》の一《ひと》つだよ。イスラム教《きょう》を信《しん》じる人《ひと》が多《おお》く、いのりの時間《じかん》を大切《たいせつ》にするくらしの例《れい》もあるよ。`,
  }),
];
const LIFE_RECORD_EXPLAIN =
  '調《しら》べたことを記録《きろく》したね。本《ほん》や地図帳《ちずちょう》など、いくつかの資料《しりょう》でたしかめると、もっとよくわかるよ。おうちの人《ひと》にも見《み》せてみよう。';
const lifeAlts: Item[] = [
  sortItem({
    id: 'life-alt-sort',
    obj: 'life',
    level: 1,
    alt: true,
    prompt:
      '外国《がいこく》のくらしについての言《い》い方《かた》を、「ちがいを大切《たいせつ》にする」と「決《き》めつけている」に分《わ》けよう。',
    boxes: ['ちがいを大切《たいせつ》にする', '決《き》めつけている'],
    cards: [
      ['この国《くに》には、こういうくらしの例《れい》もあるんだね', 0],
      ['どうしてそのやり方《かた》なのか調《しら》べてみよう', 0],
      ['日本《にっぽん》とにているところもあるね', 0],
      ['あの国《くに》の人《ひと》はみんな○○だ', 1],
      ['日本《にっぽん》とちがうからへんだ', 1],
    ],
    mis: 'mis-stereotype',
    hints: [
      '「みんな」「へんだ」ということばに気《き》をつけよう。',
      '一人《ひとり》ひとりちがうことを考《かんが》えに入《い》れているかな。',
      'わけを知《し》ろうとする言《い》い方《かた》は、ちがいを大切《たいせつ》にしているよ。',
    ],
    explain:
      '「〜の例《れい》もある」「わけを調《しら》べよう」「にているところもある」は、ちがいを大切《たいせつ》にする言《い》い方《かた》。「みんな○○だ」「ちがうからへん」は決《き》めつけている言《い》い方《かた》だよ。',
  }),
  matchItem({
    id: 'life-alt-match',
    obj: 'life',
    level: 2,
    alt: true,
    prompt:
      '国際連合《こくさいれんごう》とその機関《きかん》を、主《おも》な働《はたら》きと線《せん》でむすぼう。',
    pairs: [
      [
        '国際連合《こくさいれんごう》',
        '世界《せかい》の平和《へいわ》と安全《あんぜん》を守《まも》る',
      ],
      ['ユニセフ', '子《こ》どもの命《いのち》と健康《けんこう》を守《まも》る'],
      ['ユネスコ', '教育《きょういく》・科学《かがく》・文化《ぶんか》の協力《きょうりょく》'],
    ],
    mis: 'mis-intl-org',
    hints: [
      '「児童《じどう》」は子《こ》どものことだったね。',
      '世界遺産《せかいいさん》の登録《とうろく》をしているのはどこかな。',
      '多《おお》くの国《くに》が集《あつ》まった、いちばん大《おお》きなしくみはどれかな。',
    ],
    explain:
      '国際連合《こくさいれんごう》は世界《せかい》の平和《へいわ》と安全《あんぜん》、ユニセフは子《こ》どもの命《いのち》と健康《けんこう》、ユネスコは教育《きょういく》・科学《かがく》・文化《ぶんか》の協力《きょうりょく》を進《すす》めているよ。',
  }),
  explainItem({
    id: 'life-alt-record-pick',
    obj: 'life',
    level: 1,
    alt: true,
    prompt:
      '日本《にっぽん》とつながりの深《ふか》い国《くに》を一《ひと》つ選《えら》んで調《しら》べよう。何《なに》を調《しら》べたいかな。（いくつでも選《えら》べるよ）',
    reasons: [
      '気候《きこう》や自然《しぜん》',
      '食《た》べ物《もの》',
      '学校《がっこう》や子《こ》どものくらし',
      '日本《にっぽん》とのつながり',
    ],
    multi: true,
    hints: [
      '気《き》になる国《くに》を一《ひと》つ思《おも》いうかべよう。',
      '自分《じぶん》のくらしと比《くら》べたいことは何《なに》かな。',
      'いくつ選《えら》んでもだいじょうぶだよ。',
    ],
    explain: LIFE_RECORD_EXPLAIN,
  }),
  explainItem({
    id: 'life-alt-record-write',
    obj: 'life',
    level: 2,
    alt: true,
    prompt:
      '調《しら》べた国《くに》のくらしで、日本《にっぽん》とにているところと、ちがうところを書《か》こう。',
    canvas: { aspect: 4 / 3, guide: 'lines' },
    hints: [
      '調《しら》べたことを一《ひと》つ思《おも》い出《だ》そう。',
      '日本《にっぽん》のくらしと比《くら》べてみよう。',
      'ちがうところは、「どうしてかな」も考《かんが》えてみよう。',
    ],
    explain: LIFE_RECORD_EXPLAIN,
  }),
];

const items: Item[] = [
  ...contItems,
  ...contAlts,
  ...oceanItems,
  ...oceanAlts,
  ...countryItems,
  ...countryAlts,
  ...lifeItems,
  ...lifeAlts,
];

export const world: UnitSpec = {
  ...baseSoc('g6.soc.world', 'g6'),
  title: '世界《せかい》と日本《にっぽん》',
  kind: 'knowledge',
  status: 'ready',
  prereq: ['g5.soc.land'],
  objectives: [
    { id: 'continents', title: '6つの大陸《たいりく》の名前《なまえ》と位置《いち》' },
    { id: 'oceans', title: '3つの海洋《かいよう》の名前《なまえ》と位置《いち》' },
    {
      id: 'countries',
      title: '日本《にっぽん》とつながりの深《ふか》い国《くに》の位置《いち》',
    },
    {
      id: 'life',
      title: 'くらしのちがいの尊重《そんちょう》と国際協力《こくさいきょうりょく》',
    },
  ],
  misconceptions: [
    {
      id: 'mis-continent',
      explain:
        '別《べつ》の大陸《たいりく》と取《と》りちがえたのかな。日本《にっぽん》から見《み》た方角《ほうがく》（西《にし》にユーラシア、東《ひがし》に北《きた》アメリカ、南《みなみ》にオーストラリア）を手《て》がかりにしよう。',
    },
    {
      id: 'mis-ocean',
      explain:
        '別《べつ》の海洋《かいよう》と取《と》りちがえたのかな。どの大陸《たいりく》とどの大陸《たいりく》の間《あいだ》にあるかをたしかめよう。',
    },
    {
      id: 'mis-sea',
      explain:
        '日本海《にほんかい》は、日本《にっぽん》とユーラシア大陸《たいりく》の間《あいだ》の「海《うみ》」で、三《みっ》つの大《おお》きな海洋《かいよう》には入《はい》らないよ。',
    },
    {
      id: 'mis-map-edge',
      explain:
        '平《たい》らな図《ず》のはしで、世界《せかい》が終《お》わっていると考《かんが》えたのかな。地球《ちきゅう》は丸《まる》いので、左《ひだり》はしと右《みぎ》はしはつながっているよ。',
    },
    {
      id: 'mis-country',
      explain:
        '別《べつ》の国《くに》と取《と》りちがえたのかな。その国《くに》がどの大陸《たいりく》にあり、日本《にっぽん》からどの方角《ほうがく》にあるかをたしかめよう。',
    },
    {
      id: 'mis-direction',
      explain:
        '方角《ほうがく》を取《と》りちがえたのかな。図《ず》の上《うえ》が北《きた》、右《みぎ》が東《ひがし》だよ。日本《にっぽん》に指《ゆび》をおいてたどってみよう。',
    },
    {
      id: 'mis-stereotype',
      explain:
        'その国《くに》の人《ひと》をひとくくりに考《かんが》えたのかな。どの国《くに》にも、いろいろな人《ひと》とくらしがあるよ。ちがいのわけを知《し》ろうとすることが大切《たいせつ》だよ。',
    },
    {
      id: 'mis-intl-org',
      explain:
        '国《くに》どうしのしくみや活動《かつどう》の働《はたら》きが入《い》れかわったのかな。国際連合《こくさいれんごう》は平和《へいわ》、ユニセフは子《こ》ども、ユネスコは教育《きょういく》・科学《かがく》・文化《ぶんか》、と分《わ》けておぼえよう。',
    },
    {
      id: 'mis-coop',
      explain:
        '外国《がいこく》との関《かか》わり方《かた》の言葉《ことば》が、まざったのかな。観光《かんこう》は旅行《りょこう》して見《み》てまわること、輸出《ゆしゅつ》は外国《がいこく》に売《う》ること、国際協力《こくさいきょうりょく》は外国《がいこく》の人《ひと》と力《ちから》を合《あ》わせてくらしをよくすることだよ。',
    },
  ],
  levels: [
    { label: '大陸《たいりく》と海洋《かいよう》', chance: 0.25 },
    { label: '国《くに》の位置《いち》', chance: 0.25 },
    { label: 'くらしと協力《きょうりょく》', chance: 0.25 },
  ],
  intro: [
    {
      text: '世界《せかい》には6つの大陸《たいりく》と3つの大《おお》きな海洋《かいよう》があるよ。この図《ず》は日本《にっぽん》をまん中《なか》にしたかんたんな図《ず》で、形《かたち》はおおよそだよ。本当《ほんとう》の形《かたち》は地図帳《ちずちょう》や地球儀《ちきゅうぎ》でたしかめよう。',
      figure: MAP_C,
    },
    {
      text: '海洋《かいよう》は、ア太平洋《たいへいよう》・イ大西洋《たいせいよう》・ウインド洋《よう》。図《ず》の左《ひだり》はしと右《みぎ》はしはつながっているよ。',
      figure: MAP_O,
    },
    {
      text: '外国《がいこく》のくらしを調《しら》べるときは、「その国《くに》の人《ひと》はみんな〜」と決《き》めつけず、「こういうくらしの例《れい》もある」と考《かんが》えよう。',
      figure: textFig('ちがいを知《し》る → わけを考《かんが》える → 大切《たいせつ》にする'),
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）社会第6学年内容(3)（グローバル化する世界と日本の役割: 我が国とつながりが深い国の人々の生活、国際連合の働きと我が国の国際協力）、第4学年内容の取扱い（世界の大陸と主な海洋の名称と位置は第6学年修了までに）、内容(1)の政治の学習とは別単元。世界の図は位置関係を示す模式（本アプリで作成）。統計の数値・順位は扱わない',
};

/** 6年より上の字（小学校の配当外）で、社会の用語・国名として必要なもの */
export const worldAllow: Allow = {
  儀: '地球儀（社会の用語。地図帳と並ぶ学習の道具）',
  華: '中華人民共和国（国名）',
  韓: '大韓民国（国名）',
};
