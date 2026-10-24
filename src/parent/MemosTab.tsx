import { useCallback, useState } from 'react';
import { useApp } from '../app/AppState';
import * as db from '../core/storage/index';
import type { MemoRecord } from '../core/types';
import { ConfirmDialog, Note, Section } from './ui';
import { todayString, useLoad } from './util';

const MAX = 2000;
const CHECKLIST = [
  '自分から始められましたか（声かけなしで、画面を触り始めたか）',
  '困ったときに、どんな様子でしたか（黙る・聞く・別の場所を押す・怒る など）',
  'やめるときの様子はどうでしたか（すっと終われたか、続けたがったか）',
  '終わったあと、また遊びたがりましたか',
  '遊びで知ったことを、ふだんの生活で口にしたり試したりしましたか',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function MemosTab() {
  const app = useApp();
  const pid = app.profile?.id ?? '';
  const load = useCallback(() => db.listMemos(pid), [pid]);
  const { data: memos, reload } = useLoad(load);
  const [date, setDate] = useState(todayString());
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; date: string; text: string } | null>(null);
  const [del, setDel] = useState<MemoRecord | null>(null);
  if (!app.profile) return null;

  const canAdd = text.trim().length > 0 && text.length <= MAX && DATE_RE.test(date);

  return (
    <div data-testid="tab-memos">
      <Section title="保護者が子供と試す観察チェックリスト">
        <p className="p-small">
          一緒に遊んだときに、次のような点を見てみてください。点数をつけるものではありません。
        </p>
        <ol data-testid="memo-checklist">
          {CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </Section>

      <Section title="観察メモを書く">
        <label className="p-field">
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="memo-date"
          />
        </label>
        <label className="p-field">
          メモ（{text.length}/{MAX}字）
          <textarea
            rows={4}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="memo-text"
          />
        </label>
        <button
          type="button"
          disabled={!canAdd}
          data-testid="memo-add"
          onClick={() => {
            void (async () => {
              await db.saveMemo({
                id: crypto.randomUUID(),
                profileId: pid,
                date,
                text: text.trim(),
                createdAt: Date.now(),
              });
              setText('');
              reload();
            })();
          }}
        >
          メモを追加
        </button>
      </Section>

      <Section title={`${app.profile.name}さんのメモ`}>
        {!memos ? <p>読み込み中…</p> : null}
        {memos && memos.length === 0 ? <p className="p-muted">まだメモがありません。</p> : null}
        <ul className="p-memos">
          {(memos ?? []).map((m) => (
            <li key={m.id} data-testid={`memo-${m.id}`}>
              {editing?.id === m.id ? (
                <>
                  <input
                    type="date"
                    value={editing.date}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    aria-label="日付"
                  />
                  <textarea
                    rows={4}
                    maxLength={MAX}
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    data-testid="memo-edit-text"
                  />
                  <div className="p-row">
                    <button
                      type="button"
                      data-testid="memo-save"
                      disabled={!editing.text.trim() || !DATE_RE.test(editing.date)}
                      onClick={() => {
                        void (async () => {
                          await db.saveMemo({
                            ...m,
                            date: editing.date,
                            text: editing.text.trim(),
                          });
                          setEditing(null);
                          reload();
                        })();
                      }}
                    >
                      保存
                    </button>
                    <button type="button" onClick={() => setEditing(null)}>
                      やめる
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-memo__date">{m.date}</div>
                  <div className="p-memo__text">{m.text}</div>
                  <div className="p-row">
                    <button
                      type="button"
                      data-testid={`memo-edit-${m.id}`}
                      onClick={() => setEditing({ id: m.id, date: m.date, text: m.text })}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      data-testid={`memo-delete-${m.id}`}
                      onClick={() => setDel(m)}
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <Note>メモは端末の中だけに保存されます。「データ」タブの書き出しに含まれます。</Note>
      </Section>

      {del ? (
        <ConfirmDialog
          title="メモを削除します"
          target={`${del.date} のメモ「${del.text.slice(0, 30)}${del.text.length > 30 ? '…' : ''}」`}
          confirmLabel="削除する"
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await db.deleteMemo(del.id);
            setDel(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
