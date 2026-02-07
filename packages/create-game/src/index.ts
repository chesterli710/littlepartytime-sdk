#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // --key=value
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        args[key] = value;
      } else {
        // --key or --key value
        const key = arg.slice(2);
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          args[key] = argv[++i];
        } else {
          // Boolean flag
          args[key] = true;
        }
      }
    } else if (!args['dir']) {
      args['dir'] = arg;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const dirArg = args['dir'] as string | undefined;

  // Non-interactive mode if --yes flag is passed
  const nonInteractive = !!args['yes'] || !!args['y'];

  console.log('');
  console.log('  Little Party Time - Create Game');
  console.log('  ================================');
  console.log('');

  let gameName: string;
  let gameId: string;
  let description: string;
  let minPlayers: string;
  let maxPlayers: string;
  let tagsInput: string;

  if (nonInteractive) {
    // Use args or defaults
    gameName = (args['name'] as string) || dirArg || 'my-game';
    gameId = (args['id'] as string) || toKebabCase(gameName);
    description = (args['description'] as string) || '';
    minPlayers = (args['min-players'] as string) || '2';
    maxPlayers = (args['max-players'] as string) || '6';
    tagsInput = (args['tags'] as string) || '';
  } else {
    const rl = createReadlineInterface();
    gameName = await ask(rl, 'Game name', dirArg);
    gameId = await ask(rl, 'Game ID', toKebabCase(gameName));
    description = await ask(rl, 'Description', '');
    minPlayers = await ask(rl, 'Min players', '2');
    maxPlayers = await ask(rl, 'Max players', '6');
    tagsInput = await ask(rl, 'Tags (comma-separated)', '');
    rl.close();
  }

  const projectDir = path.resolve(process.cwd(), dirArg || gameId);
  const tags = tagsInput
    ? tagsInput.split(',').map((t) => `"${t.trim()}"`).join(', ')
    : '';

  const vars: Record<string, string> = {
    gameId,
    gameName,
    description,
    minPlayers,
    maxPlayers,
    tags,
  };

  // Find templates directory (relative to this script)
  const templatesDir = path.join(__dirname, 'templates');

  console.log('');
  console.log(`Creating project in ${projectDir}...`);
  console.log('');

  // Copy templates
  copyDir(templatesDir, projectDir, vars);

  console.log('');
  console.log('Done! Next steps:');
  console.log('');
  console.log(`  cd ${path.basename(projectDir)}`);
  console.log('  npm install');
  console.log('  npm test');
  console.log('  npm run dev');
  console.log('');
}

const BINARY_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico']);

function copyDir(src: string, dest: string, vars: Record<string, string>) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    // Remove .tmpl extension
    const destName = entry.name.replace(/\.tmpl$/, '');
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, vars);
    } else {
      const ext = path.extname(destName).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        // Copy binary files without template processing
        fs.copyFileSync(srcPath, destPath);
      } else {
        let content = fs.readFileSync(srcPath, 'utf-8');
        // Replace template variables
        for (const [key, value] of Object.entries(vars)) {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        fs.writeFileSync(destPath, content);
      }
      console.log(`  created ${path.relative(process.cwd(), destPath)}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
