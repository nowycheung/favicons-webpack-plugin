/**
 * @file this file is responsible for the persitance disk caching
 * it offers helpers to prevent recompilation of the favicons on
 * every build
 */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var pluginVersion = require('../package.json').version;

/**
 * Stores the given iconResult together with the control hashes as JSON file
 */
function emitCacheInformationFile (loader, query, cacheFile, fileHash, iconResult) {
  if (!query.persistentCache) {
    return;
  }
  loader.emitFile(cacheFile, JSON.stringify({
    hash: fileHash,
    version: pluginVersion,
    optionHash: generateHashForOptions(query),
    result: iconResult
  }));
}

/**
 * Checks if the given cache object is still valid
 */
function isCacheValid (cache, fileHash, query) {
  console.log('1 isCacheValid', cache.hash, fileHash);
  console.log('2 isCacheValid', cache.optionHash, generateHashForOptions(query));
  console.log('3 isCacheValid', cache.version, pluginVersion);
  // Verify that the source file is the same
  return cache.hash === fileHash &&
    // Verify that the options are the same
    cache.optionHash === generateHashForOptions(query) &&
    // Verify that the favicons version of the cache maches this version
    cache.version === pluginVersion;
}

/**
 * Try to load the file from the disc cache
 */
function loadIconsFromDiskCache (loader, query, cacheFile, fileHash, callback) {
  // Stop if cache is disabled
  console.log('1 loadIconsFromDiskCache', query.persistentCache);
  if (!query.persistentCache) return callback(null);
  var resolvedCacheFile = path.resolve(loader._compiler.parentCompilation.compiler.outputPath, cacheFile);

  fs.exists(resolvedCacheFile, function (exists) {
    console.log('2 loadIconsFromDiskCache', exists);
    if (!exists) return callback(null);
    fs.readFile(resolvedCacheFile, function (err, content) {
      console.log('3 loadIconsFromDiskCache', err);
      if (err) return callback(err);
      var cache;
      try {
        cache = JSON.parse(content);
        console.log('4 loadIconsFromDiskCache', isCacheValid(cache, fileHash, query));
        // Bail out if the file or the option changed
        if (!isCacheValid(cache, fileHash, query)) {
          return callback(null);
        }
      } catch (e) {
        console.log('5 loadIconsFromDiskCache', e);
        return callback(e);
      }
      callback(null, cache.result);
    });
  });
}

/**
 * Generates a md5 hash for the given options
 */
function generateHashForOptions (options) {
  var hash = crypto.createHash('md5');
  hash.update(JSON.stringify(options), 'utf8');
  return hash.digest('hex');
}

module.exports = {
  loadIconsFromDiskCache: loadIconsFromDiskCache,
  emitCacheInformationFile: emitCacheInformationFile
};
