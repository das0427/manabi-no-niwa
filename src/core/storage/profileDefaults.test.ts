import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUDIENCE_IDS,
  audienceUx,
  type AudienceId,
  type ToddlerStage,
} from '../../audience/audience';
import { defaultSettings, settingsForNewProfile } from '../types';
import {
  createProfile,
  deleteAllData,
  getSettings,
  openStorage,
  saveSettings,
  updateProfile,
} from './index';

/**
 * FX10: 新しいプロフィールの利用時間の目安は、区分の既定（ux-by-age 1章）を入れる。
 * 既存のプロフィール（保存済みの設定）の値は変えない。
 */

beforeEach(async () => {
  await openStorage();
  await deleteAllData();
});

/** ux-by-age.md 1章「利用時間の目安（既定）」 */
const EXPECTED: [AudienceId, ToddlerStage | undefined, number][] = [
  ['toddler', 2, 5],
  ['toddler', 3, 8],
  ['p4', undefined, 10],
  ['p5', undefined, 10],
  ['g1', undefined, 15],
  ['g2', undefined, 15],
  ['g3', undefined, 20],
  ['g4', undefined, 20],
  ['g5', undefined, 20],
  ['g6', undefined, 20],
];

describe('新しいプロフィールの利用時間の目安', () => {
  it('9区分（2〜3さいは段階も）すべて、区分の既定が入る', async () => {
    for (const [audience, toddlerStage, minutes] of EXPECTED) {
      const p = await createProfile('はな', 'cat', {
        audience,
        ...(toddlerStage ? { toddlerStage } : {}),
      });
      const s = await getSettings(p.id);
      expect(s.sessionMinutes, `${audience}/${toddlerStage ?? '-'}`).toBe(minutes);
      // 区分の設計値（audienceUx）そのもの
      expect(s.sessionMinutes).toBe(audienceUx(audience, toddlerStage ?? 3).sessionMinutes);
    }
    // 9つの区分を全部確かめた
    expect(new Set(EXPECTED.map((e) => e[0]))).toEqual(new Set(AUDIENCE_IDS));
  });

  it('区分の指定が無いプロフィール（4歳として作る）は 10 分。ほかの項目は defaultSettings のまま', async () => {
    const p = await createProfile('こども', 'rabbit');
    const s = await getSettings(p.id);
    expect(s).toEqual(defaultSettings(p.id));
    expect(s.sessionMinutes).toBe(10);
  });

  it('settingsForNewProfile は sessionMinutes だけを defaultSettings から変える', () => {
    const base = { id: 'p1' };
    const s = settingsForNewProfile({ ...base, audience: 'g5' });
    expect(s).toEqual({ ...defaultSettings('p1', 'g5'), sessionMinutes: 20 });
    // 段階が無い 2〜3さい は 3さいの段階として数える
    expect(settingsForNewProfile({ ...base, audience: 'toddler' }).sessionMinutes).toBe(8);
  });
});

describe('既存のプロフィールの値は変えない', () => {
  it('保存済みの設定は、そのまま読める（10 分のまま。区分の既定に読み替えない）', async () => {
    const p = await createProfile('はな', 'cat', { audience: 'g3', enrolledGrade: 3 });
    // 2.0 までに作られたプロフィール: 区分にかかわらず 10 分
    await saveSettings({ ...(await getSettings(p.id)), sessionMinutes: 10 });
    expect((await getSettings(p.id)).sessionMinutes).toBe(10);
  });

  it('区分の変更だけでは設定を触らない（updateProfile）', async () => {
    const p = await createProfile('はな', 'cat', { audience: 'p4' });
    await saveSettings({ ...(await getSettings(p.id)), sessionMinutes: 7 });
    await updateProfile({ ...p, audience: 'g6', enrolledGrade: 6 });
    expect((await getSettings(p.id)).sessionMinutes).toBe(7);
  });

  it('設定が壊れている（目安が不正）ときの補いは、これまでどおり 10 分', async () => {
    const p = await createProfile('はな', 'cat', { audience: 'g3', enrolledGrade: 3 });
    await saveSettings({ ...(await getSettings(p.id)), sessionMinutes: -3 });
    expect((await getSettings(p.id)).sessionMinutes).toBe(10);
  });
});
