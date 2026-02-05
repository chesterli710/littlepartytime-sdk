import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { validateBundle } from '../utils/validate-bundle';

export async function packCommand(projectDir: string): Promise<void> {
  const distDir = path.join(projectDir, 'dist');

  // Step 1: Run vite build
  console.log('Building...');
  try {
    execSync('npx vite build', { cwd: projectDir, stdio: 'inherit' });
  } catch {
    console.error('Build failed');
    process.exit(1);
  }

  // Step 2: Validate bundle
  console.log('\nValidating build output...');
  const result = validateBundle(distDir);

  for (const warning of result.warnings) {
    console.log(`  WARNING: ${warning}`);
  }

  if (!result.valid) {
    for (const error of result.errors) {
      console.error(`  ERROR: ${error}`);
    }
    process.exit(1);
  }
  console.log('  Validation passed');

  // Step 3: Read gameId from lpt.config.ts or package.json
  let gameId = 'game';
  const configPath = path.join(projectDir, 'lpt.config.ts');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/gameId:\s*["']([^"']+)["']/);
    if (match) gameId = match[1];
  }

  // Step 4: Create zip
  const zipPath = path.join(distDir, `${gameId}.zip`);
  console.log(`\nPackaging to ${gameId}.zip...`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.file(path.join(distDir, 'bundle.js'), { name: 'bundle.js' });
    archive.file(path.join(distDir, 'engine.cjs'), { name: 'engine.cjs' });

    archive.finalize();
  });

  const zipSize = fs.statSync(zipPath).size;
  console.log(`\nDone! ${zipPath} (${(zipSize / 1024).toFixed(1)}KB)`);
  console.log('Upload this file to the admin panel to publish your game.');
}
