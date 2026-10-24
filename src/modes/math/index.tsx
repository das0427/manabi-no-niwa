/**
 * さんすう（M9）。具体物（絵）→ 式 の順に進む。遊び方（session.skillId）で出題が変わる:
 * add（A・B1〜B3）/ sub（C1〜C3）/ split（D1・D2）/ formula_add（E1）/ formula_sub（E2）。
 * 仕様: docs/learning-design.md 9章。問題は {op, a, b, item} だけを持ち、表示・音声・答えはそこから導く（logic.ts）。
 */
import { useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { Illust } from '../../illust/Illust';
import { ChoiceQuestion } from './ChoiceQuestion';
import { SplitQuestion } from './SplitQuestion';
import { generateRound, isMathSkill, stageOf } from './logic';
import { praiseOf, type ChoiceDraft, type Draft, type QResult, type SplitDraft } from './types';
import './math.css';

export default function MathMode({ session }: ModePlayProps) {
  const skill = isMathSkill(session.skillId) ? session.skillId : 'add';
  const stage = stageOf(skill, session.level);
  const questions = useMemo(
    () => generateRound(skill, session.level, session.seed, session.roundSize),
    [skill, session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const [index, setIndex] = useState(resume?.index ?? 0);
  const results = useRef<QResult[]>(resume?.results ?? []);
  const question = questions[index] ?? questions[questions.length - 1]!;

  const saveDraft = (sub: ChoiceDraft | SplitDraft | null, at = index) =>
    session.saveDraft({ index: at, results: results.current, sub } satisfies Draft);

  /** 答えが決まった: 結果を残し、次の問題からやり直せるよう下書きを保存（最後の問題は完了画面まで保存しない） */
  const onSettled = (r: QResult) => {
    results.current = [...results.current, r];
    if (index + 1 < questions.length) saveDraft(null, index + 1);
  };
  const onAdvance = () => {
    if (index + 1 >= questions.length) {
      session.finish({
        showcase: <Showcase results={results.current} />,
        praise: praiseOf(results.current),
      });
      return;
    }
    setIndex(index + 1);
  };
  const onNext = (r: QResult) => {
    onSettled(r);
    onAdvance();
  };

  const initial = resume && resume.index === index ? resume.sub : null;
  const first = index === 0 && !resume;

  return stage === 'D1' ? (
    <SplitQuestion
      key={index}
      session={session}
      question={question}
      index={index}
      first={first}
      initial={initial as SplitDraft | null}
      saveDraft={saveDraft}
      onNext={onNext}
    />
  ) : (
    <ChoiceQuestion
      key={index}
      session={session}
      stage={stage}
      question={question}
      index={index}
      first={first}
      initial={initial as ChoiceDraft | null}
      saveDraft={saveDraft}
      onSettled={onSettled}
      onAdvance={onAdvance}
    />
  );
}

/** 完了画面: 取り組んだ式を大きく並べる */
function Showcase({ results }: { results: readonly QResult[] }) {
  const rows = results.flatMap((r) => r.texts.map((text) => ({ text, item: r.item })));
  return (
    <div className="math-showcase" data-testid="math-showcase">
      {rows.slice(0, 6).map((row, i) => (
        <div key={i} className="math-showcase__row">
          <Illust id={row.item} className="math-showcase__pic" decorative />
          <span className="math-showcase__formula">{row.text}</span>
        </div>
      ))}
    </div>
  );
}
