/**
 * g3.soc.map-symbols 方位と地図記号、絵地図の読み取り（curriculum-matrix 3.6、社会 第3学年 内容(1)）。
 *
 * 到達項目:
 *   symbol-name … 地図記号を見て名前を選ぶ（27種 全件）。別例 = 記号の もとに なった 形から 記号を 選ぶ（choice の文）
 *   symbol-pick … 名前を見て記号を選ぶ（27種 全件）。別例 = 絵地図の中から その記号を さがして タップ（town）
 *   direction   … 四方位 → 八方位（方位じしん compass）。別例 = 体の向きと方位の文の問題（choice）
 *   town-map    … 絵地図で「○○の 北に ある もの」（town の from+dir）。別例 = 文で書いた位置の関係から方位を答える（choice）
 * 同一性キー: 問題の id（記号・方位・絵地図と方位の組）。
 * 記号の形は map エンジン（symbols.tsx）が描く。名前は SYMBOL_NAME と同じ語。
 */
import type { ChoiceItem, Item, MapItem, UnitSpec } from '../../curriculum/types';
import type { Dir8, SymbolId } from '../../engines/map/map';
import { baseSoc, choiceItem, mapItem, type Allow } from './util';

/** 学年より上の字（すべて地図記号・方位の名前。地図記号の名前は教科の用語） */
export const mapSymbolsAllow: Allow = {
  位: '方位《ほうい》（社会の用語）',
  警: '警察署《けいさつしょ》（地図記号の名前）',
  察: '警察署《けいさつしょ》（地図記号の名前）',
  署: '警察署《けいさつしょ》・消防署《しょうぼうしょ》（地図記号の名前）',
  防: '消防署《しょうぼうしょ》（地図記号の名前）',
  郵: '郵便局《ゆうびんきょく》（地図記号の名前）',
  便: '郵便局《ゆうびんきょく》（地図記号の名前）',
  博: '博物館《はくぶつかん》（地図記号の名前）',
  果: '果樹園《かじゅえん》（地図記号の名前）',
  樹: '果樹園《かじゅえん》・広葉樹林《こうようじゅりん》・針葉樹林《しんようじゅりん》（地図記号の名前）',
  針: '針葉樹林《しんようじゅりん》（地図記号の名前）',
  老: '老人《ろうじん》ホーム（地図記号の名前）',
  泉: '温泉《おんせん》（地図記号の名前）',
  城: '城跡《しろあと》（地図記号の名前）',
  跡: '城跡《しろあと》（地図記号の名前）',
  灯: '灯台《とうだい》（地図記号の名前）',
};

const NAME: Record<SymbolId, string> = {
  'city-office': '市役所《しやくしょ》',
  'town-office': '町村役場《ちょうそんやくば》',
  school: '学校《がっこう》',
  'high-school': '高等学校《こうとうがっこう》',
  police: '警察署《けいさつしょ》',
  koban: '交番《こうばん》',
  fire: '消防署《しょうぼうしょ》',
  post: '郵便局《ゆうびんきょく》',
  hospital: '病院《びょういん》',
  shrine: '神社《じんじゃ》',
  temple: '寺《てら》',
  library: '図書館《としょかん》',
  museum: '博物館《はくぶつかん》',
  factory: '工場《こうじょう》',
  power: '発電所《はつでんしょ》',
  rice: '田《た》',
  field: '畑《はたけ》',
  orchard: '果樹園《かじゅえん》',
  tea: '茶畑《ちゃばたけ》',
  broadleaf: '広葉樹林《こうようじゅりん》',
  conifer: '針葉樹林《しんようじゅりん》',
  elderly: '老人《ろうじん》ホーム',
  onsen: '温泉《おんせん》',
  castle: '城跡《しろあと》',
  lighthouse: '灯台《とうだい》',
  port: '港《みなと》',
  station: '駅《えき》',
};

interface Sym {
  id: SymbolId;
  level: number;
  /** 形の見方（ヒント①） */
  shape: string;
  /** もとに なった もの（ヒント②・解説） */
  origin: string;
  /** ヒント③（名前の手がかり。名前そのものは書かない） */
  near: string;
  /** まぎらわしい記号（3つ） */
  others: [SymbolId, SymbolId, SymbolId];
}

