// packages/dev-kit/src/server/game-room.ts
import type { GameEngine } from './engine-loader';

export interface Player {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isHost: boolean;
  socketId: string;
  ready: boolean;
}

export interface GameRoom {
  players: Player[];
  state: any | null;
  phase: 'lobby' | 'ready' | 'playing' | 'ended';
  gameId: string;
}

export function createRoom(gameId: string): GameRoom {
  return {
    players: [],
    state: null,
    phase: 'lobby',
    gameId,
  };
}

export function addPlayer(room: GameRoom, socketId: string, nickname: string): Player {
  const isHost = room.players.length === 0;
  const player: Player = {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nickname,
    avatarUrl: null,
    isHost,
    socketId,
    ready: false,
  };
  room.players.push(player);
  return player;
}

export function removePlayer(room: GameRoom, socketId: string): Player | null {
  const index = room.players.findIndex(p => p.socketId === socketId);
  if (index === -1) return null;

  const [removed] = room.players.splice(index, 1);

  // Promote new host if needed
  if (removed.isHost && room.players.length > 0) {
    room.players[0].isHost = true;
  }

  return removed;
}

export function getPlayerBySocketId(room: GameRoom, socketId: string): Player | undefined {
  return room.players.find(p => p.socketId === socketId);
}

export function setPlayerReady(room: GameRoom, socketId: string, ready: boolean): void {
  const player = getPlayerBySocketId(room, socketId);
  if (player) player.ready = ready;
}

export function allPlayersReady(room: GameRoom): boolean {
  return room.players.length >= 2 && room.players.every(p => p.ready);
}

export function startGame(room: GameRoom, engine: GameEngine): void {
  const players = room.players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    isHost: p.isHost,
  }));

  room.state = engine.init(players);
  room.phase = 'playing';
}

export function handleAction(room: GameRoom, engine: GameEngine, playerId: string, action: any): void {
  if (room.phase !== 'playing' || !room.state) return;

  room.state = engine.handleAction(room.state, playerId, action);

  if (engine.isGameOver(room.state)) {
    room.phase = 'ended';
  }
}

export function resetRoom(room: GameRoom): void {
  room.state = null;
  room.phase = 'lobby';
  room.players.forEach(p => p.ready = false);
}
