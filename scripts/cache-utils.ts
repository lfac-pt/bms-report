import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'rbms');
const CACHE_VERSION = 'v3'; // Increment when cache format changes (added additionalFiles support)

interface CacheOptions {
  sourceDataFiles?: string[];
}

interface CachedData {
  timestamp: string;
  stdout: string;
  outputFileContent?: string;
  additionalFiles?: (string | null)[];
  result?: string; // Legacy field for backwards compatibility
}

interface CacheStats {
  fileCount: number;
  totalSize: number;
  totalSizeMB: string;
}

/**
 * Calculate MD5 hash of a file
 */
export function calculateFileHash(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

/**
 * Calculate hash for a string or object
 */
export function calculateHash(data: string | object): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Generate cache key for an rbms call
 */
export function generateCacheKey(
  rScriptPath: string,
  visitsFile: string,
  countsFile: string,
  args: string[],
  options: CacheOptions = {}
): string {
  const rScriptHash = calculateFileHash(rScriptPath);

  // Use source data files for cache key if provided (more stable than temp files)
  // Otherwise fall back to temp files
  let dataHash: string;
  if (options.sourceDataFiles && options.sourceDataFiles.length > 0) {
    // Include filename in missing sentinel to prevent hash collisions
    const sourceHashes = options.sourceDataFiles.map(f =>
      calculateFileHash(f) || `missing:${path.basename(f)}`
    );
    dataHash = calculateHash(sourceHashes.join('|'));
  } else {
    const visitsHash = calculateFileHash(visitsFile);
    const countsHash = calculateFileHash(countsFile);
    dataHash = calculateHash(`${visitsHash}|${countsHash}`);
  }

  const argsHash = calculateHash(args.join('|'));

  // Combine all hashes with cache version
  const combined = `${CACHE_VERSION}|${rScriptHash}|${dataHash}|${argsHash}`;
  return calculateHash(combined);
}

/**
 * Get cached result for an rbms call
 */
export function getCachedResult(
  cacheKey: string,
  outputFile: string | null = null,
  additionalFiles: string[] = []
): string | null {
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const cached: CachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

    // Restore output file if it was cached and path is provided
    if (outputFile && cached.outputFileContent) {
      try {
        fs.writeFileSync(outputFile, cached.outputFileContent, 'utf8');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`  Warning: Failed to restore output file ${outputFile}: ${errorMessage}`);
      }
    }

    // Restore additional binary files (e.g., RDS bootstrap files)
    if (cached.additionalFiles && additionalFiles.length > 0) {
      additionalFiles.forEach((filePath, index) => {
        if (cached.additionalFiles![index]) {
          try {
            const buffer = Buffer.from(cached.additionalFiles![index]!, 'base64');
            // Ensure directory exists
            const dir = path.dirname(filePath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, buffer);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`  Warning: Failed to restore additional file ${filePath}: ${errorMessage}`);
          }
        }
      });
    }

    // Return stdout (or legacy 'result' field for backwards compatibility)
    return cached.stdout || cached.result || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`  Warning: Failed to read cache file ${cacheKey}: ${errorMessage}`);
    return null;
  }
}

/**
 * Save result to cache
 */
export function setCachedResult(
  cacheKey: string,
  stdout: string,
  outputFile: string | null = null,
  additionalFiles: string[] = []
): void {
  // Create cache directory if it doesn't exist (recursive is idempotent)
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  const cached: CachedData = {
    timestamp: new Date().toISOString(),
    stdout: stdout
  };

  // Cache output file content if it exists
  if (outputFile && fs.existsSync(outputFile)) {
    try {
      cached.outputFileContent = fs.readFileSync(outputFile, 'utf8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`  Warning: Failed to read output file ${outputFile} for caching: ${errorMessage}`);
    }
  }

  // Cache additional binary files (e.g., RDS bootstrap files) as base64
  if (additionalFiles.length > 0) {
    cached.additionalFiles = [];
    additionalFiles.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        try {
          const buffer = fs.readFileSync(filePath);
          cached.additionalFiles!.push(buffer.toString('base64'));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`  Warning: Failed to read additional file ${filePath} for caching: ${errorMessage}`);
          cached.additionalFiles!.push(null);
        }
      } else {
        cached.additionalFiles!.push(null);
      }
    });
  }

  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`  Warning: Failed to write cache file ${cacheKey}: ${errorMessage}`);
  }
}

/**
 * Clear all cache files
 */
export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    });
    console.log(`  Cleared ${files.length} cache files`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  if (!fs.existsSync(CACHE_DIR)) {
    return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' };
  }

  const files = fs.readdirSync(CACHE_DIR);
  const totalSize = files.reduce((sum, file) => {
    const stats = fs.statSync(path.join(CACHE_DIR, file));
    return sum + stats.size;
  }, 0);

  return {
    fileCount: files.length,
    totalSize: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
  };
}
