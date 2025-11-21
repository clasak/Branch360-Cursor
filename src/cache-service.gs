/**
 * Branch360 - Cache Service
 * Performance optimization using Google Apps Script CacheService
 * C. PERFORMANCE: Reduces repeated calculations and database reads
 */

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache durations in seconds
  TERRITORIES: 3600,        // 1 hour - territory stats change slowly
  DASHBOARD_KPI: 1800,      // 30 minutes - KPIs update frequently
  USER_PERMISSIONS: 21600,  // 6 hours - permissions rarely change
  BRANCH_HIERARCHY: 7200,   // 2 hours - org structure stable
  OPTIONS_DATA: 3600,       // 1 hour - dropdown options stable
  ACTIVITY_ANALYTICS: 900,  // 15 minutes - activity data changes frequently
  UNIFIED_SALES: 600,       // 10 minutes - sales data active
  OPS_QUEUE: 600           // 10 minutes - ops queue active
};

/**
 * Generate a simple hash for cache keys to avoid collisions
 * @param {string} str - String to hash
 * @return {string} Hash string
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Register a cache key in the registry
 * @param {string} key - Cache key to register
 */
function registerCacheKey(key) {
  try {
    const cache = CacheService.getScriptCache();
    const registry = cache.get('CACHE_REGISTRY');
    let keys = registry ? JSON.parse(registry) : [];

    if (keys.indexOf(key) === -1) {
      keys.push(key);
      cache.put('CACHE_REGISTRY', JSON.stringify(keys), 86400); // 24 hours
    }
  } catch (e) {
    Logger.log('⚠️ Could not register cache key: ' + e.message);
  }
}

/**
 * Get cached data or compute and cache it
 * @param {string} key - Cache key
 * @param {function} computeFn - Function to compute data if cache miss
 * @param {number} ttl - Time to live in seconds
 * @return {*} Cached or computed data
 */
function getCached(key, computeFn, ttl) {
  const cache = CacheService.getScriptCache();

  try {
    // Try to get from cache
    const cached = cache.get(key);

    if (cached !== null) {
      Logger.log('✅ Cache HIT: ' + key);
      try {
        return JSON.parse(cached);
      } catch (e) {
        // If parse fails, return raw value
        return cached;
      }
    }

    // Cache miss - compute value
    Logger.log('⚠️ Cache MISS: ' + key + ' - Computing...');
    const value = computeFn();

    // Store in cache
    try {
      const serialized = JSON.stringify(value);
      // CacheService has a 100KB limit per entry
      if (serialized.length > 100000) {
        Logger.log('⚠️ Cache value too large for key: ' + key + ' (' + serialized.length + ' bytes)');
        // For large datasets, cache a summary or use chunking
        return value;
      }
      cache.put(key, serialized, ttl || 3600);
      registerCacheKey(key); // Register the key in the registry
      Logger.log('✅ Cached: ' + key + ' (TTL: ' + (ttl || 3600) + 's)');
    } catch (e) {
      Logger.log('⚠️ Could not cache: ' + key + ' - ' + e.message);
    }

    return value;

  } catch (e) {
    Logger.log('❌ Cache error for ' + key + ': ' + e.message);
    // Fallback: compute without caching
    return computeFn();
  }
}

/**
 * Invalidate cache for a specific key
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
  const cache = CacheService.getScriptCache();
  cache.remove(key);
  Logger.log('🗑️ Invalidated cache: ' + key);
}

/**
 * Invalidate all caches matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'TERRITORY_*')
 */
