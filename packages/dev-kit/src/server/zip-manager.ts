// packages/dev-kit/src/server/zip-manager.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface GameEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  minPlayers: number;
  maxPlayers: number;
  iconPath: string | null;
  extractDir: string;
  enginePath: string;
  bundlePath: string;
  assetsDir: string | null;
}

export class ZipManager {
  private games: Map<string, GameEntry> = new Map();

  async loadZip(zipPath: string): Promise<GameEntry> {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpt-game-'));
    try {
      execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);
    } catch {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error(`Failed to extract ZIP: ${zipPath}`);
    }
    return this.registerFromDir(extractDir);
  }

  async loadFromUpload(buffer: Buffer, filename: string): Promise<GameEntry> {
    const tmpZip = path.join(os.tmpdir(), `lpt-upload-${Date.now()}-${filename}`);
    fs.writeFileSync(tmpZip, buffer);
    try {
      return await this.loadZip(tmpZip);
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  }

  private registerFromDir(extractDir: string): GameEntry {
    const manifestPath = path.join(extractDir, 'manifest.json');
    const enginePath = path.join(extractDir, 'engine.cjs');
    const bundlePath = path.join(extractDir, 'bundle.js');

    if (!fs.existsSync(manifestPath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing manifest.json');
    }
    if (!fs.existsSync(enginePath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing engine.cjs');
    }
    if (!fs.existsSync(bundlePath)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      throw new Error('Invalid game ZIP: missing bundle.js');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    let iconPath: string | null = null;
    const iconName = manifest.assets?.icon;
    if (iconName) {
      const candidate = path.join(extractDir, iconName);
      if (fs.existsSync(candidate)) iconPath = candidate;
    }

    const assetsDir = path.join(extractDir, 'assets');
    const hasAssetsDir = fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory();

    const id = `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: GameEntry = {
      id,
      name: manifest.name || 'Unknown Game',
      description: manifest.description || '',
      version: manifest.version || '0.0.0',
      minPlayers: manifest.minPlayers ?? 2,
      maxPlayers: manifest.maxPlayers ?? 8,
      iconPath,
      extractDir,
      enginePath,
      bundlePath,
      assetsDir: hasAssetsDir ? assetsDir : null,
    };

    this.games.set(id, entry);
    return entry;
  }

  getGame(id: string): GameEntry | undefined {
    return this.games.get(id);
  }

  listGames(): GameEntry[] {
    return Array.from(this.games.values());
  }

  removeGame(id: string): void {
    const entry = this.games.get(id);
    if (entry) {
      fs.rmSync(entry.extractDir, { recursive: true, force: true });
      this.games.delete(id);
    }
  }

  cleanup(): void {
    for (const entry of this.games.values()) {
      fs.rmSync(entry.extractDir, { recursive: true, force: true });
    }
    this.games.clear();
  }
}
