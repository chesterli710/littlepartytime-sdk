import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export default function Debug() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<any>({ players: [], phase: 'lobby' });
  const [fullState, setFullState] = useState<any>(null);

  useEffect(() => {
    const sock = io('http://localhost:4001', { query: { nickname: '__debug__' } });

    sock.on('room:update', setRoom);
    sock.on('game:state', setFullState);
    sock.on('debug:state', setFullState);

    setSocket(sock);

    return () => { sock.disconnect(); };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4 h-[calc(100vh-80px)]">
      {/* Room State */}
      <div className="bg-zinc-900 rounded-lg p-4 overflow-auto">
        <h2 className="text-lg font-bold mb-4 text-amber-400">Room State</h2>
        <pre className="text-xs font-mono whitespace-pre-wrap">
          {JSON.stringify(room, null, 2)}
        </pre>
      </div>

      {/* Game State */}
      <div className="bg-zinc-900 rounded-lg p-4 overflow-auto">
        <h2 className="text-lg font-bold mb-4 text-amber-400">Full Game State</h2>
        <pre className="text-xs font-mono whitespace-pre-wrap">
          {fullState ? JSON.stringify(fullState, null, 2) : 'No game in progress'}
        </pre>
      </div>
    </div>
  );
}
