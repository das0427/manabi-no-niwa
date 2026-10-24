/**
 * g1.ja.particles 「は」「へ」「を」（助詞の表記）。curriculum-matrix 3.4。
 *
 * 到達項目:
 *   ha  … 「〜は」（わ と聞こえる）。ことばの中の「わ」（わたし・かわ）と書き分ける
 *   he  … 「〜へ」（え と聞こえる）。ことばの中の「え」（えき・いえ）と書き分ける
 *   wo  … 「〜を」（お と聞こえる）。ことばの中の「お」（おにぎり）と書き分ける
 *   mix … 1つの文の中で「は」「へ」「を」を使い分ける
 * 練習 = 文の□に入れる（fill）。別例 = 聞いた文の正しい書き方を選ぶ（listen）、まちがいを直した文を選ぶ（choice）。
 * 同一性キー: 文ごと。
 */
import type { FillBlank, FillItem } from '../../engines/fill/fill';
import type { ListenItem } from '../../engines/listen/listen';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Obj = 'ha' | 'he' | 'wo' | 'mix';

const PAIR: Record<'ha' | 'he' | 'wo', [string, string]> = {
  ha: ['は', 'わ'],
  he: ['へ', 'え'],
  wo: ['を', 'お'],
};
const PARTICLES = ['は', 'へ', 'を'];

/** 空欄の正解の字ごとの、入れがちな誤り（mix のときは別の助詞も） */
function blankOf(ans: string, mix: boolean): FillBlank {
  const wrong: { value: string; misconception: string }[] = [];
  const sound: Record<string, [string, string]> = {
    は: ['わ', 'particle-ha-wa'],
    へ: ['え', 'particle-he-e'],
    を: ['お', 'particle-wo-o'],
    わ: ['は', 'overcorrect'],
    え: ['へ', 'overcorrect'],
    お: ['を', 'overcorrect'],
  };
  const s = sound[ans];
  if (s) wrong.push({ value: s[0], misconception: s[1] });
  if (mix && PARTICLES.includes(ans))
    for (const p of PARTICLES)
      if (p !== ans) wrong.push({ value: p, misconception: 'particle-role' });
  return { answers: [ans], wrong };
}

const HINTS: Record<Obj, [string, string, string]> = {
  ha: [
    'こえに だすと「わ」と きこえる ところを さがそう。',
    '「ぼく□」「きょう□」の ように、ことばの あとに つく じが あるよ。',
    'ことばの あとに つく「わ」の おとは、ちがう じで かくよ。ことばの なかの「わ」は そのまま。',
  ],
  he: [
    'こえに だすと「え」と きこえる ところを さがそう。',
    '「こうえん□ いく」の ように、むかう ところの あとに つく じが あるよ。',
    'むかう ところの あとに つく「え」の おとは、ちがう じで かくよ。ことばの なかの「え」は そのまま。',
  ],
  wo: [
    'こえに だすと「お」と きこえる ところを さがそう。',
    '「ほん□ よむ」の ように、なにを するかを つなぐ じが あるよ。',
    'ことばと うごきを つなぐ「お」の おとは、ちがう じで かくよ。ことばの なかの「お」は そのまま。',
  ],
  mix: [
    'つなぐ じの ところを ひとつずつ こえに だそう。',
    'だれが（なにが）・どこに むかう・なにを する、を かんがえよう。',
    'きこえる おとと、かく じが ちがう ところが あるよ。',
  ],
};

const RULE: Record<Obj, string> = {
  ha: 'ことばの あとに つく「わ」の おとは「は」と かくよ。',
  he: 'むかう ところの あとに つく「え」の おとは「へ」と かくよ。',
  wo: 'なにを するかを つなぐ「お」の おとは「を」と かくよ。',
  mix: '「は」「へ」「を」は、ことばの あとに つく ときの かきかただよ。',
};

