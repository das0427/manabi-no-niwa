/**
 * 「このアプリについて」の節「アプリの更新」と、保護者画面の上の知らせ（設計: docs/expansion/updater-design.md 6.2節）。
 * 配信の窓口があるとき（useUpdater().available）だけ出す。押したあとの流れは src/core/offline/updater.ts が持つので、
 * この画面を離れても続く。更新の表示は保護者画面だけで、子供の画面・起動画面には出さない。
 */
import { useState } from 'react';
import { navigate } from '../app/router';
import {
  requestApply,
  requestCancel,
  requestCheck,
  setAutoCheck,
  useUpdater,
  type UpdaterStatus,
  type UpdaterView,
} from '../core/offline/updater';
import { Note, Section } from './ui';
import { formatBytes, formatDateTime } from './util';

const GIB = 1024 * 1024 * 1024;
const SERVER_WORKING = ['downloading', 'extracting', 'testing', 'switching', 'restarting'];
const ACTIVE_FLOWS = ['server', 'waiting-server', 'sw', 'reloading', 'packs'];

/** 大きさ（1 GB 未満は MB・KB、それ以上は GB） */
function sizeText(n: number): string {
  return n >= GIB ? `${(n / GIB).toFixed(1)} GB` : formatBytes(n);
}

/** 足りない大きさ（GB・小数 1 桁に切り上げ） */
function gbText(n: number): string {
  return `${(Math.ceil((Math.max(0, n) / GIB) * 10) / 10).toFixed(1)} GB`;
}

function percentOf(done: number, total: number): number | null {
  return total > 0 ? Math.min(100, Math.max(0, Math.floor((done / total) * 100))) : null;
}

function atText(iso: string | null): string | null {
  if (iso === null) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : formatDateTime(ms);
}

/**
 * 失敗の理由の文（コード → 文。設計 6.2 節の表）。
 * shortBytes: disk-full のとき、あと何バイト足りないか（配信の needBytes − 今の空き。分からない・0 以下なら省く）
 */
export function updateReasonText(code: string, shortBytes?: number): string {
  const needBytes = shortBytes !== undefined && shortBytes > 0 ? shortBytes : undefined;
  switch (code) {
    case 'offline':
      return 'インターネットにつながっていないか、GitHub に接続できませんでした。つながってから「もう一度ためす」を押してください（取得した分は残っていて、続きから始めます）。';
    case 'http':
    case 'not-found':
      return '配布元（GitHub）から取得できませんでした。新しい版の準備中かもしれません。しばらくしてからお試しください。';
    case 'redirect-host':
    case 'tls':
      return '配布元への接続を安全に確かめられなかったため、中止しました。ネットワークの設定（プロキシなど）をご確認ください。';
    case 'bad-manifest':
    case 'size-mismatch':
    case 'sha256-mismatch':
    case 'unsafe-zip':
    case 'content-check':
      return '取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。';
    case 'disk-full':
      return needBytes !== undefined
        ? `空き容量が足りません（あと約 ${gbText(needBytes)} 必要です）。不要なファイルを消してから、もう一度お試しください。`
        : '空き容量が足りません。不要なファイルを消してから、もう一度お試しください。';
    case 'self-test':
    case 'switch-failed':
      return '新しい版を動かす準備で問題が見つかったため、元の版のままにしました。';
    case 'interrupted':
      return '前回の更新が途中で止まりました。もう一度押すと続きから始めます。';
    case 'version-changed':
      return 'さらに新しい版が出ていました。表示を新しくしたので、もう一度「更新する」を押してください。';
    case 'busy':
      return 'ほかの更新が進んでいます。終わるまでお待ちください。';
    case 'blocked':
      return 'この版からは自動で更新できません。README の手順で入れ直してください。';
    case 'server-timeout':
      return '配信が起動し直しませんでした。アプリの窓を閉じて、デスクトップのアイコンから開き直してください。';
    case 'sw-failed':
      return 'アプリの新しい版の準備に失敗しました。アプリを開き直すと、もう一度準備します。';
    case 'sw-mismatch':
      return '読み込み直しても新しい版に切り替わりませんでした。アプリの窓を全部閉じて、開き直してください。';
    default:
      return '更新できませんでした。';
  }
}

