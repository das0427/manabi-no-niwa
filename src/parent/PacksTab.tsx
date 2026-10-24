/**
 * 「きょうざい」タブ（X-OF-01〜03、R#4）。小学生の教材パックの取得・削除・一括再取得と進み具合。
 * 削除は教材（キャッシュ）だけで、学習の記録は消さない。取得は画面を離れても続く。
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPackError, getPackProgress, getPacksSeq, subscribePacks } from '../core/offline/packs';
import type { PackDownloadFailure } from '../core/offline/packs';
import {
  deletePack,
  downloadPack,
  listPackStatus,
  redownloadOutdated,
  type PackStatus,
} from '../packs/loader';
import { ConfirmDialog, Note, Section } from './ui';
import { formatBytes, formatDateTime } from './util';

const SUBJECT_LABEL: Record<string, string> = {
  math: '算数',
  sansu: '算数',
  kokugo: '国語',
  rika: '理科',
  science: '理科',
  shakai: '社会',
  social: '社会',
  seikatsu: '生活',
  life: '生活',
  english: '英語',
  eigo: '英語',
  prog: 'プログラミング',
  programming: 'プログラミング',
};

/** packId から保護者向けの名前を作る（g3-math → 小3 算数、kanji-g12 → 漢字（小1・小2）） */
export function packLabel(packId: string): string {
  const sample = /^_sample-(.+)$/.exec(packId);
  if (sample) return `見本 ${sample[1]!.toUpperCase()}（テスト用）`;
  const grade = /^g([1-6])-(.+)$/.exec(packId);
  if (grade) return `小${grade[1]} ${SUBJECT_LABEL[grade[2]!] ?? grade[2]}`;
  const kanji = /^kanji-g(\d+)$/.exec(packId);
  if (kanji) return `漢字（${[...kanji[1]!].map((g) => `小${g}`).join('・')}）`;
  const toddler = { p23: '2〜3歳', p4: '4歳', p5: '5歳' }[packId];
  if (toddler) return toddler;
  return packId;
}

const FAILURE_TEXT: Record<PackDownloadFailure, string> = {
  offline: 'ネットワークにつながっていません。つないでからもう一度お試しください。',
  'not-found':
    '配信元に教材が見つかりません。配信元のアプリの版が違う可能性があります。アプリを更新してからお試しください。',
  mismatch:
    '取得した教材の内容がアプリの版と合いません。配信元が更新された可能性があります。アプリを更新してからお試しください。',
  quota: '保存できる容量が足りません。不要な作品や教材を削除してください。',
  'unknown-pack': 'この教材は、いまのアプリの版にはありません。',
  unsupported: 'このブラウザ・この開き方では、教材を保存できません。',
  error: '取得に失敗しました。もう一度お試しください。',
};

function usePacksSeq(): number {
  return useSyncExternalStore(subscribePacks, getPacksSeq, getPacksSeq);
}

function stateText(s: PackStatus): string {
  switch (s.state) {
    case 'core':
      return 'アプリ本体に含まれています';
    case 'ready':
      return s.downloaded?.downloadedAt
        ? `取得済み（${formatDateTime(s.downloaded.downloadedAt)}）`
        : '取得済み';
    case 'outdated':
      return '版が古い（取得し直しが必要）';
    case 'not-downloaded':
      return '未取得';
    case 'unavailable':
      return 'わかりません';
  }
}

