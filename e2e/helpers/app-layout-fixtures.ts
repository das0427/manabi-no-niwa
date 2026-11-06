/**
 * アプリの全画面の配置の検査（e2e/app-layout.al.ts）のプロフィールと中身の作り方。
 *
 * - プロフィール 13 通り（AC-3）: 2〜3さい（2さいの段階・3さいの段階）、4さい、4さい（えいごの札なし）、5さい、小1〜小6、
 *   小3（文字 1.3 倍・ふりがな すべて）、小4（左ききのおえかき）。
 * - 中身の状態は二つ。fresh（作ったばかり）と full（遊んだ記録・作品・メモ・単元の進度が多い状態）。
 * - 子供の設定と中身は IndexedDB（テスト専用の直接書き込み。e2e/helpers/app.ts と同じ）に書いてから読み込み直す。
 *   作品は、1 枚を描く画面で描き、残りを開発サーバーの duplicateArtwork で増やす（画像の形を作り直さない）。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { AudienceId, Grade, ToddlerStage } from '../../src/audience/audience';
import { defaultSettings, MODE_IDS } from '../../src/core/types';
import type { ChildSettings } from '../../src/core/types';
import { DB_NAME, idbGetAll } from './app';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

// ---------------------------------------------------------------- 単元の索引（unit-index.json）

export interface UnitRow {
  id: string;
  pack: string;
  title: string;
  stage: string;
  subject: string;
  domain: string;
  icon: string;
  prereq: string[];
  status: string;
  engine: string;
  hiddenByDefault?: boolean;
  legacy?: { modeId: string; variants?: string[]; levelRange?: [number, number] };
}

export const UNITS: UnitRow[] = JSON.parse(
  readFileSync(path.join(ROOT, 'src/curriculum/unit-index.json'), 'utf8'),
) as UnitRow[];

/** 題の字数（ふりがな《よみ》・分数の記法を除く） */
export function titleLength(title: string): number {
  return title.replace(/《[^》]*》/g, '').length;
}

/** 子供画面に出す単元（planned・保護者が開いていない hiddenByDefault は除く） */
export function visibleUnits(stage: string, opened: readonly string[] = []): UnitRow[] {
  return UNITS.filter(
    (u) =>
      u.stage === stage && u.status !== 'planned' && (!u.hiddenByDefault || opened.includes(u.id)),
  );
}

// ---------------------------------------------------------------- プロフィール

export type StageKey = 'p23' | 'p4' | 'p5' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6';

export interface ProfileSpec {
  /** MNW_APP_PROFILES で絞るときの名前 */
  key: string;
  audience: AudienceId;
  toddlerStage?: ToddlerStage;
  /** 在籍学年（就学前は null） */
  grade: Grade | null;
  /** 中身の段階（分かち書きと最小の字を決める） */
  stage: StageKey;
  /** 子供の設定の上書き */
  settings?: (s: ChildSettings) => ChildSettings;
  /** 画面の ID をこれに合うものだけに絞る（左ききのおえかきは、おえかきだけ） */
  only?: RegExp;
  /** 説明 */
  note: string;
}

const school = (g: Grade): ProfileSpec => ({
  key: `g${g}`,
  audience: `g${g}` as AudienceId,
  grade: g,
  stage: `g${g}` as StageKey,
  note: `小学${g}年`,
});

