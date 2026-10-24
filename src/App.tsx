import { lazy, Suspense, useEffect } from 'react';
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

export function App() {
  return (
    <AppStateProvider>
      <Routes />
    </AppStateProvider>
  );
}
