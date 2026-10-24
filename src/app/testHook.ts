/**
 * E2E テスト用の公開（architecture.md 10章）。
 * localStorage['mnw:test'] === '1' のときだけ window.__mnw に置く。通常の利用では何もしない。
 */
declare global {
  interface Window {
    __mnw?: { current?: unknown; history: unknown[] };
  }
}

function enabled(): boolean {
  try {
    return localStorage.getItem('mnw:test') === '1';
  } catch {
    return false;
  }
}

export function exposeForTest(data: unknown): void {
  if (!enabled()) return;
  const w = window;
  w.__mnw ??= { history: [] };
  w.__mnw.current = data;
  w.__mnw.history.push(data);
}