export const PROFILES: ProfileSpec[] = [
  {
    key: 'p23-2',
    audience: 'toddler',
    toddlerStage: 2,
    grade: null,
    stage: 'p23',
    note: '2〜3さい（2さいの段階。札4枚）',
  },
  {
    key: 'p23-3',
    audience: 'toddler',
    toddlerStage: 3,
    grade: null,
    stage: 'p23',
    note: '2〜3さい（3さいの段階）',
  },
  { key: 'p4', audience: 'p4', grade: null, stage: 'p4', note: '4さい' },
  {
    key: 'p4-noen',
    audience: 'p4',
    grade: null,
    stage: 'p4',
    settings: (s) => ({ ...s, showPreschoolEnglish: false }),
    note: '4さい（えいごの札を隠す）',
  },
  {
    key: 'p5',
    audience: 'p5',
    grade: null,
    stage: 'p5',
    settings: (s) => ({ ...s, unitsOpened: ['p5.en.abc'] }),
    note: '5さい（えいごの選ぶ画面が6枚）',
  },
  school(1),
  school(2),
  school(3),
  school(4),
  school(5),
  school(6),
  {
    ...school(3),
    key: 'g3-big',
    settings: (s) => ({ ...s, support: { ...s.support, textScale: 1.3, furigana: 'all' } }),
    note: '小学3年（文字 1.3 倍・ふりがな すべて）',
  },
  {
    ...school(4),
    key: 'g4-left',
    settings: (s) => ({ ...s, drawingHand: 'left' }),
    only: /^draw/,
    note: '小学4年（左ききのおえかき。道具欄が右）',
  },
];

