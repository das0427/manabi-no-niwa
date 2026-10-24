/**
 * g1.ja.listen よく きいて えらぼう（はなしを きいて だいじな ことを えらぶ。curriculum-matrix 3.4）。
 * 音声が 問題の 本体（listen）。はなしの 文は ふだん 画面に 出さない。
 *
 * 到達項目:
 *   one   … ようけん 1つを ききとる。別例: えの せんたくし
 *   two   … ようけん 2つ（もちもの 2つ、じかんと ばしょ など）を ききとる。別例: えの せんたくし・いくつ あったか
 *   order … ききながら じゅんじょを とらえる（さいしょ・つぎ・さいご）。別例: えの せんたくし
 * 同一性キー: はなし × といの くみ。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { ListenItem } from '../../engines/listen/listen';
import { REVISED } from './util';

interface Opt {
  label: string;
  illust?: string;
  correct?: boolean;
  mis?: string;
}

interface Q {
  id: string;
  objective: 'one' | 'two' | 'order';
  talk: string;
  prompt: string;
  options: Opt[];
  multi?: boolean;
  /** せんたくしを ならべかえない（かずの じゅん） */
  fixed?: boolean;
  alt?: boolean;
  /** ヒント②（ききどころ）・③（とちゅうまで） */
  h2: string;
  h3: string;
  explain: string;
}

const LV = { one: 0, two: 1, order: 2 } as const;

function toOptions(os: Opt[]): ChoiceOption[] {
  return os.map((o) => ({
    label: o.label,
    ...(o.illust ? { figure: { kind: 'illust' as const, id: o.illust } } : {}),
    ...(o.correct ? { correct: true } : {}),
    ...(o.mis ? { misconception: o.mis } : {}),
  }));
}

const c = (label: string, illust?: string): Opt => ({ label, illust, correct: true });
const w = (label: string, mis: string, illust?: string): Opt => ({ label, illust, mis });
/** はなしに でて きた べつの ことば */
const said = (label: string, illust?: string) => w(label, 'mentioned-other', illust);
/** はなしに でて こない ことば */
const notSaid = (label: string, illust?: string) => w(label, 'not-said', illust);

