/** map の見本の問題（統括が画面で確かめる用。checkMap が誤りを返さないこと） */
import type { MapItem } from './map';

const hints3 = (a: string, b: string, c: string) => [a, b, c];

export const mapSamples: MapItem[] = [
  {
    // 小4: 印の都道府県の名前を選ぶ
    id: 'map-sample:name-shizuoka',
    engine: 'map',
    objective: 'pref-name',
    level: 0,
    prompt: 'しるしの ついた 県《けん》の 名前《なまえ》は？',
    hints: hints3(
      '太平洋《たいへいよう》に 面《めん》した 県《けん》だよ',
      '富士山《ふじさん》が ある 県《けん》だよ',
      '「し」から はじまる 名前《なまえ》だよ',
    ),
    explain:
      '静岡県《しずおかけん》だよ。中部地方《ちゅうぶちほう》の 太平洋《たいへいよう》がわに あるよ',
    identity: 'name:22',
    task: { kind: 'name', pref: 22, options: [22, 23, 19, 14] },
    misconceptions: { neighbor: 'mis-neighbor' },
  },
  {
    // 小4: 名前の県を地図でタップ（地方の図）
    id: 'map-sample:find-gifu',
    engine: 'map',
    objective: 'pref-position',
    level: 1,
    prompt: '岐阜県《ぎふけん》は どこ？ ちずを タップしよう',
    hints: hints3(
      '中部地方《ちゅうぶちほう》の まんなかの あたりだよ',
      '海《うみ》に 面《めん》して いない 県《けん》だよ',
      '愛知県《あいちけん》の 北《きた》に あるよ',
    ),
    explain:
      '岐阜県《ぎふけん》は 愛知県《あいちけん》の 北《きた》、長野県《ながのけん》の 西《にし》だよ',
    identity: 'find:21:chubu',
    task: { kind: 'find', prefs: [21], view: 'chubu' },
    misconceptions: { neighbor: 'mis-neighbor', sameRegion: 'mis-region' },
  },
  {
    // 小4: 地方の県をぜんぶタップ（なかま分け）
    id: 'map-sample:find-shikoku',
    engine: 'map',
    objective: 'region',
    level: 2,
    prompt: '四国地方《しこくちほう》の 県《けん》を ぜんぶ タップしよう',
    hints: hints3(
      '四国《しこく》は 4つの 県《けん》で できて いるよ',
      '本州《ほんしゅう》の 南《みなみ》に ある 島《しま》だよ',
      '瀬戸内海《せとないかい》を はさんで 中国地方《ちゅうごくちほう》の 南《みなみ》',
    ),
    explain:
      '徳島県《とくしまけん》・香川県《かがわけん》・愛媛県《えひめけん》・高知県《こうちけん》の 4つだよ',
    identity: 'find-region:shikoku',
    task: { kind: 'find', prefs: [36, 37, 38, 39] },
    misconceptions: { missing: 'mis-missing', sameRegion: 'mis-region' },
  },
  {
    // 小4: 印の県の地方（地方の模様と番号の地図）
    id: 'map-sample:region-shiga',
    engine: 'map',
    objective: 'region',
    level: 1,
    prompt: 'しるしの 県《けん》は どの 地方《ちほう》？',
    hints: hints3(
      'ちずの もようと ばんごうを 見《み》よう',
      'しるしの 県《けん》と 同《おな》じ もようの ふだを さがそう',
      '京都府《きょうとふ》や 大阪府《おおさかふ》と 同《おな》じ 地方《ちほう》だよ',
    ),
    explain: '滋賀県《しがけん》は 近畿地方《きんきちほう》だよ',
    identity: 'region:25',
    task: {
      kind: 'region',
      pref: 25,
      options: ['chubu', 'kinki', 'chugoku', 'shikoku'],
      showRegions: true,
    },
    wrongAnswers: [{ value: 'chubu', misconception: 'mis-region' }],
  },
  {
    // 小4: 八方位（県から見た県）
    id: 'map-sample:bearing-20-15',
    engine: 'map',
    objective: 'direction',
    level: 2,
    prompt: '長野県《ながのけん》から 見《み》て、新潟県《にいがたけん》は どの 方位《ほうい》？',
    hints: hints3(
      'ちずの 上《うえ》が 北《きた》だよ',
      '長野県《ながのけん》の ピンから 新潟県《にいがたけん》の ピンへ 線《せん》を おもいうかべよう',
      '北《きた》と 東《ひがし》の あいだだよ',
    ),
    explain: '新潟県《にいがたけん》は 長野県《ながのけん》の 北東《ほくとう》に あるよ',
    identity: 'bearing:20:15',
    task: { kind: 'bearing', from: 20, to: 15, view: 'chubu' },
    misconceptions: { opposite: 'mis-opposite', mirrorEW: 'mis-east-west' },
  },
  {
    // 小4: 名前をかなで入れる
    id: 'map-sample:spell-gifu',
    engine: 'map',
    objective: 'pref-name',
    level: 2,
    prompt: 'しるしの 県《けん》の 名前《なまえ》を ならべよう',
    hints: hints3('2もじの 名前《なまえ》だよ', '「ぎ」から はじまるよ', 'ぎ・ふ'),
    explain: '岐阜県《ぎふけん》だよ',
    identity: 'spell:21',
    task: { kind: 'spell', pref: 21, tiles: ['ぎ', 'ふ', 'き', 'ぶ'], view: 'chubu' },
    wrongAnswers: [{ value: 'きふ', misconception: 'mis-dakuten' }],
  },
  {
    // 小3: 地図記号の名前
    id: 'map-sample:symbol-post',
    engine: 'map',
    objective: 'symbol',
    level: 0,
    prompt: 'この 地図記号《ちずきごう》は なに？',
    hints: hints3(
      'まるの 中《なか》の しるしを 見《み》よう',
      '手紙《てがみ》を 出《だ》す ところの しるしだよ',
      '「〒」の しるしだよ',
    ),
    explain: '郵便局《ゆうびんきょく》の 記号《きごう》だよ',
    identity: 'symbol:name:post',
    task: {
      kind: 'symbol',
      ask: 'name',
      symbol: 'post',
      options: ['post', 'police', 'hospital', 'school'],
    },
    wrongAnswers: [{ value: 'police', misconception: 'mis-circle' }],
  },
  {
    // 小3: 絵地図で方位と記号
    id: 'map-sample:town-north-of-station',
    engine: 'map',
    objective: 'symbol',
    level: 2,
    prompt: '駅《えき》の 北《きた》に ある たてものの 記号《きごう》を タップしよう',
    hints: hints3(
      'ちずの みぎうえの やじるしが 北《きた》だよ',
      '駅《えき》から 上《うえ》の ほうへ すすもう',
      '駅《えき》の まっすぐ 上《うえ》に ある 記号《きごう》だよ',
    ),
    explain: '駅《えき》の 北《きた》には 学校《がっこう》が あるよ',
    identity: 'town:a:n',
    task: {
      kind: 'town',
      size: [5, 4],
      roads: [
        [
          [0, 1],
          [4, 1],
        ],
        [
          [2, 0],
          [2, 3],
        ],
        [
          [2, 3],
          [4, 3],
        ],
      ],
      rail: [
        [-0.5, 2],
        [4.5, 2],
      ],
      places: [
        { symbol: 'station', at: [2, 2], label: '駅《えき》' },
        { symbol: 'school', at: [2, 0] },
        { symbol: 'post', at: [4, 3] },
        { symbol: 'hospital', at: [0, 1] },
        { symbol: 'shrine', at: [2, 3] },
        { symbol: 'temple', at: [4, 0] },
      ],
      from: 0,
      dir: 'n',
      answer: 1,
    },
    misconceptions: { opposite: 'mis-opposite', mirrorEW: 'mis-east-west' },
  },
  {
    // 小3: 方位じしん（八方位の場所）
    id: 'map-sample:compass-ne',
    engine: 'map',
    objective: 'direction',
    level: 1,
    prompt: '北東《ほくとう》は どこ？ ふだを タップしよう',
    hints: hints3(
      '北《きた》の ふだを 見《み》よう',
      '北《きた》から とけいの はりの むきに すこし まわろう',
      '北《きた》と 東《ひがし》の あいだだよ',
    ),
    explain: '北東《ほくとう》は 北《きた》と 東《ひがし》の あいだだよ',
    identity: 'compass:point:ne',
    task: { kind: 'compass', ask: 'point', dir: 'ne', points: 8, given: ['n'] },
    misconceptions: { opposite: 'mis-opposite', mirrorEW: 'mis-east-west' },
  },
];