function blockedText(version: string): string {
  return `新しい版 ${version} があります。この版からは自動で更新できません。README の「新しい版に更新するとき」の手順で入れ直してください。`;
}

/** 確認が失敗したときの、かっこの中の短い理由 */
function checkErrorText(error: { code: string; detail: string } | null): string {
  if (!error) return '理由はわかりません';
  switch (error.code) {
    case 'http':
    case 'not-found':
      return '配布元（GitHub）から情報を取得できませんでした';
    case 'redirect-host':
    case 'tls':
      return '配布元への接続を安全に確かめられませんでした';
    case 'bad-manifest':
      return '取得した情報が正しくありませんでした';
    default:
      return error.detail || error.code;
  }
}

function checkText(st: UpdaterStatus): string {
  const { check, latest } = st;
  switch (check.state) {
    case 'never':
      return 'まだ確かめていません';
    case 'checking':
      return '新しい版があるか確かめています…';
    case 'ok': {
      const at = atText(check.at);
      const done = at ? `${at} に確かめました` : '確かめました';
      return latest && latest.newer ? done : `${done}。新しい版はありません`;
    }
    case 'offline':
      return 'インターネットにつながっていないため、確かめられませんでした（つながっているときに、また確かめます）';
    case 'error':
      return `確かめられませんでした（${checkErrorText(check.error)}）`;
  }
}

interface Work {
  text: string;
  /** 棒の進み具合（null は「進み具合が分からない」棒） */
  value: number | null;
  max: number;
  cancellable: boolean;
}

function serverWork(st: UpdaterStatus): Work {
  const { phase, progress } = st.update;
  const pct = progress ? percentOf(progress.doneBytes, progress.totalBytes) : null;
  const bar = progress
    ? { value: progress.doneBytes, max: Math.max(1, progress.totalBytes) }
    : null;
  switch (phase) {
    case 'downloading':
      return {
        text:
          progress && pct !== null
            ? `ダウンロードしています ${pct}%（${sizeText(progress.doneBytes)} / ${sizeText(progress.totalBytes)}）`
            : 'ダウンロードしています',
        value: bar?.value ?? null,
        max: bar?.max ?? 1,
        cancellable: true,
      };
    case 'extracting':
      return {
        text: pct !== null ? `展開しています ${pct}%` : '展開しています',
        value: bar?.value ?? null,
        max: bar?.max ?? 1,
        cancellable: true,
      };
    case 'testing':
      return { text: '新しい版を確かめています', value: null, max: 1, cancellable: false };
    case 'switching':
      return { text: '切り替えています', value: null, max: 1, cancellable: false };
    case 'restarting':
      return { text: '配信を起動し直しています', value: null, max: 1, cancellable: false };
    default:
      return { text: '更新を始めています', value: null, max: 1, cancellable: false };
  }
}

/** 作業中の表示（段階の文と棒）。作業が無ければ null */
function workOf(v: UpdaterView): Work | null {
  const st = v.status;
  switch (v.flow) {
    case 'packs': {
      const p = v.packs;
      return {
        text: p ? `教材を取り直しています（${p.done} / ${p.total}）` : '教材を取り直しています',
        value: p && p.totalBytes > 0 ? p.doneBytes : p ? p.done : null,
        max: p ? (p.totalBytes > 0 ? p.totalBytes : Math.max(1, p.total)) : 1,
        cancellable: false,
      };
    }
    case 'reloading':
      return { text: '読み込み直します', value: null, max: 1, cancellable: false };
    case 'sw': {
      const p = v.swProgress;
      const pct = p ? percentOf(p.done, p.total) : null;
      return {
        text: `アプリの新しい版を準備しています${pct !== null ? ` ${pct}%` : ''}`,
        value: p && pct !== null ? p.done : null,
        max: p ? Math.max(1, p.total) : 1,
        cancellable: false,
      };
    }
    case 'waiting-server':
      return { text: '配信を起動し直しています', value: null, max: 1, cancellable: false };
    case 'server':
      return st ? serverWork(st) : null;
    default:
      // 流れは無いが、配信が作業中（別の画面で押した、など）
      return st && SERVER_WORKING.includes(st.update.phase) ? serverWork(st) : null;
  }
}

