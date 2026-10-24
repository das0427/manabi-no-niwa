/**
 * g3.en.greetings あいさつ・きもちを 聞《き》いて えらぶ（curriculum-matrix 3.6。外活34 聞く・話す）。
 * 話す（まねて言う）は評価しない（2.3）。導入で「まねして いってみよう」と促すだけ。
 *
 * 同一性キー: 到達項目の形式 × 英語の表現（同じ表現でも、意味を選ぶ・場面を選ぶ は別の問題）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, enText, listen, notHint, ordinalOptions, pickOthers, slugOf } from './lib';

type Group = 'time' | 'meet' | 'polite';

interface Phrase {
  text: string;
  ja: string;
  when: string;
  group: Group;
}

/** あいさつ（12） */
const PHRASES: Phrase[] = [
  { text: 'Good morning.', ja: 'おはよう', when: 'あさ、はじめて あった とき', group: 'time' },
  {
    text: 'Good afternoon.',
    ja: 'こんにちは（ひる）',
    when: 'ひるすぎに あった とき',
    group: 'time',
  },
  { text: 'Good evening.', ja: 'こんばんは', when: 'ゆうがたや よるに あった とき', group: 'time' },
  { text: 'Good night.', ja: 'おやすみなさい', when: 'ねる まえ', group: 'time' },
  { text: 'Hello.', ja: 'やあ、こんにちは', when: 'ひとに あった とき', group: 'meet' },
  { text: 'Goodbye.', ja: 'さようなら', when: 'わかれる とき', group: 'meet' },
  { text: 'See you.', ja: 'またね', when: 'また あう やくそくで わかれる とき', group: 'meet' },
  { text: 'Nice to meet you.', ja: 'はじめまして', when: 'はじめて あった ひとに', group: 'meet' },
  { text: 'Thank you.', ja: 'ありがとう', when: 'なにかを して もらった とき', group: 'polite' },
  {
    text: "You're welcome.",
    ja: 'どういたしまして',
    when: 'おれいを いわれた とき',
    group: 'polite',
  },
  { text: "I'm sorry.", ja: 'ごめんなさい', when: 'あやまる とき', group: 'polite' },
  {
    text: 'How are you?',
    ja: 'げんき？（ちょうしは どう？）',
    when: 'あいての ようすを ききたい とき',
    group: 'polite',
  },
];

const GROUP_MIS: Record<Group, string> = {
  time: 'time-of-day',
  meet: 'meet-part',
  polite: 'thanks-sorry',
};

type Mood = 'mood' | 'body' | 'temp';
interface Feeling {
  text: string;
  ja: string;
  scene: string;
  group: Mood;
}

/** きもち・ようす（10） */
const FEELINGS: Feeling[] = [
  { text: "I'm happy.", ja: 'うれしい', scene: 'プレゼントを もらった', group: 'mood' },
  { text: "I'm sad.", ja: 'かなしい', scene: 'だいじな ものを なくした', group: 'mood' },
  { text: "I'm angry.", ja: 'おこっている', scene: 'ならんで いたのに ぬかされた', group: 'mood' },
  { text: "I'm fine.", ja: 'げんき', scene: 'きょうも ちょうしが いい', group: 'mood' },
  { text: "I'm sleepy.", ja: 'ねむい', scene: 'よる おそくまで おきて いた', group: 'body' },
  {
    text: "I'm hungry.",
    ja: 'おなかが すいた',
    scene: 'あさごはんを たべて いない',
    group: 'body',
  },
  { text: "I'm tired.", ja: 'つかれた', scene: 'たくさん はしった', group: 'body' },
  { text: "I'm thirsty.", ja: 'のどが かわいた', scene: 'みずを のみたい', group: 'body' },
  { text: "I'm hot.", ja: 'あつい', scene: 'なつの ひに そとに いる', group: 'temp' },
  { text: "I'm cold.", ja: 'さむい', scene: 'ゆきの ひに そとに いる', group: 'temp' },
];