const SYMS: Sym[] = [
  {
    id: 'city-office',
    level: 0,
    shape: 'まるが 二《ふた》つ かさなって いるね。',
    origin: '二重《にじゅう》の まるは、市《し》の しごとを する ところの しるしだよ。',
    near: 'まるが 一《ひと》つだけなら 町《まち》や 村《むら》の 役場《やくば》だよ。二《ふた》つだと…？',
    others: ['town-office', 'police', 'post'],
  },
  {
    id: 'town-office',
    level: 0,
    shape: 'まるが 一《ひと》つだけ あるね。',
    origin: 'まる 一《ひと》つは、町《まち》や 村《むら》の しごとを する ところの しるしだよ。',
    near: 'まるが 二《ふた》つ なら 市《し》の 役所《やくしょ》。一《ひと》つなら…？',
    others: ['city-office', 'hospital', 'post'],
  },
  {
    id: 'school',
    level: 0,
    shape: '「文《ぶん》」という 字《じ》の 形《かたち》に 見《み》えるね。',
    origin: '文《ぶん》や 字《じ》を 学《まな》ぶ ところ、という いみの 形《かたち》だよ。',
    near: 'まるで かこまれて いないね。小学校《しょうがっこう》や 中学校《ちゅうがっこう》の しるしだよ。',
    others: ['high-school', 'library', 'museum'],
  },
  {
    id: 'high-school',
    level: 1,
    shape: '「文《ぶん》」の 形《かたち》が、まるで かこまれて いるね。',
    origin:
      '「文《ぶん》」だけなら 小学校《しょうがっこう》や 中学校《ちゅうがっこう》。まるで かこむと…？',
    near: '中学校《ちゅうがっこう》を 出《で》た あとに 通《かよ》う 学校《がっこう》だよ。',
    others: ['school', 'post', 'police'],
  },
  {
    id: 'police',
    level: 0,
    shape: '×《ばつ》の 形《かたち》が、まるで かこまれて いるね。',
    origin: '×《ばつ》は、けいぼうを 二《に》本《ほん》 交《こう》さ させた 形《かたち》だよ。',
    near: '×《ばつ》だけなら 交番《こうばん》。まるで かこむと、もっと 大《おお》きな ところだよ。',
    others: ['koban', 'hospital', 'city-office'],
  },
  {
    id: 'koban',
    level: 0,
    shape: '×《ばつ》の 形《かたち》だけで、まるが ないね。',
    origin: '×《ばつ》は、けいぼうを 二《に》本《ほん》 交《こう》さ させた 形《かたち》だよ。',
    near: 'まちかどに ある、おまわりさんの いる 小《ちい》さな たてものだよ。',
    others: ['police', 'fire', 'school'],
  },
  {
    id: 'fire',
    level: 0,
    shape: 'Y《ワイ》の ような 形《かたち》だね。',
    origin:
      'むかし 火《ひ》を けす ときに つかった「さすまた」という 道具《どうぐ》の 形《かたち》だよ。',
    near: '火《ひ》じを けしに 行《い》く 車《くるま》が いる ところだよ。',
    others: ['koban', 'port', 'shrine'],
  },
  {
    id: 'post',
    level: 0,
    shape: 'まるの 中《なか》に「〒」の しるしが あるね。',
    origin: '「〒」は、手紙《てがみ》や にもつを あつかう ところの しるしだよ。',
    near: '手紙《てがみ》を 出《だ》したり、切手《きって》を 買《か》ったり する ところだよ。',
    others: ['hospital', 'police', 'city-office'],
  },
  {
    id: 'hospital',
    level: 0,
    shape: 'まるの 中《なか》に 十字《じゅうじ》の しるしが あるね。',
    origin: '十字《じゅうじ》の しるしは、けがや びょうきの 手《て》あての しるしから できたよ。',
    near: 'びょうきや けがを 見《み》て もらう ところだよ。',
    others: ['post', 'police', 'elderly'],
  },
  {
    id: 'shrine',
    level: 0,
    shape: '門《もん》の ような 形《かたち》だね。',
    origin: '入《い》り口《ぐち》に 立《た》つ「とりい」の 形《かたち》だよ。',
    near: 'おまつりや おまいりを する ところで、とりいが あるよ。',
    others: ['temple', 'castle', 'museum'],
  },
  {
    id: 'temple',
    level: 0,
    shape: '十字《じゅうじ》の はしが、まがって いる 形《かたち》だね。',
    origin: '「まんじ」という しるしの 形《かたち》だよ。',
    near: 'おぼうさんが いる ところだよ。',
    others: ['shrine', 'hospital', 'castle'],
  },
  {
    id: 'library',
    level: 0,
    shape: 'ひらいた 本《ほん》の 形《かたち》だね。',
    origin: '本《ほん》を ひらいた 形《かたち》から できた 記号《きごう》だよ。',
    near: '本《ほん》を かりたり 読《よ》んだり できる ところだよ。',
    others: ['museum', 'school', 'elderly'],
  },
  {
    id: 'museum',
    level: 1,
    shape: '屋《や》根《ね》と 柱《はしら》の ある たてものの 形《かたち》だね。',
    origin:
      'むかしの ものや めずらしい ものを ならべて 見《み》せる、たてものの 形《かたち》だよ。',
    near: 'むかしの 道具《どうぐ》や 化《か》石《せき》などを 見《み》に 行《い》く ところだよ。',
    others: ['library', 'elderly', 'shrine'],
  },
  {
    id: 'factory',
    level: 1,
    shape: 'ぎざぎざの わ（歯車《はぐるま》）の 形《かたち》だね。',
    origin: 'きかいの 歯車《はぐるま》の 形《かたち》だよ。',
    near: '歯車《はぐるま》だけで、中《なか》は まるい あな。ものを 作《つく》る ところだよ。',
    others: ['power', 'lighthouse', 'orchard'],
  },
  {
    id: 'power',
    level: 1,
    shape: '歯車《はぐるま》の 中《なか》に、線《せん》が 入《はい》って いるね。',
    origin:
      '歯車《はぐるま》と、電気《でんき》の 回《かい》ろの 線《せん》を あわせた 形《かたち》だよ。',
    near: '電気《でんき》を つくる ところだよ。',
    others: ['factory', 'lighthouse', 'fire'],
  },
  {
    id: 'rice',
    level: 1,
    shape: 'たての 線《せん》が 二《に》本《ほん》 ならんで いるね。',
    origin: 'いねを かりとった あとの、かぶの 形《かたち》だよ。',
    near: 'お米《こめ》を つくる ところだよ。',
    others: ['field', 'tea', 'orchard'],
  },
  {
    id: 'field',
    level: 1,
    shape: '小《ちい》さな はっぱが 二《に》まい ひらいた 形《かたち》だね。',
    origin: 'たねから 出《で》た「ふたば」の 形《かたち》だよ。',
    near: 'やさいなどを そだてる ところだよ。',
    others: ['rice', 'tea', 'broadleaf'],
  },
  {
    id: 'orchard',
    level: 1,
    shape: 'まるに、じくが 一《いっ》本《ぽん》 ついて いるね。',
    origin: 'りんごや みかんなどの 実《み》の 形《かたち》だよ。',
    near: 'くだものの 木《き》を そだてる ところだよ。',
    others: ['tea', 'broadleaf', 'field'],
  },
  {
    id: 'tea',
    level: 1,
    shape: '小《ちい》さな まるが 三《みっ》つ ならんで いるね。',
    origin: 'お茶《ちゃ》の 木《き》の 実《み》の 形《かたち》だよ。',
    near: 'のみものに する はっぱを そだてる ところだよ。',
    others: ['orchard', 'field', 'rice'],
  },
  {
    id: 'broadleaf',
    level: 1,
    shape:
      'まるい あたまに、みきが 一《いっ》本《ぽん》。木《き》を 横《よこ》から 見《み》た 形《かたち》だね。',
    origin: 'さくらや けやきのような、はばの 広《ひろ》い はっぱの 木《き》の 形《かたち》だよ。',
    near: 'はっぱの はばが 広《ひろ》い 木《き》が 多《おお》い 林《はやし》だよ。',
    others: ['conifer', 'orchard', 'field'],
  },
  {
    id: 'conifer',
    level: 1,
    shape: 'とがった 山《やま》の 形《かたち》に、みきが 通《とお》って いるね。',
    origin: 'すぎや まつのような、細《ほそ》い はっぱの 木《き》の 形《かたち》だよ。',
    near: 'はりのように 細《ほそ》い はっぱの 木《き》が 多《おお》い 林《はやし》だよ。',
    others: ['broadleaf', 'shrine', 'field'],
  },
  {
    id: 'elderly',
    level: 1,
    shape: 'たてものの 中《なか》に、つえが あるね。',
    origin: 'たてものと、お年《とし》よりの つえを あわせた 形《かたち》だよ。',
    near: 'お年《とし》よりが くらしたり、せわを うけたり する ところだよ。',
    others: ['hospital', 'museum', 'library'],
  },
  {
    id: 'onsen',
    level: 1,
    shape: 'おわんの ような 形《かたち》から、ゆげが 三《みっ》つ 立《た》って いるね。',
    origin: 'おゆが わき出《で》て、ゆげが 立《た》つ ようすの 形《かたち》だよ。',
    near: 'あたたかい おゆが わき出《で》る ところだよ。',
    others: ['port', 'lighthouse', 'field'],
  },
  {
    id: 'castle',
    level: 1,
    shape: 'でこぼこの ある 四角《しかく》の 形《かたち》だね。',
    origin: 'むかしの おしろを つくった ときの、くぎりの 線《せん》の 形《かたち》だよ。',
    near: 'むかし おしろが あった ところだよ。',
    others: ['museum', 'temple', 'station'],
  },
  {
    id: 'lighthouse',
    level: 1,
    shape: 'まるから、光《ひかり》が 八《はっ》方《ぽう》へ 出《で》て いる 形《かたち》だね。',
    origin:
      '光《ひかり》を 出《だ》して、夜《よる》の 船《ふね》に 場《ば》しょを 知《し》らせる ものの 形《かたち》だよ。',
    near: '海《うみ》の そばに 立《た》って、夜《よる》に 光《ひか》る たてものだよ。',
    others: ['factory', 'port', 'onsen'],
  },
  {
    id: 'port',
    level: 1,
    shape: '船《ふね》を とめる「いかり」の 形《かたち》だね。',
    origin: '船《ふね》が とまる ときに おろす いかりの 形《かたち》だよ。',
    near: '船《ふね》が 出《で》たり 入《はい》ったり する ところだよ。',
    others: ['lighthouse', 'onsen', 'fire'],
  },
  {
    id: 'station',
    level: 0,
    shape: '長《なが》い 四角《しかく》の まん中《なか》に 線《せん》が あるね。',
    origin: '線《せん》ろの 上《うえ》に ある、電車《でんしゃ》が とまる ところの しるしだよ。',
    near: '電車《でんしゃ》に のったり おりたり する ところだよ。',
    others: ['castle', 'factory', 'school'],
  },
];

