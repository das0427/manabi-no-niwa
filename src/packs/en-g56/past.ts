/**
 * g6.en.past すぎた ことを 聞《き》きとる（基本的な 過去形《かこけい》）（curriculum-matrix 3.9。外56）。
 *   段階0: 絵と 語（went / ate / saw / played / enjoyed …）
 *   段階1: いま の ことか、すぎた ことか
 *   段階2: みじかい 話《はなし》（3文）の くわしい ところ・あらまし
 * 同一性キー: 形式 × 英文（話は 話 × 問い）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, ordinalOptions, pickOthers, slugOf } from './lib';

interface Did {
  text: string;
  ja: string;
  /** 同じ 動き（went など）の 文の なかま */
  verb: string;
  il?: string;
}
const DID: Did[] = [
  { text: 'I went to the sea.', ja: 'うみに いった', verb: 'went' },
  { text: 'I went to the mountains.', ja: 'やまに いった', verb: 'went' },
  { text: 'I went to the zoo.', ja: 'どうぶつえんに いった', verb: 'went', il: 'elephant' },
  { text: 'I ate ice cream.', ja: 'アイスクリームを たべた', verb: 'ate', il: 'p5-icecream' },
  { text: 'I ate watermelon.', ja: 'すいかを たべた', verb: 'ate', il: 'watermelon' },
  { text: 'I saw fireworks.', ja: 'はなびを 見《み》た', verb: 'saw' },
  { text: 'I saw a rainbow.', ja: 'にじを 見《み》た', verb: 'saw' },
  { text: 'I played soccer.', ja: 'サッカーを した', verb: 'played', il: 'ball' },
  { text: 'I enjoyed camping.', ja: 'キャンプを たのしんだ', verb: 'enjoyed' },
  { text: 'I watched a movie.', ja: 'えいがを 見《み》た', verb: 'watched' },
  {
    text: 'I visited my grandmother.',
    ja: 'おばあさんの いえに いった',
    verb: 'visited',
    il: 'house',
  },
  { text: 'I swam in the river.', ja: 'かわで およいだ', verb: 'swam' },
];

const didOpt = (d: Did): ChoiceOption => ({
  ...(d.il ? { figure: { kind: 'illust', id: d.il } as Figure } : {}),
  label: d.ja,
});

function didItems(): Item[] {
  const out: Item[] = [];
  DID.forEach((d, i) => {
    const same = pickOthers(DID, i, 1, (x) => x !== d && x.verb === d.verb);
    const rest = pickOthers(
      DID,
      i,
      2 - same.length,
      (x) => x !== d && !same.includes(x) && x.verb !== d.verb,
    );
    out.push(
      listen({
        id: `did:${slugOf(d.text)}`,
        objective: 'did',
        level: 0,
        prompt: 'この 人《ひと》が した ことは どれ？',
        audio: en('past', d.text),
        options: [
          { ...didOpt(d), correct: true },
          ...same.map((x) => ({ ...didOpt(x), misconception: 'word-mix' })),
          ...rest.map((x) => ({ ...didOpt(x), misconception: 'verb-mix' })),
        ],
        hints: [
          '2つめの ことばが「なにを したか」を あらわすよ。',
          'さいごの ほうの ことばが、どこ・なに を あらわすよ。',
          'どちらの ことばも もういちど 聞《き》いて、2つを あわせよう。',
        ],
        explain: `「${d.ja}」と いって います。すぎた ことを いう 形《かたち》です。`,
        explainFigure: enText(d.text),
        identity: `did:${d.text}`,
      }),
    );
  });
  // 別例: すぎた ことを あらわす ことば 1つだけを 聞く
  const VERBS: [string, string, string, string][] = [
    ['went', 'いった', 'いく', 'たべた'],
    ['ate', 'たべた', 'たべる', 'みた'],
    ['saw', 'みた', 'みる', 'いった'],
    ['played', 'あそんだ・した', 'あそぶ・する', 'たべた'],
    ['enjoyed', 'たのしんだ', 'たのしむ', 'みた'],
    ['swam', 'およいだ', 'およぐ', 'いった'],
  ];
  for (const [v, past, now, other] of VERBS) {
    out.push(
      listen({
        id: `verb:${v}`,
        objective: 'did',
        level: 0,
        prompt: '聞《き》こえた ことばの いみは どれ？',
        audio: en('verb', v),
        options: [
          { label: past, correct: true },
          { label: now, misconception: 'tense-mix' },
          { label: other, misconception: 'verb-mix' },
        ],
        hints: [
          'すぎた ことを あらわす ことばだよ。',
          'いまの ことを あらわす 形《かたち》とは 音《おと》が ちがうよ。',
          'こたえは「〜た」か「〜だ」で おわる ことばだよ。',
        ],
        explain: `「${past}」と いう いみです。`,
        explainFigure: enText(v, 'xl'),
        identity: `verb:${v}`,
        alt: true,
      }),
    );
  }
  return out;
}

