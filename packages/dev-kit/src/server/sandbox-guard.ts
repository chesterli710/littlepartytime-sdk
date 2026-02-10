// packages/dev-kit/src/server/sandbox-guard.ts
import type { GameEngine } from './engine-loader';

function createNoopTimer(name: string): (...args: unknown[]) => number {
  let warned = false;
  return (..._args: unknown[]) => {
    if (!warned) {
      console.warn(
        `[Sandbox] WARNING: ${name}() called in engine code. ` +
        `This is a no-op in the platform sandbox. ` +
        `Use client-side timers + platform.send() instead.`
      );
      warned = true;
    }
    return 0;
  };
}

function withTimerGuard<T>(fn: () => T): T {
  const origSetTimeout = globalThis.setTimeout;
  const origSetInterval = globalThis.setInterval;
  const origClearTimeout = globalThis.clearTimeout;
  const origClearInterval = globalThis.clearInterval;

  (globalThis as any).setTimeout = createNoopTimer('setTimeout');
  (globalThis as any).setInterval = createNoopTimer('setInterval');
  (globalThis as any).clearTimeout = () => {};
  (globalThis as any).clearInterval = () => {};

  try {
    return fn();
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.setInterval = origSetInterval;
    globalThis.clearTimeout = origClearTimeout;
    globalThis.clearInterval = origClearInterval;
  }
}

function checkStateSerializable(state: unknown, context: string): void {
  if (state == null) return;
  const warnings: string[] = [];
  walkObject(state, '', warnings);
  for (const w of warnings) {
    console.warn(`[Sandbox] WARNING: ${context} — ${w}`);
  }
}

function walkObject(obj: unknown, path: string, warnings: string[]): void {
  if (obj == null) return;

  if (typeof obj === 'function') {
    warnings.push(`Function at state${path} will be removed after JSON serialization.`);
    return;
  }
  if (obj instanceof Map) {
    warnings.push(`Map at state${path} will become {} after JSON serialization. Use a plain object instead.`);
    return;
  }
  if (obj instanceof Set) {
    warnings.push(`Set at state${path} will become {} after JSON serialization. Use an array instead.`);
    return;
  }
  if (obj instanceof Date) {
    warnings.push(`Date at state${path} will become a string after JSON serialization. Use an ISO string instead.`);
    return;
  }
  if (obj instanceof RegExp) {
    warnings.push(`RegExp at state${path} will become {} after JSON serialization.`);
    return;
  }

  if (typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      walkObject(obj[i], `${path}[${i}]`, warnings);
    }
  } else {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const val = (obj as Record<string, unknown>)[key];
      if (val === undefined) {
        warnings.push(`undefined at state${path}.${key} will be removed after JSON serialization.`);
      } else {
        walkObject(val, `${path}.${key}`, warnings);
      }
    }
  }
}

export function createSandboxedEngine(engine: GameEngine): GameEngine {
  return {
    init(players, options) {
      const state = withTimerGuard(() => engine.init(players, options));
      checkStateSerializable(state, 'init()');
      return state;
    },
    handleAction(state, playerId, action) {
      const newState = withTimerGuard(() => engine.handleAction(state, playerId, action));
      checkStateSerializable(newState, 'handleAction()');
      return newState;
    },
    isGameOver(state) {
      return withTimerGuard(() => engine.isGameOver(state));
    },
    getResult(state) {
      return withTimerGuard(() => engine.getResult(state));
    },
    getPlayerView(state, playerId) {
      return withTimerGuard(() => engine.getPlayerView(state, playerId));
    },
  };
}
