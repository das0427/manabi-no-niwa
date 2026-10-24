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
    text: '足《あし》をひっぱる',
    mean: '人《ひと》のじゃまをして、うまくいかないようにする。',
    scene: 'わたしがボールを何度《なんど》も落《お》としたせいで、チームが負《ま》けそうになった。',
    conf: [
      ['te-kasu', 'id-polarity'],
      ['ashi-bou', 'id-similar'],
    ],
    literal: '人《ひと》の足《あし》を手《て》でつかんで引《ひ》く。',
    body: ['足《あし》', 'をひっぱる', ['手《て》', '口《くち》']],
  },
  {
    id: 'te-kasu',
    text: '手《て》をかす',
    mean: '人《ひと》のすることを手《て》つだう。',
    scene: 'おもいにもつを運《はこ》んでいる人《ひと》がいたので、いっしょに持《も》ってあげた。',
    conf: [
      ['ashi-hippa', 'id-polarity'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '自分《じぶん》の手《て》を人《ひと》にわたす。',
    body: ['手《て》', 'をかす', ['口《くち》', '目《め》']],
  },
  {
    id: 'te-hanase',
    text: '手《て》がはなせない',
    mean: 'いそがしくて、ほかのことをするひまがない。',
    scene:
      '父《ちち》は料理《りょうり》のとちゅうで、電話《でんわ》に出《で》ることができなかった。',
    conf: [
      ['te-kasu', 'id-body-mix'],
      ['me-nusumu', 'id-similar'],
    ],
    literal: 'のりでくっついて、手《て》がはなれない。',
    body: ['手《て》', 'がはなせない', ['目《め》', '口《くち》']],
  },
  {
    id: 'me-nai',
    text: '目《め》がない',
    mean: 'とても好《す》きで、それを見《み》るとがまんができない。',
    scene:
      '姉《あね》はあまいものが大好《だいす》きで、ケーキを見《み》るとすぐに食《た》べたくなる。',
    conf: [
      ['me-maru', 'id-body-mix'],
      ['yubi-kuwaeru', 'id-similar'],
    ],
    literal: '目《め》が見《み》えない。',
    body: ['目《め》', 'がない', ['鼻《はな》', '耳《みみ》']],
  },
  {
    id: 'me-maru',
    text: '目《め》を丸《まる》くする',
    mean: 'おどろいて、目《め》を大《おお》きく開《ひら》く。',
    scene: 'ぼうしの中《なか》から子《こ》ねこが出《で》てきて、みんなびっくりした。',
    conf: [
      ['me-nai', 'id-body-mix'],
      ['me-nusumu', 'id-body-mix'],
    ],
    literal: '目《め》のまわりに丸《まる》をかく。',
    body: ['目《め》', 'を丸《まる》くする', ['口《くち》', '手《て》']],
  },
  {
    id: 'mimi-utagau',
    text: '耳《みみ》をうたがう',
    mean: '聞《き》いたことがしんじられないほどおどろく。',
    scene:
      '「あしたから学校《がっこう》が三《みっ》か休《やす》み」と聞《き》いて、聞《き》きまちがいかと思《おも》った。',
    conf: [
      ['mimi-itai', 'id-body-mix'],
      ['kuchi-suberu', 'id-similar'],
    ],
    body: ['耳《みみ》', 'をうたがう', ['口《くち》', '鼻《はな》']],
  },
  {
    id: 'mimi-itai',
    text: '耳《みみ》がいたい',
    mean: '自分《じぶん》のよくないところを言《い》われて、聞《き》くのがつらい。',
    scene:
      '先生《せんせい》が「わすれ物《もの》に気《き》をつけよう。」と話《はな》したとき、わすれ物《もの》が多《おお》いぼくはドキッとした。',
    conf: [
      ['mimi-utagau', 'id-body-mix'],
      ['kuchi-katai', 'id-similar'],
    ],
    literal: '耳《みみ》をけがしていたむ。',
    body: ['耳《みみ》', 'がいたい', ['目《め》', '鼻《はな》']],
  },
  {
    id: 'kuchi-katai',
    text: '口《くち》がかたい',
    mean: 'ひみつをほかの人《ひと》に話《はな》さない。',
    scene: 'けんたは、たのまれたないしょの話《はなし》をだれにも言《い》わない。',
    conf: [
      ['kuchi-suberu', 'id-polarity'],
      ['mimi-itai', 'id-similar'],
    ],
    literal: 'かたいものをよくかむ。',
    body: ['口《くち》', 'がかたい', ['耳《みみ》', '手《て》']],
  },
  {
    id: 'kuchi-suberu',
    text: '口《くち》がすべる',
    mean: '言《い》ってはいけないことを、うっかり言《い》ってしまう。',
    scene: '弟《おとうと》は、母《はは》にないしょのプレゼントのことをつい話《はな》してしまった。',
    conf: [
      ['kuchi-katai', 'id-polarity'],
      ['ashi-hippa', 'id-similar'],
    ],
    literal: 'すべってころび、口《くち》をぶつける。',
    body: ['口《くち》', 'がすべる', ['目《め》', '耳《みみ》']],
  },
  {
    id: 'hana-takai',
    text: '鼻《はな》が高《たか》い',
    mean: 'ほこらしくて、とくいな気持《きも》ちになる。',
    scene:
      '妹《いもうと》の絵《え》が金《きん》しょうをとって、家族《かぞく》みんながうれしくほこらしかった。',
    conf: [
      ['kata-otosu', 'id-polarity'],
      ['me-nai', 'id-body-mix'],
    ],
    literal: '鼻《はな》の形《かたち》がすっと高《たか》い。',
    body: ['鼻《はな》', 'が高《たか》い', ['顔《かお》', '首《くび》']],
  },
  {
    id: 'kao-hiroi',
    text: '顔《かお》が広《ひろ》い',
    mean: '知《し》り合《あ》いがたくさんいる。',
    scene: 'おじさんが町《まち》を歩《ある》くと、あちこちで声《こえ》をかけられる。',
    conf: [
      ['hana-takai', 'id-body-mix'],
      ['uma-au', 'id-similar'],
    ],
    literal: '顔《かお》のはばが大《おお》きい。',
    body: ['顔《かお》', 'が広《ひろ》い', ['耳《みみ》', '口《くち》']],
  },
  {
    id: 'atama-kakaeru',
    text: '頭《あたま》をかかえる',
    mean: 'こまって、どうしたらよいかなやむ。',
    scene: '算数《さんすう》の問題《もんだい》がどうしてもとけず、ずっとなやんでいる。',
    conf: [
      ['kubi-nagaku', 'id-body-mix'],
      ['saji-nageru', 'id-similar'],
    ],
    literal: '頭《あたま》がいたくなる。',
    body: ['頭《あたま》', 'をかかえる', ['足《あし》', '目《め》']],
  },
  {
    id: 'kubi-nagaku',
    text: '首《くび》を長《なが》くする',
    mean: '楽《たの》しみにして、今《いま》か今《いま》かと待《ま》つ。',
    scene:
      'おばあちゃんからとどく手紙《てがみ》を、毎日《まいにち》楽《たの》しみに待《ま》っている。',
    conf: [
      ['ki-nagai', 'id-similar'],
      ['atama-kakaeru', 'id-body-mix'],
    ],
    literal: '首《くび》をのばして、せを高《たか》く見《み》せる。',
    body: ['首《くび》', 'を長《なが》くする', ['手《て》', '鼻《はな》']],
  },
  {
    id: 'kata-otosu',
    text: 'かたを落《お》とす',
    mean: 'がっかりして、元気《げんき》をなくす。',
    scene: 'あと少《すこ》しのところでしあいに負《ま》けて、兄《あに》はしょんぼりしている。',
    conf: [
      ['mune-haru', 'id-polarity'],
      ['hana-takai', 'id-polarity'],
    ],
    body: ['かた', 'を落《お》とす', ['手《て》', '首《くび》']],
  },
  {
    id: 'mune-haru',
    text: 'むねをはる',
    mean: 'じしんをもって、どうどうとする。',
    scene:
      'たくさん練習《れんしゅう》したゆかは、ステージに立《た》つと、まっすぐ前《まえ》を見《み》て話《はな》しはじめた。',
    conf: [
      ['kata-otosu', 'id-polarity'],
      ['atama-kakaeru', 'id-similar'],
    ],
    body: ['むね', 'をはる', ['口《くち》', '目《め》']],
  },
  {
    id: 'hara-tateru',
    text: 'はらを立《た》てる',
    mean: 'おこる。',
    scene:
      'だいじな本《ほん》を弟《おとうと》にだまって持《も》ち出《だ》されて、ひろしは顔《かお》を赤《あか》くしてどなった。',
    conf: [
      ['mimi-itai', 'id-similar'],
      ['kata-otosu', 'id-similar'],
    ],
    body: ['はら', 'を立《た》てる', ['手《て》', '目《め》']],
  },
  {
    id: 'ha-tatanai',
    text: '歯《は》が立《た》たない',
    mean: '相手《あいて》が強《つよ》すぎて、まったくかなわない。',
    scene: 'しょうぎの名人《めいじん》と対《たい》せんしたが、どうがんばっても勝《か》てなかった。',
    conf: [
      ['atama-kakaeru', 'id-similar'],
      ['hone-oru', 'id-similar'],
    ],
    literal: '歯《は》がいたくて、ものがかめない。',
    body: ['歯《は》', 'が立《た》たない', ['手《て》', '首《くび》']],
  },
  {
    id: 'te-ase',
    text: '手《て》にあせをにぎる',
    mean: 'どうなるかと、はらはらしながら見《み》る。',
    scene: 'リレーのさいごで二人《ふたり》がならび、ドキドキしながらおうえんした。',
    conf: [
      ['mune-haru', 'id-similar'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '暑《あつ》くて、手《て》があせでぬれる。',
    body: ['手《て》', 'にあせをにぎる', ['足《あし》', '頭《あたま》']],
  },
  {
    id: 'ashi-bou',
    text: '足《あし》がぼうになる',
    mean: '長《なが》いあいだ歩《ある》いたり立《た》ったりして、足《あし》がとてもつかれる。',
    scene:
      '遠足《えんそく》で一日《いちにち》じゅう山道《やまみち》を歩《ある》き、もう一歩《いっぽ》も歩《ある》けない。',
    conf: [
      ['ashi-hippa', 'id-body-mix'],
      ['hone-oru', 'id-similar'],
    ],
    literal: '足《あし》がかたい木《き》のぼうにかわる。',
    body: ['足《あし》', 'がぼうになる', ['手《て》', '首《くび》']],
  },
  {
    id: 'me-nusumu',
    text: '目《め》をぬすむ',
    mean: '人《ひと》に見《み》つからないように、こっそりする。',
    scene:
      '弟《おとうと》は、母《はは》が見《み》ていないすきに、おかしを一《ひと》つ食《た》べた。',
    conf: [
      ['me-nai', 'id-body-mix'],
      ['kuchi-suberu', 'id-similar'],
    ],
    body: ['目《め》', 'をぬすむ', ['口《くち》', '耳《みみ》']],
  },
  {
    id: 'hone-oru',
    text: 'ほねをおる',
    mean: '人《ひと》のために、苦労《くろう》して力《ちから》をつくす。',
    scene:
      'ゆうきは、クラスのみんなが楽《たの》しめるように、何日《なんにち》もかけてお楽《たの》しみ会《かい》のじゅんびをした。',
    conf: [
      ['te-kasu', 'id-similar'],
      ['abura-uru', 'id-polarity'],
    ],
    literal: 'ころんでほねがおれる。',
    body: ['ほね', 'をおる', ['手《て》', '足《あし》']],
  },
  {
    id: 'shita-maku',
    text: 'したをまく',
    mean: 'あまりにすばらしくて、とてもかんしんする。',
    scene:
      '小学生《しょうがくせい》のピアノがとても上手《じょうず》で、聞《き》いていた大人《おとな》たちは「すばらしい。」と何度《なんど》もうなずいた。',
    conf: [
      ['hana-takai', 'id-similar'],
      ['mimi-utagau', 'id-similar'],
    ],
    body: ['した', 'をまく', ['手《て》', '首《くび》']],
  },
  {
    id: 'yubi-kuwaeru',
    text: '指《ゆび》をくわえる',
    mean: 'ほしいのに手《て》が出《だ》せず、ただ見《み》ている。',
    scene:
      'おもちゃ屋《や》の前《まえ》で、ほしいロボットをながめているが、お金《かね》が足《た》りない。',
    conf: [
      ['me-nai', 'id-similar'],
      ['te-hanase', 'id-body-mix'],
    ],
    literal: '指《ゆび》を口《くち》に入《い》れてすう。',
    body: ['指《ゆび》', 'をくわえる', ['足《あし》', '耳《みみ》']],
  },
  {
    id: 'iki-nomu',
    text: '息《いき》をのむ',
    mean: 'はっとおどろいて、息《いき》を止《と》める。',
    scene:
      'がけの上《うえ》から見《み》えた夕日《ゆうひ》のけしきがあまりにきれいで、みんなしずかになった。',
    conf: [
      ['te-ase', 'id-similar'],
      ['kata-otosu', 'id-similar'],
    ],
    literal: '大《おお》きく息《いき》をすいこむれんしゅうをする。',
  },
  {
    id: 'abura-uru',
    text: '油《あぶら》を売《う》る',
    mean: 'しごとや用事《ようじ》のとちゅうで、むだ話《ばなし》をしてなまける。',
    scene:
      'おつかいのとちゅうで、友《とも》だちと長《なが》いあいだおしゃべりして、なかなか帰《かえ》らなかった。',
    conf: [
      ['hone-oru', 'id-polarity'],
      ['hane-nobasu', 'id-similar'],
    ],
    literal: '店《みせ》で油《あぶら》を売《う》るしごとをする。',
  },
  {
    id: 'hane-nobasu',
    text: '羽《はね》をのばす',
    mean: '気《き》をつかう人《ひと》がいなくて、のびのびとすごす。',
    scene: 'テストが終《お》わった週末《しゅうまつ》、ゆっくり好《す》きなことをしてすごした。',
    conf: [
      ['abura-uru', 'id-similar'],
      ['mizu-nagasu', 'id-similar'],
    ],
    literal: '鳥《とり》がつばさを広《ひろ》げる。',
  },
  {
    id: 'saji-nageru',
    text: 'さじを投《な》げる',
    mean: 'これ以上《いじょう》よくならないと、あきらめる。',
    scene:
      'こわれたラジオを何度《なんど》も直《なお》そうとしたが、とうとう直《なお》すのをやめてしまった。',
    conf: [
      ['atama-kakaeru', 'id-similar'],
      ['mizu-nagasu', 'id-similar'],
    ],
    literal: 'スプーンを遠《とお》くへほうる。',
  },
  {
    id: 'uma-au',
    text: '馬《うま》が合《あ》う',
    mean: '気《き》が合《あ》って、いっしょにいるとうまくいく。',
    scene:
      'たくみとそうたは、はじめて会《あ》った日《ひ》から話《はなし》がはずみ、すぐになかよくなった。',
    conf: [
      ['kao-hiroi', 'id-similar'],
      ['ki-nagai', 'id-similar'],
    ],
    literal: '馬《うま》に乗《の》るのが上手《じょうず》だ。',
  },
  {
    id: 'neko-te',
    text: 'ねこの手《て》もかりたい',
    mean: 'とてもいそがしくて、だれでもよいから手《て》つだってほしい。',
    scene:
      '店《みせ》にお客《きゃく》さんがどっと来《き》て、店《みせ》の人《ひと》は休《やす》むひまもなく大《おお》いそがしだ。',
    conf: [
      ['te-kasu', 'id-similar'],
      ['hone-oru', 'id-similar'],
    ],
    literal: 'ねこから何《なに》かをかりる。',
  },
  {
    id: 'ki-nagai',
    text: '気《き》が長《なが》い',
    mean: 'のんびりしていて、あせらない。',
    scene:
      'つりが好《す》きなおじいさんは、魚《さかな》がかかるまで、何時間《なんじかん》でもじっと待《ま》つ。',
    conf: [
      // 「首を長くする」は「待つ」場面で紛らわしいので選択肢にしない（内容レビュー）
      ['te-ase', 'id-similar'],
      ['hara-tateru', 'id-polarity'],
    ],
  },
  {
    id: 'zu-noru',
    text: '図《ず》にのる',
    mean: 'うまくいって、ちょうしにのる。',
    scene: 'ほめられた弟《おとうと》はうれしくなって、どんどんいばりはじめた。',
    conf: [
      ['hana-takai', 'id-similar'],
      ['mune-haru', 'id-similar'],
    ],
    literal: '大《おお》きな図《ず》の上《うえ》に乗《の》る。',
  },
  {
    id: 'mizu-nagasu',
    text: '水《みず》に流《なが》す',
    mean: '前《まえ》にあったいやなことを、なかったことにする。',
    scene:
      'けんかをした二人《ふたり》は、「もう気《き》にしないでおこう。」とあく手《しゅ》をした。',
    conf: [
      ['saji-nageru', 'id-similar'],
      ['hara-tateru', 'id-polarity'],
    ],
    literal: 'いらないものを川《かわ》に流《なが》してすてる。',
  },
  // ---- こじせいご（昔の 中国《ちゅうごく》の 話《はなし》から できた ことば） ----
  {
    id: 'gojippo',
    text: '五十歩百歩《ごじっぽひゃっぽ》',
    mean: '少《すこ》しのちがいはあっても、たいしたちがいはない。',
    scene:
      'テストで五点《ごてん》だった兄《あに》が、三点《さんてん》だった弟《おとうと》をわらったが、どちらも同《おな》じようなものだ。',
    conf: [
      ['gyofu', 'id-similar'],
      ['dasoku', 'id-similar'],
    ],
    literal: '五十歩《ごじっぽ》より百歩《ひゃっぽ》のほうがずっと長《なが》く歩《ある》ける。',
    koji: true,
  },
  {
    id: 'gyofu',
    text: '漁夫《ぎょふ》の利《り》',
    mean: '二人《ふたり》があらそっているあいだに、ほかの人《ひと》がとくをする。',
    scene:
      '兄《あに》と姉《あね》が最後《さいご》のケーキをとりあっているすきに、妹《いもうと》が食《た》べてしまった。',
    conf: [
      ['gojippo', 'id-similar'],
      ['tazan', 'id-similar'],
    ],
    literal: '魚《さかな》をとる人《ひと》が、たくさんもうける。',
    koji: true,
  },
  {
    id: 'mujun',
    text: 'むじゅん',
    mean: '前《まえ》とあとで、言《い》うことやすることのつじつまが合《あ》わない。',
    scene:
      '「夜《よる》はおかしを食《た》べない。」と言《い》った父《ちち》が、その夜《よる》におかしを食《た》べていた。',
    conf: [
      ['dasoku', 'id-similar'],
      ['kiyuu', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'dasoku',
    text: 'だそく',
    mean: 'なくてもよい、よけいなつけたし。',
    scene:
      'きれいにかけた絵《え》に、さらにたくさん字《じ》を書《か》きこんで、かえって見《み》にくくなった。',
    conf: [
      ['suikou', 'id-similar'],
      ['mujun', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'tazan',
    text: '他山《たざん》の石《いし》',
    mean: '人《ひと》のよくない行《おこな》いも、自分《じぶん》をよくするための手《て》がかりになる。',
    scene:
      '友《とも》だちがろうかを走《はし》ってころんだのを見《み》て、自分《じぶん》も気《き》をつけようと思《おも》った。',
    conf: [
      ['gyofu', 'id-similar'],
      ['kiyuu', 'id-similar'],
    ],
    literal: 'よその山《やま》にある、めずらしい石《いし》。',
    koji: true,
  },
  {
    id: 'suikou',
    text: 'すいこう',
    mean: '文章《ぶんしょう》を何度《なんど》も読《よ》み返《かえ》して、よりよく直《なお》す。',
    scene:
      '作文《さくぶん》を書《か》き終《お》えたあと、ことばをえらび直《なお》して、何度《なんど》も書《か》き直《なお》した。',
    conf: [
      ['dasoku', 'id-similar'],
      ['mujun', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'kiyuu',
    text: 'きゆう',
    mean: 'しんぱいしなくてもよいことを、あれこれしんぱいする。',
    scene:
      'あしたの遠足《えんそく》が雨《あめ》になるかと夜《よる》までずっと気《き》にしていたが、朝《あさ》はよく晴《は》れた。',
    conf: [
      ['mujun', 'id-similar'],
      ['saiou', 'id-similar'],
    ],
    koji: true,
  },
  {
    id: 'saiou',
    text: 'さいおうが馬《うま》',
    mean: 'よいことと悪《わる》いことは、あとにならないとわからない。',
    scene:
      'けがで試合《しあい》に出《で》られなかったが、その間《あいだ》に本《ほん》をたくさん読《よ》み、作文《さくぶん》でしょうをもらった。',
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
  if (!x) throw new Error(`idioms: ${id}が無い`);
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
      prompt: 'ことばと意味《いみ》を線《せん》でむすぼう。',
      left: four.map((x) => ({ label: x.text })),
      right: [...four.map((x) => ({ label: x.mean })), { label: extra }],
      pairs: four.map((_, i) => [i, i] as [number, number]),
      ...(litIdx >= 0
        ? { wrongPairs: [{ pair: [litIdx, 4] as [number, number], misconception: 'id-literal' }] }
        : {}),
      hints: [
        'わかるものからむすんでいこう。のこったものが考《かんが》えやすくなるよ。',
        'ことばのとおりの意味《いみ》ではないことが多《おお》いよ。',
        'それぞれのことばを、どんなときに使《つか》うかな。人《ひと》のようすや気持《きも》ちを思《おも》いうかべて、のこりの一《ひと》つまでしぼろう。',
      ],
      explain: four
        .map((x) => `「${x.text}」は「${x.mean.replace(/。$/, '')}」という意味《いみ》です。`)
        .join(''),
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
    prompt: `「${x.text}」の意味《いみ》はどれですか。`,
    options: opts(x.mean, wrongs),
    layout: 'column',
    hints: [
      `${word(x)}は、ことばのとおりの意味《いみ》ではないことが多《おお》いよ。`,
      x.koji
        ? 'こじせいごは、昔《むかし》の中国《ちゅうごく》の話《はなし》から生《う》まれたことばだよ。'
        : 'どんな場面《ばめん》で使《つか》うことばかを思《おも》いうかべよう。',
      `たとえばこんなときに使《つか》うよ: ${x.scene}`,
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」という意味《いみ》です。${x.literal ? '字《じ》のとおりの意味《いみ》ではありません。' : ''}`,
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
    prompt: `この場面《ばめん》に合《あ》う${word(x)}はどれですか。`,
    figure: { kind: 'text', text: x.scene, size: 'm' },
    options: opts(
      x.text,
      x.conf.map(([cid, m]) => [get(cid).text, m] as Wrong),
    ),
    hints: [
      '場面《ばめん》の人《ひと》が、どんなようすか、どんな気持《きも》ちかを考《かんが》えよう。',
      `えらぶことばの意味《いみ》を一《ひと》つずつ思《おも》い出《だ》そう。`,
      'えらぶことばを一《ひと》つずつ場面《ばめん》の文《ぶん》にあてはめて、人《ひと》のようすや気持《きも》ちとぴったり合《あ》うかたしかめよう。字《じ》のとおりの意味《いみ》で考《かんが》えないようにね。',
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」という意味《いみ》なので、この場面《ばめん》に合《あ》います。`,
    identity: `idiom:scene:${x.id}`,
  };
}

/** 別例: 正しい 使い方の 文を 選ぶ */
const USAGE: { id: string; ok: string; wrong: Wrong[] }[] = [
  {
    id: 'kuchi-katai',
    ok: '弟《おとうと》は口《くち》がかたいので、ひみつを話《はな》してもだいじょうぶだ。',
    wrong: [
      ['このパンは口《くち》がかたいので、よくかんで食《た》べよう。', 'id-literal'],
      ['姉《あね》は口《くち》がかたいので、すぐにひみつを言《い》ってしまう。', 'id-polarity'],
    ],
  },
  {
    id: 'hana-takai',
    ok: 'リレーで一位《いちい》になった兄《あに》を見《み》て、ぼくも鼻《はな》が高《たか》かった。',
    wrong: [
      [
        'この人形《にんぎょう》は、鼻《はな》が高《たか》くて顔《かお》が細長《ほそなが》い。',
        'id-literal',
      ],
      ['テストで0点《れいてん》をとって、鼻《はな》が高《たか》かった。', 'id-polarity'],
    ],
  },
  {
    id: 'saji-nageru',
    ok: 'どんなに教《おし》えてもできないので、コーチはさじを投《な》げてしまった。',
    wrong: [
      ['父《ちち》は台所《だいどころ》でさじを投《な》げて、スープをまぜた。', 'id-literal'],
      ['あきらめずにさじを投《な》げて、さいごまでがんばった。', 'id-polarity'],
    ],
  },
  {
    id: 'ki-nagai',
    ok: 'ゆみは気《き》が長《なが》いので、パズルができるまであわてずにつづける。',
    wrong: [
      ['ゆみは気《き》が長《なが》いので、すぐにおこってしまう。', 'id-polarity'],
      [
        'ゆみは気《き》が長《なが》いので、あしたの遠足《えんそく》が待《ま》ちきれない。',
        'id-similar',
      ],
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
    prompt: `「${x.text}」の使《つか》い方《かた》が正《ただ》しい文《ぶん》はどれですか。`,
    options: opts(u.ok, u.wrong),
    layout: 'column',
    hints: [
      `まず「${x.text}」の意味《いみ》を思《おも》い出《だ》そう。`,
      'ことばのとおりの意味《いみ》で使《つか》っている文《ぶん》はないかな。',
      '意味《いみ》がはんたいになっている文《ぶん》もないかたしかめよう。',
    ],
    explain: `「${x.text}」は「${x.mean.replace(/。$/, '')}」という意味《いみ》です。その意味《いみ》で使《つか》っている文《ぶん》が正《ただ》しい使《つか》い方《かた》です。`,
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
    prompt: '{{}}に入《はい》る体《からだ》の部分《ぶぶん》をえらぼう。',
    text: `{{}}${rest}（${x.mean.replace(/。$/, '')}）`,
    options: [part, ...wrongs],
    blanks: [
      {
        answers: [part],
        wrong: wrongs.map((value) => ({ value, misconception: 'id-body-mix' })),
      },
    ],
    hints: [
      '（）の中《なか》の意味《いみ》を読《よ》もう。',
      'そのようすのとき、体《からだ》のどこがかかわりそうかな。',
      `「〜${rest.trim()}」という言《い》い方《かた》を聞《き》いたことはあるかな。体《からだ》の部分《ぶぶん》を一《ひと》つずつ当《あ》てはめてみよう。`,
    ],
    explain: `「${x.text}」です。「${x.mean.replace(/。$/, '')}」という意味《いみ》のかんようくです。`,
    identity: `idiom:body:${x.id}`,
  };
}

/** 別例: 意味を 体の 部分ごとに 分ける（sort） */
const BODY_SORTS: { id: string; boxes: string[]; items: string[] }[] = [
  {
    id: 'me-mimi-kuchi',
    boxes: ['目《め》', '耳《みみ》', '口《くち》'],
    items: [
      'me-nai',
      'me-maru',
      'me-nusumu',
      'mimi-utagau',
      'mimi-itai',
      'kuchi-katai',
      'kuchi-suberu',
    ],
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
    prompt:
      'どの体《からだ》の部分《ぶぶん》を使《つか》うかんようくの意味《いみ》かな。分《わ》けよう。',
    boxes: s.boxes.map((label) => ({ label })),
    cards: xs.map((x) => ({
      label: x.mean,
      box: s.boxes.indexOf(x.body![0]),
    })),
    hints: [
      '意味《いみ》を読《よ》んで、どのかんようくか思《おも》い出《だ》そう。',
      'かんようくを思《おも》い出《だ》したら、その中《なか》の体《からだ》の部分《ぶぶん》を見《み》よう。',
      'ひみつや話《はなし》にかかわるものは口《くち》、聞《き》くことにかかわるものは耳《みみ》…のように考《かんが》えよう。',
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
    { id: 'meaning', title: 'かんようく・こじせいごの意味《いみ》を知《し》る' },
    { id: 'use', title: '場面《ばめん》に合《あ》うことばをえらぶ' },
    { id: 'body', title: '体《からだ》の部分《ぶぶん》を使《つか》うかんようく' },
  ],
  misconceptions: [
    {
      id: 'id-literal',
      explain:
        'ことばのとおりの意味《いみ》で考《かんが》えたのかな。かんようくは、いくつかのことばが合《あ》わさって、べつの意味《いみ》を表《あらわ》すよ。「口《くち》がかたい」は、ものをかむことではなく、ひみつを話《はな》さないことだよ。',
    },
    {
      id: 'id-body-mix',
      explain:
        '体《からだ》の部分《ぶぶん》や、同《おな》じ部分《ぶぶん》を使《つか》うべつのかんようくとまちがえたのかな。「足《あし》をひっぱる」と「手《て》をかす」のように、部分《ぶぶん》がかわると意味《いみ》もかわるよ。',
    },
    {
      id: 'id-similar',
      explain:
        'にた場面《ばめん》で使《つか》う、べつのことばとまちがえたのかな。それぞれの意味《いみ》をくらべて、場面《ばめん》にいちばんぴったりのものをえらぼう。',
    },
    {
      id: 'id-polarity',
      explain:
        'よい意味《いみ》とよくない意味《いみ》を取《と》りちがえたのかな。「鼻《はな》が高《たか》い」はほこらしいとき、「かたを落《お》とす」はがっかりしたときだよ。',
    },
  ],
  levels: [
    { label: '意味とむすぶ', chance: 0.05 },
    { label: '場面に合うことば', chance: 0.05 },
    { label: '体の部分のかんようく', chance: 0.05 },
  ],
  intro: [
    {
      text: '二《ふた》ついじょうのことばが合《あ》わさって、もとのことばとはべつの意味《いみ》を表《あらわ》すものを「かんようく」といいます。',
      figure: {
        kind: 'text',
        text: '手《て》をかす→人《ひと》のすることを手《て》つだう',
        size: 'm',
      },
    },
    {
      text: '「目《め》」「口《くち》」「手《て》」「足《あし》」など、体《からだ》の部分《ぶぶん》を使《つか》うかんようくがたくさんあります。',
    },
    {
      text: '昔《むかし》の中国《ちゅうごく》の話《はなし》から生《う》まれたことばを「こじせいご」といいます。「五十歩百歩《ごじっぽひゃっぽ》」は、たいしたちがいはないという意味《いみ》です。',
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）国語第3学年及び第4学年知識及び技能(3)イ（長い間使われてきたことわざや慣用句、故事成語などの意味を知り、使う）',
  revised: REVISED,
};