/**
 * いま（いつも）の 文と すぎた 文。
 * -ed の 文は、つぎの 語を 母音で はじめる（watched TV・played tennis のように つぎの 子音に -ed の 音が
 * のみこまれて、いまの 文と 聞き分けられない 組を さける）。
 */
const TENSE: { now: string; past: string; ja: string }[] = [
  { now: 'I play outside.', past: 'I played outside.', ja: 'そとで あそぶ' },
  { now: 'I go to the park.', past: 'I went to the park.', ja: 'こうえんに いく' },
  { now: 'I eat bread.', past: 'I ate bread.', ja: 'パンを たべる' },
  { now: 'I see birds.', past: 'I saw birds.', ja: 'とりを 見《み》る' },
  { now: 'I watch a movie.', past: 'I watched a movie.', ja: 'えいがを 見《み》る' },
  { now: 'I swim in the sea.', past: 'I swam in the sea.', ja: 'うみで およぐ' },
  { now: 'I enjoy English.', past: 'I enjoyed English.', ja: 'えいごを たのしむ' },
  { now: 'I make a cake.', past: 'I made a cake.', ja: 'ケーキを つくる' },
];

function tenseItems(): Item[] {
  const out: Item[] = [];
  TENSE.forEach((t, i) => {
    const isPast = i % 2 === 0;
    const text = isPast ? t.past : t.now;
    out.push(
      listen({
        id: `tense:${slugOf(text)}`,
        objective: 'tense',
        level: 1,
        prompt: 'いまの こと（いつも する こと）？ それとも、すぎた こと？',
        audio: en('past', text),
        options: [
          {
            label: 'すぎた こと（きのう など）',
            ...(isPast ? { correct: true } : { misconception: 'tense-mix' }),
          },
          {
            label: 'いまの こと（いつも する こと）',
            ...(!isPast ? { correct: true } : { misconception: 'tense-mix' }),
          },
        ],
        fixedOrder: true,
        hints: [
          '2つめの ことばを よく 聞《き》こう。',
          'すぎた ことは、ことばの 形《かたち》や 音《おと》が かわるよ。',
          `この 文《ぶん》は「${t.ja}」に かんけいする 文《ぶん》だよ。2つめの ことばの 形《かたち》と 音《おと》に ちゅうもく。`,
        ],
        explain: isPast
          ? 'すぎた ことを いう 形《かたち》です。'
          : 'いつも する ことを いう 形《かたち》です。',
        explainFigure: { kind: 'column', items: [enText(t.now, 'm'), enText(t.past, 'm')] },
        identity: `tense:${text}`,
      }),
    );
  });
  // 別例: 2つの 文を 聞いて、すぎた ことの ほうを えらぶ
  TENSE.forEach((t, i) => {
    if (i % 2 === 0) return;
    const pos = (i >> 1) % 2;
    const seq = pos === 0 ? [t.past, t.now] : [t.now, t.past];
    out.push(
      listen({
        id: `tense-pair:${slugOf(t.past)}`,
        objective: 'tense',
        level: 1,
        prompt: '2つの 文《ぶん》を 聞《き》こう。すぎた ことを いって いるのは どっち？',
        audio: seq.map((s) => en('past', s)),
        gapMs: 900,
        options: ordinalOptions(2, pos, () => 'tense-mix'),
        fixedOrder: true,
        hints: [
          '2つの 文《ぶん》は、2つめの ことばだけが ちがうよ。',
          'すぎた ことは、ことばの 形《かたち》や 音《おと》が かわるよ。',
          '2つめの ことばの 音《おと》を くらべよう。ことば ぜんたいが かわる ものも あるよ。',
        ],
        explain: `${pos + 1}ばんめが すぎた ことを いう 形《かたち》です。`,
        explainFigure: { kind: 'column', items: [enText(seq[0]!, 'm'), enText(seq[1]!, 'm')] },
        identity: `tense-pair:${t.past}`,
        alt: true,
      }),
    );
  });
  return out;
}