/** [到達項目, id, 文（{{}} が空欄）, 空欄の正解] */
type F = [obj: Obj, id: string, text: string, answers: string[]];
const FILLS: F[] = [
  ['ha', 'boku', 'ぼく{{}} いちねんせいです。', ['は']],
  ['ha', 'watashi', '{{}}たし{{}} ねこが すきです。', ['わ', 'は']],
  ['ha', 'inu', 'いぬ{{}} げんきに はしる。', ['は']],
  ['ha', 'kyou', 'きょう{{}} はれです。', ['は']],
  ['ha', 'konnichiwa', 'こんにち{{}}。', ['は']],
  ['ha', 'kawa', 'かわ{{}} つめたい。', ['は']],
  ['ha', 'wani', '{{}}にさん{{}} おおきい。', ['わ', 'は']],
  ['ha', 'asagao', 'あさがお{{}} あおい。', ['は']],
  ['he', 'kouen', 'こうえん{{}} いく。', ['へ']],
  ['he', 'umi', 'うみ{{}} でかけた。', ['へ']],
  ['he', 'eki', '{{}}きの ほう{{}} あるく。', ['え', 'へ']],
  ['he', 'gakkou', 'がっこう{{}} むかう。', ['へ']],
  ['he', 'ie', 'い{{}}{{}} かえる。', ['え', 'へ']],
  ['he', 'soto', 'そと{{}} でる。', ['へ']],
  ['he', 'obaachan', 'おばあちゃんの いえ{{}} いく。', ['へ']],
  ['wo', 'hon', 'ほん{{}} よむ。', ['を']],
  ['wo', 'te', 'て{{}} あらう。', ['を']],
  ['wo', 'onigiri', '{{}}にぎり{{}} たべる。', ['お', 'を']],
  ['wo', 'mizu', 'みず{{}} のむ。', ['を']],
  ['wo', 'e', 'え{{}} かく。', ['を']],
  ['wo', 'okaasan', '{{}}かあさん{{}} よぶ。', ['お', 'を']],
  ['wo', 'ball', 'ボール{{}} なげる。', ['を']],
  ['wo', 'hana', 'はな{{}} みる。', ['を']],
  ['mix', 'boku-kouen', 'ぼく{{}} こうえん{{}} いく。', ['は', 'へ']],
  ['mix', 'watashi-hon', 'わたし{{}} ほん{{}} よむ。', ['は', 'を']],
  ['mix', 'imouto-eki', 'いもうと{{}} えき{{}} いく。', ['は', 'へ']],
  ['mix', 'neko-sakana', 'ねこ{{}} さかな{{}} たべた。', ['は', 'を']],
  ['mix', 'boku-kaban', 'ぼく{{}} がっこう{{}} かばん{{}} もって いく。', ['は', 'へ', 'を']],
  ['mix', 'otouto-umi', 'おとうと{{}} うみ{{}} いった。', ['は', 'へ']],
  ['mix', 'watashi-ie', '{{}}たし{{}} いえ{{}} かえる。', ['わ', 'は', 'へ']],
  ['mix', 'ane-te', 'あね{{}} て{{}} ふる。', ['は', 'を']],
];

function fillItem([obj, id, text, answers]: F): FillItem {
  const mix = obj === 'mix';
  const filled = answers.reduce((t, a) => t.replace('{{}}', a), text);
  return {
    engine: 'fill',
    id: `fill:${id}`,
    objective: obj,
    level: mix ? 1 : 0,
    prompt: '□に はいる じを えらぼう。',
    text,
    options: mix ? ['は', 'わ', 'へ', 'え', 'を', 'お'] : [...PAIR[obj]],
    blanks: answers.map((a) => blankOf(a, mix)),
    hints: HINTS[obj],
    explain: `「${filled}」。${RULE[obj]}`,
    identity: `fill:${id}`,
  };
}

