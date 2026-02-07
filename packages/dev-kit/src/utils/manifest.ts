import path from 'path';

export interface GameManifest {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  version: string;
  sdkVersion: string;
  price?: number;
  assets: {
    icon: string;
    banner: string;
    cover: string;
    splash: string;
  };
  rules: string;
}

export function getExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png' && ext !== '.webp') {
    throw new Error(`Unsupported image format: ${filePath}. Use .png or .webp`);
  }
  return ext;
}

export function generateManifest(config: {
  name: string;
  description: string;
  assets: { icon: string; banner: string; cover: string; splash: string };
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  version: string;
  sdkVersion: string;
  price?: number;
}): GameManifest {
  const manifest: GameManifest = {
    name: config.name,
    description: config.description,
    minPlayers: config.minPlayers,
    maxPlayers: config.maxPlayers,
    tags: config.tags,
    version: config.version,
    sdkVersion: config.sdkVersion,
    assets: {
      icon: `icon${getExtension(config.assets.icon)}`,
      banner: `banner${getExtension(config.assets.banner)}`,
      cover: `cover${getExtension(config.assets.cover)}`,
      splash: `splash${getExtension(config.assets.splash)}`,
    },
    rules: 'rules.md',
  };

  if (config.price !== undefined) {
    manifest.price = config.price;
  }

  return manifest;
}
