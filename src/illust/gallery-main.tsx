/**
 * 開発用のイラスト一覧（/gallery.html）。本番ビルドには含めない。
 * 画風の一貫性を目視で確認するため、全点を同じ大きさで並べ、小さい表示（ホームの札程度）も並べる。
 * ?group=food のように絞り込める。
 */
import { createRoot } from 'react-dom/client';
import { ILLUST_GROUPS } from './registry';
import { Illust } from './Illust';
import '../styles/base.css';

function Gallery() {
  const only = new URLSearchParams(location.search).get('group');
  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100vh', fontFamily: 'sans-serif' }}>
      {Object.entries(ILLUST_GROUPS)
        .filter(([g]) => !only || g === only)
        .map(([g, defs]) => (
          <section key={g}>
            <h2 style={{ margin: '16px 0 8px' }}>
              {g}（{Object.keys(defs).length}）
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Object.values(defs).map((d) => (
                <figure
                  key={d.id}
                  style={{
                    margin: 0,
                    width: 150,
                    background: '#fffdf8',
                    border: '1px solid #ddd',
                    padding: 6,
                    textAlign: 'center',
                  }}
                >
                  <Illust id={d.id} style={{ width: 136, height: 136 }} />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                    <Illust id={d.id} style={{ width: 48, height: 48 }} decorative />
                    <Illust id={d.id} style={{ width: 28, height: 28 }} decorative />
                  </div>
                  <figcaption style={{ fontSize: 13 }}>
                    {d.label}
                    <br />
                    <code>{d.id}</code> {d.status === 'draft' ? '［draft］' : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Gallery />);
