import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app/AppState';
import * as db from '../core/storage/index';
import type { BackupFile, ImportPreview } from '../core/storage/index';
import type { StorageHealth } from '../core/types';
import { ConfirmDialog, Note, Section } from './ui';
import {
  APP_VERSION,
  backupFileName,
  downloadText,
  formatBytes,
  formatIso,
  readFileText,
  useLoad,
} from './util';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const WARN_BYTES = 40 * 1024 * 1024;

type Loaded =
  | { ok: true; file: BackupFile; summary: ImportPreview; fileName: string }
  | { ok: false; reason: string; fileName: string };

function useHealth(): StorageHealth {
  const [h, setH] = useState<StorageHealth>(() => db.getStorageHealth());
  useEffect(() => db.onStorageHealth(setH), []);
  return h;
}

export function DataTab() {
  const app = useApp();
  const [msg, setMsg] = useState('');
  const [warn, setWarn] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [persistMsg, setPersistMsg] = useState('');
  const health = useHealth();
  const loadStorage = useCallback(() => db.estimateStorage(), []);
  const { data: storage, reload: reloadStorage } = useLoad(loadStorage);

  const doExport = async (scope: 'all' | 'profile'): Promise<void> => {
    setWarn('');
    try {
      const file = await db.exportBackup(
        scope === 'all' || !app.profile
          ? { kind: 'all' }
          : { kind: 'profile', profileId: app.profile.id },
        APP_VERSION,
      );
      const name = backupFileName();
      const size = downloadText(JSON.stringify(file), name);
      setMsg(`${name} を書き出しました（${formatBytes(size)}）。`);
      if (size > WARN_BYTES) {
        setWarn(
          `ファイルが ${formatBytes(size)} あり、読み込みの上限（50MB）に近づいています。プロフィールごとに書き出す、または不要な作品を削除してください。`,
        );
      }
    } catch {
      setMsg('書き出せませんでした。もう一度お試しください。');
    }
  };

  const onFile = async (f: File | undefined): Promise<void> => {
    setMsg('');
    if (!f) return;
    if (f.size > MAX_IMPORT_BYTES) {
      setLoaded({
        ok: false,
        fileName: f.name,
        reason: 'ファイルが大きすぎます（50MBまで）。プロフィールごとの書き出しをお試しください。',
      });
      return;
    }
    try {
      const text = await readFileText(f);
      const r = db.parseBackup(text, f.size);
      setLoaded(
        r.ok
          ? { ok: true, file: r.file, summary: r.summary, fileName: f.name }
          : { ok: false, reason: r.reason, fileName: f.name },
      );
    } catch {
      setLoaded({ ok: false, reason: 'ファイルを読み取れませんでした。', fileName: f.name });
    }
  };

  const doImport = async (mode: 'add' | 'replace'): Promise<void> => {
    if (!loaded || !loaded.ok) return;
    try {
      if (mode === 'replace') {
        // 直前に現在のデータを自動で書き出す（DA-06）
        const cur = await db.exportBackup({ kind: 'all' }, APP_VERSION);
        downloadText(JSON.stringify(cur), `before-replace-${backupFileName()}`);
      }
      const r = await db.importBackup(loaded.file, mode);
      await app.reload();
      setMsg(
        mode === 'add'
          ? `プロフィール ${r.addedProfiles.map((n) => `「${n}」`).join('')} を追加しました。`
          : 'すべて置き換えました。',
      );
      setLoaded(null);
    } catch {
      setMsg(
        '読み込めませんでした。何も変更していない可能性が高いですが、記録を確認してください。',
      );
    }
  };

  const quotaText =
    storage?.usage !== undefined
      ? `${formatBytes(storage.usage)}${storage.quota ? ` / ${formatBytes(storage.quota)}` : ''}`
      : 'わかりません';

  return (
    <div data-testid="tab-data">
      <Note>
        ブラウザのデータを消すと記録も消えます。定期的に書き出して、別の場所に保管してください。
      </Note>

      {health === 'full' || health === 'error' || health === 'unavailable' ? (
        <div className="p-alert" role="alert" data-testid="health-alert">
          {health === 'full'
            ? '保存できる容量がいっぱいです。'
            : health === 'error'
              ? '保存でエラーが起きました。'
              : '保存が使えません。'}
          {health === 'unavailable'
            ? 'ブラウザのプライベート窓や、データ保存を禁止する設定ではないかご確認ください。'
            : 'まず下の「書き出し」でデータを保管し、「さくひん」タブで不要な作品を削除してください。子供の遊びは続けられますが、記録が残らない場合があります。'}
        </div>
      ) : null}

      <Section title="書き出し">
        <div className="p-row">
          <button type="button" onClick={() => void doExport('all')} data-testid="export-all">
            ぜんぶ書き出す
          </button>
          <button
            type="button"
            onClick={() => void doExport('profile')}
            disabled={!app.profile}
            data-testid="export-profile"
          >
            「{app.profile?.name}」だけ書き出す
          </button>
        </div>
        {msg ? (
          <p role="status" data-testid="data-message">
            {msg}
          </p>
        ) : null}
        {warn ? (
          <p role="alert" className="p-error" data-testid="export-warning">
            {warn}
          </p>
        ) : null}
        <Note>
          ファイル名は manabi-backup-年月日-時分.json
          です。ファイルには記録・作品・メモが含まれます。他人に渡さないようご注意ください。
        </Note>
      </Section>

      <Section title="読み込み">
        <label className="p-field">
          書き出したファイル（.json）を選ぶ
          <input
            type="file"
            accept=".json,application/json"
            data-testid="import-file"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {loaded && !loaded.ok ? (
          <p role="alert" className="p-error" data-testid="import-error">
            {loaded.fileName}: {loaded.reason}
            <br />
            何も変更していません。
          </p>
        ) : null}
        {loaded?.ok ? (
          <div data-testid="import-preview">
            <p>
              {loaded.fileName}&emsp;書き出した日時: {formatIso(loaded.summary.exportedAt)}
            </p>
            <table className="p-table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>記録数</th>
                  <th>作品数</th>
                </tr>
              </thead>
              <tbody>
                {loaded.summary.profiles.map((p, i) => (
                  <tr key={`${p.name}-${i}`}>
                    <td>{p.name}</td>
                    <td>{p.attempts}</td>
                    <td>{p.works}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-row">
              <button type="button" onClick={() => void doImport('add')} data-testid="import-add">
                プロフィールとして追加する（おすすめ）
              </button>
              <button
                type="button"
                className="p-danger"
                onClick={() => setConfirmReplace(true)}
                data-testid="import-replace"
              >
                すべて置き換える
              </button>
            </div>
            <Note>
              「追加」は今のデータを変えず、新しいプロフィールとして加えます。「置き換え」は今のデータをすべて消して入れ替えます（直前に今のデータを自動で書き出します）。置き換える前の記録は、この端末に1つ前の分だけ保存されます。ダウンロードもされます。
            </Note>
          </div>
        ) : null}
      </Section>

      <Section title="保存の状態">
        <table className="p-table p-table--compact">
          <tbody>
            <tr>
              <th>使用量の目安</th>
              <td data-testid="storage-usage">{quotaText}</td>
            </tr>
            <tr>
              <th>保存の継続</th>
              <td data-testid="storage-persisted">
                {storage?.persisted === undefined
                  ? 'わかりません'
                  : storage.persisted
                    ? '継続が認められています'
                    : 'まだ認められていません（ブラウザが自動で消すことがあります）'}
              </td>
            </tr>
            <tr>
              <th>保存の状態</th>
              <td data-testid="storage-health">
                {
                  { ok: '正常', full: '容量不足', error: 'エラー', unavailable: '使えません' }[
                    health
                  ]
                }
              </td>
            </tr>
          </tbody>
        </table>
        <button
          type="button"
          data-testid="persist-request"
          onClick={() => {
            void (async () => {
              const ok = await db.requestPersist();
              setPersistMsg(
                ok
                  ? 'ブラウザが保存の継続を認めました。'
                  : 'ブラウザが認めませんでした（ブラウザの判断です）。定期的な書き出しをおすすめします。',
              );
              reloadStorage();
            })();
          }}
        >
          データを守る（ブラウザに保存の継続を求める）
        </button>
        {persistMsg ? (
          <p role="status" data-testid="persist-message">
            {persistMsg}
          </p>
        ) : null}
      </Section>

      {confirmReplace && loaded?.ok ? (
        <ConfirmDialog
          title="すべて置き換えます"
          target={`現在のデータすべて → ${loaded.fileName} の内容（${loaded.summary.profiles.map((p) => p.name).join('、')}）`}
          message="今のプロフィール・記録・作品・メモは消えます。実行の直前に、今のデータを自動で書き出します（ファイルが保存されたことをご確認ください）。"
          requireText="おきかえ"
          confirmLabel="置き換える"
          onCancel={() => setConfirmReplace(false)}
          onConfirm={async () => {
            await doImport('replace');
            setConfirmReplace(false);
          }}
        />
      ) : null}
    </div>
  );
}
