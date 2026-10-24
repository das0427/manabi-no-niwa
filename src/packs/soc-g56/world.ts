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
    show.cont ? '大陸《たいりく》に ①〜⑥の 番号《ばんごう》' : '',
    show.ocean ? '海洋《かいよう》に ア〜ウ' : '',
    show.pins?.length ? '国《くに》に あ〜おの しるし' : '',
  ]
    .filter(Boolean)
    .join('、');
  return svg(
    '0 0 400 210',
    body,
    `日本《にっぽん》を まん中《なか》に した かんたんな 世界《せかい》の 図《ず》（形《かたち》は おおよそ。日本《にっぽん》は 黄色《きいろ》で ぬった 細長《ほそなが》い 形《かたち》）。${what}`,
  );
}

const MAP_C = worldMap({ cont: true });
const MAP_O = worldMap({ ocean: true });
const MAP_P = worldMap({ pins: ['usa', 'china', 'korea', 'brazil', 'saudi'] });

// ---- continents ----
const CONT_HINTS: Record<Ck, Hints> = {
  eurasia: [
    '日本《にっぽん》の 西《にし》に 広《ひろ》がって いる 大陸《たいりく》だよ。',
    'アジアと ヨーロッパの 国《くに》ぐにが ある 大陸《たいりく》だよ。',
    '6つの 大陸《たいりく》の 中《なか》で いちばん 大《おお》きいよ。',
  ],
  africa: [
    '①の 大陸《たいりく》の 南西《なんせい》に あるよ。',
    '赤道《せきどう》が 大陸《たいりく》の まん中《なか》あたりを 通《とお》って いるよ。',
    'ヨーロッパの 南《みなみ》に ある 大陸《たいりく》だよ。',
  ],
  namerica: [
    '太平洋《たいへいよう》を はさんで、日本《にっぽん》の 東《ひがし》の ほうに あるよ。',
    '南《みなみ》に もう 一《ひと》つの 大陸《たいりく》が つながって いるよ。',
    '二《ふた》つ ならんだ アメリカの 大陸《たいりく》の、北《きた》の ほうだよ。',
  ],
  samerica: [
    '③の 大陸《たいりく》と 細《ほそ》い 陸地《りくち》で つながって いるよ。',
    '日本《にっぽん》から 見《み》て、地球《ちきゅう》の ほぼ 反対側《はんたいがわ》の あたりを ふくむよ。',
    '二《ふた》つ ならんだ アメリカの 大陸《たいりく》の、南《みなみ》の ほうだよ。',
  ],
  australia: [
    '日本《にっぽん》の 南《みなみ》の ほうに あるよ。',
    '6つの 大陸《たいりく》の 中《なか》で いちばん 小《ちい》さいよ。',
    '一《ひと》つの 大陸《たいりく》が、ほぼ 一《ひと》つの 国《くに》に なって いるよ。',
  ],
  antarctica: [
    '図《ず》の いちばん 下《した》に あるよ。',
    '一年《いちねん》じゅう、厚《あつ》い 氷《こおり》に おおわれて いるよ。',
    '地球《ちきゅう》の いちばん 南《みなみ》の 大陸《たいりく》だよ。',
  ],
};
const CONT_EXPLAIN: Record<Ck, string> = {
  eurasia:
    '①は ユーラシア大陸《たいりく》。アジアと ヨーロッパが あり、6つの 中《なか》で いちばん 大《おお》きい 大陸《たいりく》だよ。',
  africa:
    '②は アフリカ大陸《たいりく》。ユーラシア大陸《たいりく》の 南西《なんせい》に あり、赤道《せきどう》が まん中《なか》あたりを 通《とお》るよ。',
  namerica:
    '③は 北《きた》アメリカ大陸《たいりく》。太平洋《たいへいよう》を はさんで 日本《にっぽん》の 東《ひがし》の ほうに あるよ。',
  samerica:
    '④は 南《みなみ》アメリカ大陸《たいりく》。北《きた》アメリカ大陸《たいりく》の 南《みなみ》に つながって いるよ。',
  australia:
    '⑤は オーストラリア大陸《たいりく》。日本《にっぽん》の 南《みなみ》の ほうに ある、いちばん 小《ちい》さい 大陸《たいりく》だよ。',
  antarctica:
    '⑥は 南極大陸《なんきょくたいりく》。地球《ちきゅう》の いちばん 南《みなみ》に あり、厚《あつ》い 氷《こおり》に おおわれて いるよ。',
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
    prompt: `図《ず》の ${NUM[k]}は どの 大陸《たいりく》？`,
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
      '一年《いちねん》じゅう 厚《あつ》い 氷《こおり》に おおわれ、各国《かっこく》の 観測《かんそく》の 基地《きち》が ある 大陸《たいりく》は？',
    right: C.antarctica,
    wrongs: [
      [C.australia, 'mis-continent'],
      [C.eurasia, 'mis-continent'],
      [C.samerica, 'mis-continent'],
    ],
    hints: CONT_HINTS.antarctica,
    explain:
      '南極大陸《なんきょくたいりく》は 地球《ちきゅう》の いちばん 南《みなみ》に あり、厚《あつ》い 氷《こおり》に おおわれて いるよ。日本《にっぽん》も 観測《かんそく》の 基地《きち》を おいて いるよ。',
  }),
  choiceItem({
    id: 'cont-alt-south',
    obj: 'continents',
    level: 2,
    alt: true,
    prompt:
      '図《ず》を 見《み》よう。日本《にっぽん》（黄色《きいろ》の 細長《ほそなが》い 形《かたち》）から 見《み》て、南《みなみ》の ほうに ある 大陸《たいりく》は？',
    figure: worldMap({}),
    right: C.australia,
    wrongs: [
      [C.namerica, 'mis-direction'],
      [C.africa, 'mis-direction'],
      [C.eurasia, 'mis-direction'],
    ],
    hints: [
      '図《ず》の 上《うえ》が 北《きた》、下《した》が 南《みなみ》だよ。',
      '日本《にっぽん》から まっすぐ 下《した》へ 指《ゆび》で たどろう。',
      '海《うみ》を こえた 先《さき》に ある、小《ちい》さめの 大陸《たいりく》だよ。',
    ],
    explain:
      '日本《にっぽん》の 南《みなみ》の ほうには オーストラリア大陸《たいりく》が あるよ。北《きた》アメリカ大陸《たいりく》は 東《ひがし》、アフリカ大陸《たいりく》と ユーラシア大陸《たいりく》は 西《にし》の ほうだね。',
  }),
  matchItem({
    id: 'cont-alt-match',
    obj: 'continents',
    level: 2,
    alt: true,
    prompt: '大陸《たいりく》と、その ようすを 線《せん》で むすぼう。',
    pairs: [
      [
        C.eurasia,
        'アジアと ヨーロッパの 国《くに》ぐにが ある、いちばん 大《おお》きい 大陸《たいりく》',
      ],
      [
        C.australia,
        'ほぼ 一《ひと》つの 国《くに》で できて いる、いちばん 小《ちい》さい 大陸《たいりく》',
      ],
      [
        C.antarctica,
        '厚《あつ》い 氷《こおり》に おおわれた、いちばん 南《みなみ》の 大陸《たいりく》',
      ],
    ],
    extras: ['日本《にっぽん》が ある 大陸《たいりく》'],
    mis: 'mis-continent',
    hints: [
      '大《おお》きさと 位置《いち》を 思《おも》い出《だ》そう。',
      'いちばん 大《おお》きい 大陸《たいりく》と、いちばん 小《ちい》さい 大陸《たいりく》は どれかな。',
      '日本《にっぽん》は 島国《しまぐに》で、大陸《たいりく》の 上《うえ》には ないよ。',
    ],
    explain:
      'ユーラシア大陸《たいりく》は いちばん 大《おお》きく、オーストラリア大陸《たいりく》は いちばん 小《ちい》さい 大陸《たいりく》、南極大陸《なんきょくたいりく》は 氷《こおり》に おおわれて いるよ。日本《にっぽん》は 海《うみ》に かこまれた 島国《しまぐに》で、大陸《たいりく》には ふくまれないね。',
  }),
];

