/**
 * g6.en.future したい こと・なりたい ものを 聞《き》こう（curriculum-matrix 3.9。外56）。設計: docs/expansion/p2-design/en-g56.md 2章。
 *   段階0: なりたい もの（しごと）
 *   段階1: したい こと（I want to ~. / すきと したい）
 *   段階2: みじかい 発表（3文。将来の夢・中学校でしたいこと）
 * 同一性キー: 形式 × 英文（発表は 形式 × 発表のID）。人名は 出さない（「この 人《ひと》」）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, ordinalOptions, slugOf } from './lib';

// ---- しごと ----
type Group = 'heal' | 'shop' | 'sky' | 'safe' | 'stage';
interface Job {
  key: string;
  /** 冠詞つきの 英語 */
  text: string;
  ja: string;
  il: string;
  group: Group;
}
const JOBS: Job[] = [
  { key: 'doctor', text: 'a doctor', ja: '医者《いしゃ》', il: 'life-hospital', group: 'heal' },
  { key: 'vet', text: 'a vet', ja: 'じゅうい', il: 'dog', group: 'heal' },
  { key: 'baker', text: 'a baker', ja: 'パンやさん', il: 'life-bakery', group: 'shop' },
  {
    key: 'florist',
    text: 'a florist',
    ja: '花《はな》やさん',
    il: 'life-flowershop',
    group: 'shop',
  },
  { key: 'pilot', text: 'a pilot', ja: 'パイロット', il: 'airplane', group: 'sky' },
  {
    key: 'astronaut',
    text: 'an astronaut',
    ja: '宇宙《うちゅう》飛行士《ひこうし》',
    il: 'p5-rocket',
    group: 'sky',
  },
  {
    key: 'firefighter',
    text: 'a firefighter',
    ja: '消防士《しょうぼうし》',
    il: 'life-firestation',
    group: 'safe',
  },
  {
    key: 'police',
    text: 'a police officer',
    ja: '警察官《けいさつかん》',
    il: 'life-police',
    group: 'safe',
  },
  { key: 'singer', text: 'a singer', ja: '歌手《かしゅ》', il: 'en56-music-note', group: 'stage' },
  {
    key: 'soccer',
    text: 'a soccer player',
    ja: 'サッカー選手《せんしゅ》',
    il: 'ball',
    group: 'stage',
  },
];
const job = (k: string): Job => JOBS.find((j) => j.key === k)!;
const GROUP_HINT: Record<Group, string> = {
  heal: 'びょうきや けがを なおす しごとだよ。',
  shop: 'お店《みせ》で ものを うる しごとだよ。',
  sky: '空《そら》を とぶ ものに のる しごとだよ。',
  safe: '町《まち》の 人《ひと》の あんぜんを まもる しごとだよ。',
  stage: '大《おお》ぜいの 人《ひと》の 前《まえ》で かつやくする しごとだよ。',
};
const beSent = (j: Job) => `I want to be ${j.text}.`;
const jobOpt = (j: Job): ChoiceOption => ({
  figure: { kind: 'illust', id: j.il } as Figure,
  label: j.ja,
});

// ---- be 練習（10問） ----
const BE: [string, string, string][] = [
  ['doctor', 'vet', 'pilot'],
  ['vet', 'doctor', 'baker'],
  ['baker', 'florist', 'firefighter'],
  ['florist', 'baker', 'singer'],
  ['pilot', 'astronaut', 'police'],
  ['astronaut', 'pilot', 'doctor'],
  ['firefighter', 'police', 'florist'],
  ['police', 'firefighter', 'soccer'],
  ['singer', 'soccer', 'vet'],
  ['soccer', 'singer', 'astronaut'],
];

