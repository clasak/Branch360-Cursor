/**
 * Branch360 CRM - Database Setup Functions
 * Run setupDatabase() ONCE to initialize all sheets
 */

/**
 * [ADMIN] ONE-TIME SETUP - Creates all sheets with proper formatting
 * Run from Apps Script Editor: Run > setupDatabase
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timestamp = new Date();
  
  Logger.log('🚀 Starting Branch360 database setup...');
  
  // Create all sheets
  Object.keys(SHEETS).forEach(function(key) {
    const sheetName = SHEETS[key];
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log('Creating sheet: ' + sheetName);
      sheet = ss.insertSheet(sheetName);
      
      // Set headers
      const headers = DB_SCHEMA[sheetName];
      if (headers && headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        // Format header row
        sheet.getRange(1, 1, 1, headers.length)
          .setFontWeight('bold')
          .setBackground('#1F2937')
          .setFontColor('#FFFFFF')
          .setHorizontalAlignment('center');
        
        // Freeze header row
        sheet.setFrozenRows(1);
        
        // Auto-resize columns
        for (var i = 1; i <= headers.length; i++) {
          sheet.autoResizeColumn(i);
        }
      }
    } else {
      Logger.log('Sheet already exists: ' + sheetName);
    }
  });
  
  // Create named ranges for fast lookups
  createNamedRanges();
  
  // Set up triggers
  setupTriggers();
  
  // Initialize script properties
  initializeProperties();
  
  // Seed sample data for testing
  seedSampleData();
  
  Logger.log('✅ Database setup complete!');
  Logger.log('📊 Total sheets created: ' + Object.keys(SHEETS).length);
  
  SpreadsheetApp.getUi().alert(
    'Setup Complete!',
    'Branch360 database initialized successfully.\n\n' +
    'Sheets created: ' + Object.keys(SHEETS).length + '\n' +
    'Next step: Configure user roles and territories.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Creates named ranges for commonly accessed data
 */
function createNamedRanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // Users range
    const usersSheet = ss.getSheetByName(SHEETS.USERS);
    if (usersSheet && usersSheet.getLastRow() > 1) {
      const usersRange = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, usersSheet.getLastColumn());
      ss.setNamedRange('AllUsers', usersRange);
    }
    
    // Branches range
    const branchesSheet = ss.getSheetByName(SHEETS.BRANCHES);
    if (branchesSheet && branchesSheet.getLastRow() > 1) {
      const branchesRange = branchesSheet.getRange(2, 1, branchesSheet.getLastRow() - 1, branchesSheet.getLastColumn());
      ss.setNamedRange('AllBranches', branchesRange);
    }
    
    Logger.log('✓ Named ranges created');
  } catch (e) {
    Logger.log('⚠ Named ranges will be created after data is added: ' + e.message);
  }
}

/**
 * Sets up automatic triggers
 */
function setupTriggers() {
  // Delete existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Daily summary calculation (runs at 11:30 PM)
  ScriptApp.newTrigger('calculateDailySummaries')
    .timeBased()
    .atHour(23)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log('✓ Triggers configured');
}

/**
 * Initialize script properties
 */
function initializeProperties() {
  const props = PropertiesService.getScriptProperties();
  
  props.setProperty('DB_INITIALIZED', 'true');
  props.setProperty('DB_VERSION', '1.0.0');
  props.setProperty('SETUP_DATE', new Date().toISOString());
  props.setProperty('MAPBOX_TOKEN', 'pk.eyJ1IjoiY2xhc2FrIiwiYSI6ImNtaHduMzF4bTAxZjgya3BxMjMzYXNzM2kifQ.Ervu02B9hyFoRYmuQgodIA');
  
  Logger.log('✓ Properties initialized');
}

/**
 * Seeds sample data for testing
 */
function seedSampleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Seed Markets
  const marketsSheet = ss.getSheetByName(SHEETS.MARKETS);
  marketsSheet.appendRow(['MKT-001', 'Southwest Market', 'SW', null, true, new Date(), new Date()]);
  
  // Seed Regions
  const regionsSheet = ss.getSheetByName(SHEETS.REGIONS);
  regionsSheet.appendRow(['REG-001', 'Texas Region', 'TX', 'MKT-001', null, true, new Date(), new Date()]);
  
  // Seed Branches
  const branchesSheet = ss.getSheetByName(SHEETS.BRANCHES);
  branchesSheet.appendRow(['BRN-001', 'Houston Branch', 'HOU', 'REG-001', null, '123 Main St, Houston, TX', '555-0001', true, new Date(), new Date()]);
  branchesSheet.appendRow(['BRN-002', 'Austin Branch', 'AUS', 'REG-001', null, '456 Oak Ave, Austin, TX', '555-0002', true, new Date(), new Date()]);
  
  // Seed Sample User
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  const userEmail = Session.getActiveUser().getEmail();
  usersSheet.appendRow(['USR-001', 'Admin User', userEmail, 'Administrator', 'BRN-001', '', true, '', true, new Date(), new Date()]);
  
  Logger.log('✓ Sample data seeded');
}

/**
 * Repairs sheet if headers are corrupted
 */
function repairSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('Sheet not found: ' + sheetName);
    return false;
  }
  
  const expectedHeaders = DB_SCHEMA[sheetName];
  if (!expectedHeaders) {
    Logger.log('No schema defined for: ' + sheetName);
    return false;
  }
  
  // Reset headers
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setFontWeight('bold')
    .setBackground('#1F2937')
    .setFontColor('#FFFFFF');
  
  Logger.log('✓ Repaired sheet: ' + sheetName);
  return true;
}

/**
 * Clears all data (keeps headers) - USE WITH CAUTION
 */
function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Data?',
    'This will DELETE all data but keep sheet structure.\n\nAre you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    Object.values(SHEETS).forEach(function(sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet && sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
        Logger.log('Cleared: ' + sheetName);
      }
    });
    
    ui.alert('Data cleared successfully');
  }
}

// ============================================================================
// DATA ENTRY HELPERS - Use these functions to add Users and Branches
// ============================================================================

/**
 * [HELPER] Add a new user to the Users sheet
 * 
 * Usage: Edit the userData object below with your user information, then run this function
 * 
 * Format:
 * {
 *   name: "John Doe",
 *   email: "john@company.com",
 *   role: "Account Executive",  // See ROLES in config.gs for valid roles
 *   branchID: "BRN-001",         // Optional, leave empty string if not assigned
 *   territoryZips: "",           // Optional, pipe-delimited zip codes (e.g., "77001|77002")
 *   phoneNumber: "555-1234",     // Optional
 *   emailNotifications: true     // Optional, defaults to true
 * }
 */