function invalidateCachePattern(pattern) {
  // CacheService doesn't support pattern matching, so we maintain a registry
  const cache = CacheService.getScriptCache();
  const registry = cache.get('CACHE_REGISTRY');
  
  if (registry) {
    try {
      const keys = JSON.parse(registry);
      const regex = new RegExp(pattern.replace('*', '.*'));
      
      keys.forEach(function(key) {
        if (regex.test(key)) {
          cache.remove(key);
          Logger.log('🗑️ Invalidated cache: ' + key);
        }
      });
    } catch (e) {
      Logger.log('⚠️ Could not invalidate cache pattern: ' + e.message);
    }
  }
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['TERRITORIES', 'DASHBOARD_KPI', 'USER_PERMISSIONS', 'BRANCH_HIERARCHY', 
                   'OPTIONS_DATA', 'ACTIVITY_ANALYTICS', 'UNIFIED_SALES', 'OPS_QUEUE']);
  Logger.log('🗑️ Cleared all caches');
  return { success: true, message: 'All caches cleared' };
}

/**
 * Get territories with caching
 * BEFORE: getTerritories() hits database every time
 * AFTER: Cached for 1 hour
 */
function getTerritoriesCached() {
  return getCached('TERRITORIES_ALL', function() {
    return getTerritories();
  }, CACHE_CONFIG.TERRITORIES);
}

/**
 * Get branch hierarchy with caching
 * @param {string} branchID - Branch ID
 */
function getBranchHierarchyCached(branchID) {
  const cacheKey = 'BRANCH_HIERARCHY_' + branchID;
  
  return getCached(cacheKey, function() {
    return getBranchHierarchy(branchID);
  }, CACHE_CONFIG.BRANCH_HIERARCHY);
}

/**
 * Get unified sales with caching
 * @param {Object} filters - Filters
 */
function getUnifiedSalesCached(filters) {
  // Create cache key from filters using hash to avoid collisions
  const filterKey = JSON.stringify(filters || {});
  const cacheKey = 'UNIFIED_SALES_' + simpleHash(filterKey);

  return getCached(cacheKey, function() {
    return getUnifiedSales(filters);
  }, CACHE_CONFIG.UNIFIED_SALES);
}

/**
 * Get ops queue with caching
 * @param {Object} filters - Filters
 */
function getOpsQueueCached(filters) {
  const filterKey = JSON.stringify(filters || {});
  const cacheKey = 'OPS_QUEUE_' + simpleHash(filterKey);

  return getCached(cacheKey, function() {
    return getOpsQueue(filters);
  }, CACHE_CONFIG.OPS_QUEUE);
}

/**
 * Get activity analytics with caching
 * @param {Object} filters - Filters
 */
function getActivityAnalyticsCached(filters) {
  const filterKey = JSON.stringify(filters || {});
  const cacheKey = 'ACTIVITY_ANALYTICS_' + simpleHash(filterKey);

  return getCached(cacheKey, function() {
    return getActivityAnalytics(filters);
  }, CACHE_CONFIG.ACTIVITY_ANALYTICS);
}

/**
 * Get options data (dropdowns) with caching
 * @param {string} optionType - Type of options (e.g., 'service_types', 'branches')
 */
function getOptionsDataCached(optionType) {
  const cacheKey = 'OPTIONS_' + optionType;
  
  return getCached(cacheKey, function() {
    // Route to appropriate options function
    switch (optionType) {
      case 'service_types':
        return getServiceTypeOptions();
      case 'branches':
        return getSheetData(SHEETS.BRANCHES);
      case 'users':
        return getSheetData(SHEETS.USERS, { Active: true });
      case 'territories':
        return getSheetData(SHEETS.TERRITORIES, { Active: true });
      default:
        return [];
    }
  }, CACHE_CONFIG.OPTIONS_DATA);
}

/**
 * Invalidate caches when data is updated
 * Call this after any write operation
 * @param {string} sheetName - Name of sheet that was updated
 */
