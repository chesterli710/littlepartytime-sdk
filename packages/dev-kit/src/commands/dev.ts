// packages/dev-kit/src/commands/dev.ts
import path from 'path';
import { createServer, build, ViteDevServer } from 'vite';
import { createSocketServer } from '../server/socket-server';
import chokidar from 'chokidar';

function createEngineRebuilder(projectDir: string, silent: boolean) {
  let building = false;
  let pendingBuild = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function runBuild() {
    if (building) {
      pendingBuild = true;
      return;
    }
    building = true;
    if (!silent) {
      console.log('[Dev] Source changed, rebuilding engine...');
    }
    try {
      await build({
        configFile: path.join(projectDir, 'vite.config.ts'),
        logLevel: 'warn',
      });
      if (!silent) {
        console.log('[Dev] Engine rebuild complete.');
      }
    } catch (err) {
      console.error('[Dev] Engine rebuild failed:', (err as Error).message);
    } finally {
      building = false;
      if (pendingBuild) {
        pendingBuild = false;
        runBuild();
      }
    }
  }

  return (filePath: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runBuild();
    }, 300);
  };
}

export interface DevOptions {
  port?: number;
  socketPort?: number;
  silent?: boolean;
}

export interface DevServerHandle {
  stop(): Promise<void>;
  port: number;
  socketPort: number;
}

export async function devCommand(projectDir: string, options: DevOptions = {}): Promise<DevServerHandle> {
  const port = options.port || 4000;
  const socketPort = options.socketPort || 4001;

  if (!options.silent) {
    console.log('');
    console.log('  Little Party Time Dev Kit');
    console.log('  =========================');
    console.log('');
  }

  // Start Socket.IO server
  const { server, io, reloadEngine } = createSocketServer({
    port: socketPort,
    projectDir,
  });

  // Watch for engine build output changes (triggers reload)
  const enginePath = path.join(projectDir, 'dist', 'engine.cjs');
  const distWatcher = chokidar.watch(enginePath, { ignoreInitial: true });
  distWatcher.on('change', () => {
    if (!options.silent) {
      console.log('[Dev] Engine changed, reloading...');
    }
    reloadEngine();
  });

  // Watch source files and auto-rebuild engine
  const srcDir = path.join(projectDir, 'src');
  const srcWatcher = chokidar.watch(srcDir, {
    ignoreInitial: true,
    ignored: /node_modules/,
  });
  const triggerRebuild = createEngineRebuilder(projectDir, !!options.silent);
  srcWatcher.on('change', triggerRebuild);
  srcWatcher.on('add', triggerRebuild);

  // Start Vite dev server
  const webappDir = path.join(__dirname, '..', 'webapp');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('@vitejs/plugin-react').default;

  const vite: ViteDevServer = await createServer({
    root: webappDir,
    plugins: [react()],
    server: {
      port,
      fs: {
        allow: [webappDir, projectDir],
      },
    },
    resolve: {
      alias: {
        '/src': path.join(projectDir, 'src'),
        '/assets': path.join(projectDir, 'assets'),
      },
    },
  });

  await vite.listen();

  if (!options.silent) {
    console.log(`  Preview:      http://localhost:${port}/preview`);
    console.log(`  Multiplayer:  http://localhost:${port}/play`);
    console.log(`  Debug Panel:  http://localhost:${port}/debug`);
    console.log(`  Socket.IO:    ws://localhost:${socketPort}`);
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');
  }

  return {
    port,
    socketPort,
    async stop() {
      await distWatcher.close();
      await srcWatcher.close();
      await vite.close();
      io.disconnectSockets(true);
      io.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
