import { describe, it, expect } from 'vitest';
import { loadEngineFromPath } from '../server/engine-loader';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('loadEngineFromPath', () => {
  it('should load engine from an arbitrary absolute path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-test-'));
    const enginePath = path.join(tmpDir, 'engine.cjs');
    fs.writeFileSync(enginePath, `
      module.exports = {
        engine: {
          init(players) { return { players: players.map(p => p.id), turn: 0 }; },
          handleAction(state, playerId, action) { return { ...state, turn: state.turn + 1 }; },
          isGameOver(state) { return state.turn >= 3; },
          getResult(state) { return { winner: state.players[0] }; },
          getPlayerView(state, playerId) { return state; },
        }
      };
    `);

    const engine = loadEngineFromPath(enginePath);
    expect(engine).toBeDefined();
    expect(typeof engine.init).toBe('function');
    expect(typeof engine.handleAction).toBe('function');
    expect(typeof engine.isGameOver).toBe('function');
    expect(typeof engine.getResult).toBe('function');
    expect(typeof engine.getPlayerView).toBe('function');

    const state = engine.init([{ id: 'p1' }, { id: 'p2' }]);
    expect(state.players).toEqual(['p1', 'p2']);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should throw if engine file does not exist', () => {
    expect(() => loadEngineFromPath('/nonexistent/engine.cjs')).toThrow();
  });

  it('should throw if engine is missing required methods', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-test-'));
    const enginePath = path.join(tmpDir, 'engine.cjs');
    fs.writeFileSync(enginePath, `module.exports = { engine: { init() {} } };`);

    expect(() => loadEngineFromPath(enginePath)).toThrow('missing required method');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