export function PacksTab() {
  const seq = usePacksSeq();
  const [statuses, setStatuses] = useState<PackStatus[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PackStatus | null>(null);
  const [msg, setMsg] = useState('');

  // 状態の読み直し（取得の進み具合のたびに読まないよう、少し待ってまとめる）
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        void listPackStatus().then((s) => {
          if (alive) setStatuses(s);
        });
      },
      statuses === null ? 0 : 200,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // statuses は初回の判定だけに使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  const startDownload = (s: PackStatus): void => {
    setMsg('');
    downloadPack(s.packId).then(
      () => setMsg(`「${packLabel(s.packId)}」を取得しました。`),
      () => undefined, // 失敗は行に表示する
    );
  };

  const startRedownloadAll = (): void => {
    setMsg('');
    void redownloadOutdated().then((failed) => {
      setMsg(
        failed.length === 0
          ? '教材を取得し直しました。'
          : `${failed.length}件の教材を取得できませんでした（各行の説明をご覧ください）。古い教材はそのまま残っています。`,
      );
    });
  };

  if (statuses === null) {
    return (
      <div data-testid="tab-packs">
        <p>読み込み中…</p>
      </div>
    );
  }

  const separate = statuses.filter((s) => s.state !== 'core');
  const core = statuses.filter((s) => s.state === 'core');
  const outdated = separate.filter((s) => s.state === 'outdated');
  const unavailable = separate.length > 0 && separate.every((s) => s.state === 'unavailable');
  const anyRunning = separate.some((s) => getPackProgress(s.packId) !== null);
  const downloadedBytes = separate
    .filter((s) => s.state === 'ready' || s.state === 'outdated')
    .reduce((sum, s) => sum + (s.downloaded?.bytes || s.bytes), 0);

  return (
    <div data-testid="tab-packs">
      <Note>
        小学生の教材は、学年・教科ごとに取得します（取得した教材はオフラインで使えます）。幼児の教材はアプリ本体に含まれ、取得は要りません。教材を削除しても、学習の記録は消えません。
      </Note>

      {outdated.length > 0 ? (
        <div className="p-alert" role="alert" data-testid="packs-outdated">
          アプリが更新されたため、{outdated.length}
          件の教材の取得し直しが必要です。取得し直すまで、その教材の単元は開けません（子供の画面には「あたらしい
          きょうざいを とってきてね」と表示されます）。
          <div className="p-row">
            <button
              type="button"
              className="p-primary"
              disabled={anyRunning}
              onClick={startRedownloadAll}
              data-testid="packs-redownload-all"
            >
              まとめて取得し直す
            </button>
          </div>
        </div>
      ) : null}

      {unavailable ? (
        <p className="p-error" role="alert" data-testid="packs-unavailable">
          教材の一覧を読めません。オフラインの準備が終わっていないか、開発中の表示です。ネットワークにつないで開き直してください。
        </p>
      ) : null}

      <Section title="小学生の教材">
        {separate.length === 0 ? (
          <p data-testid="packs-empty">取得できる教材はまだありません。</p>
        ) : (
          <table className="p-table" data-testid="packs-table">
            <thead>
              <tr>
                <th>教材</th>
                <th>大きさ</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {separate.map((s) => (
                <PackRow
                  key={s.packId}
                  status={s}
                  onDownload={() => startDownload(s)}
                  onDelete={() => setConfirmDelete(s)}
                />
              ))}
            </tbody>
          </table>
        )}
        {msg ? (
          <p role="status" data-testid="packs-message">
            {msg}
          </p>
        ) : null}
        <p className="p-small" data-testid="packs-total">
          取得済みの教材の合計: {downloadedBytes > 0 ? formatBytes(downloadedBytes) : 'なし'}
        </p>
        <Note>
          取得は画面を離れても続きます。取得に失敗しても、それまでの教材は消えません。アプリの更新のあとは「版が古い」と表示されることがあります。そのときは取得し直してください。
        </Note>
      </Section>

      {core.length > 0 ? (
        <Section title="アプリ本体に含まれる教材">
          <ul data-testid="packs-core">
            {core.map((s) => (
              <li key={s.packId}>{packLabel(s.packId)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="教材を削除します"
          target={packLabel(confirmDelete.packId)}
          message="この教材を端末から削除します。学習の記録は消えません。もう一度使うときは、取得し直してください（ネットワークが必要です）。"
          confirmLabel="削除する"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await deletePack(confirmDelete.packId);
            setMsg(
              `「${packLabel(confirmDelete.packId)}」を削除しました（学習の記録は残っています）。`,
            );
            setConfirmDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PackRow({
  status: s,
  onDownload,
  onDelete,
}: {
  status: PackStatus;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const progress = getPackProgress(s.packId);
  const error = getPackError(s.packId);
  const label = packLabel(s.packId);
  return (
    <tr data-testid={`pack-row-${s.packId}`} data-state={progress ? 'downloading' : s.state}>
      <td>{label}</td>
      <td>{s.bytes > 0 ? formatBytes(s.bytes) : '—'}</td>
      <td>
        {progress ? (
          <span data-testid={`pack-progress-${s.packId}`}>
            取得中 {Math.round((progress.doneBytes / Math.max(1, progress.totalBytes)) * 100)}%
            <progress
              value={progress.doneBytes}
              max={Math.max(1, progress.totalBytes)}
              aria-label={`${label} の取得の進み具合`}
            />
          </span>
        ) : (
          <span data-testid={`pack-state-${s.packId}`}>{stateText(s)}</span>
        )}
        {error && !progress ? (
          <span className="p-error" role="alert" data-testid={`pack-error-${s.packId}`}>
            <br />
            {FAILURE_TEXT[error]}
          </span>
        ) : null}
      </td>
      <td>
        <div className="p-row">
          {s.state === 'not-downloaded' || s.state === 'outdated' ? (
            <button
              type="button"
              disabled={progress !== null}
              onClick={onDownload}
              data-testid={`pack-download-${s.packId}`}
            >
              {s.state === 'outdated' ? '取得し直す' : '取得する'}
            </button>
          ) : null}
          {s.state === 'ready' || s.state === 'outdated' ? (
            <button
              type="button"
              className="p-danger"
              disabled={progress !== null}
              onClick={onDelete}
              data-testid={`pack-delete-${s.packId}`}
            >
              削除する
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
