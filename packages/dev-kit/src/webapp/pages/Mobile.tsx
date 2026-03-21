import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import PlatformTakeover from '../components/PlatformTakeover';

declare const __SOCKET_PORT__: number;
declare const __DEV_KIT_MODE__: string;

/**
 * Root container mirrors the platform's room page:
 *   <div class="h-[100dvh] flex flex-col overflow-hidden">
 * No position:fixed — uses 100dvh which shrinks with mobile keyboard.
 */
const rootStyle: React.CSSProperties = {
  height: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#0a0a0a',
  color: '#e5e5e5',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

/**
 * Game outer wrapper mirrors the platform's flex-1 scrollable area:
 *   <div class="flex-1 min-h-0 overflow-y-auto">
 */
const gameOuterStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
};

export default function Mobile() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState('');
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState<any>({ players: [], phase: 'lobby' });
  const [gameState, setGameState] = useState<any>(null);
  const [GameRenderer, setGameRenderer] = useState<React.ComponentType<any> | null>(null);
  const [gameResult, setGameResult] = useState<any>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  // Fetch active game ID on mount (play mode only)
  useEffect(() => {
    if (__DEV_KIT_MODE__ !== 'play') return;
    fetch(`http://${window.location.hostname}:${window.location.port}/api/games`)
      .then(res => res.json())
      .then(data => { if (data.activeGameId) setActiveGameId(data.activeGameId); })
      .catch(() => {});
  }, []);

  // Load renderer
  useEffect(() => {
    if (__DEV_KIT_MODE__ === 'play') {
      if (!activeGameId) return;
      import(/* @vite-ignore */ `/__active-game?id=${activeGameId}&t=${Date.now()}`)
        .then((mod) => setGameRenderer(() => mod.Renderer || mod.default))
        .catch(console.error);
    } else {
      import('/src/renderer.tsx')
        .then((mod) => setGameRenderer(() => mod.default || mod.Renderer))
        .catch(console.error);
    }
  }, [activeGameId]);

  const join = useCallback(() => {
    if (!nickname.trim()) return;
    const sock = io(`http://${window.location.hostname}:${__SOCKET_PORT__}`, { query: { nickname } });

    sock.on('connect', () => setJoined(true));
    sock.on('player:assigned', ({ id }: { id: string }) => setMyPlayerId(id));
    sock.on('room:update', (r: any) => {
      setRoom(r);
      if (r.phase === 'lobby') { setGameResult(null); setGameState(null); }
    });
    sock.on('game:state', setGameState);
    sock.on('game:result', setGameResult);

    setSocket(sock);
  }, [nickname]);

  const me = room.players.find((p: any) => myPlayerId && p.id === myPlayerId)
           || room.players.find((p: any) => p.nickname === nickname);
  const isHost = me?.isHost;
  const isReady = me?.ready;
  const gameOver = room.phase === 'ended' && gameResult !== null;

  const handleReturn = useCallback(() => {
    socket?.emit('game:playAgain');
  }, [socket]);

  const roomRef = useRef(room);
  roomRef.current = room;
  const meRef = useRef(me);
  meRef.current = me;

  const platform = useMemo(() => {
    if (!socket) return null;
    return {
      getPlayers: () => roomRef.current.players.map((p: any) => ({ id: p.id, nickname: p.nickname, avatarUrl: null, isHost: p.isHost })),
      getLocalPlayer: () => {
        const m = meRef.current;
        return m ? { id: m.id, nickname: m.nickname, avatarUrl: null, isHost: m.isHost } : { id: '', nickname: '', avatarUrl: null, isHost: false };
      },
      send: (action: any) => socket.emit('game:action', action),
      on: (event: string, handler: Function) => { if (event === 'stateUpdate') socket.on('game:state', handler as any); },
      off: (event: string, handler: Function) => { if (event === 'stateUpdate') socket.off('game:state', handler as any); },
      reportResult: () => {},
      getAssetUrl: (assetPath: string) =>
        __DEV_KIT_MODE__ === 'play'
          ? `/api/games/active/assets/${assetPath}`
          : `/assets/${assetPath}`,
      getDeviceCapabilities: () => ({ haptics: false, motion: false }),
      haptic: () => {},
      onShake: () => () => {},
      onTilt: () => () => {},
    };
  }, [socket]);

  // Join screen
  if (!joined) {
    return (
      <div style={{ ...rootStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '85%', maxWidth: 320 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Join Game</h2>
          <input
            type="text"
            placeholder="Your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            style={{ width: '100%', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#e5e5e5', fontSize: 16 }}
          />
          <button
            onClick={join}
            style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '12px 0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 16 }}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // Lobby
  if (room.phase === 'lobby' || room.phase === 'ready') {
    return (
      <div style={{ ...rootStyle, padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Lobby</h2>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {room.players.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 15 }}>{p.nickname} {p.isHost && '(Host)'}</span>
              <span style={{ color: p.ready ? '#4ade80' : '#71717a', fontSize: 14 }}>
                {p.ready ? 'Ready' : 'Not Ready'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 16 }}>
          <button
            onClick={() => socket?.emit('player:ready', !isReady)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 16,
              ...(isReady ? { background: '#3f3f46', color: '#d4d4d8' } : { background: '#16a34a', color: '#fff' }),
            }}
          >
            {isReady ? 'Cancel Ready' : 'Ready'}
          </button>
          {isHost && (
            <button
              onClick={() => socket?.emit('game:start')}
              disabled={!room.players.every((p: any) => p.ready) || room.players.length < 2}
              style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '12px 0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 16, opacity: (!room.players.every((p: any) => p.ready) || room.players.length < 2) ? 0.5 : 1 }}
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }

  // Game — mirrors platform container structure:
  //   div.h-[100dvh].flex.flex-col.overflow-hidden  (root)
  //     div.flex-1.min-h-0.overflow-y-auto           (game outer)
  //       div.game-sandbox                            (safe area padding)
  return (
    <div style={rootStyle}>
      <div style={gameOuterStyle}>
        <div className="game-sandbox">
          {gameOver ? (
            <PlatformTakeover
              result={gameResult}
              players={room.players.map((p: any) => ({ id: p.id, nickname: p.nickname }))}
              onReturn={handleReturn}
            />
          ) : GameRenderer && platform && gameState ? (
            <GameRenderer platform={platform} state={gameState} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#71717a' }}>Loading game...</div>
          )}
        </div>
      </div>
    </div>
  );
}