function beItems(): Item[] {
  return BE.map(([r, near, mix]) => {
    const j = job(r);
    const s = beSent(j);
    return listen({
      id: `be:${slugOf(s)}`,
      objective: 'be',
      level: 0,
      prompt: 'この 人《ひと》が なりたい ものは どれ？',
      audio: en('future', s),
      options: [
        { ...jobOpt(j), correct: true },
        { ...jobOpt(job(near)), misconception: 'job-near' },
        { ...jobOpt(job(mix)), misconception: 'job-mix' },
      ],
      hints: [
        '「〜に なりたい」と いう いみの ことばの あとに、しごとの なまえが くるよ。',
        'しごとの なまえは、文《ぶん》の さいごの ことばだよ。',
        GROUP_HINT[j.group],
      ],
      explain: `「${j.ja}に なりたい」と いって います。`,
      explainFigure: enText(s),
      identity: `be:${slugOf(s)}`,
    });
  });
}

// ---- be 別例（せつめい → 3文） ----
const DESC: {
  desc: string;
  at: number;
  lines: [string, string, string];
  mis: [string, string, string];
  ja: string;
}[] = [
  {
    desc: '子《こ》どもたちに 勉強《べんきょう》を 教《おし》える 人《ひと》',
    at: 1,
    lines: ['I want to be a doctor.', 'I want to be a teacher.', 'I want to be a singer.'],
    mis: ['job-mix', '', 'job-mix'],
    ja: '先生《せんせい》',
  },
  {
    desc: '動物《どうぶつ》の びょうきや けがを なおす 人《ひと》',
    at: 0,
    lines: ['I want to be a vet.', 'I want to be a doctor.', 'I want to be a florist.'],
    mis: ['', 'job-near', 'job-mix'],
    ja: 'じゅうい',
  },
  {
    desc: 'ひこうきを うごかす 人《ひと》',
    at: 2,
    lines: ['I want to be an astronaut.', 'I want to be a baker.', 'I want to be a pilot.'],
    mis: ['job-near', 'job-mix', ''],
    ja: 'パイロット',
  },
  {
    desc: '火事《かじ》を 消《け》す 人《ひと》',
    at: 0,
    lines: [
      'I want to be a firefighter.',
      'I want to be a police officer.',
      'I want to be a singer.',
    ],
    mis: ['', 'job-near', 'job-mix'],
    ja: '消防士《しょうぼうし》',
  },
];

function descItems(): Item[] {
  return DESC.map((d) =>
    listen({
      id: `desc:${slugOf(d.lines[d.at]!)}`,
      objective: 'be',
      level: 0,
      prompt:
        '3つの 文《ぶん》を 聞《き》こう。書《か》かれて いる しごとに なりたい 人《ひと》は なんばんめ？',
      figure: { kind: 'text', text: d.desc, size: 'm' },
      audio: d.lines.map((l) => en('future', l)),
      gapMs: 900,
      options: ordinalOptions(3, d.at, (i) => d.mis[i]!),
      fixedOrder: true,
      hints: [
        '3つの 文《ぶん》は、さいごの しごとの なまえだけが ちがうよ。',
        '書《か》かれて いる しごとの なまえを、英語《えいご》で 思《おも》い出《だ》そう。',
        '1つずつ 聞《き》いて、しごとの なまえが あう 文《ぶん》を さがそう。',
      ],
      explain: `${d.at + 1}ばんめの 文《ぶん》が「${d.ja}に なりたい」です。`,
      explainFigure: { kind: 'column', items: d.lines.map((l) => enText(l, 'm')) },
      identity: `desc:${slugOf(d.lines[d.at]!)}`,
      alt: true,
    }),
  );
}

