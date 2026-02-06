import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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
  } : null;

  if (!joined) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="bg-zinc-900 rounded-lg p-6 w-80">
          <h2 className="text-xl font-bold mb-4">Join Game</h2>
          <input
            type="text"
            placeholder="Your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 mb-4"
          />
          <button
            onClick={join}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded font-semibold"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  if (room.phase === 'lobby' || room.phase === 'ready') {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Lobby</h2>
          <div className="space-y-2 mb-6">
            {room.players.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-zinc-800 rounded px-3 py-2">
                <span>{p.nickname} {p.isHost && '(Host)'}</span>
                <span className={p.ready ? 'text-green-400' : 'text-zinc-500'}>
                  {p.ready ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => socket?.emit('player:ready', !isReady)}
              className={`flex-1 py-2 rounded font-semibold ${isReady ? 'bg-zinc-700 text-zinc-300' : 'bg-green-600 text-white'}`}
            >
              {isReady ? 'Cancel Ready' : 'Ready'}
            </button>
            {isHost && (
              <button
                onClick={() => socket?.emit('game:start')}
                disabled={!room.players.every((p: any) => p.ready) || room.players.length < 2}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded font-semibold"
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
    <div className="h-[calc(100vh-80px)]">
      {GameRenderer && platform && gameState ? (
        <GameRenderer platform={platform} state={gameState} />
      ) : (
        <div className="p-4 text-zinc-500">Loading game...</div>
      )}
      {room.phase === 'ended' && isHost && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]">
          <button
            onClick={() => socket?.emit('game:playAgain')}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-full font-semibold"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
