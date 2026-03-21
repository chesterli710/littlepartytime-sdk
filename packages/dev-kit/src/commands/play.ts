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