const QS: Q[] = [
  // ---- one: ようけん 1つ ----
  {
    id: 'one-taiso',
    objective: 'one',
    talk: 'あしたは そとで たいそうを します。たいそうふくを もって きて ください。',
    prompt: 'もって くる ものは なに？',
    options: [c('たいそうふく'), said('たいそう'), notSaid('すいとう')],
    h2: '「もって きて ください」の まえを よく きこう。',
    h3: '「たい…」で はじまる もちものだよ。',
    explain: '「たいそうふくを もって きて ください。」と いって いたね。',
  },
  {
    id: 'one-library',
    objective: 'one',
    talk: 'きょうの 3じかんめは、としょしつで ほんを よみます。',
    prompt: 'ほんを よむ ばしょは どこ？',
    options: [c('としょしつ'), notSaid('きょうしつ'), notSaid('たいいくかん')],
    h2: '「ほんを よみます」の まえを きこう。',
    h3: '「と」で はじまる ばしょ だよ。',
    explain: '「としょしつで ほんを よみます。」と いって いたね。',
  },
  {
    id: 'one-time',
    objective: 'one',
    talk: 'あしたの えんそくは、あさ 8じに こうていに あつまります。',
    prompt: 'あつまる じかんは なんじ？',
    options: [c('8じ'), notSaid('9じ'), notSaid('10じ')],
    h2: '「あつまります」の まえに じかんが あるよ。',
    h3: '「あさ …じに」と いって いたよ。',
    explain: '「あさ 8じに こうていに あつまります。」と いって いたね。',
  },
  {
    id: 'one-rain',
    objective: 'one',
    talk: 'ごごから あめが ふるそうです。かえりは かさを さして かえりましょう。',
    prompt: 'かえりに つかう ものは なに？',
    options: [c('かさ'), said('あめ'), notSaid('ぼうし')],
    h2: '「さして かえりましょう」の まえを きこう。',
    h3: 'あめの ひに さす もの だよ。',
    explain: '「かさを さして かえりましょう。」と いって いたね。',
  },
  {
    id: 'one-feed',
    objective: 'one',
    talk: 'きょうの いきもの がかりは、うさぎに にんじんを あげて ください。',
    prompt: 'うさぎに あげる ものは なに？',
    options: [c('にんじん'), notSaid('キャベツ'), said('うさぎ')],
    h2: '「あげて ください」の まえを きこう。',
    h3: 'オレンジいろで ながい やさい だよ。',
    explain: '「うさぎに にんじんを あげて ください。」と いって いたね。',
  },
  {
    id: 'one-who',
    objective: 'one',
    talk: 'まどを あけるのは、きょうの にっちょくの はなこさんです。',
    prompt: 'まどを あけるのは だれ？',
    options: [c('はなこさん'), notSaid('たろうさん'), notSaid('せんせい')],
    h2: '「まどを あけるのは」の あとを きこう。',
    h3: '「は」で はじまる なまえ だよ。',
    explain: '「にっちょくの はなこさんです。」と いって いたね。',
  },
  {
    id: 'one-pool',
    objective: 'one',
    talk: 'あしたは プールが あります。みずぎと タオルを わすれないで ください。でも、ぼうしは いりません。',
    prompt: 'いらない ものは なに？',
    options: [c('ぼうし'), said('みずぎ'), said('タオル')],
    h2: '「いりません」の まえを きこう。',
    h3: '「でも、…は いりません」と いって いたよ。',
    explain: '「ぼうしは いりません。」と いって いたね。みずぎと タオルは もって いくよ。',
  },
  {
    id: 'one-day',
    objective: 'one',
    talk: 'つぎの かようびに、みんなで いもほりに いきます。',
    prompt: 'いもほりに いくのは なんようび？',
    options: [c('かようび'), notSaid('げつようび'), notSaid('すいようび')],
    h2: '「いもほりに いきます」の まえを きこう。',
    h3: '「か」で はじまる ようび だよ。',
    explain: '「つぎの かようびに」と いって いたね。',
  },
  {
    id: 'one-shoes',
    objective: 'one',
    talk: 'うんどうじょうで あそぶ ときは、うわばきから くつに はきかえましょう。',
    prompt: 'うんどうじょうで はく ものは なに？',
    options: [c('くつ'), said('うわばき'), notSaid('ながぐつ')],
    h2: '「はきかえましょう」の まえを きこう。',
    h3: '「…から くつに」と いって いたよ。',
    explain: '「うわばきから くつに はきかえましょう。」と いって いたね。',
  },
  // one の 別例（えの せんたくし）
  {
    id: 'one-alt-ball',
    objective: 'one',
    alt: true,
    talk: 'ひるやすみに ボールを つかう ひとは、たいいくそうこから だして ください。',
    prompt: 'ひるやすみに つかう ものは どれ？',
    options: [c('ボール', 'ball'), notSaid('かさ', 'umbrella'), notSaid('はさみ', 'scissors')],
    h2: '「つかう ひとは」の まえを きこう。',
    h3: 'まるくて、なげたり けったり する もの だよ。',
    explain: '「ボールを つかう ひとは」と いって いたね。',
  },
  {
    id: 'one-alt-pencil',
    objective: 'one',
    alt: true,
    talk: 'テストの ときは、えんぴつを 2ほん だして おいて ください。',
    prompt: 'だして おく ものは どれ？',
    options: [
      c('えんぴつ', 'pencil'),
      notSaid('はさみ', 'scissors'),
      notSaid('ノート', 'notebook'),
    ],
    h2: '「だして おいて ください」の まえを きこう。',
    h3: 'じを かく ときに つかう もの だよ。',
    explain: '「えんぴつを 2ほん だして おいて ください。」と いって いたね。',
  },
  {
    id: 'one-alt-bus',
    objective: 'one',
    alt: true,
    talk: 'えんそくには、でんしゃでは なく バスに のって いきます。',
    prompt: 'えんそくで のる ものは どれ？',
    options: [c('バス', 'bus-yellow'), said('でんしゃ', 'train'), notSaid('ふね', 'ship')],
    h2: '「のって いきます」の まえを きこう。',
    h3: '「…では なく」の あとが こたえ だよ。',
    explain: '「でんしゃでは なく バスに のって いきます。」と いって いたね。',
  },

  // ---- two: ようけん 2つ ----
  {
    id: 'two-hat',
    objective: 'two',
    multi: true,
    talk: 'あした もって くるのは、ぼうしと すいとうです。',
    prompt: 'もって くる ものを 2つ えらぼう。',
    options: [c('ぼうし'), c('すいとう'), notSaid('おべんとう'), notSaid('かさ')],
    h2: '「もって くるのは」の あとを きこう。',
    h3: '1つめは 「ぼうし」。もう 1つ あるよ。',
    explain: '「ぼうしと すいとうです。」と いって いたね。',
  },
  {
    id: 'two-art',
    objective: 'two',
    multi: true,
    talk: 'ずこうの じかんに、クレヨンと がようしを つかいます。のりは つかいません。',
    prompt: 'つかう ものを 2つ えらぼう。',
    options: [c('クレヨン'), c('がようし'), said('のり'), notSaid('はさみ')],
    h2: '「つかいます」と 「つかいません」を ききわけよう。',
    h3: '「つかいません」と いったのは 1つ だけ だよ。',
    explain: '「クレヨンと がようしを つかいます。」と いって いたね。のりは つかわないよ。',
  },
  {
    id: 'two-park',
    objective: 'two',
    multi: true,
    talk: 'きょうは、こうえんで おにごっこと なわとびを しました。',
    prompt: 'こうえんで した ことを 2つ えらぼう。',
    options: [c('おにごっこ'), c('なわとび'), notSaid('すなあそび'), notSaid('ボールあそび')],
    h2: '「しました」の まえを きこう。',
    h3: '1つめは 「おにごっこ」。もう 1つ あるよ。',
    explain: '「おにごっこと なわとびを しました。」と いって いたね。',
  },
  {
    id: 'two-shop',
    objective: 'two',
    multi: true,
    talk: 'おつかいを たのみます。パンと ぎゅうにゅうを かって きてね。',
    prompt: 'かって くる ものを 2つ えらぼう。',
    options: [c('パン'), c('ぎゅうにゅう'), notSaid('たまご'), notSaid('バナナ')],
    h2: '「かって きてね」の まえを きこう。',
    h3: '1つめは 「パン」。もう 1つ あるよ。',
    explain: '「パンと ぎゅうにゅうを かって きてね。」と いって いたね。',
  },
  {
    id: 'two-meet-time',
    objective: 'two',
    talk: 'えんそくの ひは、あさ 8じはんに、こうもんの まえに あつまります。',
    prompt: 'あつまる じかんは？',
    options: [c('8じはん'), notSaid('8じ'), notSaid('9じはん')],
    h2: '「あつまります」の まえに、じかんと ばしょが あるよ。',
    h3: '「あさ 8じ…」の あとも よく きこう。',
    explain: '「あさ 8じはんに」と いって いたね。',
  },
  {
    id: 'two-meet-place',
    objective: 'two',
    talk: 'えんそくの ひは、あさ 8じはんに、こうもんの まえに あつまります。',
    prompt: 'あつまる ばしょは どこ？',
    options: [c('こうもんの まえ'), notSaid('きょうしつ'), notSaid('たいいくかん')],
    h2: '「あつまります」の まえに、じかんと ばしょが あるよ。',
    h3: '「こう…の まえ」と いって いたよ。',
    explain: '「こうもんの まえに あつまります。」と いって いたね。',
  },
  {
    id: 'two-count-bring',
    objective: 'two',
    talk: 'あしたは、はさみと のりを もって きて ください。',
    prompt: 'もって くる ものは いくつ あった？',
    options: [w('1つ', 'only-one'), c('2つ'), w('3つ', 'not-said')],
    fixed: true,
    h2: 'もって くる ものを ゆびを おって かぞえよう。',
    h3: '1つめは 「はさみ」。',
    explain: '「はさみと のり」で 2つ だね。',
  },
  {
    id: 'two-count-do',
    objective: 'two',
    talk: 'いえに かえったら、てを あらって、うがいを しましょう。',
    prompt: 'かえったら する ことは いくつ あった？',
    options: [w('1つ', 'only-one'), c('2つ'), w('3つ', 'not-said')],
    fixed: true,
    h2: 'する ことを ゆびを おって かぞえよう。',
    h3: '1つめは 「てを あらう」。',
    explain: '「てを あらう」と 「うがいを する」で 2つ だね。',
  },
  // two の 別例（えの せんたくし）
  {
    id: 'two-alt-fruit',
    objective: 'two',
    alt: true,
    multi: true,
    talk: 'おやつに、りんごと バナナを よういしました。',
    prompt: 'よういした ものを 2つ えらぼう。',
    options: [
      c('りんご', 'apple'),
      c('バナナ', 'banana'),
      notSaid('みかん', 'mikan'),
      notSaid('もも', 'peach'),
    ],
    h2: '「よういしました」の まえを きこう。',
    h3: '1つめは あかい くだもの だよ。',
    explain: '「りんごと バナナを よういしました。」と いって いたね。',
  },
  {
    id: 'two-alt-veg',
    objective: 'two',
    alt: true,
    multi: true,
    talk: 'カレーに いれるので、にんじんと なすを かって きて ください。',
    prompt: 'かって くる ものを 2つ えらぼう。',
    options: [
      c('にんじん', 'carrot'),
      c('なす', 'eggplant'),
      notSaid('きゅうり', 'cucumber'),
      notSaid('ピーマン', 'green-pepper'),
    ],
    h2: '「かって きて ください」の まえを きこう。',
    h3: '1つめは オレンジいろで ながい やさい だよ。',
    explain: '「にんじんと なすを かって きて ください。」と いって いたね。',
  },
  {
    id: 'two-alt-zoo',
    objective: 'two',
    alt: true,
    multi: true,
    talk: 'どうぶつえんで、ぞうと さるを みました。',
    prompt: 'みた どうぶつを 2つ えらぼう。',
    options: [
      c('ぞう', 'elephant'),
      c('さる', 'monkey'),
      notSaid('くま', 'bear'),
      notSaid('きつね', 'fox'),
    ],
    h2: '「みました」の まえを きこう。',
    h3: '1つめは はなの ながい どうぶつ だよ。',
    explain: '「ぞうと さるを みました。」と いって いたね。',
  },

  // ---- order: じゅんじょ ----
  {
    id: 'order-wash-first',
    objective: 'order',
    talk: 'きゅうしょくの まえには、はじめに てを あらいます。つぎに エプロンを きます。さいごに せきに すわります。',
    prompt: 'はじめに する ことは なに？',
    options: [
      c('てを あらう'),
      w('エプロンを きる', 'order-swap'),
      w('せきに すわる', 'order-swap'),
    ],
    h2: '「はじめに」の あとを きこう。',
    h3: 'きれいに する ことから はじめるよ。',
    explain: '「はじめに てを あらいます」と いって いたね。',
  },
  {
    id: 'order-wash-next',
    objective: 'order',
    talk: 'きゅうしょくの まえには、はじめに てを あらいます。つぎに エプロンを きます。さいごに せきに すわります。',
    prompt: 'つぎに する ことは なに？',
    options: [
      c('エプロンを きる'),
      w('てを あらう', 'order-swap'),
      w('せきに すわる', 'order-swap'),
    ],
    h2: '「つぎに」の あとを きこう。',
    h3: 'てを あらった あとに する ことだよ。',
    explain: '「つぎに エプロンを きます」と いって いたね。',
  },
  {
    id: 'order-morning-last',
    objective: 'order',
    talk: 'あさ おきたら、まず かおを あらいます。それから ごはんを たべます。さいごに はを みがきます。',
    prompt: 'さいごに する ことは なに？',
    options: [
      c('はを みがく'),
      w('かおを あらう', 'order-swap'),
      w('ごはんを たべる', 'order-swap'),
    ],
    h2: '「さいごに」の あとを きこう。',
    h3: 'ごはんの あとに する ことだよ。',
    explain: '「さいごに はを みがきます」と いって いたね。',
  },
  {
    id: 'order-morning-after',
    objective: 'order',
    talk: 'あさ おきたら、まず かおを あらいます。それから ごはんを たべます。さいごに はを みがきます。',
    prompt: 'かおを あらった つぎに する ことは なに？',
    options: [c('ごはんを たべる'), w('はを みがく', 'order-swap'), notSaid('きがえる')],
    h2: '「それから」の あとを きこう。',
    h3: 'あさごはんの ことだよ。',
    explain: '「それから ごはんを たべます」と いって いたね。',
  },
  {
    id: 'order-plant-first',
    objective: 'order',
    talk: 'たねを まく ときは、まず つちに あなを あけます。つぎに たねを いれます。そして つちを かけて、みずを やります。',
    prompt: 'いちばん はじめに する ことは なに？',
    options: [c('あなを あける'), w('たねを いれる', 'order-swap'), w('みずを やる', 'order-swap')],
    h2: '「まず」の あとを きこう。',
    h3: 'つちに なにかを する ことから はじめるよ。',
    explain: '「まず つちに あなを あけます」と いって いたね。',
  },
  {
    id: 'order-plant-last',
    objective: 'order',
    talk: 'たねを まく ときは、まず つちに あなを あけます。つぎに たねを いれます。そして つちを かけて、みずを やります。',
    prompt: 'いちばん さいごに する ことは なに？',
    options: [c('みずを やる'), w('つちを かける', 'order-swap'), w('あなを あける', 'order-swap')],
    h2: '「そして」の あとを よく きこう。',
    h3: 'つちを かけた あとに する ことだよ。',
    explain: '「つちを かけて、みずを やります」と いって いたね。',
  },
  {
    id: 'order-story',
    objective: 'order',
    talk: 'たろうさんは、こうえんで すべりだいで あそびました。そのあと ブランコに のりました。それから いえに かえりました。',
    prompt: 'すべりだいの つぎに した ことは なに？',
    options: [c('ブランコに のる'), w('いえに かえる', 'order-swap'), notSaid('すなばで あそぶ')],
    h2: '「そのあと」の あとを きこう。',
    h3: 'こうえんで のる ものだよ。',
    explain: '「そのあと ブランコに のりました」と いって いたね。',
  },
  {
    id: 'order-letter',
    objective: 'order',
    talk: 'てがみを だす ときは、はじめに てがみを かきます。つぎに ふうとうに いれます。さいごに ポストに いれます。',
    prompt: 'ふうとうに いれた つぎに する ことは なに？',
    options: [c('ポストに いれる'), w('てがみを かく', 'order-swap'), notSaid('きってを かう')],
    h2: '「さいごに」の あとを きこう。',
    h3: 'ふうとうの あとは、だす ところへ もって いくよ。',
    explain: '「さいごに ポストに いれます」と いって いたね。',
  },
  // order の 別例（えの せんたくし）
  {
    id: 'order-alt-egg',
    objective: 'order',
    alt: true,
    talk: 'にわとりの こどもは、はじめは たまごの なかに います。たまごから かえると ひよこに なります。おおきく なると にわとりに なります。',
    prompt: 'たまごから かえると、なにに なる？',
    options: [
      c('ひよこ', 'chick'),
      w('たまご', 'order-swap', 'egg'),
      w('にわとり', 'order-swap', 'bird'),
    ],
    h2: '「たまごから かえると」の あとを きこう。',
    h3: 'まだ ちいさい とりの こども だよ。',
    explain: '「たまごから かえると ひよこに なります」と いって いたね。',
  },
  {
    id: 'order-alt-trip',
    objective: 'order',
    alt: true,
    talk: 'にちようびは、まず でんしゃで うみへ いきました。うみでは ふねに のりました。かえりは バスで かえりました。',
    prompt: 'さいしょに のった ものは どれ？',
    options: [
      c('でんしゃ', 'train'),
      w('ふね', 'order-swap', 'ship'),
      w('バス', 'order-swap', 'bus-yellow'),
    ],
    h2: '「まず」の あとを きこう。',
    h3: 'せんろの うえを はしる のりもの だよ。',
    explain: '「まず でんしゃで うみへ いきました」と いって いたね。',
  },
  {
    id: 'order-alt-lunch',
    objective: 'order',
    alt: true,
    talk: 'おひるに、さいしょに おにぎりを たべました。つぎに たまごやきを たべて、さいごに みかんを たべました。',
    prompt: 'さいごに たべた ものは どれ？',
    options: [
      c('みかん', 'mikan'),
      w('おにぎり', 'order-swap', 'onigiri'),
      w('たまごやき', 'order-swap', 'egg'),
    ],
    h2: '「さいごに」の あとを きこう。',
    h3: 'デザートの くだもの だよ。',
    explain: '「さいごに みかんを たべました」と いって いたね。',
  },
];

