import { OFFLINE_REOPEN_NOTE } from '../app/PackSetupStatus';
import { applyUpdate, isPageControlled, useOfflineState } from '../core/offline/index';
import { useUpdater } from '../core/offline/updater';
import { UNIT_INDEX } from '../curriculum/unitIndex';
import { MODES } from '../modes/registry';
import { plainText } from '../text/rich';
import { Note, Section } from './ui';
import { UpdateSection } from './UpdateSection';
import { APP_VERSION } from './util';

const CREDITS: [string, string][] = [
  ['音声', 'Open JTalk / Mei（CC BY 3.0、名古屋工業大学）'],
  ['フォント', 'Zen Maru Gothic・Klee One（SIL OFL 1.1）'],
  ['書き順データ', 'KanjiVG（CC BY-SA 3.0）'],
  ['イラスト', 'オリジナル（このアプリのために描いたもの）'],
];

const STAGE_LABEL: Record<string, string> = { p23: '2〜3歳', p4: '4歳', p5: '5歳' };

const PRIVACY_TEXT =
  '広告・外部への通信・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。';
/** 更新の窓口があるとき: 外へ通信するのは、配信（serve.py）が更新を確かめるとき・ダウンロードするときだけ */
const PRIVACY_TEXT_WITH_UPDATER =
  '広告・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。外部への通信は、アプリの更新を確かめるときとダウンロードするときだけです。下の「アプリの更新」で自動の確認を止められます。';

export function AboutTab() {
  const off = useOfflineState();
  const upd = useUpdater();
  let status: string;
  if (!off.supported) {
    status = 'このブラウザ・この開き方では、オフライン機能が使えません。';
  } else if (off.status === 'installing') {
    const p = off.progress;
    status = p
      ? `オフラインの準備中です（${Math.round((p.done / Math.max(1, p.total)) * 100)}%）`
      : 'オフラインの準備中です';
  } else if (off.status === 'ready') {
    // 起動画面の保護者向けの表示（setupParentNote）と同じ文（開き直す前は「つかえます」と言わない）
    status = isPageControlled() ? 'オフラインで使えます' : OFFLINE_REOPEN_NOTE;
  } else if (off.status === 'error') {
    // off.error は保護者向けの文（src/core/offline/index.ts）。括弧に入れて前置きの文の後ろに付けない
    status = off.error ?? 'オフラインの準備ができませんでした';
  } else {
    status = 'オフラインの準備は、まだ始まっていません（開発中の表示では登録しません）。';
  }

  return (
    <div data-testid="tab-about">
      <Section title="このアプリについて">
        <p>まなびのにわは2歳から小学生までの子供向けの、日本語・オフラインの学習アプリです。</p>
        <p data-testid="app-version">バージョン: {APP_VERSION}</p>
        <p className="p-small" data-testid="about-privacy">
          {upd.available ? PRIVACY_TEXT_WITH_UPDATER : PRIVACY_TEXT}
        </p>
      </Section>

      {upd.available ? <UpdateSection /> : null}

      <Section title="オフラインの準備">
        <p data-testid="offline-status">{status}</p>
        {off.version ? <p className="p-small">キャッシュのバージョン: {off.version}</p> : null}
        {off.updateReady && !(upd.available && upd.flow !== 'none') ? (
          <div data-testid="update-ready">
            <p>新しいバージョンがあります。</p>
            <button type="button" data-testid="apply-update" onClick={() => void applyUpdate()}>
              更新する
            </button>
            <Note>
              更新するとページが再読み込みされます。遊んでいないときに行ってください。記録は残ります。
            </Note>
          </div>
        ) : null}
        <Note>
          PWAとしてのインストールはブラウザによって異なります。Chromium系はインストールできます。Firefox
          はデスクトップではインストールできませんが、ブラウザのままオフラインで使えます。くわしくは
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

      <Section title="幼児の英語について">
        <p data-testid="about-preschool-english">
          英語の音に親しみ、日本語とのちがいに気づく遊びです。英語の力を身につけることを目的にしていません。短い時間を、できるだけおうちの方と一緒に楽しんでください。
        </p>
        <h3>使い方のこつ</h3>
        <ul>
          <li>
            お子さんが絵を指さしたら、英語で言ってみてください。正しく言えたかは気にしなくて大丈夫です。
          </li>
          <li>英語のあいさつは、毎日の決まった場面で言い合うと続けやすくなります。</li>
          <li>体を動かす遊びは、大人がまねしてみせると、子どもも動きやすくなります。</li>
        </ul>
        <p>
          日本語の絵本の読み聞かせやおしゃべりの時間を減らさないでください。画面の文字は日本語（ひらがな）だけで、英語は音声だけで出します。
        </p>
        <p className="p-small">
          英語の音声は合成音声（Kokoro）で作っています。発音の正しさの判定や録音はしません。マイクは使いません。
        </p>
        <p className="p-small">
          2〜3歳の2歳の段階では、ホームに英語の札を出しません。「ほかの
          がくねん」から、おうちの方と一緒に遊べます。
        </p>
        <table
          className="p-table p-table--compact p-table--units"
          data-testid="preschool-english-units"
        >
          <tbody>
            {UNIT_INDEX.filter((u) => u.pack === 'en-pre').map((u) => (
              <tr key={u.id}>
                <th>
                  <span className="p-keep">{plainText(u.title)}</span>
                  <span className="p-nowrap">（{STAGE_LABEL[u.stage] ?? u.stage}）</span>
                </th>
                <td>{u.parentNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
