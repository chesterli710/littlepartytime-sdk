import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif',
  '.mp3', '.wav', '.ogg',
  '.json',
  '.woff2', '.woff',
]);

const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

export interface GameAssetEntry {
  /** Relative path from assets/ dir, e.g. "cards/king.png" */
  relativePath: string;
  /** Absolute path on disk */
  absolutePath: string;
  size: number;
}

export interface GameAssetsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  entries: GameAssetEntry[];
  totalSize: number;
}

/**
 * Collect and validate game custom assets from the assets/ directory.
 * Excludes platform display images (icon/banner/cover/splash) at the root level.
 */
export function validateGameAssets(
  assetsDir: string,
  platformAssetFiles: Set<string>,
): GameAssetsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: GameAssetEntry[] = [];
  let totalSize = 0;

  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    return { valid: true, errors, warnings, entries, totalSize };
  }

  collectFiles(assetsDir, '', platformAssetFiles, entries, errors);

  for (const entry of entries) {
    totalSize += entry.size;

    if (entry.size > MAX_SINGLE_FILE_SIZE) {
      errors.push(
        `${entry.relativePath}: file is ${(entry.size / 1024 / 1024).toFixed(1)}MB, exceeds 10MB limit`,
      );
    }
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push(
      `Total assets size is ${(totalSize / 1024 / 1024).toFixed(1)}MB, exceeds 50MB limit`,
    );
  }

  return { valid: errors.length === 0, errors, warnings, entries, totalSize };
}

function collectFiles(
  baseDir: string,
  relativeTo: string,
  platformAssetFiles: Set<string>,
  entries: GameAssetEntry[],
  errors: string[],
): void {
  const items = fs.readdirSync(path.join(baseDir, relativeTo), { withFileTypes: true });

  for (const item of items) {
    const relPath = relativeTo ? `${relativeTo}/${item.name}` : item.name;
    const absPath = path.join(baseDir, relPath);

    if (item.isDirectory()) {
      collectFiles(baseDir, relPath, platformAssetFiles, entries, errors);
      continue;
    }

    if (!item.isFile()) continue;

    // Skip platform display images at root level (icon.png, banner.webp, etc.)
    if (!relativeTo && platformAssetFiles.has(item.name)) {
      continue;
    }

    // Path validation
    if (relPath.includes('..')) {
      errors.push(`${relPath}: path contains ".." which is not allowed`);
      continue;
    }

    if (/\s/.test(relPath)) {
      errors.push(`${relPath}: path contains spaces which is not allowed`);
      continue;
    }

    // Extension validation
    const ext = path.extname(item.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(
        `${relPath}: file type "${ext}" is not allowed. Allowed types: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      );
      continue;
    }

    const stat = fs.statSync(absPath);
    entries.push({
      relativePath: relPath,
      absolutePath: absPath,
      size: stat.size,
    });
  }
}
