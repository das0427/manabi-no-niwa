/**
 * g2.ja.culture むかしばなしと ことばあそび（かるた・なぞなぞ・むかしばなし）。
 * 設計: docs/expansion/p2-design/g2-ja.md 2章。
 * かるたの よみふだ・なぞなぞは 本アプリの 自作。むかしばなしは 伝承の 筋を 本アプリが 再話した 文。
 *
 * 到達項目:
 *   karuta  … よみふだの はじめの おとで ふだを とる（listen）。別例: えを 見て よみふだの はじめを えらぶ（choice）
 *   nazo    … なぞなぞを とく（choice）。別例: なぞを 聞いて えで こたえる（listen）
 *   mukashi … むかしばなしを 聞いて こたえる（listen）。別例: えで えらぶ
 * 同一性キー: 問題ごと（手作り）。
 */
import type { ChoiceItem, ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { ListenItem } from '../../engines/listen/listen';

const CULTURE_REVISED = '2026-10-30';

type Obj = 'karuta' | 'nazo' | 'mukashi';
const LV: Record<Obj, number> = { karuta: 0, nazo: 1, mukashi: 2 };

const HINT1: Record<Obj, string> = {
  karuta: 'よみふだの いちばん はじめの おとに みみを すまそう。',
  nazo: 'なぞの 手《て》がかりを 1つずつ たしかめよう。',
  mukashi: '「もういちど きく」で、もう いちど きいて みよう。',
};

interface Opt {
  label: string;
  illust?: string;
  correct?: boolean;
  mis?: string;
}

const c = (label: string, illust?: string): Opt => ({ label, illust, correct: true });
const w = (label: string, mis: string, illust?: string): Opt => ({ label, illust, mis });
const said = (label: string, illust?: string) => w(label, 'mentioned-other', illust);
const notSaid = (label: string, illust?: string) => w(label, 'not-said', illust);

function toOptions(os: Opt[]): ChoiceOption[] {
  return os.map((o) => ({
    label: o.label,
    ...(o.illust ? { figure: { kind: 'illust' as const, id: o.illust } } : {}),
    ...(o.correct ? { correct: true } : {}),
    ...(o.mis ? { misconception: o.mis } : {}),
  }));
}

interface Common {
  id: string;
  alt?: boolean;
  h2: string;
  h3: string;
  explain: string;
}

function listenItem(
  obj: Obj,
  q: Common & { talk: string; prompt: string; options: Opt[]; layout: 'row' | 'column' },
): ListenItem {
  return {
    engine: 'listen',
    id: q.id,
    objective: obj,
    level: LV[obj],
    alt: q.alt,
    prompt: `よく きいてね。${q.prompt}`,
    audio: { text: q.talk },
    options: toOptions(q.options),
    layout: q.layout,
    hints: [HINT1[obj], q.h2, q.h3],
    explain: q.explain,
    identity: `culture:${q.id}`,
  };
}

function choiceItem(
  obj: Obj,
  q: Common & { prompt: string; options: Opt[]; figure?: string },
): ChoiceItem {
  return {
    engine: 'choice',
    id: q.id,
    objective: obj,
    level: LV[obj],
    alt: q.alt,
    prompt: q.prompt,
    ...(q.figure ? { figure: { kind: 'illust' as const, id: q.figure } } : {}),
    options: toOptions(q.options),
    layout: 'column',
    hints: [HINT1[obj], q.h2, q.h3],
    explain: q.explain,
    identity: `culture:${q.id}`,
  };
}

// ---- かるた ----
// とりふだの絵（かな1字 → 絵ID）
export const KARUTA_ILLUST: Record<string, string> = {
  か: 'frog',
  が: 'train',
  ふ: 'ship',
  ぶ: 'p23-pig',
  は: 'flower',
  さ: 'monkey',
  く: 'bear',
  み: 'mikan',
  た: 'egg',
  ぞ: 'elephant',
  と: 'bird',
  う: 'rabbit',
  ひ: 'chick',
  あ: 'airplane',
  き: 'fox',
};

// よみふだ（本アプリの自作。5・7・5。練習・別例の両方がここを引く）
export const KARUTA_YOMI: Record<string, string> = {
  か: 'かえるくん あめが ふったら うたいだす',
  が: 'がたごとと でんしゃが はしる はしの うえ',
  ふ: 'ふねが ゆく 海《うみ》の 上《うえ》には 白《しろ》い くも',
  ぶ: 'ぶたさんが どろんこ あそびで まっくろけ',
  は: 'はなばたけ ちょうちょが ひらり まいおりる',
  さ: 'さるの 子《こ》が 木《き》の えだ ゆらし とびうつる',
  く: 'くまさんが はちみつ なめて ひるねする',
  み: 'みかん むく ゆびが きいろに なっちゃった',
  た: 'たまごやき ふわふわ あまい おべんとう',
  ぞ: 'ぞうさんの ながい おはなで 水《みず》あそび',
  と: 'とりたちが 空《そら》で くるりと 大《おお》まわり',
};

type KMis = 'dakuten' | 'middle-word' | 'other-card';

interface KQ extends Common {
  card: string;
  wrongs: [string, KMis][];
}

const KARUTA: KQ[] = [
  {
    id: 'karuta-ka',
    card: 'か',
    wrongs: [
      ['が', 'dakuten'],
      ['う', 'middle-word'],
    ],
    h2: '「うたいだす」は おわりの ほうの ことばだよ。',
    h3: 'てんてん（゛）は つかない おとだよ。',
    explain: 'はじめの おとは「か」。「かえるくん」の「か」の ふだを とるよ。',
  },
  {
    id: 'karuta-ga',
    card: 'が',
    wrongs: [
      ['か', 'dakuten'],
      ['は', 'middle-word'],
    ],
    h2: '「はしる」は とちゅうの ことばだよ。',
    h3: 'はじめの おとには てんてん（゛）が つくよ。',
    explain: 'はじめの おとは「が」。「がたごとと」の「が」の ふだを とるよ。',
  },
  {
    id: 'karuta-fu',
    card: 'ふ',
    wrongs: [
      ['ぶ', 'dakuten'],
      ['う', 'middle-word'],
    ],
    h2: '「海《うみ》」は とちゅうの ことばだよ。',
    h3: 'てんてん（゛）は つかない おとだよ。',
    explain: 'はじめの おとは「ふ」。「ふねが ゆく」の「ふ」の ふだを とるよ。',
  },
  {
    id: 'karuta-bu',
    card: 'ぶ',
    wrongs: [
      ['ふ', 'dakuten'],
      ['あ', 'middle-word'],
    ],
    h2: '「あそびで」は とちゅうの ことばだよ。',
    h3: 'はじめの おとには てんてん（゛）が つくよ。',
    explain: 'はじめの おとは「ぶ」。「ぶたさんが」の「ぶ」の ふだを とるよ。',
  },
  {
    id: 'karuta-ha',
    card: 'は',
    wrongs: [
      ['ひ', 'middle-word'],
      ['く', 'other-card'],
    ],
    h2: '「ひらり」は とちゅうの ことばだよ。',
    h3: 'はじめの ことばは、花《はな》が たくさん さいて いる ところだよ。',
    explain: 'はじめの おとは「は」。「はなばたけ」の「は」の ふだを とるよ。',
  },
  {
    id: 'karuta-sa',
    card: 'さ',
    wrongs: [
      ['き', 'middle-word'],
      ['と', 'middle-word'],
    ],
    h2: '「木《き》」も「とびうつる」も とちゅうの ことばだよ。',
    h3: 'はじめの ことばは、木《き》の 上《うえ》で くらす どうぶつだよ。',
    explain: 'はじめの おとは「さ」。「さるの 子《こ》が」の「さ」の ふだを とるよ。',
  },
  {
    id: 'karuta-ku',
    card: 'く',
    wrongs: [
      ['は', 'middle-word'],
      ['ひ', 'middle-word'],
    ],
    h2: '「はちみつ」も「ひるね」も とちゅうの ことばだよ。',
    h3: 'はじめの ことばは、はちみつが すきな どうぶつだよ。',
    explain: 'はじめの おとは「く」。「くまさんが」の「く」の ふだを とるよ。',
  },
  {
    id: 'karuta-mi',
    card: 'み',
    wrongs: [
      ['き', 'middle-word'],
      ['た', 'other-card'],
    ],
    h2: '「きいろ」は とちゅうの ことばだよ。',
    h3: 'はじめの ことばは、かわを むいて たべる くだものだよ。',
    explain: 'はじめの おとは「み」。「みかん むく」の「み」の ふだを とるよ。',
  },
];

interface KAlt extends Common {
  card: string;
  prompt: string;
  /** 正解の よみふだの はじめの ことば */
  wrongs: [string, KMis][];
}

const KARUTA_ALT: KAlt[] = [
  {
    id: 'karuta-alt-ta',
    card: 'た',
    prompt: 'とりふだ「た」の よみふだは どれで はじまる？',
    wrongs: [
      ['ふわふわ あまい', 'middle-word'],
      ['とりたちが', 'other-card'],
    ],
    h2: 'ふだの 字《じ》は「た」だね。',
    h3: '「た」で はじまる ものを さがそう。',
    explain:
      'とりふだ「た」の よみふだは「たまごやき ふわふわ あまい おべんとう」。はじめは「たまごやき」だよ。',
  },
  {
    id: 'karuta-alt-zo',
    card: 'ぞ',
    prompt: 'とりふだ「ぞ」の よみふだは どれで はじまる？',
    wrongs: [
      ['ながい おはなで', 'middle-word'],
      ['さるの 子《こ》が', 'other-card'],
    ],
    h2: 'ふだの 字《じ》は「ぞ」だね。',
    h3: '「ぞ」で はじまる ものを さがそう。',
    explain:
      'とりふだ「ぞ」の よみふだは「ぞうさんの ながい おはなで 水《みず》あそび」。はじめは「ぞうさんの」だよ。',
  },
  {
    id: 'karuta-alt-to',
    card: 'と',
    prompt: 'とりふだ「と」の よみふだは どれで はじまる？',
    wrongs: [
      ['空《そら》で くるりと', 'middle-word'],
      ['どろんこ あそびで', 'dakuten'],
    ],
    h2: 'ふだの 字《じ》は「と」だね。てんてんは ついて いないよ。',
    h3: '「と」で はじまる ものを さがそう。',
    explain:
      'とりふだ「と」の よみふだは「とりたちが 空《そら》で くるりと 大《おお》まわり」。はじめは「とりたちが」だよ。',
  },
];

/** よみふだの はじめの ことば（空白まで） */
const yomiOf = (card: string): string => KARUTA_YOMI[card] ?? '';
const firstWord = (card: string): string => yomiOf(card).split(' ')[0] ?? '';

const karutaItems: Item[] = [
  ...KARUTA.map((k) =>
    listenItem('karuta', {
      id: k.id,
      h2: k.h2,
      h3: k.h3,
      explain: k.explain,
      talk: yomiOf(k.card),
      prompt: 'とる ふだは どれ？',
      layout: 'row',
      options: [
        c(k.card, KARUTA_ILLUST[k.card]),
        ...k.wrongs.map(([l, m]) => w(l, m, KARUTA_ILLUST[l])),
      ],
    }),
  ),
  ...KARUTA_ALT.map((k) =>
    choiceItem('karuta', {
      id: k.id,
      alt: true,
      h2: k.h2,
      h3: k.h3,
      explain: k.explain,
      prompt: k.prompt,
      figure: KARUTA_ILLUST[k.card],
      options: [c(firstWord(k.card)), ...k.wrongs.map(([l, m]) => w(l, m))],
    }),
  ),
];

// ---- なぞなぞ ----
interface NQ extends Common {
  prompt: string;
  options: Opt[];
}

const NAZO: NQ[] = [
  {
    id: 'nazo-pan',
    prompt: 'パンは パンでも、たべられない パンは なあに？',
    options: [c('フライパン'), w('メロンパン', 'literal'), w('しょくパン', 'literal')],
    h2: '「たべられない」が 手《て》がかりだよ。',
    h3: 'だいどころで、りょうりに つかう どうぐだよ。',
    explain:
      'フライパンは、名前《なまえ》に「パン」が あるけれど、りょうりに つかう どうぐだから たべられないね。',
  },
  {
    id: 'nazo-kara',
    prompt: 'からは からでも、たべられる からは なあに？',
    options: [c('からあげ'), w('かいがら', 'literal'), w('からす', 'half-clue')],
    h2: '「から」が つく ことばの 中《なか》で、たべられる ものだよ。',
    h3: 'とりにくを あぶらで あげた りょうりだよ。',
    explain: 'からあげは「から」が つく たべものだね。かいがらや からすは たべられないよ。',
  },
  {
    id: 'nazo-kuri',
    prompt: 'くりは くりでも、たべられない くりは なあに？',
    options: [c('びっくり'), w('くりごはん', 'literal'), w('やきぐり', 'literal')],
    h2: '「たべられない」が 手《て》がかりだよ。',
    h3: 'おどろいた ときの ことばだよ。',
    explain: '「びっくり」は おどろいた ときの ことばで、おわりに「くり」が あるね。',
  },
  {
    id: 'nazo-tori',
    prompt: 'とりは とりでも、とばないで ごみを あつめる とりは なあに？',
    options: [c('ちりとり'), w('にわとり', 'literal'), w('ことり', 'literal')],
    h2: '「ごみを あつめる」が 手《て》がかりだよ。',
    h3: 'そうじの ときに、ほうきと いっしょに つかう どうぐだよ。',
    explain: 'ちりとりは、ほうきで はいた ごみを あつめる どうぐ。おわりに「とり」が あるね。',
  },
  {
    id: 'nazo-ofuro',
    prompt: 'うえは 大水《おおみず》、したは 大《おお》かじ。これ なあに？',
    options: [c('むかしの おふろ'), w('プール', 'half-clue'), w('たきび', 'half-clue')],
    h2: '「水《みず》」と「火《ひ》」の りょうほうが ある ものだよ。',
    h3: 'むかしは、したで 火《ひ》を たいて 水《みず》を あたためたよ。',
    explain:
      'むかしの おふろは、おけの したで 火《ひ》を たいて、うえの 水《みず》を あたためたんだ。うえは 水《みず》、したは 火《ひ》だね。',
  },
  {
    id: 'nazo-eraser',
    prompt: 'つかうほど 小《ちい》さく なって、字《じ》を けして くれる ものは？',
    options: [c('けしゴム'), w('えんぴつ', 'half-clue'), w('ノート', 'half-clue')],
    h2: '「字《じ》を けして くれる」が 手《て》がかりだよ。',
    h3: 'ふでばこに 入《い》って いて、こすって つかう ものだよ。',
    explain: 'けしゴムは、こすって 字《じ》を けすと すこしずつ 小《ちい》さく なるね。',
  },
  {
    id: 'nazo-chair',
    prompt: 'あしが 4本《ほん》 あるのに、ちっとも あるかない ものは なあに？',
    options: [c('いす'), w('いぬ', 'half-clue'), w('くつ', 'half-clue')],
    h2: '「あるかない」が 手《て》がかりだよ。',
    h3: 'すわる ときに つかう ものだよ。',
    explain: 'いすの あしは 4本《ほん》でも、あるかないね。いぬは あしが 4本《ほん》で あるくよ。',
  },
  {
    id: 'nazo-ika',
    prompt: 'さかさに よむと「かい」に なる、うみの いきものは なあに？',
    options: [c('いか'), w('かい', 'literal'), w('たこ', 'half-clue')],
    h2: '「かい」を うしろから よんで みよう。',
    h3: '「かい」の おしまいの 字《じ》は「い」。そこから よみはじめると…。',
    explain: '「いか」を さかさに よむと「かい」だね。いかは うみの いきものだよ。',
  },
];

interface NAltQ extends Common {
  talk: string;
  options: Opt[];
}

const NAZO_ALT: NAltQ[] = [
  {
    id: 'nazo-alt-tako',
    alt: true,
    talk: 'うみの 中《なか》で およぐのに、お正月《しょうがつ》には 空《そら》を とぶ ものは なあに？',
    options: [
      c('たこ', 'octopus'),
      w('かめ', 'half-clue', 'turtle'),
      w('とり', 'half-clue', 'bird'),
    ],
    h2: '「うみで およぐ」と「空《そら》を とぶ」の りょうほうに あう ものだよ。',
    h3: 'お正月《しょうがつ》に いとを ひいて あげる ものと、おなじ 名前《なまえ》だよ。',
    explain: 'うみの「たこ」と、お正月《しょうがつ》に あげる「たこ」。おなじ 名前《なまえ》だね。',
  },
  {
    id: 'nazo-alt-ice',
    alt: true,
    talk: 'いすは いすでも、たべられる いすは なあに？',
    options: [
      c('アイス', 'p5-icecream'),
      w('ケーキ', 'half-clue', 'p5-cake'),
      w('りんご', 'half-clue', 'apple'),
    ],
    h2: '「いす」と いう おとが 入《はい》って いる たべものだよ。',
    h3: 'つめたくて、なめると とける たべものだよ。',
    explain: '「アイス」の おわりに「いす」が あるね。ケーキや りんごには「いす」が ないよ。',
  },
  {
    id: 'nazo-alt-hat',
    alt: true,
    talk: 'うしは うしでも、あたまに かぶる うしは なあに？',
    options: [
      c('ぼうし', 'p23-hat'),
      w('うし', 'literal', 'cow'),
      w('くつ', 'half-clue', 'p23-shoe'),
    ],
    h2: '「あたまに かぶる」が 手《て》がかりだよ。',
    h3: 'おわりに「うし」の おとが ある ものだよ。',
    explain: '「ぼうし」の おわりに「うし」が あるね。あたまに かぶる ものだよ。',
  },
];

const nazoItems: Item[] = [
  ...NAZO.map((n) =>
    choiceItem('nazo', {
      id: n.id,
      h2: n.h2,
      h3: n.h3,
      explain: n.explain,
      prompt: n.prompt,
      options: n.options,
    }),
  ),
  ...NAZO_ALT.map((n) =>
    listenItem('nazo', {
      id: n.id,
      alt: n.alt,
      h2: n.h2,
      h3: n.h3,
      explain: n.explain,
      talk: n.talk,
      prompt: 'こたえの えは どれ？',
      layout: 'row',
      options: n.options,
    }),
  ),
];

// ---- むかしばなし ----
interface MQ extends Common {
  talk: string;
  prompt: string;
  options: Opt[];
}

const MUKASHI: MQ[] = [
  {
    id: 'mukashi-kasajizo',
    talk: 'むかし、まずしい おじいさんが、町《まち》へ かさを 売《う》りに 行《い》きました。でも、かさは 一《ひと》つも 売《う》れません。かえり道《みち》、ゆきの 中《なか》に おじぞうさまが 立《た》って いました。おじいさんは、かさを おじぞうさまの あたまに かぶせて あげました。',
    prompt: 'おじぞうさまに かぶせた ものは なに？',
    options: [c('かさ'), said('ゆき'), notSaid('おもち')],
    h2: '「かぶせて あげました」の まえを きこう。',
    h3: '町《まち》へ 売《う》りに 行《い》った ものだよ。',
    explain:
      '売《う》れなかった かさを、ゆきの 中《なか》の おじぞうさまに かぶせて あげたんだね。',
  },
  {
    id: 'mukashi-omusubi',
    talk: 'むかし、山《やま》で はたらく おじいさんが、ひるに おむすびを たべようと しました。すると、おむすびが ころころ ころがって、あなに おちて しまいました。あなの 中《なか》から、たのしい うたが きこえて きました。',
    prompt: 'おむすびは どこに おちた？',
    options: [
      c('あなの 中《なか》'),
      said('山《やま》の 上《うえ》'),
      notSaid('川《かわ》の 中《なか》'),
    ],
    h2: '「おちて しまいました」の まえを きこう。',
    h3: 'うたが きこえて きた ところだよ。',
    explain: 'おむすびは ころがって、あなに おちたね。その あなから うたが きこえて きたんだ。',
  },
  {
    id: 'mukashi-tsuru',
    talk: 'むかし、ゆきの ふる 日《ひ》に、わかものが わなに かかった つるを 見《み》つけました。わかものは、つるを にがして やりました。その よる、わかい むすめが たずねて きました。',
    prompt: 'わかものは つるを どう した？',
    options: [c('にがして やった'), notSaid('いえで かった'), said('わなに かけた')],
    h2: '「つるを」の あとを きこう。',
    h3: 'わなに かかって こまって いた つるを たすけたよ。',
    explain: 'わなに かかった つるを 見《み》つけて、にがして やったんだね。',
  },
  {
    id: 'mukashi-hanasaka',
    talk: 'むかし、やさしい おじいさんと おばあさんが、白《しろ》い 犬《いぬ》を かって いました。ある 日《ひ》、犬《いぬ》が はたけで「ここ ほれ、わんわん」と なきました。おじいさんが ほって みると、こばんが ざくざく 出《で》て きました。',
    prompt: 'ほって みると、なにが 出《で》て きた？',
    options: [c('こばん'), said('犬《いぬ》'), notSaid('ほね')],
    h2: '「ほって みると」の あとを きこう。',
    h3: '「ざくざく」と たくさん 出《で》て きたよ。むかしの お金《かね》だよ。',
    explain: 'ほって みると、こばん（むかしの お金《かね》）が ざくざく 出《で》て きたね。',
  },
  {
    id: 'mukashi-issun',
    talk: 'むかし、おじいさんと おばあさんに、ゆびほどの 小《ちい》さな 男《おとこ》の 子《こ》が 生《う》まれました。名前《なまえ》は いっすんぼうしです。いっすんぼうしは、おわんを ふねに して、はしを かいに して、みやこへ むかいました。',
    prompt: 'いっすんぼうしが ふねに した ものは？',
    options: [c('おわん'), said('はし'), notSaid('はっぱ')],
    h2: '「ふねに して」の まえを きこう。',
    h3: 'ごはんや しるを 入《い》れる うつわだよ。',
    explain: 'おわんを ふねに して、はしを かい（ふねを こぐ どうぐ）に したんだね。',
  },
  {
    id: 'mukashi-momo',
    talk: 'むかし、おじいさんは 山《やま》へ しばかりに、おばあさんは 川《かわ》へ せんたくに 行《い》きました。おばあさんが せんたくを して いると、大《おお》きな ももが どんぶらこ どんぶらこと ながれて きました。',
    prompt: 'おばあさんは 川《かわ》で なにを して いた？',
    options: [c('せんたく'), said('しばかり'), notSaid('さかなつり')],
    h2: '「おばあさんは」の あとを きこう。',
    h3: 'しばかりに 行《い》ったのは、おじいさんだよ。',
    explain: 'おばあさんは 川《かわ》へ せんたくに 行《い》ったね。しばかりは おじいさんだよ。',
  },
  {
    id: 'mukashi-sarukani',
    talk: 'むかし、かにが おむすびを もって あるいて いると、さるが かきの たねを もって やって きました。さるは「この たねと、その おむすびを とりかえよう」と いいました。',
    prompt: 'さるが もって いた ものは？',
    options: [c('かきの たね'), said('おむすび'), notSaid('くり')],
    h2: '「さるが」の あとを きこう。',
    h3: 'おむすびを もって いたのは かにだよ。',
    explain: 'さるは かきの たねを もって いたね。おむすびは かにが もって いたんだよ。',
  },
  {
    id: 'mukashi-kobu',
    talk: 'むかし、ほっぺたに 大《おお》きな こぶの ある おじいさんが いました。ある よる、山《やま》の 中《なか》で、おにたちが たのしそうに おどって いました。おじいさんも いっしょに なって おどりました。',
    prompt: 'おにたちは なにを して いた？',
    options: [c('おどって いた'), notSaid('ねて いた'), notSaid('すもうを とって いた')],
    h2: '「おにたちが」の あとを きこう。',
    h3: 'おじいさんも いっしょに なって、おなじ ことを したよ。',
    explain: 'おにたちは たのしそうに おどって いたね。おじいさんも いっしょに おどったんだ。',
  },
  // 別例（えの せんたくし）
  {
    id: 'mukashi-alt-urashima',
    alt: true,
    talk: 'むかし、うらしまたろうと いう りょうしが、はまべで いじめられて いた かめを たすけました。かめは おれいに、たろうを 海《うみ》の そこの りゅうぐうじょうへ つれて 行《い》きました。そこでは、たこや さかなが おどって いました。',
    prompt: 'たろうが たすけた いきものは どれ？',
    options: [c('かめ', 'turtle'), said('たこ', 'octopus'), notSaid('とり', 'bird')],
    h2: '「たすけました」の まえを きこう。',
    h3: 'たろうを せなかに のせて、海《うみ》の そこへ つれて 行《い》った いきものだよ。',
    explain: 'たろうは かめを たすけたね。たこは りゅうぐうじょうで おどって いた いきものだよ。',
  },
  {
    id: 'mukashi-alt-kintaro',
    alt: true,
    talk: 'むかし、山《やま》おくに、きんたろうと いう 力《ちから》もちの 男《おとこ》の 子《こ》が いました。きんたろうは まいにち、くまと すもうを とって あそびました。うさぎや さるも おうえんしました。',
    prompt: 'きんたろうの すもうの あいては どれ？',
    options: [c('くま', 'bear'), said('うさぎ', 'rabbit'), said('さる', 'monkey')],
    h2: '「すもうを とって」の まえを きこう。',
    h3: 'うさぎと さるは「おうえん」したよ。',
    explain: 'きんたろうは くまと すもうを とったね。うさぎや さるは おうえんして いたよ。',
  },
  {
    id: 'mukashi-alt-momo',
    alt: true,
    talk: 'ももたろうが おにがしまへ むかって いると、まず いぬが やって きました。つぎに さる、さいごに きじが なかまに なりました。',
    prompt: 'さいしょに なかまに なったのは どれ？',
    options: [c('いぬ', 'dog'), w('さる', 'order-swap', 'monkey'), w('きじ', 'order-swap', 'bird')],
    h2: '「まず」の あとを きこう。',
    h3: 'さるは「つぎに」、きじは「さいごに」だよ。',
    explain: 'まず いぬ、つぎに さる、さいごに きじが なかまに なったね。',
  },
];

const mukashiItems: Item[] = MUKASHI.map((m) =>
  listenItem('mukashi', {
    id: m.id,
    alt: m.alt,
    h2: m.h2,
    h3: m.h3,
    explain: m.explain,
    talk: m.talk,
    prompt: m.prompt,
    layout: m.options.some((o) => o.illust) ? 'row' : 'column',
    options: m.options,
  }),
);

const items: Item[] = [...karutaItems, ...nazoItems, ...mukashiItems];

export const culture: UnitSpec = {
  id: 'g2.ja.culture',
  title: 'むかしばなしと ことばあそび',
  stage: 'g2',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-book',
  prereq: ['g1.ja.word-play'],
  objectives: [
    { id: 'karuta', title: 'かるたの よみふだを きいて ふだを とる' },
    { id: 'nazo', title: 'なぞなぞを とく' },
    { id: 'mukashi', title: 'むかしばなしを きいて こたえる' },
  ],
  misconceptions: [
    {
      id: 'middle-word',
      explain:
        'よみふだの とちゅうに 出《で》て くる ことばで えらんだのかな。かるたは、いちばん はじめの おとで ふだを とるよ。',
    },
    {
      id: 'dakuten',
      explain:
        'てんてん（゛）が ある おとと ない おとを とりちがえたのかな。「か」と「が」の ように、ちがう おとだよ。',
    },
    {
      id: 'other-card',
      explain:
        'べつの ふだを えらんだのかな。よみふだの いちばん はじめの おとと、ふだの 字《じ》が おなじか たしかめよう。',
    },
    {
      id: 'half-clue',
      explain:
        'なぞの 手《て》がかりの 1つだけで えらんだのかな。ほかの 手《て》がかりにも あって いるか たしかめよう。',
    },
    {
      id: 'literal',
      explain:
        'ことばを そのままの いみで かんがえたのかな。なぞなぞは、おなじ おとの べつの ことばを さがすと とけるよ。',
    },
    {
      id: 'mentioned-other',
      explain:
        'おはなしに 出《で》て きた べつの ものを えらんだのかな。きかれて いる ことの すぐ まえと あとを よく きこう。',
    },
    {
      id: 'not-said',
      explain:
        'おはなしに 出《で》て こなかった ものを えらんだのかな。もう いちど きいて たしかめよう。',
    },
    {
      id: 'order-swap',
      explain:
        'じゅんばんを とりちがえたのかな。「まず」「つぎに」「さいごに」の ことばに みみを すまそう。',
    },
  ],
  levels: [
    { label: 'かるた', chance: 0.1 },
    { label: 'なぞなぞ', chance: 0.1 },
    { label: 'むかしばなし', chance: 0.1 },
  ],
  intro: [
    {
      text: 'かるたは、よみふだの いちばん はじめの おとと おなじ 字《じ》の とりふだを とる あそびだよ。',
    },
    {
      text: 'なぞなぞは、ことばの おとや いみを くふうした あそびだよ。たとえば「たいは たいでも、首《くび》に まく たいは なあに？」こたえは「ネクタイ」。',
    },
    {
      text: 'むかしばなしは、ずっと むかしから 人《ひと》から 人《ひと》へ かたりつがれて きた おはなしだよ。よく きいて こたえよう。',
    },
  ],
  source: { kind: 'items', items },
  review: 'none',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年〔知識及び技能〕(3)ア（昔話や神話・伝承などの読み聞かせを聞くなどして、我が国の伝統的な言語文化に親しむこと）、(3)イ（長く親しまれている言葉遊びを通して、言葉の豊かさに気付くこと）。昔話は著作権の切れた伝承から本アプリが再話。なぞなぞ・かるたの札は本アプリの自作',
  gradeIsAppProposal: true,
  revised: CULTURE_REVISED,
};
