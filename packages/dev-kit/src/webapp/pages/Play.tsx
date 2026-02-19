import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import PhoneFrame from '../components/PhoneFrame';
import PlatformTakeover from '../components/PlatformTakeover';

const card: React.CSSProperties = { background: '#18181b', borderRadius: 8, padding: 24 };
const inputStyle: React.CSSProperties = { width: '100%', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 4, padding: '8px 12px', marginBottom: 16, color: '#e5e5e5', fontSize: 14 };
const btnAmber: React.CSSProperties = { width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '8px 0', borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: 14 };

export default function Play() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState('');
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState<any>({ players: [], phase: 'lobby' });
  const [gameState, setGameState] = useState<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [GameRenderer, setGameRenderer] = useState<React.ComponentType<any> | null>(null);
  const [gameResult, setGameResult] = useState<any>(null);

  const isAutoMode = useMemo(() => new URLSearchParams(window.location.search).get('auto') === 'true', []);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  // Ref survives React Fast Refresh (HMR) but not new tabs — perfect for reconnect identity
  const assignedNicknameRef = useRef<string | null>(null);

  // Load renderer
  useEffect(() => {
    import('/src/renderer.tsx').then((mod) => {
      setGameRenderer(() => mod.default || mod.Renderer);
    }).catch(console.error);
  }, []);

  // Auto-join: connect immediately with server-assigned name
  // assignedNicknameRef persists across HMR (React Refresh keeps refs) but resets per new tab
  useEffect(() => {
    if (!isAutoMode) return;

    const query = assignedNicknameRef.current
      ? { nickname: assignedNicknameRef.current }
      : { auto: 'true' };

    const sock = io('http://localhost:4001', { query });

    sock.on('connect', () => {
      setMyId(sock.id);
      setJoined(true);
    });

    sock.on('player:assigned', ({ id, nickname: assignedName }: { id: string; nickname: string }) => {
      setMyPlayerId(id);
      setNickname(assignedName);
      assignedNicknameRef.current = assignedName;
    });

    sock.on('room:update', (r: any) => {
      setRoom(r);
      if (r.phase === 'lobby') {
        setGameResult(null);
        setGameState(null);
      }
    });
    sock.on('game:state', setGameState);
    sock.on('game:result', (result) => {
      console.log('Game result:', result);
      setGameResult(result);
    });

    setSocket(sock);

    return () => { sock.disconnect(); };
  }, [isAutoMode]);

  const join = useCallback(() => {
    if (!nickname.trim()) return;

    const sock = io('http://localhost:4001', { query: { nickname } });

    sock.on('connect', () => {
      setMyId(sock.id);
      setJoined(true);
    });

    sock.on('player:assigned', ({ id }: { id: string; nickname: string }) => {
      setMyPlayerId(id);
    });

    sock.on('room:update', (r: any) => {
      setRoom(r);
      // Clear game result when room resets to lobby
      if (r.phase === 'lobby') {
        setGameResult(null);
        setGameState(null);
      }
    });
    sock.on('game:state', setGameState);
    sock.on('game:result', (result) => {
      console.log('Game result:', result);
      setGameResult(result);
    });

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

  // Use refs to avoid recreating platform on every room/me change
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
      on: (event: string, handler: Function) => {
        if (event === 'stateUpdate') socket.on('game:state', handler as any);
      },
      off: (event: string, handler: Function) => {
        if (event === 'stateUpdate') socket.off('game:state', handler as any);
      },
      reportResult: () => {},
      getAssetUrl: (assetPath: string) => `/assets/${assetPath}`,
      getDeviceCapabilities: () => ({ haptics: false, motion: false }),
      haptic: () => {},
      onShake: () => () => {},
      onTilt: () => () => {},
    };
  }, [socket]);

  if (!joined && !isAutoMode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ ...card, width: 320 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Join Game</h2>
          <input
            type="text"
            placeholder="Your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            className="dk-input"
            style={inputStyle}
          />
          <button
            onClick={join}
            className="dk-btn-amber"
            style={btnAmber}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  if (room.phase === 'lobby' || room.phase === 'ready') {
    return (
      <div style={{ maxWidth: 448, margin: '32px auto 0' }}>
        <div style={card}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Lobby</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {room.players.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#27272a', borderRadius: 4, padding: '8px 12px' }}>
                <span>{p.nickname} {p.isHost && '(Host)'}</span>
                <span style={{ color: p.ready ? '#4ade80' : '#71717a' }}>
                  {p.ready ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => socket?.emit('player:ready', !isReady)}
              className={isReady ? 'dk-btn-zinc' : 'dk-btn-green'}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 4,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                ...(isReady
                  ? { background: '#3f3f46', color: '#d4d4d8' }
                  : { background: '#16a34a', color: '#fff' }),
              }}
            >
              {isReady ? 'Cancel Ready' : 'Ready'}
            </button>
            {isHost && (
              <button
                onClick={() => socket?.emit('game:start')}
                disabled={!room.players.every((p: any) => p.ready) || room.players.length < 2}
                className="dk-btn-amber"
                style={{ ...btnAmber, flex: 1, width: 'auto' }}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Playing or ended
  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <PhoneFrame>
        {gameOver ? (
          <PlatformTakeover
            result={gameResult}
            players={room.players.map((p: any) => ({ id: p.id, nickname: p.nickname }))}
            onReturn={handleReturn}
          />
        ) : GameRenderer && platform && gameState ? (
          <GameRenderer platform={platform} state={gameState} />
        ) : (
          <div style={{ padding: 16, color: '#71717a' }}>Loading game...</div>
        )}
      </PhoneFrame>
      {isHost && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 160 }}>
          <button
            onClick={() => socket?.emit('game:forceReset')}
            style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '8px 0', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            Reset Game
          </button>
          <button
            onClick={() => socket?.emit('room:kickAll')}
            style={{ width: '100%', background: '#dc2626', color: '#fff', border: 'none', padding: '8px 0', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            Kick All Players
          </button>
        </div>
      )}
    </div>
  );
}
