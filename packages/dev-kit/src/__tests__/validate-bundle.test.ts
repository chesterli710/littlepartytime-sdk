import { describe, it, expect } from 'vitest';
import { validateBundle } from '../utils/validate-bundle';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('validateBundle', () => {
  function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-test-'));
  }

  it('should fail if bundle.js is missing', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('bundle.js not found in dist/');
  });

  it('should fail if engine.cjs is missing', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'export default {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('engine.cjs not found in dist/');
  });

  it('should pass when both files exist', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'export const config = {}; export const Renderer = () => null;');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports.engine = {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when extra chunk .js files exist in dist/', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'types-D0Vb4wB4.js'), 'export const foo = 1;');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Found extra chunk files in dist/');
    expect(result.errors[0]).toContain('types-D0Vb4wB4.js');
  });

  it('should fail when extra chunk .cjs files exist in dist/', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'types-Pgt-oK3U.cjs'), 'module.exports = {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Found extra chunk files in dist/');
    expect(result.errors[0]).toContain('types-Pgt-oK3U.cjs');
  });

  it('should ignore .zip files in dist/', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'export default {}');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    fs.writeFileSync(path.join(dir, 'my-game.zip'), 'fake-zip');
    const result = validateBundle(dir);
    expect(result.valid).toBe(true);
  });

  it('should fail when bundle.js contains relative imports', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'import { foo } from "./types-abc123.js";\nexport default foo;');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('relative imports'))).toBe(true);
  });

  it('should fail when bundle.js contains dynamic relative imports', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'const m = import("./chunk-abc.js");\nexport default m;');
    fs.writeFileSync(path.join(dir, 'engine.cjs'), 'module.exports = {}');
    const result = validateBundle(dir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('relative imports'))).toBe(true);
  });
});