// ---- want 練習（10問） ----
const WANT: { text: string; ok: string; verb: string; word: string }[] = [
  {
    text: 'I want to eat pizza.',
    ok: 'ピザを 食《た》べたい',
    verb: 'ピザを 作《つく》りたい',
    word: 'カレーを 食《た》べたい',
  },
  {
    text: 'I want to make a cake.',
    ok: 'ケーキを 作《つく》りたい',
    verb: 'ケーキを 食《た》べたい',
    word: 'クッキーを 作《つく》りたい',
  },
  {
    text: 'I want to see pandas.',
    ok: 'パンダを 見《み》たい',
    verb: 'パンダの 絵《え》を かきたい',
    word: 'コアラを 見《み》たい',
  },
  {
    text: 'I want to go to Canada.',
    ok: 'カナダに 行《い》きたい',
    verb: 'カナダの 本《ほん》を 読《よ》みたい',
    word: 'ケニアに 行《い》きたい',
  },
  {
    text: 'I want to play the guitar.',
    ok: 'ギターを ひきたい',
    verb: 'ギターを 買《か》いたい',
    word: 'ピアノを ひきたい',
  },
  {
    text: 'I want to swim in the sea.',
    ok: '海《うみ》で およぎたい',
    verb: '海《うみ》を 見《み》たい',
    word: '川《かわ》で およぎたい',
  },
  {
    text: 'I want to read many books.',
    ok: '本《ほん》を たくさん 読《よ》みたい',
    verb: '本《ほん》を たくさん 買《か》いたい',
    word: '手紙《てがみ》を たくさん 読《よ》みたい',
  },
  {
    text: 'I want to climb a big mountain.',
    ok: '大《おお》きな 山《やま》に 登《のぼ》りたい',
    verb: '大《おお》きな 山《やま》を 見《み》たい',
    word: '大《おお》きな 木《き》に 登《のぼ》りたい',
  },
  {
    text: 'I want to join the soccer team.',
    ok: 'サッカー部《ぶ》に 入《はい》りたい',
    verb: 'サッカーの しあいを 見《み》たい',
    word: '野球部《やきゅうぶ》に 入《はい》りたい',
  },
  {
    text: 'I want to study science.',
    ok: '理科《りか》を 勉強《べんきょう》したい',
    verb: '理科《りか》を 教《おし》えたい',
    word: '算数《さんすう》を 勉強《べんきょう》したい',
  },
];

function wantItems(): Item[] {
  return WANT.map((w) =>
    listen({
      id: `want:${slugOf(w.text)}`,
      objective: 'want',
      level: 1,
      prompt: 'この 人《ひと》が したい ことは どれ？',
      audio: en('future', w.text),
      options: [
        { label: w.ok, correct: true },
        { label: w.verb, misconception: 'verb-mix' },
        { label: w.word, misconception: 'word-mix' },
      ],
      hints: [
        '「〜したい」と いう いみの ことばの あとに、する ことが くるよ。',
        'すぐ あとの ことばが「なにを するか」（行《い》く・見《み》る・食《た》べる など）だよ。',
        'さいごの ほうの ことばが「なにを・どこで」だよ。2つを あわせよう。',
      ],
      explain: `「${w.ok}」と いって います。`,
      explainFigure: enText(w.text),
      identity: `want:${slugOf(w.text)}`,
    }),
  );
}

// ---- want 別例（すき と したい） ----
const LIKEWANT: { text: string; like: string; ok: string; lw: string; verb: string }[] = [
  {
    text: 'I like soccer. I want to play baseball.',
    like: 'サッカー',
    ok: '野球《やきゅう》を したい',
    lw: 'サッカーを したい',
    verb: '野球《やきゅう》を 見《み》たい',
  },
  {
    text: 'I like cats. I want to see pandas.',
    like: 'ねこ',
    ok: 'パンダを 見《み》たい',
    lw: 'ねこを 見《み》たい',
    verb: 'パンダの 絵《え》を かきたい',
  },
  {
    text: 'I like music. I want to play the drums.',
    like: '音楽《おんがく》',
    ok: 'ドラムを たたきたい',
    lw: '音楽《おんがく》を 聞《き》きたい',
    verb: 'ドラムを 買《か》いたい',
  },
  {
    text: 'I like Italy. I want to go to France.',
    like: 'イタリア',
    ok: 'フランスに 行《い》きたい',
    lw: 'イタリアに 行《い》きたい',
    verb: 'フランスの 料理《りょうり》を 食《た》べたい',
  },
];

