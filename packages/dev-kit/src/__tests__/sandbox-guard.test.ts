import { describe, it, expect, vi } from 'vitest';
import { createSandboxedEngine } from '../server/sandbox-guard';
import type { GameEngine } from '../server/engine-loader';

function createTestEngine(overrides: Partial<GameEngine> = {}): GameEngine {
  return {
    init: (players) => ({
      phase: 'playing',
      players: players.map((p: any) => ({ id: p.id })),
      data: {},
    }),
    handleAction: (state, _playerId, _action) => state,
    isGameOver: (state) => state.phase === 'ended',
    getResult: (state) => ({
      rankings: state.players.map((p: any, i: number) => ({
        playerId: p.id,
        rank: i + 1,
        score: 0,
        isWinner: i === 0,
      })),
    }),
    getPlayerView: (state, _playerId) => state,
    ...overrides,
  };
}

describe('createSandboxedEngine', () => {
  describe('timer guard', () => {
    it('should warn when engine calls setTimeout', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: (players) => {
          (globalThis as any).setTimeout(() => {}, 100);
          return { phase: 'playing', players: [], data: {} };
        },
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setTimeout() called in engine code')
      );
      warnSpy.mockRestore();
    });

    it('should warn when engine calls setInterval', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        handleAction: (state) => {
          (globalThis as any).setInterval(() => {}, 1000);
          return state;
        },
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.handleAction({ phase: 'playing', players: [], data: {} }, 'p1', { type: 'X' });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setInterval() called in engine code')
      );
      warnSpy.mockRestore();
    });

    it('should restore real setTimeout after engine call', () => {
      const realSetTimeout = globalThis.setTimeout;
      const engine = createTestEngine({
        init: () => {
          (globalThis as any).setTimeout(() => {}, 0);
          return { phase: 'playing', players: [], data: {} };
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);
      warnSpy.mockRestore();

      expect(globalThis.setTimeout).toBe(realSetTimeout);
    });

    it('should restore globals even if engine throws', () => {
      const realSetTimeout = globalThis.setTimeout;
      const engine = createTestEngine({
        init: () => { throw new Error('boom'); },
      });

      const sandboxed = createSandboxedEngine(engine);
      expect(() => sandboxed.init([])).toThrow('boom');
      expect(globalThis.setTimeout).toBe(realSetTimeout);
    });

    it('should return no-op value (0) from mocked setTimeout', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let timerReturn: number | undefined;
      const engine = createTestEngine({
        init: () => {
          timerReturn = (globalThis as any).setTimeout(() => {}, 100);
          return { phase: 'playing', players: [], data: {} };
        },
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);
      warnSpy.mockRestore();

      expect(timerReturn).toBe(0);
    });
  });

  describe('serialization check', () => {
    it('should warn when state contains a Map', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [],
          data: { lookup: new Map([['a', 1]]) },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Map at state')
      );
      warnSpy.mockRestore();
    });

    it('should warn when state contains a Set', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        handleAction: () => ({
          phase: 'playing',
          players: [],
          data: { ids: new Set([1, 2, 3]) },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.handleAction({ phase: 'playing', players: [], data: {} }, 'p1', { type: 'X' });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Set at state')
      );
      warnSpy.mockRestore();
    });

    it('should warn when state contains a Date', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [],
          data: { createdAt: new Date() },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Date at state')
      );
      warnSpy.mockRestore();
    });

    it('should warn when state contains undefined values', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [],
          data: { missing: undefined },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('undefined at state')
      );
      warnSpy.mockRestore();
    });

    it('should warn when state contains a function', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [],
          data: { compute: () => 42 },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Function at state')
      );
      warnSpy.mockRestore();
    });

    it('should not warn for clean serializable state', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [{ id: 'p1' }],
          data: { scores: [0, 0], turn: 0, active: true, name: 'test' },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should detect nested non-serializable types', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine = createTestEngine({
        init: () => ({
          phase: 'playing',
          players: [],
          data: { nested: { deep: { items: new Set([1]) } } },
        }),
      });

      const sandboxed = createSandboxedEngine(engine);
      sandboxed.init([]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('.nested.deep.items')
      );
      warnSpy.mockRestore();
    });
  });

  describe('engine passthrough', () => {
    it('should correctly pass through init result', () => {
      const engine = createTestEngine();
      const sandboxed = createSandboxedEngine(engine);
      const state = sandboxed.init([{ id: 'p1', nickname: 'A', avatarUrl: null, isHost: true }]);
      expect(state.phase).toBe('playing');
      expect(state.players).toHaveLength(1);
    });

    it('should correctly pass through isGameOver', () => {
      const engine = createTestEngine();
      const sandboxed = createSandboxedEngine(engine);
      expect(sandboxed.isGameOver({ phase: 'playing', players: [], data: {} })).toBe(false);
      expect(sandboxed.isGameOver({ phase: 'ended', players: [], data: {} })).toBe(true);
    });

    it('should correctly pass through getResult', () => {
      const engine = createTestEngine();
      const sandboxed = createSandboxedEngine(engine);
      const result = sandboxed.getResult({ phase: 'ended', players: [{ id: 'p1' }], data: {} });
      expect(result.rankings).toHaveLength(1);
    });
  });
});
