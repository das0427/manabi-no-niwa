import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { AppStateProvider, useApp } from './app/AppState';
import { Home } from './app/Home';
import { ModeEntry } from './app/ModeEntry';
import { Notebook } from './app/Notebook';
import { navigate, useRoute } from './app/router';
import { StartScreen } from './app/StartScreen';
import './ui/ui.css';

const ParentApp = lazy(() => import('./parent/index'));

function Routes() {
  const route = useRoute();
  const app = useApp();

  // 音声が有効になる前（再読み込み直後など）は、子供画面を起動画面から始める（VO-05）
  const needsStart = route.name !== 'start' && route.name !== 'parent' && !app.started;
  const parentLocked = route.name === 'parent' && !app.parentUnlocked;
  useEffect(() => {
    if (needsStart || parentLocked) navigate({ name: 'start' }, { replace: true, force: true });
  }, [needsStart, parentLocked]);

  // 保護者画面を（どの方法でも）離れたら、ゲートを閉じる。ブラウザの「進む」で戻れないように
  const { parentUnlocked, setParentUnlocked } = app;
  useEffect(() => {
    if (route.name !== 'parent' && parentUnlocked) setParentUnlocked(false);
  }, [route.name, parentUnlocked, setParentUnlocked]);

  if (!app.ready) return null;
  if (route.name === 'parent' && app.parentUnlocked) {
    return (
      <Suspense fallback={null}>
        <ParentApp tab={route.tab} />
      </Suspense>
    );
  }

  let screen = null;
  if (route.name === 'start' || needsStart || parentLocked) screen = <StartScreen />;
  else if (route.name === 'home') screen = <Home />;
  else if (route.name === 'notebook') screen = <Notebook />;
  else if (route.name === 'mode')
    screen = (
      <ModeEntry
        key={`${route.modeId}-${route.variantId ?? ''}`}
        modeId={route.modeId}
        variantId={route.variantId}
      />
    );

  return <div className="stage">{screen}</div>;
}

/** 子供画面での長押しメニュー（Linux のタッチ長押し等）を止める。保護者画面では止めない */
function useNoContextMenu() {
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.parent-root, input, textarea')) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', onMenu);
    return () => document.removeEventListener('contextmenu', onMenu);
  }, []);
}

/** アプリ全体のエラーの受け皿（ホーム等で描画エラーが起きても真っ白にしない） */
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('app error', err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="stage">
        <div className="center-col" data-testid="app-error">
          <button
            type="button"
            className="tap tap--main tap--big"
            onClick={() => {
              location.hash = '#/';
              location.reload();
            }}
          >
            はじめから
          </button>
          <p className="label-text" style={{ fontFamily: 'var(--font-parent)', fontWeight: 400 }}>
            （保護者の方へ）表示に問題が起きました。「はじめから」を押すと読み込み直します。記録は消えません。
          </p>
        </div>
      </div>
    );
  }
}

export function App() {
  useNoContextMenu();
  return (
    <AppErrorBoundary>
      <AppStateProvider>
        <Routes />
      </AppStateProvider>
    </AppErrorBoundary>
  );
}