/** 更新の作業中か（流れが動いている、または配信が作業中） */
function isBusy(v: UpdaterView): boolean {
  return (
    ACTIVE_FLOWS.includes(v.flow) ||
    (v.status !== null && SERVER_WORKING.includes(v.status.update.phase))
  );
}

/** 失敗の理由（コードと、配信が教えた詳しい説明）。失敗が無ければ null */
function failureOf(v: UpdaterView): { code: string; detail: string; needBytes?: number } | null {
  const st = v.status;
  if (v.flow === 'failed') {
    const e = st?.update.error;
    const code = v.flowError ?? 'unknown';
    return e && e.code === code
      ? { code, detail: e.detail, ...(e.needBytes !== undefined ? { needBytes: e.needBytes } : {}) }
      : { code, detail: '' };
  }
  // 前回の更新の失敗が配信に残っていて、いま入れられる新しい版があるとき
  if (v.flow === 'none' && st && st.update.phase === 'failed' && st.update.error) {
    if (st.latest && st.latest.newer && st.latest.installable) {
      const e = st.update.error;
      return {
        code: e.code,
        detail: e.detail,
        ...(e.needBytes !== undefined ? { needBytes: e.needBytes } : {}),
      };
    }
  }
  return null;
}

export function UpdateSection() {
  const v = useUpdater();
  const [pendingAuto, setPendingAuto] = useState<boolean | null>(null);
  const st = v.status;
  if (!v.available || !st) return null;

  const latest = st.latest;
  const work = workOf(v);
  const busy = isBusy(v);
  const failure = busy ? null : failureOf(v);
  const offerable = !busy && latest !== null && latest.newer && latest.installable;
  const blocked = !busy && latest !== null && latest.newer && !latest.installable;
  const diskShort = offerable && latest !== null && st.disk.freeBytes < latest.needBytes;
  const retryVersion = latest?.version ?? st.current.version;
  const applied = st.lastApplied;
  const done =
    !busy && !failure && applied !== null && applied.version === st.current.version
      ? applied
      : null;
  const autoChecked = pendingAuto ?? st.settings.autoCheck;

  return (
    <Section title="アプリの更新" id="update-section">
      <p data-testid="update-current">いまの版: {st.current.version}</p>
      <p data-testid="update-check-status">{checkText(st)}</p>

      {work ? (
        <div className="p-update-work" role="status" data-testid="update-work">
          <p data-testid="update-progress-text">{work.text}</p>
          <progress
            data-testid="update-progress"
            aria-label="更新の進み具合"
            {...(work.value !== null ? { value: work.value, max: work.max } : {})}
          />
          <div className="p-row">
            {work.cancellable ? (
              <button
                type="button"
                data-testid="update-cancel"
                onClick={() => void requestCancel()}
              >
                中止する
              </button>
            ) : null}
            <span className="p-small p-muted" data-testid="update-leave-note">
              この画面を離れても続きます
            </span>
          </div>
        </div>
      ) : null}

      {offerable && latest ? (
        <div className="p-alert" data-testid="update-available">
          <p>
            <strong>
              新しい版 {latest.version} があります（公開日 {latest.date}）
            </strong>
          </p>
          {latest.notes.length > 0 ? (
            <ul data-testid="update-notes">
              {latest.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p className="p-small" data-testid="update-size">
            ダウンロードする大きさ: 約 {sizeText(latest.downloadBytes)}（変わった部分だけ）
          </p>
          {diskShort ? (
            <p className="p-error" data-testid="update-disk-warning">
              空き容量が足りないかもしれません（あと約{' '}
              {gbText(latest.needBytes - st.disk.freeBytes)} 必要です）
            </p>
          ) : null}
          {failure ? null : (
            <>
              <div className="p-row">
                <button
                  type="button"
                  className="p-primary"
                  data-testid="update-apply"
                  onClick={() => void requestApply(latest.version)}
                >
                  更新する
                </button>
              </div>
              <Note>
                押すと、ダウンロード・確認・切り替え・教材の取り直しまで自動で行います。終わるとアプリを1回読み込み直します（そのあと保護者画面を開き直すと結果が見られます）。学習の記録は消えません。お子さんが遊んでいないときに押してください。
              </Note>
            </>
          )}
        </div>
      ) : null}

      {blocked && latest ? (
        <p className="p-alert" data-testid="update-blocked">
          {blockedText(latest.version)}
        </p>
      ) : null}

      {failure ? (
        <div className="p-error" role="alert" data-testid="update-error">
          <p>
            更新できませんでした:{' '}
            {updateReasonText(
              failure.code,
              failure.needBytes !== undefined ? failure.needBytes - st.disk.freeBytes : undefined,
            )}
          </p>
          {failure.detail ? (
            <p className="p-small p-muted" data-testid="update-error-detail">
              {failure.detail}
            </p>
          ) : null}
          <p>いまの版はそのまま使えます</p>
        </div>
      ) : null}

      {failure ? (
        <div className="p-row">
          <button
            type="button"
            data-testid="update-retry"
            onClick={() => void requestApply(retryVersion)}
          >
            もう一度ためす
          </button>
        </div>
      ) : null}

      {done ? (
        <p data-testid="update-done">
          {done.version} に更新しました{atText(done.at) ? `（${atText(done.at)}）` : ''}
        </p>
      ) : null}

      <label className="p-field p-field--inline">
        <input
          type="checkbox"
          data-testid="update-autocheck"
          checked={autoChecked}
          onChange={(e) => {
            const on = e.target.checked;
            setPendingAuto(on);
            void setAutoCheck(on).finally(() => setPendingAuto(null));
          }}
        />
        起動したときに、新しい版があるかを自動で確かめる（インターネットにつながっているときだけ）
      </label>
      <div className="p-row">
        <button
          type="button"
          data-testid="update-check-now"
          disabled={st.check.state === 'checking' || busy}
          onClick={() => void requestCheck()}
        >
          今すぐ確かめる
        </button>
      </div>
      <Note>
        更新を確かめるときと取得するときだけ、GitHub（github.com）に接続します。送るのはアプリの名前だけで、記録や個人の情報は送りません。
      </Note>
    </Section>
  );
}

/**
 * 保護者画面の上の小さな知らせ。新しい版があるとき「くわしく」で「このアプリについて」へ、
 * 更新の作業中は「アプリを更新しています…」。子供の画面・起動画面には出さない。
 */
export function UpdateNotice() {
  const v = useUpdater();
  const st = v.status;
  if (!v.available || !st) return null;
  if (isBusy(v)) {
    return (
      <div className="p-alert p-update-notice" role="status" data-testid="parent-update-notice">
        <span>アプリを更新しています…</span>
      </div>
    );
  }
  const latest = st.latest;
  if (!latest || !latest.newer || !latest.installable) return null;
  return (
    <div className="p-alert p-update-notice" role="status" data-testid="parent-update-notice">
      <span>新しい版 {latest.version} があります</span>
      <button
        type="button"
        data-testid="parent-update-notice-open"
        onClick={() => navigate({ name: 'parent', tab: 'about' }, { force: true })}
      >
        くわしく
      </button>
    </div>
  );
}
