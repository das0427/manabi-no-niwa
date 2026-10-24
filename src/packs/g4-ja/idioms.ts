/**
 * g4.ja.idioms かんようく・こじせいご（curriculum-matrix 3.7: 慣用句・故事成語）。
 * 意味と結ぶ（match）→ 場面に合う慣用句（choice）→ 体の部分を使う慣用句（fill・sort）。
 * 「慣」「句」「故」は5年の配当字なので、子供に見せる文ではかなで書く。慣用句の中の5年以上の字もかな（むね・はら・ほね など）。
 * 意味・場面・使い方の文はすべて本アプリのオリジナル。
 *
 * 項目: 40（慣用句32・故事成語8）。1項目につき 意味（match／choice）と 場面（choice）の2問以上。
 * 同一性キー: 項目 × 問い方（match は組ごと）。
 */
import type {
  ChoiceItem,
  FillItem,
  Item,
  MatchItem,
  SortItem,
  UnitSpec,
} from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Mis = 'id-literal' | 'id-body-mix' | 'id-similar' | 'id-polarity';

interface Idiom {
  id: string;
  /** 慣用句（辞書の形） */
  text: string;
  /** 意味（自分の言葉で） */
  mean: string;
  /** 合う場面（慣用句を使わずに書いた文） */
  scene: string;
  /** まぎらわしい項目と、それを選んだときの誤概念 */
  conf: [string, Mis][];
  /** 字面どおりの意味（誤りの選択肢） */
  literal?: string;
  /** 体の部分: [部分, 部分のあとの文, まちがえやすい部分] */
  body?: [string, string, string[]];
  koji?: boolean;
}

