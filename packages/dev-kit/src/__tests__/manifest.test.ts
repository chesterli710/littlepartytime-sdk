import { describe, it, expect } from 'vitest';
import { generateManifest, getExtension } from '../utils/manifest';

describe('getExtension', () => {
  it('should return .png for png paths', () => {
    expect(getExtension('assets/icon.png')).toBe('.png');
    expect(getExtension('assets/ICON.PNG')).toBe('.png');
  });

  it('should return .webp for webp paths', () => {
    expect(getExtension('assets/icon.webp')).toBe('.webp');
  });

  it('should throw for unsupported formats', () => {
    expect(() => getExtension('assets/icon.jpg')).toThrow('Unsupported image format');
    expect(() => getExtension('assets/icon.gif')).toThrow('Unsupported image format');
    expect(() => getExtension('assets/icon.svg')).toThrow('Unsupported image format');
  });
});

describe('generateManifest', () => {
  const baseConfig = {
    name: 'Test Game',
    description: 'A test game',
    assets: {
      icon: 'assets/icon.png',
      banner: 'assets/banner.png',
      cover: 'assets/cover.webp',
      splash: 'assets/splash.png',
    },
    minPlayers: 2,
    maxPlayers: 6,
    tags: ['casual', 'party'],
    version: '1.0.0',
    sdkVersion: '2.0.0',
  };

  it('should produce correct manifest structure', () => {
    const manifest = generateManifest(baseConfig);
    expect(manifest).not.toHaveProperty('id');
    expect(manifest.name).toBe('Test Game');
    expect(manifest.description).toBe('A test game');
    expect(manifest.minPlayers).toBe(2);
    expect(manifest.maxPlayers).toBe(6);
    expect(manifest.tags).toEqual(['casual', 'party']);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.sdkVersion).toBe('2.0.0');
    expect(manifest.rules).toBe('rules.md');
  });

  it('should normalize asset filenames', () => {
    const manifest = generateManifest(baseConfig);
    expect(manifest.assets.icon).toBe('icon.png');
    expect(manifest.assets.banner).toBe('banner.png');
    expect(manifest.assets.cover).toBe('cover.webp');
    expect(manifest.assets.splash).toBe('splash.png');
  });

  it('should omit price when undefined', () => {
    const manifest = generateManifest(baseConfig);
    expect(manifest).not.toHaveProperty('price');
  });

  it('should include price when defined', () => {
    const manifest = generateManifest({ ...baseConfig, price: 9.99 });
    expect(manifest.price).toBe(9.99);
  });
});