/**
 * ばめんを えらぶ 問題で 誤りに できない 組（その ばめんでも 言えるので、正答が 2つに なる）。
 * たくさん はしった → のどが かわいた・おなかが すいた、よる おそくまで おきて いた → つかれた、
 * なつの ひに そとに いる → のどが かわいた。
 */
const SCENE_CLASH: [string, string][] = [
  ["I'm tired.", "I'm thirsty."],
  ["I'm tired.", "I'm hungry."],
  ["I'm tired.", "I'm sleepy."],
  ["I'm hot.", "I'm thirsty."],
];
export const sceneClash = (a: { text: string }, b: { text: string }): boolean =>
  SCENE_CLASH.some(([x, y]) => (a.text === x && b.text === y) || (a.text === y && b.text === x));

const FEEL_MIS: Record<Mood, string> = {
  mood: 'feel-mood',
  body: 'feel-body',
  temp: 'feel-opposite',
};

const ph = (t: string) => en('phrase', t);

/** きもちの かおの 絵（src/illust/content/en-g34.tsx）と なまえ */
const faceOpt = (f: Feeling): ChoiceOption => ({
  figure: { kind: 'illust', id: `eng34-face-${slugOf(f.text).replace(/^im-/, '')}` },
  label: f.ja,
});

// ---- 到達項目1: あいさつの いみ ----
function meaningItems(): Item[] {
  const out: Item[] = [];
  PHRASES.forEach((p, i) => {
    const others = pickOthers(PHRASES, i, 2, (q) => q !== p && q.group === p.group);
    const opts: ChoiceOption[] = [
      { label: p.ja, correct: true },
      ...others.map((q) => ({ label: q.ja, misconception: GROUP_MIS[p.group] })),
    ];
    out.push(
      listen({
        id: `meaning:${slugOf(p.text)}`,
        objective: 'meaning',
        level: 0,
        prompt: '聞《き》こえた あいさつの いみは どれ？',
        audio: ph(p.text),
        options: opts,
        hints: [
          'さいごまで よく 聞《き》こう。「もういちど きく」で なんども 聞《き》けるよ。',
          p.group === 'time'
            ? 'あさ・ひる・よるで かわる あいさつだよ。'
            : p.group === 'meet'
              ? 'あう とき・わかれる ときの あいさつだよ。'
              : 'おれい・おわび・ようすを きく ことばの なかまだよ。',
          // ③で つかう ばめんを いうと 聞かずに いみが きまるので、誤りを1つ けす
          notHint(others[0]!.ja),
        ],
        explain: `「${p.ja}」と いう いみの あいさつです。${p.when}に つかいます。`,
        explainFigure: enText(p.text),
        identity: `meaning:${slugOf(p.text)}`,
      }),
    );
  });
  // 別例: 聞いて、つかう ばめんを えらぶ
  PHRASES.filter((p) => p.text !== 'Hello.' && p.text !== 'How are you?').forEach((p, i, arr) => {
    const others = pickOthers(arr, i, 2, (q) => q !== p && q.group !== p.group);
    others.push(
      ...pickOthers(arr, i, 1, (q) => q !== p && q.group === p.group && !others.includes(q)),
    );
    const opts: ChoiceOption[] = [
      { label: p.when, correct: true },
      // ほかの なかまの あいさつの ばめん: 「はじめだけ 聞いた」ではなく、いみと ばめんの むすびつけの 誤り
      ...others.slice(0, 2).map((q) => ({
        label: q.when,
        misconception: q.group === p.group ? GROUP_MIS[p.group] : 'when-mix',
      })),
    ];
    out.push(
      listen({
        id: `when:${slugOf(p.text)}`,
        objective: 'meaning',
        level: 1,
        prompt: '聞《き》こえた あいさつは、どんな ときに いう？',
        audio: ph(p.text),
        options: opts,
        hints: [
          'あいさつの いみを おもいだそう。',
          'いみが わかったら、その ことばを いう ばめんを そうぞう しよう。',
          notHint(others[0]!.when),
        ],
        explain: `「${p.ja}」の あいさつなので、${p.when}に いいます。`,
        explainFigure: enText(p.text),
        identity: `when:${slugOf(p.text)}`,
        alt: true,
      }),
    );
  });
  return out;
}

