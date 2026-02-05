// packages/dev-kit/src/server/engine-loader.ts
import path from 'path';
import fs from 'fs';

export interface GameEngine {
  init(players: any[], options?: Record<string, unknown>): any;
  handleAction(state: any, playerId: string, action: any): any;
  isGameOver(state: any): boolean;
  getResult(state: any): any;
  getPlayerView(state: any, playerId: string): any;
}

let cachedEngine: GameEngine | null = null;
let cachedEnginePath: string | null = null;

export function loadEngine(projectDir: string): GameEngine {
  const enginePath = path.join(projectDir, 'dist', 'engine.cjs');

  if (!fs.existsSync(enginePath)) {
    throw new Error(`Engine not found at ${enginePath}. Run 'npm run build' first.`);
  }

  // Clear require cache for hot reload
  if (cachedEnginePath && require.cache[require.resolve(cachedEnginePath)]) {
    delete require.cache[require.resolve(cachedEnginePath)];
  }

  const module = require(enginePath);
  cachedEngine = module.engine || module.default?.engine || module;
  cachedEnginePath = enginePath;

  // Validate engine has required methods
  const required = ['init', 'handleAction', 'isGameOver', 'getResult', 'getPlayerView'];
  for (const method of required) {
    if (typeof (cachedEngine as any)[method] !== 'function') {
      throw new Error(`Engine missing required method: ${method}`);
    }
  }

  return cachedEngine as GameEngine;
}

export function getEngine(): GameEngine | null {
  return cachedEngine;
}

export function clearEngineCache(): void {
  if (cachedEnginePath && require.cache[require.resolve(cachedEnginePath)]) {
    delete require.cache[require.resolve(cachedEnginePath)];
  }
  cachedEngine = null;
  cachedEnginePath = null;
}
