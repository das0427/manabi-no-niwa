/**
 * g4.soc.prefectures 47都道府県の名前と位置・地方・県庁所在地・八方位（curriculum-matrix 3.7、社会 第4学年 内容(1)）。
 *
 * 地図は map エンジンが描く（Natural Earth を簡略化したもの）。パックはエンジンのデータを値で import できないので、
 * 都道府県のコード・名前・地方・県庁所在地・ピンの位置（map/data/japan.json の label と同じ値。方位のヒントに使う）を
 * ここに持つ。方位の答えはエンジンがピンの位置で測る（境目から 10度以上はなれた組だけを使う）。
 *
 * 到達項目:
 *   region   … 都道府県の地方（map region）。別例 = 地方の県をぜんぶタップ（map find）
 *   position … 名前の都道府県を地図でタップ（地方の図）。別例 = 全国の図でタップ
 *   name     … 印の都道府県の名前を選ぶ。別例 = 漢字の名前を読む（nameStyle kanji）・かなのタイルで入れる（spell）
 *   capital  … 県庁所在地（県名と名前がちがう18道県）。別例 = 市から県を選ぶ・名前が同じ県を選ぶ
 *   bearing  … 八方位（県から見た県の方位）。別例 = 方位から県を選ぶ（choice）
 * 同一性キー: 問題の id（項目 × 問い方）。
 * 字: 都道府県名の字（茨・岐・阜 など）は4年の配当なので《よみ》付きで使う。県庁所在地・地方の名前で5年以上・
 * 配当外の字は固有名詞として《よみ》付き（prefecturesAllow）。常用漢字表にない字（札幌の「幌」）はかなで書く。
 */
import type { Item, MapItem, UnitSpec } from '../../curriculum/types';
import type { MapView, RegionId } from '../../engines/map/map';
import { baseSoc, choiceItem, mapItem, type Allow } from './util';

