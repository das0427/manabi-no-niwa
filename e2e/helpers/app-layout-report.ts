/**
 * アプリの全画面の配置の検査の結果の形と、要約（JSON と Markdown）を作る処理。
 * プロフィールごとの結果（.cache/app-layout/*.json）を集めて、docs/screenshots/app-layout-report/ に
 * report.json と summary.md を書く。全体の検査の後に globalTeardown（このファイルの default）から呼ぶ。
 * 要約だけ作り直すとき: npm run check:app-layout:summary
 * 報告書（docs/screenshots/app-layout-report/）と .cache/ は commit しない。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ISSUE_KINDS, APP_ISSUE_LABEL, APP_REFERENCE_KINDS } from './app-layout';
import type { AppIssue, AppIssueKind, AppState } from './app-layout';
import { TEXT_ISSUE_KINDS, TEXT_ISSUE_LABEL } from './text-layout';
import type { TextIssue, TextIssueKind } from './text-layout';

export const APP_CACHE_DIR = '.cache/app-layout';
export const APP_REPORT_DIR = 'docs/screenshots/app-layout-report';

export type AnyKind = TextIssueKind | AppIssueKind;
export const ALL_KINDS: readonly AnyKind[] = [...APP_ISSUE_KINDS, ...TEXT_ISSUE_KINDS];
export const KIND_LABEL: Record<AnyKind, string> = { ...APP_ISSUE_LABEL, ...TEXT_ISSUE_LABEL };

export type ReportIssue = (TextIssue | AppIssue) & { shot?: string; scrollY?: number };

export interface ScreenRow {
  /** '1280x720' */
  size: string;
  /** 画面全体のスクロールの位置（保護者画面。0 から clientHeight × 0.8 ずつ） */
  scrollY: number;
  issues: ReportIssue[];
}

export interface ScreenResult {
  id: string;
  state: AppState;
  stage: string;
  /** 同じ条件（プロフィール・画面・サイズ・ソースの更新時刻）の判定用の鍵 */
  key: string;
  /** ok = 検査した／unsupported = まだ無い画面／skipped = このプロフィールには出ない画面／error = 開けなかった */
  status: 'ok' | 'unsupported' | 'skipped' | 'error';
  note?: string;
  rows: ScreenRow[];
  /** 検査した回数（画面サイズ × スクロールの位置） */
  checks: number;
  ms: number;
}

export interface ProfileResult {
  profile: string;
  note: string;
  stage: string;
  startedAt: number;
  ms: number;
  /** `${state}:${id}` → 結果 */
  screens: Record<string, ScreenResult>;
  /** 画面を開けなかった・ページのエラー */
  errors: string[];
}

const SIZE_ORDER = ['1280x720', '1920x1080', '1280x620', '1536x864'];

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function fmtMin(ms: number): string {
  const m = ms / 60000;
  return m >= 60 ? `${(m / 60).toFixed(1)} 時間` : `${m.toFixed(1)} 分`;
}

export function readResults(root: string): ProfileResult[] {
  const dir = path.join(root, APP_CACHE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as ProfileResult)
    .sort((a, b) => a.profile.localeCompare(b.profile));
}