interface Story {
  id: string;
  lines: [string, string, string];
  qs: { ask: string; right: string; wrong: [string, string]; mis: [string, string]; at: number }[];
  gist: { right: string; wrong: [string, string] };
}
const STORIES: Story[] = [
  {
    id: 'zoo',
    lines: ['I went to the zoo with my family.', 'I saw a big elephant.', 'It was fun.'],
    qs: [
      {
        ask: 'どこへ いった？',
        right: 'どうぶつえん',
        wrong: ['こうえん', 'うみ'],
        mis: ['detail-place', 'detail-place'],
        at: 1,
      },
      {
        ask: 'なにを 見《み》た？',
        right: 'おおきな ぞう',
        wrong: ['ちいさな さる', 'おおきな くま'],
        mis: ['detail-what', 'detail-what'],
        at: 2,
      },
    ],
    gist: {
      right: 'かぞくで どうぶつえんに いった はなし',
      wrong: ['ひとりで どうぶつを かった はなし', 'うみで およいだ はなし'],
    },
  },
  {
    id: 'sea',
    lines: ['I went to the sea last summer.', 'I swam with my brother.', 'The water was cold.'],
    qs: [
      {
        ask: 'だれと およいだ？',
        right: 'あにか おとうと',
        wrong: ['ともだち', 'おかあさん'],
        mis: ['detail-who', 'detail-who'],
        at: 2,
      },
      {
        ask: 'みずは どうだった？',
        right: 'つめたかった',
        wrong: ['あたたかかった', 'あまかった'],
        mis: ['detail-how', 'detail-how'],
        at: 3,
      },
    ],
    gist: {
      right: 'なつに うみで およいだ はなし',
      wrong: ['ふゆに やまに いった はなし', 'プールで あそんだ はなし'],
    },
  },
  {
    id: 'festival',
    lines: ['I went to a summer festival.', 'I ate shaved ice.', 'I enjoyed the fireworks.'],
    qs: [
      {
        ask: 'なにを たべた？',
        right: 'かきごおり',
        wrong: ['アイスクリーム', 'すいか'],
        mis: ['detail-what', 'detail-what'],
        at: 2,
      },
      {
        ask: 'なにを たのしんだ？',
        right: 'はなび',
        wrong: ['おどり', 'ゲーム'],
        mis: ['detail-what', 'detail-what'],
        at: 3,
      },
    ],
    gist: {
      right: 'なつまつりに いった はなし',
      wrong: ['りょうりを つくった はなし', 'がっこうで べんきょうした はなし'],
    },
  },
  {
    id: 'mountain',
    lines: [
      'I went camping in the mountains.',
      'I saw many stars at night.',
      'They were beautiful.',
    ],
    qs: [
      {
        ask: 'どこで キャンプを した？',
        right: 'やま',
        wrong: ['うみ', 'にわ'],
        mis: ['detail-place', 'detail-place'],
        at: 1,
      },
      {
        ask: 'よるに なにを 見《み》た？',
        right: 'たくさんの ほし',
        wrong: ['つき', 'にじ'],
        mis: ['detail-what', 'detail-what'],
        at: 2,
      },
    ],
    gist: {
      right: 'やまで キャンプを して ほしを 見《み》た はなし',
      wrong: ['やまで スキーを した はなし', 'いえで テレビを 見《み》た はなし'],
    },
  },
  {
    id: 'cake',
    lines: ['I made a cake for my mother.', 'She was very happy.', 'We ate it together.'],
    qs: [
      {
        ask: 'だれの ために ケーキを つくった？',
        right: 'おかあさん',
        wrong: ['おとうさん', 'ともだち'],
        mis: ['detail-who', 'detail-who'],
        at: 1,
      },
      {
        ask: 'おかあさんは どんな ようすだった？',
        right: 'とても うれしそう',
        wrong: ['かなしそう', 'ねむそう'],
        mis: ['detail-how', 'detail-how'],
        at: 2,
      },
    ],
    gist: {
      right: 'おかあさんに ケーキを つくった はなし',
      wrong: ['ケーキを かいに いった はなし', 'おかあさんが ケーキを つくった はなし'],
    },
  },
  {
    id: 'sports',
    lines: ['We had a sports day yesterday.', 'I ran fast.', 'My team won.'],
    qs: [
      {
        ask: 'いつの こと？',
        right: 'きのう',
        wrong: ['きょう', 'あした'],
        mis: ['detail-when', 'detail-when'],
        at: 1,
      },
      {
        ask: 'この 人《ひと》の チームは どうなった？',
        right: 'かった',
        wrong: ['まけた', 'ひきわけた'],
        mis: ['detail-how', 'detail-how'],
        at: 3,
      },
    ],
    gist: {
      right: 'うんどうかいで はしって チームが かった はなし',
      wrong: ['うんどうかいが ちゅうしに なった はなし', 'サッカーの しあいを 見《み》た はなし'],
    },
  },
  {
    id: 'library',
    lines: [
      'I went to the library on Sunday.',
      'I borrowed a book about space.',
      'It was interesting.',
    ],
    qs: [
      {
        ask: 'なんようびの こと？',
        right: 'にちようび',
        wrong: ['どようび', 'げつようび'],
        mis: ['detail-when', 'detail-when'],
        at: 1,
      },
      {
        ask: 'なにに ついての ほんを かりた？',
        right: 'うちゅう',
        wrong: ['どうぶつ', 'りょうり'],
        mis: ['detail-what', 'detail-what'],
        at: 2,
      },
    ],
    gist: {
      right: 'としょかんで うちゅうの ほんを かりた はなし',
      wrong: ['ほんやで ほんを かった はなし', 'えいがを 見《み》た はなし'],
    },
  },
  {
    id: 'snow',
    lines: [
      'It snowed last winter.',
      'I made a snowman with my sister.',
      'My hands were very cold.',
    ],
    qs: [
      {
        ask: 'なにを つくった？',
        right: 'ゆきだるま',
        wrong: ['かまくら', 'ケーキ'],
        mis: ['detail-what', 'detail-what'],
        at: 2,
      },
      {
        ask: 'だれと つくった？',
        right: 'あねか いもうと',
        wrong: ['あにか おとうと', 'ともだち'],
        mis: ['detail-who', 'detail-who'],
        at: 2,
      },
    ],
    gist: {
      right: 'ふゆに ゆきだるまを つくった はなし',
      wrong: ['なつに うみで あそんだ はなし', 'ゆきの ひに いえで ねて いた はなし'],
    },
  },
  {
    id: 'grandma',
    lines: [
      'I visited my grandmother in August.',
      'We cooked curry together.',
      'It was delicious.',
    ],
    qs: [
      {
        ask: 'なんがつの こと？',
        right: '8がつ',
        wrong: ['4がつ', '10がつ'],
        mis: ['detail-when', 'detail-when'],
        at: 1,
      },
      {
        ask: 'いっしょに なにを した？',
        right: 'カレーを つくった',
        wrong: ['ケーキを つくった', 'カレーを かった'],
        mis: ['detail-what', 'verb-mix'],
        at: 2,
      },
    ],
    gist: {
      right: 'おばあさんと カレーを つくった はなし',
      wrong: ['おばあさんが びょうきに なった はなし', 'ともだちと レストランに いった はなし'],
    },
  },
  {
    id: 'trip',
    lines: [
      'I went to Kyoto on the school trip.',
      'I saw an old temple.',
      'I bought a fan for my father.',
    ],
    qs: [
      {
        ask: 'どこへ いった？',
        right: 'きょうと',
        wrong: ['なら', 'おおさか'],
        mis: ['detail-place', 'detail-place'],
        at: 1,
      },
      {
        ask: 'おとうさんに なにを かった？',
        right: 'せんす',
        wrong: ['ぼうし', 'おかし'],
        mis: ['detail-what', 'detail-what'],
        at: 3,
      },
    ],
    gist: {
      right: 'しゅうがくりょこうで きょうとに いった はなし',
      wrong: ['かぞくで うみに いった はなし', 'おとうさんが きょうとに いった はなし'],
    },
  },
];

