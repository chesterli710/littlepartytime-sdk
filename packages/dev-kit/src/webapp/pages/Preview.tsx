import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PhoneFrame from '../components/PhoneFrame';

const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

/* ── shared inline-style helpers ── */
const card: React.CSSProperties = { background: '#18181b', borderRadius: 8, padding: 12 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#a1a1aa', marginBottom: 8 };
const inputBase: React.CSSProperties = { width: '100%', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: '4px 8px', fontSize: 13, color: '#e5e5e5' };
const btnAmber: React.CSSProperties = { background: '#d97706', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer' };
const btnZinc: React.CSSProperties = { background: '#3f3f46', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer', width: '100%' };

export default function Preview() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [actions, setActions] = useState<any[]>([]);
  const [GameRenderer, setGameRenderer] = useState<React.ComponentType<any> | null>(null);
  const [engine, setEngine] = useState<any>(null);
  const [config, setConfig] = useState<{ minPlayers?: number; maxPlayers?: number } | null>(null);
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
    if (playerCount === null) return [];
    return Array.from({ length: playerCount }, (_, i) => ({
      id: `player-${i + 1}`,
      nickname: PLAYER_NAMES[i] || `Player ${i + 1}`,
      avatarUrl: null,
      isHost: i === 0,
    }));
  }, [playerCount]);

  const mockPlayersRef = useRef(mockPlayers);
  mockPlayersRef.current = mockPlayers;

  const minPlayers = config?.minPlayers ?? 2;
  const maxPlayers = config?.maxPlayers ?? 32;

  // Load renderer, engine, and config dynamically
  useEffect(() => {
    import('/src/index.ts').then((mod) => {
      setGameRenderer(() => mod.Renderer || mod.default);
      if (mod.engine) {
        setEngine(mod.engine);
      }
      if (mod.config) {
        setConfig(mod.config);
        setPlayerCount(mod.config.minPlayers ?? 3);
      } else {
        setPlayerCount(3);
      }
    }).catch((err) => {
      console.error('Failed to load game module:', err);
      setPlayerCount(3);
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
    if (!engine || mockPlayers.length === 0) return;
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
      getDeviceCapabilities: () => ({ haptics: false, motion: false }),
      haptic: () => {},
      onShake: () => () => {},
      onTilt: () => () => {},
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
    if (playerCount !== null && playerIndex >= playerCount) {
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
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 80px)' }}>
      {/* Renderer — half the screen width */}
      <div style={{ width: '50%', height: '100%' }}>
        <PhoneFrame>
          {GameRenderer && platform && viewState ? (
            <GameRenderer key={mockPlayers[playerIndex].id} platform={platform} state={viewState} />
          ) : (
            <div style={{ padding: 16, color: '#71717a' }}>
              {!engine ? 'Loading engine...' : 'Initializing game...'}
            </div>
          )}
        </PhoneFrame>
      </div>

      {/* Control Panel — fills remaining width, resizable two-column */}
      <div ref={panelRef} style={{ flex: 1, minWidth: 0, display: 'flex', height: '100%' }}>
        {/* Left column: Players & Controls */}
        <div style={{ width: `${splitRatio * 100}%`, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', paddingRight: 4 }}>
          {/* Player Count */}
          <div style={card}>
            <h3 style={label}>Player Count</h3>
            <input
              type="number"
              min={minPlayers}
              max={maxPlayers}
              value={playerCount ?? ''}
              onChange={(e) => setPlayerCount(Math.max(minPlayers, Math.min(maxPlayers, Number(e.target.value))))}
              className="dk-input"
              style={inputBase}
            />
          </div>

          {/* Player Switcher */}
          <div style={{ ...card, flex: 1, overflow: 'auto' }}>
            <h3 style={label}>Current Player</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    className={isActive ? '' : 'dk-player-btn'}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 13,
                      textAlign: 'left' as const,
                      border: 'none',
                      cursor: 'pointer',
                      ...(isActive
                        ? { background: 'rgba(217, 119, 6, 0.2)', boxShadow: 'inset 0 0 0 1px #f59e0b', color: '#fff' }
                        : { background: '#27272a', color: '#d4d4d8' }),
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        background: `hsl(${hue}, 55%, 45%)`,
                      }}
                    >
                      {p.nickname[0]}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nickname}</span>
                        {p.isHost && (
                          <span style={{ fontSize: 10, color: '#fbbf24', flexShrink: 0 }}>HOST</span>
                        )}
                      </div>
                      {roleLabel && (
                        <div style={{ fontSize: 10, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div style={card}>
              <h3 style={{ ...label, color: '#4ade80' }}>Game Over</h3>
              <pre style={{ fontSize: 11, fontFamily: 'monospace', background: '#27272a', borderRadius: 4, padding: 8, overflow: 'auto', maxHeight: 128, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(gameResult, null, 2)}
              </pre>
              <button
                onClick={resetGame}
                className="dk-btn-amber"
                style={{ ...btnAmber, marginTop: 8, width: '100%' }}
              >
                Reset Game
              </button>
            </div>
          )}

          {/* Reset button (when game is not over) */}
          {!gameOver && engine && (
            <div style={card}>
              <button
                onClick={resetGame}
                className="dk-btn-zinc"
                style={btnZinc}
              >
                Reset Game
              </button>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          className="dk-resize-bar"
          style={{ flexShrink: 0, width: 8, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        >
          <div className="dk-resize-line" style={{ width: 2, height: 32, background: '#3f3f46', borderRadius: 2 }} />
        </div>

        {/* Right column: State & Logs */}
        <div style={{ width: `${(1 - splitRatio) * 100}%`, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', paddingLeft: 4 }}>
          {/* State Editor */}
          <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h3 style={label}>Game State (Full)</h3>
            <textarea
              value={stateJson}
              onChange={(e) => setStateJson(e.target.value)}
              className="dk-input"
              style={{ flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: 8, fontFamily: 'monospace', fontSize: 11, resize: 'none', minHeight: 120, color: '#e5e5e5' }}
            />
            <button
              onClick={applyState}
              className="dk-btn-amber"
              style={{ ...btnAmber, marginTop: 8 }}
            >
              Apply State
            </button>
          </div>

          {/* Action Log */}
          <div style={{ ...card, height: 192, overflow: 'auto' }}>
            <h3 style={label}>Action Log</h3>
            {actions.length === 0 ? (
              <p style={{ color: '#71717a', fontSize: 11 }}>No actions yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {actions.map((a, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', background: '#27272a', borderRadius: 4, padding: 4 }}>
                    <span style={{ color: '#fbbf24' }}>{a.player}</span>: {JSON.stringify(a.action)}
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