// ---- 到達項目2: ばめんに あう あいさつ（3つ聞いて えらぶ） ----
interface Scene {
  id: string;
  scene: string;
  right: string;
  wrong: [string, string];
}
const SCENES: Scene[] = [
  {
    id: 'morning-school',
    scene: 'あさ、がっこうで ともだちに あったよ。',
    right: 'Good morning.',
    wrong: ['Good night.', 'Goodbye.'],
  },
  {
    id: 'before-bed',
    scene: 'ねる まえに、いえの ひとに いうよ。',
    right: 'Good night.',
    wrong: ['Good morning.', 'Hello.'],
  },
  {
    id: 'go-home',
    scene: 'がっこうから かえる とき、ともだちに いうよ。',
    right: 'Goodbye.',
    wrong: ['Hello.', 'Thank you.'],
  },
  {
    id: 'first-meet',
    scene: 'はじめて あった ひとに いうよ。',
    right: 'Nice to meet you.',
    wrong: ['See you.', "I'm sorry."],
  },
  {
    id: 'present',
    scene: 'ともだちに プレゼントを もらったよ。',
    right: 'Thank you.',
    wrong: ["You're welcome.", 'Good night.'],
  },
  {
    id: 'thanked',
    scene: 'ともだちに「ありがとう」と いわれたよ。',
    right: "You're welcome.",
    wrong: ['Thank you.', 'Hello.'],
  },
  {
    id: 'step-foot',
    scene: 'うっかり ともだちの あしを ふんで しまったよ。',
    right: "I'm sorry.",
    wrong: ['Thank you.', 'Good morning.'],
  },
  {
    id: 'noon',
    scene: 'ひるすぎに、きんじょの ひとに あったよ。',
    right: 'Good afternoon.',
    wrong: ['Good evening.', 'Good night.'],
  },
  {
    id: 'evening',
    scene: 'よる、しんせきの いえに ついたよ。',
    right: 'Good evening.',
    wrong: ['Good morning.', 'Goodbye.'],
  },
  {
    id: 'ask-how',
    scene: 'ともだちの ようすを ききたいよ。',
    right: 'How are you?',
    wrong: ['Nice to meet you.', 'See you.'],
  },
];

const groupOf = (t: string): Group | null => PHRASES.find((p) => p.text === t)?.group ?? null;

