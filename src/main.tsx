import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { App } from './App';
import { RetiredScreen } from './app/RetiredScreen';
import { audio } from './core/audio/index';
import { claimInstance } from './core/instance/instance';
import { startOffline } from './core/offline/index';
import { waitPendingWrites } from './core/pendingWrites';
import { armStartFullscreen } from './ui/fullscreen';

/**
 * 起動。最初に「画面は1つ」の役割を決める（docs/expansion/single-instance-design.md）。
 * Service Worker の登録・IndexedDB・描画は、書く画面（primary）になってから始める。
 * 引き継ぎで始まった画面は、前の画面の保存が終わるのを待ってからここへ来る。
 */
async function boot(): Promise<void> {
  const claim = await claimInstance();
  // 始める前にさらに新しい画面に奪われた。この画面は始めずに閉じる
  if (claim.role === 'superseded') return;

  const root = createRoot(document.getElementById('root')!);

  // 閉じきれなかった前の画面。「べつの まどで ひらいています」だけを出す
  if (claim.role === 'retired') {
    root.render(
      <StrictMode>
        <RetiredScreen />
      </StrictMode>,
    );
    return;
  }

  // 引き継ぎで始まった画面だけ、最初の「はじめる」で全画面にする（docs/expansion/single-instance-design.md）
  armStartFullscreen(claim.role === 'primary' && claim.takeover);
  startOffline();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // 鍵を奪われたら、音を止めて画面を片付ける（おえかきの保存などの後片付けが走る）。
  // 終わっていない保存（おえかきの自動保存など）が全部終わるまで待ってから、「終わった」を知らせる
  if (claim.role === 'primary') {
    claim.onRetire(async () => {
      audio.stop();
      root.unmount();
      // 後片付け（useEffect の片付け）が動いて、保存が登録されるのを待つ
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await waitPendingWrites();
    });
  }
}

void boot();