/** まるの ある・ない で区別する組 */
const CIRCLE_PAIRS = new Set(['city-office|town-office', 'school|high-school', 'police|koban']);
/** 形の似た記号のなかま */
const SHAPE_GROUPS: SymbolId[][] = [
  ['shrine', 'temple', 'castle'],
  ['library', 'museum', 'elderly', 'school'],
  ['factory', 'power', 'lighthouse'],
  ['rice', 'field', 'orchard', 'tea', 'broadleaf'],
  ['broadleaf', 'conifer', 'orchard'],
  ['port', 'lighthouse', 'onsen'],
  ['post', 'hospital', 'police', 'city-office'],
];

function misOf(a: SymbolId, b: SymbolId): string {
  if (CIRCLE_PAIRS.has(`${a}|${b}`) || CIRCLE_PAIRS.has(`${b}|${a}`)) return 'sym-circle';
  if (SHAPE_GROUPS.some((g) => g.includes(a) && g.includes(b))) return 'sym-shape';
  return 'sym-meaning';
}

const nameItems: MapItem[] = SYMS.map((s) =>
  mapItem({
    id: `name-${s.id}`,
    obj: 'symbol-name',
    level: s.level,
    prompt: 'この 地図記号《ちずきごう》は 何《なに》を あらわして いるかな。',
    task: { kind: 'symbol', ask: 'name', symbol: s.id, options: [s.id, ...s.others] },
    wrongAnswers: s.others.map((o) => ({ value: o, misconception: misOf(s.id, o) })),
    hints: [s.shape, s.origin, s.near],
    explain: `${NAME[s.id]}の 記号《きごう》だよ。${s.origin}`,
  }),
);

