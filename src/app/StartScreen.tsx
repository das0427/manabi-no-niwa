import { useState } from 'react';
import { audio } from '../core/audio/index';
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
    void audio.play('app.welcome');
    navigate({ name: 'home' }, { force: true });
  };

  if (app.storageUnavailable) {
    return (
      <div className="center-col" style={{ fontFamily: 'var(--font-parent)', fontWeight: 400 }}>
        <p className="label-text">
          （保護者の方へ）記録を保存できません。新しい版のアプリで保存したデータがあるか、
          ブラウザの保存が無効になっています。アプリを更新するか、ページを再読み込みしてください。
        </p>
      </div>
    );
  }

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
                  void audio.play('app.welcome');
                  navigate({ name: 'home' }, { force: true });
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
    </div>
  );
}
