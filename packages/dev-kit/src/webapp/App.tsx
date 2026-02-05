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
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex gap-4">
        <span className="text-amber-500 font-bold mr-4">LPT Dev Kit</span>
        {(['preview', 'play', 'debug'] as Page[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPage(p); history.pushState(null, '', `/${p}`); }}
            className={`px-3 py-1 rounded ${page === p ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 p-4">
        {page === 'preview' && <Preview />}
        {page === 'play' && <Play />}
        {page === 'debug' && <Debug />}
      </main>
    </div>
  );
}