type Dir8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const DIRS: Dir8[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const DIR_NAME: Record<Dir8, string> = {
  n: '北《きた》',
  ne: '北東《ほくとう》',
  e: '東《ひがし》',
  se: '南東《なんとう》',
  s: '南《みなみ》',
  sw: '南西《なんせい》',
  w: '西《にし》',
  nw: '北西《ほくせい》',
};

interface P {
  code: number;
  base: string;
  yomi: string;
  suffix: string;
  suffixYomi: string;
  region: RegionId;
  /** 県庁所在地（RichText。東京都は扱わないので null） */
  capital: string | null;
  label: [number, number];
}

const p = (
  code: number,
  base: string,
  yomi: string,
  suffix: '県' | '府' | '都' | '',
  region: RegionId,
  capital: string | null,
  x: number,
  y: number,
): P => ({
  code,
  base,
  yomi,
  suffix,
  suffixYomi: { 県: 'けん', 府: 'ふ', 都: 'と', '': '' }[suffix],
  region,
  capital,
  label: [x, y],
});

/** 同じ名前の市が県庁所在地 */
const same = (base: string, yomi: string) => `${base}《${yomi}》市《し》`;

const PREFS: P[] = [
  p(1, '北海道', 'ほっかいどう', '', 'hokkaido', 'さっぽろ市《し》', 685, 138),
  p(2, '青森', 'あおもり', '県', 'tohoku', same('青森', 'あおもり'), 607, 309),
  p(3, '岩手', 'いわて', '県', 'tohoku', '盛岡《もりおか》市《し》', 618, 373),
  p(4, '宮城', 'みやぎ', '県', 'tohoku', '仙台《せんだい》市《し》', 596, 430),
  p(5, '秋田', 'あきた', '県', 'tohoku', same('秋田', 'あきた'), 570, 344),
  p(6, '山形', 'やまがた', '県', 'tohoku', same('山形', 'やまがた'), 559, 430),
  p(7, '福島', 'ふくしま', '県', 'tohoku', same('福島', 'ふくしま'), 576, 502),
  p(8, '茨城', 'いばらき', '県', 'kanto', '水戸《みと》市《し》', 562, 577),
  p(9, '栃木', 'とちぎ', '県', 'kanto', '宇都宮《うつのみや》市《し》', 544, 542),
  p(10, '群馬', 'ぐんま', '県', 'kanto', '前橋《まえばし》市《し》', 501, 555),
  p(11, '埼玉', 'さいたま', '県', 'kanto', 'さいたま市《し》', 523, 586),
  p(12, '千葉', 'ちば', '県', 'kanto', same('千葉', 'ちば'), 560, 624),
  p(13, '東京', 'とうきょう', '都', 'kanto', null, 520, 605),
  p(14, '神奈川', 'かながわ', '県', 'kanto', '横浜《よこはま》市《し》', 516, 619),
  p(15, '新潟', 'にいがた', '県', 'chubu', same('新潟', 'にいがた'), 515, 482),
  p(16, '富山', 'とやま', '県', 'chubu', same('富山', 'とやま'), 411, 549),
  p(17, '石川', 'いしかわ', '県', 'chubu', '金沢《かなざわ》市《し》', 388, 566),
  p(18, '福井', 'ふくい', '県', 'chubu', same('福井', 'ふくい'), 376, 587),
  p(19, '山梨', 'やまなし', '県', 'chubu', '甲府《こうふ》市《し》', 491, 608),
  p(20, '長野', 'ながの', '県', 'chubu', same('長野', 'ながの'), 458, 574),
  p(21, '岐阜', 'ぎふ', '県', 'chubu', same('岐阜', 'ぎふ'), 412, 607),
  p(22, '静岡', 'しずおか', '県', 'chubu', same('静岡', 'しずおか'), 458, 648),
  p(23, '愛知', 'あいち', '県', 'chubu', '名古屋《なごや》市《し》', 426, 644),
  p(24, '三重', 'みえ', '県', 'kinki', '津《つ》市《し》', 375, 662),
  p(25, '滋賀', 'しが', '県', 'kinki', '大津《おおつ》市《し》', 368, 638),
  p(26, '京都', 'きょうと', '府', 'kinki', same('京都', 'きょうと'), 343, 636),
  p(27, '大阪', 'おおさか', '府', 'kinki', same('大阪', 'おおさか'), 338, 678),
  p(28, '兵庫', 'ひょうご', '県', 'kinki', '神戸《こうべ》市《し》', 303, 642),
  p(29, '奈良', 'なら', '県', 'kinki', same('奈良', 'なら'), 353, 701),
  p(30, '和歌山', 'わかやま', '県', 'kinki', same('和歌山', 'わかやま'), 332, 709),
  p(31, '鳥取', 'とっとり', '県', 'chugoku', same('鳥取', 'とっとり'), 280, 623),
  p(32, '島根', 'しまね', '県', 'chugoku', '松江《まつえ》市《し》', 214, 628),
  p(33, '岡山', 'おかやま', '県', 'chugoku', same('岡山', 'おかやま'), 254, 650),
  p(34, '広島', 'ひろしま', '県', 'chugoku', same('広島', 'ひろしま'), 218, 665),
  p(35, '山口', 'やまぐち', '県', 'chugoku', same('山口', 'やまぐち'), 147, 692),
  p(36, '徳島', 'とくしま', '県', 'shikoku', same('徳島', 'とくしま'), 280, 712),
  p(37, '香川', 'かがわ', '県', 'shikoku', '高松《たかまつ》市《し》', 265, 691),
  p(38, '愛媛', 'えひめ', '県', 'shikoku', '松山《まつやま》市《し》', 215, 719),
  p(39, '高知', 'こうち', '県', 'shikoku', same('高知', 'こうち'), 234, 728),
  p(40, '福岡', 'ふくおか', '県', 'kyushu', same('福岡', 'ふくおか'), 110, 727),
  p(41, '佐賀', 'さが', '県', 'kyushu', same('佐賀', 'さが'), 78, 748),
  p(42, '長崎', 'ながさき', '県', 'kyushu', same('長崎', 'ながさき'), 62, 749),
  p(43, '熊本', 'くまもと', '県', 'kyushu', same('熊本', 'くまもと'), 120, 776),
  p(44, '大分', 'おおいた', '県', 'kyushu', same('大分', 'おおいた'), 148, 762),
  p(45, '宮崎', 'みやざき', '県', 'kyushu', same('宮崎', 'みやざき'), 139, 798),
  p(46, '鹿児島', 'かごしま', '県', 'kyushu', same('鹿児島', 'かごしま'), 99, 832),
  p(47, '沖縄', 'おきなわ', '県', 'kyushu', '那覇《なは》市《し》', 251, 183),
];
const BY = new Map(PREFS.map((x) => [x.code, x]));
const pr = (c: number) => BY.get(c)!;
const OKINAWA = 47;

/** 名前（RichText） */
const nm = (c: number) => {
  const x = pr(c);
  return `${x.base}《${x.yomi}》${x.suffix ? `${x.suffix}《${x.suffixYomi}》` : ''}`;
};

const REGION_NAME: Record<RegionId, string> = {
  hokkaido: '北海道《ほっかいどう》地方《ちほう》',
  tohoku: '東北《とうほく》地方《ちほう》',
  kanto: '関東《かんとう》地方《ちほう》',
  chubu: '中部《ちゅうぶ》地方《ちほう》',
  kinki: '近畿《きんき》地方《ちほう》',
  chugoku: '中国《ちゅうごく》地方《ちほう》',
  shikoku: '四国《しこく》地方《ちほう》',
  kyushu: '九州《きゅうしゅう》地方《ちほう》',
};
const REGION_IDS = Object.keys(REGION_NAME) as RegionId[];

// ---- 位置の計算（ピンの位置。map/japan.ts の bearingDeg・dirOf と同じ式） ----
function bearing(a: [number, number], b: [number, number]): { dir: Dir8; margin: number } {
  const deg = ((Math.atan2(b[0] - a[0], a[1] - b[1]) * 180) / Math.PI + 360) % 360;
  const k = Math.round(deg / 45) % 8;
  let off = Math.abs(deg - k * 45);
  if (off > 180) off = 360 - off;
  return { dir: DIRS[k]!, margin: 22.5 - off };
}
const dist = (a: P, b: P) => Math.hypot(a.label[0] - b.label[0], a.label[1] - b.label[1]);

/** 同じ地方の、近い順の都道府県（沖縄は囲みにあるので除く） */
function nearbyInRegion(c: number): number[] {
  const me = pr(c);
  return PREFS.filter((x) => x.region === me.region && x.code !== c && x.code !== OKINAWA)
    .sort((a, b) => dist(me, a) - dist(me, b))
    .map((x) => x.code);
}
/** 近い順の都道府県（全国。沖縄を除く） */
function nearbyAll(c: number): number[] {
  const me = pr(c);
  return PREFS.filter((x) => x.code !== c && x.code !== OKINAWA)
    .sort((a, b) => dist(me, a) - dist(me, b))
    .map((x) => x.code);
}

/** 地方の中での位置のヒント（「地方の 北の ほう」など） */
function whereInRegion(c: number): string {
  const me = pr(c);
  const rs = PREFS.filter((x) => x.region === me.region && x.code !== OKINAWA);
  if (rs.length < 2) return '';
  const cx = rs.reduce((s, x) => s + x.label[0], 0) / rs.length;
  const cy = rs.reduce((s, x) => s + x.label[1], 0) / rs.length;
  if (Math.hypot(me.label[0] - cx, me.label[1] - cy) < 18)
    return `${REGION_NAME[me.region]}の まん中《なか》の あたりだよ。`;
  const b = bearing([cx, cy], me.label);
  return `${REGION_NAME[me.region]}の 中《なか》で ${DIR_NAME[b.dir]}の ほうに あるよ。`;
}

/** 近くの県から見た方位のヒント（境目に近いものは使わない） */
function nearHint(c: number): string {
  if (c === OKINAWA)
    return '九州《きゅうしゅう》の 南《みなみ》に つづく 島《しま》じまの 県《けん》だよ。';
  for (const o of [...nearbyInRegion(c), ...nearbyAll(c)]) {
    const b = bearing(pr(o).label, pr(c).label);
    if (b.margin >= 8) return `${nm(o)}の ${DIR_NAME[b.dir]}に あるよ。`;
  }
  return '';
}

/** 地図の範囲（北海道・沖縄は全国の図。ほかは地方の図） */
const viewOf = (c: number): MapView => (c === 1 || c === OKINAWA ? 'japan' : pr(c).region);

const MAP_MIS = {
  neighbor: 'mis-neighbor',
  sameRegion: 'mis-same-region',
} as const;
const DIR_MIS = { opposite: 'mis-opposite', mirrorEW: 'mis-east-west' } as const;

/** 4つの選択肢（正解＋近くの3つ） */
function nameOptions(c: number): number[] {
  if (c === OKINAWA) return [47, 46, 45, 43];
  const near = nearbyInRegion(c);
  const pool =
    near.length >= 3 ? near : [...near, ...nearbyAll(c).filter((x) => !near.includes(x))];
  return [c, ...pool.slice(0, 3)];
}

const firstKana = (c: number) => pr(c).yomi[0]!;

// ---- region ----
const regionItems: MapItem[] = PREFS.map((x) => {
  const others = REGION_IDS.filter((r) => r !== x.region);
  // まちがえやすい となりの地方を先に
  const near = nearbyAll(x.code)
    .map((o) => pr(o).region)
    .filter((r, i, a) => r !== x.region && a.indexOf(r) === i);
  const opts = [
    x.region,
    ...[...near, ...others].filter((r, i, a) => a.indexOf(r) === i).slice(0, 3),
  ];
  const sameReg = nearbyInRegion(x.code)[0];
  const h3 =
    x.code === 1
      ? '1つの 道《どう》だけで できて いる 地方《ちほう》だよ。'
      : x.code === OKINAWA
        ? `${nm(46)}と 同《おな》じ 地方《ちほう》だよ。`
        : `${nm(sameReg!)}と 同《おな》じ 地方《ちほう》だよ。`;
  return mapItem({
    id: `region-${x.code}`,
    obj: 'region',
    level: 0,
    prompt: `しるしの ついた ${nm(x.code)}は、どの 地方《ちほう》かな？`,
    task: { kind: 'region', pref: x.code, options: opts, showRegions: true },
    wrongAnswers: opts.slice(1).map((r) => ({ value: r, misconception: 'mis-region' })),
    hints: [
      'ちずの もようと ばんごうを 見《み》よう。',
      'しるしの 県《けん》と 同《おな》じ もようの ふだを さがそう。',
      h3,
    ],
    explain: `${nm(x.code)}は ${REGION_NAME[x.region]}だよ。`,
  });
});

const regionAlts: MapItem[] = REGION_IDS.map((r) => {
  const codes = PREFS.filter((x) => x.region === r && x.code !== OKINAWA).map((x) => x.code);
  const isKyushu = r === 'kyushu';
  return mapItem({
    id: `region-all-${r}`,
    obj: 'region',
    level: 1,
    alt: true,
    prompt:
      r === 'hokkaido'
        ? '北海道《ほっかいどう》地方《ちほう》を タップしよう。'
        : isKyushu
          ? '九州《きゅうしゅう》地方《ちほう》の うち、九州《きゅうしゅう》の 島《しま》に ある 7つの 県《けん》を ぜんぶ タップしよう。'
          : `${REGION_NAME[r]}の 都道府県《とどうふけん》を ぜんぶ タップしよう。`,
    task: { kind: 'find', prefs: codes, view: r === 'hokkaido' ? 'japan' : r },
    misconceptions: { missing: 'mis-missing', sameRegion: 'mis-region' },
    hints: [
      `${REGION_NAME[r]}は ${codes.length}つの 都道府県《とどうふけん》で できて いるよ。`,
      `${REGION_NAME[r]}の さかいめを 目《め》で たどろう。`,
      `${nm(codes[0]!)}から はじめて、となりを じゅんに タップしよう。`,
    ],
    explain: `${REGION_NAME[r]}は ${codes.map(nm).join('・')}だよ。${isKyushu ? '九州地方《きゅうしゅうちほう》には、ほかに 沖縄県《おきなわけん》も 入《はい》るよ。' : ''}`,
  });
});

// ---- position ----
const positionItems: MapItem[] = PREFS.map((x) =>
  mapItem({
    id: `find-${x.code}`,
    obj: 'position',
    level: 1,
    prompt: `${nm(x.code)}は どこ？ ちずを タップしよう。`,
    task: { kind: 'find', prefs: [x.code], view: viewOf(x.code) },
    misconceptions: MAP_MIS,
    hints: [
      `${nm(x.code)}は ${REGION_NAME[x.region]}に あるよ。`,
      x.code === 1
        ? '日本《にほん》の いちばん 北《きた》の 大《おお》きな 島《しま》だよ。'
        : x.code === OKINAWA
          ? 'ちずの 左上《ひだりうえ》の かこみの 中《なか》を 見《み》よう。'
          : whereInRegion(x.code),
      x.code === 1
        ? '本州《ほんしゅう》の 北《きた》の、海《うみ》を わたった ところだよ。'
        : nearHint(x.code),
    ],
    explain: `${nm(x.code)}は ${REGION_NAME[x.region]}に あるよ。${x.code === 1 || x.code === OKINAWA ? '' : nearHint(x.code)}`,
  }),
);

const BIG = [3, 5, 7, 15, 20, 34, 39, 43, 46, 22];
const positionAlts: MapItem[] = BIG.map((c) =>
  mapItem({
    id: `find-japan-${c}`,
    obj: 'position',
    level: 2,
    alt: true,
    prompt: `日本《にほん》全体《ぜんたい》の ちずで、${nm(c)}を タップしよう。`,
    task: { kind: 'find', prefs: [c], view: 'japan' },
    misconceptions: MAP_MIS,
    hints: [`まず ${REGION_NAME[pr(c).region]}を さがそう。`, whereInRegion(c), nearHint(c)],
    explain: `${nm(c)}は ${REGION_NAME[pr(c).region]}に あるよ。${nearHint(c)}`,
  }),
);

// ---- name ----
const nameItems: MapItem[] = PREFS.map((x) =>
  mapItem({
    id: `name-${x.code}`,
    obj: 'name',
    level: 1,
    prompt: 'しるしの ついた 都道府県《とどうふけん》の 名前《なまえ》は？',
    task: { kind: 'name', pref: x.code, options: nameOptions(x.code), view: viewOf(x.code) },
    misconceptions: MAP_MIS,
    hints: [
      `${REGION_NAME[x.region]}の 都道府県《とどうふけん》だよ。`,
      `名前《なまえ》は、かなで ${[...x.yomi].length}もじだよ（「${x.suffix ? x.suffixYomi : ''}」の ぶぶんは のぞく）。`,
      `「${firstKana(x.code)}」から はじまる 名前《なまえ》だよ。`,
    ],
    explain: `${nm(x.code)}だよ。${REGION_NAME[x.region]}に あるよ。`,
  }),
);
// 北海道は「道」の部分を除く必要が無いので、ヒント②を書き直す
for (const it of nameItems)
  if (it.id === 'name-1') it.hints[1] = '名前《なまえ》は、かなで 6もじだよ。';

/** 4年で習う都道府県名の字を、ふりがな無しで読む */
const KANJI_PREFS = [8, 9, 10, 11, 15, 21, 25, 38, 41, 43];
const nameKanji: MapItem[] = KANJI_PREFS.map((c) =>
  mapItem({
    id: `name-kanji-${c}`,
    obj: 'name',
    level: 2,
    alt: true,
    prompt: 'しるしの 都道府県《とどうふけん》の 名前《なまえ》を、漢字《かんじ》で えらぼう。',
    task: { kind: 'name', pref: c, options: nameOptions(c), view: viewOf(c), nameStyle: 'kanji' },
    misconceptions: MAP_MIS,
    hints: [
      `${REGION_NAME[pr(c).region]}の 県《けん》だよ。`,
      `読《よ》み方《かた》は、かなで ${[...pr(c).yomi].length}もじだよ。`,
      `「${firstKana(c)}」から はじまる 名前《なまえ》だよ。`,
    ],
    explain: `${nm(c)}だよ。漢字《かんじ》も 読《よ》めるように なろう。`,
  }),
);

interface Sp {
  c: number;
  tiles: string[];
  wrong: string;
}
const SPELL: Sp[] = [
  { c: 21, tiles: ['ぎ', 'ふ', 'き', 'ぶ'], wrong: 'きふ' },
  { c: 25, tiles: ['し', 'が', 'じ', 'か'], wrong: 'しか' },
  { c: 41, tiles: ['さ', 'が', 'ざ', 'か'], wrong: 'さか' },
  { c: 10, tiles: ['ぐ', 'ん', 'ま', 'く', 'ば'], wrong: 'くんま' },
];
const spellItems: MapItem[] = SPELL.map((s) =>
  mapItem({
    id: `spell-${s.c}`,
    obj: 'name',
    level: 2,
    alt: true,
    prompt: 'しるしの 県《けん》の 名前《なまえ》を、かなの ふだで ならべよう。',
    task: { kind: 'spell', pref: s.c, tiles: s.tiles, view: viewOf(s.c) },
    wrongAnswers: [{ value: s.wrong, misconception: 'mis-dakuten' }],
    hints: [
      `${REGION_NAME[pr(s.c).region]}の 県《けん》だよ。`,
      `${[...pr(s.c).yomi].length}もじの 名前《なまえ》だよ。「゛」が つく 字《じ》に 気《き》を つけよう。`,
      `「${firstKana(s.c)}」から はじまるよ。`,
    ],
    explain: `${nm(s.c)}だよ。にごる 音《おと》（「゛」）も わすれずに。`,
  }),
);

// ---- capital ----
/** 県庁所在地のよみの最初のかな */
/** 県庁所在地のよみ（「市」を除く）の字数 */
const capLen = (cap: string) =>
  [...(/^[ぁ-ん]/.test(cap) ? cap.replace(/市.*$/, '') : (/《([^》]+)》/.exec(cap)?.[1] ?? ''))]
    .length;
const capFirst = (cap: string) =>
  /^[ぁ-ん]/.test(cap) ? cap[0]! : (/《([^》]+)》/.exec(cap)?.[1] ?? '')[0]!;
const DIFF = PREFS.filter((x) => x.capital && x.capital !== same(x.base, x.yomi));
const capitalItems: Item[] = DIFF.map((x, i) => {
  // まちがいの選択肢: ほかの県の県庁所在地（近い県から）
  const wrongs = nearbyAll(x.code)
    .filter((o) => pr(o).capital)
    .slice(0, 3)
    .map((o) => [pr(o).capital!, 'capital-mix'] as [string, string]);
  const cap = x.capital!;
  return choiceItem({
    id: `capital-${x.code}`,
    obj: 'capital',
    level: 2,
    prompt: `${nm(x.code)}の 県庁所在地《けんちょうしょざいち》は どこかな。`,
    right: cap,
    wrongs,
    layout: i % 2 ? 'grid' : 'column',
    hints: [
      '県庁所在地《けんちょうしょざいち》は、県《けん》の しごとを する 県庁《けんちょう》が ある 市《し》だよ。',
      `${nm(x.code)}の 名前《なまえ》と、県庁所在地《けんちょうしょざいち》の 名前《なまえ》は ちがうよ。ほかの 県《けん》の 市《し》を のぞこう。`,
      `「${capFirst(cap)}」から はじまる、かなで ${capLen(cap)}もじの 市《し》だよ。`,
    ],
    explain: `${nm(x.code)}の 県庁所在地《けんちょうしょざいち》は ${cap}だよ。${x.code === 1 ? '北海道《ほっかいどう》では「道庁所在地《どうちょうしょざいち》」とも いうよ。' : ''}${wrongs.map((w) => w[0]).join('・')}は、ほかの 県《けん》の 県庁所在地《けんちょうしょざいち》だね。`,
  });
});

const CAP_REV = [3, 4, 17, 23, 28, 37];
const capitalRev: Item[] = CAP_REV.map((c) => {
  const opts = nameOptions(c);
  return choiceItem({
    id: `capital-rev-${c}`,
    obj: 'capital',
    level: 2,
    alt: true,
    prompt: `${pr(c).capital}が 県庁所在地《けんちょうしょざいち》に なって いる 県《けん》は どれかな。`,
    right: nm(c),
    wrongs: opts.slice(1).map((o) => [nm(o), 'capital-mix'] as [string, string]),
    hints: [
      '県庁所在地《けんちょうしょざいち》は、県《けん》の 名前《なまえ》と ちがう ことが あるよ。',
      `${REGION_NAME[pr(c).region]}の 県《けん》だよ。`,
      nearHint(c),
    ],
    explain: `${pr(c).capital}は ${nm(c)}の 県庁所在地《けんちょうしょざいち》だよ。`,
  });
});

/** 県名と県庁所在地の名前が同じ県を選ぶ（[同じ県, 名前がちがう県3つ]） */
const SAME_SETS: [number, number[]][] = [
  [22, [23, 19, 14]],
  [26, [25, 28, 24]],
  [40, [47, 38, 37]],
];
const capitalSame: Item[] = SAME_SETS.map(([right, wrongs], i) =>
  choiceItem({
    id: `capital-same-${right}`,
    obj: 'capital',
    level: 2,
    alt: true,
    prompt:
      '県《けん》の 名前《なまえ》と、県庁所在地《けんちょうしょざいち》の 市《し》の 名前《なまえ》が 同《おな》じ なのは どれかな。',
    right: nm(right),
    wrongs: wrongs.map((w) => [nm(w), 'capital-same'] as [string, string]),
    hints: [
      'それぞれの 県《けん》の 県庁所在地《けんちょうしょざいち》を 思《おも》い出《だ》そう。',
      '名前《なまえ》が ちがう 県《けん》を 1つずつ のぞこう。',
      `「${firstKana(right)}」から はじまる 県《けん》だよ。`,
    ],
    explain: `${nm(right)}の 県庁所在地《けんちょうしょざいち》は ${pr(right).capital}で、名前《なまえ》が 同《おな》じだよ。${wrongs.map((w) => `${nm(w)}は ${pr(w).capital}`).join('、')}だね。`,
    layout: i % 2 ? 'grid' : 'column',
  }),
);

// ---- bearing ----
const PAIRS: [number, number][] = [
  [20, 22],
  [20, 19],
  [20, 17],
  [13, 11],
  [13, 8],
  [27, 26],
  [27, 28],
  [27, 30],
  [34, 32],
  [34, 38],
  [4, 6],
  [40, 44],
  [40, 41],
  [23, 22],
  [15, 10],
  [33, 31],
];
const bearingItems: MapItem[] = PAIRS.map(([a, b]) => {
  const d = bearing(pr(a).label, pr(b).label).dir;
  const view = pr(a).region === pr(b).region ? pr(a).region : 'japan';
  const half =
    d.length === 2
      ? '2つの 方位《ほうい》の あいだに なる ことも あるよ。'
      : '北《きた》・東《ひがし》・南《みなみ》・西《にし》の どれかに なる ことも あるよ。';
  return mapItem({
    id: `bearing-${a}-${b}`,
    obj: 'bearing',
    level: 2,
    prompt: `${nm(a)}から 見《み》て、${nm(b)}は どの 方位《ほうい》？`,
    task: { kind: 'bearing', from: a, to: b, view },
    misconceptions: DIR_MIS,
    hints: [
      'ちずの 上《うえ》が 北《きた》だよ。',
      `${nm(a)}の ピンから ${nm(b)}の ピンへ 線《せん》を おもいうかべよう。`,
      `線《せん》の むきを 八方位《はっぽうい》で いうと どれかな。${half}`,
    ],
    explain: `${nm(b)}は ${nm(a)}の ${DIR_NAME[d]}に あるよ。`,
  });
});

interface Ba {
  from: number;
  dir: Dir8;
  right: number;
  /** [県, 誤概念] */
  wrongs: [number, string][];
}
const BALT: Ba[] = [
  {
    from: 27,
    dir: 'n',
    right: 26,
    wrongs: [
      [30, 'mis-opposite'],
      [29, 'mis-dir'],
      [28, 'mis-dir'],
    ],
  },
  {
    from: 40,
    dir: 'se',
    right: 44,
    wrongs: [
      [41, 'mis-east-west'],
      [35, 'mis-dir'],
      [43, 'mis-dir'],
    ],
  },
  {
    from: 23,
    dir: 'e',
    right: 22,
    wrongs: [
      [25, 'mis-opposite'],
      [16, 'mis-dir'],
      [29, 'mis-dir'],
    ],
  },
  {
    from: 20,
    dir: 'sw',
    right: 21,
    wrongs: [
      [19, 'mis-east-west'],
      [8, 'mis-dir'],
      [17, 'mis-dir'],
    ],
  },
  {
    from: 34,
    dir: 'n',
    right: 32,
    wrongs: [
      [38, 'mis-opposite'],
      [31, 'mis-dir'],
      [36, 'mis-dir'],
    ],
  },
  {
    from: 13,
    dir: 'w',
    right: 19,
    wrongs: [
      [8, 'mis-dir'],
      [11, 'mis-dir'],
      [22, 'mis-dir'],
    ],
  },
];
const bearingAlts: Item[] = BALT.map((s, i) =>
  choiceItem({
    id: `bearing-alt-${s.from}-${s.dir}`,
    obj: 'bearing',
    level: 2,
    alt: true,
    prompt: `${nm(s.from)}から 見《み》て ${DIR_NAME[s.dir]}に ある 県《けん》は どれかな。（ちずを 思《おも》いうかべよう）`,
    right: nm(s.right),
    wrongs: s.wrongs.map(([c, m]) => [nm(c), m] as [string, string]),
    layout: i % 2 ? 'grid' : 'column',
    hints: [
      `${nm(s.from)}が ちずの どこに あるか 思《おも》い出《だ》そう。`,
      `${DIR_NAME[s.dir]}は、ちずで いうと ${{ n: '上《うえ》', ne: '右上《みぎうえ》', e: '右《みぎ》', se: '右下《みぎした》', s: '下《した》', sw: '左下《ひだりした》', w: '左《ひだり》', nw: '左上《ひだりうえ》' }[s.dir]}の むきだよ。`,
      'それぞれの 県《けん》が、どの むきに あるか 1つずつ たしかめよう。',
    ],
    explain: `${nm(s.right)}は ${nm(s.from)}の ${DIR_NAME[s.dir]}に あるよ。${s.wrongs.map(([c]) => `${nm(c)}は ${DIR_NAME[bearing(pr(s.from).label, pr(c).label).dir]}`).join('、')}だね。`,
  }),
);

const items: Item[] = [
  ...regionItems,
  ...regionAlts,
  ...positionItems,
  ...positionAlts,
  ...nameItems,
  ...nameKanji,
  ...spellItems,
  ...capitalItems,
  ...capitalRev,
  ...capitalSame,
  ...bearingItems,
  ...bearingAlts,
];

export const prefectures: UnitSpec = {
  ...baseSoc('g4.soc.prefectures', 'g4'),
  title: '47都道府県《よんじゅうななとどうふけん》',
  kind: 'knowledge',
  status: 'ready',
  review: 'item',
  prereq: ['g3.soc.map-symbols'],
  objectives: [
    { id: 'region', title: '都道府県《とどうふけん》と 地方《ちほう》' },
    { id: 'position', title: '都道府県《とどうふけん》の 位置《いち》' },
    { id: 'name', title: '都道府県《とどうふけん》の 名前《なまえ》（漢字《かんじ》）' },
    { id: 'capital', title: '県庁所在地《けんちょうしょざいち》' },
    { id: 'bearing', title: '八方位《はっぽうい》で いう' },
  ],
  misconceptions: [
    {
      id: 'mis-region',
      explain:
        'となりの 地方《ちほう》と まざったのかな。ちずの もようと ばんごうで、地方《ちほう》の さかいめを たしかめよう。',
    },
    {
      id: 'mis-neighbor',
      explain:
        'となりの 県《けん》を えらんだのかな。近《ちか》くの 県《けん》との ならび方《かた》を、ちずで もう一度《いちど》 見《み》よう。',
    },
    {
      id: 'mis-same-region',
      explain:
        '同《おな》じ 地方《ちほう》の べつの 県《けん》と まちがえたのかな。地方《ちほう》の 中《なか》で 北《きた》・南《みなみ》・東《ひがし》・西《にし》の どこに あるか 見《み》よう。',
    },
    {
      id: 'mis-missing',
      explain:
        'まだ のこって いる 県《けん》が あるよ。地方《ちほう》の 都道府県《とどうふけん》の 数《かず》を 思《おも》い出《だ》して、かぞえて みよう。',
    },
    {
      id: 'mis-dakuten',
      explain:
        '「゛」（にごる しるし）を わすれたのかな。声《こえ》に 出《だ》して 読《よ》んで みよう。',
    },
    {
      id: 'capital-mix',
      explain:
        'ほかの 県《けん》の 県庁所在地《けんちょうしょざいち》と まざったのかな。県《けん》と 市《し》を 組《く》に して おぼえよう。',
    },
    {
      id: 'capital-same',
      explain:
        '県《けん》の 名前《なまえ》と 県庁所在地《けんちょうしょざいち》の 名前《なまえ》は、いつも 同《おな》じ とは かぎらないよ。ちがう 県《けん》も あるね。',
    },
    {
      id: 'mis-opposite',
      explain:
        '反対《はんたい》の 方位《ほうい》に したのかな。どちらから 見《み》て いるかを たしかめよう。「〜から 見《み》て」の 〜が 中心《ちゅうしん》だよ。',
    },
    {
      id: 'mis-east-west',
      explain:
        '東《ひがし》と 西《にし》が 入《い》れかわったのかな。北《きた》を 上《うえ》に したとき、右《みぎ》が 東《ひがし》、左《ひだり》が 西《にし》だよ。',
    },
    {
      id: 'mis-dir',
      explain:
        'ちがう むきの 県《けん》を えらんだのかな。ちずの 上《うえ》が 北《きた》。中心《ちゅうしん》の 県《けん》から 線《せん》を のばして、むきを たしかめよう。',
    },
  ],
  levels: [
    { label: '地方《ちほう》', chance: 0.1 },
    { label: '位置《いち》と 名前《なまえ》', chance: 0.1 },
    { label: '県庁所在地《けんちょうしょざいち》と 方位《ほうい》', chance: 0.1 },
  ],
  intro: [
    {
      text: '日本《にほん》には 47の 都道府県《とどうふけん》が あるよ。1つの 都《と》（東京都《とうきょうと》）、1つの 道《どう》（北海道《ほっかいどう》）、2つの 府《ふ》（京都府《きょうとふ》・大阪府《おおさかふ》）、43の 県《けん》だよ。',
    },
    {
      text: '都道府県《とどうふけん》は、8つの 地方《ちほう》に 分《わ》けて よぶ ことが あるよ。北海道《ほっかいどう》・東北《とうほく》・関東《かんとう》・中部《ちゅうぶ》・近畿《きんき》・中国《ちゅうごく》・四国《しこく》・九州《きゅうしゅう》だよ。ちずでは、地方《ちほう》を もようと ばんごうで 見分《みわ》けるよ。',
    },
    {
      text: '県庁所在地《けんちょうしょざいち》は、県《けん》の しごとを する 県庁《けんちょう》が ある 市《し》だよ。県《けん》の 名前《なまえ》と ちがう 市《し》も あるよ。方位《ほうい》は、ちずの 上《うえ》が 北《きた》。八方位《はっぽうい》で いって みよう。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）社会 第4学年 内容(1)（都道府県の様子。47都道府県の名称と位置）、内容の取扱い（八方位は第4学年修了までに）。都道府県名の漢字は国語 学年別漢字配当表 第4学年（2020年度からの配当）。地図は map エンジン（Natural Earth を簡略化）',
};

/** 学年（4年）より上の字の理由 */
export const prefecturesAllow: Allow = {
  畿: '「近畿地方」（地方の名前。固有名詞）',
  庁: '「県庁所在地」「県庁」（社会の用語）',
  在: '「県庁所在地」（社会の用語）',
  盛: '「盛岡市」（県庁所在地の名前。固有名詞）',
  仙: '「仙台市」（県庁所在地の名前。固有名詞）',
  宇: '「宇都宮市」（県庁所在地の名前。固有名詞）',
  沢: '「金沢市」（県庁所在地の名前。固有名詞）',
  甲: '「甲府市」（県庁所在地の名前。固有名詞）',
  津: '「津市」「大津市」（県庁所在地の名前。固有名詞）',
  江: '「松江市」（県庁所在地の名前。固有名詞）',
  那: '「那覇市」（県庁所在地の名前。固有名詞）',
  覇: '「那覇市」（県庁所在地の名前。固有名詞）',
  浜: '「横浜市」（県庁所在地の名前。固有名詞）',
};
