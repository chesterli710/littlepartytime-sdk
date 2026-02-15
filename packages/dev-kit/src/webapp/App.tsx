import React, { useState } from 'react';
import Preview from './pages/Preview';
import Play from './pages/Play';
import Debug from './pages/Debug';

type Page = 'preview' | 'play' | 'debug';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const path = window.location.pathname;
    if (path.includes('play')) return 'play';
    if (path.includes('debug')) return 'debug';
    return 'preview';
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: '#18181b', borderBottom: '1px solid #27272a', padding: '8px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ color: '#f59e0b', fontWeight: 700, marginRight: 16 }}>LPT Dev Kit</span>
        {(['preview', 'play', 'debug'] as Page[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPage(p); history.pushState(null, '', `/${p}`); }}
            className="dk-nav-btn"
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              ...(page === p
                ? { background: '#d97706', color: '#fff' }
                : { background: 'transparent', color: '#a1a1aa' }),
            }}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 16 }}>
        {page === 'preview' && <Preview />}
        {page === 'play' && <Play />}
        {page === 'debug' && <Debug />}
      </main>
    </div>
  );
}
