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
      console.log('lpt-dev-kit dev server is not yet implemented (Phase 2)');
      process.exit(1);
    }
    default:
      console.log('Usage: lpt-dev-kit <command>');
      console.log('');
      console.log('Commands:');
      console.log('  pack    Build and package game as .zip');
      console.log('  dev     Start development server (coming soon)');
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
