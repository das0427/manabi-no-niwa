import { describe, expect, it } from 'vitest';
import { AUDIENCE_IDS } from '../audience/audience';
import { defaultPackIds, setupPackIds } from './defaultPacks';
import type { UnitMeta } from './types';

const u = (
  pack: string,
  stage: UnitMeta['stage'],
  status: UnitMeta['status'] = 'ready',
): UnitMeta => ({ id: `${pack}.${stage}.${status}`, pack, stage, status }) as UnitMeta;

describe('defaultPackIds（区分の既定パック）', () => {
  const index = [
    u('g3-math', 'g3'),
    u('kanji-g34', 'g3'),
    u('kanji-g34', 'g4'),
    u('g3-ja', 'g3', 'planned'),
    u('p4', 'p4'),
  ];

  it('その段階の単元を持つパック。予定だけのパックは含めない', () => {
    expect(defaultPackIds('g3', index)).toEqual(['g3-math', 'kanji-g34']);
    expect(defaultPackIds('g4', index)).toEqual(['kanji-g34']);
  });

  it('幼児はコアに同梱なので既定パックは無い', () => {
    expect(defaultPackIds('p4', index)).toEqual([]);
    expect(defaultPackIds('toddler', index)).toEqual([]);
  });

  it('全プロフィールの分を合わせる（重ならない・名前順）。区分の無い古いプロフィールは p4 扱い', () => {
    expect(setupPackIds([{ audience: 'g4' }, { audience: 'g3' }, {}], index)).toEqual([
      'g3-math',
      'kanji-g34',
    ]);
    expect(setupPackIds([], index)).toEqual([]);
  });

  it('本物の索引: 小学生の各区分に既定パックがあり、幼児のパック（p23/p4/p5）は入らない', () => {
    for (const a of AUDIENCE_IDS) {
      const ids = defaultPackIds(a);
      if (a === 'toddler' || a === 'p4' || a === 'p5') {
        expect(ids).toEqual([]);
        continue;
      }
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain(`${a}-math`);
      expect(ids.some((id) => ['p23', 'p4', 'p5'].includes(id))).toBe(false);
    }
  });
});
