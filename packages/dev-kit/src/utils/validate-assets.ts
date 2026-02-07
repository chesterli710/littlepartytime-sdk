import fs from 'fs';
import path from 'path';

export interface AssetSpec {
  key: string;
  ratioWidth: number;
  ratioHeight: number;
  minWidth: number;
  minHeight: number;
}

export const ASSET_SPECS: AssetSpec[] = [
  { key: 'icon',   ratioWidth: 1,  ratioHeight: 1,  minWidth: 256, minHeight: 256 },
  { key: 'banner', ratioWidth: 16, ratioHeight: 9,  minWidth: 640, minHeight: 360 },
  { key: 'cover',  ratioWidth: 21, ratioHeight: 9,  minWidth: 840, minHeight: 360 },
  { key: 'splash', ratioWidth: 9,  ratioHeight: 21, minWidth: 360, minHeight: 840 },
];

export interface AssetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolvedPaths: Map<string, string>;
}

export function validateAssets(
  projectDir: string,
  assets: Record<string, string>,
): AssetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolvedPaths = new Map<string, string>();

  for (const spec of ASSET_SPECS) {
    const relativePath = assets[spec.key];
    if (!relativePath) {
      errors.push(`Missing asset: ${spec.key} is required in config.assets`);
      continue;
    }

    const absPath = path.resolve(projectDir, relativePath);

    if (!fs.existsSync(absPath)) {
      errors.push(`Asset not found: ${spec.key} -> ${relativePath}`);
      continue;
    }

    const ext = path.extname(absPath).toLowerCase();
    if (ext !== '.png' && ext !== '.webp') {
      errors.push(`${spec.key}: unsupported format "${ext}". Use .png or .webp`);
      continue;
    }

    const stat = fs.statSync(absPath);
    if (stat.size === 0) {
      errors.push(`${spec.key}: file is empty`);
      continue;
    }
    if (stat.size > 2 * 1024 * 1024) {
      warnings.push(`${spec.key}: file is large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Consider optimizing.`);
    }

    const dimensions = readImageDimensions(absPath, ext);
    if (dimensions) {
      const { width, height } = dimensions;

      if (width < spec.minWidth || height < spec.minHeight) {
        errors.push(
          `${spec.key}: image is ${width}x${height}, minimum required is ${spec.minWidth}x${spec.minHeight}`,
        );
      }

      const expectedRatio = spec.ratioWidth / spec.ratioHeight;
      const actualRatio = width / height;
      if (Math.abs(actualRatio - expectedRatio) > 0.01) {
        errors.push(
          `${spec.key}: aspect ratio is ${actualRatio.toFixed(3)} (${width}x${height}), ` +
          `expected ${spec.ratioWidth}:${spec.ratioHeight} (${expectedRatio.toFixed(3)})`,
        );
      }
    }

    resolvedPaths.set(spec.key, absPath);
  }

  return { valid: errors.length === 0, errors, warnings, resolvedPaths };
}

function readImageDimensions(
  filePath: string,
  ext: string,
): { width: number; height: number } | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(30);
    fs.readSync(fd, buffer, 0, 30, 0);

    if (ext === '.png') {
      // PNG signature check: bytes 1-3 = "PNG"
      if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
      // IHDR chunk: width at offset 16, height at offset 20 (big-endian uint32)
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (ext === '.webp') {
      if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
      if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') {
        // Lossy WebP
        return {
          width: buffer.readUInt16LE(26) & 0x3FFF,
          height: buffer.readUInt16LE(28) & 0x3FFF,
        };
      }
      if (chunk === 'VP8L') {
        // Lossless WebP
        const bits = buffer.readUInt32LE(21);
        return {
          width: (bits & 0x3FFF) + 1,
          height: ((bits >> 14) & 0x3FFF) + 1,
        };
      }
      if (chunk === 'VP8X') {
        // Extended WebP: canvas size at bytes 24-29
        return {
          width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
          height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
        };
      }
    }

    return null;
  } finally {
    fs.closeSync(fd);
  }
}
