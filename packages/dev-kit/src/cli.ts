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