function sceneItems(): Item[] {
  const out: Item[] = [];
  SCENES.forEach((s, i) => {
    const pos = i % 3;
    const seq = [...s.wrong];
    seq.splice(pos, 0, s.right);
    const rightGroup = groupOf(s.right)!;
    const ja = PHRASES.find((p) => p.text === s.right)!.ja;
    out.push(
      listen({
        id: `scene:${s.id}`,
        objective: 'scene',
        level: 1,
        prompt: `${s.scene}\nなんと いう？ 3つ 聞《き》いて えらぼう。`,
        audio: seq.map(ph),
        gapMs: 800,
        options: ordinalOptions(3, pos, (k) => {
          const g = groupOf(seq[k]!);
          return g === rightGroup ? GROUP_MIS[rightGroup] : 'whole-phrase';
        }),
        fixedOrder: true,
        hints: [
          'まず、どんな ばめんか かんがえよう。',
          '3つの あいさつの いみを ひとつずつ おもいだそう。',
          `この ばめんでは「${ja}」と いいたいね。`,
        ],
        explain: `${pos + 1}ばんめの あいさつは「${ja}」と いう いみ。この ばめんに あいます。`,
        explainFigure: enText(seq.join('  /  '), 'm'),
        identity: `scene:${s.id}`,
      }),
    );
  });
  // 別例: 話しかけられた ことばに あう へんじ
  const REPLIES: { q: string; right: string; wrong: [string, string]; ja: string }[] = [
    {
      q: 'How are you?',
      right: "I'm fine.",
      wrong: ['Good night.', "You're welcome."],
      ja: 'げんきだよ',
    },
    {
      q: 'Thank you.',
      right: "You're welcome.",
      wrong: ["I'm sorry.", 'Good morning.'],
      ja: 'どういたしまして',
    },
    {
      q: 'Nice to meet you.',
      right: 'Nice to meet you, too.',
      wrong: ['Goodbye.', "I'm hungry."],
      ja: 'こちらこそ はじめまして',
    },
    { q: 'Goodbye.', right: 'See you.', wrong: ['Good morning.', 'Thank you.'], ja: 'またね' },
    {
      q: "I'm sorry.",
      right: "That's OK.",
      wrong: ['Good night.', 'Nice to meet you.'],
      ja: 'いいよ',
    },
    {
      q: 'Good morning.',
      right: 'Good morning.',
      wrong: ['Good night.', "You're welcome."],
      ja: 'おはよう',
    },
  ];
  REPLIES.forEach((r, i) => {
    const pos = (i + 1) % 3;
    const seq = [...r.wrong];
    seq.splice(pos, 0, r.right);
    out.push(
      listen({
        id: `reply:${slugOf(r.q)}`,
        objective: 'scene',
        level: 2,
        prompt: 'さいしょに 話《はな》しかけられるよ。そのあとの 3つの うち、あう へんじは どれ？',
        audio: [ph(r.q), ...seq.map(ph)],
        gapMs: 900,
        options: ordinalOptions(3, pos, () => 'reply-mismatch'),
        fixedOrder: true,
        hints: [
          'さいしょの ことばの いみを かんがえよう。',
          'あとの 3つは へんじの こうほだよ。いみを ひとつずつ おもいだそう。',
          `「${r.ja}」と いう いみの へんじを さがそう。`,
        ],
        explain: `${pos + 1}ばんめは「${r.ja}」と いう いみ。さいしょの ことばへの へんじに なります。`,
        explainFigure: enText(`${r.q}  →  ${r.right}`, 'm'),
        identity: `reply:${slugOf(r.q)}`,
        alt: true,
      }),
    );
  });
  return out;
}

// ---- 到達項目3: きもち・ようす ----
function feelItems(): Item[] {
  const out: Item[] = [];
  FEELINGS.forEach((f, i) => {
    const same = pickOthers(FEELINGS, i, 1, (g) => g !== f && g.group === f.group);
    const diff = pickOthers(FEELINGS, i, 2 - same.length, (g) => g !== f && g.group !== f.group);
    const opts: ChoiceOption[] = [
      { ...faceOpt(f), correct: true },
      ...same.map((g) => ({ ...faceOpt(g), misconception: FEEL_MIS[f.group] })),
      ...diff.map((g) => ({ ...faceOpt(g), misconception: 'whole-phrase' })),
    ];
    out.push(
      listen({
        id: `feel:${slugOf(f.text)}`,
        objective: 'feel',
        level: 0,
        prompt: '聞《き》こえた ひとは、どんな きもち・ようす？',
        audio: en('feel', f.text),
        options: opts,
        hints: [
          'さいごの ことばを よく 聞《き》こう。',
          f.group === 'body'
            ? 'からだの ようすを あらわす ことばだよ。'
            : f.group === 'temp'
              ? 'あつさ・さむさを あらわす ことばだよ。'
              : 'こころの きもちを あらわす ことばだよ。',
          notHint([...diff, ...same][0]!.ja),
        ],
        explain: `「${f.ja}」と いう いみです。`,
        explainFigure: enText(f.text),
        identity: `feel:${slugOf(f.text)}`,
      }),
    );
  });
  // 別例: 「How are you?」への へんじを 聞いて、ばめんを えらぶ
  FEELINGS.forEach((f, i) => {
    if (f.text === "I'm fine.") return;
    const others = pickOthers(
      FEELINGS,
      i,
      2,
      (g) => g !== f && g.text !== "I'm fine." && !sceneClash(f, g),
    );
    out.push(
      listen({
        id: `feel-scene:${slugOf(f.text)}`,
        objective: 'feel',
        level: 2,
        prompt: 'ようすを きかれて こたえて いるよ。こたえた ひとに あう ばめんは どれ？',
        audio: [ph('How are you?'), en('feel', f.text)],
        gapMs: 700,
        options: [
          { label: f.scene, correct: true },
          ...others.map((g) => ({
            label: g.scene,
            misconception: g.group === f.group ? FEEL_MIS[f.group] : 'whole-phrase',
          })),
        ],
        hints: [
          'あとの ほうの こたえを よく 聞《き》こう。',
          'こたえの きもち・ようすを おもいだそう。',
          notHint(others[0]!.scene),
        ],
        explain: `「${f.ja}」と こたえて います。${f.scene}ときに ぴったりです。`,
        explainFigure: enText(`How are you?  →  ${f.text}`, 'm'),
        identity: `feel-scene:${slugOf(f.text)}`,
        alt: true,
      }),
    );
  });
  return out;
}

