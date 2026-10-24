/** 保護者画面（PA-01〜PA-12, DA-04〜08）。大人向けに px 基準・漢字かな交じり・白地 */
import type { ReactNode } from 'react';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { Illust } from '../illust/Illust';
import { AboutTab } from './AboutTab';
import { DataTab } from './DataTab';
import { MemosTab } from './MemosTab';
import { PacksTab } from './PacksTab';
import { ProfilesTab } from './ProfilesTab';
import { RecordsTab } from './RecordsTab';
import { SettingsTab } from './SettingsTab';
import { WorksTab } from './WorksTab';
import './parent.css';

const TABS = [
  { id: 'records', label: 'きろく' },
  { id: 'settings', label: 'せってい' },
  { id: 'works', label: 'さくひん' },
  { id: 'memos', label: 'メモ' },
  { id: 'profiles', label: 'プロフィール' },
  { id: 'data', label: 'データ' },
  { id: 'packs', label: 'きょうざい' },
  { id: 'about', label: 'このアプリについて' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function ParentApp({ tab }: { tab: string }) {
  const app = useApp();
  const current: TabId = TABS.find((t) => t.id === tab)?.id ?? 'records';
  const profile = app.profile;

  let body: ReactNode = <p>読み込み中…</p>;
  if (profile && app.settings) {
    // プロフィールを切り替えたら各タブを作り直す
    const key = profile.id;
    body = {
      records: <RecordsTab key={key} />,
      settings: <SettingsTab key={key} />,
      works: <WorksTab key={key} />,
      memos: <MemosTab key={key} />,
      profiles: <ProfilesTab key={key} />,
      data: <DataTab key={key} />,
      packs: <PacksTab key={key} />,
      about: <AboutTab key={key} />,
    }[current];
  }

  return (
    <div className="parent-root" data-testid="parent-app">
      <header className="p-header">
        <h1>保護者の画面</h1>
        <div className="p-header__right">
          {profile ? (
            <label className="p-profile-switch">
              <Illust id={profile.avatar} decorative className="p-avatar" />
              <span>見ているプロフィール</span>
              <select
                value={profile.id}
                onChange={(e) => void app.selectProfile(e.target.value)}
                data-testid="parent-profile-select"
              >
                {app.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="p-primary"
            data-testid="parent-to-child"
            onClick={() => {
              app.setParentUnlocked(false);
              navigate({ name: 'home' }, { force: true });
            }}
          >
            こどもの画面へ
          </button>
        </div>
      </header>
      <nav className="p-tabs" role="tablist" aria-label="保護者画面のタブ">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current}
            className={t.id === current ? 'is-current' : ''}
            data-testid={`parent-tab-${t.id}`}
            onClick={() => navigate({ name: 'parent', tab: t.id }, { force: true })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="p-main">{body}</main>
    </div>
  );
}
