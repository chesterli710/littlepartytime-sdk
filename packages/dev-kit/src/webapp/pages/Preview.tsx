import React, { useState, useEffect, useCallback } from 'react';

export default function Preview() {
  const [state, setState] = useState<any>({ phase: 'playing', players: [], data: {} });
  const [stateJson, setStateJson] = useState('');
  const [playerIndex, setPlayerIndex] = useState(0);
  const [actions, setActions] = useState<any[]>([]);
  const [GameRenderer, setGameRenderer] = useState<React.ComponentType<any> | null>(null);

  // Load renderer dynamically
  useEffect(() => {
    import('/src/renderer.tsx').then((mod) => {
      setGameRenderer(() => mod.default || mod.Renderer);
    }).catch((err) => {
      console.error('Failed to load renderer:', err);
    });
  }, []);

  // Mock players
  const mockPlayers = [
    { id: 'player-1', nickname: 'Alice', avatarUrl: null, isHost: true },
    { id: 'player-2', nickname: 'Bob', avatarUrl: null, isHost: false },
    { id: 'player-3', nickname: 'Carol', avatarUrl: null, isHost: false },
  ];

  // Mock platform
  const platform = {
    getPlayers: () => mockPlayers,
    getLocalPlayer: () => mockPlayers[playerIndex],
    send: (action: any) => {
      setActions((prev) => [...prev, { time: new Date().toISOString(), player: mockPlayers[playerIndex].nickname, action }]);
    },
    on: () => {},
    off: () => {},
    reportResult: () => {},
  };

  const updateState = useCallback(() => {
    try {
      const parsed = JSON.parse(stateJson);
      setState(parsed);
    } catch (e) {
      // ignore
    }
  }, [stateJson]);

  useEffect(() => {
    setStateJson(JSON.stringify(state, null, 2));
  }, []);

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      {/* Renderer */}
      <div className="flex-1 bg-zinc-900 rounded-lg overflow-auto">
        {GameRenderer ? (
          <GameRenderer platform={platform} state={state} />
        ) : (
          <div className="p-4 text-zinc-500">Loading renderer...</div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-80 flex flex-col gap-4">
        {/* Player Switcher */}
        <div className="bg-zinc-900 rounded-lg p-3">
          <h3 className="text-sm font-bold text-zinc-400 mb-2">Current Player</h3>
          <select
            value={playerIndex}
            onChange={(e) => setPlayerIndex(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          >
            {mockPlayers.map((p, i) => (
              <option key={p.id} value={i}>{p.nickname}</option>
            ))}
          </select>
        </div>

        {/* State Editor */}
        <div className="bg-zinc-900 rounded-lg p-3 flex-1 flex flex-col">
          <h3 className="text-sm font-bold text-zinc-400 mb-2">Game State</h3>
          <textarea
            value={stateJson}
            onChange={(e) => setStateJson(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded p-2 font-mono text-xs resize-none"
          />
          <button
            onClick={updateState}
            className="mt-2 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-sm"
          >
            Apply State
          </button>
        </div>

        {/* Action Log */}
        <div className="bg-zinc-900 rounded-lg p-3 h-48 overflow-auto">
          <h3 className="text-sm font-bold text-zinc-400 mb-2">Action Log</h3>
          {actions.length === 0 ? (
            <p className="text-zinc-500 text-xs">No actions yet</p>
          ) : (
            <div className="space-y-1">
              {actions.map((a, i) => (
                <div key={i} className="text-xs font-mono bg-zinc-800 rounded p-1">
                  <span className="text-amber-400">{a.player}</span>: {JSON.stringify(a.action)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