// ---- oceans ----
const OCEAN_HINTS: Record<Ok, Hints> = {
  pacific: [
    '日本《にっぽん》の 東《ひがし》に 広《ひろ》がる 海洋《かいよう》だよ。',
    'アジアと アメリカの 大陸《たいりく》の 間《あいだ》に あるよ。',
    '3つの 海洋《かいよう》の 中《なか》で いちばん 広《ひろ》いよ。',
  ],
  atlantic: [
    '図《ず》の 左《ひだり》はしと 右《みぎ》はしは つながって いるよ。',
    'アメリカの 大陸《たいりく》と、ヨーロッパ・アフリカの 間《あいだ》に あるよ。',
    '名前《なまえ》に 方角《ほうがく》の「西《にし》」が 入《はい》って いるよ。',
  ],
  indian: [
    'アフリカ大陸《たいりく》と オーストラリア大陸《たいりく》の 間《あいだ》に あるよ。',
    'ユーラシア大陸《たいりく》の 南《みなみ》に 広《ひろ》がって いるよ。',
    'アジアの 国《くに》の 名前《なまえ》が ついた 海洋《かいよう》だよ。',
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
      prompt: `図《ず》の ${KANA_O[k]}は どの 海洋《かいよう》？`,
      figure: MAP_O,
      right: O[k],
      wrongs: oceanOpts(k),
      hints: OCEAN_HINTS[k],
      explain: {
        pacific:
          'アは 太平洋《たいへいよう》。日本《にっぽん》の 東《ひがし》に 広《ひろ》がる、いちばん 広《ひろ》い 海洋《かいよう》だよ。',
        atlantic:
          'イは 大西洋《たいせいよう》。アメリカの 大陸《たいりく》と ヨーロッパ・アフリカの 間《あいだ》に あるよ。図《ず》の 左《ひだり》はしと 右《みぎ》はしの イは 同《おな》じ 海洋《かいよう》だよ。',
        indian:
          'ウは インド洋《よう》。アフリカ大陸《たいりく》と オーストラリア大陸《たいりく》の 間《あいだ》に あるよ。',
      }[k],
    }),
  ),
  choiceItem({
    id: 'ocean-japan-usa',
    obj: 'oceans',
    level: 0,
    prompt: `日本《にっぽん》と ${N.usa}の 間《あいだ》に ある 海洋《かいよう》は？`,
    right: O.pacific,
    wrongs: oceanOpts('pacific'),
    hints: OCEAN_HINTS.pacific,
    explain: `日本《にっぽん》と ${N.usa}の 間《あいだ》には 太平洋《たいへいよう》が あるよ。日本海《にほんかい》は、日本《にっぽん》と ユーラシア大陸《たいりく》の 間《あいだ》の 海《うみ》だね。`,
  }),
  choiceItem({
    id: 'ocean-af-sa',
    obj: 'oceans',
    level: 1,
    prompt: `${C.africa}と ${C.samerica}の 間《あいだ》に ある 海洋《かいよう》は？`,
    right: O.atlantic,
    wrongs: oceanOpts('atlantic'),
    hints: OCEAN_HINTS.atlantic,
    explain:
      'アフリカ大陸《たいりく》と 南《みなみ》アメリカ大陸《たいりく》の 間《あいだ》には 大西洋《たいせいよう》が あるよ。',
  }),
  choiceItem({
    id: 'ocean-af-au',
    obj: 'oceans',
    level: 1,
    prompt: `${C.africa}と ${C.australia}の 間《あいだ》に ある 海洋《かいよう》は？`,
    right: O.indian,
    wrongs: oceanOpts('indian'),
    hints: OCEAN_HINTS.indian,
    explain:
      'アフリカ大陸《たいりく》と オーストラリア大陸《たいりく》の 間《あいだ》には インド洋《よう》が あるよ。',
  }),
  choiceItem({
    id: 'ocean-largest',
    obj: 'oceans',
    level: 2,
    prompt: '3つの 海洋《かいよう》の 中《なか》で、いちばん 広《ひろ》い ものは？',
    right: O.pacific,
    wrongs: oceanOpts('pacific'),
    hints: [
      '図《ず》で、いちばん 大《おお》きく 広《ひろ》がって いる 海《うみ》を さがそう。',
      '日本《にっぽん》が 面《めん》して いる 海洋《かいよう》だよ。',
      'アジアと アメリカの 大陸《たいりく》の 間《あいだ》に あるよ。',
    ],
    explain:
      '3つの 海洋《かいよう》の 中《なか》で いちばん 広《ひろ》いのは 太平洋《たいへいよう》だよ。日本《にっぽん》は 太平洋《たいへいよう》に 面《めん》して いるね。',
  }),
];
const oceanAlts: Item[] = [
  matchItem({
    id: 'ocean-alt-match',
    obj: 'oceans',
    level: 1,
    alt: true,
    prompt:
      '海洋《かいよう》と、その 海洋《かいよう》を はさむ 大陸《たいりく》を 線《せん》で むすぼう。',
    pairs: [
      [O.pacific, 'ユーラシア大陸《たいりく》と 北《きた》アメリカ大陸《たいりく》'],
      [O.atlantic, 'アフリカ大陸《たいりく》と 南《みなみ》アメリカ大陸《たいりく》'],
      [O.indian, 'アフリカ大陸《たいりく》と オーストラリア大陸《たいりく》'],
    ],
    mis: 'mis-ocean',
    hints: [
      '日本《にっぽん》から 東《ひがし》へ 進《すす》むと、どの 海洋《かいよう》を わたるかな。',
      'アメリカの 大陸《たいりく》の 東《ひがし》がわに ある 海洋《かいよう》は どれかな。',
      'オーストラリア大陸《たいりく》の 西《にし》がわに ある 海洋《かいよう》は どれかな。',
    ],
    explain:
      '太平洋《たいへいよう》は ユーラシア大陸《たいりく》と 北《きた》アメリカ大陸《たいりく》の 間《あいだ》、大西洋《たいせいよう》は アフリカ大陸《たいりく》と 南《みなみ》アメリカ大陸《たいりく》の 間《あいだ》、インド洋《よう》は アフリカ大陸《たいりく》と オーストラリア大陸《たいりく》の 間《あいだ》だよ。',
  }),
  fillItem({
    id: 'ocean-alt-fill',
    obj: 'oceans',
    level: 0,
    alt: true,
    prompt: '空《あ》いて いる ところに 入《はい》る ことばを 選《えら》ぼう。',
    text: '日本《にっぽん》は、東《ひがし》がわを {{}}に 面《めん》した 島国《しまぐに》です。',
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
      '日本《にっぽん》は 東《ひがし》がわを 太平洋《たいへいよう》に 面《めん》した 島国《しまぐに》だよ。',
  }),
  choiceItem({
    id: 'ocean-alt-edge',
    obj: 'oceans',
    level: 2,
    alt: true,
    prompt:
      '図《ず》の 左《ひだり》はしと 右《みぎ》はしに、同《おな》じ「イ」が あるよ。どうして かな？',
    figure: MAP_O,
    right:
      '地球《ちきゅう》は 丸《まる》く、図《ず》の 左《ひだり》はしと 右《みぎ》はしは つながって いるから',
    wrongs: [
      ['同《おな》じ 名前《なまえ》の 海洋《かいよう》が 二《ふた》つ あるから', 'mis-map-edge'],
      ['図《ず》の まちがいだから', 'mis-map-edge'],
    ],
    hints: [
      '地球儀《ちきゅうぎ》を 思《おも》いうかべよう。',
      '地球《ちきゅう》は 丸《まる》いので、平《たい》らな 図《ず》に すると どこかで 切《き》れ目《め》が できるね。',
      '右《みぎ》はしから さらに 右《みぎ》へ 進《すす》むと、どこに 出《で》るかな。',
    ],
    explain:
      '地球《ちきゅう》は 丸《まる》いので、平《たい》らな 世界《せかい》の 図《ず》では 左《ひだり》はしと 右《みぎ》はしが つながって いるよ。だから イの 大西洋《たいせいよう》は 両《りょう》はしに 分《わ》かれて 見《み》えるんだ。',
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
    'しるしが ある 大陸《たいりく》を たしかめよう。',
    '太平洋《たいへいよう》を はさんで、日本《にっぽん》の 東《ひがし》の ほうだよ。',
    '北《きた》アメリカ大陸《たいりく》に ある 国《くに》だよ。',
  ],
  china: [
    'しるしが ある 大陸《たいりく》を たしかめよう。',
    '日本《にっぽん》の 西《にし》の ほう、ユーラシア大陸《たいりく》の 東《ひがし》がわだよ。',
    '日本《にっぽん》に 漢字《かんじ》が 伝《つた》わった もとの 地域《ちいき》が ある 国《くに》だよ。',
  ],
  korea: [
    'しるしが ある 大陸《たいりく》を たしかめよう。',
    '日本《にっぽん》に とても 近《ちか》い、日本海《にほんかい》を はさんだ 西《にし》の ほうだよ。',
    'ユーラシア大陸《たいりく》から つき出《で》た 半島《はんとう》に ある 国《くに》だよ。',
  ],
  brazil: [
    'しるしが ある 大陸《たいりく》を たしかめよう。',
    '南《みなみ》アメリカ大陸《たいりく》の 東《ひがし》がわだよ。',
    '日本《にっぽん》から 見《み》て、地球《ちきゅう》の ほぼ 反対側《はんたいがわ》の 国《くに》だよ。',
  ],
  saudi: [
    'しるしが ある 大陸《たいりく》を たしかめよう。',
    'ユーラシア大陸《たいりく》の 西《にし》の ほう、アフリカ大陸《たいりく》の 近《ちか》くだよ。',
    '日本《にっぽん》が 石油《せきゆ》を 多《おお》く 輸入《ゆにゅう》して いる 国《くに》の 一《ひと》つだよ。',
  ],
};
const N_EXPLAIN: Record<Nk, string> = {
  usa: `あは ${N.usa}。北《きた》アメリカ大陸《たいりく》に あり、太平洋《たいへいよう》を はさんで 日本《にっぽん》の 東《ひがし》の ほうに あるよ。`,
  china: `いは ${N.china}。ユーラシア大陸《たいりく》の 東《ひがし》がわ、日本《にっぽん》の 西《にし》の ほうに あるよ。`,
  korea: `うは ${N.korea}。日本海《にほんかい》を はさんで、日本《にっぽん》の すぐ 西《にし》の ほうに ある 国《くに》だよ。`,
  brazil: `えは ${N.brazil}。南《みなみ》アメリカ大陸《たいりく》に あり、日本《にっぽん》から 見《み》て 地球《ちきゅう》の ほぼ 反対側《はんたいがわ》の 国《くに》だよ。`,
  saudi: `おは ${N.saudi}。ユーラシア大陸《たいりく》の 西《にし》の ほう（アラビア半島《はんとう》）に ある 国《くに》だよ。`,
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
      prompt: `図《ず》の「${KANA_N[k]}」の しるしが ある 国《くに》は どれ？`,
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
      prompt: `${N[k]}は どの 大陸《たいりく》に ある？`,
      right: C[right],
      wrongs: wrongs.map((w) => [C[w], 'mis-continent'] as const),
      hints: [
        '地図帳《ちずちょう》や 地球儀《ちきゅうぎ》で、国《くに》の 位置《いち》を さがそう。',
        N_HINTS[k].slice(1).find((h) => !h.includes(C[right]))!,
        '日本《にっぽん》から 見《み》た 方角《ほうがく》も 手《て》がかりに しよう。',
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
    prompt: '国《くに》と、その 国《くに》が ある 大陸《たいりく》を 線《せん》で むすぼう。',
    pairs: [
      [N.usa, C.namerica],
      [N.brazil, C.samerica],
      [N.china, C.eurasia],
    ],
    extras: [C.africa],
    mis: 'mis-continent',
    hints: [
      '地図帳《ちずちょう》で 国《くに》の 位置《いち》を 思《おも》い出《だ》そう。',
      '名前《なまえ》が にて いる 二《ふた》つの アメリカの 大陸《たいりく》に 気《き》を つけよう。',
      '日本《にっぽん》の 西《にし》の ほうの 国《くに》は、大《おお》きな 大陸《たいりく》に あるよ。',
    ],
    explain: `${N.usa}は 北《きた》アメリカ大陸《たいりく》、${N.brazil}は 南《みなみ》アメリカ大陸《たいりく》、${N.china}は ユーラシア大陸《たいりく》に あるよ。`,
  }),
  choiceItem({
    id: 'country-alt-east',
    obj: 'countries',
    level: 1,
    alt: true,
    prompt:
      '日本《にっぽん》から 見《み》て、太平洋《たいへいよう》を はさんで 東《ひがし》の ほうに ある 国《くに》は？',
    right: N.usa,
    wrongs: [
      [N.china, 'mis-direction'],
      [N.korea, 'mis-direction'],
      [N.saudi, 'mis-direction'],
    ],
    hints: [
      '地図《ちず》の 右《みぎ》が 東《ひがし》だよ。',
      '日本《にっぽん》から 太平洋《たいへいよう》を わたった 先《さき》の 大陸《たいりく》を 考《かんが》えよう。',
      '北《きた》アメリカ大陸《たいりく》に ある 国《くに》だよ。',
    ],
    explain: `${N.usa}は、太平洋《たいへいよう》を はさんで 日本《にっぽん》の 東《ひがし》の ほうに あるよ。ほかの 三《みっ》つは 日本《にっぽん》の 西《にし》の ほうだね。`,
  }),
  choiceItem({
    id: 'country-alt-near',
    obj: 'countries',
    level: 0,
    alt: true,
    prompt:
      '日本海《にほんかい》を はさんで、日本《にっぽん》の すぐ 西《にし》の ほうに ある 国《くに》は？',
    right: N.korea,
    wrongs: [
      [N.brazil, 'mis-direction'],
      [N.usa, 'mis-direction'],
      [N.saudi, 'mis-direction'],
    ],
    hints: [
      '日本《にっぽん》に とても 近《ちか》い 国《くに》だよ。',
      '日本海《にほんかい》は 日本《にっぽん》の 西《にし》がわの 海《うみ》だよ。',
      'ユーラシア大陸《たいりく》から つき出《で》た 半島《はんとう》に ある 国《くに》だよ。',
    ],
    explain: `${N.korea}は、日本海《にほんかい》を はさんで 日本《にっぽん》の すぐ 西《にし》の ほうに ある 国《くに》だよ。`,
  }),
  choiceItem({
    id: 'country-alt-opposite',
    obj: 'countries',
    level: 2,
    alt: true,
    prompt:
      '地球儀《ちきゅうぎ》で 見《み》ると、日本《にっぽん》の ほぼ 反対側《はんたいがわ》に ある 国《くに》は？',
    right: N.brazil,
    wrongs: [
      [N.korea, 'mis-direction'],
      [N.china, 'mis-direction'],
      [N.usa, 'mis-direction'],
    ],
    hints: [
      '地球儀《ちきゅうぎ》で 日本《にっぽん》に 指《ゆび》を おき、その うら側《がわ》を 見《み》よう。',
      '日本《にっぽん》は 北半球《きたはんきゅう》に あるから、反対側《はんたいがわ》は 南半球《みなみはんきゅう》だね。',
      '南《みなみ》アメリカ大陸《たいりく》に ある 国《くに》だよ。',
    ],
    explain: `日本《にっぽん》の ほぼ 反対側《はんたいがわ》は 南《みなみ》アメリカ大陸《たいりく》の あたりで、${N.brazil}が あるよ。季節《きせつ》も 日本《にっぽん》と 反対《はんたい》に なるよ。`,
  }),
];

