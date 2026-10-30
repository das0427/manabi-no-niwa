import { describe, expect, it } from 'vitest';
import { PRESCHOOL_EN_CARDS, findPreschoolCard, showsEnglishCard } from './preschoolEnglish';
import { PRESCHOOL_HOMES } from './preschoolHome';
import { UNIT_INDEX, unitMeta } from './unitIndex';

describe('幼児ホームの「えいご」の札', () => {
  it('findPreschoolCard: ふつうの札も えいごの札も返す。無い札は undefined', () => {
    expect(findPreschoolCard('p4', 'shopping')?.id).toBe('shopping');
    expect(findPreschoolCard('p4', 'eigo')).toBe(PRESCHOOL_EN_CARDS.p4);
    expect(findPreschoolCard('p23', 'eigo')).toBe(PRESCHOOL_EN_CARDS.p23);
    expect(findPreschoolCard('p5', 'eigo')).toBe(PRESCHOOL_EN_CARDS.p5);
    expect(findPreschoolCard('p5', 'nothing')).toBeUndefined();
  });

  it('札の単元はすべて単元の索引にあり、子供画面に出せる（planned でない・隠れていない）', () => {
    for (const stage of ['p23', 'p4', 'p5'] as const) {
      const card = PRESCHOOL_EN_CARDS[stage];
      expect(card.title).toBe('えいご');
      expect(card.icon).toBe('enpre-icon');
      expect(card.units.length).toBeGreaterThan(0);
      for (const id of card.units) {
        const m = unitMeta(id);
        expect(m, id).toBeTruthy();
        expect(m!.pack, id).toBe('en-pre');
        expect(m!.status, id).not.toBe('planned');
        expect(m!.hiddenByDefault, id).toBeFalsy();
      }
    }
    // 選ぶ画面は札を最大6枚まで（24u×22u を3枚×2段）
    for (const stage of ['p4', 'p5'] as const)
      expect(PRESCHOOL_EN_CARDS[stage].units.length).toBeLessThanOrEqual(6);
  });

  it('p5 の札には p4 の move・hello・picture-book もつなぐ', () => {
    for (const id of ['p4.en.move', 'p4.en.hello', 'p4.en.picture-book'])
      expect(PRESCHOOL_EN_CARDS.p5.units).toContain(id);
  });

  it('札の id は、ほかの札と重ならない。「きょうの おすすめ」の候補（ふつうの札）に入らない', () => {
    for (const stage of ['p23', 'p4', 'p5'] as const) {
      const ids = PRESCHOOL_HOMES[stage]!.cards.map((c) => c.id);
      expect(ids).not.toContain('eigo');
      for (const c of PRESCHOOL_HOMES[stage]!.cards)
        for (const u of c.units) expect(unitMeta(u)?.pack, u).not.toBe('en-pre');
    }
  });

  it('2歳段階は出さない。保護者の設定が false なら出さない（省略時は出す）', () => {
    expect(showsEnglishCard({ stage2: true })).toBe(false);
    expect(showsEnglishCard({ stage2: true, showPreschoolEnglish: true })).toBe(false);
    expect(showsEnglishCard({ stage2: false })).toBe(true);
    expect(showsEnglishCard({ stage2: false, showPreschoolEnglish: true })).toBe(true);
    expect(showsEnglishCard({ stage2: false, showPreschoolEnglish: false })).toBe(false);
  });

  it('en-pre の単元は教科 en・幼児の段階で、parentNote が索引に写っている', () => {
    const pre = UNIT_INDEX.filter((u) => u.pack === 'en-pre');
    expect(pre.length).toBe(8);
    for (const u of pre) {
      expect(u.subject).toBe('en');
      expect(['p23', 'p4', 'p5']).toContain(u.stage);
      expect(u.engine).toBe('listen');
      expect(u.parentNote, u.id).toBeTruthy();
    }
  });
});