// ---- 別例1: 聞いた文の、正しい書き方を選ぶ ----
type Ls = [obj: 'ha' | 'he' | 'wo', id: string, right: string, wrongs: Wrong[]];
const LISTENS: Ls[] = [
  [
    'ha',
    'watashi-neko',
    'わたしは ねこが すき。',
    [
      ['わたしわ ねこが すき。', 'particle-ha-wa'],
      ['はたしは ねこが すき。', 'overcorrect'],
    ],
  ],
  [
    'ha',
    'kawa-nagai',
    'かわは ながい。',
    [
      ['かわわ ながい。', 'particle-ha-wa'],
      ['かはは ながい。', 'overcorrect'],
    ],
  ],
  [
    'ha',
    'niwatori',
    'にわとりは はやおき。',
    [
      ['にわとりわ はやおき。', 'particle-ha-wa'],
      ['にはとりは はやおき。', 'overcorrect'],
    ],
  ],
  [
    'he',
    'eki-iku',
    'えきへ いく。',
    [
      ['えきえ いく。', 'particle-he-e'],
      ['へきへ いく。', 'overcorrect'],
    ],
  ],
  [
    'he',
    'ie-kaeru',
    'いえへ かえる。',
    [
      ['いええ かえる。', 'particle-he-e'],
      ['いへへ かえる。', 'overcorrect'],
    ],
  ],
  [
    'he',
    'ensoku',
    'えんそくで やまへ いく。',
    [
      ['えんそくで やまえ いく。', 'particle-he-e'],
      ['へんそくで やまへ いく。', 'overcorrect'],
    ],
  ],
  [
    'wo',
    'onigiri-taberu',
    'おにぎりを たべる。',
    [
      ['おにぎりお たべる。', 'particle-wo-o'],
      ['をにぎりを たべる。', 'overcorrect'],
    ],
  ],
  [
    'wo',
    'okashi',
    'おかしを かう。',
    [
      ['おかしお かう。', 'particle-wo-o'],
      ['をかしを かう。', 'overcorrect'],
    ],
  ],
  [
    'wo',
    'ocha',
    'おちゃを のむ。',
    [
      ['おちゃお のむ。', 'particle-wo-o'],
      ['をちゃを のむ。', 'overcorrect'],
    ],
  ],
];

function listenItem([obj, id, right, wrongs]: Ls): ListenItem {
  return {
    engine: 'listen',
    id: `listen:${id}`,
    objective: obj,
    level: 1,
    prompt: 'きこえた ぶんを ただしく かいて いるのは どれ？',
    audio: { text: right },
    options: opts(right, wrongs),
    layout: 'column',
    hints: [HINTS[obj][0], HINTS[obj][1], HINTS[obj][2]],
    explain: `「${right}」。${RULE[obj]}`,
    identity: `listen:${id}`,
    alt: true,
  };
}

// ---- 別例2: まちがいを直した文を選ぶ ----
type Fx = [id: string, wrongSentence: string, right: string, wrongs: Wrong[]];
const FIXES: Fx[] = [
  [
    'boku',
    'ぼくわ こうえんえ いく。',
    'ぼくは こうえんへ いく。',
    [
      ['ぼくわ こうえんえ いく。', 'particle-ha-wa'],
      ['ぼくは こうえんを いく。', 'particle-role'],
    ],
  ],
  [
    'imouto',
    'いもうとわ えお かく。',
    'いもうとは えを かく。',
    [
      ['いもうとは えお かく。', 'particle-wo-o'],
      ['いもうとは へを かく。', 'overcorrect'],
    ],
  ],
  [
    'watashi',
    'はたしわ がっこうへ いく。',
    'わたしは がっこうへ いく。',
    [
      ['はたしは がっこうへ いく。', 'overcorrect'],
      ['わたしわ がっこうへ いく。', 'particle-ha-wa'],
    ],
  ],
  [
    'ani',
    'あにわ みずお のむ。',
    'あには みずを のむ。',
    [
      ['あにわ みずを のむ。', 'particle-ha-wa'],
      ['あには みずへ のむ。', 'particle-role'],
    ],
  ],
];

