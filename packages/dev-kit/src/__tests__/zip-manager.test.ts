// packages/dev-kit/src/__tests__/zip-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZipManager } from '../server/zip-manager';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';

async function createTestZip(dir: string, filename: string, options?: { skipEngine?: boolean; skipBundle?: boolean; skipManifest?: boolean }): Promise<string> {
  const zipPath = path.join(dir, filename);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip');
  archive.pipe(output);

  if (!options?.skipManifest) {
    archive.append(JSON.stringify({
      name: 'Test Game', description: 'A test game', version: '1.0.0', sdkVersion: '2.0.0',
      minPlayers: 2, maxPlayers: 6, tags: ['test'],
      assets: { icon: 'icon.png', banner: 'banner.png', cover: 'cover.png', splash: 'splash.png' },
      rules: 'rules.md',
    }), { name: 'manifest.json' });
  }
  if (!options?.skipEngine) {
    archive.append(`module.exports = { engine: {
      init(players) { return { players: players.map(p => p.id), turn: 0 }; },
      handleAction(state, pid, action) { return { ...state, turn: state.turn + 1 }; },
      isGameOver(state) { return state.turn >= 3; },
      getResult(state) { return { winner: state.players[0] }; },
      getPlayerView(state, pid) { return state; },
    }};`, { name: 'engine.cjs' });
  }
  if (!options?.skipBundle) {
    archive.append('// bundle.js\nconsole.log("game");', { name: 'bundle.js' });
  }
  archive.append(Buffer.from('PNG'), { name: 'icon.png' });
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
    await manager.loadZip(await createTestZip(tmpDir, 'game1.zip'));
    await manager.loadZip(await createTestZip(tmpDir, 'game2.zip'));
    expect(manager.listGames()).toHaveLength(2);
  });

  it('should get a game by id', async () => {
    const entry = await manager.loadZip(await createTestZip(tmpDir, 'game.zip'));
    expect(manager.getGame(entry.id)).toBe(entry);
    expect(manager.getGame('nonexistent')).toBeUndefined();
  });

  it('should remove a game and clean up temp files', async () => {
    const entry = await manager.loadZip(await createTestZip(tmpDir, 'game.zip'));
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
    const e1 = await manager.loadZip(await createTestZip(tmpDir, 'game1.zip'));
    const e2 = await manager.loadZip(await createTestZip(tmpDir, 'game2.zip'));
    manager.cleanup();
    expect(fs.existsSync(e1.extractDir)).toBe(false);
    expect(fs.existsSync(e2.extractDir)).toBe(false);
    expect(manager.listGames()).toHaveLength(0);
  });
});
