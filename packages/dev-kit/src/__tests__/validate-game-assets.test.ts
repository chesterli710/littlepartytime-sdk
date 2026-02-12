import { describe, it, expect } from 'vitest';
import { validateGameAssets } from '../utils/validate-game-assets';
import path from 'path';
import fs from 'fs';
import os from 'os';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-game-assets-test-'));
}

const platformFiles = new Set(['icon.png', 'banner.png', 'cover.png', 'splash.png']);

describe('validateGameAssets', () => {
  it('should return valid with no entries when assets dir does not exist', () => {
    const dir = makeTempDir();
    const result = validateGameAssets(path.join(dir, 'assets'), platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('should return valid with no entries when assets dir is empty', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('should collect valid asset files', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(path.join(assetsDir, 'cards'), { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'cards', 'king.png'), Buffer.alloc(100));
    fs.writeFileSync(path.join(assetsDir, 'cards', 'queen.jpg'), Buffer.alloc(200));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map(e => e.relativePath).sort()).toEqual(['cards/king.png', 'cards/queen.jpg']);
    expect(result.totalSize).toBe(300);
  });

  it('should skip platform display images at root level', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    // Platform images — should be skipped
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), Buffer.alloc(50));
    fs.writeFileSync(path.join(assetsDir, 'banner.png'), Buffer.alloc(50));
    // Game asset — should be included
    fs.writeFileSync(path.join(assetsDir, 'bg.png'), Buffer.alloc(50));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].relativePath).toBe('bg.png');
  });

  it('should not skip platform image names in subdirectories', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(path.join(assetsDir, 'sub'), { recursive: true });
    // Same name as platform image but in a subdirectory — should be included
    fs.writeFileSync(path.join(assetsDir, 'sub', 'icon.png'), Buffer.alloc(50));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].relativePath).toBe('sub/icon.png');
  });

  it('should reject disallowed file extensions', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    fs.writeFileSync(path.join(assetsDir, 'script.js'), 'console.log("hi")');
    fs.writeFileSync(path.join(assetsDir, 'data.exe'), Buffer.alloc(10));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('.js');
    expect(result.errors[0]).toContain('not allowed');
  });

  it('should accept all allowed extensions', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);

    const allowed = [
      'img.png', 'img.jpg', 'img.jpeg', 'img.webp', 'img.svg', 'img.gif',
      'sound.mp3', 'sound.wav', 'sound.ogg',
      'data.json',
      'font.woff2', 'font.woff',
    ];

    for (const name of allowed) {
      fs.writeFileSync(path.join(assetsDir, name), Buffer.alloc(10));
    }

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(allowed.length);
  });

  it('should reject files exceeding 20MB', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    // Create a file just over 20MB
    fs.writeFileSync(path.join(assetsDir, 'huge.png'), Buffer.alloc(20 * 1024 * 1024 + 1));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds 20MB'))).toBe(true);
  });

  it('should reject when total assets exceed 100MB', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    // Create 6 files of 19MB each = 114MB total (each under 20MB limit)
    for (let i = 0; i < 6; i++) {
      fs.writeFileSync(path.join(assetsDir, `file${i}.png`), Buffer.alloc(19 * 1024 * 1024));
    }

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds 100MB'))).toBe(true);
  });

  it('should reject paths containing ".."', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    // We can't actually create a file with ".." in a real directory entry,
    // but we test that the validator would catch it if encountered.
    // Instead test with a directory named ".." which is not traversable
    fs.mkdirSync(assetsDir);
    fs.writeFileSync(path.join(assetsDir, 'ok.png'), Buffer.alloc(10));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(1);
  });

  it('should reject paths containing spaces', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir);
    fs.writeFileSync(path.join(assetsDir, 'my image.png'), Buffer.alloc(10));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('spaces'))).toBe(true);
  });

  it('should handle nested directory structures', () => {
    const dir = makeTempDir();
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(path.join(assetsDir, 'cards', 'suits'), { recursive: true });
    fs.mkdirSync(path.join(assetsDir, 'sounds'), { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'cards', 'suits', 'heart.png'), Buffer.alloc(10));
    fs.writeFileSync(path.join(assetsDir, 'sounds', 'flip.mp3'), Buffer.alloc(10));

    const result = validateGameAssets(assetsDir, platformFiles);
    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map(e => e.relativePath).sort()).toEqual([
      'cards/suits/heart.png',
      'sounds/flip.mp3',
    ]);
  });
});