function storyItems(): Item[] {
  const out: Item[] = [];
  for (const s of STORIES) {
    const audio = s.lines.map((l) => en('story', l));
    for (const [qi, q] of s.qs.entries())
      out.push(
        listen({
          id: `story:${s.id}:${qi}`,
          objective: 'story',
          level: 2,
          prompt: `みじかい 話《はなし》を 聞《き》こう。${q.ask}`,
          audio,
          gapMs: 700,
          options: [
            { label: q.right, correct: true },
            { label: q.wrong[0], misconception: q.mis[0] },
            { label: q.wrong[1], misconception: q.mis[1] },
          ],
          hints: [
            '話《はなし》は 3つの 文《ぶん》で できて いるよ。',
            `${q.at}つめの 文《ぶん》に こたえが あるよ。`,
            `${q.at}つめの 文《ぶん》の さいごの ほうを よく 聞《き》こう。`,
          ],
          explain: `${q.at}つめの 文《ぶん》から、こたえは「${q.right}」です。`,
          explainFigure: { kind: 'column', items: s.lines.map((l) => enText(l, 'm')) },
          identity: `story:${s.id}:${qi}`,
        }),
      );
    out.push(
      listen({
        id: `gist:${s.id}`,
        objective: 'story',
        level: 2,
        prompt: 'みじかい 話《はなし》を 聞《き》こう。どんな 話《はなし》だった？',
        audio,
        gapMs: 700,
        options: [
          { label: s.gist.right, correct: true },
          { label: s.gist.wrong[0], misconception: 'gist-part' },
          { label: s.gist.wrong[1], misconception: 'gist-part' },
        ],
        layout: 'column',
        hints: [
          '1つめの 文《ぶん》で、どこで・なにを したかが わかるよ。',
          '2つめ・3つめの 文《ぶん》で、そのとき どうだったかが わかるよ。',
          'ぜんぶの 文《ぶん》に あう ものを えらぼう。',
        ],
        explain: `「${s.gist.right}」です。`,
        explainFigure: { kind: 'column', items: s.lines.map((l) => enText(l, 'm')) },
        identity: `gist:${s.id}`,
        alt: true,
      }),
    );
  }
  return out;
}

