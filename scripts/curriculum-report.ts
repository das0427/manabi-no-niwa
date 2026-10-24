/**
 * 単元の充足の報告（acceptance.md A-02・A-03、curriculum-matrix 1.5）。npm run curriculum:report
 *   - P1 の一覧は curriculum-matrix.md の表から読む（凍結した版。progress.md）
 *   - 実装した単元は各パックから読み、qa.ts の checkUnit で検査（誤り・Q・C・汎用誤答の割合）
 *   - 音声: 単元の文の部品（speech.ts）の mp3 がそろっているか（public/audio/<packId>/, public/audio/num/）
 *   - 「実装済み」= 検査の誤りなし・Q≥1・C 全部・汎用誤答 ≤20%・音声がそろう（v1 のモードの単元は v1 の音声）
 * 出力: docs/expansion/curriculum-report.md（学年×教科の表と単元ごとの行）。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkUnit, isReady } from '../src/curriculum/qa';
import type { PackContent, UnitSpec } from '../src/curriculum/types';
import { speechParts } from '../src/voice/speech';
import { unitTexts } from './export-pack-voice';

const root = join(import.meta.dirname, '..');

interface MatrixRow {
  id: string;
  priority: 'P1' | 'P2' | '外';
}

export function readMatrix(md: string): MatrixRow[] {
  const out: MatrixRow[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\| ((?:p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+) \|/.exec(line);
    if (!m) continue;
    const cells = line.split('|').map((c) => c.trim());
    const pri = cells.find((c) => c === 'P1' || c === 'P2' || c === '外');
    if (pri) out.push({ id: m[1]!, priority: pri as MatrixRow['priority'] });
  }
  return out;
}

function voiceCoverage(packId: string, unit: UnitSpec): { have: number; total: number } {
  if (unit.source.kind === 'legacy') return { have: 1, total: 1 };
  const keys = new Set<string>();
  for (const t of unitTexts(unit, 50)) for (const p of speechParts(packId, t)) keys.add(p.key);
  let have = 0;
  for (const k of keys) if (existsSync(join(root, 'public', 'audio', `${k}.mp3`))) have++;
  return { have, total: keys.size };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const matrix = readMatrix(
    readFileSync(join(root, 'docs', 'expansion', 'curriculum-matrix.md'), 'utf8'),
  );
  const packsDir = join(root, 'src', 'packs');
  const impl = new Map<string, { pack: string; unit: UnitSpec }>();
  for (const d of readdirSync(packsDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('_')) continue;
    const mod = (await import(pathToFileURL(join(packsDir, d.name, 'index.ts')).href)) as {
      default: PackContent;
    };
    for (const u of mod.default.units) impl.set(u.id, { pack: d.name, unit: u });
  }
  const rows: string[] = [];
  const cell = new Map<string, { p1: number; ready: number; partial: number }>();
  let p1 = 0;
  let ready = 0;
  for (const r of matrix) {
    const key = r.id.split('.').slice(0, 2).join('.');
    const c = cell.get(key) ?? { p1: 0, ready: 0, partial: 0 };
    const hit = impl.get(r.id);
    let state = '未実装';
    let detail = '';
    if (hit) {
      const rep = checkUnit(hit.unit);
      const v = voiceCoverage(hit.pack, hit.unit);
      const voiceOk = v.total > 0 && v.have === v.total;
      const ok = isReady(rep) && voiceOk;
      state = ok ? '実装済み' : '試作';
      detail = `Q ${rep.q.toFixed(2)} / C ${rep.c[0]}/${rep.c[1]} / 誤り ${rep.errors.length} / 汎用誤答 ${(rep.genericWrongShare * 100).toFixed(0)}% / 音声 ${v.have}/${v.total}`;
      if (r.priority === 'P1') {
        if (ok) c.ready++;
        else c.partial++;
      }
    }
    if (r.priority === 'P1') {
      c.p1++;
      p1++;
      if (state === '実装済み') ready++;
    }
    cell.set(key, c);
    rows.push(`| ${r.id} | ${r.priority} | ${state} | ${detail} |`);
  }
  const stages = ['p23', 'p4', 'p5', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  const subjects = ['ja', 'math', 'think', 'env', 'hand', 'life', 'sci', 'soc', 'en', 'prog'];
  const head = `| 段階 | ${subjects.join(' | ')} |\n|---|${subjects.map(() => '---').join('|')}|`;
  const grid = stages
    .map((st) => {
      const cols = subjects.map((s) => {
        const c = cell.get(`${st}.${s}`);
        return c ? `${c.ready}/${c.p1}${c.partial ? `（試作${c.partial}）` : ''}` : '−';
      });
      return `| ${st} | ${cols.join(' | ')} |`;
    })
    .join('\n');
  const md = `# 単元の充足の報告（自動生成: npm run curriculum:report）

P1 実装済み **${ready} / ${p1}**（${((ready / p1) * 100).toFixed(1)}%）。表の値は「実装済み／P1 の数」。
実装済み = 検査の誤りなし・量 Q≥1・網羅 C 全部・汎用誤答 20%以下・音声がそろう（acceptance.md 2章、curriculum-matrix 1.1）。
検査の seed 数は 1000（CI の qa テストと同じ）。

${head}
${grid}

## 単元ごと

| 単元 | 優先 | 状態 | 値 |
|---|---|---|---|
${rows.join('\n')}
`;
  writeFileSync(join(root, 'docs', 'expansion', 'curriculum-report.md'), md);
  console.log(`P1 実装済み ${ready}/${p1}`);
}
