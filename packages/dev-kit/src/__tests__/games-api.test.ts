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
