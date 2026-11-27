import {
  setupView,
  type SetupFailureReason,
  type SetupState,
  type SetupView,
} from '../core/offline/setup';
import { Tap } from '../ui/Tap';

const FAILURE_NOTE: Partial<Record<SetupFailureReason, string>> = {
  quota: '保存できる容量が足りません。',
  'not-found': '配信元のアプリのバージョンが違う可能性があります。',
  mismatch: '配信元のアプリのバージョンが違う可能性があります。',
  unavailable: '教材の一覧を読めません。',
  unsupported: 'このブラウザ・この開き方では教材を保存できません。',
};

/**
 * オフラインの準備はできたが、ページがまだ Service Worker に制御されていない（初めて開いた画面。開き直す前）ときの文。
 * この画面のままではオフラインで開けないので、「使えます」と言い切らない。
 * 起動画面の保護者向けの表示（setupParentNote）と、保護者画面の「このアプリについて」（AboutTab）が同じ文を使う（FX13）。
 */
export const OFFLINE_REOPEN_NOTE = 'オフラインの準備ができました。いちど開き直すと使えます。';

/**
 * 起動画面の隅の、保護者向けの準備状況（OF-02。漢字かな交じり）。準備の2段階がそろうまで「オフラインで使えます」を出さない。
 * controlled: このページが Service Worker に制御されているか（isPageControlled()。開き直したあとは true）。
 * 準備ができても制御されていない間は、「いちど開き直すと使えます」と案内する（保護者画面と食い違わせない）。
 * 表示しないときは null。
 */
export function setupParentNote(s: SetupState, controlled = true): string | null {
  switch (s.stage) {
    case 'core':
      return s.progress
        ? `オフラインの準備中 ${Math.round((s.progress.done / Math.max(1, s.progress.total)) * 100)}%`
        : null;
    case 'error':
      return 'オフラインの準備に失敗しました。保護者画面を見てください。';
    case 'ready':
      if (s.unsupported) return null;
      return controlled ? 'オフラインで使えます' : OFFLINE_REOPEN_NOTE;
    case 'packs': {
      const view = setupView(s);
      if (view.kind === 'hidden') return null;
      if (view.kind === 'failed') {
        if (view.offline) {
          return '（保護者の方へ）ネットワークにつながっていないため、教材パックを準備できません。つながると自動で続けます。';
        }
        const reason = s.failures.map((f) => FAILURE_NOTE[f.reason]).find(Boolean) ?? '';
        return `（保護者の方へ）教材パックの準備に失敗しました。${reason}保護者画面の「きょうざい」で取得し直せます。`;
      }
      return view.renewing
        ? `アプリの更新に合わせて教材パックを取得し直しています ${view.percent}%`
        : `教材パックの準備中 ${view.percent}%（${s.missing.length}件）`;
    }
  }
}

/**
 * 起動画面の「きょうざいの じゅんび」（初回準備の2段目。DESINGN.md 24章「起動画面の教材の準備」）。
 * 子供には割合（数字と棒）と「さきに あそんで いいよ」を見せ、待たせない。失敗したら おうちの ひとへの案内と
 * 「もういちど」の札。理由のくわしい説明は保護者向けの小さな表示（StartScreen の ParentNotes）に出す。
 * 声は付けない（「はじめる」を押すまで音を出せないため。案内の文は補助）。
 */
export function PackSetupStatus({ view, onRetry }: { view: SetupView; onRetry: () => void }) {
  if (view.kind === 'hidden') return null;
  if (view.kind === 'failed') {
    return (
      <div className="start-setup start-setup--row" data-testid="pack-setup" data-state="failed">
        <div role="status">
          <p className="start-setup__text" data-testid="pack-setup-text">
            {view.offline
              ? 'つながったら じゅんび するね'
              : 'きょうざいの じゅんびが できなかったよ'}
          </p>
          <p className="start-setup__sub">
            {view.offline ? 'いまは さきに あそぼう' : 'おうちの ひとに みてもらってね'}
          </p>
        </div>
        <Tap
          label="もういちど じゅんび する"
          text="もういちど"
          icon="again"
          size="aux"
          onPress={onRetry}
          testId="pack-setup-retry"
        />
      </div>
    );
  }
  return (
    <div className="start-setup" data-testid="pack-setup" data-state="preparing" role="status">
      <p className="start-setup__text" data-testid="pack-setup-text">
        {view.renewing ? 'あたらしい きょうざいを じゅんびちゅう' : 'きょうざいを じゅんびちゅう'}{' '}
        <span data-testid="pack-setup-percent">{view.percent}%</span>
      </p>
      <div className="start-setup--row">
        <div
          className="start-setup__bar"
          role="progressbar"
          aria-label="きょうざいの じゅんび"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.percent}
        >
          <div className="start-setup__fill" style={{ width: `${view.percent}%` }} />
        </div>
        <p className="start-setup__sub">さきに あそんで いいよ</p>
      </div>
    </div>
  );
}
