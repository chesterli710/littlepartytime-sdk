import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PhoneFrame from '../components/PhoneFrame';

const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

export default function Preview() {
  const [playerCount, setPlayerCount] = useState(3);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [actions, setActions] = useState<any[]>([]);
  const [GameRenderer, setGameRenderer] = useState<React.ComponentType<any> | null>(null);
  const [engine, setEngine] = useState<any>(null);
  const [fullState, setFullState] = useState<any>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [stateJson, setStateJson] = useState('');

  // Refs to avoid recreating platform on every state change
  const fullStateRef = useRef(fullState);
  fullStateRef.current = fullState;
  const playerIndexRef = useRef(playerIndex);
  playerIndexRef.current = playerIndex;
  const stateUpdateListeners = useRef<Set<(...args: unknown[]) => void>>(new Set());

  // Generate mock players
  const mockPlayers = useMemo(() => {
    return Array.from({ length: playerCount }, (_, i) => ({
      id: `player-${i + 1}`,
      nickname: PLAYER_NAMES[i] || `Player ${i + 1}`,
      avatarUrl: null,
      isHost: i === 0,
    }));
  }, [playerCount]);

  const mockPlayersRef = useRef(mockPlayers);
  mockPlayersRef.current = mockPlayers;

  // Load renderer and engine dynamically
  useEffect(() => {
    import('/src/index.ts').then((mod) => {
      setGameRenderer(() => mod.Renderer || mod.default);
      if (mod.engine) {
        setEngine(mod.engine);
      }
    }).catch((err) => {
      console.error('Failed to load game module:', err);
      // Fallback: try loading renderer directly
      import('/src/renderer.tsx').then((mod) => {
        setGameRenderer(() => mod.default || mod.Renderer);
      }).catch((err2) => {
        console.error('Failed to load renderer:', err2);
      });
    });
  }, []);

  // Initialize game when engine loads or player count changes
  useEffect(() => {
    if (!engine) return;
    const initialState = engine.init(mockPlayers);
    setFullState(initialState);
    setGameOver(false);
    setGameResult(null);
    setActions([]);
  }, [engine, mockPlayers]);

  // Compute view state whenever fullState or playerIndex changes
  useEffect(() => {
    if (!engine || !fullState) return;
    const view = engine.getPlayerView(fullState, mockPlayers[playerIndex].id);
    setViewState(view);
    // Notify renderer of new view
    stateUpdateListeners.current.forEach(handler => handler(view));
  }, [fullState, playerIndex, engine, mockPlayers]);

  // Sync state JSON editor
  useEffect(() => {
    if (fullState) {
      setStateJson(JSON.stringify(fullState, null, 2));
    }
  }, [fullState]);

  // Platform object — stable reference via useMemo on engine + mockPlayers
  const platform = useMemo(() => {
    if (!engine) return null;
    return {
      getPlayers: () => mockPlayersRef.current,
      getLocalPlayer: () => mockPlayersRef.current[playerIndexRef.current],
      send: (action: any) => {
        const currentState = fullStateRef.current;
        if (!currentState) return;

        const playerId = mockPlayersRef.current[playerIndexRef.current].id;

        // Log the action
        setActions(prev => [...prev, {
          time: new Date().toISOString(),
          player: mockPlayersRef.current[playerIndexRef.current].nickname,
          action,
        }]);

        // Run through engine
        const newState = engine.handleAction(currentState, playerId, action);
        setFullState(newState);

        // Check game over
        if (engine.isGameOver(newState)) {
          setGameOver(true);
          setGameResult(engine.getResult(newState));
        }
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'stateUpdate') {
          stateUpdateListeners.current.add(handler);
        }
      },
      off: (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'stateUpdate') {
          stateUpdateListeners.current.delete(handler);
        }
      },
      reportResult: (result: any) => {
        console.log('Game result reported:', result);
      },
      getAssetUrl: (assetPath: string) => `/assets/${assetPath}`,
    };
  }, [engine]);

  // Apply manual state override from JSON editor
  const applyState = useCallback(() => {
    try {
      const parsed = JSON.parse(stateJson);
      setFullState(parsed);
      if (engine) {
        setGameOver(engine.isGameOver(parsed));
        if (engine.isGameOver(parsed)) {
          setGameResult(engine.getResult(parsed));
        } else {
          setGameResult(null);
        }
      }
    } catch (e) {
      // ignore invalid JSON
    }
  }, [stateJson, engine]);

  // Reset game
  const resetGame = useCallback(() => {
    if (!engine) return;
    const newState = engine.init(mockPlayersRef.current);
    setFullState(newState);
    setGameOver(false);
    setGameResult(null);
    setActions([]);
  }, [engine]);

  // Clamp playerIndex when playerCount decreases
  useEffect(() => {
    if (playerIndex >= playerCount) {
      setPlayerIndex(0);
    }
  }, [playerCount, playerIndex]);

  // Resizable split panel
  const [splitRatio, setSplitRatio] = useState(0.6); // left column gets 60%
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.8, Math.max(0.2, ratio)));
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      {/* Renderer — half the screen width */}
      <div className="h-full" style={{ width: '50%' }}>
        <PhoneFrame>
          {GameRenderer && platform && viewState ? (
            <GameRenderer platform={platform} state={viewState} />
          ) : (
            <div className="p-4 text-zinc-500">
              {!engine ? 'Loading engine...' : 'Initializing game...'}
            </div>
          )}
        </PhoneFrame>
      </div>

      {/* Control Panel — fills remaining width, resizable two-column */}
      <div ref={panelRef} className="flex-1 min-w-0 flex h-full">
        {/* Left column: Players & Controls */}
        <div className="flex flex-col gap-4 overflow-auto pr-1" style={{ width: `${splitRatio * 100}%` }}>
          {/* Player Count */}
          <div className="bg-zinc-900 rounded-lg p-3">
            <h3 className="text-sm font-bold text-zinc-400 mb-2">Player Count</h3>
            <input
              type="number"
              min={2}
              max={32}
              value={playerCount}
              onChange={(e) => setPlayerCount(Math.max(2, Math.min(32, Number(e.target.value))))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Player Switcher */}
          <div className="bg-zinc-900 rounded-lg p-3 flex-1 overflow-auto">
            <h3 className="text-sm font-bold text-zinc-400 mb-2">Current Player</h3>
            <div className="space-y-1">
              {mockPlayers.map((p, i) => {
                const isActive = i === playerIndex;
                const hue = (i * 137) % 360; // deterministic color per player
                const playerState = fullState?.players?.find((ps: any) => ps.id === p.id);
                // Fallback chain: 1) PlayerState field  2) GameState.data mapping table
                const ROLE_KEYS = ['role', 'character', 'team', 'class', 'job', 'faction', 'type'];
                const DATA_MAP_KEYS = ['playerRoles', 'roles', 'playerCharacters', 'characters', 'playerTeams', 'teams'];
                let roleLabel: string | undefined;
                // Try PlayerState direct field
                if (playerState) {
                  const entry = Object.entries(playerState).find(([k]) => ROLE_KEYS.includes(k.toLowerCase()));
                  if (entry) roleLabel = String(entry[1]);
                }
                // Try GameState.data lookup table
                if (!roleLabel && fullState?.data) {
                  for (const mapKey of DATA_MAP_KEYS) {
                    const map = fullState.data[mapKey];
                    if (map && typeof map === 'object' && !Array.isArray(map)) {
                      const val = (map as Record<string, unknown>)[p.id];
                      if (val != null) { roleLabel = String(val); break; }
                    }
                  }
                }
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlayerIndex(i)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                      isActive
                        ? 'bg-amber-600/20 ring-1 ring-amber-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `hsl(${hue}, 55%, 45%)` }}
                    >
                      {p.nickname[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{p.nickname}</span>
                        {p.isHost && (
                          <span className="text-[10px] text-amber-400 shrink-0">HOST</span>
                        )}
                      </div>
                      {roleLabel && (
                        <div className="text-[10px] text-zinc-500 truncate">
                          {roleLabel}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game Result */}
          {gameOver && gameResult && (
            <div className="bg-zinc-900 rounded-lg p-3">
              <h3 className="text-sm font-bold text-green-400 mb-2">Game Over</h3>
              <pre className="text-xs font-mono bg-zinc-800 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(gameResult, null, 2)}
              </pre>
              <button
                onClick={resetGame}
                className="mt-2 w-full bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-sm"
              >
                Reset Game
              </button>
            </div>
          )}

          {/* Reset button (when game is not over) */}
          {!gameOver && engine && (
            <div className="bg-zinc-900 rounded-lg p-3">
              <button
                onClick={resetGame}
                className="w-full bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded text-sm"
              >
                Reset Game
              </button>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          className="shrink-0 w-2 cursor-col-resize flex items-center justify-center group"
          onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        >
          <div className="w-0.5 h-8 bg-zinc-700 rounded group-hover:bg-zinc-500 transition-colors" />
        </div>

        {/* Right column: State & Logs */}
        <div className="flex flex-col gap-4 overflow-auto pl-1" style={{ width: `${(1 - splitRatio) * 100}%` }}>
          {/* State Editor */}
          <div className="bg-zinc-900 rounded-lg p-3 flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-bold text-zinc-400 mb-2">Game State (Full)</h3>
            <textarea
              value={stateJson}
              onChange={(e) => setStateJson(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded p-2 font-mono text-xs resize-none min-h-[120px]"
            />
            <button
              onClick={applyState}
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
    </div>
  );
}
