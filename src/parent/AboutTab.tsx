import { applyUpdate, isPageControlled, useOfflineState } from '../core/offline/index';
import { MODES } from '../modes/registry';
import { Note, Section } from './ui';
import { APP_VERSION } from './util';

const CREDITS: [string, string][] = [
  ['音声', 'Open JTalk / Mei（CC BY 3.0、名古屋工業大学）'],
  ['フォント', 'Zen Maru Gothic・Klee One（SIL OFL 1.1）'],
  ['書き順データ', 'KanjiVG（CC BY-SA 3.0）'],
  ['イラスト', 'オリジナル（このアプリのために描いたもの）'],
];

export function AboutTab() {
  const off = useOfflineState();
  let status: string;
  if (!off.supported) {
    status = 'このブラウザ・この開き方では、オフライン機能が使えません。';
  } else if (off.status === 'installing') {
    const p = off.progress;
    status = p
      ? `オフラインの準備中です（${Math.round((p.done / Math.max(1, p.total)) * 100)}%）`
      : 'オフラインの準備中です';
  } else if (off.status === 'ready') {
    status = isPageControlled()
      ? 'オフラインで使えます'
      : 'オフラインの準備ができました。いちど開き直すと使えます。';
  } else if (off.status === 'error') {
    status = `オフラインの準備ができませんでした${off.error ? `（${off.error}）` : ''}`;
  } else {
    status = 'オフラインの準備は、まだ始まっていません（開発中の表示では登録しません）。';
  }

  return (
    <div data-testid="tab-about">
      <Section title="このアプリについて">
        <p>まなびのにわ（4歳ごろ向けの、日本語・オフラインの学習アプリ）</p>
        <p data-testid="app-version">版: {APP_VERSION}</p>
        <p className="p-small">
          広告・外部への通信・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。
        </p>
      </Section>

      <Section title="オフラインの準備">
        <p data-testid="offline-status">{status}</p>
        {off.version ? <p className="p-small">キャッシュの版: {off.version}</p> : null}
        {off.updateReady ? (
          <div data-testid="update-ready">
            <p>あたらしい ばーじょんが あります。</p>
            <button type="button" data-testid="apply-update" onClick={() => void applyUpdate()}>
              更新する
            </button>
            <Note>
              更新するとページが再読み込みされます。遊んでいないときに行ってください。記録は残ります。
            </Note>
          </div>
        ) : null}
        <Note>
          PWAとしてのインストールはブラウザによって異なります（Chromium系は可。Firefox
          はデスクトップではインストールできませんが、ブラウザのままオフラインで使えます）。くわしくは
          README を参照してください。ファイルを直接開く（file://）と、オフライン機能は動きません。
        </Note>
      </Section>

      <Section title="保護者ゲートについて">
        <p>
          ホームの鍵ボタンの長押しと計算問題（または暗証番号）は、子供の誤操作を防ぐためのものです。強固な保護ではありません。
        </p>
      </Section>

      <Section title="おうちで ためせる あそび">
        <p className="p-small">画面を使わずに、同じような遊びを生活の中で試せます。</p>
        {MODES.map((m) => (
          <div key={m.id} data-testid={`tips-${m.id}`}>
            <h3>{m.title.replace(/\s+/g, '')}</h3>
            <ul>
              {m.homeTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
        <Note>
          「なぞって
          あそぼう」の練習は、鉛筆の持ち方や筆圧の練習とは別です。持ち方や書き方は、大人が実際の鉛筆で見てあげてください。
        </Note>
      </Section>

      <Section title="素材のクレジット">
        <table className="p-table p-table--compact" data-testid="credits">
          <tbody>
            {CREDITS.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
