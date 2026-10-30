/**
 * 文字の配置の検査の結果の形と、要約（JSON と Markdown）を作る処理。
 * 単元ごとの結果（.cache/text-layout/units/*.json）を集めて、docs/screenshots/text-layout-report/ に
 * report.json と summary.md を書く。全体の検査の後に text-layout-teardown.ts から呼ぶ。
 * 要約だけ作り直すとき: npm run check:text-layout:summary
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEXT_ISSUE_KINDS, TEXT_ISSUE_LABEL } from './text-layout';
import type { TextIssue, TextIssueKind } from './text-layout';

/** 開発用の画面が出す情報（src/dev/UnitSampleView.tsx の DevUnitInfo と同じ形） */
declare global {
  interface Window {
    __mnwDevUnit?: {
      unitId: string;
      stage: string;
      kind: string;
      count: number;
      items: { level: number; engine: string; hints: number; identity: string }[];
      ready?: string;
    };
  }
}

export const CACHE_DIR = '.cache/text-layout';
export const REPORT_DIR = 'docs/screenshots/text-layout-report';
/** 画面サイズ（幅 × 高さ）。1280×620 はブラウザの UI で高さが減った場合 */
export const SIZES: [number, number][] = [
  [1280, 720],
  [1920, 1080],
  [1280, 620],
  [1536, 864],
];

export type ReportIssue = TextIssue & { shot?: string };

export interface UnitRow {
  n: number;
  level: number;
  engine: string;
  identity: string;
  /** '1280x720' */
  size: string;
  /** q / h1〜h3 / explain */
  state: string;
  issues: ReportIssue[];
}

export interface UnitResult {
  unitId: string;
  pack: string;
  stage: string;
  engine: string;
  seeds: number;
  maxItems: number;
  /** 見本の問題の数 */
  total: number;
  /** 検査した問題の数 */
  checked: number;
  /** 上限で間引いた */
  capped?: boolean;
  /** 検査した画面の数（問題 × 状態 × サイズ） */
  screens: number;
  startedAt?: number;
  ms: number;
  errors: string[];
  fatal?: string;
  rows: UnitRow[];
}

const STATE_LABEL: Record<string, string> = {
  q: '問題',
  h1: 'ヒント①',
  h2: 'ヒント②',
  h3: 'ヒント③',
  explain: '解説',
};

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function fmtMin(ms: number): string {
  const m = ms / 60000;
  return m >= 60 ? `${(m / 60).toFixed(1)} 時間` : `${m.toFixed(1)} 分`;
}

