import { describe, it, expect } from 'vitest';
import { GameTester, createMockPlayers } from '../index';
import type { GameEngine, GameState, Player, GameAction, GameResult } from '../../index';

// Minimal counter engine for testing GameTester
const counterEngine: GameEngine = {
  init(players: Player[]): GameState {
    return {
      phase: 'playing',
      players: players.map(p => ({ id: p.id })),
      data: { count: 0, currentPlayerIndex: 0 },
    };
  },
  handleAction(state: GameState, playerId: string, action: GameAction): GameState {
    const data = state.data as { count: number; currentPlayerIndex: number };
    if (action.type !== 'INCREMENT') return state;
    const currentPlayer = state.players[data.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return state;
    const newCount = data.count + 1;
    if (newCount >= 3) {
      return { ...state, phase: 'ended', data: { count: newCount, currentPlayerIndex: data.currentPlayerIndex, winnerId: playerId } };
    }
    return { ...state, data: { count: newCount, currentPlayerIndex: (data.currentPlayerIndex + 1) % state.players.length } };
  },
  isGameOver(state: GameState): boolean { return state.phase === 'ended'; },
  getResult(state: GameState): GameResult {
    const data = state.data as { winnerId?: string };
    return { rankings: state.players.map(p => ({ playerId: p.id, rank: p.id === data.winnerId ? 1 : 2, score: p.id === data.winnerId ? 10 : 0, isWinner: p.id === data.winnerId })) };
  },
  getPlayerView(state: GameState, _playerId: string): Partial<GameState> {
    if (state.phase !== 'ended') {
      const { winnerId, ...rest } = state.data as Record<string, unknown>;
      return { ...state, data: rest as Record<string, unknown> };
    }
    return state;
  },
};

describe('GameTester', () => {
  it('should initialize with the engine', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    expect(tester.state.phase).toBe('playing');
    expect(tester.phase).toBe('playing');
    expect(tester.playerStates).toHaveLength(2);
  });

  it('should apply actions and update state', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    tester.act('player-1', { type: 'INCREMENT' });
    expect((tester.state.data as { count: number }).count).toBe(1);
  });

  it('should ignore invalid actions (wrong player turn)', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    const before = tester.state;
    tester.act('player-2', { type: 'INCREMENT' });
    expect(tester.state).toBe(before);
  });

  it('should detect game over', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    expect(tester.isGameOver()).toBe(false);
    tester.act('player-1', { type: 'INCREMENT' });
    tester.act('player-2', { type: 'INCREMENT' });
    tester.act('player-1', { type: 'INCREMENT' });
    expect(tester.isGameOver()).toBe(true);
  });

  it('should return game result', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    tester.act('player-1', { type: 'INCREMENT' });
    tester.act('player-2', { type: 'INCREMENT' });
    tester.act('player-1', { type: 'INCREMENT' });
    const result = tester.getResult();
    expect(result.rankings.find((r: { isWinner: boolean }) => r.isWinner)?.playerId).toBe('player-1');
  });

  it('should return filtered player view', () => {
    const tester = new GameTester(counterEngine);
    tester.init(createMockPlayers(2));
    tester.act('player-1', { type: 'INCREMENT' });
    const view = tester.getPlayerView('player-2');
    expect(view.data).not.toHaveProperty('winnerId');
  });

  it('should throw if act is called before init', () => {
    const tester = new GameTester(counterEngine);
    expect(() => tester.act('p1', { type: 'INCREMENT' })).toThrow();
  });
});