function likeWantItems(): Item[] {
  return LIKEWANT.map((l) =>
    listen({
      id: `likewant:${slugOf(l.text)}`,
      objective: 'want',
      level: 1,
      prompt: 'この 人《ひと》が したい ことは どれ？ すきな ことも いって いるよ。',
      audio: en('future', l.text),
      options: [
        { label: l.ok, correct: true },
        { label: l.lw, misconception: 'like-want' },
        { label: l.verb, misconception: 'verb-mix' },
      ],
      hints: [
        '2つの 文《ぶん》が あるよ。1つは「すき」、もう1つは「したい」。',
        '2つめの 文《ぶん》が「〜したい」の 文《ぶん》だよ。',
        '2つめの 文《ぶん》の まんなかと さいごを 聞《き》こう。',
      ],
      explain: `${l.like}が すきで、「${l.ok}」と いって います。`,
      explainFigure: enText(l.text, 'm'),
      identity: `likewant:${slugOf(l.text)}`,
      alt: true,
    }),
  );
}

// ---- dream（発表 8 本） ----
interface Dream {
  id: string;
  lines: [string, string, string];
  ask: string;
  at: number;
  ok: string;
  wrong: [[string, string], [string, string]];
  gist: string;
  gistWrong: [string, string];
}
const DREAMS: Dream[] = [
  {
    id: 'vet',
    lines: ['My dream is to be a vet.', 'I like animals.', 'I want to help sick animals.'],
    ask: 'どうして その しごとを したいの？',
    at: 2,
    ok: '動物《どうぶつ》が すきだから',
    wrong: [
      ['花《はな》が すきだから', 'reason-mix'],
      ['お店《みせ》を したいから', 'reason-mix'],
    ],
    gist: 'じゅういに なって 動物《どうぶつ》を たすけたい 話《はなし》',
    gistWrong: [
      '動物《どうぶつ》を たくさん かいたい 話《はなし》',
      '医者《いしゃ》に なって 人《ひと》を たすけたい 話《はなし》',
    ],
  },
  {
    id: 'pilot',
    lines: ['My dream is to be a pilot.', 'I like airplanes.', 'I want to go to many countries.'],
    ask: 'なにに なりたい？',
    at: 1,
    ok: 'パイロット',
    wrong: [
      ['宇宙《うちゅう》飛行士《ひこうし》', 'job-near'],
      ['先生《せんせい》', 'job-mix'],
    ],
    gist: 'パイロットに なって いろいろな 国《くに》へ 行《い》きたい 話《はなし》',
    gistWrong: [
      'ひこうきを 作《つく》りたい 話《はなし》',
      'いろいろな 国《くに》の 料理《りょうり》を 食《た》べたい 話《はなし》',
    ],
  },
  {
    id: 'band',
    lines: [
      'In junior high school, I want to join the brass band.',
      'I like music.',
      'I want to play the trumpet.',
    ],
    ask: 'なんの 楽器《がっき》を えんそうしたい？',
    at: 3,
    ok: 'トランペット',
    wrong: [
      ['ピアノ', 'detail-what'],
      ['ギター', 'detail-what'],
    ],
    gist: '中学校《ちゅうがっこう》で すいそうがく部《ぶ》に 入《はい》りたい 話《はなし》',
    gistWrong: [
      '音楽《おんがく》の 先生《せんせい》に なりたい 話《はなし》',
      'トランペットを 買《か》いたい 話《はなし》',
    ],
  },
  {
    id: 'baker',
    lines: [
      'My dream is to be a baker.',
      'I like bread.',
      'I want to make delicious bread for my town.',
    ],
    ask: 'だれの ために パンを 作《つく》りたい？',
    at: 3,
    ok: '町《まち》の 人《ひと》',
    wrong: [
      ['かぞく', 'detail-who'],
      ['ともだち', 'detail-who'],
    ],
    gist: 'パンやさんに なって 町《まち》の ために パンを 作《つく》りたい 話《はなし》',
    gistWrong: [
      'パンを たくさん 食《た》べたい 話《はなし》',
      'ケーキやさんに なりたい 話《はなし》',
    ],
  },
  {
    id: 'soccer',
    lines: [
      'In junior high school, I want to join the soccer team.',
      'I want to run fast.',
      'I also want to make many friends.',
    ],
    ask: 'どの 部《ぶ》に 入《はい》りたい？',
    at: 1,
    ok: 'サッカー部《ぶ》',
    wrong: [
      ['野球部《やきゅうぶ》', 'detail-what'],
      ['陸上部《りくじょうぶ》', 'detail-what'],
    ],
    gist: '中学校《ちゅうがっこう》で サッカー部《ぶ》に 入《はい》って がんばりたい 話《はなし》',
    gistWrong: [
      '友《とも》だちと サッカーを 見《み》に 行《い》く 話《はなし》',
      '中学校《ちゅうがっこう》の 友《とも》だちを しょうかいする 話《はなし》',
    ],
  },
  {
    id: 'teacher',
    lines: ['My dream is to be a teacher.', 'I like children.', 'I want to teach math.'],
    ask: 'なにを 教《おし》えたい？',
    at: 3,
    ok: '算数《さんすう》',
    wrong: [
      ['英語《えいご》', 'detail-what'],
      ['音楽《おんがく》', 'detail-what'],
    ],
    gist: '先生《せんせい》に なって 算数《さんすう》を 教《おし》えたい 話《はなし》',
    gistWrong: [
      '子《こ》どもと あそびたい 話《はなし》',
      '算数《さんすう》を 勉強《べんきょう》したい 話《はなし》',
    ],
  },
  {
    id: 'singer',
    lines: ['My dream is to be a singer.', 'I like singing.', 'I want to sing on a big stage.'],
    ask: 'どこで 歌《うた》いたい？',
    at: 3,
    ok: '大《おお》きな ステージ',
    wrong: [
      ['学校《がっこう》の 教室《きょうしつ》', 'detail-place'],
      ['大《おお》きな 公園《こうえん》', 'detail-place'],
    ],
    gist: '歌手《かしゅ》に なって 大《おお》きな ステージで 歌《うた》いたい 話《はなし》',
    gistWrong: [
      '歌《うた》を 聞《き》くのが すきな 話《はなし》',
      'ステージを 作《つく》りたい 話《はなし》',
    ],
  },
  {
    id: 'english',
    lines: [
      'In junior high school, I want to study English hard.',
      'I want to go to Australia.',
      'I want to see koalas.',
    ],
    ask: 'どこへ 行《い》きたい？',
    at: 2,
    ok: 'オーストラリア',
    wrong: [
      ['カナダ', 'detail-place'],
      ['アメリカ', 'detail-place'],
    ],
    gist: '英語《えいご》を がんばって オーストラリアへ 行《い》きたい 話《はなし》',
    gistWrong: [
      'オーストラリアの 先生《せんせい》の 話《はなし》',
      'どうぶつえんで コアラを 見《み》た 話《はなし》',
    ],
  },
];

