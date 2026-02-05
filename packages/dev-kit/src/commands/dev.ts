// packages/dev-kit/src/commands/dev.ts
import path from 'path';
import { createServer, ViteDevServer } from 'vite';
import { createSocketServer } from '../server/socket-server';
import chokidar from 'chokidar';

export interface DevOptions {
  port?: number;
  socketPort?: number;
}

export async function devCommand(projectDir: string, options: DevOptions = {}): Promise<void> {
  const port = options.port || 4000;
  const socketPort = options.socketPort || 4001;

  console.log('');
  console.log('  Little Party Time Dev Kit');
  console.log('  =========================');
  console.log('');

  // Start Socket.IO server
  const { reloadEngine } = createSocketServer({
    port: socketPort,
    projectDir,
  });

  // Watch for engine changes
  const enginePath = path.join(projectDir, 'dist', 'engine.cjs');
  const watcher = chokidar.watch(enginePath, { ignoreInitial: true });
  watcher.on('change', () => {
    console.log('[Dev] Engine changed, reloading...');
    reloadEngine();
  });

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
      },
    },
  });

  await vite.listen();

  console.log(`  Preview:      http://localhost:${port}/preview`);
  console.log(`  Multiplayer:  http://localhost:${port}/play`);
  console.log(`  Debug Panel:  http://localhost:${port}/debug`);
  console.log(`  Socket.IO:    ws://localhost:${socketPort}`);
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
}
