import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import PhoneFrame from '../components/PhoneFrame';

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

  // Load renderer
  useEffect(() => {
    import('/src/renderer.tsx').then((mod) => {
      setGameRenderer(() => mod.default || mod.Renderer);
    }).catch(console.error);
  }, []);

  const join = useCallback(() => {
    if (!nickname.trim()) return;

    const sock = io('http://localhost:4001', { query: { nickname } });

    sock.on('connect', () => {
      setMyId(sock.id);
      setJoined(true);
    });

    sock.on('room:update', setRoom);
    sock.on('game:state', setGameState);
    sock.on('game:result', (result) => {
      console.log('Game result:', result);
    });

    setSocket(sock);
  }, [nickname]);

  const me = room.players.find((p: any) => socket && p.socketId === socket.id) || room.players.find((p: any) => p.nickname === nickname);
  const isHost = me?.isHost;
  const isReady = me?.ready;

  const platform = socket ? {
    getPlayers: () => room.players.map((p: any) => ({ id: p.id, nickname: p.nickname, avatarUrl: null, isHost: p.isHost })),
    getLocalPlayer: () => me ? { id: me.id, nickname: me.nickname, avatarUrl: null, isHost: me.isHost } : { id: '', nickname: '', avatarUrl: null, isHost: false },
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
  } : null;

  if (!joined) {
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
    <div style={{ height: 'calc(100vh - 80px)', position: 'relative' }}>
      <PhoneFrame>
        {GameRenderer && platform && gameState ? (
          <GameRenderer platform={platform} state={gameState} />
        ) : (
          <div style={{ padding: 16, color: '#71717a' }}>Loading game...</div>
        )}
      </PhoneFrame>
      {room.phase === 'ended' && isHost && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
          <button
            onClick={() => socket?.emit('game:playAgain')}
            className="dk-btn-amber"
            style={{ ...btnAmber, width: 'auto', padding: '8px 24px', borderRadius: 9999 }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
