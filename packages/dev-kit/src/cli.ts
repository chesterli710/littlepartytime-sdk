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
    default:
      console.log('Usage: lpt-dev-kit <command>');
      console.log('');
      console.log('Commands:');
      console.log('  dev     Start development server');
      console.log('  pack    Build and package game as .zip');
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