function addMyUser() {
  const userData = {
    name: "John Doe",
    email: "john@company.com",
    role: "Account Executive",
    branchID: "BRN-001",
    territoryZips: "",
    phoneNumber: "",
    emailNotifications: true
  };
  
  const result = addUser(userData);
  
  if (result.success) {
    SpreadsheetApp.getUi().alert(
      '✅ User Added',
      'User created successfully!\n\n' +
      'UserID: ' + result.userID + '\n' +
      'Name: ' + userData.name + '\n' +
      'Email: ' + userData.email,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Failed to add user:\n' + result.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  
  Logger.log(result);
  return result;
}

/**
 * Add a new user to the Users sheet
 * @param {Object} userData - User information object
 * @return {Object} Result with userID or error message
 */
function addUser(userData) {
  try {
    const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
    if (!usersSheet) {
      throw new Error('Users sheet not found. Run setupDatabase() first.');
    }
    
    // Validate required fields
    if (!userData.name || !userData.email || !userData.role) {
      throw new Error('Missing required fields: name, email, and role are required');
    }
    
    // Check if user with this email already exists
    const existingUsers = getSheetData(SHEETS.USERS);
    const emailExists = existingUsers.some(function(user) {
      return user.Email && user.Email.toLowerCase() === userData.email.toLowerCase();
    });
    
    if (emailExists) {
      throw new Error('User with email ' + userData.email + ' already exists');
    }
    
    // Generate UserID
    const userID = generateUniqueID('USR');
    
    // Insert user
    insertRow(SHEETS.USERS, {
      UserID: userID,
      Name: userData.name,
      Email: userData.email,
      Role: userData.role,
      BranchID: userData.branchID || '',
      TerritoryZips: userData.territoryZips || '',
      Active: true,
      PhoneNumber: userData.phoneNumber || '',
      EmailNotifications: userData.emailNotifications !== false,
      CreatedOn: new Date(),
      UpdatedOn: new Date()
    });
    
    logAudit('CREATE_USER', SHEETS.USERS, userID, 'Created user: ' + userData.name);
    
    return {
      success: true,
      userID: userID,
      message: 'User created successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Add user failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * [HELPER] Add a new branch to the Branches sheet
 * 
 * Usage: Edit the branchData object below with your branch information, then run this function
 * 
 * Format:
 * {
 *   branchName: "Houston Branch",
 *   branchCode: "HOU",
 *   regionID: "REG-001",          // Required - must exist in Regions sheet
 *   managerUserID: "USR-005",     // Optional - UserID of branch manager
 *   address: "123 Main St, Houston, TX",  // Optional
 *   phone: "555-0001"             // Optional
 * }
 */
function addMyBranch() {
  const branchData = {
    branchName: "Houston Branch",
    branchCode: "HOU",
    regionID: "REG-001",
    managerUserID: "",
    address: "123 Main St, Houston, TX",
    phone: "555-0001"
  };
  
  const result = addBranch(branchData);
  
  if (result.success) {
    SpreadsheetApp.getUi().alert(
      '✅ Branch Added',
      'Branch created successfully!\n\n' +
      'BranchID: ' + result.branchID + '\n' +
      'Branch Name: ' + branchData.branchName + '\n' +
      'Branch Code: ' + branchData.branchCode,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Failed to add branch:\n' + result.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
  
  Logger.log(result);
  return result;
}

/**
 * Add a new branch to the Branches sheet
 * @param {Object} branchData - Branch information object
 * @return {Object} Result with branchID or error message
 */
function addBranch(branchData) {
  try {
    const branchesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.BRANCHES);
    if (!branchesSheet) {
      throw new Error('Branches sheet not found. Run setupDatabase() first.');
    }
    
    // Validate required fields
    if (!branchData.branchName || !branchData.branchCode || !branchData.regionID) {
      throw new Error('Missing required fields: branchName, branchCode, and regionID are required');
    }
    
    // Verify region exists
    const region = findRowByID(SHEETS.REGIONS, 'RegionID', branchData.regionID);
    if (!region) {
      throw new Error('Region ' + branchData.regionID + ' not found. Create the region first.');
    }
    
    // Verify manager exists if provided
    if (branchData.managerUserID) {
      const manager = findRowByID(SHEETS.USERS, 'UserID', branchData.managerUserID);
      if (!manager) {
        throw new Error('Manager UserID ' + branchData.managerUserID + ' not found.');
      }
    }
    
    // Check if branch code already exists
    const existingBranches = getSheetData(SHEETS.BRANCHES);
    const codeExists = existingBranches.some(function(branch) {
      return branch.BranchCode && branch.BranchCode.toUpperCase() === branchData.branchCode.toUpperCase();
    });
    
    if (codeExists) {
      throw new Error('Branch with code ' + branchData.branchCode + ' already exists');
    }
    
    // Generate BranchID
    const branchID = generateUniqueID('BRN');
    
    // Insert branch
    insertRow(SHEETS.BRANCHES, {
      BranchID: branchID,
      BranchName: branchData.branchName,
      BranchCode: branchData.branchCode,
      RegionID: branchData.regionID,
      ManagerUserID: branchData.managerUserID || '',
      Address: branchData.address || '',
      Phone: branchData.phone || '',
      Active: true,
      CreatedOn: new Date(),
      UpdatedOn: new Date()
    });
    
    logAudit('CREATE_BRANCH', SHEETS.BRANCHES, branchID, 'Created branch: ' + branchData.branchName);
    
    return {
      success: true,
      branchID: branchID,
      message: 'Branch created successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Add branch failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

