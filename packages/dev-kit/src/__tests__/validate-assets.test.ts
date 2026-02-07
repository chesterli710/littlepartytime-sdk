import { describe, it, expect } from 'vitest';
import { validateAssets } from '../utils/validate-assets';
import path from 'path';
import fs from 'fs';
import os from 'os';
import zlib from 'zlib';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-asset-test-'));
}

/**
 * Generate a minimal valid PNG file with the given dimensions.
 * Creates a valid PNG with: signature, IHDR, IDAT (empty deflate), IEND.
 */
function createPng(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk — minimal: one row of filter-byte + zeros, deflated
  const scanline = Buffer.alloc(1 + width * 3); // filter byte 0 + RGB pixels
  const compressed = zlib.deflateSync(scanline);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return crc ^ 0xFFFFFFFF;
}

function setupAssets(dir: string, overrides?: Partial<Record<string, { width: number; height: number } | null>>) {
  const defaults: Record<string, { width: number; height: number }> = {
    icon:   { width: 512,  height: 512  },
    banner: { width: 1600, height: 900  },
    cover:  { width: 2100, height: 900  },
    splash: { width: 900,  height: 2100 },
  };

  const assetsDir = path.join(dir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const config: Record<string, string> = {};

  for (const [key, dims] of Object.entries(defaults)) {
    const override = overrides?.[key];
    if (override === null) continue; // skip this asset
    const { width, height } = override ?? dims;
    const filePath = path.join(assetsDir, `${key}.png`);
    fs.writeFileSync(filePath, createPng(width, height));
    config[key] = `assets/${key}.png`;
  }

  return config;
}

describe('validateAssets', () => {
  it('should pass with valid assets', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.resolvedPaths.size).toBe(4);
  });

  it('should fail when asset file is missing', () => {
    const dir = makeTempDir();
    const assets = {
      icon: 'assets/icon.png',
      banner: 'assets/banner.png',
      cover: 'assets/cover.png',
      splash: 'assets/splash.png',
    };
    // Don't create any files
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
    expect(result.errors[0]).toContain('Asset not found');
  });

  it('should fail when asset key is missing from config', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    delete (assets as Record<string, string>)['splash'];
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing asset: splash'))).toBe(true);
  });

  it('should fail for unsupported format', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    // Rename icon to .jpg
    const assetsDir = path.join(dir, 'assets');
    fs.renameSync(path.join(assetsDir, 'icon.png'), path.join(assetsDir, 'icon.jpg'));
    assets['icon'] = 'assets/icon.jpg';
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('unsupported format'))).toBe(true);
  });

  it('should fail for empty file', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    fs.writeFileSync(path.join(dir, 'assets', 'icon.png'), '');
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('file is empty'))).toBe(true);
  });

  it('should fail when image is too small', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir, { icon: { width: 100, height: 100 } });
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('100x100') && e.includes('256x256'))).toBe(true);
  });

  it('should fail when aspect ratio is wrong', () => {
    const dir = makeTempDir();
    // banner should be 16:9, give it 1:1
    const assets = setupAssets(dir, { banner: { width: 900, height: 900 } });
    const result = validateAssets(dir, assets);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('banner') && e.includes('aspect ratio'))).toBe(true);
  });

  it('should warn for large files', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    // Write a large file (>2MB) as icon
    const largeBuf = createPng(512, 512);
    const padded = Buffer.concat([largeBuf, Buffer.alloc(2.5 * 1024 * 1024)]);
    fs.writeFileSync(path.join(dir, 'assets', 'icon.png'), padded);
    const result = validateAssets(dir, assets);
    // Dimensions won't read correctly from padded file, but let's check warnings exist
    expect(result.warnings.some(w => w.includes('large'))).toBe(true);
  });

  it('should accept webp files', () => {
    const dir = makeTempDir();
    const assets = setupAssets(dir);
    // We only test that .webp extension is accepted (PNG header reading for webp is separate)
    // For this test, just check that the extension validation passes
    const assetsDir = path.join(dir, 'assets');
    const iconPng = path.join(assetsDir, 'icon.png');
    const iconWebp = path.join(assetsDir, 'icon.webp');
    fs.renameSync(iconPng, iconWebp);
    assets['icon'] = 'assets/icon.webp';
    const result = validateAssets(dir, assets);
    // Will fail dimension check (wrong header for webp) but extension is accepted
    // The important thing: no "unsupported format" error
    expect(result.errors.every(e => !e.includes('unsupported format'))).toBe(true);
  });
});
