import { useState } from 'react';
import { audio } from '../core/audio/index';
import { useOfflineState } from '../core/offline/index';
import { getStorageProblem, type StorageProblem } from '../core/storage/index';
import { Illust } from '../illust/Illust';
import { Tap } from '../ui/Tap';
import { useApp } from './AppState';
import { navigate } from './router';

/**
 * 起動画面。「はじめる」のタップで音声を有効にする（ブラウザの自動再生制約: VO-05）。
 * 2人以上のプロフィールがあれば、だれが遊ぶかを選ぶ。
 */
export function StartScreen() {
  const app = useApp();
  const [choosing, setChoosing] = useState(false);

  const begin = async () => {
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
      <div className="center-col" data-testid="profile-picker">
        <p className="title-text">だれが あそぶ？</p>
        <div className="row" style={{ flexWrap: 'wrap', maxWidth: 'calc(var(--u) * 90)' }}>
          {app.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="choice"
              aria-label={p.name}
              style={{ width: 'calc(var(--u) * 18)', gap: 'calc(var(--u) * 0.6)' }}
              onClick={() => {
                void app.selectProfile(p.id).then(() => {
                  navigate({ name: 'home' }, { force: true, say: 'app.welcome' });
                });
              }}
            >
              <Illust id={p.avatar} className="choice__illust" decorative />
              <span className="label-text">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="center-col" data-testid="start-screen">
      <Illust
        id="mode-road"
        style={{ width: 'calc(var(--u) * 18)', height: 'calc(var(--u) * 18)' }}
        decorative
      />
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
      <ParentNotes />
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

/** 起動画面の隅の、保護者向けの小さな表示（オフラインの準備状況 OF-02 と、保存の問題 DA-07） */
function ParentNotes() {
  const app = useApp();
  const off = useOfflineState();
  const problem = app.storageUnavailable ? (getStorageProblem() ?? 'error') : null;
  let offline: string | null = null;
  if (off.status === 'installing' && off.progress) {
    offline = `オフラインの準備中 ${Math.round((off.progress.done / Math.max(1, off.progress.total)) * 100)}%`;
  } else if (off.status === 'ready') {
    offline = 'オフラインで つかえます';
  } else if (off.status === 'error') {
    offline = 'オフラインの準備に失敗しました（保護者画面を見てください）';
  }
  return (
    <div className="start-notes" data-testid="start-notes">
      {problem ? (
        <p data-testid="storage-problem">（保護者の方へ）{PROBLEM_TEXT[problem]}</p>
      ) : null}
      {offline ? <p data-testid="offline-status">{offline}</p> : null}
    </div>
  );
}