/** 要約を書く。戻り値は Markdown の本文 */
export function writeSummary(root: string): string | null {
  const results = readResults(root);
  if (results.length === 0) return null;

  // 画像が 0 枚になった種類のフォルダは消す（違反が 0 になった種類が、画像のフォルダの一覧に残らないように）。
  // 並列の検査の最中には消さない（別のプロセスが書き込む）ので、全部が終わったここで消す
  const shots = path.join(root, APP_REPORT_DIR, 'shots');
  if (existsSync(shots))
    for (const e of readdirSync(shots, { withFileTypes: true }))
      if (e.isDirectory() && readdirSync(path.join(shots, e.name)).length === 0)
        rmSync(path.join(shots, e.name), { recursive: true, force: true });

  // 同じ画面・種類・文字列・要素は、プロフィール・サイズ・状態が違っても 1 件（distinct）に数える
  interface Distinct {
    id: string;
    kind: AnyKind;
    text: string;
    where: string;
    detail?: string;
    shot?: string;
    /** 延べの画面の数（プロフィール × 状態 × サイズ × スクロール位置） */
    screens: number;
    profiles: Set<string>;
    at: { profile: string; state: string; size: string; scrollY: number }[];
  }
  const distinct = new Map<string, Distinct>();
  const byKind = new Map<AnyKind, { occ: number; distinct: number; profiles: Set<string> }>();
  const bySize = new Map<string, Map<string, number>>();
  const byScreen = new Map<string, Map<string, number>>();
  const byProfile = new Map<string, Map<string, number>>();
  let screenCount = 0;
  let checks = 0;
  const notes: { profile: string; id: string; status: string; note: string }[] = [];
  const failures: string[] = [];
  for (const r of results) {
    for (const e of r.errors.slice(0, 8)) failures.push(`${r.profile}: ${esc(e)}`);
    if (r.errors.length > 8) failures.push(`${r.profile}: ほか ${r.errors.length - 8} 件`);
    for (const s of Object.values(r.screens)) {
      if (s.status === 'ok') {
        screenCount++;
        checks += s.checks;
      } else if (s.status === 'error')
        failures.push(`${r.profile} ${s.state}:${s.id}: ${esc(s.note ?? '')}`);
      else
        notes.push({
          profile: r.profile,
          id: `${s.state}:${s.id}`,
          status: s.status,
          note: s.note ?? '',
        });
      for (const row of s.rows) {
        for (const i of row.issues) {
          const key = `${s.id}|${i.kind}|${i.text}|${i.where}`;
          let d = distinct.get(key);
          const k = byKind.get(i.kind) ?? { occ: 0, distinct: 0, profiles: new Set() };
          k.occ++;
          k.profiles.add(r.profile);
          byKind.set(i.kind, k);
          if (!d) {
            d = {
              id: s.id,
              kind: i.kind,
              text: i.text,
              where: i.where,
              ...(i.detail ? { detail: i.detail } : {}),
              screens: 0,
              profiles: new Set(),
              at: [],
            };
            distinct.set(key, d);
            k.distinct++;
            const sm = byScreen.get(s.id) ?? new Map<string, number>();
            sm.set(i.kind, (sm.get(i.kind) ?? 0) + 1);
            byScreen.set(s.id, sm);
            const pm = byProfile.get(r.profile) ?? new Map<string, number>();
            pm.set(i.kind, (pm.get(i.kind) ?? 0) + 1);
            byProfile.set(r.profile, pm);
          }
          d.profiles.add(r.profile);
          if (i.shot && !d.shot) d.shot = i.shot;
          d.screens++;
          if (d.at.length < 12)
            d.at.push({ profile: r.profile, state: s.state, size: row.size, scrollY: row.scrollY });
          const sz = bySize.get(row.size) ?? new Map<string, number>();
          sz.set(i.kind, (sz.get(i.kind) ?? 0) + 1);
          bySize.set(row.size, sz);
        }
      }
    }
  }

  const kinds = ALL_KINDS.filter((k) => byKind.has(k));
  const cpu = results.reduce((a, r) => a + r.ms, 0);
  const starts = results.map((r) => r.startedAt).filter((x) => x > 0);
  const ends = results.filter((r) => r.startedAt).map((r) => r.startedAt + r.ms);
  const wall = starts.length ? Math.max(...ends) - Math.min(...starts) : 0;
  const all = [...distinct.values()];

  const out: string[] = [];
  out.push('# アプリの画面の配置の検査（app-layout）の要約');
  out.push('');
  out.push(
    `作成: ${new Date().toISOString()} ／ プロフィール ${results.length} ／ 画面 ${screenCount}（プロフィール × 状態 × 画面。fresh = 作ったばかり、full = 中身が多い） ／ 検査 ${checks} 回（画面 × 画面サイズ × スクロールの位置）`,
  );
  out.push(
    `所要（各プロフィールの合計）${fmtMin(cpu)}${wall ? `・経過 ${fmtMin(wall)}（最後に流した分）` : ''}`,
  );
  out.push('');
  out.push(
    '再現: `npm run dev` で `http://127.0.0.1:<port>/?dev-open#/<画面>`（例 `#/explore/p4`、`#/parent/settings`）を開く（`?dev-open` は開発サーバーだけで、起動画面と保護者ゲートを通らずに開く）。画面サイズは下の表の値に合わせる。プロフィールの作り方は `e2e/helpers/app-layout-fixtures.ts`。',
  );
  out.push(
    '件数: 「件」は同じ画面・種類・文字列・要素を 1 件に数えた数（プロフィール・サイズ・状態が違っても 1 件）、「画面」は延べの数。種類のうち edge-margin・missing-illust は参考。',
  );
  out.push('');
  out.push('## 種類別');
  out.push('');
  out.push('| 種類 | | 件 | 画面 | プロフィール |');
  out.push('|---|---|---:|---:|---:|');
  for (const k of kinds) {
    const v = byKind.get(k)!;
    const ref = (APP_REFERENCE_KINDS as readonly string[]).includes(k) ? '（参考）' : '';
    out.push(
      `| ${k} | ${KIND_LABEL[k]}${ref ? '' : ''} | ${v.distinct} | ${v.occ} | ${v.profiles.size} |`,
    );
  }
  if (kinds.length === 0) out.push('| （違反なし） | | 0 | 0 | 0 |');
  out.push('');
  out.push('## 画面サイズ別（画面の延べ数）');
  out.push('');
  out.push(`| 種類 | ${SIZE_ORDER.map((s) => s.replace('x', '×')).join(' | ')} |`);
  out.push(`|---|${SIZE_ORDER.map(() => '---:').join('|')}|`);
  for (const k of kinds)
    out.push(`| ${k} | ${SIZE_ORDER.map((s) => bySize.get(s)?.get(k) ?? 0).join(' | ')} |`);
  out.push('');

  const table = (
    title: string,
    m: Map<string, Map<string, number>>,
    limit: number,
    withName: (id: string) => string,
  ) => {
    out.push(`## ${title}`);
    out.push('');
    out.push('| 名前 | 計 | 内訳 |');
    out.push('|---|---:|---|');
    const rows = [...m.entries()]
      .map(([id, v]) => ({ id, v, sum: [...v.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.sum - a.sum || a.id.localeCompare(b.id));
    for (const r of rows.slice(0, limit)) {
      const parts = [...r.v.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join('、');
      out.push(`| ${withName(r.id)} | ${r.sum} | ${parts} |`);
    }
    if (rows.length === 0) out.push('| （違反なし） | 0 | |');
    out.push('');
  };
  table('画面別（件の多い順。上位 60）', byScreen, 60, (id) => id);
  table('プロフィール別（件の多い順）', byProfile, 30, (id) => {
    const r = results.find((x) => x.profile === id);
    return r ? `${id}（${r.note}）` : id;
  });
  const cleanScreens = new Set<string>();
  const dirtyScreens = new Set(byScreen.keys());
  for (const r of results)
    for (const s of Object.values(r.screens))
      if (s.status === 'ok' && !dirtyScreens.has(s.id)) cleanScreens.add(s.id);
  out.push(`違反のない画面（ID）: ${cleanScreens.size} / ${cleanScreens.size + dirtyScreens.size}`);
  out.push('');

  out.push('## 代表例（種類ごとに 8 件まで。画面が重ならないように選ぶ）');
  out.push('');
  for (const k of kinds) {
    out.push(`### ${k}（${KIND_LABEL[k]}）`);
    out.push('');
    const list = all.filter((d) => d.kind === k);
    const picked: Distinct[] = [];
    const used = new Set<string>();
    for (const d of [...list].sort((a, b) => (b.shot ? 1 : 0) - (a.shot ? 1 : 0))) {
      if (picked.length >= 8) break;
      if (used.has(d.id)) continue;
      used.add(d.id);
      picked.push(d);
    }
    for (const d of picked) {
      const at = d.at[0]!;
      const more = d.screens > 1 ? ` ほか ${d.screens - 1} 画面` : '';
      out.push(
        `- **${d.id}** ${at.profile}・${at.state}・${at.size.replace('x', '×')}${at.scrollY ? `・スクロール ${at.scrollY}px` : ''}${more}: 「${esc(d.text)}」 — \`${esc(d.where)}\`${d.detail ? `（${esc(d.detail)}）` : ''}${d.shot ? ` [画像](${d.shot})` : ''}`,
      );
    }
    out.push('');
  }

  // 教材の題を短くする手がかり（fit-overflow）
  const fit = all.filter((d) => d.kind === 'fit-overflow');
  out.push('## 縮めても札に入らない題の一覧（fit-overflow。教材の題を短くする手がかり）');
  out.push('');
  if (fit.length === 0) out.push('なし。');
  else {
    out.push('| 題 | 画面 | 詳しく | プロフィール |');
    out.push('|---|---|---|---|');
    for (const d of fit.sort((a, b) => a.text.localeCompare(b.text)))
      out.push(
        `| ${esc(d.text)} | ${d.id} | ${esc(d.detail ?? '')} | ${[...d.profiles].join('、')} |`,
      );
  }
  out.push('');

  out.push('## 未対応・飛ばした画面');
  out.push('');
  if (notes.length === 0) out.push('なし。');
  else {
    const grouped = new Map<string, { status: string; note: string; profiles: string[] }>();
    for (const n of notes) {
      const key = `${n.id}|${n.status}`;
      const g = grouped.get(key) ?? { status: n.status, note: n.note, profiles: [] };
      g.profiles.push(n.profile);
      grouped.set(key, g);
    }
    for (const [key, g] of grouped) {
      const id = key.split('|')[0]!;
      out.push(
        `- ${id}: ${g.status === 'unsupported' ? '**未対応**' : '飛ばした'}（${g.profiles.join('、')}）${g.note ? ` — ${esc(g.note)}` : ''}`,
      );
    }
  }
  out.push('');

  out.push('## 検査から除いたもの（理由）');
  out.push('');
  out.push(
    '- 鍵（`.gate-key` 4.5u）: DESINGN.md 2章で、子供が間違えて押さないよう意図して小さい。',
  );
  out.push(
    '- おえかきの「くわしく」の色の札（`.draw-screen--detailed [data-testid^="color-"]` 4.5u）: 19章で意図して小さい。',
  );
  out.push(
    '- 板（ゲート・おえかきの板・確認）の後ろ: 板が出ているときは板の中だけを見る。後ろの画面は板で隠すのが設計。',
  );
  out.push(
    '- 印のある list スクロール（`data-scroll-region="list"`）: スクロールで見るのが設計なので、中の札を 1 つずつ数えない。印が無いときだけ出す。',
  );
  out.push('- text-on-figure: 参考のまま（意図した重ねがある）。');
  out.push('');

  if (failures.length) {
    out.push('## 検査できなかった画面・ページのエラー');
    out.push('');
    for (const f of failures.slice(0, 60)) out.push(`- ${f}`);
    if (failures.length > 60) out.push(`- ほか ${failures.length - 60} 件`);
    out.push('');
  }
  const md = `${out.join('\n')}\n`;

  const report = {
    generatedAt: new Date().toISOString(),
    sizes: SIZE_ORDER,
    totals: { profiles: results.length, screens: screenCount, checks, ms: cpu, wall },
    byKind: Object.fromEntries(
      kinds.map((k) => {
        const v = byKind.get(k)!;
        return [
          k,
          {
            label: KIND_LABEL[k],
            reference: (APP_REFERENCE_KINDS as readonly string[]).includes(k),
            distinct: v.distinct,
            screens: v.occ,
            profiles: v.profiles.size,
          },
        ];
      }),
    ),
    profiles: results.map((r) => ({
      profile: r.profile,
      note: r.note,
      stage: r.stage,
      ms: r.ms,
      errors: r.errors,
      issues: Object.fromEntries(byProfile.get(r.profile) ?? []),
    })),
    screens: Object.fromEntries(
      [...byScreen.entries()].map(([id, m]) => [id, Object.fromEntries(m)]),
    ),
    unsupported: notes.filter((n) => n.status === 'unsupported'),
    // 全件は大きいため、画面 × 種類ごとに画面の多い順に 5 件まで・場所は 3 つまで。全件は .cache/app-layout/*.json にある
    issuesNote: '画面 × 種類ごとに 5 件まで（全件は .cache/app-layout/）',
    issues: (() => {
      const groups = new Map<string, Distinct[]>();
      for (const d of all) {
        const k = `${d.id}|${d.kind}`;
        groups.set(k, [...(groups.get(k) ?? []), d]);
      }
      return [...groups.values()].flatMap((g) =>
        g
          .sort((a, b) => b.screens - a.screens)
          .slice(0, 5)
          .map((d) => ({ ...d, profiles: [...d.profiles], at: d.at.slice(0, 3) })),
      );
    })(),
  };
  const dir = path.join(root, APP_REPORT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), `${JSON.stringify(report)}\n`);
  writeFileSync(path.join(dir, 'summary.md'), md);
  return md;
}

/** globalTeardown: 全体の検査の後に要約を書く。--project=probe だけの実行では書かない */
export default function teardown(): void {
  if (/--project[= ]probe\b/.test(process.argv.join(' '))) return;
  const md = writeSummary(path.resolve(import.meta.dirname, '..', '..'));
  if (md) console.log(`[app-layout] 要約: ${APP_REPORT_DIR}/summary.md`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const md = writeSummary(path.resolve(import.meta.dirname, '..', '..'));
  console.log(md ? `要約を書きました: ${APP_REPORT_DIR}/summary.md` : '結果がありません');
}
