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

  const panelStyle: React.CSSProperties = { background: '#18181b', borderRadius: 8, padding: 16, overflow: 'auto' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: 'calc(100vh - 80px)' }}>
      {/* Room State */}
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#fbbf24' }}>Room State</h2>
        <pre style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(room, null, 2)}
        </pre>
      </div>

      {/* Game State */}
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#fbbf24' }}>Full Game State</h2>
        <pre style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {fullState ? JSON.stringify(fullState, null, 2) : 'No game in progress'}
        </pre>
      </div>
    </div>
  );
}