/** ワイルドカード（*）つきの絞り込み（カンマ区切り）。空なら全部 */
export function globFilter(env: string | undefined): (id: string) => boolean {
  const res = (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`));
  return (id) => res.length === 0 || res.some((re) => re.test(id));
}

// ---------------------------------------------------------------- IndexedDB（テスト専用）

/** キーが外にあるストア（app）にも書ける put。e2e/helpers/app.ts の idbPutMany は keyPath のあるストア用 */
export function idbPutKeyed(
  page: Page,
  store: string,
  items: { value: unknown; key?: string }[],
): Promise<void> {
  // 値は JSON の文字列で渡す（unknown のままだと page.evaluate の型が深くなりすぎる）
  return page.evaluate(
    ([name, s, json]) =>
      new Promise<void>((resolve, reject) => {
        const list = JSON.parse(json) as { value: unknown; key?: string }[];
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(s, 'readwrite');
          const os = tx.objectStore(s);
          for (const it of list) {
            if (it.key === undefined) os.put(it.value);
            else os.put(it.value, it.key);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    [DB_NAME, store, JSON.stringify(items)] as [string, string, string],
  );
}

// ---------------------------------------------------------------- 中身

const DAY = 24 * 60 * 60 * 1000;

/**
 * 名前（AC-3: 20 字＝NAME_MAX の名前、空白のある名前、英字の名前、ふつうの名前）。
 * 遊ぶのは最初の名前（ホームの左上に出る）。起動画面の「だれが あそぶ？」に 4 人とも出る
 */
export const FULL_NAMES = [
  'さくら はるか みなみ ゆうき たろう',
  'もりかわ はるか',
  'Alexander',
  'こども',
];

const AVATARS = ['rabbit', 'dog', 'cat', 'bear'] as const;

/** 保護者が開いた単元（設定の unitsOpened） */
function openedOf(spec: ProfileSpec, pid: string): string[] {
  return (spec.settings ?? ((s) => s))(defaultSettings(pid, spec.audience)).unitsOpened;
}

/** 中身の多い状態の記録（AC-3） */
export function fullRecords(spec: ProfileSpec, pid: string, now: number) {
  // 14 日分。月日の字がいちばん長くなる 12月31日から数える（ノートの日付の列の最悪の幅）
  const y = new Date(now).getFullYear() - 1;
  const base = new Date(y, 11, 31, 10, 0, 0).getTime();
  const units = visibleUnits(spec.stage, openedOf(spec, pid)).filter((u) => u.engine !== 'legacy');
  const rounds: object[] = [];
  const days = 14;
  for (let d = 0; d < days; d++) {
    const t = base - d * DAY;
    for (let k = 0; k < 3; k++) {
      const modeId = MODE_IDS[(d + k * 3) % MODE_IDS.length]!;
      rounds.push({
        profileId: pid,
        modeId,
        variantId: 'default',
        startedAt: t + k * 600_000,
        endedAt: t + k * 600_000 + 300_000,
        count: 4,
        completed: true,
      });
    }
    for (let k = 0; k < 4; k++) {
      const u = units[(d * 4 + k) % Math.max(1, units.length)];
      if (!u) continue;
      rounds.push({
        profileId: pid,
        modeId: 'unit',
        unitId: u.id,
        variantId: u.id,
        startedAt: t + 3_600_000 + k * 600_000,
        endedAt: t + 3_600_000 + k * 600_000 + 300_000,
        count: 4,
        completed: true,
      });
    }
  }

  const skills: [string, string][] = [
    ['shopping', 'shop'],
    ['hiragana', 'kana'],
    ['sorting', 'sort'],
    ['shapes', 'shape'],
    ['memory', 'memory'],
    ['compare', 'compare'],
    ['road', 'road'],
    ['trace', 'trace'],
    ['math', 'add'],
  ];
  const outcomes = ['independent', 'self_corrected', 'after_hint', 'after_review', 'skipped'];
  const attempts: object[] = [];
  for (let i = 0; i < 27; i++) {
    const [modeId, skillId] = skills[i % skills.length]!;
    attempts.push({
      profileId: pid,
      modeId,
      variantId: 'default',
      skillId,
      level: i % 3,
      itemKey: `${['りんご', 'トマト', 'さくら', 'ねこ'][i % 4]}×${(i % 5) + 1}`,
      outcome: outcomes[i % outcomes.length],
      wrongTries: i % 3,
      hintsUsed: i % 2,
      reviewsUsed: 0,
      operationIssue: i % 7 === 0,
      inputKind: 'mouse',
      at: now - i * 3_600_000,
    });
  }
  for (const [i, u] of units.slice(0, 9).entries()) {
    attempts.push({
      profileId: pid,
      modeId: 'unit',
      unitId: u.id,
      variantId: u.id,
      skillId: null,
      level: 0,
      itemKey: `${u.id} #${i + 1}`,
      outcome: outcomes[i % outcomes.length],
      wrongTries: i % 2,
      hintsUsed: i % 3,
      reviewsUsed: 0,
      operationIssue: false,
      inputKind: 'mouse',
      at: now - (30 + i) * 3_600_000,
    });
  }
  const progress = (['shop', 'kana', 'sort', 'add'] as const).map((skillId, i) => ({
    profileId: pid,
    skillId,
    level: i % 3,
    window: ['independent', 'independent', 'after_hint', 'independent', 'self_corrected'],
    mastered: false,
    attempted: true,
    changedAt: now - i * DAY,
    lastChange: null,
  }));

  const favorites = { profileId: pid, modeIds: ['shopping', 'hiragana', 'trace'] };

  const memoTexts = [
    'きょうは ひらがなを がんばった。',
    '「り」と「ぬ」を まちがえやすい。',
    'おかいものの もんだいが すき。',
    'ながい メモ。' + 'あさ おきてから ずっと すうじを かぞえていた。'.repeat(8),
    'ぶんしょう\nの\n行を 分けた メモ',
    'Hello! A memo written in English.',
    '5さいの おともだちと あそんだ。',
    '集中が切れやすいので、10分で区切る。',
    'じかんを のばして みる。',
    'ほめたら よろこんだ。',
  ];
  const memos = memoTexts.map((text, i) => ({
    id: `memo-${i}`,
    profileId: pid,
    date: new Date(base - i * DAY).toISOString().slice(0, 10),
    text,
    createdAt: base - i * DAY,
  }));

  const works = [0, 1, 2, 3, 4].map((i) =>
    i < 3
      ? {
          id: `work-t${i}`,
          profileId: pid,
          modeId: 'trace',
          kind: 'trace',
          title: ['し', 'やま', 'なみ'][i],
          createdAt: base - i * DAY + 1000,
          data: {
            guideId: ['t2-yama', 't2-nami', 't2-kaabu'][i],
            strokes: [
              [
                [200, 800],
                [500, 200],
                [800, 800],
              ],
            ],
          },
        }
      : {
          id: `work-r${i}`,
          profileId: pid,
          modeId: 'road',
          kind: 'road',
          title: 'じゆうな みち',
          createdAt: base - i * DAY + 1000,
          data: {},
        },
  );

  return {
    rounds,
    attempts,
    progress,
    favorites,
    memos,
    works,
    unitProgress: unitProgressOf(spec, pid, now),
  };
}

