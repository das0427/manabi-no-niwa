import { useMemo, useState } from 'react';
import { audio } from '../core/audio/index';
import { setupView, usePackSetup, type SetupState } from '../core/offline/setup';
import { getStorageProblem, type StorageProblem } from '../core/storage/index';
import { setupPackIds } from '../curriculum/defaultPacks';
import { Illust } from '../illust/Illust';
import { AppLabel } from '../ui/AppLabel';
import { requestStartFullscreen } from '../ui/fullscreen';
import { Tap } from '../ui/Tap';
import { useApp } from './AppState';
import { PackSetupStatus, setupParentNote } from './PackSetupStatus';
import { navigate } from './router';
import './start.css';

/** プロフィール名の ctx: 保護者が入力した文字なので、ふりがなは付けない */
const NAME_CTX = { furigana: 'none', learnerGrade: 0 } as const;

/**
 * 起動画面。「はじめる」のタップで音声を有効にする（ブラウザの自動再生制約: VO-05）。
 * 2人以上のプロフィールがあれば、だれが遊ぶかを選ぶ。
 * 初回準備の2段階（R#20）: 本体の準備のあと、登録しているプロフィールの区分の既定パックを自動で取得し、
 * その様子を見せる（PackSetupStatus）。待たせない: 取得中・失敗中でも「はじめる」は押せる。
 * 画面は縦の 2 段の格子（上: 真ん中の列、下: 保護者向けの表示）。保護者向けの表示は真ん中の列に重ならない。
 */
export function StartScreen() {
  const app = useApp();
  const [choosing, setChoosing] = useState(false);
  const packIds = useMemo(() => setupPackIds(app.profiles), [app.profiles]);
  const realSetup = usePackSetup(packIds);
  const dev = useMemo(devStartOverride, []);
  const setup: SetupState = dev?.setup ?? realSetup;
  const view = setupView(setup);

  const begin = async () => {
    // 引き継ぎで始まった画面だけ、ここで全画面にする。タップの操作の中（最初の await より前）で呼ぶ
    requestStartFullscreen();
    await audio.unlock();
    app.setStarted(true);
    if (app.profiles.length > 1) {
      setChoosing(true);
      void audio.play('app.who');
      return;
    }
    navigate({ name: 'home' }, { force: true, say: 'app.welcome' });
  };

  if (choosing) {
    return (
      <div className="screen start-picker" data-testid="profile-picker" data-stage="p4">
        <p className="title-text">だれが あそぶ？</p>
        <div className="start-picker__row">
          {app.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="choice start-profile"
              aria-label={p.name}
              onClick={() => {
                void app.selectProfile(p.id).then(() => {
                  navigate({ name: 'home' }, { force: true, say: 'app.welcome' });
                });
              }}
            >
              <Illust id={p.avatar} className="choice__illust" decorative />
              <AppLabel
                text={p.name}
                stage="p4"
                ctx={NAME_CTX}
                className="start-profile__name"
                fit={{ fromU: 2.6 }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen start-screen"
      data-testid="start-screen"
      data-setup={view.kind === 'hidden' ? undefined : ''}
    >
      <div className="start-main">
        <Illust id="mode-road" className="start-main__illust" decorative />
        <h1 className="title-text">まなびの にわ</h1>
        <Tap
          label="はじめる"
          text="はじめる"
          variant="main"
          size="big"
          disabled={!app.ready}
          onPress={() => void begin()}
          testId="start-button"
          style={{ minWidth: 'calc(var(--u) * 30)' }}
        />
        <PackSetupStatus view={view} onRetry={realSetup.retry} />
      </div>
      <ParentNotes setup={dev?.notes ?? setup} devProblem={dev?.problem} />
    </div>
  );
}

const PROBLEM_TEXT: Record<Exclude<StorageProblem, null>, string> = {
  version:
    '新しい版のアプリで保存した記録があります。アプリを更新してください。いまは記録を残さずに遊べます。',
  blocked: 'ほかの画面がアプリを開いています。ほかのタブを閉じて再読み込みしてください。',
  unsupported: 'このブラウザでは記録を保存できません（プライベート窓など）。記録は残りません。',
  error: '記録を保存できませんでした。いまは記録を残さずに遊べます。',
};

/** 起動画面の下の、保護者向けの小さな表示（オフラインの準備状況 OF-02 と、保存の問題 DA-07） */
function ParentNotes({
  setup,
  devProblem,
}: {
  setup: SetupState;
  devProblem?: Exclude<StorageProblem, null>;
}) {
  const app = useApp();
  const problem = devProblem ?? (app.storageUnavailable ? (getStorageProblem() ?? 'error') : null);
  const offline = setupParentNote(setup);
  return (
    <div className="start-notes" data-testid="start-notes">
      {problem ? (
        <p data-testid="storage-problem">（保護者の方へ）{PROBLEM_TEXT[problem]}</p>
      ) : null}
      {offline ? <p data-testid="offline-status">{offline}</p> : null}
    </div>
  );
}

/* ---- 開発用の指定（本番ビルドでは import.meta.env.DEV が false になり、ここから下は消える） ---- */

interface DevStartOverride {
  /** 「きょうざいの じゅんび」の表示に使う状態（?dev-setup） */
  setup?: SetupState;
  /** 保護者向けの表示に使う状態（?dev-notes=2 のとき、失敗 quota） */
  notes?: SetupState;
  /** 保存の問題（?dev-notes=2 のとき version） */
  problem?: Exclude<StorageProblem, null>;
}

const DEV_BASE: SetupState = {
  stage: 'packs',
  progress: { done: 4, total: 10 },
  missing: ['dev.pack'],
  outdated: [],
  failures: [],
  downloading: true,
  checking: false,
  unsupported: false,
};

/**
 * 開発用: `?dev-setup=preparing|renewing|failed|offline` で PackSetupStatus の表示を、
 * `?dev-notes=2` で保護者向けの表示を最も長い 2 行（保存の問題 version と、準備の失敗 quota）にする。
 * 開発サーバーではオフラインの準備が整わず「きょうざいの じゅんび」が出ないので、配置の検査（check:app-layout の
 * start-setup-*）と目視にこれで出す（text-layout-fixes A5）。
 */
function devStartOverride(): DevStartOverride | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search);
  const kind = q.get('dev-setup');
  const failed = (reason: 'quota' | 'offline'): SetupState => ({
    ...DEV_BASE,
    progress: null,
    downloading: false,
    failures: [{ packId: 'dev.pack', reason }],
  });
  const out: DevStartOverride = {};
  if (kind === 'preparing') out.setup = DEV_BASE;
  else if (kind === 'renewing') out.setup = { ...DEV_BASE, outdated: ['dev.pack'] };
  else if (kind === 'failed') out.setup = failed('quota');
  else if (kind === 'offline') out.setup = failed('offline');
  if (q.get('dev-notes') === '2') {
    out.notes = failed('quota');
    out.problem = 'version';
  } else if (out.setup) {
    out.notes = out.setup;
  }
  return out.setup || out.notes ? out : null;
}