const IDIOMS: Idiom[] = [
  {
    id: 'ashi-hippa',
    text: '足《あし》を ひっぱる',
    mean: '人《ひと》の じゃまを して、うまく いかないように する。',
    scene: 'わたしが ボールを 何度《なんど》も 落《お》としたせいで、チームが 負《ま》けそうに なった。',
    conf: [
      ['te-kasu', 'id-polarity'],
      ['ashi-bou', 'id-similar'],
    ],
    literal: '人《ひと》の 足《あし》を 手《て》で つかんで 引《ひ》く。',
    body: ['足《あし》', 'を ひっぱる', ['手《て》', '口《くち》']],
  },
  {
    id: 'te-kasu',
    text: '手《て》を かす',
    mean: '人《ひと》の する ことを 手《て》つだう。',
    scene: 'おもい にもつを 運《はこ》んで いる 人《ひと》が いたので、いっしょに 持《も》って あげた。',
    conf: [
      ['ashi-hippa', 'id-polarity'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '自分《じぶん》の 手《て》を 人《ひと》に わたす。',
    body: ['手《て》', 'を かす', ['口《くち》', '目《め》']],
  },
  {
    id: 'te-hanase',
    text: '手《て》が はなせない',
    mean: 'いそがしくて、ほかの ことを する ひまが ない。',
    scene: '母《はは》は 料理《りょうり》の とちゅうで、電話《でんわ》に 出《で》る ことが できなかった。',
    conf: [
      ['te-kasu', 'id-body-mix'],
      ['me-nusumu', 'id-similar'],
    ],
    literal: 'のりで くっついて、手《て》が はなれない。',
    body: ['手《て》', 'が はなせない', ['目《め》', '口《くち》']],
  },
  {
    id: 'me-nai',
    text: '目《め》が ない',
    mean: 'とても 好《す》きで、それを 見《み》ると がまんが できない。',
    scene: '姉《あね》は あまい ものが 大好《だいす》きで、ケーキを 見《み》ると すぐに 食《た》べたく なる。',
    conf: [
      ['me-maru', 'id-body-mix'],
      ['yubi-kuwaeru', 'id-similar'],
    ],
    literal: '目《め》が 見《み》えない。',
    body: ['目《め》', 'が ない', ['鼻《はな》', '耳《みみ》']],
  },
  {
    id: 'me-maru',
    text: '目《め》を 丸《まる》く する',
    mean: 'おどろいて、目《め》を 大《おお》きく 開《ひら》く。',
    scene: 'ぼうしの 中《なか》から 子《こ》ねこが 出《で》て きて、みんな びっくりした。',
    conf: [
      ['me-nai', 'id-body-mix'],
      ['me-nusumu', 'id-body-mix'],
    ],
    literal: '目《め》の まわりに 丸《まる》を かく。',
    body: ['目《め》', 'を 丸《まる》く する', ['口《くち》', '手《て》']],
  },
  {
    id: 'mimi-utagau',
    text: '耳《みみ》を うたがう',
    mean: '聞《き》いた ことが しんじられないほど おどろく。',
    scene: '「あしたから 学校《がっこう》が 三《みっ》か 休《やす》み」と 聞《き》いて、聞《き》きまちがいかと 思《おも》った。',
    conf: [
      ['mimi-itai', 'id-body-mix'],
      ['kuchi-suberu', 'id-similar'],
    ],
    body: ['耳《みみ》', 'を うたがう', ['口《くち》', '鼻《はな》']],
  },
  {
    id: 'mimi-itai',
    text: '耳《みみ》が いたい',
    mean: '自分《じぶん》の よくない ところを 言《い》われて、聞《き》くのが つらい。',
    scene: '先生《せんせい》が「わすれ物《もの》に 気《き》を つけよう。」と 話《はな》した とき、わすれ物《もの》が 多《おお》い ぼくは ドキッと した。',
    conf: [
      ['mimi-utagau', 'id-body-mix'],
      ['kuchi-katai', 'id-similar'],
    ],
    literal: '耳《みみ》を けがして いたむ。',
    body: ['耳《みみ》', 'が いたい', ['目《め》', '鼻《はな》']],
  },
  {
    id: 'kuchi-katai',
    text: '口《くち》が かたい',
    mean: 'ひみつを ほかの 人《ひと》に 話《はな》さない。',
    scene: 'けんたは、たのまれた ないしょの 話《はなし》を だれにも 言《い》わない。',
    conf: [
      ['kuchi-suberu', 'id-polarity'],
      ['mimi-itai', 'id-similar'],
    ],
    literal: 'かたい ものを よく かむ。',
    body: ['口《くち》', 'が かたい', ['耳《みみ》', '手《て》']],
  },
  {
    id: 'kuchi-suberu',
    text: '口《くち》が すべる',
    mean: '言《い》っては いけない ことを、うっかり 言《い》って しまう。',
    scene: '弟《おとうと》は、母《はは》に ないしょの プレゼントの ことを つい 話《はな》して しまった。',
    conf: [
      ['kuchi-katai', 'id-polarity'],
      ['ashi-hippa', 'id-similar'],
    ],
    literal: 'すべって ころび、口《くち》を ぶつける。',
    body: ['口《くち》', 'が すべる', ['目《め》', '耳《みみ》']],
  },
  {
    id: 'hana-takai',
    text: '鼻《はな》が 高《たか》い',
    mean: 'ほこらしくて、とくいな 気持《きも》ちに なる。',
    scene: '妹《いもうと》の 絵《え》が 金《きん》しょうを とって、家族《かぞく》みんなが うれしく ほこらしかった。',
    conf: [
      ['kata-otosu', 'id-polarity'],
      ['me-nai', 'id-body-mix'],
    ],
    literal: '鼻《はな》の 形《かたち》が すっと 高《たか》い。',
    body: ['鼻《はな》', 'が 高《たか》い', ['顔《かお》', '首《くび》']],
  },
  {
    id: 'kao-hiroi',
    text: '顔《かお》が 広《ひろ》い',
    mean: '知《し》り合《あ》いが たくさん いる。',
    scene: 'おじさんが 町《まち》を 歩《ある》くと、あちこちで 声《こえ》を かけられる。',
    conf: [
      ['hana-takai', 'id-body-mix'],
      ['uma-au', 'id-similar'],
    ],
    literal: '顔《かお》の はばが 大《おお》きい。',
    body: ['顔《かお》', 'が 広《ひろ》い', ['耳《みみ》', '口《くち》']],
  },
  {
    id: 'atama-kakaeru',
    text: '頭《あたま》を かかえる',
    mean: 'こまって、どう したら よいか なやむ。',
    scene: '算数《さんすう》の 問題《もんだい》が どうしても とけず、ずっと なやんで いる。',
    conf: [
      ['kubi-nagaku', 'id-body-mix'],
      ['saji-nageru', 'id-similar'],
    ],
    literal: '頭《あたま》が いたく なる。',
    body: ['頭《あたま》', 'を かかえる', ['足《あし》', '目《め》']],
  },
  {
    id: 'kubi-nagaku',
    text: '首《くび》を 長《なが》く する',
    mean: '楽《たの》しみに して、今《いま》か 今《いま》かと 待《ま》つ。',
    scene: 'おばあちゃんから とどく 手紙《てがみ》を、毎日《まいにち》 楽《たの》しみに 待《ま》って いる。',
    conf: [
      ['ki-nagai', 'id-similar'],
      ['atama-kakaeru', 'id-body-mix'],
    ],
    literal: '首《くび》を のばして、せを 高《たか》く 見《み》せる。',
    body: ['首《くび》', 'を 長《なが》く する', ['手《て》', '鼻《はな》']],
  },
  {
    id: 'kata-otosu',
    text: 'かたを 落《お》とす',
    mean: 'がっかりして、元気《げんき》を なくす。',
    scene: 'あと 少《すこ》しの ところで しあいに 負《ま》けて、兄《あに》は しょんぼりして いる。',
    conf: [
      ['mune-haru', 'id-polarity'],
      ['hana-takai', 'id-polarity'],
    ],
    body: ['かた', 'を 落《お》とす', ['手《て》', '首《くび》']],
  },
  {
    id: 'mune-haru',
    text: 'むねを はる',
    mean: 'じしんを もって、どうどうと する。',
    scene: 'たくさん 練習《れんしゅう》した ゆかは、ステージに 立《た》つと、まっすぐ 前《まえ》を 見《み》て 話《はな》しはじめた。',
    conf: [
      ['kata-otosu', 'id-polarity'],
      ['atama-kakaeru', 'id-similar'],
    ],
    body: ['むね', 'を はる', ['口《くち》', '目《め》']],
  },
  {
    id: 'hara-tateru',
    text: 'はらを 立《た》てる',
    mean: 'おこる。',
    scene: 'だいじな 本《ほん》を 弟《おとうと》に だまって 持《も》ち出《だ》されて、ひろしは 顔《かお》を 赤《あか》く して どなった。',
    conf: [
      ['mimi-itai', 'id-similar'],
      ['kata-otosu', 'id-similar'],
    ],
    body: ['はら', 'を 立《た》てる', ['手《て》', '目《め》']],
  },
  {
    id: 'ha-tatanai',
    text: '歯《は》が 立《た》たない',
    mean: '相手《あいて》が 強《つよ》すぎて、まったく かなわない。',
    scene: 'しょうぎの 名人《めいじん》と 対《たい》せんしたが、どう がんばっても 勝《か》てなかった。',
    conf: [
      ['atama-kakaeru', 'id-similar'],
      ['hone-oru', 'id-similar'],
    ],
    literal: '歯《は》が いたくて、ものが かめない。',
    body: ['歯《は》', 'が 立《た》たない', ['手《て》', '首《くび》']],
  },
  {
    id: 'te-ase',
    text: '手《て》に あせを にぎる',
    mean: 'どう なるかと、はらはら しながら 見《み》る。',
    scene: 'リレーの さいごで 二人《ふたり》が ならび、ドキドキ しながら おうえんした。',
    conf: [
      ['mune-haru', 'id-similar'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '暑《あつ》くて、手《て》が あせで ぬれる。',
    body: ['手《て》', 'に あせを にぎる', ['足《あし》', '頭《あたま》']],
  },
  {
    id: 'ashi-bou',
    text: '足《あし》が ぼうに なる',
    mean: '長《なが》い あいだ 歩《ある》いたり 立《た》ったり して、足《あし》が とても つかれる。',
    scene: '遠足《えんそく》で 一日《いちにち》じゅう 山道《やまみち》を 歩《ある》き、もう 一歩《いっぽ》も 歩《ある》けない。',
    conf: [
      ['ashi-hippa', 'id-body-mix'],
      ['hone-oru', 'id-similar'],
    ],
    literal: '足《あし》が かたい 木《き》の ぼうに かわる。',
    body: ['足《あし》', 'が ぼうに なる', ['手《て》', '首《くび》']],
  },
  {
    id: 'me-nusumu',
    text: '目《め》を ぬすむ',
    mean: '人《ひと》に 見《み》つからないように、こっそり する。',
    scene: '弟《おとうと》は、母《はは》が 見《み》て いない すきに、おかしを 一《ひと》つ 食《た》べた。',
    conf: [
      ['me-nai', 'id-body-mix'],
      ['kuchi-suberu', 'id-similar'],
    ],
    body: ['目《め》', 'を ぬすむ', ['口《くち》', '耳《みみ》']],
  },
  {
    id: 'hone-oru',
    text: 'ほねを おる',
    mean: '人《ひと》の ために、苦労《くろう》して 力《ちから》を つくす。',
    scene: 'ゆうきは、クラスの みんなが 楽《たの》しめるように、何日《なんにち》も かけて お楽《たの》しみ会《かい》の じゅんびを した。',
    conf: [
      ['te-kasu', 'id-similar'],
      ['abura-uru', 'id-polarity'],
    ],
    literal: 'ころんで ほねが おれる。',
    body: ['ほね', 'を おる', ['手《て》', '足《あし》']],
  },
  {
    id: 'shita-maku',
    text: 'したを まく',
    mean: 'あまりに すばらしくて、とても かんしんする。',
    scene: '小学生《しょうがくせい》の ピアノが とても 上手《じょうず》で、聞《き》いて いた 大人《おとな》たちは「すばらしい。」と 何度《なんど》も うなずいた。',
    conf: [
      ['hana-takai', 'id-similar'],
      ['mimi-utagau', 'id-similar'],
    ],
    body: ['した', 'を まく', ['手《て》', '首《くび》']],
  },
  {
    id: 'yubi-kuwaeru',
    text: '指《ゆび》を くわえる',
    mean: 'ほしいのに 手《て》が 出《だ》せず、ただ 見《み》て いる。',
    scene: 'おもちゃ屋《や》の 前《まえ》で、ほしい ロボットを ながめて いるが、お金《かね》が 足《た》りない。',
    conf: [
      ['me-nai', 'id-similar'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '指《ゆび》を 口《くち》に 入《い》れて すう。',
    body: ['指《ゆび》', 'を くわえる', ['足《あし》', '耳《みみ》']],
  },
  {
    id: 'iki-nomu',
    text: '息《いき》を のむ',
    mean: 'はっと おどろいて、息《いき》を 止《と》める。',
    scene: 'がけの 上《うえ》から 見《み》えた 夕日《ゆうひ》の けしきが あまりに きれいで、みんな しずかに なった。',
    conf: [
      ['te-ase', 'id-similar'],
      ['kata-otosu', 'id-similar'],
    ],
    literal: '大《おお》きく 息《いき》を すいこむ れんしゅうを する。',
  },
  {
    id: 'abura-uru',
    text: '油《あぶら》を 売《う》る',
    mean: 'しごとや 用事《ようじ》の とちゅうで、むだ話《ばなし》を して なまける。',
    scene: 'おつかいの とちゅうで、友《とも》だちと 長《なが》い あいだ おしゃべりして、なかなか 帰《かえ》らなかった。',
    conf: [
      ['hone-oru', 'id-polarity'],
      ['hane-nobasu', 'id-similar'],
    ],
    literal: '店《みせ》で 油《あぶら》を 売《う》る しごとを する。',
  },
  {
    id: 'hane-nobasu',
    text: '羽《はね》を のばす',
    mean: '気《き》を つかう 人《ひと》が いなくて、のびのびと すごす。',
    scene: 'テストが 終《お》わった 週末《しゅうまつ》、ゆっくり 好《す》きな ことを して すごした。',
    conf: [
      ['abura-uru', 'id-similar'],
      ['mizu-nagasu', 'id-similar'],
    ],
    literal: '鳥《とり》が つばさを 広《ひろ》げる。',
  },
  {
    id: 'saji-nageru',
    text: 'さじを 投《な》げる',
    mean: 'これ以上《いじょう》 よく ならないと、あきらめる。',
    scene: 'こわれた ラジオを 何度《なんど》も 直《なお》そうと したが、とうとう 直《なお》すのを やめて しまった。',
    conf: [
      ['atama-kakaeru', 'id-similar'],
      ['mizu-nagasu', 'id-similar'],
    ],
    literal: 'スプーンを 遠《とお》くへ ほうる。',
  },
  {
    id: 'uma-au',
    text: '馬《うま》が 合《あ》う',
    mean: '気《き》が 合《あ》って、いっしょに いると うまく いく。',
    scene: 'たくみと そうたは、はじめて 会《あ》った 日《ひ》から 話《はなし》が はずみ、すぐに なかよく なった。',
    conf: [
      ['kao-hiroi', 'id-similar'],
      ['ki-nagai', 'id-similar'],
    ],
    literal: '馬《うま》に 乗《の》るのが 上手《じょうず》だ。',
  },
  {
    id: 'neko-te',
    text: 'ねこの 手《て》も かりたい',
    mean: 'とても いそがしくて、だれでも よいから 手《て》つだって ほしい。',
    scene: '店《みせ》に お客《きゃく》さんが どっと 来《き》て、店《みせ》の 人《ひと》は 休《やす》む ひまも なく 大《おお》いそがしだ。',
    conf: [
      ['te-kasu', 'id-similar'],
      ['hone-oru', 'id-similar'],
    ],
    literal: 'ねこから 何《なに》かを かりる。',
  },
  {
    id: 'ki-nagai',
    text: '気《き》が 長《なが》い',
    mean: 'のんびりして いて、あせらない。',
    scene: 'つりが 好《す》きな おじいさんは、魚《さかな》が かかるまで、何時間《なんじかん》でも じっと 待《ま》つ。',
    conf: [
      ['kubi-nagaku', 'id-similar'],
      ['hara-tateru', 'id-polarity'],
    ],
  },
  {
    id: 'zu-noru',
    text: '図《ず》に のる',
    mean: 'うまく いって、ちょうしに のる。',
    scene: 'ほめられた 弟《おとうと》は うれしく なって、どんどん いばりはじめた。',
    conf: [
      ['hana-takai', 'id-similar'],
      ['mune-haru', 'id-similar'],
    ],
    literal: '大《おお》きな 図《ず》の 上《うえ》に 乗《の》る。',
  },
  {
    id: 'mizu-nagasu',
    text: '水《みず》に 流《なが》す',
    mean: '前《まえ》に あった いやな ことを、なかった ことに する。',
    scene: 'けんかを した 二人《ふたり》は、「もう 気《き》に しないで おこう。」と あく手《しゅ》を した。',
    conf: [
      ['saji-nageru', 'id-similar'],
      ['hara-tateru', 'id-polarity'],
    ],
    literal: 'いらない ものを 川《かわ》に 流《なが》して すてる。',
  },
  // ---- こじせいご（昔の 中国《ちゅうごく》の 話《はなし》から できた ことば） ----
  {
    id: 'gojippo',
    text: '五十歩百歩《ごじっぽひゃっぽ》',
    mean: '少《すこ》しの ちがいは あっても、たいした ちがいは ない。',
    scene: 'テストで 五点《ごてん》だった 兄《あに》が、三点《さんてん》だった 弟《おとうと》を わらったが、どちらも 同《おな》じような ものだ。',
    conf: [
      ['gyofu', 'id-similar'],
      ['dasoku', 'id-similar'],
    ],
    literal: '五十歩《ごじっぽ》より 百歩《ひゃっぽ》の ほうが ずっと 長《なが》く 歩《ある》ける。',
    koji: true,
  },
  {
    id: 'gyofu',
    text: '漁夫《ぎょふ》の 利《り》',
    mean: '二人《ふたり》が あらそって いる あいだに、ほかの 人《ひと》が とくを する。',
    scene: '兄《あに》と 姉《あね》が 最後《さいご》の ケーキを とりあって いる すきに、妹《いもうと》が 食《た》べて しまった。',
    conf: [
      ['gojippo', 'id-similar'],
      ['tazan', 'id-similar'],
    ],
    literal: '魚《さかな》を とる 人《ひと》が、たくさん もうける。',
    koji: true,
  },
  {
    id: 'mujun',
    text: 'むじゅん',
    mean: '前《まえ》と あとで、言《い》う ことや する ことの つじつまが 合《あ》わない。',
    scene: '「夜《よる》は おかしを 食《た》べない。」と 言《い》った 父《ちち》が、その 夜《よる》に おかしを 食《た》べて いた。',
    conf: [
      ['dasoku', 'id-similar'],
      ['kiyuu', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'dasoku',
    text: 'だそく',
    mean: 'なくても よい、よけいな つけたし。',
    scene: 'きれいに かけた 絵《え》に、さらに たくさん 字《じ》を 書《か》きこんで、かえって 見《み》にくく なった。',
    conf: [
      ['suikou', 'id-similar'],
      ['mujun', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'tazan',
    text: '他山《たざん》の 石《いし》',
    mean: '人《ひと》の よくない 行《おこな》いも、自分《じぶん》を よく する ための 手《て》がかりに なる。',
    scene: '友《とも》だちが ろうかを 走《はし》って ころんだのを 見《み》て、自分《じぶん》も 気《き》を つけようと 思《おも》った。',
    conf: [
      ['gyofu', 'id-similar'],
      ['kiyuu', 'id-similar'],
    ],
    literal: 'よその 山《やま》に ある、めずらしい 石《いし》。',
    koji: true,
  },
  {
    id: 'suikou',
    text: 'すいこう',
    mean: '文章《ぶんしょう》を 何度《なんど》も 読《よ》み返《かえ》して、よりよく 直《なお》す。',
    scene: '作文《さくぶん》を 書《か》き終《お》えた あと、ことばを えらび直《なお》して、何度《なんど》も 書《か》き直《なお》した。',
    conf: [
      ['dasoku', 'id-similar'],
      ['mujun', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'kiyuu',
    text: 'きゆう',
    mean: 'しんぱいしなくても よい ことを、あれこれ しんぱいする。',
    scene: 'あしたの 遠足《えんそく》が 雨《あめ》に なるかと 夜《よる》まで ずっと 気《き》に して いたが、朝《あさ》は よく 晴《は》れた。',
    conf: [
      ['mujun', 'id-similar'],
      ['saiou', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'saiou',
    text: 'さいおうが 馬《うま》',
    mean: 'よい ことと 悪《わる》い ことは、あとに ならないと わからない。',
    scene: 'けがで 試合《しあい》に 出《で》られなかったが、その 間《あいだ》に 本《ほん》を たくさん 読《よ》み、作文《さくぶん》で しょうを もらった。',
    conf: [
      ['gyofu', 'id-similar'],
      ['kiyuu', 'id-similar'],
    ],
    koji: true,
  },
];

const BY_ID = new Map(IDIOMS.map((x) => [x.id, x]));
const get = (id: string): Idiom => {
  const x = BY_ID.get(id);
  if (!x) throw new Error(`idioms: ${id} が無い`);
  return x;
};
const word = (x: Idiom) => (x.koji ? 'こじせいご' : 'かんようく');

// ---- 1. 意味と むすぶ（match 4組ずつ） ----
function matchItems(): MatchItem[] {
  const out: MatchItem[] = [];
  for (let g = 0; g * 4 < IDIOMS.length; g++) {
    const four = IDIOMS.slice(g * 4, g * 4 + 4);
    const lit = four.find((x) => x.literal);
    const extra = lit
      ? lit.literal!
      : (IDIOMS.find((x) => !four.includes(x) && x.conf.some(([c]) => four.some((f) => f.id === c)))
          ?.mean ?? IDIOMS[(g * 4 + 5) % IDIOMS.length]!.mean);
    const litIdx = lit ? four.indexOf(lit) : -1;
    out.push({
      engine: 'match',
      id: `imi:${g + 1}`,
      objective: 'meaning',
      level: 0,
      prompt: 'ことばと 意味《いみ》を 線《せん》で むすぼう。',
      left: four.map((x) => ({ label: x.text })),
      right: [...four.map((x) => ({ label: x.mean })), { label: extra }],
      pairs: four.map((_, i) => [i, i] as [number, number]),
      ...(litIdx >= 0
        ? { wrongPairs: [{ pair: [litIdx, 4] as [number, number], misconception: 'id-literal' }] }
        : {}),
      hints: [
        'わかる ものから むすんで いこう。のこった ものが 考《かんが》えやすく なるよ。',
        'ことばの とおりの 意味《いみ》（体《からだ》が ほんとうに そう なる こと）では ないよ。',
        'それぞれの ことばを、どんな ときに 使《つか》うかな。人《ひと》の ようすや 気持《きも》ちを 思《おも》いうかべて、のこりの 一《ひと》つまで しぼろう。',
      ],
      explain: four.map((x) => `「${x.text}」は「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》です。`).join(''),
      identity: `idiom:match:${four.map((x) => x.id).join('+')}`,
    });
  }
  return out;
}

/** 別例: 意味を選ぶ（choice。字面どおりの意味をまぎらわしい選択肢に） */
function meaningChoice(x: Idiom): ChoiceItem {
  const wrongs: Wrong[] = [];
  if (x.literal) wrongs.push([x.literal, 'id-literal']);
  for (const [cid, m] of x.conf) {
    if (wrongs.length >= 3) break;
    wrongs.push([get(cid).mean, m]);
  }
  return {
    engine: 'choice',
    id: `imi-c:${x.id}`,
    objective: 'meaning',
    level: 0,
    prompt: `「${x.text}」の 意味《いみ》は どれですか。`,
    options: opts(x.mean, wrongs),
    layout: 'column',
    hints: [
      `${word(x)}は、ことばの とおりの 意味《いみ》では ない ことが 多《おお》いよ。`,
      x.koji
        ? 'こじせいごは、昔《むかし》の 中国《ちゅうごく》の 話《はなし》から 生《う》まれた ことばだよ。'
        : 'どんな 場面《ばめん》で 使《つか》う ことばかを 思《おも》いうかべよう。',
      `たとえば こんな ときに 使《つか》うよ: ${x.scene}`,
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》です。${x.literal ? '字《じ》の とおりの 意味《いみ》では ありません。' : ''}`,
    identity: `idiom:mean:${x.id}`,
    alt: true,
  };
}

// ---- 2. 場面に 合う ことば ----
function sceneItem(x: Idiom): ChoiceItem {
  return {
    engine: 'choice',
    id: `bamen:${x.id}`,
    objective: 'use',
    level: 1,
    prompt: `この 場面《ばめん》に 合《あ》う ${word(x)}は どれですか。`,
    figure: { kind: 'text', text: x.scene, size: 'm' },
    options: opts(
      x.text,
      x.conf.map(([cid, m]) => [get(cid).text, m] as Wrong),
    ),
    hints: [
      '場面《ばめん》の 人《ひと》が、どんな ようすか、どんな 気持《きも》ちかを 考《かんが》えよう。',
      `えらぶ ことばの 意味《いみ》を 一《ひと》つずつ 思《おも》い出《だ》そう。`,
      `「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》の ことばを さがそう。`,
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》なので、この 場面《ばめん》に 合《あ》います。`,
    identity: `idiom:scene:${x.id}`,
  };
}

/** 別例: 正しい 使い方の 文を 選ぶ */
const USAGE: { id: string; ok: string; wrong: Wrong[] }[] = [
  {
    id: 'kuchi-katai',
    ok: '弟《おとうと》は 口《くち》が かたいので、ひみつを 話《はな》しても だいじょうぶだ。',
    wrong: [
      ['この パンは 口《くち》が かたいので、よく かんで 食《た》べよう。', 'id-literal'],
      ['姉《あね》は 口《くち》が かたいので、すぐに ひみつを 言《い》って しまう。', 'id-polarity'],
    ],
  },
  {
    id: 'hana-takai',
    ok: 'リレーで 一位《いちい》に なった 兄《あに》を 見《み》て、ぼくも 鼻《はな》が 高《たか》かった。',
    wrong: [
      ['ぞうは 鼻《はな》が 高《たか》い ところの 葉《は》まで とどく。', 'id-literal'],
      ['テストで 0点《れいてん》を とって、鼻《はな》が 高《たか》かった。', 'id-polarity'],
    ],
  },
  {
    id: 'saji-nageru',
    ok: 'どんなに 教《おし》えても できないので、コーチは さじを 投《な》げて しまった。',
    wrong: [
      ['母《はは》は 台所《だいどころ》で さじを 投《な》げて、スープを まぜた。', 'id-literal'],
      ['あきらめずに さじを 投《な》げて、さいごまで がんばった。', 'id-polarity'],
    ],
  },
  {
    id: 'ki-nagai',
    ok: 'ゆみは 気《き》が 長《なが》いので、パズルが できるまで あわてずに つづける。',
    wrong: [
      ['ゆみは 気《き》が 長《なが》いので、すぐに おこって しまう。', 'id-polarity'],
      ['ゆみは 気《き》が 長《なが》いので、あしたの 遠足《えんそく》が 待《ま》ちきれない。', 'id-similar'],
    ],
  },
];

function usageItem(u: (typeof USAGE)[number]): ChoiceItem {
  const x = get(u.id);
  return {
    engine: 'choice',
    id: `tsukai:${u.id}`,
    objective: 'use',
    level: 1,
    prompt: `「${x.text}」の 使《つか》い方《かた》が 正《ただ》しい 文《ぶん》は どれですか。`,
    options: opts(u.ok, u.wrong),
    layout: 'column',
    hints: [
      `まず「${x.text}」の 意味《いみ》を 思《おも》い出《だ》そう。`,
      'ことばの とおりの 意味《いみ》で 使《つか》って いる 文《ぶん》は ないかな。',
      '意味《いみ》が はんたいに なって いる 文《ぶん》も ないか たしかめよう。',
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》です。その 意味《いみ》で 使《つか》って いる 文《ぶん》が 正《ただ》しい 使《つか》い方《かた》です。`,
    identity: `idiom:usage:${u.id}`,
    alt: true,
  };
}

// ---- 3. 体の 部分を 使う ことば ----
function bodyItem(x: Idiom): FillItem {
  const [part, rest, wrongs] = x.body!;
  return {
    engine: 'fill',
    id: `karada:${x.id}`,
    objective: 'body',
    level: 2,
    prompt: '{{}}に 入《はい》る 体《からだ》の 部分《ぶぶん》を えらぼう。',
    text: `{{}}${rest}（${x.mean.replace(/。$/, '')}）`,
    options: [part, ...wrongs],
    blanks: [
      {
        answers: [part],
        wrong: wrongs.map((value) => ({ value, misconception: 'id-body-mix' })),
      },
    ],
    hints: [
      '（ ）の 中《なか》の 意味《いみ》を 読《よ》もう。',
      'その ようすの とき、体《からだ》の どこが かかわりそうかな。',
      `「〜${rest.trim()}」と いう 言《い》い方《かた》を 聞《き》いた ことは あるかな。体《からだ》の 部分《ぶぶん》を 一《ひと》つずつ 当《あ》てはめて みよう。`,
    ],
    explain: `「${x.text}」です。「${x.mean.replace(/。$/, '')}」と いう 意味《いみ》の かんようくです。`,
    identity: `idiom:body:${x.id}`,
  };
}

/** 別例: 意味を 体の 部分ごとに 分ける（sort） */
const BODY_SORTS: { id: string; boxes: string[]; items: string[] }[] = [
  {
    id: 'me-mimi-kuchi',
    boxes: ['目《め》', '耳《みみ》', '口《くち》'],
    items: ['me-nai', 'me-maru', 'me-nusumu', 'mimi-utagau', 'mimi-itai', 'kuchi-katai', 'kuchi-suberu'],
  },
  {
    id: 'te-ashi-atama',
    boxes: ['手《て》', '足《あし》', '頭《あたま》'],
    items: ['te-kasu', 'te-hanase', 'te-ase', 'ashi-hippa', 'ashi-bou', 'atama-kakaeru'],
  },
  {
    id: 'hana-kao-kubi-ha',
    boxes: ['鼻《はな》', '顔《かお》', '首《くび》', '歯《は》'],
    items: ['hana-takai', 'kao-hiroi', 'kubi-nagaku', 'ha-tatanai'],
  },
  {
    id: 'kata-mune-hara-hone',
    boxes: ['かた', 'むね', 'はら', 'ほね'],
    items: ['kata-otosu', 'mune-haru', 'hara-tateru', 'hone-oru'],
  },
];

function bodySortItem(s: (typeof BODY_SORTS)[number]): SortItem {
  const xs = s.items.map(get);
  return {
    engine: 'sort',
    id: `karada-sort:${s.id}`,
    objective: 'body',
    level: 2,
    prompt: 'どの 体《からだ》の 部分《ぶぶん》を 使《つか》う かんようくの 意味《いみ》かな。分《わ》けよう。',
    boxes: s.boxes.map((label) => ({ label })),
    cards: xs.map((x) => ({
      label: x.mean,
      box: s.boxes.indexOf(x.body![0]),
    })),
    hints: [
      '意味《いみ》を 読《よ》んで、どの かんようくか 思《おも》い出《だ》そう。',
      'かんようくを 思《おも》い出《だ》したら、その 中《なか》の 体《からだ》の 部分《ぶぶん》を 見《み》よう。',
      'ひみつや 話《はなし》に かかわる ものは 口《くち》、聞《き》く ことに かかわる ものは 耳《みみ》…のように 考《かんが》えよう。',
    ],
    explain: xs.map((x) => `「${x.mean.replace(/。$/, '')}」は「${x.text}」。`).join(''),
    identity: `idiom:body-sort:${s.id}`,
    alt: true,
  };
}

const ITEMS: Item[] = [
  ...matchItems(),
  ...IDIOMS.filter((x) => x.literal || x.koji).map(meaningChoice),
  ...IDIOMS.map(sceneItem),
  ...USAGE.map(usageItem),
  ...IDIOMS.filter((x) => x.body).map(bodyItem),
  ...BODY_SORTS.map(bodySortItem),
];

export const idioms: UnitSpec = {
  id: 'g4.ja.idioms',
  title: 'かんようく・こじせいご',
  stage: 'g4',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g3.ja.proverbs'],
  objectives: [
    { id: 'meaning', title: 'かんようく・こじせいごの 意味《いみ》を 知《し》る' },
    { id: 'use', title: '場面《ばめん》に 合《あ》う ことばを えらぶ' },
    { id: 'body', title: '体《からだ》の 部分《ぶぶん》を 使《つか》う かんようく' },
  ],
  misconceptions: [
    {
      id: 'id-literal',
      explain:
        'ことばの とおりの 意味《いみ》で 考《かんが》えたのかな。かんようくは、いくつかの ことばが 合《あ》わさって、べつの 意味《いみ》を 表《あらわ》すよ。「口《くち》が かたい」は、ものを かむ ことでは なく、ひみつを 話《はな》さない ことだよ。',
    },
    {
      id: 'id-body-mix',
      explain:
        '体《からだ》の 部分《ぶぶん》や、同《おな》じ 部分《ぶぶん》を 使《つか》う べつの かんようくと まちがえたのかな。「足《あし》を ひっぱる」と「手《て》を かす」のように、部分《ぶぶん》が かわると 意味《いみ》も かわるよ。',
    },
    {
      id: 'id-similar',
      explain:
        'にた 場面《ばめん》で 使《つか》う、べつの ことばと まちがえたのかな。それぞれの 意味《いみ》を くらべて、場面《ばめん》に いちばん ぴったりの ものを えらぼう。',
    },
    {
      id: 'id-polarity',
      explain:
        'よい 意味《いみ》と よくない 意味《いみ》を 取《と》りちがえたのかな。「鼻《はな》が 高《たか》い」は ほこらしい とき、「かたを 落《お》とす」は がっかりした ときだよ。',
    },
  ],
  levels: [
    { label: '意味と むすぶ', chance: 0.05 },
    { label: '場面に 合う ことば', chance: 0.05 },
    { label: '体の 部分の かんようく', chance: 0.05 },
  ],
  intro: [
    {
      text: '二《ふた》つ いじょうの ことばが 合《あ》わさって、もとの ことばとは べつの 意味《いみ》を 表《あらわ》す ものを「かんようく」と いいます。',
      figure: { kind: 'text', text: '手《て》を かす → 人《ひと》の する ことを 手《て》つだう', size: 'm' },
    },
    {
      text: '「目《め》」「口《くち》」「手《て》」「足《あし》」など、体《からだ》の 部分《ぶぶん》を 使《つか》う かんようくが たくさん あります。',
    },
    {
      text: '昔《むかし》の 中国《ちゅうごく》の 話《はなし》から 生《う》まれた ことばを「こじせいご」と いいます。「五十歩百歩《ごじっぽひゃっぽ》」は、たいした ちがいは ない と いう 意味《いみ》です。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第3学年及び第4学年 知識及び技能(3)イ（長い間使われてきたことわざや慣用句、故事成語などの意味を知り、使う）',
  revised: REVISED,
};
