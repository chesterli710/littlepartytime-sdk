import { describe, it, expect } from 'vitest';
import { GameTester, GameSimulator, createMockPlayers } from '@littlepartytime/sdk/testing';
import engine from '../src/engine';

describe('Number Guess Engine', () => {
  describe('GameTester - unit tests', () => {
    it('should initialize with playing phase', () => {
      const tester = new GameTester(engine);
      tester.init(createMockPlayers(3));
      expect(tester.phase).toBe('playing');
      expect(tester.playerStates).toHaveLength(3);
    });

    it('should hide secretNumber in player view', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const view = tester.getPlayerView(players[0].id);
      expect(view.data).not.toHaveProperty('secretNumber');
    });

    it('should narrow range on wrong guess', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const secret = (tester.state.data as { secretNumber: number }).secretNumber;
      const guess = secret > 50 ? 1 : 99;
      tester.act(players[0].id, { type: 'GUESS', payload: { number: guess } });
      const data = tester.state.data as { low: number; high: number };
      if (guess < secret) {
        expect(data.low).toBe(guess + 1);
      } else {
        expect(data.high).toBe(guess - 1);
      }
    });

    it('should reject out-of-turn actions', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const before = tester.state;
      tester.act(players[1].id, { type: 'GUESS', payload: { number: 50 } });
      expect(tester.state).toBe(before);
    });

    it('should end when secret is guessed', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const secret = (tester.state.data as { secretNumber: number }).secretNumber;
      tester.act(players[0].id, { type: 'GUESS', payload: { number: secret } });
      expect(tester.isGameOver()).toBe(true);
      expect(tester.phase).toBe('ended');
    });

    it('should reveal secretNumber in view after game over', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const secret = (tester.state.data as { secretNumber: number }).secretNumber;
      tester.act(players[0].id, { type: 'GUESS', payload: { number: secret } });
      const view = tester.getPlayerView(players[1].id);
      expect((view.data as { secretNumber: number }).secretNumber).toBe(secret);
    });
  });

  describe('GameSimulator - E2E', () => {
    it('should play a complete game', () => {
      const sim = new GameSimulator(engine, { playerCount: 3 });
      sim.start();

      // Binary search strategy to end the game
      let lo = 1, hi = 100;
      let safety = 0;
      while (!sim.isGameOver() && safety < 100) {
        const mid = Math.floor((lo + hi) / 2);
        const turn = sim.currentTurn;
        sim.act(turn, { type: 'GUESS', payload: { number: mid } });
        if (!sim.isGameOver()) {
          const data = sim.state.data as { low: number; high: number };
          lo = data.low;
          hi = data.high;
        }
        safety++;
      }

      expect(sim.isGameOver()).toBe(true);
      const result = sim.getResult();
      expect(result.rankings).toHaveLength(3);
      expect(result.rankings.filter(r => r.isWinner).length).toBeGreaterThanOrEqual(1);
      expect(sim.actionLog.length).toBeGreaterThan(0);
    });
  });
});