/**
 * 単元の進度（AC-3）: その段階でいちばん長い題の単元を「ふくしゅう まち」2 つ（教科は別々。おすすめの復習は1教科1件）、
 * 次に長い 6 つを「とりくみちゅう」、2 つを「できた」「しっかり」にする。単元の地図・おすすめの札の最悪の長さを出す。
 */
export function unitProgressOf(spec: ProfileSpec, pid: string, now: number): object[] {
  const list = visibleUnits(spec.stage, openedOf(spec, pid))
    .filter((u) => u.engine !== 'legacy')
    .sort((a, b) => titleLength(b.title) - titleLength(a.title) || a.id.localeCompare(b.id));
  const pick: UnitRow[] = [];
  const due: UnitRow[] = [];
  for (const u of list) {
    if (due.length < 2 && !due.some((d) => d.subject === u.subject)) due.push(u);
  }
  const rest = list.filter((u) => !due.includes(u));
  pick.push(...rest.slice(0, 8));
  const row = (u: UnitRow, review: object, extra: object = {}) => ({
    profileId: pid,
    unitId: u.id,
    level: 1,
    window: ['independent', 'independent', 'after_hint'],
    mastered: false,
    attempted: true,
    changedAt: now - DAY,
    lastChange: null,
    review,
    ...extra,
  });
  const out: object[] = [];
  for (const u of due)
    out.push(
      row(
        u,
        { stage: 'learned', reviewDue: now - 2 * DAY, reviewStep: 1, lastReviewAt: now - 5 * DAY },
        { mastered: true },
      ),
    );
  pick.slice(0, 6).forEach((u, i) =>
    out.push(
      row(
        u,
        { stage: 'learning', reviewDue: null, reviewStep: 0, lastReviewAt: null },
        {
          changedAt: now - (i + 2) * 3_600_000,
        },
      ),
    ),
  );
  if (pick[6])
    out.push(
      row(
        pick[6],
        { stage: 'learned', reviewDue: now + 3 * DAY, reviewStep: 1, lastReviewAt: now - DAY },
        { mastered: true },
      ),
    );
  if (pick[7])
    out.push(
      row(
        pick[7],
        { stage: 'secured', reviewDue: now + 21 * DAY, reviewStep: 3, lastReviewAt: now - DAY },
        { mastered: true },
      ),
    );
  return out;
}

// ---------------------------------------------------------------- 書き込み

export interface SeedOptions {
  /** full のとき、v1 のモードを使う単元ごとの、使える遊び方の id（下書きを入れる単元の遊び方を決める） */
  legacyVariants?: Record<string, string[]>;
}

/**
 * 起動画面まで読み込んだ状態（プロフィールが 1 人）から、プロフィールの区分・設定・（full なら）中身を書き込んで
 * 読み込み直す。呼び出し後は「はじめる」を押す前の状態（?dev-open のときは、そのまま画面が開く）。
 * 作品の画像は含まない（seedArtworks）。
 */
