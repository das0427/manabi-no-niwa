import { useEffect } from 'react';
import { watchLockFree } from '../core/instance/instance';
import { Illust } from '../illust/Illust';
import './retired.css';

/** 保護者向けの小さな案内（子供には読めなくてよい。文字は保護者の書体） */
const PARENT_NOTE =
  '（保護者の方へ）まなびのにわは、ほかの窓で開いています。この窓は閉じてかまいません。';

/** この窓で開き直す。ほかの窓が引き下がり、この窓が引き継ぐ（記録は消えない） */
function reopenHere(): void {
  location.replace('./');
}

/**
 * 「べつの まどで ひらいています」の画面（二重起動の防止。docs/expansion/single-instance-design.md 2.3.5）。
 * 前の画面が自分を閉じられなかったとき（履歴が2件以上など）や、「戻る」で古い項目を読み込んだときに出る。
 * 音・記録・オフラインの準備には触れない。AppState・音・オフラインの部品を読み込まないこと。
 * 使っている窓が閉じられて鍵が空いたら、自分で始め直す（watch。いつまでも案内だけが残らないように）。
 */
export function RetiredScreen({
  onReopen = reopenHere,
  watch = watchLockFree,
}: {
  onReopen?: () => void;
  watch?: (onFree: () => void) => () => void;
}) {
  useEffect(() => watch(onReopen), [watch, onReopen]);
  return (
    <div className="stage">
      <div className="center-col" data-testid="instance-retired">
        <Illust id="home" decorative className="retired__illust" />
        <h1 className="title-text">べつの まどで ひらいています</h1>
        <p className="retired__note">{PARENT_NOTE}</p>
        <button
          type="button"
          className="retired__reopen"
          data-testid="instance-reopen"
          onClick={onReopen}
        >
          この まどで ひらく
        </button>
      </div>
    </div>
  );
}
