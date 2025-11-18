/**
 * Branch360 CRM - Core Backend Functions
 * Helper utilities used across all modules
 */

/**
 * Generates a unique ID with prefix
 * @param {string} prefix - ID prefix (e.g., 'USR', 'BRN', 'LEAD')
 * @return {string} Unique ID
 */
function generateUniqueID(prefix) {
  prefix = prefix || 'ID';
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 10000);
  return prefix + '-' + timestamp + '-' + random;
}

/**
 * Gets the current authenticated user
 * @return {Object} User object or null
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
  
  if (!usersSheet) return null;
  
  const data = usersSheet.getDataRange().getValues();
  const headers = data[0];
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('Email')] === email) {
      return {
        userID: data[i][headers.indexOf('UserID')],
        name: data[i][headers.indexOf('Name')],
        email: email,
        role: data[i][headers.indexOf('Role')],
        branchID: data[i][headers.indexOf('BranchID')],
        active: data[i][headers.indexOf('Active')]
      };
    }
  }
  
  return null;
}

/**
 * Logs an action to the audit log
 * @param {string} action - Action performed
 * @param {string} table - Table affected
 * @param {string} recordID - Record ID affected
 * @param {string} details - Additional details
 */
function logAudit(action, table, recordID, details) {
  try {
    const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.AUDIT_LOG);
    const user = getCurrentUser();
    const userEmail = Session.getActiveUser().getEmail();
    const userID = user ? user.userID : null;
    
    auditSheet.appendRow([
      new Date(),
      userEmail,
      userID,
      action,
      table,
      recordID || '',
      details || '',
      '', // IP Address (not available in Apps Script)
      '' // User Agent (not available in Apps Script)
    ]);
  } catch (e) {
    Logger.log('Audit log failed: ' + e.message);
  }
}

/**
 * Gets data from a sheet as array of objects
 * @param {string} sheetName - Name of sheet
 * @param {Object} filters - Optional filters {column: value}
 * @return {Array<Object>} Array of row objects
 */
function getSheetData(sheetName, filters) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  var result = rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
  
  // Apply filters if provided
  if (filters) {
    Object.keys(filters).forEach(function(column) {
      result = result.filter(function(row) {
        return row[column] === filters[column];
      });
    });
  }
  
  return result;
}

/**
 * Finds a row by ID in any sheet
 * @param {string} sheetName - Sheet name
 * @param {string} idColumn - Name of ID column
 * @param {string} idValue - Value to find
 * @return {Object|null} Row object or null
 */
function findRowByID(sheetName, idColumn, idValue) {
  const data = getSheetData(sheetName);
  return data.find(function(row) {
    return String(row[idColumn]) === String(idValue);
  }) || null;
}

/**
 * Updates a row by ID
 * @param {string} sheetName - Sheet name
 * @param {string} idColumn - ID column name
 * @param {string} idValue - ID value
 * @param {Object} updates - Object with fields to update
 * @return {boolean} Success
 */
function updateRowByID(sheetName, idColumn, idValue, updates) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumn);
  
  if (idIndex === -1) return false;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(idValue)) {
      // Found the row
      Object.keys(updates).forEach(function(column) {
        const colIndex = headers.indexOf(column);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[column]);
        }
      });
      
      // Update UpdatedOn timestamp if column exists
      const updatedOnIndex = headers.indexOf('UpdatedOn');
      if (updatedOnIndex !== -1) {
        sheet.getRange(i + 1, updatedOnIndex + 1).setValue(new Date());
      }
      
      logAudit('UPDATE', sheetName, idValue, JSON.stringify(updates));
      return true;
    }
  }
  
  return false;
}

/**
 * Inserts a new row
 * @param {string} sheetName - Sheet name
 * @param {Object} rowData - Object with column values
 * @return {string} Generated ID
 */
function insertRow(sheetName, rowData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = [];
  
  headers.forEach(function(header) {
    row.push(rowData[header] !== undefined ? rowData[header] : '');
  });
  
  sheet.appendRow(row);
  
  const idColumn = headers[0]; // Assume first column is ID
  const id = rowData[idColumn];
  logAudit('INSERT', sheetName, id, JSON.stringify(rowData));
  
  return id;
}

/**
 * Gets branch hierarchy (Market > Region > Branch)
 * @param {string} branchID - Branch ID
 * @return {Object} Hierarchy info
 */
function getBranchHierarchy(branchID) {
  const branch = findRowByID(SHEETS.BRANCHES, 'BranchID', branchID);
  if (!branch) return null;
  
  const region = findRowByID(SHEETS.REGIONS, 'RegionID', branch.RegionID);
  const market = region ? findRowByID(SHEETS.MARKETS, 'MarketID', region.MarketID) : null;
  
  return {
    branch: branch,
    region: region,
    market: market
  };
}

/**
 * Calculates date ranges for reporting
 * @param {string} period - 'today', 'week', 'month', 'quarter', 'year'
 * @return {Object} {startDate, endDate}
 */
function getDateRange(period) {
  const now = new Date();
  var startDate, endDate;
  
  switch(period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
  }
  
  return { startDate: startDate, endDate: endDate };
}

/**
 * Daily summary calculation (runs via trigger)
 */
function calculateDailySummaries() {
  Logger.log('Running daily summary calculation...');
  // This will be populated by other agents
  Logger.log('Daily summaries complete');
}