function toItem(q: Q): ListenItem {
  return {
    engine: 'listen',
    id: q.id,
    objective: q.objective,
    level: LV[q.objective],
    alt: q.alt,
    prompt: `よく きいてね。${q.prompt}`,
    audio: { text: q.talk },
    options: toOptions(q.options),
    multi: q.multi,
    fixedOrder: q.fixed,
    layout: q.options.some((o) => o.illust) ? 'row' : 'column',
    hints: ['「もういちど きく」で、もう いちど きいて みよう。', q.h2, q.h3],
    explain: q.explain,
    identity: `listen:${q.id}`,
  };
}

const items: Item[] = QS.map(toItem);

export const listen: UnitSpec = {
  id: 'g1.ja.listen',
  title: 'よく きいて えらぼう',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'listen',
  prereq: [],
  objectives: [
    { id: 'one', title: 'だいじな こと 1つを ききとる' },
    { id: 'two', title: 'だいじな こと 2つを ききとる' },
    { id: 'order', title: 'じゅんばんを ききとる' },
  ],
  misconceptions: [
    {
      id: 'mentioned-other',
      explain:
        'はなしに でて きた べつの ことばを えらんだのかな。きかれて いる ことの すぐ まえ・あとを よく きこう。',
    },
    {
      id: 'not-said',
      explain:
        'はなしに でて こなかった ことを えらんだのかな。もう いちど きいて、ほんとうに いって いたか たしかめよう。',
    },
    {
      id: 'only-one',
      explain:
        '1つだけ ききとったのかな。「〜と 〜」と いう ときは 2つ あるよ。ゆびを おって かぞえながら きこう。',
    },
    {
      id: 'order-swap',
      explain:
        'じゅんばんを とりちがえたのかな。「はじめに」「つぎに」「さいごに」の ことばに みみを すまそう。',
    },
  ],
  levels: [
    { label: 'だいじな こと 1つ', chance: 0.1 },
    { label: 'だいじな こと 2つ', chance: 0.05 },
    { label: 'じゅんばん', chance: 0.1 },
  ],
  intro: [
    { text: 'おはなしを きく ときは、「なにを」「いつ」「どこで」に みみを すまそう。' },
    {
      text: 'たとえば 「あした もって くるのは ぼうしと すいとうです。」 もって くる ものは 「ぼうし」と 「すいとう」の 2つ だね。',
    },
    { text: '「はじめに」「つぎに」「さいごに」は、じゅんばんを おしえて くれる ことば だよ。' },
  ],
  source: { kind: 'items', items },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 A 話すこと・聞くこと (1)エ（話し手が知らせたいことや自分が聞きたいことを落とさないように集中して聞き、話の内容を捉えて感想をもつこと）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