export async function seedProfile(
  page: Page,
  spec: ProfileSpec,
  state: 'fresh' | 'full',
  opt: SeedOptions = {},
): Promise<string> {
  const profiles = await idbGetAll<Record<string, unknown> & { id: string }>(page, 'profiles');
  const first = profiles[0]!;
  const pid = first.id;
  const now = Date.now();
  const names = state === 'full' ? FULL_NAMES : ['こども'];
  const main = {
    ...first,
    name: names[0],
    avatar: 'rabbit',
    audience: spec.audience,
    ...(spec.toddlerStage ? { toddlerStage: spec.toddlerStage } : {}),
    enrolledGrade: spec.grade,
    createdAt: now - 10 * DAY,
  };
  const settings = (spec.settings ?? ((s) => s))(defaultSettings(pid, spec.audience));
  await idbPutKeyed(page, 'profiles', [{ value: main }]);
  await idbPutKeyed(page, 'settings', [{ value: settings }]);
  // 起動画面で「だれが あそぶ？」を出す 4 人（full）。遊ぶのは最初の 1 人
  if (state === 'full') {
    const extras = names.slice(1).map((name, i) => {
      const id = `extra-${i + 1}`;
      return {
        profile: {
          id,
          name,
          avatar: AVATARS[(i + 1) % AVATARS.length],
          createdAt: now - (9 - i) * DAY,
          audience: spec.audience,
          ...(spec.toddlerStage ? { toddlerStage: spec.toddlerStage } : {}),
          enrolledGrade: spec.grade,
        },
        settings: { ...settings, profileId: id },
      };
    });
    await idbPutKeyed(
      page,
      'profiles',
      extras.map((e) => ({ value: e.profile })),
    );
    await idbPutKeyed(
      page,
      'settings',
      extras.map((e) => ({ value: e.settings })),
    );
    const rec = fullRecords(spec, pid, now);
    await idbPutKeyed(
      page,
      'rounds',
      rec.rounds.map((value) => ({ value })),
    );
    await idbPutKeyed(
      page,
      'attempts',
      rec.attempts.map((value) => ({ value })),
    );
    await idbPutKeyed(
      page,
      'progress',
      rec.progress.map((value) => ({ value })),
    );
    await idbPutKeyed(page, 'favorites', [{ value: rec.favorites }]);
    await idbPutKeyed(
      page,
      'memos',
      rec.memos.map((value) => ({ value })),
    );
    await idbPutKeyed(
      page,
      'works',
      rec.works.map((value) => ({ value })),
    );
    await idbPutKeyed(
      page,
      'unitProgress',
      rec.unitProgress.map((value) => ({ value })),
    );
    // 「つづきから？」の下書き（v1 のモードを使う単元。遊び方は最初の 1 つ）
    const drafts = UNITS.filter((u) => u.stage === spec.stage && u.legacy).flatMap((u) => {
      const v = opt.legacyVariants?.[u.id]?.[0];
      return v
        ? [
            {
              profileId: pid,
              modeId: u.legacy!.modeId,
              variantId: v,
              savedAt: now,
              state: { seed: 1, data: null, level: 0, roundSize: 4 },
            },
          ]
        : [];
    });
    if (drafts.length)
      await idbPutKeyed(
        page,
        'drafts',
        drafts.map((value) => ({ value })),
      );
  }
  await idbPutKeyed(page, 'app', [
    { key: 'app', value: { activeProfileId: pid, parentPinHash: null } },
  ]);
  return pid;
}

/**
 * 作品を増やす（AC-2）: おえかきの画面で線を 1 本描いて保存し、残りを duplicateArtwork で増やす。
 * 開発サーバーのモジュールをページの中で読み込む（アプリと同じ保存の道を通す）。
 */
export async function seedArtworks(page: Page, total: number): Promise<number> {
  await page.evaluate(() => {
    location.hash = '#/draw/new';
  });
  const canvas = page.getByTestId('draw-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await page
    .locator('[data-testid="draw-screen"][data-save-state="saved"]')
    .waitFor({ timeout: 20_000 });
  const arts = await idbGetAll<{ id: string }>(page, 'artworks');
  const id = arts[0]?.id;
  if (!id) throw new Error('作品が保存されなかった');
  await page.evaluate(
    async ([artId, n]) => {
      const path = '/src/drawing/persist.ts';
      const m = await import(path);
      for (let i = 1; i < (n as number); i++) await m.duplicateArtwork(artId as string);
    },
    [id, total] as const,
  );
  return (await idbGetAll(page, 'artworks')).length;
}
