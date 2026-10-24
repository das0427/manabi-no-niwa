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
    shape: 'まるが二《ふた》つかさなっているね。',
    origin: '二重《にじゅう》のまるは、市《し》の仕事《しごと》をするところのしるしだよ。',
    near: 'まるが一《ひと》つだけなら町《まち》や村《むら》の役場《やくば》だよ。二《ふた》つだと…？',
    others: ['town-office', 'police', 'post'],
  },
  {
    id: 'town-office',
    level: 0,
    shape: 'まるが一《ひと》つだけあるね。',
    origin: 'まる一《ひと》つは、町《まち》や村《むら》の仕事《しごと》をするところのしるしだよ。',
    near: 'まるが二《ふた》つなら市《し》の役所《やくしょ》。一《ひと》つなら…？',
    others: ['city-office', 'hospital', 'post'],
  },
  {
    id: 'school',
    level: 0,
    shape: '「文《ぶん》」という字《じ》の形《かたち》に見《み》えるね。',
    origin: '文《ぶん》や字《じ》を学《まな》ぶところ、といういみの形《かたち》だよ。',
    near: 'まるでかこまれていないね。小学校《しょうがっこう》や中学校《ちゅうがっこう》のしるしだよ。',
    others: ['high-school', 'library', 'museum'],
  },
  {
    id: 'high-school',
    level: 1,
    shape: '「文《ぶん》」の形《かたち》が、まるでかこまれているね。',
    origin:
      '「文《ぶん》」だけなら小学校《しょうがっこう》や中学校《ちゅうがっこう》。まるでかこむと…？',
    near: '中学校《ちゅうがっこう》を出《で》たあとに通《かよ》う学校《がっこう》だよ。',
    others: ['school', 'post', 'police'],
  },
  {
    id: 'police',
    level: 0,
    shape: '×《ばつ》の形《かたち》が、まるでかこまれているね。',
    origin: '×《ばつ》は、けいぼうを二《に》本《ほん》交《こう》ささせた形《かたち》だよ。',
    near: '×《ばつ》だけなら交番《こうばん》。まるでかこむと、もっと大《おお》きなところだよ。',
    others: ['koban', 'hospital', 'city-office'],
  },
  {
    id: 'koban',
    level: 0,
    shape: '×《ばつ》の形《かたち》だけで、まるがないね。',
    origin: '×《ばつ》は、けいぼうを二《に》本《ほん》交《こう》ささせた形《かたち》だよ。',
    near: 'まちかどにある、おまわりさんのいる小《ちい》さなたてものだよ。',
    others: ['police', 'fire', 'school'],
  },
  {
    id: 'fire',
    level: 0,
    shape: 'Y《ワイ》のような形《かたち》だね。',
    origin:
      'むかし火《ひ》をけすときにつかった「さすまた」という道具《どうぐ》の形《かたち》だよ。',
    near: '火《ひ》じをけしに行《い》く車《くるま》がいるところだよ。',
    others: ['koban', 'port', 'shrine'],
  },
  {
    id: 'post',
    level: 0,
    shape: 'まるの中《なか》に「〒」のしるしがあるね。',
    origin: '「〒」は、手紙《てがみ》や荷物《にもつ》をあつかうところのしるしだよ。',
    near: '手紙《てがみ》を出《だ》したり、切手《きって》を買《か》ったりするところだよ。',
    others: ['hospital', 'police', 'city-office'],
  },
  {
    id: 'hospital',
    level: 0,
    shape: 'まるの中《なか》に十字《じゅうじ》のしるしがあるね。',
    origin: '十字《じゅうじ》のしるしは、けがやびょうきの手《て》あてのしるしからできたよ。',
    near: 'びょうきやけがを見《み》てもらうところだよ。',
    others: ['post', 'police', 'elderly'],
  },
  {
    id: 'shrine',
    level: 0,
    shape: '門《もん》のような形《かたち》だね。',
    origin: '入《い》り口《ぐち》に立《た》つ「とりい」の形《かたち》だよ。',
    near: 'お祭《まつ》りやおまいりをする所《ところ》で、とりいがあるよ。',
    others: ['temple', 'castle', 'museum'],
  },
  {
    id: 'temple',
    level: 0,
    shape: '十字《じゅうじ》のはしが、まがっている形《かたち》だね。',
    origin: '「まんじ」というしるしの形《かたち》だよ。',
    near: 'おぼうさんがいるところだよ。',
    others: ['shrine', 'hospital', 'castle'],
  },
  {
    id: 'library',
    level: 0,
    shape: 'ひらいた本《ほん》の形《かたち》だね。',
    origin: '本《ほん》をひらいた形《かたち》からできた記号《きごう》だよ。',
    near: '本《ほん》をかりたり読《よ》んだりできるところだよ。',
    others: ['museum', 'school', 'elderly'],
  },
  {
    id: 'museum',
    level: 1,
    shape: '屋《や》根《ね》と柱《はしら》のあるたてものの形《かたち》だね。',
    origin:
      '昔《むかし》の物《もの》や、めずらしい物《もの》をならべて見《み》せる、たてものの形《かたち》だよ。',
    near: 'むかしの道具《どうぐ》や化《か》石《せき》などを見《み》に行《い》くところだよ。',
    others: ['library', 'elderly', 'shrine'],
  },
  {
    id: 'factory',
    level: 1,
    shape: 'ぎざぎざのわ（歯車《はぐるま》）の形《かたち》だね。',
    origin: 'きかいの歯車《はぐるま》の形《かたち》だよ。',
    near: '歯車《はぐるま》だけで、中《なか》はまるいあな。ものを作《つく》るところだよ。',
    others: ['power', 'lighthouse', 'orchard'],
  },
  {
    id: 'power',
    level: 1,
    shape: '歯車《はぐるま》の中《なか》に、線《せん》が入《はい》っているね。',
    origin:
      '歯車《はぐるま》と、電気《でんき》の回《かい》ろの線《せん》をあわせた形《かたち》だよ。',
    near: '電気《でんき》をつくるところだよ。',
    others: ['factory', 'lighthouse', 'fire'],
  },
  {
    id: 'rice',
    level: 1,
    shape: 'たての線《せん》が二《に》本《ほん》ならんでいるね。',
    origin: 'いねをかりとったあとの、かぶの形《かたち》だよ。',
    near: 'お米《こめ》をつくるところだよ。',
    others: ['field', 'tea', 'orchard'],
  },
  {
    id: 'field',
    level: 1,
    shape: '小《ちい》さなはっぱが二《に》まいひらいた形《かたち》だね。',
    origin: 'たねから出《で》た「ふたば」の形《かたち》だよ。',
    near: 'やさいなどを育《そだ》てるところだよ。',
    others: ['rice', 'tea', 'broadleaf'],
  },
  {
    id: 'orchard',
    level: 1,
    shape: 'まるに、じくが一《いっ》本《ぽん》ついているね。',
    origin: 'りんごやみかんなどの実《み》の形《かたち》だよ。',
    near: 'くだものの木《き》をそだてるところだよ。',
    others: ['tea', 'broadleaf', 'field'],
  },
  {
    id: 'tea',
    level: 1,
    shape: '小《ちい》さなまるが三《みっ》つならんでいるね。',
    origin: 'お茶《ちゃ》の木《き》の実《み》の形《かたち》だよ。',
    near: '飲《の》み物《もの》にする葉《は》っぱを育《そだ》てるところだよ。',
    others: ['orchard', 'field', 'rice'],
  },
  {
    id: 'broadleaf',
    level: 1,
    shape:
      'まるいあたまに、みきが一《いっ》本《ぽん》。木《き》を横《よこ》から見《み》た形《かたち》だね。',
    origin: 'さくらやけやきのような、はばの広《ひろ》いはっぱの木《き》の形《かたち》だよ。',
    near: 'はっぱのはばが広《ひろ》い木《き》が多《おお》い林《はやし》だよ。',
    others: ['conifer', 'orchard', 'field'],
  },
  {
    id: 'conifer',
    level: 1,
    shape: 'とがった山《やま》の形《かたち》に、みきが通《とお》っているね。',
    origin: 'すぎやまつのような、細《ほそ》いはっぱの木《き》の形《かたち》だよ。',
    near: 'はりのように細《ほそ》いはっぱの木《き》が多《おお》い林《はやし》だよ。',
    others: ['broadleaf', 'shrine', 'field'],
  },
  {
    id: 'elderly',
    level: 1,
    shape: 'たてものの中《なか》に、つえがあるね。',
    origin: 'たてものと、お年《とし》よりのつえをあわせた形《かたち》だよ。',
    near: 'お年《とし》よりがくらしたり、世話《せわ》をうけたりするところだよ。',
    others: ['hospital', 'museum', 'library'],
  },
  {
    id: 'onsen',
    level: 1,
    shape: 'おわんのような形《かたち》から、ゆげが三《みっ》つ立《た》っているね。',
    origin: 'おゆがわき出《で》て、ゆげが立《た》つようすの形《かたち》だよ。',
    near: 'あたたかいおゆがわき出《で》るところだよ。',
    others: ['port', 'lighthouse', 'field'],
  },
  {
    id: 'castle',
    level: 1,
    shape: 'でこぼこのある四角《しかく》の形《かたち》だね。',
    origin: 'むかしのおしろを作《つく》ったときの、くぎりの線《せん》の形《かたち》だよ。',
    near: 'むかし、おしろがあったところだよ。',
    others: ['museum', 'temple', 'station'],
  },
  {
    id: 'lighthouse',
    level: 1,
    shape: 'まるから、光《ひかり》が八《はっ》方《ぽう》へ出《で》ている形《かたち》だね。',
    origin:
      '光《ひかり》を出《だ》して、夜《よる》の船《ふね》に場《ば》しょを知《し》らせるものの形《かたち》だよ。',
    near: '海《うみ》のそばに立《た》って、夜《よる》に光《ひか》るたてものだよ。',
    others: ['factory', 'port', 'onsen'],
  },
  {
    id: 'port',
    level: 1,
    shape: '船《ふね》をとめる「いかり」の形《かたち》だね。',
    origin: '船《ふね》がとまるときにおろす「いかり」の形《かたち》だよ。',
    near: '船《ふね》が出《で》たり入《はい》ったりするところだよ。',
    others: ['lighthouse', 'onsen', 'fire'],
  },
  {
    id: 'station',
    level: 0,
    shape: '長《なが》い四角《しかく》のまん中《なか》に線《せん》があるね。',
    origin: '線《せん》ろの上《うえ》にある、電車《でんしゃ》がとまるところのしるしだよ。',
    near: '電車《でんしゃ》に乗《の》ったり、おりたりする所《ところ》だよ。',
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
    prompt: 'この地図記号《ちずきごう》は何《なに》をあらわしているかな。',
    task: { kind: 'symbol', ask: 'name', symbol: s.id, options: [s.id, ...s.others] },
    wrongAnswers: s.others.map((o) => ({ value: o, misconception: misOf(s.id, o) })),
    hints: [s.shape, s.origin, s.near],
    explain: `${NAME[s.id]}の記号《きごう》だよ。${s.origin}`,
  }),
);

