/**
 * プロフィールの区分・2〜3歳の段階・在籍学年・年齢の目安（architecture.md 2章、X-TG-02）。
 * これらは別々の項目で、区分を変えても記録・作品・習熟度は変わらない（X-TG-04）。
 * 年齢は保護者画面だけに「目安」として表示する（統括の判断4）。生年月日は保存しない。
 */
import { AUDIENCE_IDS, audienceUx, type AudienceId, type Grade } from '../audience/audience';
import type { Profile } from '../core/types';

export type AudienceValue = Pick<
  Profile,
  'audience' | 'toddlerStage' | 'enrolledGrade' | 'ageGuide'
>;

const AUDIENCE_LABEL: Record<AudienceId, string> = {
  toddler: '2〜3歳（親子で使う）',
  p4: '4歳',
  p5: '5歳',
  g1: '小学1年',
  g2: '小学2年',
  g3: '小学3年',
  g4: '小学4年',
  g5: '小学5年',
  g6: '小学6年',
};

export function audienceLabel(v: AudienceValue): string {
  const a = v.audience ?? 'p4';
  if (a === 'toddler') return audienceUx('toddler', v.toddlerStage ?? 3).parentLabel;
  return AUDIENCE_LABEL[a];
}

/** 区分を変えたときの在籍学年の初期値（就学前は null） */
function gradeFor(a: AudienceId): Grade | null {
  return a.startsWith('g') ? (Number(a.slice(1)) as Grade) : null;
}

export function AudienceFields({
  value,
  onChange,
  idPrefix,
}: {
  value: AudienceValue;
  onChange: (v: AudienceValue) => void;
  idPrefix: string;
}) {
  const a = value.audience ?? 'p4';
  return (
    <div className="p-audience" data-testid={`${idPrefix}-audience-fields`}>
      <label className="p-field">
        区分（ホームと、はじめに出す教材）
        <select
          value={a}
          onChange={(e) => {
            const next = e.target.value as AudienceId;
            onChange({
              ...value,
              audience: next,
              toddlerStage: next === 'toddler' ? (value.toddlerStage ?? 3) : undefined,
              enrolledGrade: gradeFor(next),
            });
          }}
          data-testid={`${idPrefix}-audience`}
        >
          {AUDIENCE_IDS.map((id) => (
            <option key={id} value={id}>
              {AUDIENCE_LABEL[id]}
            </option>
          ))}
        </select>
      </label>
      {a === 'toddler' ? (
        <fieldset className="p-field">
          <legend>2〜3歳の段階</legend>
          {([2, 3] as const).map((st) => (
            <label key={st} className="p-inline">
              <input
                type="radio"
                name={`${idPrefix}-stage`}
                checked={(value.toddlerStage ?? 3) === st}
                onChange={() => onChange({ ...value, toddlerStage: st })}
                data-testid={`${idPrefix}-stage-${st}`}
              />
              {st}歳の段階
            </label>
          ))}
          <span className="p-muted">
            2歳の段階は、選択肢が2つ・正誤を強く出さない・自動で難しさを変えない・利用時間の目安5分です。
          </span>
        </fieldset>
      ) : null}
      <label className="p-field">
        在籍学年（ふりがなの基準）
        <select
          value={value.enrolledGrade ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              enrolledGrade: e.target.value === '' ? null : (Number(e.target.value) as Grade),
            })
          }
          data-testid={`${idPrefix}-grade`}
        >
          <option value="">就学前</option>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>
              {g}年
            </option>
          ))}
        </select>
      </label>
      <label className="p-field">
        年齢の目安（任意。子供の画面には出ません）
        <select
          value={value.ageGuide ?? ''}
          onChange={(e) => onChange({ ...value, ageGuide: e.target.value || undefined })}
          data-testid={`${idPrefix}-age`}
        >
          <option value="">設定しない</option>
          {Array.from({ length: 11 }, (_, i) => i + 2).map((y) => (
            <option key={y} value={`y${y}`}>
              {y}歳くらい
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
