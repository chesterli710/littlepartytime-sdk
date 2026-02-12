import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { validateBundle } from '../utils/validate-bundle';
import { validateAssets, ASSET_SPECS } from '../utils/validate-assets';
import { validateGameAssets } from '../utils/validate-game-assets';
import { generateManifest, getExtension } from '../utils/manifest';

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
  const bundleResult = validateBundle(distDir);

  for (const warning of bundleResult.warnings) {
    console.log(`  WARNING: ${warning}`);
  }

  if (!bundleResult.valid) {
    for (const error of bundleResult.errors) {
      console.error(`  ERROR: ${error}`);
    }
    process.exit(1);
  }
  console.log('  Bundle validation passed');

  // Step 3: Read gameId from lpt.config.ts (local project identifier for zip naming)
  let gameId = 'game';
  const lptConfigPath = path.join(projectDir, 'lpt.config.ts');
  if (fs.existsSync(lptConfigPath)) {
    const content = fs.readFileSync(lptConfigPath, 'utf-8');
    const match = content.match(/gameId:\s*["']([^"']+)["']/);
    if (match) gameId = match[1];
  }

  // Step 4: Load GameConfig from engine.cjs
  console.log('\nReading game config...');
  const enginePath = path.join(distDir, 'engine.cjs');
  let config: Record<string, unknown>;
  try {
    const engineModule = require(enginePath);
    config = engineModule.config || engineModule.default?.config;
    // Clear require cache to avoid stale modules
    delete require.cache[require.resolve(enginePath)];
  } catch (err) {
    console.error(`  ERROR: Failed to load engine.cjs: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!config || !config.name) {
    console.error('  ERROR: Could not read GameConfig from engine.cjs.');
    console.error('  Make sure src/index.ts exports config:');
    console.error('    export { default as config } from "./config";');
    process.exit(1);
  }

  console.log(`  Game: ${config.name} v${config.version}`);

  // Step 5: Validate image assets
  console.log('\nValidating assets...');
  const assets = config.assets as Record<string, string> | undefined;
  if (!assets) {
    console.error('  ERROR: GameConfig.assets is missing.');
    console.error('  Add an assets object to your config.ts with icon, banner, cover, and splash paths.');
    process.exit(1);
  }

  const assetResult = validateAssets(projectDir, assets);

  for (const warning of assetResult.warnings) {
    console.log(`  WARNING: ${warning}`);
  }

  if (!assetResult.valid) {
    for (const error of assetResult.errors) {
      console.error(`  ERROR: ${error}`);
    }
    process.exit(1);
  }
  console.log('  Asset validation passed');

  // Step 6: Validate rules.md
  const rulesPath = path.join(projectDir, 'rules.md');
  if (!fs.existsSync(rulesPath)) {
    console.error('  ERROR: rules.md not found in project root.');
    console.error('  Create a rules.md file with your game rules in Markdown format.');
    process.exit(1);
  }
  if (fs.statSync(rulesPath).size === 0) {
    console.error('  ERROR: rules.md is empty.');
    process.exit(1);
  }
  console.log('  rules.md found');

  // Step 7: Validate game custom assets (assets/ directory, excluding platform images)
  const assetsDir = path.join(projectDir, 'assets');
  const platformAssetFiles = new Set<string>();
  for (const spec of ASSET_SPECS) {
    const assetPath = assets[spec.key];
    if (assetPath) {
      const basename = path.basename(assetPath);
      platformAssetFiles.add(basename);
    }
  }

  const gameAssetsResult = validateGameAssets(assetsDir, platformAssetFiles);

  for (const warning of gameAssetsResult.warnings) {
    console.log(`  WARNING: ${warning}`);
  }

  if (!gameAssetsResult.valid) {
    for (const error of gameAssetsResult.errors) {
      console.error(`  ERROR: ${error}`);
    }
    process.exit(1);
  }

  if (gameAssetsResult.entries.length > 0) {
    console.log(`  Found ${gameAssetsResult.entries.length} custom asset(s) (${(gameAssetsResult.totalSize / 1024).toFixed(1)}KB total)`);
  }

  // Step 8: Generate manifest
  const manifest = generateManifest(config as Parameters<typeof generateManifest>[0]);

  // Step 9: Create zip
  const zipPath = path.join(distDir, `${gameId}.zip`);
  console.log(`\nPackaging to ${gameId}.zip...`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    // Build artifacts
    archive.file(path.join(distDir, 'bundle.js'), { name: 'bundle.js' });
    archive.file(path.join(distDir, 'engine.cjs'), { name: 'engine.cjs' });

    // Manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Image assets (renamed to canonical names)
    for (const spec of ASSET_SPECS) {
      const srcPath = assetResult.resolvedPaths.get(spec.key)!;
      const ext = getExtension(assets[spec.key]);
      archive.file(srcPath, { name: `${spec.key}${ext}` });
    }

    // Rules
    archive.file(rulesPath, { name: 'rules.md' });

    // Game custom assets
    for (const entry of gameAssetsResult.entries) {
      archive.file(entry.absolutePath, { name: `assets/${entry.relativePath}` });
    }

    archive.finalize();
  });

  const zipSize = fs.statSync(zipPath).size;
  console.log(`\nDone! ${zipPath} (${(zipSize / 1024).toFixed(1)}KB)`);
  console.log('Upload this file to the admin panel to publish your game.');
}
