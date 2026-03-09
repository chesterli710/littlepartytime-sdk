import fs from 'fs';
import path from 'path';

export interface DemoValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that the demo site exists and uses relative paths.
 * Absolute paths (e.g. src="/assets/...") will 404 when deployed to a CDN subdirectory.
 */
export function validateDemo(demoDistDir: string): DemoValidationResult {
  const errors: string[] = [];
  const indexPath = path.join(demoDistDir, 'index.html');

  if (!fs.existsSync(demoDistDir) || !fs.existsSync(indexPath)) {
    errors.push(
      'GameConfig.demo is set but demo/dist/index.html not found.\n' +
      '  Build your demo site first: cd demo && npm run build'
    );
    return { valid: false, errors };
  }

  const html = fs.readFileSync(indexPath, 'utf-8');
  // Match src="/" or href="/" but not src="//" (protocol-relative URLs)
  const absolutePathPattern = /(?:src|href)=["']\/(?!\/)/g;
  const matches = html.match(absolutePathPattern);

  if (matches) {
    errors.push(
      `demo/dist/index.html contains absolute path references:\n` +
      matches.map(m => `    ${m}`).join('\n') + '\n' +
      '  The demo will be deployed to a CDN subdirectory, so absolute paths will cause 404.\n' +
      '  Set base: "./" in your demo Vite config:\n' +
      '\n' +
      '    // demo/vite.config.ts\n' +
      '    export default defineConfig({ base: "./" })'
    );
  }

  return { valid: errors.length === 0, errors };
}