/** 要約を書く。戻り値は Markdown の本文 */
export function writeSummary(root: string): string | null {
  const unitsDir = path.join(root, CACHE_DIR, 'units');
  if (!existsSync(unitsDir)) return null;
  const results: UnitResult[] = readdirSync(unitsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(unitsDir, f), 'utf8')) as UnitResult)
    .sort((a, b) => a.unitId.localeCompare(b.unitId));
  if (results.length === 0) return null;

  // 同じ違反（単元・種類・文字列・要素）は、問題の番号・サイズ・状態が違っても1件（distinct）に数える
  interface Distinct {
    unitId: string;
    kind: TextIssueKind;
    text: string;
    where: string;
    detail?: string;
    shot?: string;
    /** 延べの画面の数 */
    screens: number;
    at: { n: number; size: string; state: string }[];
  }
  const distinct = new Map<string, Distinct>();
  const byKind = new Map<string, { occ: number; distinct: number; units: Set<string> }>();
  const bySize = new Map<string, Map<string, number>>();
  const byState = new Map<string, Map<string, number>>();
  const byUnit = new Map<string, Map<string, number>>();
  for (const r of results) {
    for (const row of r.rows) {
      for (const i of row.issues) {
        const key = `${r.unitId}|${i.kind}|${i.text}|${i.where}`;
        let d = distinct.get(key);
        const k = byKind.get(i.kind) ?? { occ: 0, distinct: 0, units: new Set() };
        k.occ++;
        k.units.add(r.unitId);
        byKind.set(i.kind, k);
        if (!d) {
          d = {
            unitId: r.unitId,
            kind: i.kind,
            text: i.text,
            where: i.where,
            ...(i.detail ? { detail: i.detail } : {}),
            screens: 0,
            at: [],
          };
          distinct.set(key, d);
          k.distinct++;
          const u = byUnit.get(r.unitId) ?? new Map<string, number>();
          u.set(i.kind, (u.get(i.kind) ?? 0) + 1);
          byUnit.set(r.unitId, u);
        }
        if (i.shot && !d.shot) d.shot = i.shot;
        d.screens++;
        if (d.at.length < 12) d.at.push({ n: row.n, size: row.size, state: row.state });
        const s = bySize.get(row.size) ?? new Map<string, number>();
        s.set(i.kind, (s.get(i.kind) ?? 0) + 1);
        bySize.set(row.size, s);
        const st = byState.get(row.state) ?? new Map<string, number>();
        st.set(i.kind, (st.get(i.kind) ?? 0) + 1);
        byState.set(row.state, st);
      }
    }
  }

  const kinds = TEXT_ISSUE_KINDS.filter((k) => byKind.has(k));
  const screens = results.reduce((a, r) => a + r.screens, 0);
  const checked = results.reduce((a, r) => a + r.checked, 0);
  const total = results.reduce((a, r) => a + r.total, 0);
  const cpu = results.reduce((a, r) => a + r.ms, 0);
  const starts = results.map((r) => r.startedAt ?? 0).filter((x) => x > 0);
  const ends = results.filter((r) => r.startedAt).map((r) => r.startedAt! + r.ms);
  const wall = starts.length ? Math.max(...ends) - Math.min(...starts) : 0;
  const capped = results.filter((r) => r.capped);
  const failed = results.filter((r) => r.fatal || r.errors.length);

  const out: string[] = [];
  out.push('# 文字の配置の検査（text-layout）の要約');
  out.push('');
  out.push(
    `作成: ${new Date().toISOString()} ／ 単元 ${results.length} ／ 問題 ${checked}（見本 ${total} 問中） ／ 画面 ${screens}（問題 × 状態 × 画面サイズ）`,
  );
  out.push(
    `seed: ${[...new Set(results.map((r) => r.seeds))].join(', ')} ／ 問題数の上限: ${[...new Set(results.map((r) => r.maxItems || 'なし'))].join(', ')} ／ 所要（各単元の合計）${fmtMin(cpu)}${wall ? `・経過 ${fmtMin(wall)}（最後に流した分）` : ''}`,
  );
  out.push('');
  out.push(
    '再現: `npm run dev` で `#/dev/unit/<単元ID>/<n>?seeds=2&state=h2` を開く（state: q / h1〜h3 / explain）。画面サイズは下の表の値に合わせる。',
  );
  out.push(
    '件数: 「件」は同じ単元・種類・文字列・要素を1件に数えた数（問題の番号・サイズ・状態が違っても1件）、「画面」は延べの数。',
  );
  out.push('');
  out.push('## 種類別');
  out.push('');
  out.push('| 種類 | | 件 | 画面 | 単元 |');
  out.push('|---|---|---:|---:|---:|');
  for (const k of kinds) {
    const v = byKind.get(k)!;
    out.push(`| ${k} | ${TEXT_ISSUE_LABEL[k]} | ${v.distinct} | ${v.occ} | ${v.units.size} |`);
  }
  if (kinds.length === 0) out.push('| （違反なし） | | 0 | 0 | 0 |');
  out.push('');
  out.push('## 画面サイズ別（画面の延べ数）');
  out.push('');
  out.push(`| 種類 | ${SIZES.map(([w, h]) => `${w}×${h}`).join(' | ')} |`);
  out.push(`|---|${SIZES.map(() => '---:').join('|')}|`);
  for (const k of kinds)
    out.push(
      `| ${k} | ${SIZES.map(([w, h]) => bySize.get(`${w}x${h}`)?.get(k) ?? 0).join(' | ')} |`,
    );
  out.push('');
  out.push('## 状態別（画面の延べ数）');
  out.push('');
  const states = ['q', 'h1', 'h2', 'h3', 'explain'];
  out.push(`| 種類 | ${states.map((s) => STATE_LABEL[s]).join(' | ')} |`);
  out.push(`|---|${states.map(() => '---:').join('|')}|`);
  for (const k of kinds)
    out.push(`| ${k} | ${states.map((s) => byState.get(s)?.get(k) ?? 0).join(' | ')} |`);
  out.push('');

  out.push('## 単元別（件の多い順。上位 60）');
  out.push('');
  out.push('| 単元 | エンジン | 問題 | 計 | 内訳 |');
  out.push('|---|---|---:|---:|---|');
  const unitRows = [...byUnit.entries()]
    .map(([id, m]) => ({ id, m, sum: [...m.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.sum - a.sum);
  for (const r of unitRows.slice(0, 60)) {
    const res = results.find((x) => x.unitId === r.id)!;
    const parts = [...r.m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join('、');
    out.push(`| ${r.id} | ${res.engine} | ${res.checked} | ${r.sum} | ${parts} |`);
  }
  const clean = results.filter((r) => !byUnit.has(r.unitId) && !r.fatal).length;
  out.push('');
  out.push(`違反のない単元: ${clean} / ${results.length}`);
  out.push('');

  out.push('## 代表例（種類ごとに 8 件まで。単元が重ならないように選ぶ）');
  out.push('');
  const all = [...distinct.values()];
  for (const k of kinds) {
    out.push(`### ${k}（${TEXT_ISSUE_LABEL[k]}）`);
    out.push('');
    const list = all.filter((d) => d.kind === k);
    const picked: Distinct[] = [];
    const usedUnits = new Set<string>();
    for (const d of [...list].sort((a, b) => (b.shot ? 1 : 0) - (a.shot ? 1 : 0))) {
      if (picked.length >= 8) break;
      if (usedUnits.has(d.unitId)) continue;
      usedUnits.add(d.unitId);
      picked.push(d);
    }
    for (const d of picked) {
      const at = d.at[0]!;
      const more = d.screens > 1 ? ` ほか ${d.screens - 1} 画面` : '';
      out.push(
        `- **${d.unitId}** n=${at.n}・${at.size.replace('x', '×')}・${STATE_LABEL[at.state] ?? at.state}${more}: 「${esc(d.text)}」 — \`${esc(d.where)}\`${d.detail ? `（${esc(d.detail)}）` : ''}${d.shot ? ` [画像](${d.shot})` : ''}`,
      );
    }
    out.push('');
  }

  if (capped.length) {
    out.push('## 問題数の上限で間引いた単元');
    out.push('');
    for (const r of capped) out.push(`- ${r.unitId}: ${r.checked} / ${r.total} 問`);
    out.push('');
  }
  if (failed.length) {
    out.push('## 検査できなかった問題・ページのエラー');
    out.push('');
    for (const r of failed) {
      if (r.fatal) out.push(`- ${r.unitId}: ${esc(r.fatal)}`);
      for (const e of r.errors.slice(0, 5)) out.push(`- ${r.unitId}: ${esc(e)}`);
      if (r.errors.length > 5) out.push(`- ${r.unitId}: ほか ${r.errors.length - 5} 件`);
    }
    out.push('');
  }
  const md = `${out.join('\n')}\n`;

  const report = {
    generatedAt: new Date().toISOString(),
    sizes: SIZES.map(([w, h]) => `${w}x${h}`),
    totals: { units: results.length, items: checked, sampleItems: total, screens, ms: cpu, wall },
    byKind: Object.fromEntries(
      kinds.map((k) => {
        const v = byKind.get(k)!;
        return [
          k,
          { label: TEXT_ISSUE_LABEL[k], distinct: v.distinct, screens: v.occ, units: v.units.size },
        ];
      }),
    ),
    units: results.map((r) => ({
      unitId: r.unitId,
      pack: r.pack,
      stage: r.stage,
      engine: r.engine,
      seeds: r.seeds,
      total: r.total,
      checked: r.checked,
      capped: !!r.capped,
      screens: r.screens,
      ms: r.ms,
      ...(r.fatal ? { fatal: r.fatal } : {}),
      errors: r.errors,
      issues: Object.fromEntries(byUnit.get(r.unitId) ?? []),
    })),
    // 全件は大きすぎる（数十 MB）ため、単元 × 種類ごとに画面の多い順に 5 件まで・場所は 3 つまで。
    // 全件は .cache/text-layout/units/*.json にある
    issuesNote: '単元 × 種類ごとに 5 件まで（全件は .cache/text-layout/units/）',
    issues: (() => {
      const groups = new Map<string, Distinct[]>();
      for (const d of all) {
        const k = `${d.unitId}|${d.kind}`;
        groups.set(k, [...(groups.get(k) ?? []), d]);
      }
      return [...groups.values()].flatMap((g) =>
        g
          .sort((a, b) => b.screens - a.screens)
          .slice(0, 5)
          .map((d) => ({ ...d, at: d.at.slice(0, 3) })),
      );
    })(),
  };
  const dir = path.join(root, REPORT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), `${JSON.stringify(report)}\n`);
  writeFileSync(path.join(dir, 'summary.md'), md);
  return md;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const md = writeSummary(path.resolve(import.meta.dirname, '..', '..'));
  console.log(md ? `要約を書きました: ${REPORT_DIR}/summary.md` : '結果がありません');
}