function fixItem([id, wrongSentence, right, wrongs]: Fx): ChoiceItem {
  return {
    engine: 'choice',
    id: `fix:${id}`,
    objective: 'mix',
    level: 2,
    prompt: 'うえの ぶんには まちがいが あるよ。ただしく なおした ぶんは どれ？',
    figure: { kind: 'text', text: wrongSentence, size: 'l' },
    options: opts(right, wrongs),
    layout: 'column',
    hints: [
      'うえの ぶんの、ことばの あとに つく じを ひとつずつ みよう。',
      'まちがいは ひとつとは かぎらないよ。ぜんぶ なおして いる ぶんを えらぼう。',
      'ことばの なかの「わ」「え」「お」は そのままで いいよ。',
    ],
    explain: `「${right}」が ただしいよ。${RULE.mix}`,
    identity: `fix:${id}`,
    alt: true,
  };
}

const items: Item[] = [...FILLS.map(fillItem), ...LISTENS.map(listenItem), ...FIXES.map(fixItem)];

export const particles: UnitSpec = {
  id: 'g1.ja.particles',
  title: '「は」「へ」「を」',
  stage: 'g1',
  subject: 'ja',
  domain: 'kotoba',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: ['g1.ja.special-kana'],
  objectives: [
    { id: 'ha', title: '「わ」と きこえる「は」' },
    { id: 'he', title: '「え」と きこえる「へ」' },
    { id: 'wo', title: '「お」と きこえる「を」' },
    { id: 'mix', title: '「は」「へ」「を」を つかいわける' },
  ],
  misconceptions: [
    {
      id: 'particle-ha-wa',
      explain:
        'きこえた とおりに「わ」と かいたのかな。「ぼくは」の ように、ことばの あとに つく ときは「は」と かくよ。',
    },
    {
      id: 'particle-he-e',
      explain:
        'きこえた とおりに「え」と かいたのかな。「こうえんへ」の ように、むかう ところの あとに つく ときは「へ」と かくよ。',
    },
    {
      id: 'particle-wo-o',
      explain:
        'きこえた とおりに「お」と かいたのかな。「ほんを」の ように、なにを するかを つなぐ ときは「を」と かくよ。',
    },
    {
      id: 'overcorrect',
      explain:
        'ことばの なかの おとまで かえたのかな。「わたし」「えき」「おにぎり」の ような ことばの なかの おとは、そのまま かくよ。',
    },
    {
      id: 'particle-role',
      explain:
        'ちがう つなぐ じを いれたのかな。「どこへ いく」「なにを する」の ように、あとの ことばに あう じを えらぼう。',
    },
  ],
  levels: [
    { label: '「は」「へ」「を」を ひとつずつ', chance: 0.2 },
    { label: 'きいて えらぶ・まぜて つかう', chance: 0.1 },
    { label: 'まちがいを なおす', chance: 0.1 },
  ],
  intro: [
    {
      text: '「ぼくは」の「は」は「わ」と きこえるけど「は」と かくよ。',
      figure: { kind: 'text', text: 'ぼく**は** いちねんせい。', size: 'xl' },
    },
    {
      text: '「こうえんへ」の「へ」は「え」、「ほんを」の「を」は「お」と きこえるよ。',
      figure: { kind: 'text', text: 'こうえん**へ** いく。ほん**を** よむ。', size: 'l' },
    },
    {
      text: 'でも、「わたし」「えき」「おにぎり」の ような ことばの なかの おとは、そのまま かくよ。',
      figure: { kind: 'text', text: '**わ**たしは **え**きへ いく。', size: 'l' },
    },
  ],
  source: { kind: 'items', items },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）国語 第1学年及び第2学年 〔知識及び技能〕(1)ウ（助詞の「は」「へ」及び「を」の使い方）',
  gradeIsAppProposal: true,
  revised: REVISED,
};
