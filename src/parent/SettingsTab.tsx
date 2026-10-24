import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app/AppState';
import { hashPin } from '../app/pin';
import { setLevelByParent } from '../core/progress/rules';
import * as db from '../core/storage/index';
import {
  MODE_IDS,
  SKILL_IDS,
  type ChildSettings,
  type SkillId,
  type SupportSettings,
  type TraceTolerance,
} from '../core/types';
import { MODES, SKILLS, roundSizeFor } from '../modes/registry';
import { Note, Section } from './ui';
import { modeTitle, useLoad } from './util';

const TOL_LABEL: Record<TraceTolerance, string> = {
  wide: 'ひろい',
  normal: 'ふつう',
  narrow: 'せまい',
};
const INPUT_LABEL = { touch: '指', pen: 'ペン', mouse: 'マウス' } as const;

function SkillLevelRow({ skill }: { skill: SkillId }) {
  const app = useApp();
  const profile = app.profile!;
  const settings = app.settings!;
  const def = SKILLS[skill];
  const locked = settings.levelLocks[skill];
  const load = useCallback(() => db.getProgress(profile.id, skill), [profile.id, skill]);
  const { data: progress, reload } = useLoad(load);
  const [choice, setChoice] = useState<number | null>(null);
  if (!progress) return null;
  const current = choice ?? locked ?? progress.level;

  const apply = async (level: number, lock: boolean | null) => {
    // lock: true=固定する / false=自動に戻す / null=固定の状態は変えない
    const fresh = await db.getProgress(profile.id, skill);
    await db.saveProgress(setLevelByParent(fresh, level, Date.now()));
    const locks = { ...settings.levelLocks };
    if (lock === true || (lock === null && locked !== undefined)) locks[skill] = level;
    else delete locks[skill];
    await app.updateSettings({ ...settings, levelLocks: locks });
    reload();
  };

  return (
    <tr data-testid={`level-row-${skill}`}>
      <td>{def.label}</td>
      <td data-testid={`level-current-${skill}`}>
        {def.levels[progress.level]?.code}&emsp;{progress.attempted ? '' : '（未実施）'}
      </td>
      <td>
        <select
          value={current}
          aria-label={`${def.label}の段階`}
          data-testid={`level-select-${skill}`}
          onChange={(e) => {
            const n = Number(e.target.value);
            setChoice(n);
            if (locked !== undefined) void apply(n, true);
          }}
        >
          {def.levels.map((l, i) => (
            <option key={l.code} value={i}>
              {l.code} {l.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <label>
          <input
            type="checkbox"
            checked={locked !== undefined}
            data-testid={`level-lock-${skill}`}
            onChange={(e) => void apply(current, e.target.checked)}
          />{' '}
          こてい（じどうで変えない）
        </label>
      </td>
      <td>
        <button
          type="button"
          data-testid={`level-start-${skill}`}
          onClick={() => void apply(current, null)}
        >
          この段階から始める
        </button>
      </td>
    </tr>
  );
}

function FormulaUnlock() {
  const app = useApp();
  const pid = app.profile!.id;
  const load = useCallback(
    () => Promise.all([db.getProgress(pid, 'formula_add'), db.getProgress(pid, 'formula_sub')]),
    [pid],
  );
  const { data, reload } = useLoad(load);
  if (!data) return null;
  const open = data.every((p) => p.attempted);
  return (
    <div>
      <p>
        さんすうの「しきだけ」（たしざん・ひきざん）は、ふつうは絵のたしざん・ひきざんがじゅうぶん進んだあとに表示されます。
        すぐに遊ばせたいときは、ここで表示できます。
      </p>
      <button
        type="button"
        disabled={open}
        data-testid="unlock-formula"
        onClick={() => {
          void (async () => {
            for (const p of data) await db.saveProgress({ ...p, attempted: true });
            reload();
          })();
        }}
      >
        しきだけを早く出す
      </button>{' '}
      <span className="p-muted" data-testid="unlock-formula-state">
        {open ? '表示されています' : 'まだ表示されていません'}
      </span>
    </div>
  );
}

function PinSection() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let alive = true;
    void db.getAppRecord().then((r) => {
      if (alive) setHasPin(r.parentPinHash !== null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const valid = /^\d{4,6}$/.test(pin);
  return (
    <div>
      <p data-testid="pin-state">
        暗証番号: {hasPin === null ? '…' : hasPin ? '設定されています' : '設定されていません'}
      </p>
      <label className="p-field">
        新しい暗証番号（数字4〜6桁）
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          data-testid="pin-input"
          autoComplete="off"
        />
      </label>
      <div className="p-row">
        <button
          type="button"
          disabled={!valid}
          data-testid="pin-set"
          onClick={() => {
            void (async () => {
              const rec = await db.getAppRecord();
              await db.saveAppRecord({ ...rec, parentPinHash: await hashPin(pin) });
              setPin('');
              setHasPin(true);
              setMsg('暗証番号を設定しました。');
            })();
          }}
        >
          設定する
        </button>
        <button
          type="button"
          disabled={!hasPin}
          data-testid="pin-clear"
          onClick={() => {
            void (async () => {
              const rec = await db.getAppRecord();
              await db.saveAppRecord({ ...rec, parentPinHash: null });
              setHasPin(false);
              setMsg('暗証番号を解除しました。入口は計算問題になります。');
            })();
          }}
        >
          解除する
        </button>
      </div>
      {msg ? <p role="status">{msg}</p> : null}
      <Note>
        暗証番号は子供の誤操作を防ぐためのもので、強固な保護ではありません。忘れた場合は「データ」タブからデータを書き出し、ブラウザのデータを消去すると解除できます。
      </Note>
    </div>
  );
}

function FullscreenSection() {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  const [err, setErr] = useState('');
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return (
    <div>
      <button
        type="button"
        data-testid="fullscreen-toggle"
        onClick={() => {
          setErr('');
          const p = document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen();
          p.catch(() => setErr('このブラウザでは全画面にできませんでした。'));
        }}
      >
        {full ? '全画面をやめる' : '全画面にする'}
      </button>
      {err ? <p role="status">{err}</p> : null}
      <Note>全画面表示は強制しません。ブラウザの操作（Esc キーなど）でいつでも戻れます。</Note>
    </div>
  );
}

/** 支援設定の項目（architecture.md 2章 SupportSettings） */
const SUPPORT_FIELDS: {
  key: keyof SupportSettings;
  label: string;
  options: [SupportSettings[keyof SupportSettings], string][];
  note?: string;
}[] = [
  {
    key: 'furigana',
    label: 'ふりがな',
    options: [
      ['unlearned', '学年に合わせる'],
      ['all', 'すべての漢字に付ける'],
      ['none', '習った学年までの漢字には付けない'],
    ],
    note: '「学年に合わせる」は、在籍学年とそれより上の学年の漢字に付けます。上の学年の漢字には、どの設定でも付きます。',
  },
  {
    key: 'readAloud',
    label: '読み上げ',
    options: [
      ['always', '問題を開くと読む'],
      ['button', '「きく」を押したときだけ'],
      ['off', '読まない'],
    ],
  },
  {
    key: 'textScale',
    label: '文字の大きさ',
    options: [
      [1, 'ふつう'],
      [1.15, '少し大きく'],
      [1.3, '大きく'],
    ],
  },
  {
    key: 'style',
    label: '画面の表現',
    options: [
      ['gentle', 'やさしい'],
      ['standard', 'ふつう'],
      ['calm', 'おちついた（装飾と音を減らす）'],
    ],
  },
  {
    key: 'drawingTools',
    label: 'おえかきの道具',
    options: [
      ['simple', 'かんたん'],
      ['detailed', 'くわしく'],
    ],
  },
  {
    key: 'effects',
    label: '声かけ・演出',
    options: [
      ['on', 'あり'],
      ['quiet', '控えめ'],
      ['off', 'なし'],
    ],
  },
];

export function SettingsTab() {
  const app = useApp();
  const s = app.settings;
  if (!app.profile || !s) return null;
  const update = (patch: Partial<ChildSettings>) => void app.updateSettings({ ...s, ...patch });

  return (
    <div data-testid="tab-settings">
      <Note>変更はすぐに保存されます。この設定は「{app.profile.name}」のものです。</Note>

      <Section title="音・動き">
        <label className="p-field">
          <span>
            音量: <span data-testid="setting-volume-text">{Math.round(s.volume * 100)}</span>%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.volume * 100)}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            data-testid="setting-volume"
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={s.sfx}
            onChange={(e) => update({ sfx: e.target.checked })}
            data-testid="setting-sfx"
          />{' '}
          効果音を鳴らす
        </label>
        <br />
        <label>
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
            data-testid="setting-reduceMotion"
          />{' '}
          動きを減らす
        </label>
      </Section>

      <Section title="表示と支援">
        <Note>
          区分（プロフィール）とは別に変えられます。学年より前の単元を復習しても、この設定は変わりません。
        </Note>
        {SUPPORT_FIELDS.map((f) => (
          <fieldset key={f.key} className="p-field">
            <legend>{f.label}</legend>
            {f.options.map(([v, text]) => (
              <label key={String(v)} className="p-inline">
                <input
                  type="radio"
                  name={`support-${f.key}`}
                  checked={s.support[f.key] === v}
                  onChange={() => update({ support: { ...s.support, [f.key]: v } })}
                  data-testid={`setting-support-${f.key}-${String(v)}`}
                />
                {text}
              </label>
            ))}
            {f.note ? <span className="p-muted">{f.note}</span> : null}
          </fieldset>
        ))}
      </Section>

      <Section title="利用時間・問題数">
        <label className="p-field">
          利用時間の目安
          <select
            value={s.sessionMinutes}
            onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}
            data-testid="setting-sessionMinutes"
          >
            <option value={0}>なし</option>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m}分
              </option>
            ))}
          </select>
        </label>
        <Note>これは医学的な推奨ではなく、ご家庭で決める目安です。</Note>
        <label className="p-field">
          1回の問題数
          <select
            value={s.roundSize}
            onChange={(e) => update({ roundSize: Number(e.target.value) as 3 | 4 | 5 })}
            data-testid="setting-roundSize"
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}問
              </option>
            ))}
          </select>
        </label>
        <table className="p-table p-table--compact" data-testid="roundsize-table">
          <thead>
            <tr>
              <th>設定</th>
              <th>ふつうの問題</th>
              <th>盤面型（なかまわけ・みち）</th>
              <th>なぞり</th>
            </tr>
          </thead>
          <tbody>
            {([3, 4, 5] as const).map((n) => (
              <tr key={n} className={n === s.roundSize ? 'is-current' : ''}>
                <td>{n}</td>
                <td>{roundSizeFor('questions', n)}問</td>
                <td>{roundSizeFor('boards', n)}盤面</td>
                <td>{roundSizeFor('trace', n)}回</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          盤面型（なかまわけ・みちづくり）は1つの盤面に時間がかかるため、設定を2〜3盤面に読み替えます。なぞりは疲れやすいため設定より1回少なくなります。
        </Note>
      </Section>

      <Section title="ホームの表示">
        <label>
          <input
            type="radio"
            name="homeDisplay"
            checked={s.homeDisplay === 'all'}
            onChange={() => update({ homeDisplay: 'all' })}
            data-testid="setting-homeDisplay-all"
          />{' '}
          ぜんぶ表示する
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="homeDisplay"
            checked={s.homeDisplay === 'selected'}
            onChange={() => update({ homeDisplay: 'selected' })}
            data-testid="setting-homeDisplay-selected"
          />{' '}
          えらんだものだけ表示する
        </label>
        {s.homeDisplay === 'selected' ? (
          <div className="p-checks" data-testid="setting-modes">
            {MODES.map((m) => {
              const on = s.visibleModes.includes(m.id);
              return (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={on && s.visibleModes.length <= 1}
                    data-testid={`setting-mode-${m.id}`}
                    onChange={(e) =>
                      update({
                        visibleModes: MODE_IDS.filter((id) =>
                          id === m.id ? e.target.checked : s.visibleModes.includes(id),
                        ),
                      })
                    }
                  />{' '}
                  {modeTitle(m.id)}
                </label>
              );
            })}
          </div>
        ) : null}
      </Section>

      <Section title="なぞりの判定幅">
        <Note>
          「ひろい」ほどはみ出しても受け入れます。入力の種類（指・ペン・マウス）ごとに選べます。
        </Note>
        {(['touch', 'pen', 'mouse'] as const).map((k) => (
          <label key={k} className="p-field p-field--inline">
            {INPUT_LABEL[k]}
            <select
              value={s.traceTolerance[k]}
              onChange={(e) =>
                update({
                  traceTolerance: { ...s.traceTolerance, [k]: e.target.value as TraceTolerance },
                })
              }
              data-testid={`setting-tolerance-${k}`}
            >
              {(['wide', 'normal', 'narrow'] as const).map((t) => (
                <option key={t} value={t}>
                  {TOL_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Note>なぞりの練習は、鉛筆の持ち方や筆圧の練習とは別です。</Note>
      </Section>

      <Section title="おぼえて さがす">
        <label className="p-field">
          絵を自動で隠すまでの秒数
          <select
            value={s.memoryAutoHideSec}
            onChange={(e) =>
              update({
                memoryAutoHideSec: Number(e.target.value) as ChildSettings['memoryAutoHideSec'],
              })
            }
            data-testid="setting-memoryAutoHideSec"
          >
            <option value={0}>なし（子供が「おぼえた！」を押すまで）</option>
            {[3, 5, 8].map((n) => (
              <option key={n} value={n}>
                {n}秒
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="スキルごとの段階">
        <Note>
          「じどう」では、結果を見ながら段階が変わります。「こてい」にすると、その段階のまま変わりません。「この段階から始める」は、選んだ段階に今すぐ切り替えます（固定はしません）。
        </Note>
        <table className="p-table" data-testid="level-table">
          <thead>
            <tr>
              <th>スキル</th>
              <th>いま</th>
              <th>段階</th>
              <th>固定</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SKILL_IDS.map((id) => (
              <SkillLevelRow key={`${app.profile!.id}-${id}`} skill={id} />
            ))}
          </tbody>
        </table>
        <h3>しきだけ</h3>
        <FormulaUnlock key={app.profile.id} />
      </Section>

      <Section title="保護者の暗証番号">
        <PinSection />
      </Section>

      <Section title="画面">
        <FullscreenSection />
      </Section>
    </div>
  );
}
