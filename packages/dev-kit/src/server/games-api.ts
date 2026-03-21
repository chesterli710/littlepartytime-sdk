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
