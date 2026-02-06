// packages/dev-kit/src/server/socket-server.ts
import { Server } from 'socket.io';
import http from 'http';
import { loadEngine, clearEngineCache, getEngine } from './engine-loader';
import * as GameRoom from './game-room';

export interface SocketServerOptions {
  port: number;
  projectDir: string;
  onStateChange?: (room: GameRoom.GameRoom) => void;
  onLog?: (message: string) => void;
}

export function createSocketServer(options: SocketServerOptions): {
  server: http.Server;
  io: Server;
  getRoom: () => GameRoom.GameRoom;
  reloadEngine: () => void;
} {
  const { port, projectDir, onStateChange, onLog } = options;

  const log = (msg: string) => {
    onLog?.(msg);
    console.log(`[Socket] ${msg}`);
  };

  // Load engine
  let engine = loadEngine(projectDir);
  log(`Engine loaded from ${projectDir}`);

  // Create room
  const room = GameRoom.createRoom('dev-game');

  const server = http.createServer();
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    const nickname = (socket.handshake.query.nickname as string) || `Player ${room.players.length + 1}`;
    const player = GameRoom.addPlayer(room, socket.id, nickname);
    log(`${player.nickname} joined (${player.id})`);

    // Notify all
    io.emit('room:update', {
      players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
      phase: room.phase,
    });
    onStateChange?.(room);

    // Send current game state to reconnecting player
    if ((room.phase === 'playing' || room.phase === 'ended') && room.state) {
      const view = engine.getPlayerView(room.state, player.id);
      socket.emit('game:state', view);
    }

    // Ready toggle
    socket.on('player:ready', (ready: boolean) => {
      GameRoom.setPlayerReady(room, socket.id, ready);
      io.emit('room:update', {
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
        phase: room.phase,
      });
      onStateChange?.(room);
      log(`${player.nickname} is ${ready ? 'ready' : 'not ready'}`);
    });

    // Start game (host only)
    socket.on('game:start', () => {
      if (!player.isHost) return;
      if (!GameRoom.allPlayersReady(room)) return;

      GameRoom.startGame(room, engine);
      log(`Game started!`);

      // Send initial state to each player
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          const view = engine.getPlayerView(room.state, p.id);
          playerSocket.emit('game:state', view);
        }
      });

      io.emit('room:update', {
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
        phase: room.phase,
      });
      onStateChange?.(room);
    });

    // Game action
    socket.on('game:action', (action: any) => {
      if (room.phase !== 'playing' && room.phase !== 'ended') return;

      log(`${player.nickname} action: ${JSON.stringify(action)}`);
      GameRoom.handleAction(room, engine, player.id, action);

      // Broadcast updated state
      room.players.forEach(p => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          const view = engine.getPlayerView(room.state, p.id);
          playerSocket.emit('game:state', view);
        }
      });

      // Check game over (use type assertion since handleAction may have changed phase)
      if ((room.phase as string) === 'ended') {
        const result = engine.getResult(room.state);
        io.emit('game:result', result);
        log(`Game ended! Result: ${JSON.stringify(result)}`);
      }

      io.emit('room:update', {
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
        phase: room.phase,
      });
      onStateChange?.(room);
    });

    // Play again
    socket.on('game:playAgain', () => {
      if (!player.isHost) return;
      GameRoom.resetRoom(room);
      io.emit('room:update', {
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
        phase: room.phase,
      });
      onStateChange?.(room);
      log(`Room reset by host`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const removed = GameRoom.removePlayer(room, socket.id);
      if (removed) {
        log(`${removed.nickname} left`);
        io.emit('room:update', {
          players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
          phase: room.phase,
        });
        onStateChange?.(room);
      }
    });
  });

  server.listen(port, () => {
    log(`Socket.IO server listening on port ${port}`);
  });

  return {
    server,
    io,
    getRoom: () => room,
    reloadEngine: () => {
      clearEngineCache();
      engine = loadEngine(projectDir);
      log(`Engine reloaded`);
    },
  };
}
