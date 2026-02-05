import { describe, it, expect } from 'vitest';
import { GameSimulator } from '../index';
import type { GameEngine, GameState, Player, GameAction, GameResult } from '../../index';

const counterEngine: GameEngine = {
  init(players: Player[]): GameState {
    return { phase: 'playing', players: players.map(p => ({ id: p.id })), data: { count: 0, currentPlayerIndex: 0 } };
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

describe('GameSimulator', () => {
  it('should initialize with player count', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 3 });
    sim.start();
    expect(sim.players).toHaveLength(3);
    expect(sim.state.phase).toBe('playing');
  });

  it('should act by player index', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 2 });
    sim.start();
    sim.act(0, { type: 'INCREMENT' });
    expect((sim.state.data as { count: number }).count).toBe(1);
  });

  it('should return filtered view per player', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 2 });
    sim.start();
    const view = sim.getView(0);
    expect(view.data).not.toHaveProperty('winnerId');
  });

  it('should track action log', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 2 });
    sim.start();
    sim.act(0, { type: 'INCREMENT' });
    sim.act(1, { type: 'INCREMENT' });
    expect(sim.actionLog).toHaveLength(2);
    expect(sim.actionLog[0].playerIndex).toBe(0);
    expect(sim.actionLog[0].action.type).toBe('INCREMENT');
    expect(sim.actionLog[1].playerIndex).toBe(1);
  });

  it('should detect game over and get result', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 2 });
    sim.start();
    sim.act(0, { type: 'INCREMENT' });
    sim.act(1, { type: 'INCREMENT' });
    sim.act(0, { type: 'INCREMENT' });
    expect(sim.isGameOver()).toBe(true);
    expect(sim.getResult().rankings.find((r: { isWinner: boolean }) => r.isWinner)?.playerId).toBe(sim.players[0].id);
  });

  it('should expose currentTurn based on currentPlayerIndex', () => {
    const sim = new GameSimulator(counterEngine, { playerCount: 2 });
    sim.start();
    expect(sim.currentTurn).toBe(0);
    sim.act(0, { type: 'INCREMENT' });
    expect(sim.currentTurn).toBe(1);
  });
});
