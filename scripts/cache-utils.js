const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'rbms');
const CACHE_VERSION = 'v2'; // Increment when cache format changes

/**
 * Calculate MD5 hash of a file
 */
function calculateFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

/**
 * Calculate hash for a string or object
 */
function calculateHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Generate cache key for an rbms call
 * @param {string} rScriptPath - Path to R script
 * @param {string} visitsFile - Path to visits CSV (temp file)
 * @param {string} countsFile - Path to counts CSV (temp file)
 * @param {Array<string>} args - Arguments passed to R script
 * @param {Object} options - Optional parameters
 * @param {Array<string>} options.sourceDataFiles - Source data files to hash instead of temp files
 * @returns {string} Cache key
 */
function generateCacheKey(rScriptPath, visitsFile, countsFile, args, options = {}) {
  const rScriptHash = calculateFileHash(rScriptPath);

  // Use source data files for cache key if provided (more stable than temp files)
  // Otherwise fall back to temp files
  let dataHash;
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
 * @param {string} cacheKey - Cache key
 * @param {string} outputFile - Optional output file path to restore
 * @returns {Object|null} Cached result (stdout) or null if not found/invalid
 */
function getCachedResult(cacheKey, outputFile = null) {
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

    // Restore output file if it was cached and path is provided
    if (outputFile && cached.outputFileContent) {
      try {
        fs.writeFileSync(outputFile, cached.outputFileContent, 'utf8');
      } catch (error) {
        console.warn(`  Warning: Failed to restore output file ${outputFile}: ${error.message}`);
      }
    }

    // Return stdout (or legacy 'result' field for backwards compatibility)
    return cached.stdout || cached.result;
  } catch (error) {
    console.warn(`  Warning: Failed to read cache file ${cacheKey}: ${error.message}`);
    return null;
  }
}

/**
 * Save result to cache
 * @param {string} cacheKey - Cache key
 * @param {string} stdout - R script stdout
 * @param {string} outputFile - Optional output file path to cache
 */
function setCachedResult(cacheKey, stdout, outputFile = null) {
  // Create cache directory if it doesn't exist (recursive is idempotent)
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  const cached = {
    timestamp: new Date().toISOString(),
    stdout: stdout
  };

  // Cache output file content if it exists
  if (outputFile && fs.existsSync(outputFile)) {
    try {
      cached.outputFileContent = fs.readFileSync(outputFile, 'utf8');
    } catch (error) {
      console.warn(`  Warning: Failed to read output file ${outputFile} for caching: ${error.message}`);
    }
  }

  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2));
  } catch (error) {
    console.warn(`  Warning: Failed to write cache file ${cacheKey}: ${error.message}`);
  }
}

/**
 * Clear all cache files
 */
function clearCache() {
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
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  if (!fs.existsSync(CACHE_DIR)) {
    return { fileCount: 0, totalSize: 0 };
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

module.exports = {
  generateCacheKey,
  getCachedResult,
  setCachedResult,
  clearCache,
  getCacheStats,
  calculateFileHash,
  calculateHash
};
