import fs from 'fs';
import path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const EXPECTED_FILES = new Set(['bundle.js', 'engine.cjs']);

export function validateBundle(distDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const bundlePath = path.join(distDir, 'bundle.js');
  const enginePath = path.join(distDir, 'engine.cjs');

  if (!fs.existsSync(bundlePath)) {
    errors.push('bundle.js not found in dist/');
  }

  if (!fs.existsSync(enginePath)) {
    errors.push('engine.cjs not found in dist/');
  }

  if (errors.length === 0) {
    const bundleSize = fs.statSync(bundlePath).size;
    const engineSize = fs.statSync(enginePath).size;

    if (bundleSize === 0) errors.push('bundle.js is empty');
    if (engineSize === 0) errors.push('engine.cjs is empty');

    if (bundleSize > 5 * 1024 * 1024) {
      warnings.push(`bundle.js is large (${(bundleSize / 1024 / 1024).toFixed(1)}MB)`);
    }

    // Check for extra chunk files in dist/
    const extraFiles = fs.readdirSync(distDir).filter(f => {
      if (EXPECTED_FILES.has(f)) return false;
      if (f.endsWith('.zip')) return false;
      if (f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs')) return true;
      return false;
    });

    if (extraFiles.length > 0) {
      errors.push(
        `Found extra chunk files in dist/: ${extraFiles.join(', ')}\n` +
        `  This usually means your Vite config has code splitting enabled (e.g., multiple entry points).\n` +
        `  The pack command only includes bundle.js and engine.cjs — extra chunks will be missing at runtime.\n` +
        `  Use a single entry point in vite.config.ts:\n` +
        `    lib: {\n` +
        `      entry: path.resolve(__dirname, "src/index.ts"),\n` +
        `      formats: ["es", "cjs"],\n` +
        `      fileName: (format) => format === "es" ? "bundle.js" : "engine.cjs",\n` +
        `    }\n` +
        `  See GAME_DEV_GUIDE.md for the recommended configuration.`
      );
    }

    // Check bundle.js for relative imports that reference external chunks
    if (bundleSize > 0) {
      const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
      const relativeImports = bundleContent.match(/from\s+["']\.\/[^"']+["']|import\s*\(\s*["']\.\/[^"']+["']\s*\)/g);
      if (relativeImports) {
        errors.push(
          `bundle.js contains relative imports that reference external files:\n` +
          `  ${relativeImports.join('\n  ')}\n` +
          `  These files will not be available at runtime on the platform.\n` +
          `  Ensure your Vite config uses a single entry point to produce a self-contained bundle.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
