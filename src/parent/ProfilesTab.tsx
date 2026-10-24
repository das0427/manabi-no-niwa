import { useState } from 'react';
import { useApp } from '../app/AppState';
import * as db from '../core/storage/index';
import type { Profile } from '../core/types';
import { Illust } from '../illust/Illust';
import { ConfirmDialog, Note, Section } from './ui';
import { AVATARS, AVATAR_LABEL } from './util';

const NAME_MAX = 20;

function AvatarPicker({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="p-avatars" role="radiogroup" aria-label="動物の絵">
      {AVATARS.map((a) => (
        <label key={a} className={a === value ? 'is-on' : ''}>
          <input
            type="radio"
            name={name}
            value={a}
            checked={a === value}
            onChange={() => onChange(a)}
            data-testid={`${name}-${a}`}
          />
          <Illust id={a} decorative className="p-avatar" />
          <span>{AVATAR_LABEL[a]}</span>
        </label>
      ))}
    </div>
  );
}

function ProfileRow({
  p,
  onlyOne,
  onClear,
  onDelete,
}: {
  p: Profile;
  onlyOne: boolean;
  onClear: () => void;
  onDelete: () => void;
}) {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const valid = name.trim().length > 0 && name.trim().length <= NAME_MAX;
  return (
    <li data-testid={`profile-${p.id}`}>
      <Illust id={p.avatar} decorative className="p-avatar" />
      {editing ? (
        <div className="p-profile__edit">
          <label className="p-field">
            名前
            <input
              type="text"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid={`profile-name-${p.id}`}
            />
          </label>
          <AvatarPicker value={avatar} onChange={setAvatar} name={`avatar-${p.id}`} />
          <div className="p-row">
            <button
              type="button"
              disabled={!valid}
              data-testid={`profile-save-${p.id}`}
              onClick={() => {
                void (async () => {
                  await db.updateProfile({ ...p, name: name.trim(), avatar });
                  setEditing(false);
                  await app.reload();
                })();
              }}
            >
              保存
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              やめる
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="p-profile__name">
            {p.name}
            {app.profile?.id === p.id ? <span className="p-badge">表示中</span> : null}
          </span>
          <span className="p-row">
            <button
              type="button"
              onClick={() => {
                setName(p.name);
                setAvatar(p.avatar);
                setEditing(true);
              }}
              data-testid={`profile-edit-${p.id}`}
            >
              名前・絵を変える
            </button>
            <button type="button" onClick={onClear} data-testid={`profile-clear-${p.id}`}>
              記録だけ削除
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={onlyOne}
              title={onlyOne ? '最後の1人は削除できません' : undefined}
              data-testid={`profile-delete-${p.id}`}
            >
              プロフィール削除
            </button>
          </span>
        </>
      )}
    </li>
  );
}

export function ProfilesTab() {
  const app = useApp();
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState<string>('rabbit');
  const [clear, setClear] = useState<Profile | null>(null);
  const [del, setDel] = useState<Profile | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const guard = async (fn: () => Promise<void>): Promise<void> => {
    setError('');
    try {
      await fn();
    } catch {
      setError(
        '保存できませんでした。容量不足などの可能性があります（「データ」タブをご確認ください）。',
      );
    }
  };

  return (
    <div data-testid="tab-profiles">
      <Section title="プロフィール">
        <Note>
          実名は入れず、架空の呼び名（「うさぎさん」など）で構いません。記録はプロフィールごとに分けて保存されます。
        </Note>
        <ul className="p-profiles">
          {app.profiles.map((p) => (
            <ProfileRow
              key={p.id}
              p={p}
              onlyOne={app.profiles.length <= 1}
              onClear={() => setClear(p)}
              onDelete={() => setDel(p)}
            />
          ))}
        </ul>
        {msg ? <p role="status">{msg}</p> : null}
        {error ? (
          <p role="alert" className="p-error">
            {error}
          </p>
        ) : null}
      </Section>

      <Section title="プロフィールを追加">
        <label className="p-field">
          呼び名（{NAME_MAX}文字まで）
          <input
            type="text"
            maxLength={NAME_MAX}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid="profile-name-new"
          />
        </label>
        <AvatarPicker value={newAvatar} onChange={setNewAvatar} name="avatar-new" />
        <button
          type="button"
          disabled={newName.trim().length === 0}
          data-testid="profile-add"
          onClick={() => {
            void guard(async () => {
              await db.createProfile(newName.trim(), newAvatar);
              setMsg(`「${newName.trim()}」を追加しました。`);
              setNewName('');
              await app.reload();
            });
          }}
        >
          追加する
        </button>
      </Section>

      {clear ? (
        <ConfirmDialog
          title="記録だけ削除します"
          target={`プロフィール「${clear.name}」`}
          message="学習の記録・作品・メモ・途中の保存・すきの印が消えます。名前と設定は残ります。元に戻せません。"
          confirmLabel="記録を削除する"
          onCancel={() => setClear(null)}
          onConfirm={() =>
            guard(async () => {
              await db.clearProfileRecords(clear.id);
              setMsg(`「${clear.name}」の記録を削除しました。`);
              setClear(null);
              await app.reload();
            })
          }
        />
      ) : null}

      {del ? (
        <ConfirmDialog
          title="プロフィールを削除します"
          target={`プロフィール「${del.name}」`}
          message="このプロフィールの設定・記録・作品・メモがすべて消えます。元に戻せません。"
          requireText={del.name}
          confirmLabel="プロフィールを削除する"
          onCancel={() => setDel(null)}
          onConfirm={() =>
            guard(async () => {
              await db.deleteProfile(del.id);
              setMsg(`「${del.name}」を削除しました。`);
              setDel(null);
              await app.reload();
            })
          }
        />
      ) : null}
    </div>
  );
}