const linesFig = (lines: string[]): Figure => ({
  kind: 'column',
  items: lines.map((l) => enText(l, 'm')),
});

function dreamItems(): Item[] {
  const out: Item[] = [];
  for (const d of DREAMS) {
    const audio = d.lines.map((l) => en('dream', l));
    out.push(
      listen({
        id: `dream:${d.id}`,
        objective: 'dream',
        level: 2,
        prompt: `みじかい 発表《はっぴょう》を 聞《き》こう。${d.ask}`,
        audio,
        gapMs: 700,
        options: [
          { label: d.ok, correct: true },
          { label: d.wrong[0][0], misconception: d.wrong[0][1] },
          { label: d.wrong[1][0], misconception: d.wrong[1][1] },
        ],
        hints: [
          '発表《はっぴょう》は 3つの 文《ぶん》で できて いるよ。',
          `${d.at}つめの 文《ぶん》に こたえが あるよ。`,
          `${d.at}つめの 文《ぶん》の さいごの ほうを よく 聞《き》こう。`,
        ],
        explain: `${d.at}つめの 文《ぶん》から、こたえは「${d.ok}」です。`,
        explainFigure: linesFig(d.lines),
        identity: `dream:${d.id}`,
      }),
    );
    out.push(
      listen({
        id: `gist:${d.id}`,
        objective: 'dream',
        level: 2,
        prompt: 'みじかい 発表《はっぴょう》を 聞《き》こう。どんな 話《はなし》だった？',
        audio,
        gapMs: 700,
        options: [
          { label: d.gist, correct: true },
          { label: d.gistWrong[0], misconception: 'gist-part' },
          { label: d.gistWrong[1], misconception: 'gist-part' },
        ],
        layout: 'column',
        hints: [
          '1つめの 文《ぶん》で、なにを したいかが わかるよ。',
          '2つめ・3つめの 文《ぶん》で、わけや くわしい ことが わかるよ。',
          'ぜんぶの 文《ぶん》に あう ものを えらぼう。',
        ],
        explain: `「${d.gist}」です。`,
        explainFigure: linesFig(d.lines),
        identity: `gist:${d.id}`,
        alt: true,
      }),
    );
  }
  return out;
}

