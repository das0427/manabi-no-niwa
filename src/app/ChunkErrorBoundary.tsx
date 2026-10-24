import { Component, type ReactNode } from 'react';
import { Tap } from '../ui/Tap';
import { navigate } from './router';

/**
 * モードの部品が読み込めなかったとき（更新の途中など）の受け皿。
 * 子供には「おうち」だけを出し、保護者向けに再読み込みを案内する（architecture.md 7.1）。
 */
export class ChunkErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('mode load failed', err);
    // 壊れた中断データで「つづきから」が繰り返し失敗しないように消す
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="center-col" data-testid="chunk-error">
        <Tap
          label="おうち"
          icon="home"
          text="おうち"
          onPress={() => navigate({ name: 'home' }, { force: true })}
        />
        <p className="label-text" style={{ fontFamily: 'var(--font-parent)', fontWeight: 400 }}>
          （保護者の方へ）アプリが更新された可能性があります。ページを再読み込みしてください。
        </p>
      </div>
    );
  }
}
