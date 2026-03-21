# Dev-Kit LAN Access & `play` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LAN access to the dev-kit servers and a new `play` CLI command that loads game ZIP packages for testing without requiring a game project directory.

**Architecture:** Two independent features. LAN access changes server bindings from localhost to `0.0.0.0` and makes the frontend Socket.IO URL dynamic. The `play` command adds a new CLI entry point that starts a Vite static server + Socket.IO server, with a `ZipManager` handling ZIP extraction/validation and REST APIs for game lifecycle. The webapp gains a `GameSelector` component and dynamic bundle loading for play mode.

**Tech Stack:** Node.js, TypeScript, Vite 7, React 19, Socket.IO 4, archiver (for ZIP reading via Node built-in `zlib`/`fs`)

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `packages/dev-kit/src/cli.ts` | Add `play` command routing |
| `packages/dev-kit/src/commands/dev.ts` | Bind Vite to `0.0.0.0`, pass `__SOCKET_PORT__` and `__DEV_KIT_MODE__` via Vite define, print LAN URL |
| `packages/dev-kit/src/server/socket-server.ts` | Bind to `0.0.0.0` explicitly, accept optional `enginePath` instead of `projectDir` for play mode |
| `packages/dev-kit/src/server/engine-loader.ts` | Add `loadEngineFromPath(absolutePath)` function |
| `packages/dev-kit/src/webapp/pages/Play.tsx` | Use dynamic Socket.IO URL, conditionally show GameSelector in play mode |
| `packages/dev-kit/src/webapp/pages/Debug.tsx` | Use dynamic Socket.IO URL |
| `packages/dev-kit/src/webapp/pages/Preview.tsx` | Conditionally show GameSelector in play mode, load bundle dynamically |
| `packages/dev-kit/src/webapp/App.tsx` | Use dynamic Socket.IO URL for reset button |
| `packages/dev-kit/package.json` | Add `unzipper` dependency (or use Node built-in) |

### Files to Create

| File | Responsibility |
|------|---------------|
| `packages/dev-kit/src/server/zip-manager.ts` | ZIP extraction, validation, game registry lifecycle |
| `packages/dev-kit/src/server/games-api.ts` | REST API middleware for game CRUD operations |
| `packages/dev-kit/src/commands/play.ts` | `play` CLI command handler |
| `packages/dev-kit/src/server/lan-address.ts` | Utility to detect LAN IP address |
| `packages/dev-kit/src/webapp/components/GameSelector.tsx` | Game selector bar UI component |
| `packages/dev-kit/src/__tests__/zip-manager.test.ts` | Tests for ZipManager |
| `packages/dev-kit/src/__tests__/games-api.test.ts` | Tests for REST API handlers |
| `packages/dev-kit/src/__tests__/engine-loader.test.ts` | Tests for loadEngineFromPath |
| `packages/dev-kit/src/__tests__/lan-address.test.ts` | Tests for LAN address utility |

---

## Task 1: LAN Address Utility

**Files:**
- Create: `packages/dev-kit/src/server/lan-address.ts`
- Create: `packages/dev-kit/src/__tests__/lan-address.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dev-kit/src/__tests__/lan-address.test.ts
import { describe, it, expect } from 'vitest';
import { getLanAddress } from '../server/lan-address';

describe('getLanAddress', () => {
  it('should return a string or null', () => {
    const result = getLanAddress();
    if (result !== null) {
      // Should be a valid IPv4 address
      expect(result).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      // Should not be loopback
      expect(result).not.toBe('127.0.0.1');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/lan-address.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/dev-kit/src/server/lan-address.ts
import os from 'os';

/**
 * Returns the first non-loopback IPv4 address, or null if none found.
 */
export function getLanAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/lan-address.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dev-kit/src/server/lan-address.ts packages/dev-kit/src/__tests__/lan-address.test.ts
git commit -m "feat(dev-kit): add LAN address detection utility"
```

---

## Task 2: LAN Access — Server Binding & Dynamic URLs

**Files:**
- Modify: `packages/dev-kit/src/commands/dev.ts:156-183`
- Modify: `packages/dev-kit/src/server/socket-server.ts:240`
- Modify: `packages/dev-kit/src/webapp/pages/Play.tsx:41,75`
- Modify: `packages/dev-kit/src/webapp/pages/Debug.tsx:10`
- Modify: `packages/dev-kit/src/webapp/App.tsx:60`

- [ ] **Step 1: Update Vite config in dev.ts to bind to 0.0.0.0, pass socket port and mode via define**

In `packages/dev-kit/src/commands/dev.ts`, modify the `createServer` call (around line 156):

```typescript
  const vite: ViteDevServer = await createServer({
    root: webappDir,
    plugins: [react(), serveGameAssets(projectDir)],
    server: {
      port,
      host: '0.0.0.0',
      fs: {
        allow: [webappDir, projectDir],
      },
    },
    define: {
      __SOCKET_PORT__: JSON.stringify(socketPort),
      __DEV_KIT_MODE__: JSON.stringify('dev'),
    },
    resolve: {
      alias: {
        '/src': path.join(projectDir, 'src'),
        '/assets': path.join(projectDir, 'assets'),
      },
    },
  });
```

- [ ] **Step 2: Update startup banner in dev.ts to show LAN address**

Add import at top of `dev.ts`:

```typescript
import { getLanAddress } from '../server/lan-address';
```

Replace the console.log block (lines 175-183) with:

```typescript
  if (!options.silent) {
    const lanIp = getLanAddress();
    console.log(`  Preview:      http://localhost:${port}/preview`);
    console.log(`  Multiplayer:  http://localhost:${port}/play`);
    console.log(`  Debug Panel:  http://localhost:${port}/debug`);
    console.log(`  Socket.IO:    ws://localhost:${socketPort}`);
    if (lanIp) {
      console.log('');
      console.log(`  LAN:          http://${lanIp}:${port}`);
    }
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');
  }
