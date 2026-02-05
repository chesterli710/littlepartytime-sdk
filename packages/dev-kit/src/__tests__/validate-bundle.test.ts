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
});
