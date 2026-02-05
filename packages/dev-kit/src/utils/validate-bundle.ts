import fs from 'fs';
import path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

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
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