```

- [ ] **Step 3: Update socket-server.ts to bind explicitly to 0.0.0.0**

In `packages/dev-kit/src/server/socket-server.ts`, change line 240 from:

```typescript
  server.listen(port, () => {
```

to:

```typescript
  server.listen(port, '0.0.0.0', () => {
```

- [ ] **Step 4: Update Play.tsx to use dynamic Socket.IO URL**

In `packages/dev-kit/src/webapp/pages/Play.tsx`, add type declaration at the top (after imports):

```typescript
declare const __SOCKET_PORT__: number;
```

Replace the two hardcoded `io('http://localhost:4001', ...)` calls (lines 41 and 75) with:

```typescript
const sock = io(`http://${window.location.hostname}:${__SOCKET_PORT__}`, { query });
```

and

```typescript
const sock = io(`http://${window.location.hostname}:${__SOCKET_PORT__}`, { query: { nickname } });
```

- [ ] **Step 5: Update Debug.tsx to use dynamic Socket.IO URL**

In `packages/dev-kit/src/webapp/pages/Debug.tsx`, add type declaration after imports:

```typescript
declare const __SOCKET_PORT__: number;
```

Change line 10 from:

```typescript
    const sock = io('http://localhost:4001', { query: { nickname: '__debug__' } });
```

to:

```typescript
    const sock = io(`http://${window.location.hostname}:${__SOCKET_PORT__}`, { query: { nickname: '__debug__' } });
```

- [ ] **Step 6: Update App.tsx reset button to use dynamic URL**

In `packages/dev-kit/src/webapp/App.tsx`, add type declaration after imports:

```typescript
declare const __SOCKET_PORT__: number;
```

Change line 60 from:

```typescript
          onClick={() => fetch('http://localhost:4001/api/reset', { method: 'POST' })}
```

to:

```typescript
          onClick={() => fetch(`http://${window.location.hostname}:${__SOCKET_PORT__}/api/reset`, { method: 'POST' })}
```

- [ ] **Step 7: Run tests to verify no regressions**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/dev-kit/src/commands/dev.ts packages/dev-kit/src/server/socket-server.ts packages/dev-kit/src/webapp/pages/Play.tsx packages/dev-kit/src/webapp/pages/Debug.tsx packages/dev-kit/src/webapp/App.tsx
git commit -m "feat(dev-kit): add LAN access support

Bind Vite and Socket.IO servers to 0.0.0.0 for local network access.
Frontend Socket.IO URL is now dynamic based on window.location.hostname.
Print LAN IP address in startup banner."
```

---

## Task 3: Extend Engine Loader

**Files:**
- Modify: `packages/dev-kit/src/server/engine-loader.ts`
- Create: `packages/dev-kit/src/__tests__/engine-loader.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dev-kit/src/__tests__/engine-loader.test.ts
import { describe, it, expect } from 'vitest';
import { loadEngineFromPath } from '../server/engine-loader';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('loadEngineFromPath', () => {
  it('should load engine from an arbitrary absolute path', () => {
    // Create a temp engine file
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

    // Verify it works
    const state = engine.init([{ id: 'p1' }, { id: 'p2' }]);
    expect(state.players).toEqual(['p1', 'p2']);

    // Cleanup
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/engine-loader.test.ts`
Expected: FAIL — `loadEngineFromPath` is not exported

- [ ] **Step 3: Implement loadEngineFromPath**

Add to `packages/dev-kit/src/server/engine-loader.ts`, after the existing `clearEngineCache` function:

```typescript
/**
 * Load engine from an arbitrary absolute path (for play mode).
 * Does NOT use the shared cache — each call loads fresh.
 */
export function loadEngineFromPath(enginePath: string): GameEngine {
  if (!fs.existsSync(enginePath)) {
    throw new Error(`Engine not found at ${enginePath}`);
  }

  // Clear require cache for this path
  const resolved = require.resolve(enginePath);
  if (require.cache[resolved]) {
    delete require.cache[resolved];
  }

  const module = require(enginePath);
  const engine: GameEngine = module.engine || module.default?.engine || module;

  // Validate engine has required methods
  const required = ['init', 'handleAction', 'isGameOver', 'getResult', 'getPlayerView'];
  for (const method of required) {
    if (typeof (engine as any)[method] !== 'function') {
      throw new Error(`Engine missing required method: ${method}`);
    }
  }

  return engine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/engine-loader.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/dev-kit/src/server/engine-loader.ts packages/dev-kit/src/__tests__/engine-loader.test.ts
git commit -m "feat(dev-kit): add loadEngineFromPath for arbitrary engine loading"
```

---

## Task 4: ZipManager

**Files:**
- Create: `packages/dev-kit/src/server/zip-manager.ts`
- Create: `packages/dev-kit/src/__tests__/zip-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/dev-kit/src/__tests__/zip-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZipManager } from '../server/zip-manager';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';

// Helper: create a valid game ZIP in a temp directory
async function createTestZip(dir: string, filename: string, options?: { skipEngine?: boolean; skipBundle?: boolean; skipManifest?: boolean }): Promise<string> {
  const zipPath = path.join(dir, filename);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip');
  archive.pipe(output);

  if (!options?.skipManifest) {
    archive.append(JSON.stringify({
      name: 'Test Game',
      description: 'A test game',
      version: '1.0.0',
      sdkVersion: '2.0.0',
      minPlayers: 2,
      maxPlayers: 6,
      tags: ['test'],
      assets: { icon: 'icon.png', banner: 'banner.png', cover: 'cover.png', splash: 'splash.png' },
      rules: 'rules.md',
    }), { name: 'manifest.json' });
  }

  if (!options?.skipEngine) {
    archive.append(`
      module.exports = {
        engine: {
          init(players) { return { players: players.map(p => p.id), turn: 0 }; },
          handleAction(state, pid, action) { return { ...state, turn: state.turn + 1 }; },
          isGameOver(state) { return state.turn >= 3; },
          getResult(state) { return { winner: state.players[0] }; },
          getPlayerView(state, pid) { return state; },
        }
      };
    `, { name: 'engine.cjs' });
  }

  if (!options?.skipBundle) {
    archive.append('// bundle.js\nconsole.log("game");', { name: 'bundle.js' });
  }

  // Add a dummy icon
  archive.append(Buffer.from('PNG'), { name: 'icon.png' });

  // Add a game asset
  archive.append(Buffer.from('sprite data'), { name: 'assets/sprite.png' });

  await archive.finalize();
  await new Promise<void>((resolve) => output.on('close', resolve));
  return zipPath;
}

describe('ZipManager', () => {
  let tmpDir: string;
  let manager: ZipManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-zip-test-'));
    manager = new ZipManager();
  });

  afterEach(() => {
    manager.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load a valid ZIP file', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    const entry = await manager.loadZip(zipPath);

    expect(entry.name).toBe('Test Game');
    expect(entry.version).toBe('1.0.0');
    expect(entry.minPlayers).toBe(2);
    expect(entry.maxPlayers).toBe(6);
    expect(fs.existsSync(entry.enginePath)).toBe(true);
    expect(fs.existsSync(entry.bundlePath)).toBe(true);
  });

  it('should list loaded games', async () => {
    const zip1 = await createTestZip(tmpDir, 'game1.zip');
    const zip2 = await createTestZip(tmpDir, 'game2.zip');
    await manager.loadZip(zip1);
    await manager.loadZip(zip2);

    const games = manager.listGames();
    expect(games).toHaveLength(2);
  });

  it('should get a game by id', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    const entry = await manager.loadZip(zipPath);

    expect(manager.getGame(entry.id)).toBe(entry);
    expect(manager.getGame('nonexistent')).toBeUndefined();
  });

  it('should remove a game and clean up temp files', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    const entry = await manager.loadZip(zipPath);
    const extractDir = entry.extractDir;

    expect(fs.existsSync(extractDir)).toBe(true);
    manager.removeGame(entry.id);
    expect(manager.getGame(entry.id)).toBeUndefined();
    expect(fs.existsSync(extractDir)).toBe(false);
  });

  it('should reject ZIP missing engine.cjs', async () => {
    const zipPath = await createTestZip(tmpDir, 'bad.zip', { skipEngine: true });
    await expect(manager.loadZip(zipPath)).rejects.toThrow('engine.cjs');
  });

  it('should reject ZIP missing bundle.js', async () => {
    const zipPath = await createTestZip(tmpDir, 'bad.zip', { skipBundle: true });
    await expect(manager.loadZip(zipPath)).rejects.toThrow('bundle.js');
  });

  it('should reject ZIP missing manifest.json', async () => {
    const zipPath = await createTestZip(tmpDir, 'bad.zip', { skipManifest: true });
    await expect(manager.loadZip(zipPath)).rejects.toThrow('manifest.json');
  });

  it('should load from buffer (upload simulation)', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    const buffer = fs.readFileSync(zipPath);
    const entry = await manager.loadFromUpload(buffer, 'uploaded-game.zip');

    expect(entry.name).toBe('Test Game');
    expect(fs.existsSync(entry.enginePath)).toBe(true);
  });

  it('should clean up all temp directories on cleanup()', async () => {
    const zip1 = await createTestZip(tmpDir, 'game1.zip');
    const zip2 = await createTestZip(tmpDir, 'game2.zip');
    const e1 = await manager.loadZip(zip1);
    const e2 = await manager.loadZip(zip2);

    manager.cleanup();
    expect(fs.existsSync(e1.extractDir)).toBe(false);
    expect(fs.existsSync(e2.extractDir)).toBe(false);
    expect(manager.listGames()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/zip-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ZipManager**

```typescript
// packages/dev-kit/src/server/zip-manager.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface GameEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  minPlayers: number;
  maxPlayers: number;
  iconPath: string | null;
  extractDir: string;
  enginePath: string;
  bundlePath: string;
  assetsDir: string | null;
}

export class ZipManager {
  private games: Map<string, GameEntry> = new Map();

  async loadZip(zipPath: string): Promise<GameEntry> {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-game-'));

    // Extract using system unzip (available on macOS/Linux)
    try {
      execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);
    } catch {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error(`Failed to extract ZIP: ${zipPath}`);
    }

    return this.registerFromDir(extractDir);
  }

  async loadFromUpload(buffer: Buffer, filename: string): Promise<GameEntry> {
    // Write buffer to temp file, then extract
    const tmpZip = path.join(os.tmpdir(), `lpt-upload-${Date.now()}-${filename}`);
    fs.writeFileSync(tmpZip, buffer);

    try {
      const entry = await this.loadZip(tmpZip);
      return entry;
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  }

  private registerFromDir(extractDir: string): GameEntry {
    // Validate required files
    const manifestPath = path.join(extractDir, 'manifest.json');
    const enginePath = path.join(extractDir, 'engine.cjs');
    const bundlePath = path.join(extractDir, 'bundle.js');

    if (!fs.existsSync(manifestPath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing manifest.json');
    }
    if (!fs.existsSync(enginePath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing engine.cjs');
    }
    if (!fs.existsSync(bundlePath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing bundle.js');
    }

    // Read manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Find icon
    let iconPath: string | null = null;
    const iconName = manifest.assets?.icon;
    if (iconName) {
      const candidate = path.join(extractDir, iconName);
      if (fs.existsSync(candidate)) iconPath = candidate;
    }

    // Check for assets directory
    const assetsDir = path.join(extractDir, 'assets');
    const hasAssetsDir = fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory();

    const id = `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: GameEntry = {
      id,
      name: manifest.name || 'Unknown Game',
      description: manifest.description || '',
      version: manifest.version || '0.0.0',
      minPlayers: manifest.minPlayers ?? 2,
      maxPlayers: manifest.maxPlayers ?? 8,
      iconPath,
      extractDir,
      enginePath,
      bundlePath,
      assetsDir: hasAssetsDir ? assetsDir : null,
    };

    this.games.set(id, entry);
    return entry;
  }

  getGame(id: string): GameEntry | undefined {
    return this.games.get(id);
  }

  listGames(): GameEntry[] {
    return Array.from(this.games.values());
  }

  removeGame(id: string): void {
    const entry = this.games.get(id);
    if (entry) {
      fs.rmSync(entry.extractDir, { recursive: true, force: true });
      this.games.delete(id);
    }
  }

  cleanup(): void {
    for (const entry of this.games.values()) {
      fs.rmSync(entry.extractDir, { recursive: true, force: true });
    }
    this.games.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/zip-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dev-kit/src/server/zip-manager.ts packages/dev-kit/src/__tests__/zip-manager.test.ts
git commit -m "feat(dev-kit): add ZipManager for game ZIP extraction and lifecycle"
```

---

## Task 5: Games REST API Middleware

**Files:**
- Create: `packages/dev-kit/src/server/games-api.ts`
- Create: `packages/dev-kit/src/__tests__/games-api.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/dev-kit/src/__tests__/games-api.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';
import { ZipManager } from '../server/zip-manager';
import { createGamesApi } from '../server/games-api';

// Helper: create a valid game ZIP
async function createTestZip(dir: string, filename: string): Promise<string> {
  const zipPath = path.join(dir, filename);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip');
  archive.pipe(output);

  archive.append(JSON.stringify({
    name: 'Test Game',
    description: 'A test',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    minPlayers: 2,
    maxPlayers: 6,
    tags: [],
    assets: { icon: 'icon.png', banner: 'banner.png', cover: 'cover.png', splash: 'splash.png' },
    rules: 'rules.md',
  }), { name: 'manifest.json' });

  archive.append(`
    module.exports = {
      engine: {
        init(players) { return { players: players.map(p => p.id) }; },
        handleAction(state) { return state; },
        isGameOver() { return false; },
        getResult(state) { return {}; },
        getPlayerView(state) { return state; },
      }
    };
  `, { name: 'engine.cjs' });

  archive.append('// bundle', { name: 'bundle.js' });
  archive.append(Buffer.from('PNG'), { name: 'icon.png' });

  await archive.finalize();
  await new Promise<void>((resolve) => output.on('close', resolve));
  return zipPath;
}

function makeRequest(server: http.Server, method: string, path: string, body?: Buffer, contentType?: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const req = http.request({ hostname: '127.0.0.1', port: addr.port, path, method, headers: contentType ? { 'Content-Type': contentType } : {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode!, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('Games API', () => {
  let tmpDir: string;
  let manager: ZipManager;
  let server: http.Server;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-api-test-'));
    manager = new ZipManager();

    const middleware = createGamesApi(manager);
    server = http.createServer(middleware);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    manager.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/games should return empty list initially', async () => {
    const res = await makeRequest(server, 'GET', '/api/games');
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.games).toEqual([]);
  });

  it('GET /api/games should list loaded games', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    await manager.loadZip(zipPath);

    const res = await makeRequest(server, 'GET', '/api/games');
    const data = JSON.parse(res.body);
    expect(data.games).toHaveLength(1);
    expect(data.games[0].name).toBe('Test Game');
  });

  it('DELETE /api/games/:id should remove a game', async () => {
    const zipPath = await createTestZip(tmpDir, 'game.zip');
    const entry = await manager.loadZip(zipPath);

    const res = await makeRequest(server, 'DELETE', `/api/games/${entry.id}`);
    expect(res.statusCode).toBe(200);
    expect(manager.listGames()).toHaveLength(0);
  });

  it('DELETE /api/games/:id should 404 for unknown id', async () => {
    const res = await makeRequest(server, 'DELETE', '/api/games/nonexistent');
    expect(res.statusCode).toBe(404);
  });

  it('should 404 for unknown routes', async () => {
    const res = await makeRequest(server, 'GET', '/api/unknown');
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/games-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement games-api.ts**

```typescript
// packages/dev-kit/src/server/games-api.ts
import http from 'http';
import fs from 'fs';
import path from 'path';
import { ZipManager, GameEntry } from './zip-manager';

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

export interface GamesApiCallbacks {
  onActivate?: (entry: GameEntry) => void;
}

export function createGamesApi(
  manager: ZipManager,
  callbacks?: GamesApiCallbacks,
): http.RequestListener {
  let activeGameId: string | null = null;

  return (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';

    // GET /api/games
    if (req.method === 'GET' && url === '/api/games') {
      const games = manager.listGames().map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        version: g.version,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        active: g.id === activeGameId,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ games, activeGameId }));
      return;
    }

    // POST /api/games/upload
    if (req.method === 'POST' && url === '/api/games/upload') {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_UPLOAD_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File too large (max 50MB)' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', async () => {
        if (res.writableEnded) return;
        const buffer = Buffer.concat(chunks);

        try {
          const entry = await manager.loadFromUpload(buffer, 'upload.zip');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: entry.id,
            name: entry.name,
            version: entry.version,
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }

    // POST /api/games/:id/activate
    const activateMatch = url.match(/^\/api\/games\/([^/]+)\/activate$/);
    if (req.method === 'POST' && activateMatch) {
      const id = activateMatch[1];
      const entry = manager.getGame(id);
      if (!entry) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Game not found' }));
        return;
      }

      activeGameId = id;
      callbacks?.onActivate?.(entry);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, activeGameId: id }));
      return;
    }

    // GET /api/games/active/bundle.js
    if (req.method === 'GET' && url === '/api/games/active/bundle.js') {
      if (!activeGameId) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active game' }));
        return;
      }
      const entry = manager.getGame(activeGameId);
      if (!entry) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Active game not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      fs.createReadStream(entry.bundlePath).pipe(res);
      return;
    }

    // GET /api/games/active/assets/*
    if (req.method === 'GET' && url.startsWith('/api/games/active/assets/')) {
      if (!activeGameId) {
        res.writeHead(404);
        res.end();
        return;
      }
      const entry = manager.getGame(activeGameId);
      if (!entry || !entry.assetsDir) {
        res.writeHead(404);
        res.end();
        return;
      }

      const relativePath = url.slice('/api/games/active/assets/'.length);
      const filePath = path.join(entry.assetsDir, relativePath);

      // Prevent directory traversal
      if (!filePath.startsWith(entry.assetsDir)) {
        res.writeHead(403);
        res.end();
        return;
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // GET /api/games/:id/icon
    const iconMatch = url.match(/^\/api\/games\/([^/]+)\/icon$/);
    if (req.method === 'GET' && iconMatch) {
      const entry = manager.getGame(iconMatch[1]);
      if (!entry || !entry.iconPath || !fs.existsSync(entry.iconPath)) {
        res.writeHead(404);
        res.end();
        return;
      }

      const ext = path.extname(entry.iconPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'image/png';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(entry.iconPath).pipe(res);
      return;
    }

    // DELETE /api/games/:id
    const deleteMatch = url.match(/^\/api\/games\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      const entry = manager.getGame(id);
      if (!entry) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Game not found' }));
        return;
      }

      if (activeGameId === id) {
        activeGameId = null;
      }
      manager.removeGame(id);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/games-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dev-kit/src/server/games-api.ts packages/dev-kit/src/__tests__/games-api.test.ts
git commit -m "feat(dev-kit): add REST API middleware for game lifecycle management"
```

---

## Task 6: Socket.IO Server — Support Engine Hot-Swap for Play Mode

**Files:**
- Modify: `packages/dev-kit/src/server/socket-server.ts`

The socket server currently accepts `projectDir` and loads the engine from `projectDir/dist/engine.cjs`. For play mode, it needs to support loading from an arbitrary path and exposing a `swapEngine` method that resets the room and reloads.

- [ ] **Step 1: Add optional `enginePath` to SocketServerOptions and a `swapEngine` method**

In `packages/dev-kit/src/server/socket-server.ts`:

Update the `SocketServerOptions` interface:

```typescript
export interface SocketServerOptions {
  port: number;
  projectDir?: string;   // For dev mode (loads from projectDir/dist/engine.cjs)
  enginePath?: string;    // For play mode (loads from arbitrary path)
  onStateChange?: (room: GameRoom.GameRoom) => void;
  onLog?: (message: string) => void;
}
```

Update the engine loading at the top of `createSocketServer`:

```typescript
  // Load engine with sandbox guard
  let engine: ReturnType<typeof createSandboxedEngine>;
  if (options.enginePath) {
    engine = createSandboxedEngine(loadEngineFromPath(options.enginePath));
    log(`Engine loaded from ${options.enginePath}`);
  } else if (options.projectDir) {
    engine = createSandboxedEngine(loadEngine(options.projectDir));
    log(`Engine loaded from ${options.projectDir}`);
  } else {
    // No engine yet — play mode starts without a game
    engine = null as any;
    log('Started without engine (play mode)');
  }
```

Add `loadEngineFromPath` to the imports:

```typescript
import { loadEngine, clearEngineCache, getEngine, loadEngineFromPath } from './engine-loader';
```

Update the return type to include `swapEngine`:

```typescript
  return {
    server,
    io,
    getRoom: () => room,
    reloadEngine: () => {
      clearEngineCache();
      engine = createSandboxedEngine(loadEngine(options.projectDir!));
      log(`Engine reloaded`);
    },
    swapEngine: (newEnginePath: string) => {
      engine = createSandboxedEngine(loadEngineFromPath(newEnginePath));
      GameRoom.resetAll(room);
      io.disconnectSockets(true);
      log(`Engine swapped to ${newEnginePath}`);
    },
  };
```

Also add null guards in the `io.on('connection')` handler for **all** engine call sites. Here is the complete list of lines that reference `engine` and need guards:

1. **Line 105** — reconnection state send: `engine.getPlayerView(room.state, player.id)` — wrap with `if (engine) { ... }`
2. **Line 125** — `game:start` handler: `GameRoom.startGame(room, engine)` — add `if (!engine) { log('No engine loaded'); return; }` before this line
3. **Line 129-134** — initial state broadcast inside `game:start`: `engine.getPlayerView(room.state, p.id)` — already guarded by the check at line 125
4. **Line 149** — `game:action` handler: `GameRoom.handleAction(room, engine, player.id, action)` — add `if (!engine) return;` at the start of the handler
5. **Line 155** — inside `game:action`: `engine.getPlayerView(room.state, p.id)` — guarded by check at 149
6. **Line 162** — inside `game:action`: `engine.getResult(room.state)` — guarded by check at 149

Add at the top of `createSocketServer` function for the engine type:

```typescript
  let engine: ReturnType<typeof createSandboxedEngine> | null;
```

- [ ] **Step 2: Run all tests to verify no regressions**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/dev-kit/src/server/socket-server.ts
git commit -m "feat(dev-kit): support engine hot-swap and optional engine loading in socket server"
```

---

## Task 7: `play` CLI Command

**Files:**
- Create: `packages/dev-kit/src/commands/play.ts`
- Modify: `packages/dev-kit/src/cli.ts`

- [ ] **Step 1: Implement play.ts**

```typescript
// packages/dev-kit/src/commands/play.ts
import path from 'path';
import fs from 'fs';
import { createServer, ViteDevServer } from 'vite';
import { createSocketServer } from '../server/socket-server';
import { ZipManager } from '../server/zip-manager';
import { createGamesApi } from '../server/games-api';
import { getLanAddress } from '../server/lan-address';

export interface PlayOptions {
  port?: number;
  socketPort?: number;
  dir?: string;
}

export async function playCommand(options: PlayOptions = {}): Promise<void> {
  const port = options.port || 4000;
  const socketPort = options.socketPort || 4001;

  console.log('');
  console.log('  Little Party Time — Play Mode');
  console.log('  =============================');
  console.log('');

  const zipManager = new ZipManager();

  // Pre-load ZIPs from directory if specified
  if (options.dir) {
    const dir = path.resolve(options.dir);
    if (!fs.existsSync(dir)) {
      console.error(`  ERROR: Directory not found: ${dir}`);
      process.exit(1);
    }

    const zipFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
    if (zipFiles.length === 0) {
      console.log(`  No .zip files found in ${dir}`);
    } else {
      for (const zipFile of zipFiles) {
        try {
          const entry = await zipManager.loadZip(path.join(dir, zipFile));
          console.log(`  Loaded: ${entry.name} v${entry.version} (${zipFile})`);
        } catch (err) {
          console.error(`  Failed to load ${zipFile}: ${(err as Error).message}`);
        }
      }
    }
  }

  // Start Socket.IO server (no engine initially)
  const { server: httpServer, io, swapEngine } = createSocketServer({
    port: socketPort,
  });

  // Create games API with onActivate callback to swap engine
  const gamesApi = createGamesApi(zipManager, {
    onActivate: (entry) => {
      console.log(`  Activated: ${entry.name} v${entry.version}`);
      swapEngine(entry.enginePath);
    },
  });

  // Start Vite server
  const webappDir = path.join(__dirname, '..', 'webapp');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('@vitejs/plugin-react').default;

  /**
   * Vite plugin that provides a virtual module `virtual:active-game`.
   * When the frontend does `import('virtual:active-game')`, Vite loads the
   * active game's bundle.js content and resolves its bare imports (react,
   * react-dom, etc.) through the normal Vite module pipeline.
   *
   * This is necessary because game bundles are ES modules with externalized
   * dependencies. Loading them via <script> tags won't resolve the bare imports.
   */
  function activeGamePlugin(): import('vite').Plugin {
    return {
      name: 'serve-active-game',
      resolveId(id) {
        // Strip query params for resolution, keep for cache busting
        if (id.startsWith('virtual:active-game')) return id;
      },
      load(id) {
        if (!id.startsWith('virtual:active-game')) return;
        const games = zipManager.listGames();
        // Find the active game (determined by games-api activeGameId)
        // The activeGameId is communicated via query param in the import URL
        const match = id.match(/\?id=([^&]+)/);
        const gameId = match?.[1];
        const entry = gameId ? zipManager.getGame(gameId) : undefined;
        if (!entry) {
          return 'export default null; export const Renderer = null; export const engine = null; export const config = null;';
        }
        return fs.readFileSync(entry.bundlePath, 'utf-8');
      },
    };
  }

  const vite: ViteDevServer = await createServer({
    root: webappDir,
    plugins: [
      react(),
      activeGamePlugin(),
      {
        name: 'serve-games-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/games')) {
              gamesApi(req, res);
            } else {
              next();
            }
          });
        },
      },
    ],
    server: {
      port,
      host: '0.0.0.0',
      fs: {
        allow: [webappDir],
      },
    },
    define: {
      __SOCKET_PORT__: JSON.stringify(socketPort),
      __DEV_KIT_MODE__: JSON.stringify('play'),
    },
  });

  await vite.listen();

  const lanIp = getLanAddress();
  console.log(`  Play:         http://localhost:${port}/play`);
  console.log(`  Preview:      http://localhost:${port}/preview`);
  console.log(`  Debug:        http://localhost:${port}/debug`);
  console.log(`  Socket.IO:    ws://localhost:${socketPort}`);
  if (lanIp) {
    console.log('');
    console.log(`  LAN:          http://${lanIp}:${port}`);
  }
  console.log('');
  console.log(`  Games loaded: ${zipManager.listGames().length}`);
  console.log('  Upload games via the web UI or use --dir to pre-load.');
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');

  // Cleanup on exit
  const cleanup = () => {
    zipManager.cleanup();
    io.close();
    httpServer.close();
    vite.close();
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}
```

- [ ] **Step 2: Update cli.ts to add play command**

In `packages/dev-kit/src/cli.ts`, update the switch statement:

```typescript
#!/usr/bin/env node

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'pack': {
      const { packCommand } = await import('./commands/pack');
      await packCommand(process.cwd());
      break;
    }
    case 'dev': {
      const { devCommand } = await import('./commands/dev');
      await devCommand(process.cwd());
      break;
    }
    case 'play': {
      const { playCommand } = await import('./commands/play');
      // Parse --dir, --port, --socketPort from argv
      const args = process.argv.slice(3);
      const options: Record<string, string> = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--') && i + 1 < args.length) {
          options[args[i].slice(2)] = args[i + 1];
          i++;
        }
      }
      await playCommand({
        dir: options.dir,
        port: options.port ? Number(options.port) : undefined,
        socketPort: options.socketPort ? Number(options.socketPort) : undefined,
      });
      break;
    }
    default:
      console.log('Usage: lpt-dev-kit <command>');
      console.log('');
      console.log('Commands:');
      console.log('  dev     Start development server');
      console.log('  play    Load and test game ZIP packages');
      console.log('  pack    Build and package game as .zip');
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run all tests**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/dev-kit/src/commands/play.ts packages/dev-kit/src/cli.ts
git commit -m "feat(dev-kit): add play command for loading and testing game ZIP packages"
```

---

## Task 8: GameSelector Component

**Files:**
- Create: `packages/dev-kit/src/webapp/components/GameSelector.tsx`

- [ ] **Step 1: Create GameSelector component**

```tsx
// packages/dev-kit/src/webapp/components/GameSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';

declare const __SOCKET_PORT__: number;

interface GameInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  minPlayers: number;
  maxPlayers: number;
  active: boolean;
}

interface GameSelectorProps {
  onGameActivated?: () => void;
}

export default function GameSelector({ onGameActivated }: GameSelectorProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `http://${window.location.hostname}:${window.location.port}`;

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/games`);
      const data = await res.json();
      setGames(data.games);
    } catch {
      // ignore fetch errors
    }
  }, [apiBase]);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch(`${apiBase}/api/games/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      await fetchGames();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  }, [apiBase, fetchGames]);

  const activate = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/api/games/${id}/activate`, { method: 'POST' });
      await fetchGames();
      onGameActivated?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [apiBase, fetchGames, onGameActivated]);

  const remove = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/api/games/${id}`, { method: 'DELETE' });
      await fetchGames();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [apiBase, fetchGames]);

  if (games.length === 0 && !uploading) {
    return (
      <div style={{ background: '#18181b', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#71717a', fontSize: 13 }}>No games loaded.</span>
        <label style={{ background: '#d97706', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Upload ZIP
          <input type="file" accept=".zip" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ background: '#18181b', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {games.map((game) => (
          <div
            key={game.id}
            onClick={() => !game.active && activate(game.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 6,
              cursor: game.active ? 'default' : 'pointer',
              border: game.active ? '2px solid #d97706' : '1px solid #3f3f46',
              background: game.active ? 'rgba(217, 119, 6, 0.15)' : '#27272a',
              fontSize: 13,
            }}
          >
            <img
              src={`/api/games/${game.id}/icon`}
              alt=""
              style={{ width: 24, height: 24, borderRadius: 4 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <div style={{ color: '#e5e5e5', fontWeight: 600 }}>{game.name}</div>
              <div style={{ color: '#71717a', fontSize: 10 }}>v{game.version} · {game.minPlayers}-{game.maxPlayers}p</div>
            </div>
            {!game.active && (
              <button
                onClick={(e) => { e.stopPropagation(); remove(game.id); }}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                title="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <label style={{
          background: '#3f3f46',
          color: '#d4d4d8',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 13,
          cursor: uploading ? 'default' : 'pointer',
          fontWeight: 600,
          opacity: uploading ? 0.5 : 1,
        }}>
          {uploading ? 'Uploading...' : '+ Upload'}
          <input type="file" accept=".zip" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dev-kit/src/webapp/components/GameSelector.tsx
git commit -m "feat(dev-kit): add GameSelector component for play mode UI"
```

---

## Task 9: Integrate GameSelector into Play and Preview Pages

**Files:**
- Modify: `packages/dev-kit/src/webapp/pages/Play.tsx`
- Modify: `packages/dev-kit/src/webapp/pages/Preview.tsx`

- [ ] **Step 1: Update Play.tsx for play mode**

At the top of `Play.tsx`, add:

```typescript
declare const __DEV_KIT_MODE__: string;
```

(The `__SOCKET_PORT__` declaration was already added in Task 2.)

Add import for GameSelector:

```typescript
import GameSelector from '../components/GameSelector';
```

Replace the renderer loading `useEffect` (lines 26-29) with mode-aware loading.

**Important**: Game bundles are ES modules with externalized `react`/`react-dom`. They cannot be loaded via `<script>` tags. Instead, use a Vite virtual module (`virtual:active-game`) that pipes the bundle content through Vite's transform pipeline to resolve bare imports.

```typescript
  // Track active game ID for bundle loading
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Fetch active game ID on mount (play mode only)
  useEffect(() => {
    if (__DEV_KIT_MODE__ !== 'play') return;
    const fetchActive = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:${window.location.port}/api/games`);
        const data = await res.json();
        if (data.activeGameId) setActiveGameId(data.activeGameId);
      } catch { /* ignore */ }
    };
    fetchActive();
  }, []);

  // Load renderer
  useEffect(() => {
    if (__DEV_KIT_MODE__ === 'play') {
      if (!activeGameId) return;
      // Use Vite virtual module — Vite resolves bare imports (react, etc.)
      import(/* @vite-ignore */ `virtual:active-game?id=${activeGameId}&t=${Date.now()}`)
        .then((mod) => {
          setGameRenderer(() => mod.Renderer || mod.default);
        })
        .catch(console.error);
    } else {
      // Dev mode: import from source
      import('/src/renderer.tsx').then((mod) => {
        setGameRenderer(() => mod.default || mod.Renderer);
      }).catch(console.error);
    }
  }, [activeGameId]);
```

Add a callback for when a game is activated (reloads the bundle):

```typescript
  const handleGameActivated = useCallback(async () => {
    setGameRenderer(null);
    setGameState(null);
    // Re-fetch active game ID to trigger reload
    try {
      const res = await fetch(`http://${window.location.hostname}:${window.location.port}/api/games`);
      const data = await res.json();
      if (data.activeGameId) setActiveGameId(data.activeGameId);
    } catch { /* ignore */ }
  }, []);
```

In the `platform` useMemo, update `getAssetUrl` for play mode:

```typescript
      getAssetUrl: (assetPath: string) =>
        __DEV_KIT_MODE__ === 'play'
          ? `/api/games/active/assets/${assetPath}`
          : `/assets/${assetPath}`,
```

In the JSX, add `GameSelector` at the top of the playing/ended view (before PhoneFrame), conditionally rendered:

```tsx
  // Playing or ended
  return (
    <div>
      {__DEV_KIT_MODE__ === 'play' && <GameSelector onGameActivated={handleGameActivated} />}
      <div style={{ height: __DEV_KIT_MODE__ === 'play' ? 'calc(100vh - 140px)' : 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        ...existing PhoneFrame and host controls...
      </div>
    </div>
  );
```

Also add GameSelector to the lobby view:

```tsx
  if (room.phase === 'lobby' || room.phase === 'ready') {
    return (
      <div>
        {__DEV_KIT_MODE__ === 'play' && <GameSelector onGameActivated={handleGameActivated} />}
        <div style={{ maxWidth: 448, margin: '32px auto 0' }}>
          ...existing lobby UI...
        </div>
      </div>
    );
  }
```

And the join screen:

```tsx
  if (!joined && !isAutoMode) {
    return (
      <div>
        {__DEV_KIT_MODE__ === 'play' && <GameSelector />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          ...existing join UI...
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Update Preview.tsx for play mode**

At the top of `Preview.tsx`, add:

```typescript
declare const __DEV_KIT_MODE__: string;
```

Add import:

```typescript
import GameSelector from '../components/GameSelector';
```

Replace the module loading `useEffect` (lines 54-76) with mode-aware loading using the same Vite virtual module approach:

```typescript
  // Track active game ID for play mode bundle loading
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Fetch active game ID on mount (play mode only)
  useEffect(() => {
    if (__DEV_KIT_MODE__ !== 'play') return;
    const fetchActive = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:${window.location.port}/api/games`);
        const data = await res.json();
        if (data.activeGameId) setActiveGameId(data.activeGameId);
      } catch { /* ignore */ }
    };
    fetchActive();
  }, []);

  // Load renderer, engine, and config dynamically
  useEffect(() => {
    if (__DEV_KIT_MODE__ === 'play') {
      if (!activeGameId) return;
      // Use Vite virtual module for ES module resolution
      import(/* @vite-ignore */ `virtual:active-game?id=${activeGameId}&t=${Date.now()}`)
        .then((mod) => {
          setGameRenderer(() => mod.Renderer || mod.default);
          if (mod.engine) setEngine(mod.engine);
          if (mod.config) {
            setConfig(mod.config);
            setPlayerCount(mod.config.minPlayers ?? 3);
          } else {
            setPlayerCount(3);
          }
        })
        .catch((err) => {
          console.error('Failed to load game module:', err);
          setPlayerCount(3);
        });
    } else {
      // Dev mode: import from source
      import('/src/index.ts').then((mod) => {
        setGameRenderer(() => mod.Renderer || mod.default);
        if (mod.engine) setEngine(mod.engine);
        if (mod.config) {
          setConfig(mod.config);
          setPlayerCount(mod.config.minPlayers ?? 3);
        } else {
          setPlayerCount(3);
        }
      }).catch((err) => {
        console.error('Failed to load game module:', err);
        setPlayerCount(3);
        import('/src/renderer.tsx').then((mod) => {
          setGameRenderer(() => mod.default || mod.Renderer);
        }).catch(console.error);
      });
    }
  }, [activeGameId]);
```

Add game activated callback:

```typescript
  const handleGameActivated = useCallback(async () => {
    setGameRenderer(null);
    setEngine(null);
    setFullState(null);
    setViewState(null);
    setGameOver(false);
    setGameResult(null);
    setActions([]);
    // Re-fetch active game ID to trigger reload via useEffect
    try {
      const res = await fetch(`http://${window.location.hostname}:${window.location.port}/api/games`);
      const data = await res.json();
      if (data.activeGameId) setActiveGameId(data.activeGameId);
    } catch { /* ignore */ }
  }, []);
```

Update `getAssetUrl` in the platform useMemo:

```typescript
      getAssetUrl: (assetPath: string) =>
        __DEV_KIT_MODE__ === 'play'
          ? `/api/games/active/assets/${assetPath}`
          : `/assets/${assetPath}`,
```

Add GameSelector at the top of the return JSX:

```tsx
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {__DEV_KIT_MODE__ === 'play' && <GameSelector onGameActivated={handleGameActivated} />}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        ...existing preview layout...
      </div>
    </div>
  );
```

- [ ] **Step 3: Run all tests**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/dev-kit/src/webapp/pages/Play.tsx packages/dev-kit/src/webapp/pages/Preview.tsx
git commit -m "feat(dev-kit): integrate GameSelector into Play and Preview pages for play mode"
```

---

## Task 10: Build, Manual Test, and Final Commit

**Files:**
- Modify: `packages/dev-kit/package.json` (version bump)

- [ ] **Step 1: Run full test suite**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

- [ ] **Step 2: Build the package**

Run: `npm run build --workspace=@littlepartytime/dev-kit`
Expected: Build succeeds

- [ ] **Step 3: Verify the build output includes new files**

Run: `cd packages/dev-kit && npm pack --dry-run`
Expected: Output includes:
- `dist/commands/play.js`
- `dist/server/zip-manager.js`
- `dist/server/games-api.js`
- `dist/server/lan-address.js`
- `dist/webapp/components/GameSelector.tsx` (TSX is copied as-is, compiled by Vite at runtime)

- [ ] **Step 4: Bump version in package.json**

This is a minor version bump (new feature, backward compatible). Change `"version": "1.19.1"` to `"version": "1.20.0"` in `packages/dev-kit/package.json`.

- [ ] **Step 5: Final commit**

```bash
git add packages/dev-kit/package.json
git commit -m "feat(dev-kit): v1.20.0 — LAN access and play command

- Bind servers to 0.0.0.0 for LAN access with auto-detected IP display
- Add 'lpt-dev-kit play' command for loading game ZIP packages
- Dynamic Socket.IO URL based on browser location
- GameSelector UI for uploading and switching between games
- ZipManager for ZIP extraction and lifecycle management
- REST API for game CRUD operations"
```

- [ ] **Step 6: Push**

```bash
git push
```
