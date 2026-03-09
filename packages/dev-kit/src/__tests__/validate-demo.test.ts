import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateDemo } from '../utils/validate-demo';

describe('validateDemo', () => {
  let tmpDir: string;
  let demoDistDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-demo-'));
    demoDistDir = path.join(tmpDir, 'demo', 'dist');
    fs.mkdirSync(demoDistDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should fail when demo/dist does not exist', () => {
    const result = validateDemo(path.join(tmpDir, 'nonexistent'));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('demo/dist/index.html not found');
  });

  it('should fail when index.html is missing', () => {
    const emptyDir = path.join(tmpDir, 'empty-demo');
    fs.mkdirSync(emptyDir, { recursive: true });
    const result = validateDemo(emptyDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('demo/dist/index.html not found');
  });

  it('should pass with relative paths', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><head><link href="./assets/style.css" rel="stylesheet"></head>' +
      '<body><script src="./assets/index.js"></script></body></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail with absolute src path', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><body><script type="module" crossorigin src="/assets/index-C0AShmvx.js"></script></body></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('absolute path references');
    expect(result.errors[0]).toContain('base: "./"');
  });

  it('should fail with absolute href path', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><head><link rel="stylesheet" href="/assets/index-abc123.css"></head></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('absolute path references');
  });

  it('should detect multiple absolute path references', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><head><link href="/assets/style.css" rel="stylesheet"></head>' +
      '<body><script src="/assets/index.js"></script></body></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('href="/');
    expect(result.errors[0]).toContain('src="/');
  });

  it('should allow protocol-relative URLs (//)', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><body><script src="//cdn.example.com/lib.js"></script></body></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(true);
  });

  it('should allow full URLs', () => {
    fs.writeFileSync(
      path.join(demoDistDir, 'index.html'),
      '<html><body><script src="https://cdn.example.com/lib.js"></script></body></html>'
    );
    const result = validateDemo(demoDistDir);
    expect(result.valid).toBe(true);
  });
});
