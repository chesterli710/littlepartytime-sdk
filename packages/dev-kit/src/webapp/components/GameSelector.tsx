// packages/dev-kit/src/webapp/components/GameSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';

declare const __SOCKET_PORT__: number;

interface GameInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  minPlayers: number;
  maxPlayers: number;
  active: boolean;
}

interface GameSelectorProps {
  onGameActivated?: () => void;
}

export default function GameSelector({ onGameActivated }: GameSelectorProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `http://${window.location.hostname}:${window.location.port}`;

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/games`);
      const data = await res.json();
      setGames(data.games);
    } catch {
      // ignore fetch errors
    }
  }, [apiBase]);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch(`${apiBase}/api/games/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      await fetchGames();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  }, [apiBase, fetchGames]);

  const activate = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/api/games/${id}/activate`, { method: 'POST' });
      await fetchGames();
      onGameActivated?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [apiBase, fetchGames, onGameActivated]);

  const remove = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/api/games/${id}`, { method: 'DELETE' });
      await fetchGames();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [apiBase, fetchGames]);

  if (games.length === 0 && !uploading) {
    return (
      <div style={{ background: '#18181b', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#71717a', fontSize: 13 }}>No games loaded.</span>
        <label style={{ background: '#d97706', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Upload ZIP
          <input type="file" accept=".zip" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ background: '#18181b', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {games.map((game) => (
          <div
            key={game.id}
            onClick={() => !game.active && activate(game.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 6,
              cursor: game.active ? 'default' : 'pointer',
              border: game.active ? '2px solid #d97706' : '1px solid #3f3f46',
              background: game.active ? 'rgba(217, 119, 6, 0.15)' : '#27272a',
              fontSize: 13,
            }}
          >
            <img
              src={`/api/games/${game.id}/icon`}
              alt=""
              style={{ width: 24, height: 24, borderRadius: 4 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div style={{ color: '#e5e5e5', fontWeight: 600 }}>{game.name}</div>
              <div style={{ color: '#71717a', fontSize: 10 }}>v{game.version} · {game.minPlayers}-{game.maxPlayers}p</div>
            </div>
            {!game.active && (
              <button
                onClick={(e) => { e.stopPropagation(); remove(game.id); }}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                title="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <label style={{
          background: '#3f3f46',
          color: '#d4d4d8',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 13,
          cursor: uploading ? 'default' : 'pointer',
          fontWeight: 600,
          opacity: uploading ? 0.5 : 1,
        }}>
          {uploading ? 'Uploading...' : '+ Upload'}
          <input type="file" accept=".zip" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
