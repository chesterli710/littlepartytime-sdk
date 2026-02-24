import React, { useState, useEffect } from 'react';
import Preview from './pages/Preview';
import Play from './pages/Play';
import Debug from './pages/Debug';
import { captureScreen } from './utils/captureScreen';

type Page = 'preview' | 'play' | 'debug';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const path = window.location.pathname;
    if (path.includes('play')) return 'play';
    if (path.includes('debug')) return 'debug';
    return 'preview';
  });

  // Expose capture API for LLM/Playwright callers:
  //   await page.evaluate(() => window.__devkit__.captureScreen())
  useEffect(() => {
    (window as any).__devkit__ = { captureScreen };
    return () => { delete (window as any).__devkit__; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: '#18181b', borderBottom: '1px solid #27272a', padding: '8px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ color: '#f59e0b', fontWeight: 700, marginRight: 16 }}>LPT Dev Kit</span>
        {(['preview', 'play', 'debug'] as Page[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              if (p === 'preview') {
                setPage(p);
                history.pushState(null, '', `/${p}`);
              } else {
                window.open(
                  p === 'play' ? '/play?auto=true' : `/${p}`,
                  '_blank',
                );
              }
            }}
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
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fetch('http://localhost:4001/api/reset', { method: 'POST' })}
          className="dk-nav-btn"
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            background: '#dc2626',
            color: '#fff',
          }}
        >
          Reset
        </button>
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