const pickItems: MapItem[] = SYMS.map((s) =>
  mapItem({
    id: `pick-${s.id}`,
    obj: 'symbol-pick',
    level: s.level,
    prompt: `${NAME[s.id]}の 地図記号《ちずきごう》は どれかな。`,
    task: { kind: 'symbol', ask: 'pick', symbol: s.id, options: [s.id, ...s.others] },
    wrongAnswers: s.others.map((o) => ({ value: o, misconception: misOf(s.id, o) })),
    hints: [
      'その たてものや 場《ば》しょに ある もの・道具《どうぐ》を 思《おも》いうかべよう。',
      s.origin,
      s.shape,
    ],
    explain: `${NAME[s.id]}の 記号《きごう》は、${s.origin}`,
  }),
);

/** 別例（symbol-name）: 記号の もとに なった 形から 名前を選ぶ（記号の絵を見ない） */
interface OriginQ {
  id: string;
  level: number;
  prompt: string;
  right: SymbolId;
  wrongs: [SymbolId, SymbolId, SymbolId];
  explain: string;
}
const ORIGIN_QS: OriginQ[] = [
  {
    id: 'o1',
    level: 0,
    prompt:
      'むかし 火《ひ》を けす ときに つかった「さすまた」の 形《かたち》から できた 地図記号《ちずきごう》は どれかな。',
    right: 'fire',
    wrongs: ['koban', 'port', 'shrine'],
    explain: '消防署《しょうぼうしょ》の 記号《きごう》は、さすまたの 形《かたち》から できたよ。',
  },
  {
    id: 'o2',
    level: 1,
    prompt:
      'いねを かりとった あとの かぶの 形《かたち》から できた 地図記号《ちずきごう》は どれかな。',
    right: 'rice',
    wrongs: ['field', 'tea', 'orchard'],
    explain: '田《た》の 記号《きごう》は、いねを かりとった あとの かぶの 形《かたち》だよ。',
  },
  {
    id: 'o3',
    level: 1,
    prompt:
      'たねから 出《で》た「ふたば」の 形《かたち》から できた 地図記号《ちずきごう》は どれかな。',
    right: 'field',
    wrongs: ['rice', 'broadleaf', 'tea'],
    explain: '畑《はたけ》の 記号《きごう》は、ふたばの 形《かたち》だよ。',
  },
  {
    id: 'o4',
    level: 1,
    prompt:
      'きかいの 歯車《はぐるま》の 形《かたち》だけで できた 地図記号《ちずきごう》は どれかな。',
    right: 'factory',
    wrongs: ['power', 'lighthouse', 'castle'],
    explain:
      '工場《こうじょう》の 記号《きごう》は 歯車《はぐるま》の 形《かたち》。歯車《はぐるま》に 電気《でんき》の 線《せん》が 入《はい》ると 発電所《はつでんしょ》だよ。',
  },
  {
    id: 'o5',
    level: 0,
    prompt:
      '入《い》り口《ぐち》に 立《た》つ「とりい」の 形《かたち》から できた 地図記号《ちずきごう》は どれかな。',
    right: 'shrine',
    wrongs: ['temple', 'castle', 'museum'],
    explain:
      '神社《じんじゃ》の 記号《きごう》は、とりいの 形《かたち》だよ。寺《てら》は「まんじ」の 形《かたち》だね。',
  },
];
const originItems: ChoiceItem[] = ORIGIN_QS.map((q) =>
  choiceItem({
    id: `origin-${q.id}`,
    obj: 'symbol-name',
    level: q.level,
    alt: true,
    prompt: q.prompt,
    right: NAME[q.right],
    wrongs: q.wrongs.map((w) => [NAME[w], misOf(q.right, w)] as const),
    layout: 'grid',
    hints: [
      'その 形《かたち》の ものが、どこで つかわれて いるか 考《かんが》えよう。',
      'その ものを つかう 人《ひと》や しごとを 思《おも》いうかべよう。',
      'しごとと 場《ば》しょを むすびつけよう。',
    ],
    explain: q.explain,
  }),
);

