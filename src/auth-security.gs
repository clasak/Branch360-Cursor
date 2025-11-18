/**
 * Branch360 - Authentication & Security
 * Role-based access control, authorization, and security utilities
 */

// Role-Based Access Control
const ROLE_PERMISSIONS = {
  'Account Executive': ['read:own_leads', 'write:own_sales', 'read:own_pipeline'],
  'Technician': ['write:leads', 'read:own_routes', 'write:service_logs', 'write:issues'],
  'Operations Manager': ['read:branch_ops', 'write:branch_ops', 'assign:technicians', 'read:issues'],
  'Branch Manager': ['read:branch', 'write:branch', 'read:team', 'read:reports'],
  'Regional Director': ['read:region', 'write:region', 'read:branches'],
  'Market Director': ['read:market', 'write:market', 'read:regions'],
  'Executive': ['read:all', 'write:all'],
  'Administrator': ['read:all', 'write:all', 'admin:users', 'admin:config']
};

/**
 * Check if user has permission
 * @param {string} userRole - User's role
 * @param {string} permission - Required permission
 * @return {boolean} True if user has permission
 */
function hasPermission(userRole, permission) {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;
  
  return permissions.indexOf(permission) !== -1 || 
         permissions.indexOf('read:all') !== -1 || 
         permissions.indexOf('write:all') !== -1;
}

/**
 * Authorize request - checks authentication and permissions
 * @param {string} requiredPermission - Required permission for this action
 * @param {string} action - Action being performed (for audit log)
 * @param {string} table - Table being accessed (for audit log)
 * @param {string} recordID - Record ID being accessed (for audit log)
 * @return {boolean} True if authorized
 * @throws {Error} If unauthorized or insufficient permissions
 */
function authorizeRequest(requiredPermission, action, table, recordID) {
  const user = getCurrentUser();
  if (!user) {
    logAudit('AUTH_FAIL', 'Security', '', 'Unauthorized: User not authenticated');
    throw new Error('Unauthorized: User not authenticated');
  }
  
  const userRole = user.role || user.Role;
  if (!hasPermission(userRole, requiredPermission)) {
    logAudit('AUTH_FAIL', 'Security', '', 
      'Forbidden: User ' + user.email + ' attempted ' + action + ' without permission: ' + requiredPermission);
    throw new Error('Forbidden: Insufficient permissions');
  }
  
  // Log successful authorization
  if (action && table) {
    logAudit(action || 'AUTHORIZED', table || 'Security', recordID || '', 
      'Authorized: ' + userRole + ' performing ' + action);
  }
  
  return true;
}

/**
 * Get user's data scope (what data they can see)
 * @param {string} userID - User ID
 * @return {Object} Data scope object
 */
function getUserDataScope(userID) {
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) return { scope: 'none' };
  
  const role = String(user.Role || '').toLowerCase();
  
  if (role === 'account executive' || role === 'ae') {
    return { scope: 'user', userID: userID };
  } else if (role === 'technician' || role.includes('specialist')) {
    return { scope: 'user', userID: userID };
  } else if (role === 'operations manager' || role === 'ops manager') {
    return { scope: 'branch', branchID: user.BranchID };
  } else if (role === 'branch manager') {
    return { scope: 'branch', branchID: user.BranchID };
  } else if (role === 'regional director') {
    const regions = getUserRegions(userID);
    return { scope: 'region', regionIDs: regions };
  } else if (role === 'market director') {
    const markets = getUserMarkets(userID);
    return { scope: 'market', marketIDs: markets };
  } else if (role === 'executive' || role === 'administrator') {
    return { scope: 'all' };
  }
  
  return { scope: 'user', userID: userID };
}

/**
 * Get regions managed by a regional director
 * @param {string} userID - Regional Director User ID
 * @return {Array<string>} Array of Region IDs
 */
function getUserRegions(userID) {
  const regions = getSheetData(SHEETS.REGIONS);
  return regions
    .filter(function(region) {
      return String(region.DirectorUserID) === String(userID) && region.Active !== false;
    })
    .map(function(region) {
      return region.RegionID;
    });
}

/**
 * Get markets managed by a market director
 * @param {string} userID - Market Director User ID
 * @return {Array<string>} Array of Market IDs
 */
function getUserMarkets(userID) {
  const markets = getSheetData(SHEETS.MARKETS);
  return markets
    .filter(function(market) {
      return String(market.DirectorUserID) === String(userID) && market.Active !== false;
    })
    .map(function(market) {
      return market.MarketID;
    });
}

/**
 * Sanitize user input to prevent XSS attacks
 * @param {*} input - Input to sanitize
 * @return {*} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters and scripts
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @return {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(function(item) {
      return sanitizeObject(item);
    });
  }
  
  var sanitized = {};
  Object.keys(obj).forEach(function(key) {
    var value = obj[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

/**
 * PLACEHOLDER - Okta SSO Integration
 * TODO: Implement Okta SSO authentication
 * This will integrate with Okta's OAuth 2.0 / OpenID Connect flow
 * @return {Object} Login result
 */