export const past: UnitSpec = {
  id: 'g6.en.past',
  title: 'すぎた ことを 聞《き》こう',
  stage: 'g6',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g5.en.listen-self'],
  objectives: [
    { id: 'did', title: 'した ことを あらわす 文《ぶん》・ことばが わかる' },
    { id: 'tense', title: 'いまの ことか、すぎた ことかが わかる' },
    { id: 'story', title: 'みじかい 話《はなし》の くわしい ところ・あらましが わかる' },
  ],
  misconceptions: [
    {
      id: 'word-mix',
      explain:
        'ばしょや ものの ことばを とりちがえたのかな。さいごの ほうの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'verb-mix',
      explain: '「なにを したか」の ことばを とりちがえたのかな。2つめの ことばを 聞《き》こう。',
    },
    {
      id: 'tense-mix',
      explain:
        'いまの ことと すぎた ことを とりちがえたのかな。すぎた ことは ことばの 形《かたち》や 音《おと》が かわるよ。',
    },
    {
      id: 'detail-place',
      explain: 'ばしょを とりちがえたのかな。「どこ」を いう ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'detail-what',
      explain: 'ものを とりちがえたのかな。その ぶぶんの 文《ぶん》を もういちど 聞《き》こう。',
    },
    {
      id: 'detail-who',
      explain: 'だれの ことかを とりちがえたのかな。人《ひと》を あらわす ことばを 聞《き》こう。',
    },
    {
      id: 'detail-how',
      explain:
        'ようすを あらわす ことばを とりちがえたのかな。さいごの ほうの ことばを 聞《き》こう。',
    },
    {
      id: 'detail-when',
      explain:
        'いつの ことかを とりちがえたのかな。「きのう」や 曜日《ようび》・月《つき》など、いつを あらわす ことばを 聞《き》こう。',
    },
    {
      id: 'gist-part',
      explain:
        '話《はなし》の 一部《いちぶ》だけ、または 話《はなし》に ない ことで えらんだのかな。ぜんぶの 文《ぶん》に あうか たしかめよう。',
    },
  ],
  levels: [
    { label: 'した ことの 文《ぶん》', chance: 0.05 },
    { label: 'いま・すぎた こと', chance: 0.05 },
    { label: 'みじかい 話《はなし》', chance: 0.05 },
  ],
  intro: [
    {
      text: 'すぎた ことを いう ときは、ことばの 形《かたち》が かわるよ。「いく」が「いった」に なる。',
      figure: {
        kind: 'column',
        items: [enText('I go to the sea.', 'l'), enText('I went to the sea.', 'l')],
      },
    },
    {
      text: 'ことばの おわりの 音《おと》が かわる ものも あるよ。「あそぶ」→「あそんだ」。',
      figure: {
        kind: 'column',
        items: [enText('I play soccer.', 'l'), enText('I played soccer.', 'l')],
      },
    },
  ],
  source: { kind: 'items', items: [...didItems(), ...tenseItems(), ...storyItems()] },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（短い話の概要を捉える）。過去形のうち活用頻度の高い基本的なもの',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