export const future: UnitSpec = {
  id: 'g6.en.future',
  title: 'したい こと・なりたい ものを 聞《き》こう',
  stage: 'g6',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g6.en.past'],
  objectives: [
    { id: 'be', title: 'なりたい もの（しごと）を 聞《き》きとる' },
    {
      id: 'want',
      title: 'したい こと（行《い》きたい・見《み》たい・食《た》べたい など）を 聞《き》きとる',
    },
    {
      id: 'dream',
      title: 'ゆめや 中学校《ちゅうがっこう》で したい ことの 発表《はっぴょう》が わかる',
    },
  ],
  misconceptions: [
    {
      id: 'job-near',
      explain:
        'にて いる しごとと とりちがえたのかな。文《ぶん》の さいごの しごとの なまえを もういちど 聞《き》こう。',
    },
    {
      id: 'job-mix',
      explain: 'ちがう しごとを えらんだのかな。「〜に なりたい」の あとの ことばを 聞《き》こう。',
    },
    {
      id: 'verb-mix',
      explain:
        '「なにを するか」の ことば（行《い》く・見《み》る・食《た》べる など）を とりちがえたのかな。「〜したい」の すぐ あとの ことばを 聞《き》こう。',
    },
    {
      id: 'word-mix',
      explain:
        'ものや ばしょの ことばを とりちがえたのかな。さいごの ほうの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'like-want',
      explain:
        '「すき」と「したい」を とりちがえたのかな。「すき」の 文《ぶん》と「したい」の 文《ぶん》を わけて 聞《き》こう。',
    },
    {
      id: 'reason-mix',
      explain:
        'わけ（どうして）を とりちがえたのかな。「〜が すき」と いって いる 文《ぶん》を 聞《き》こう。',
    },
    {
      id: 'detail-what',
      explain: 'ものを とりちがえたのかな。その ぶぶんの 文《ぶん》を もういちど 聞《き》こう。',
    },
    {
      id: 'detail-who',
      explain: 'だれの ためかを とりちがえたのかな。文《ぶん》の さいごの ことばを 聞《き》こう。',
    },
    {
      id: 'detail-place',
      explain: 'ばしょを とりちがえたのかな。「どこ」を いう ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'gist-part',
      explain:
        '発表《はっぴょう》の 一部《いちぶ》だけ、または 発表《はっぴょう》に ない ことで えらんだのかな。ぜんぶの 文《ぶん》に あうか たしかめよう。',
    },
  ],
  levels: [
    { label: 'なりたい もの', chance: 0.05 },
    { label: 'したい こと', chance: 0.05 },
    { label: 'みじかい 発表《はっぴょう》', chance: 0.05 },
  ],
  intro: [
    {
      text: '「〜に なりたい」は、将来《しょうらい》の ゆめを つたえる 言《い》い方《かた》だよ。',
      figure: { kind: 'column', items: [enText('I want to be a pilot.', 'l')] },
    },
    {
      text: '「〜したい」の あとに、する こと（行《い》く・見《み》る・食《た》べる など）が くるよ。',
      figure: {
        kind: 'column',
        items: [enText('I want to go to Canada.', 'l'), enText('I want to eat pizza.', 'l')],
      },
    },
  ],
  source: {
    kind: 'items',
    items: [...beItems(), ...descItems(), ...wantItems(), ...likeWantItems(), ...dreamItems()],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（日常生活に関する身近で簡単な事柄について、具体的な情報を聞き取る／短い話の概要を捉える）。将来の夢・中学校でしたいこと（I want to 〜.）',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