// ---- 絵地図 ----
type Place = { symbol: SymbolId; at: [number, number]; label?: string };
interface Town {
  key: string;
  /** 0 番が まん中の基準の場所（label 付き） */
  places: Place[];
}
/** まん中 [2,2] の基準のまわり 8 方位に 1つずつ（どの方位にも答えが1つだけ） */
const ring = (center: Place, around: Record<Dir8, SymbolId>): Place[] => {
  const pos: Record<Dir8, [number, number]> = {
    n: [2, 0],
    ne: [4, 0],
    e: [4, 2],
    se: [4, 4],
    s: [2, 4],
    sw: [0, 4],
    w: [0, 2],
    nw: [0, 0],
  };
  return [center, ...(Object.keys(pos) as Dir8[]).map((d) => ({ symbol: around[d], at: pos[d] }))];
};
const TOWNS: Town[] = [
  {
    key: 'a',
    places: ring(
      { symbol: 'station', at: [2, 2], label: '駅《えき》' },
      {
        n: 'school',
        ne: 'shrine',
        e: 'post',
        se: 'hospital',
        s: 'library',
        sw: 'temple',
        w: 'koban',
        nw: 'fire',
      },
    ),
  },
  {
    key: 'b',
    places: ring(
      { symbol: 'school', at: [2, 2], label: '学校《がっこう》' },
      {
        n: 'rice',
        ne: 'field',
        e: 'orchard',
        se: 'post',
        s: 'station',
        sw: 'shrine',
        w: 'factory',
        nw: 'temple',
      },
    ),
  },
  {
    key: 'c',
    places: ring(
      { symbol: 'city-office', at: [2, 2], label: '市役所《しやくしょ》' },
      {
        n: 'castle',
        ne: 'museum',
        e: 'police',
        se: 'library',
        s: 'hospital',
        sw: 'high-school',
        w: 'elderly',
        nw: 'fire',
      },
    ),
  },
];
const ROADS: [number, number][][] = [
  [
    [0, 2],
    [4, 2],
  ],
  [
    [2, 0],
    [2, 4],
  ],
];
const DIR_WORD: Record<Dir8, string> = {
  n: '北《きた》',
  ne: '北東《ほくとう》',
  e: '東《ひがし》',
  se: '南東《なんとう》',
  s: '南《みなみ》',
  sw: '南西《なんせい》',
  w: '西《にし》',
  nw: '北西《ほくせい》',
};
const DIR_HINT: Record<Dir8, string> = {
  n: '上《うえ》の ほうへ まっすぐ すすもう。',
  e: '右《みぎ》の ほうへ まっすぐ すすもう。',
  s: '下《した》の ほうへ まっすぐ すすもう。',
  w: '左《ひだり》の ほうへ まっすぐ すすもう。',
  ne: '上《うえ》と 右《みぎ》の あいだの ななめへ すすもう。',
  se: '下《した》と 右《みぎ》の あいだの ななめへ すすもう。',
  sw: '下《した》と 左《ひだり》の あいだの ななめへ すすもう。',
  nw: '上《うえ》と 左《ひだり》の あいだの ななめへ すすもう。',
};
const TOWN_QS: { town: string; dir: Dir8; level: number }[] = [
  { town: 'a', dir: 'n', level: 1 },
  { town: 'a', dir: 'w', level: 1 },
  { town: 'a', dir: 'se', level: 2 },
  { town: 'b', dir: 'e', level: 1 },
  { town: 'b', dir: 's', level: 1 },
  { town: 'b', dir: 'nw', level: 2 },
  { town: 'c', dir: 'n', level: 1 },
  { town: 'c', dir: 'ne', level: 2 },
  { town: 'c', dir: 'sw', level: 2 },
  { town: 'a', dir: 'ne', level: 2 },
];
const TOWN_ORDER: Dir8[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const townItems: MapItem[] = TOWN_QS.map((q) => {
  const t = TOWNS.find((x) => x.key === q.town)!;
  const center = t.places[0]!;
  const answer = 1 + TOWN_ORDER.indexOf(q.dir);
  const ans = t.places[answer]!;
  return mapItem({
    id: `town-${q.town}-${q.dir}`,
    obj: 'town-map',
    level: q.level,
    prompt: `${center.label}の ${DIR_WORD[q.dir]}に ある 地図記号《ちずきごう》を タップしよう。`,
    task: {
      kind: 'town',
      size: [5, 5],
      places: t.places,
      roads: ROADS,
      from: 0,
      dir: q.dir,
      answer,
    },
    misconceptions: { opposite: 'dir-opposite', mirrorEW: 'dir-east-west' },
    hints: [
      'ちずの 方位《ほうい》の しるしを 見《み》よう。ふつう 上《うえ》が 北《きた》だよ。',
      `${center.label}から ${DIR_HINT[q.dir]}`,
      `${center.label}の すぐ そばでは なく、ちずの はしの ほうの 記号《きごう》だよ。`,
    ],
    explain: `${center.label}の ${DIR_WORD[q.dir]}には、${NAME[ans.symbol]}が あるよ。`,
  });
});

/** 別例（symbol-pick）: 絵地図の中から 名前の記号を さがす（方位を使わない） */
const FIND_QS: { town: string; symbol: SymbolId; level: number }[] = [
  { town: 'a', symbol: 'post', level: 0 },
  { town: 'a', symbol: 'temple', level: 1 },
  { town: 'b', symbol: 'orchard', level: 1 },
  { town: 'c', symbol: 'high-school', level: 1 },
];
const findItems: MapItem[] = FIND_QS.map((q) => {
  const t = TOWNS.find((x) => x.key === q.town)!;
  const s = SYMS.find((x) => x.id === q.symbol)!;
  return mapItem({
    id: `find-${q.town}-${q.symbol}`,
    obj: 'symbol-pick',
    level: q.level,
    alt: true,
    prompt: `この 絵地図《えちず》で、${NAME[q.symbol]}は どこかな。タップしよう。`,
    task: {
      kind: 'town',
      size: [5, 5],
      places: t.places,
      roads: ROADS,
      answer: t.places.findIndex((p) => p.symbol === q.symbol),
    },
    hints: [s.origin, s.shape, 'ちずの 記号《きごう》を 一《ひと》つずつ たしかめよう。'],
    explain: `${NAME[q.symbol]}の 記号《きごう》は、${s.origin}`,
  });
});

// ---- 方位 ----
const COMPASS: { dir: Dir8; ask: 'name' | 'point'; points: 4 | 8; level: number }[] = [
  { dir: 'n', ask: 'name', points: 4, level: 0 },
  { dir: 'e', ask: 'name', points: 4, level: 0 },
  { dir: 's', ask: 'name', points: 4, level: 0 },
  { dir: 'w', ask: 'name', points: 4, level: 0 },
  { dir: 'e', ask: 'point', points: 4, level: 0 },
  { dir: 's', ask: 'point', points: 4, level: 0 },
  { dir: 'w', ask: 'point', points: 4, level: 0 },
  { dir: 'ne', ask: 'name', points: 8, level: 1 },
  { dir: 'se', ask: 'name', points: 8, level: 1 },
  { dir: 'sw', ask: 'name', points: 8, level: 1 },
  { dir: 'nw', ask: 'name', points: 8, level: 1 },
  { dir: 'ne', ask: 'point', points: 8, level: 1 },
  { dir: 'se', ask: 'point', points: 8, level: 1 },
  { dir: 'sw', ask: 'point', points: 8, level: 1 },
  { dir: 'nw', ask: 'point', points: 8, level: 1 },
];
const DIAG_PARTS: Partial<Record<Dir8, string>> = {
  ne: '北《きた》と 東《ひがし》',
  se: '南《みなみ》と 東《ひがし》',
  sw: '南《みなみ》と 西《にし》',
  nw: '北《きた》と 西《にし》',
};
const compassItems: MapItem[] = COMPASS.map((c) => {
  const diag = DIAG_PARTS[c.dir];
  return mapItem({
    id: `compass-${c.ask}-${c.dir}-${c.points}`,
    obj: 'direction',
    level: c.level,
    prompt:
      c.ask === 'name'
        ? 'やじるしの さして いる 方位《ほうい》は どれかな。'
        : `${DIR_WORD[c.dir]}は どこかな。ふだを タップしよう。`,
    task: {
      kind: 'compass',
      ask: c.ask,
      dir: c.dir,
      points: c.points,
      ...(c.ask === 'point' ? { given: ['n' as Dir8] } : {}),
    },
    misconceptions: { opposite: 'dir-opposite', mirrorEW: 'dir-east-west' },
    hints: diag
      ? [
          'まず 北《きた》が どこかを たしかめよう。',
          '八方位《はっぽうい》は、四方位《しほうい》の あいだに ななめの 方位《ほうい》が 入《はい》るよ。',
          '二《ふた》つの 方位《ほうい》の あいだの 名前《なまえ》は、北《きた》か 南《みなみ》を 先《さき》に 言《い》うよ。',
        ]
      : [
          'まず 北《きた》が どこかを たしかめよう。',
          '北《きた》を むいて 立《た》つと、右手《みぎて》が 東《ひがし》、左手《ひだりて》が 西《にし》、せなかが 南《みなみ》だよ。',
          '北《きた》から 時計《とけい》の はりの むきに、東《ひがし》・南《みなみ》・西《にし》の じゅんに ならぶよ。',
        ],
    explain: diag
      ? `${DIR_WORD[c.dir]}は、${diag}の あいだの 方位《ほうい》だよ。`
      : `${DIR_WORD[c.dir]}だよ。北《きた》から 時計《とけい》まわりに、北《きた》・東《ひがし》・南《みなみ》・西《にし》と ならぶよ。`,
  });
});

/** 別例（direction）: 体の向きと方位（文で答える） */
const bodyItems: ChoiceItem[] = [
  choiceItem({
    id: 'body-1',
    obj: 'direction',
    level: 0,
    alt: true,
    prompt: '北《きた》を むいて 立《た》ったよ。右手《みぎて》の ほうは どの 方位《ほうい》かな。',
    right: '東《ひがし》',
    wrongs: [
      ['西《にし》', 'dir-east-west'],
      ['南《みなみ》', 'dir-opposite'],
      ['北《きた》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '北《きた》を むいた 体《からだ》を 思《おも》いうかべよう。',
      '左手《ひだりて》は 西《にし》、せなかは 南《みなみ》だよ。',
      'のこりの 方位《ほうい》が 右手《みぎて》だよ。',
    ],
    explain:
      '北《きた》を むくと、右手《みぎて》が 東《ひがし》、左手《ひだりて》が 西《にし》だよ。',
  }),
  choiceItem({
    id: 'body-2',
    obj: 'direction',
    level: 0,
    alt: true,
    prompt:
      '朝《あさ》、太陽《たいよう》の 出《で》る ほうを むいて 立《た》ったよ。せなかの ほうは どの 方位《ほうい》かな。',
    right: '西《にし》',
    wrongs: [
      ['東《ひがし》', 'dir-opposite'],
      ['北《きた》', 'dir-east-west'],
      ['南《みなみ》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '太陽《たいよう》は 朝《あさ》、どの 方位《ほうい》から 出《で》るかな。',
      '朝《あさ》の 太陽《たいよう》は 東《ひがし》の 空《そら》に 見《み》えるよ。',
      'むいて いる 方位《ほうい》の はんたいが、せなかの ほうだよ。',
    ],
    explain:
      '朝《あさ》の 太陽《たいよう》は 東《ひがし》に 見《み》えるので、せなかの ほうは はんたいの 西《にし》だよ。',
  }),
  choiceItem({
    id: 'body-3',
    obj: 'direction',
    level: 1,
    alt: true,
    prompt:
      '南《みなみ》を むいて 立《た》ったよ。右手《みぎて》の ほうは どの 方位《ほうい》かな。',
    right: '西《にし》',
    wrongs: [
      ['東《ひがし》', 'dir-east-west'],
      ['北《きた》', 'dir-opposite'],
      ['南《みなみ》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '南《みなみ》を むくと、北《きた》を むいた ときと 右《みぎ》と 左《ひだり》が 入《い》れかわるよ。',
      '北《きた》を むいた ときの 右手《みぎて》は 東《ひがし》だったね。',
      'その はんたいの 方位《ほうい》を 考《かんが》えよう。',
    ],
    explain:
      '南《みなみ》を むくと、右手《みぎて》が 西《にし》、左手《ひだりて》が 東《ひがし》だよ。',
  }),
  choiceItem({
    id: 'body-4',
    obj: 'direction',
    level: 1,
    alt: true,
    prompt:
      '北《きた》と 西《にし》の ちょうど あいだの 方位《ほうい》の 名前《なまえ》は どれかな。',
    right: '北西《ほくせい》',
    wrongs: [
      ['北東《ほくとう》', 'dir-east-west'],
      ['南東《なんとう》', 'dir-opposite'],
      ['南西《なんせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      'ななめの 方位《ほうい》は、二《ふた》つの 方位《ほうい》を あわせた 名前《なまえ》だよ。',
      '北《きた》か 南《みなみ》を 先《さき》に 言《い》うよ。',
      '「北《きた》」と「西《にし》」を あわせよう。',
    ],
    explain: '北《きた》と 西《にし》の あいだは 北西《ほくせい》だよ。',
  }),
];

/** 別例（town-map）: 文で書いた位置の関係から方位を答える */
const relItems: ChoiceItem[] = [
  choiceItem({
    id: 'rel-1',
    obj: 'town-map',
    level: 1,
    alt: true,
    prompt:
      '図書館《としょかん》は 駅《えき》の 北《きた》に あるよ。図書館《としょかん》から 見《み》ると、駅《えき》は どの 方位《ほうい》かな。',
    right: '南《みなみ》',
    wrongs: [
      ['北《きた》', 'dir-opposite'],
      ['東《ひがし》', 'dir-east-west'],
      ['西《にし》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '駅《えき》と 図書館《としょかん》を、ちずの 上《うえ》に おいて みよう。',
      '図書館《としょかん》は 駅《えき》の 上《うえ》の ほう（北《きた》）だね。',
      'こんどは 図書館《としょかん》から 駅《えき》を 見《み》るよ。見《み》る 場《ば》しょが 入《い》れかわると 方位《ほうい》は はんたいに なるよ。',
    ],
    explain:
      'AがBの 北《きた》に あるとき、Aから 見《み》た Bは 南《みなみ》だよ。だから 駅《えき》は 図書館《としょかん》の 南《みなみ》。',
  }),
  choiceItem({
    id: 'rel-2',
    obj: 'town-map',
    level: 1,
    alt: true,
    prompt:
      '学校《がっこう》から 東《ひがし》へ 歩《ある》くと 公園《こうえん》、公園《こうえん》から 北《きた》へ 歩《ある》くと 神社《じんじゃ》が あるよ。学校《がっこう》から 見《み》て、神社《じんじゃ》は どの 方位《ほうい》かな。',
    right: '北東《ほくとう》',
    wrongs: [
      ['北西《ほくせい》', 'dir-east-west'],
      ['南西《なんせい》', 'dir-opposite'],
      ['南東《なんとう》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '紙《かみ》に 学校《がっこう》を かいて、道《みち》を じゅんに たどろう。',
      '東《ひがし》へ すすんで、そこから 北《きた》へ すすむよ。',
      '北《きた》の ほうで、しかも 東《ひがし》の ほうに あるね。二《ふた》つを あわせた 方位《ほうい》だよ。',
    ],
    explain:
      '東《ひがし》へ 行《い》って 北《きた》へ 行《い》くので、神社《じんじゃ》は 学校《がっこう》の 北東《ほくとう》に あるよ。',
  }),
  choiceItem({
    id: 'rel-3',
    obj: 'town-map',
    level: 2,
    alt: true,
    prompt:
      '駅《えき》の 西《にし》に 交番《こうばん》、交番《こうばん》の 南《みなみ》に 病院《びょういん》が あるよ。駅《えき》から 見《み》て、病院《びょういん》は どの 方位《ほうい》かな。',
    right: '南西《なんせい》',
    wrongs: [
      ['南東《なんとう》', 'dir-east-west'],
      ['北東《ほくとう》', 'dir-opposite'],
      ['北西《ほくせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '駅《えき》を まん中《なか》に おいて、じゅんに たどろう。',
      '駅《えき》から 左《ひだり》（西《にし》）へ、そこから 下《した》（南《みなみ》）へ すすむよ。',
      '南《みなみ》の ほうで、しかも 西《にし》の ほうだね。南《みなみ》を 先《さき》に 言《い》うよ。',
    ],
    explain:
      '西《にし》へ 行《い》って 南《みなみ》へ 行《い》くので、病院《びょういん》は 駅《えき》の 南西《なんせい》だよ。',
  }),
  choiceItem({
    id: 'rel-4',
    obj: 'town-map',
    level: 2,
    alt: true,
    prompt:
      '市役所《しやくしょ》の 南東《なんとう》に 郵便局《ゆうびんきょく》が あるよ。郵便局《ゆうびんきょく》から 見《み》ると、市役所《しやくしょ》は どの 方位《ほうい》かな。',
    right: '北西《ほくせい》',
    wrongs: [
      ['南東《なんとう》', 'dir-opposite'],
      ['北東《ほくとう》', 'dir-east-west'],
      ['南西《なんせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '二《ふた》つの 場《ば》しょを、ちずの 上《うえ》に おいて みよう。',
      '郵便局《ゆうびんきょく》は 市役所《しやくしょ》の 右下《みぎした》の ななめに あるね。',
      '見《み》る 場《ば》しょが 入《い》れかわると、方位《ほうい》は はんたいに なるよ。',
    ],
    explain:
      '南東《なんとう》の はんたいは 北西《ほくせい》。郵便局《ゆうびんきょく》から 見《み》ると、市役所《しやくしょ》は 北西《ほくせい》だよ。',
  }),
];

const items: Item[] = [
  ...nameItems,
  ...originItems,
  ...pickItems,
  ...findItems,
  ...compassItems,
  ...bodyItems,
  ...townItems,
  ...relItems,
];

export const mapSymbols: UnitSpec = {
  ...baseSoc('g3.soc.map-symbols', 'g3'),
  status: 'ready',
  title: '方位《ほうい》と 地図記号《ちずきごう》',
  kind: 'knowledge',
  review: 'item',
  prereq: ['g2.life.town'],
  objectives: [
    { id: 'symbol-name', title: '地図記号《ちずきごう》を 見《み》て 名前《なまえ》が わかる' },
    { id: 'symbol-pick', title: '名前《なまえ》から 地図記号《ちずきごう》を えらべる' },
    { id: 'direction', title: '四方位《しほうい》と 八方位《はっぽうい》' },
    { id: 'town-map', title: '絵地図《えちず》で 方位《ほうい》と 場《ば》しょを 読《よ》む' },
  ],
  misconceptions: [
    {
      id: 'sym-circle',
      explain:
        'まるで かこむか どうかを 見《み》おとしたのかな。市役所《しやくしょ》（まる 二《ふた》つ）と 町村役場《ちょうそんやくば》（まる 一《ひと》つ）、高等学校《こうとうがっこう》と 学校《がっこう》、警察署《けいさつしょ》と 交番《こうばん》は、まるの ある・なし・数《かず》で 見《み》わけるよ。',
    },
    {
      id: 'sym-shape',
      explain:
        '形《かたち》の にた 記号《きごう》と まちがえたのかな。記号《きごう》の もとに なった もの（いねの かぶ、ふたば、とりい、歯車《はぐるま》 など）を 思《おも》い出《だ》して、ちがう ところを 一《ひと》つ さがそう。',
    },
    {
      id: 'sym-meaning',
      explain:
        'べつの たてものや 土地《とち》の 記号《きごう》と 入《い》れかわったのかな。その 場《ば》しょで つかう もの・する ことを 思《おも》いうかべると、記号《きごう》の 形《かたち》と むすびつくよ。',
    },
    {
      id: 'dir-opposite',
      explain:
        'はんたいの 方位《ほうい》を えらんだのかな。ちずは ふつう 上《うえ》が 北《きた》、下《した》が 南《みなみ》だよ。どこから 見《み》るのかを たしかめよう。',
    },
    {
      id: 'dir-east-west',
      explain:
        '東《ひがし》と 西《にし》が 入《い》れかわったのかな。北《きた》を 上《うえ》に すると、右《みぎ》が 東《ひがし》、左《ひだり》が 西《にし》だよ。',
    },
  ],
  levels: [
    { label: '四方位と みぢかな 記号', chance: 0.25 },
    { label: '八方位と 土地の 記号', chance: 0.25 },
    { label: '絵地図を 読む', chance: 0.12 },
  ],
  intro: [
    {
      text: 'ちずは ふつう 上《うえ》が 北《きた》。北《きた》を むいて 立《た》つと、右手《みぎて》が 東《ひがし》、左手《ひだりて》が 西《にし》、せなかが 南《みなみ》だよ。これを 四方位《しほうい》と いうよ。',
    },
    {
      text: '北《きた》と 東《ひがし》の あいだは 北東《ほくとう》、南《みなみ》と 西《にし》の あいだは 南西《なんせい》。ななめの 方位《ほうい》を 入《い》れると 八方位《はっぽうい》に なるよ。',
    },
    {
      text: '地図記号《ちずきごう》は、たてものや 土地《とち》の ようすを かんたんな 形《かたち》で あらわした しるしだよ。たとえば 田《た》は、いねを かりとった あとの かぶの 形《かたち》から できたよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）社会 第3学年 内容(1)（身近な地域や市区町村の様子。方位、主な地図記号）。小学校学習指導要領解説 社会編（四方位から入り八方位を扱う、地図記号の例）。記号は map エンジンの27種。絵地図は架空の町',
};