function loginWithOkta() {
  Logger.log('[PLACEHOLDER] Okta SSO not yet implemented');
  logAudit('SSO_ATTEMPT', 'Security', '', 'Okta SSO login attempted - not configured');
  return { 
    success: false, 
    message: 'Okta SSO pending configuration',
    documentation: 'See https://developer.okta.com/docs/guides/implement-oauth-for-google-sites/overview/'
  };
}

/**
 * Session management (using Google's built-in authentication)
 * @return {Object|null} Session object or null
 */
function getActiveSession() {
  const user = getCurrentUser();
  if (!user) return null;
  
  return {
    userID: user.userID || user.UserID,
    email: user.email || user.Email,
    role: user.role || user.Role,
    active: true,
    authenticatedAt: new Date(),
    permissions: ROLE_PERMISSIONS[user.role || user.Role] || [],
    dataScope: getUserDataScope(user.userID || user.UserID)
  };
}

/**
 * Enhanced audit logging wrapper that ensures all actions are logged
 * This should be called for all sensitive operations
 * @param {string} action - Action performed
 * @param {string} table - Table affected
 * @param {string} recordID - Record ID affected
 * @param {string} details - Additional details
 * @param {Object} additionalData - Additional data to log
 */
function logSecurityAudit(action, table, recordID, details, additionalData) {
  try {
    const user = getCurrentUser();
    const userEmail = user ? (user.email || user.Email) : Session.getActiveUser().getEmail();
    const userID = user ? (user.userID || user.UserID) : null;
    const userRole = user ? (user.role || user.Role) : 'Unknown';
    
    var fullDetails = details || '';
    if (additionalData) {
      fullDetails += (fullDetails ? ' | ' : '') + JSON.stringify(additionalData);
    }
    fullDetails += ' | Role: ' + userRole;
    
    const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.AUDIT_LOG);
    if (!auditSheet) {
      Logger.log('⚠ Audit log sheet not found');
      return;
    }
    
    auditSheet.appendRow([
      new Date(),
      userEmail,
      userID,
      action,
      table || '',
      recordID || '',
      fullDetails,
      '', // IP Address (not available in Apps Script)
      '' // User Agent (not available in Apps Script)
    ]);
  } catch (e) {
    Logger.log('❌ Security audit log failed: ' + e.message);
  }
}

/**
 * Check if user can access a specific record based on data scope
 * @param {string} userID - User ID
 * @param {string} table - Table name
 * @param {Object} record - Record to check access for
 * @return {boolean} True if user can access the record
 */
function canAccessRecord(userID, table, record) {
  const scope = getUserDataScope(userID);
  
  if (scope.scope === 'all') return true;
  if (scope.scope === 'none') return false;
  
  // Check user-level scope
  if (scope.scope === 'user') {
    // For user-scoped records, check if record belongs to user
    var userField = table === SHEETS.LEADS ? 'Tech_UserID' :
                   table === SHEETS.TRACKER ? 'AE_UserID' :
                   table === SHEETS.SALES_ACTIVITY ? 'AE_UserID' :
                   'UserID';
    return String(record[userField]) === String(scope.userID);
  }
  
  // Check branch-level scope
  if (scope.scope === 'branch' && record.BranchID) {
    return String(record.BranchID) === String(scope.branchID);
  }
  
  // Check region-level scope
  if (scope.scope === 'region' && record.RegionID) {
    return scope.regionIDs && scope.regionIDs.indexOf(record.RegionID) !== -1;
  }
  
  // Check market-level scope
  if (scope.scope === 'market' && record.MarketID) {
    return scope.marketIDs && scope.marketIDs.indexOf(record.MarketID) !== -1;
  }
  
  // If record doesn't have matching field, deny access
  return false;
}

/**
 * Filter data based on user's data scope
 * @param {string} userID - User ID
 * @param {string} table - Table name
 * @param {Array<Object>} records - Records to filter
 * @return {Array<Object>} Filtered records
 */
function filterByDataScope(userID, table, records) {
  const scope = getUserDataScope(userID);
  
  if (scope.scope === 'all') return records;
  if (scope.scope === 'none') return [];
  
  return records.filter(function(record) {
    return canAccessRecord(userID, table, record);
  });
}

/**
 * Wrapper function to protect endpoints with authorization
 * Usage: Wrap your endpoint function with this to enforce RBAC
 * Example:
 *   function myEndpoint() {
 *     return withAuthorization('read:own_leads', 'GET_LEADS', SHEETS.LEADS, function() {
 *       // Your endpoint logic here
 *     });
 *   }
 * @param {string} requiredPermission - Required permission
 * @param {string} action - Action name for audit log
 * @param {string} table - Table name for audit log
 * @param {Function} callback - Function to execute if authorized
 * @return {*} Result of callback function
 * @throws {Error} If unauthorized
 */
function withAuthorization(requiredPermission, action, table, callback) {
  try {
    authorizeRequest(requiredPermission, action, table);
    return callback();
  } catch (e) {
    Logger.log('❌ Authorization failed: ' + e.message);
    throw e;
  }
}