const pickItems: MapItem[] = SYMS.map((s) =>
  mapItem({
    id: `pick-${s.id}`,
    obj: 'symbol-pick',
    level: s.level,
    prompt: `${NAME[s.id]}の地図記号《ちずきごう》はどれかな。`,
    task: { kind: 'symbol', ask: 'pick', symbol: s.id, options: [s.id, ...s.others] },
    wrongAnswers: s.others.map((o) => ({ value: o, misconception: misOf(s.id, o) })),
    hints: [
      'そのたてものや場《ば》しょにあるもの・道具《どうぐ》を思《おも》いうかべよう。',
      s.origin,
      s.shape,
    ],
    explain: `${NAME[s.id]}の記号《きごう》は、${s.origin}`,
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
      'むかし火《ひ》をけすときにつかった「さすまた」の形《かたち》からできた地図記号《ちずきごう》はどれかな。',
    right: 'fire',
    wrongs: ['koban', 'port', 'shrine'],
    explain: '消防署《しょうぼうしょ》の記号《きごう》は、さすまたの形《かたち》からできたよ。',
  },
  {
    id: 'o2',
    level: 1,
    prompt:
      'いねをかり取《と》ったあとの、かぶの形《かたち》からできた地図記号《ちずきごう》はどれかな。',
    right: 'rice',
    wrongs: ['field', 'tea', 'orchard'],
    explain: '田《た》の記号《きごう》は、いねをかり取《と》ったあとの、かぶの形《かたち》だよ。',
  },
  {
    id: 'o3',
    level: 1,
    prompt:
      'たねから出《で》た「ふたば」の形《かたち》からできた地図記号《ちずきごう》はどれかな。',
    right: 'field',
    wrongs: ['rice', 'broadleaf', 'tea'],
    explain: '畑《はたけ》の記号《きごう》は、ふたばの形《かたち》だよ。',
  },
  {
    id: 'o4',
    level: 1,
    prompt: 'きかいの歯車《はぐるま》の形《かたち》だけでできた地図記号《ちずきごう》はどれかな。',
    right: 'factory',
    wrongs: ['power', 'lighthouse', 'castle'],
    explain:
      '工場《こうじょう》の記号《きごう》は歯車《はぐるま》の形《かたち》。歯車《はぐるま》に電気《でんき》の線《せん》が入《はい》ると発電所《はつでんしょ》だよ。',
  },
  {
    id: 'o5',
    level: 0,
    prompt:
      '入《い》り口《ぐち》に立《た》つ「とりい」の形《かたち》からできた地図記号《ちずきごう》はどれかな。',
    right: 'shrine',
    wrongs: ['temple', 'castle', 'museum'],
    explain:
      '神社《じんじゃ》の記号《きごう》は、とりいの形《かたち》だよ。寺《てら》は「まんじ」の形《かたち》だね。',
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
      'その形《かたち》のものが、どこでつかわれているか考《かんが》えよう。',
      'そのものをつかう人《ひと》やしごとを思《おも》いうかべよう。',
      'しごとと場《ば》しょをむすびつけよう。',
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
  n: '上《うえ》のほうへ、まっすぐ進《すす》もう。',
  e: '右《みぎ》のほうへ、まっすぐ進《すす》もう。',
  s: '下《した》のほうへ、まっすぐ進《すす》もう。',
  w: '左《ひだり》のほうへ、まっすぐ進《すす》もう。',
  ne: '上《うえ》と右《みぎ》の間《あいだ》の、ななめへ進《すす》もう。',
  se: '下《した》と右《みぎ》の間《あいだ》の、ななめへ進《すす》もう。',
  sw: '下《した》と左《ひだり》の間《あいだ》の、ななめへ進《すす》もう。',
  nw: '上《うえ》と左《ひだり》の間《あいだ》の、ななめへ進《すす》もう。',
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
    prompt: `${center.label}の${DIR_WORD[q.dir]}にある地図記号《ちずきごう》をタップしよう。`,
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
      'ちずの方位《ほうい》のしるしを見《み》よう。ふつう上《うえ》が北《きた》だよ。',
      `${center.label}から${DIR_HINT[q.dir]}`,
      `${center.label}のすぐそばではなく、ちずのはしのほうの記号《きごう》だよ。`,
    ],
    explain: `${center.label}の${DIR_WORD[q.dir]}には、${NAME[ans.symbol]}があるよ。`,
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
    prompt: `この絵地図《えちず》で、${NAME[q.symbol]}はどこかな。タップしよう。`,
    task: {
      kind: 'town',
      size: [5, 5],
      places: t.places,
      roads: ROADS,
      answer: t.places.findIndex((p) => p.symbol === q.symbol),
    },
    hints: [s.origin, s.shape, 'ちずの記号《きごう》を一《ひと》つずつたしかめよう。'],
    explain: `${NAME[q.symbol]}の記号《きごう》は、${s.origin}`,
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
  ne: '北《きた》と東《ひがし》',
  se: '南《みなみ》と東《ひがし》',
  sw: '南《みなみ》と西《にし》',
  nw: '北《きた》と西《にし》',
};
const compassItems: MapItem[] = COMPASS.map((c) => {
  const diag = DIAG_PARTS[c.dir];
  return mapItem({
    id: `compass-${c.ask}-${c.dir}-${c.points}`,
    obj: 'direction',
    level: c.level,
    prompt:
      c.ask === 'name'
        ? 'やじるしのさしている方位《ほうい》はどれかな。'
        : `${DIR_WORD[c.dir]}はどこかな。ふだをタップしよう。`,
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
          'まず北《きた》がどこかをたしかめよう。',
          '八方位《はっぽうい》は、四方位《しほうい》のあいだにななめの方位《ほうい》が入《はい》るよ。',
          '二《ふた》つの方位《ほうい》のあいだの名前《なまえ》は、北《きた》か南《みなみ》を先《さき》に言《い》うよ。',
        ]
      : [
          'まず北《きた》がどこかをたしかめよう。',
          '北《きた》をむいて立《た》つと、右手《みぎて》が東《ひがし》、左手《ひだりて》が西《にし》、せなかが南《みなみ》だよ。',
          '北《きた》から時計《とけい》のはりのむきに、東《ひがし》・南《みなみ》・西《にし》のじゅんにならぶよ。',
        ],
    explain: diag
      ? `${DIR_WORD[c.dir]}は、${diag}のあいだの方位《ほうい》だよ。`
      : `${DIR_WORD[c.dir]}だよ。北《きた》から時計《とけい》まわりに、北《きた》・東《ひがし》・南《みなみ》・西《にし》とならぶよ。`,
  });
});