export const greetings: UnitSpec = {
  id: 'g3.en.greetings',
  title: 'あいさつと きもち',
  stage: 'g3',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: [],
  objectives: [
    { id: 'meaning', title: 'あいさつの いみが わかる' },
    { id: 'scene', title: 'ばめんに あう あいさつ・へんじが わかる' },
    { id: 'feel', title: 'きもち・ようすの ことばが わかる' },
  ],
  misconceptions: [
    {
      id: 'time-of-day',
      explain:
        'あさ・ひる・よるの あいさつを とりちがえたのかな。さいごの ことばで、いつの あいさつかが かわるよ。',
    },
    {
      id: 'meet-part',
      explain:
        'あう ときと わかれる ときの あいさつを とりちがえたのかな。もういちど 聞《き》いて みよう。',
    },
    {
      id: 'thanks-sorry',
      explain:
        'おれい・おわび・へんじの ことばを とりちがえたのかな。だれが だれに いう ことばか かんがえよう。',
    },
    {
      id: 'whole-phrase',
      explain:
        'はじめの ほうだけ 聞《き》いて えらんだのかな。さいごまで 聞《き》いてから えらぼう。',
    },
    {
      id: 'when-mix',
      explain:
        'ほかの あいさつを つかう ばめんを えらんだのかな。聞《き》こえた あいさつの いみを おもいだしてから、ばめんを かんがえよう。',
    },
    {
      id: 'reply-mismatch',
      explain:
        'その ことばも あいさつだけど、さいしょの ことばへの へんじには ならないね。いみを つなげて みよう。',
    },
    {
      id: 'feel-mood',
      explain:
        'こころの きもちを あらわす ことば どうしを とりちがえたのかな。さいごの ことばを よく 聞《き》こう。',
    },
    {
      id: 'feel-body',
      explain: 'からだの ようす（おなか・のど・ねむさ・つかれ）を とりちがえたのかな。',
    },
    {
      id: 'feel-opposite',
      explain: 'あつい と さむい を はんたいに したのかな。もういちど 聞《き》いて みよう。',
    },
  ],
  levels: [
    { label: 'あいさつ・きもちの いみ', chance: 0.05 },
    { label: 'ばめんに あう あいさつ', chance: 0.05 },
    { label: 'へんじ・ようすの やりとり', chance: 0.05 },
  ],
  intro: [
    {
      text: 'えいごの あいさつを 聞《き》いて、いみを えらぶよ。まず 音《おと》を よく 聞《き》こう。',
      figure: enText('Good morning.', 'xl'),
    },
    {
      text: 'あさに あった ときの あいさつは この ことば。「おはよう」と いう いみだよ。',
      figure: { kind: 'illust', id: 'p5-sun' },
    },
    {
      text: '聞《き》いたら、こえに だして まねして いって みよう（こたえあわせは しないよ）。',
    },
  ],
  source: { kind: 'items', items: [...meaningItems(), ...sceneItems(), ...feelItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと・話すこと（やり取り）。あいさつ・気持ちを表す表現',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