function invalidateCachesForSheet(sheetName) {
  const cache = CacheService.getScriptCache();
  
  switch (sheetName) {
    case SHEETS.UNIFIED_SALES:
      invalidateCachePattern('UNIFIED_SALES_*');
      invalidateCachePattern('DASHBOARD_KPI_*');
      break;
    
    case SHEETS.START_PACKETS:
      invalidateCachePattern('OPS_QUEUE_*');
      invalidateCachePattern('UNIFIED_SALES_*');
      break;
    
    case SHEETS.OPS_PIPELINE:
      invalidateCachePattern('OPS_QUEUE_*');
      invalidateCachePattern('UNIFIED_SALES_*');
      break;
    
    case SHEETS.TERRITORIES:
      cache.remove('TERRITORIES_ALL');
      invalidateCachePattern('TERRITORY_*');
      break;
    
    case SHEETS.BRANCHES:
    case SHEETS.REGIONS:
    case SHEETS.MARKETS:
      invalidateCachePattern('BRANCH_HIERARCHY_*');
      invalidateCachePattern('OPTIONS_*');
      break;
    
    case SHEETS.USERS:
      invalidateCachePattern('USER_PERMISSIONS_*');
      invalidateCachePattern('OPTIONS_*');
      break;
    
    case SHEETS.ACTIVITY_LOG:
      invalidateCachePattern('ACTIVITY_ANALYTICS_*');
      break;
    
    default:
      // Unknown sheet - clear all to be safe
      Logger.log('⚠️ Unknown sheet updated: ' + sheetName + ' - clearing all caches');
      clearAllCaches();
  }
  
  Logger.log('🗑️ Invalidated caches for sheet: ' + sheetName);
}

/**
 * Wrapper for insertRow that invalidates cache
 */
function insertRowWithCacheInvalidation(sheetName, rowData) {
  const result = insertRow(sheetName, rowData);
  invalidateCachesForSheet(sheetName);
  return result;
}

/**
 * Wrapper for updateRowByID that invalidates cache
 */
function updateRowByIDWithCacheInvalidation(sheetName, columnName, value, updates) {
  const result = updateRowByID(sheetName, columnName, value, updates);
  invalidateCachesForSheet(sheetName);
  return result;
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 */
function getCacheStatistics() {
  // Note: CacheService doesn't provide built-in stats, so we track manually
  const cache = CacheService.getScriptCache();
  
  // Try to get some sample keys to see what's cached
  const sampleKeys = [
    'TERRITORIES_ALL',
    'UNIFIED_SALES_',
    'OPS_QUEUE_',
    'ACTIVITY_ANALYTICS_',
    'BRANCH_HIERARCHY_BRN-001'
  ];
  
  const cachedKeys = [];
  sampleKeys.forEach(function(key) {
    const value = cache.get(key);
    if (value) {
      cachedKeys.push({
        key: key,
        size: value.length,
        preview: value.substring(0, 100)
      });
    }
  });
  
  return {
    cachedEntries: cachedKeys.length,
    sampleEntries: cachedKeys,
    cacheConfig: CACHE_CONFIG,
    message: 'Cache statistics (sample)'
  };
}

/**
 * Pre-warm critical caches
 * Call this during off-peak hours or after major data updates
 */
function prewarmCaches() {
  Logger.log('🔥 Pre-warming caches...');
  
  try {
    // Warm up territories
    getTerritoriesCached();
    
    // Warm up unified sales for main branches
    const branches = getSheetData(SHEETS.BRANCHES, { Active: true });
    branches.slice(0, 5).forEach(function(branch) { // Limit to first 5 branches
      getUnifiedSalesCached({ branchId: branch.BranchID });
      getBranchHierarchyCached(branch.BranchID);
    });
    
    // Warm up options
    ['service_types', 'branches', 'users', 'territories'].forEach(function(optionType) {
      getOptionsDataCached(optionType);
    });
    
    Logger.log('✅ Cache pre-warming complete');
    
    return { success: true, message: 'Caches pre-warmed' };
    
  } catch (e) {
    Logger.log('❌ Cache pre-warming failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Install cache pre-warming trigger
 * Runs daily at 2 AM to refresh caches
 */
function installCachePrewarmTrigger() {
  // Remove existing prewarm triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'prewarmCaches') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Install new daily trigger
  ScriptApp.newTrigger('prewarmCaches')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
  
  Logger.log('✅ Cache pre-warm trigger installed (runs daily at 2 AM)');
  
  return { success: true, message: 'Cache pre-warm trigger installed' };
}