// ---- life ----
const lifeItems: Item[] = [
  choiceItem({
    id: 'life-view',
    obj: 'life',
    level: 0,
    prompt:
      '外国《がいこく》の くらしを 調《しら》べる ときの 考《かんが》え方《かた》として、よい ものは？',
    right: 'その 国《くに》の 中《なか》にも、いろいろな くらしが あると 考《かんが》える',
    wrongs: [
      [
        'その 国《くに》の 人《ひと》は みんな 同《おな》じ くらしだと 決《き》めつける',
        'mis-stereotype',
      ],
      [
        '自分《じぶん》の 国《くに》と ちがう くらしは、まちがいだと 考《かんが》える',
        'mis-stereotype',
      ],
      [
        '写真《しゃしん》 一枚《いちまい》だけを 見《み》て、その 国《くに》の ことを 決《き》める',
        'mis-stereotype',
      ],
    ],
    hints: [
      '日本《にっぽん》の 中《なか》でも、地域《ちいき》や 家《いえ》に よって くらしは ちがうね。',
      '外国《がいこく》でも 同《おな》じように、いろいろな 人《ひと》が いるよ。',
      'ひとくくりに しない 考《かんが》え方《かた》を 選《えら》ぼう。',
    ],
    explain:
      'どの 国《くに》の 中《なか》にも、いろいろな 人《ひと》と いろいろな くらしが あるよ。決《き》めつけずに、ちがいを 大切《たいせつ》に して 調《しら》べよう。',
  }),
  choiceItem({
    id: 'life-un',
    obj: 'life',
    level: 0,
    prompt: '国際連合《こくさいれんごう》の 主《おも》な 目的《もくてき》は？',
    right:
      '世界《せかい》の 平和《へいわ》と 安全《あんぜん》を 守《まも》り、国《くに》どうしの 協力《きょうりょく》を 進《すす》める',
    wrongs: [
      ['一《ひと》つの 国《くに》の 政治《せいじ》を 決《き》める', 'mis-intl-org'],
      ['スポーツの 大会《たいかい》だけを 開《ひら》く', 'mis-intl-org'],
      ['世界《せかい》の お金《かね》を 一《ひと》つに まとめる', 'mis-intl-org'],
    ],
    hints: [
      '多《おお》くの 国《くに》が 集《あつ》まって つくった しくみだよ。',
      '大《おお》きな 戦争《せんそう》の あと、二度《にど》と 戦争《せんそう》を 起《お》こさない ために つくられたよ。',
      '「平和《へいわ》」と「協力《きょうりょく》」が かぎだよ。',
    ],
    explain:
      '国際連合《こくさいれんごう》は、世界《せかい》の 平和《へいわ》と 安全《あんぜん》を 守《まも》り、国《くに》どうしの 協力《きょうりょく》を 進《すす》める ために、多《おお》くの 国《くに》が 集《あつ》まって つくった しくみだよ。日本《にっぽん》も 加盟《かめい》して いるよ。',
  }),
  choiceItem({
    id: 'life-unicef',
    obj: 'life',
    level: 1,
    prompt: 'ユニセフ（国連児童基金《こくれんじどうききん》）の 主《おも》な 活動《かつどう》は？',
    right: '世界《せかい》の 子《こ》どもの 命《いのち》と 健康《けんこう》を 守《まも》る',
    wrongs: [
      ['世界遺産《せかいいさん》を 登録《とうろく》する', 'mis-intl-org'],
      ['国《くに》どうしの 貿易《ぼうえき》の 量《りょう》を 決《き》める', 'mis-intl-org'],
      ['国《くに》の 選挙《せんきょ》を 行《おこな》う', 'mis-intl-org'],
    ],
    hints: [
      '「児童《じどう》」は 子《こ》どもの ことだよ。',
      '栄養《えいよう》や 予防接種《よぼうせっしゅ》、学《まな》びを 支《ささ》える 活動《かつどう》を して いるよ。',
      '子《こ》どもを 守《まも》る 活動《かつどう》を 選《えら》ぼう。',
    ],
    explain:
      'ユニセフは、世界《せかい》の 子《こ》どもの 命《いのち》と 健康《けんこう》を 守《まも》る 活動《かつどう》を して いるよ。世界遺産《せかいいさん》の 登録《とうろく》は ユネスコの 仕事《しごと》だね。',
  }),
  choiceItem({
    id: 'life-unesco',
    obj: 'life',
    level: 1,
    prompt:
      '教育《きょういく》・科学《かがく》・文化《ぶんか》の 協力《きょうりょく》を 進《すす》め、世界遺産《せかいいさん》の 登録《とうろく》も 行《おこな》って いる 国際連合《こくさいれんごう》の 機関《きかん》は？',
    right: 'ユネスコ',
    wrongs: [
      ['ユニセフ', 'mis-intl-org'],
      ['オリンピック', 'mis-intl-org'],
    ],
    hints: [
      '子《こ》どもの 命《いのち》を 守《まも》る 機関《きかん》とは 別《べつ》だよ。',
      '学校《がっこう》や 文化《ぶんか》に 関《かか》わる 機関《きかん》だよ。',
      '「ユ」で 始《はじ》まる、もう 一《ひと》つの 機関《きかん》だよ。',
    ],
    explain:
      'ユネスコは、教育《きょういく》・科学《かがく》・文化《ぶんか》の 協力《きょうりょく》を とおして 平和《へいわ》を めざす 機関《きかん》だよ。世界遺産《せかいいさん》の 登録《とうろく》も して いるよ。',
  }),
  choiceItem({
    id: 'life-coop',
    obj: 'life',
    level: 1,
    prompt:
      '日本《にっぽん》の 人《ひと》が 外国《がいこく》へ 行《い》き、農業《のうぎょう》や 教育《きょういく》、健康《けんこう》づくりなどの 技術《ぎじゅつ》を 伝《つた》えて、いっしょに 働《はたら》く 活動《かつどう》を 何《なん》と いう？',
    right: '国際協力《こくさいきょうりょく》',
    wrongs: [
      ['観光《かんこう》', 'mis-intl-org'],
      ['輸出《ゆしゅつ》', 'mis-intl-org'],
    ],
    hints: [
      '外国《がいこく》の 人《ひと》と 力《ちから》を 合《あ》わせる 活動《かつどう》だよ。',
      '国《くに》と 国《くに》の「間《あいだ》」を 表《あらわ》す ことばが 入《はい》るよ。',
      '「協力《きょうりょく》」という ことばが 入《はい》るよ。',
    ],
    explain:
      '外国《がいこく》で 技術《ぎじゅつ》を 伝《つた》え、いっしょに 働《はたら》く 活動《かつどう》は 国際協力《こくさいきょうりょく》だよ。国《くに》の 活動《かつどう》のほか、民間《みんかん》の 団体《だんたい》の 活動《かつどう》も あるよ。',
  }),
  choiceItem({
    id: 'life-china',
    obj: 'life',
    level: 2,
    prompt:
      '日本《にっぽん》の 文字《もじ》の もとに なった 漢字《かんじ》が、むかし 伝《つた》わって きた 地域《ちいき》に ある 今《いま》の 国《くに》は？',
    right: N.china,
    wrongs: [
      [N.brazil, 'mis-country'],
      [N.usa, 'mis-country'],
      [N.saudi, 'mis-country'],
    ],
    hints: N_HINTS.china
      .slice(0, 2)
      .concat([
        'ユーラシア大陸《たいりく》の 東《ひがし》がわの、大《おお》きな 国《くに》だよ。',
      ]) as Hints,
    explain: `漢字《かんじ》は、今《いま》の ${N.china}が ある 地域《ちいき》から 伝《つた》わったよ。日本《にっぽん》と ${N.china}は 古《ふる》くから 文化《ぶんか》の 交流《こうりゅう》が あり、今《いま》も 貿易《ぼうえき》などで つながりが 深《ふか》いよ。`,
  }),
  choiceItem({
    id: 'life-korea',
    obj: 'life',
    level: 2,
    prompt: `${N.korea}で ふだん 使《つか》われて いる 文字《もじ》は？`,
    right: 'ハングル',
    wrongs: [
      ['ひらがな', 'mis-country'],
      ['アラビア文字《もじ》', 'mis-country'],
    ],
    hints: [
      '日本《にっぽん》の ひらがなとは ちがう 文字《もじ》だよ。',
      'まるや 線《せん》を 組《く》み合《あ》わせた 形《かたち》の 文字《もじ》だよ。',
      'カタカナ 4文字《もじ》の 名前《なまえ》だよ。',
    ],
    explain: `${N.korea}では ハングルと いう 文字《もじ》が 使《つか》われて いるよ。日本《にっぽん》と 近《ちか》く、文化《ぶんか》や 人《ひと》の 行《い》き来《き》が さかんな 国《くに》だよ。`,
  }),
  choiceItem({
    id: 'life-brazil',
    obj: 'life',
    level: 2,
    prompt:
      'むかし 日本《にっぽん》から 移《うつ》り住《す》んだ 人《ひと》の 子《こ》や 孫《まご》が 多《おお》く くらして いる、南《みなみ》アメリカ大陸《たいりく》の 国《くに》は？',
    right: N.brazil,
    wrongs: [
      [N.korea, 'mis-country'],
      [N.saudi, 'mis-country'],
      [N.china, 'mis-country'],
    ],
    hints: [
      '南《みなみ》アメリカ大陸《たいりく》に ある 国《くに》を 選《えら》ぼう。',
      '日本《にっぽん》から 見《み》て、地球《ちきゅう》の ほぼ 反対側《はんたいがわ》の 国《くに》だよ。',
      'ポルトガル語《ご》が 使《つか》われて いる 国《くに》だよ。',
    ],
    explain: `${N.brazil}には、むかし 日本《にっぽん》から 移《うつ》り住《す》んだ 人《ひと》の 子《こ》や 孫《まご》（日系人《にっけいじん》）が 多《おお》く くらして いるよ。日本《にっぽん》で 働《はたら》き、くらして いる 人《ひと》も いるよ。`,
  }),
  choiceItem({
    id: 'life-saudi',
    obj: 'life',
    level: 2,
    prompt:
      '日本《にっぽん》が 石油《せきゆ》を 多《おお》く 輸入《ゆにゅう》して いる 国《くに》の 一《ひと》つで、ユーラシア大陸《たいりく》の 西《にし》の ほうに ある 国《くに》は？',
    right: N.saudi,
    wrongs: [
      [N.brazil, 'mis-country'],
      [N.korea, 'mis-country'],
      [N.usa, 'mis-country'],
    ],
    hints: [
      'アフリカ大陸《たいりく》に 近《ちか》い あたりを さがそう。',
      'すなの 多《おお》い、雨《あめ》の 少《すく》ない 地域《ちいき》に ある 国《くに》だよ。',
      'アラビア半島《はんとう》に ある 国《くに》だよ。',
    ],
    explain: `${N.saudi}は、日本《にっぽん》が 石油《せきゆ》を 輸入《ゆにゅう》して いる 主《おも》な 国《くに》の 一《ひと》つだよ。イスラム教《きょう》を 信《しん》じる 人《ひと》が 多《おお》く、いのりの 時間《じかん》を 大切《たいせつ》に する くらしの 例《れい》も あるよ。`,
  }),
];
const LIFE_RECORD_EXPLAIN =
  '調《しら》べた ことを 記録《きろく》したね。本《ほん》や 地図帳《ちずちょう》など、いくつかの 資料《しりょう》で たしかめると、もっと よく わかるよ。おうちの 人《ひと》にも 見《み》せて みよう。';
