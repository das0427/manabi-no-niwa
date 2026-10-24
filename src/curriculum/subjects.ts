/**
 * 小学生の教科（ホームの教科の札・単元の地図。ux-by-age 2.2、progress.md 単元対応表への判断8）。
 * 名前: 1・2年はひらがな、3年以上は漢字＋ふりがな（RichText）。色だけで区別しない（絵と名前を併記）。
 */
import type { Grade } from '../audience/audience';
import type { RichText, SubjectId } from './types';

export interface SubjectDef {
  id: SubjectId;
  /** 1・2年向けの名前（ひらがな） */
  nameLower: string;
  /** 3年以上の名前（漢字＋よみ） */
  nameUpper: RichText;
  icon: string;
  /** 教科の色の CSS 変数 */
  color: string;
  /** 教科がある学年 */
  grades: readonly Grade[];
  /** 領域の並び（単元の地図の列）と名前 */
  domains: { id: string; name: string }[];
}

export const SUBJECTS: readonly SubjectDef[] = [
  {
    id: 'ja',
    nameLower: 'こくご',
    nameUpper: '国語《こくご》',
    icon: 'subj-kokugo',
    color: 'var(--subj-kokugo)',
    grades: [1, 2, 3, 4, 5, 6],
    domains: [
      { id: 'kotoba', name: 'ことば・もじ' },
      { id: 'kanji', name: 'かんじ' },
      { id: 'yomu', name: 'よむ' },
      { id: 'kaku', name: 'かく' },
    ],
  },
  {
    id: 'math',
    nameLower: 'さんすう',
    nameUpper: '算数《さんすう》',
    icon: 'subj-sansu',
    color: 'var(--subj-sansu)',
    grades: [1, 2, 3, 4, 5, 6],
    domains: [
      { id: 'A-number', name: 'かず・けいさん' },
      { id: 'B-shape', name: 'ずけい' },
      { id: 'C-measure', name: 'はかる・かわりかた' },
      { id: 'D-data', name: 'データ' },
    ],
  },
  {
    id: 'life',
    nameLower: 'せいかつ',
    nameUpper: '生活《せいかつ》',
    icon: 'subj-seikatsu',
    color: 'var(--subj-seikatsu)',
    grades: [1, 2],
    domains: [{ id: 'life', name: 'せいかつ' }],
  },
  {
    id: 'sci',
    nameLower: 'りか',
    nameUpper: '理科《りか》',
    icon: 'subj-rika',
    color: 'var(--subj-rika)',
    grades: [3, 4, 5, 6],
    domains: [
      { id: 'A-matter', name: 'ぶっしつ・エネルギー' },
      { id: 'B-life', name: 'いのち・ちきゅう' },
    ],
  },
  {
    id: 'soc',
    nameLower: 'しゃかい',
    nameUpper: '社会《しゃかい》',
    icon: 'subj-shakai',
    color: 'var(--subj-shakai)',
    grades: [3, 4, 5, 6],
    domains: [{ id: 'soc', name: 'しゃかい' }],
  },
  {
    id: 'en',
    nameLower: 'えいご',
    nameUpper: '英語《えいご》',
    icon: 'subj-eigo',
    color: 'var(--subj-eigo)',
    grades: [3, 4, 5, 6],
    domains: [{ id: 'en', name: 'えいご' }],
  },
  {
    id: 'prog',
    nameLower: 'プログラミング',
    nameUpper: 'プログラミング',
    icon: 'subj-program',
    color: 'var(--subj-program)',
    grades: [1, 2, 3, 4, 5, 6],
    domains: [{ id: 'prog', name: 'てじゅん' }],
  },
];

export function subjectDef(id: string): SubjectDef | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function subjectsForGrade(g: Grade): SubjectDef[] {
  return SUBJECTS.filter((s) => s.grades.includes(g));
}

export function subjectName(s: SubjectDef, g: number): RichText {
  return g >= 3 ? s.nameUpper : s.nameLower;
}