/** 別例（direction）: 体の向きと方位（文で答える） */
const bodyItems: ChoiceItem[] = [
  choiceItem({
    id: 'body-1',
    obj: 'direction',
    level: 0,
    alt: true,
    prompt: '北《きた》をむいて立《た》ったよ。右手《みぎて》のほうはどの方位《ほうい》かな。',
    right: '東《ひがし》',
    wrongs: [
      ['西《にし》', 'dir-east-west'],
      ['南《みなみ》', 'dir-opposite'],
      ['北《きた》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '北《きた》をむいた体《からだ》を思《おも》いうかべよう。',
      '左手《ひだりて》は西《にし》、せなかは南《みなみ》だよ。',
      'のこりの方位《ほうい》が右手《みぎて》だよ。',
    ],
    explain: '北《きた》をむくと、右手《みぎて》が東《ひがし》、左手《ひだりて》が西《にし》だよ。',
  }),
  choiceItem({
    id: 'body-2',
    obj: 'direction',
    level: 0,
    alt: true,
    prompt:
      '朝《あさ》、太陽《たいよう》の出《で》るほうをむいて立《た》ったよ。せなかのほうはどの方位《ほうい》かな。',
    right: '西《にし》',
    wrongs: [
      ['東《ひがし》', 'dir-opposite'],
      ['北《きた》', 'dir-east-west'],
      ['南《みなみ》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '太陽《たいよう》は朝《あさ》、どの方位《ほうい》から出《で》るかな。',
      '朝《あさ》の太陽《たいよう》は東《ひがし》の空《そら》に見《み》えるよ。',
      'むいている方位《ほうい》のはんたいが、せなかのほうだよ。',
    ],
    explain:
      '朝《あさ》の太陽《たいよう》は東《ひがし》に見《み》えるので、せなかのほうははんたいの西《にし》だよ。',
  }),
  choiceItem({
    id: 'body-3',
    obj: 'direction',
    level: 1,
    alt: true,
    prompt: '南《みなみ》をむいて立《た》ったよ。右手《みぎて》のほうはどの方位《ほうい》かな。',
    right: '西《にし》',
    wrongs: [
      ['東《ひがし》', 'dir-east-west'],
      ['北《きた》', 'dir-opposite'],
      ['南《みなみ》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '南《みなみ》をむくと、北《きた》をむいたときと右《みぎ》と左《ひだり》が入《い》れかわるよ。',
      '北《きた》をむいたときの右手《みぎて》は東《ひがし》だったね。',
      'そのはんたいの方位《ほうい》を考《かんが》えよう。',
    ],
    explain:
      '南《みなみ》をむくと、右手《みぎて》が西《にし》、左手《ひだりて》が東《ひがし》だよ。',
  }),
  choiceItem({
    id: 'body-4',
    obj: 'direction',
    level: 1,
    alt: true,
    prompt: '北《きた》と西《にし》のちょうどあいだの方位《ほうい》の名前《なまえ》はどれかな。',
    right: '北西《ほくせい》',
    wrongs: [
      ['北東《ほくとう》', 'dir-east-west'],
      ['南東《なんとう》', 'dir-opposite'],
      ['南西《なんせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      'ななめの方位《ほうい》は、二《ふた》つの方位《ほうい》をあわせた名前《なまえ》だよ。',
      '北《きた》か南《みなみ》を先《さき》に言《い》うよ。',
      '「北《きた》」と「西《にし》」をあわせよう。',
    ],
    explain: '北《きた》と西《にし》のあいだは北西《ほくせい》だよ。',
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
      '図書館《としょかん》は駅《えき》の北《きた》にあるよ。図書館《としょかん》から見《み》ると、駅《えき》はどの方位《ほうい》かな。',
    right: '南《みなみ》',
    wrongs: [
      ['北《きた》', 'dir-opposite'],
      ['東《ひがし》', 'dir-east-west'],
      ['西《にし》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '駅《えき》と図書館《としょかん》を、ちずの上《うえ》においてみよう。',
      '図書館《としょかん》は駅《えき》の上《うえ》のほう（北《きた》）だね。',
      'こんどは図書館《としょかん》から駅《えき》を見《み》るよ。見《み》る場《ば》しょが入《い》れかわると方位《ほうい》ははんたいになるよ。',
    ],
    explain:
      'AがBの北《きた》にあるとき、Aから見《み》た Bは南《みなみ》だよ。だから駅《えき》は図書館《としょかん》の南《みなみ》。',
  }),
  choiceItem({
    id: 'rel-2',
    obj: 'town-map',
    level: 1,
    alt: true,
    prompt:
      '学校《がっこう》から東《ひがし》へ歩《ある》くと公園《こうえん》、公園《こうえん》から北《きた》へ歩《ある》くと神社《じんじゃ》があるよ。学校《がっこう》から見《み》て、神社《じんじゃ》はどの方位《ほうい》かな。',
    right: '北東《ほくとう》',
    wrongs: [
      ['北西《ほくせい》', 'dir-east-west'],
      ['南西《なんせい》', 'dir-opposite'],
      ['南東《なんとう》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '紙《かみ》に学校《がっこう》をかいて、道《みち》をじゅんにたどろう。',
      '東《ひがし》へすすんで、そこから北《きた》へすすむよ。',
      '北《きた》のほうで、しかも東《ひがし》のほうにあるね。二《ふた》つをあわせた方位《ほうい》だよ。',
    ],
    explain:
      '東《ひがし》へ行《い》って北《きた》へ行《い》くので、神社《じんじゃ》は学校《がっこう》の北東《ほくとう》にあるよ。',
  }),
  choiceItem({
    id: 'rel-3',
    obj: 'town-map',
    level: 2,
    alt: true,
    prompt:
      '駅《えき》の西《にし》に交番《こうばん》、交番《こうばん》の南《みなみ》に病院《びょういん》があるよ。駅《えき》から見《み》て、病院《びょういん》はどの方位《ほうい》かな。',
    right: '南西《なんせい》',
    wrongs: [
      ['南東《なんとう》', 'dir-east-west'],
      ['北東《ほくとう》', 'dir-opposite'],
      ['北西《ほくせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '駅《えき》をまん中《なか》において、じゅんにたどろう。',
      '駅《えき》から左《ひだり》（西《にし》）へ、そこから下《した》（南《みなみ》）へすすむよ。',
      '南《みなみ》のほうで、しかも西《にし》のほうだね。南《みなみ》を先《さき》に言《い》うよ。',
    ],
    explain:
      '西《にし》へ行《い》って南《みなみ》へ行《い》くので、病院《びょういん》は駅《えき》の南西《なんせい》だよ。',
  }),
  choiceItem({
    id: 'rel-4',
    obj: 'town-map',
    level: 2,
    alt: true,
    prompt:
      '市役所《しやくしょ》の南東《なんとう》に郵便局《ゆうびんきょく》があるよ。郵便局《ゆうびんきょく》から見《み》ると、市役所《しやくしょ》はどの方位《ほうい》かな。',
    right: '北西《ほくせい》',
    wrongs: [
      ['南東《なんとう》', 'dir-opposite'],
      ['北東《ほくとう》', 'dir-east-west'],
      ['南西《なんせい》', 'dir-east-west'],
    ],
    layout: 'grid',
    hints: [
      '二《ふた》つの場《ば》しょを、ちずの上《うえ》においてみよう。',
      '郵便局《ゆうびんきょく》は市役所《しやくしょ》の右下《みぎした》のななめにあるね。',
      '見《み》る場《ば》しょが入《い》れかわると、方位《ほうい》ははんたいになるよ。',
    ],
    explain:
      '南東《なんとう》のはんたいは北西《ほくせい》。郵便局《ゆうびんきょく》から見《み》ると、市役所《しやくしょ》は北西《ほくせい》だよ。',
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
  title: '方位《ほうい》と地図記号《ちずきごう》',
  kind: 'knowledge',
  review: 'item',
  prereq: ['g2.life.town'],
  objectives: [
    { id: 'symbol-name', title: '地図記号《ちずきごう》を見《み》て名前《なまえ》がわかる' },
    { id: 'symbol-pick', title: '名前《なまえ》から地図記号《ちずきごう》をえらべる' },
    { id: 'direction', title: '四方位《しほうい》と八方位《はっぽうい》' },
    { id: 'town-map', title: '絵地図《えちず》で方位《ほうい》と場《ば》しょを読《よ》む' },
  ],
  misconceptions: [
    {
      id: 'sym-circle',
      explain:
        'まるでかこむかどうかを見《み》おとしたのかな。市役所《しやくしょ》（まる二《ふた》つ）と町村役場《ちょうそんやくば》（まる一《ひと》つ）、高等学校《こうとうがっこう》と学校《がっこう》、警察署《けいさつしょ》と交番《こうばん》は、まるのある・なし・数《かず》で見《み》わけるよ。',
    },
    {
      id: 'sym-shape',
      explain:
        '形《かたち》のにた記号《きごう》とまちがえたのかな。記号《きごう》のもとになったもの（いねのかぶ、ふたば、とりい、歯車《はぐるま》など）を思《おも》い出《だ》して、ちがうところを一《ひと》つさがそう。',
    },
    {
      id: 'sym-meaning',
      explain:
        'べつのたてものや土地《とち》の記号《きごう》と入《い》れかわったのかな。その場《ば》しょでつかうもの・することを思《おも》いうかべると、記号《きごう》の形《かたち》とむすびつくよ。',
    },
    {
      id: 'dir-opposite',
      explain:
        'はんたいの方位《ほうい》をえらんだのかな。ちずはふつう上《うえ》が北《きた》、下《した》が南《みなみ》だよ。どこから見《み》るのかをたしかめよう。',
    },
    {
      id: 'dir-east-west',
      explain:
        '東《ひがし》と西《にし》が入《い》れかわったのかな。北《きた》を上《うえ》にすると、右《みぎ》が東《ひがし》、左《ひだり》が西《にし》だよ。',
    },
  ],
  levels: [
    { label: '四方位とみぢかな記号', chance: 0.25 },
    { label: '八方位と土地の記号', chance: 0.25 },
    { label: '絵地図を読む', chance: 0.12 },
  ],
  intro: [
    {
      text: 'ちずはふつう上《うえ》が北《きた》。北《きた》をむいて立《た》つと、右手《みぎて》が東《ひがし》、左手《ひだりて》が西《にし》、せなかが南《みなみ》だよ。これを四方位《しほうい》というよ。',
    },
    {
      text: '北《きた》と東《ひがし》のあいだは北東《ほくとう》、南《みなみ》と西《にし》のあいだは南西《なんせい》。ななめの方位《ほうい》を入《い》れると八方位《はっぽうい》になるよ。',
    },
    {
      text: '地図記号《ちずきごう》は、たてものや土地《とち》のようすをかんたんな形《かたち》であらわしたしるしだよ。たとえば田《た》は、いねをかり取《と》ったあとの、かぶの形《かたち》からできたよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）社会第3学年内容(1)（身近な地域や市区町村の様子。方位、主な地図記号）。小学校学習指導要領解説社会編（四方位から入り八方位を扱う、地図記号の例）。記号は map エンジンの27種。絵地図は架空の町',
};