const lifeAlts: Item[] = [
  sortItem({
    id: 'life-alt-sort',
    obj: 'life',
    level: 1,
    alt: true,
    prompt:
      '外国《がいこく》の くらしに ついての 言《い》い方《かた》を、「ちがいを 大切《たいせつ》に する」と「決《き》めつけて いる」に 分《わ》けよう。',
    boxes: ['ちがいを 大切《たいせつ》に する', '決《き》めつけて いる'],
    cards: [
      ['この 国《くに》には、こういう くらしの 例《れい》も あるんだね', 0],
      ['どうして その やり方《かた》なのか 調《しら》べて みよう', 0],
      ['日本《にっぽん》と にて いる ところも あるね', 0],
      ['あの 国《くに》の 人《ひと》は みんな ○○だ', 1],
      ['日本《にっぽん》と ちがうから へんだ', 1],
    ],
    mis: 'mis-stereotype',
    hints: [
      '「みんな」「へんだ」という ことばに 気《き》を つけよう。',
      '一人《ひとり》ひとり ちがう ことを 考《かんが》えに 入《い》れて いるかな。',
      'わけを 知《し》ろうと する 言《い》い方《かた》は、ちがいを 大切《たいせつ》に して いるよ。',
    ],
    explain:
      '「〜の 例《れい》も ある」「わけを 調《しら》べよう」「にて いる ところも ある」は、ちがいを 大切《たいせつ》に する 言《い》い方《かた》。「みんな ○○だ」「ちがうから へん」は 決《き》めつけて いる 言《い》い方《かた》だよ。',
  }),
  matchItem({
    id: 'life-alt-match',
    obj: 'life',
    level: 2,
    alt: true,
    prompt:
      '国際連合《こくさいれんごう》と その 機関《きかん》を、主《おも》な 働《はたら》きと 線《せん》で むすぼう。',
    pairs: [
      [
        '国際連合《こくさいれんごう》',
        '世界《せかい》の 平和《へいわ》と 安全《あんぜん》を 守《まも》る',
      ],
      ['ユニセフ', '子《こ》どもの 命《いのち》と 健康《けんこう》を 守《まも》る'],
      ['ユネスコ', '教育《きょういく》・科学《かがく》・文化《ぶんか》の 協力《きょうりょく》'],
    ],
    mis: 'mis-intl-org',
    hints: [
      '「児童《じどう》」は 子《こ》どもの ことだったね。',
      '世界遺産《せかいいさん》の 登録《とうろく》を して いるのは どこかな。',
      '多《おお》くの 国《くに》が 集《あつ》まった、いちばん 大《おお》きな しくみは どれかな。',
    ],
    explain:
      '国際連合《こくさいれんごう》は 世界《せかい》の 平和《へいわ》と 安全《あんぜん》、ユニセフは 子《こ》どもの 命《いのち》と 健康《けんこう》、ユネスコは 教育《きょういく》・科学《かがく》・文化《ぶんか》の 協力《きょうりょく》を 進《すす》めて いるよ。',
  }),
  explainItem({
    id: 'life-alt-record-pick',
    obj: 'life',
    level: 1,
    alt: true,
    prompt:
      '日本《にっぽん》と つながりの 深《ふか》い 国《くに》を 一《ひと》つ 選《えら》んで 調《しら》べよう。何《なに》を 調《しら》べたいかな。（いくつでも 選《えら》べるよ）',
    reasons: [
      '気候《きこう》や 自然《しぜん》',
      '食《た》べ物《もの》',
      '学校《がっこう》や 子《こ》どもの くらし',
      '日本《にっぽん》との つながり',
    ],
    multi: true,
    hints: [
      '気《き》に なる 国《くに》を 一《ひと》つ 思《おも》いうかべよう。',
      '自分《じぶん》の くらしと くらべたい ことは 何《なに》かな。',
      'いくつ 選《えら》んでも だいじょうぶだよ。',
    ],
    explain: LIFE_RECORD_EXPLAIN,
  }),
  explainItem({
    id: 'life-alt-record-write',
    obj: 'life',
    level: 2,
    alt: true,
    prompt:
      '調《しら》べた 国《くに》の くらしで、日本《にっぽん》と にて いる ところと、ちがう ところを 書《か》こう。',
    canvas: { aspect: 4 / 3, guide: 'lines' },
    hints: [
      '調《しら》べた ことを 一《ひと》つ 思《おも》い出《だ》そう。',
      '日本《にっぽん》の くらしと くらべて みよう。',
      'ちがう ところは、「どうして かな」も 考《かんが》えて みよう。',
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
  title: '世界《せかい》と 日本《にっぽん》',
  kind: 'knowledge',
  status: 'ready',
  prereq: ['g5.soc.land'],
  objectives: [
    { id: 'continents', title: '6つの 大陸《たいりく》の 名前《なまえ》と 位置《いち》' },
    { id: 'oceans', title: '3つの 海洋《かいよう》の 名前《なまえ》と 位置《いち》' },
    {
      id: 'countries',
      title: '日本《にっぽん》と つながりの 深《ふか》い 国《くに》の 位置《いち》',
    },
    {
      id: 'life',
      title: 'くらしの ちがいの 尊重《そんちょう》と 国際協力《こくさいきょうりょく》',
    },
  ],
  misconceptions: [
    {
      id: 'mis-continent',
      explain:
        '別《べつ》の 大陸《たいりく》と 取《と》りちがえたのかな。日本《にっぽん》から 見《み》た 方角《ほうがく》（西《にし》に ユーラシア、東《ひがし》に 北《きた》アメリカ、南《みなみ》に オーストラリア）を 手《て》がかりに しよう。',
    },
    {
      id: 'mis-ocean',
      explain:
        '別《べつ》の 海洋《かいよう》と 取《と》りちがえたのかな。どの 大陸《たいりく》と どの 大陸《たいりく》の 間《あいだ》に あるかを たしかめよう。',
    },
    {
      id: 'mis-sea',
      explain:
        '日本海《にほんかい》は、日本《にっぽん》と ユーラシア大陸《たいりく》の 間《あいだ》の「海《うみ》」で、三《みっ》つの 大《おお》きな 海洋《かいよう》には 入《はい》らないよ。',
    },
    {
      id: 'mis-map-edge',
      explain:
        '平《たい》らな 図《ず》の はしで、世界《せかい》が 終《お》わって いると 考《かんが》えたのかな。地球《ちきゅう》は 丸《まる》いので、左《ひだり》はしと 右《みぎ》はしは つながって いるよ。',
    },
    {
      id: 'mis-country',
      explain:
        '別《べつ》の 国《くに》と 取《と》りちがえたのかな。その 国《くに》が どの 大陸《たいりく》に あり、日本《にっぽん》から どの 方角《ほうがく》に あるかを たしかめよう。',
    },
    {
      id: 'mis-direction',
      explain:
        '方角《ほうがく》を 取《と》りちがえたのかな。図《ず》の 上《うえ》が 北《きた》、右《みぎ》が 東《ひがし》だよ。日本《にっぽん》に 指《ゆび》を おいて たどって みよう。',
    },
    {
      id: 'mis-stereotype',
      explain:
        'その 国《くに》の 人《ひと》を ひとくくりに 考《かんが》えたのかな。どの 国《くに》にも、いろいろな 人《ひと》と くらしが あるよ。ちがいの わけを 知《し》ろうと する ことが 大切《たいせつ》だよ。',
    },
    {
      id: 'mis-intl-org',
      explain:
        '国《くに》どうしの しくみや 活動《かつどう》の 働《はたら》きが 入《い》れかわったのかな。国際連合《こくさいれんごう》は 平和《へいわ》、ユニセフは 子《こ》ども、ユネスコは 教育《きょういく》・科学《かがく》・文化《ぶんか》、と 分《わ》けて おぼえよう。',
    },
  ],
  levels: [
    { label: '大陸《たいりく》と 海洋《かいよう》', chance: 0.25 },
    { label: '国《くに》の 位置《いち》', chance: 0.25 },
    { label: 'くらしと 協力《きょうりょく》', chance: 0.25 },
  ],
  intro: [
    {
      text: '世界《せかい》には 6つの 大陸《たいりく》と 3つの 大《おお》きな 海洋《かいよう》が あるよ。この 図《ず》は 日本《にっぽん》を まん中《なか》に した かんたんな 図《ず》で、形《かたち》は おおよそだよ。本当《ほんとう》の 形《かたち》は 地図帳《ちずちょう》や 地球儀《ちきゅうぎ》で たしかめよう。',
      figure: MAP_C,
    },
    {
      text: '海洋《かいよう》は、ア 太平洋《たいへいよう》・イ 大西洋《たいせいよう》・ウ インド洋《よう》。図《ず》の 左《ひだり》はしと 右《みぎ》はしは つながって いるよ。',
      figure: MAP_O,
    },
    {
      text: '外国《がいこく》の くらしを 調《しら》べる ときは、「その 国《くに》の 人《ひと》は みんな 〜」と 決《き》めつけず、「こういう くらしの 例《れい》も ある」と 考《かんが》えよう。',
      figure: textFig('ちがいを 知《し》る → わけを 考《かんが》える → 大切《たいせつ》に する'),
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）社会 第6学年 内容(3)（グローバル化する世界と日本の役割: 我が国とつながりが深い国の人々の生活、国際連合の働きと我が国の国際協力）、第4学年 内容の取扱い（世界の大陸と主な海洋の名称と位置は第6学年修了までに）、内容(1)の政治の学習とは別単元。世界の図は位置関係を示す模式（本アプリで作成）。統計の数値・順位は扱わない',
};

/** 6年より上の字（小学校の配当外）で、社会の用語・国名として必要なもの */
export const worldAllow: Allow = {
  儀: '地球儀（社会の用語。地図帳と並ぶ学習の道具）',
  華: '中華人民共和国（国名）',
  韓: '大韓民国（国名）',
};
