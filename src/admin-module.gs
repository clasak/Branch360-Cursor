/**
 * Branch360 - Admin Module
 * Administrator functions for user management, system configuration, and deployment
 */

/**
 * Get admin dashboard statistics
 * @return {Object} Admin statistics
 */
function getAdminStats() {
  authorizeRequest('admin:config', 'GET_ADMIN_STATS', 'Users', '');
  
  const users = getSheetData(SHEETS.USERS);
  const territories = getSheetData(SHEETS.TERRITORIES, { Active: true });
  
  const activeUsers = users.filter(function(user) {
    return user.Active !== false;
  });
  
  return {
    totalUsers: users.length || 0,
    activeUsers: activeUsers.length || 0,
    territories: territories.length || 0,
    systemStatus: 'OK'
  };
}

/**
 * Get all users (admin only)
 * @return {Array<Object>} All users
 */
function getAllUsers() {
  authorizeRequest('admin:users', 'GET_ALL_USERS', 'Users', '');
  
  const users = getSheetData(SHEETS.USERS);
  return users.map(function(user) {
    return {
      UserID: user.UserID,
      Name: user.Name,
      Email: user.Email,
      Role: user.Role,
      BranchID: user.BranchID,
      Active: user.Active !== false,
      PhoneNumber: user.PhoneNumber || '',
      CreatedOn: user.CreatedOn,
      UpdatedOn: user.UpdatedOn
    };
  });
}

/**
 * Create a new user (admin only)
 * @param {Object} userData - User data
 * @return {Object} Created user
 */
function createUser(userData) {
  authorizeRequest('admin:users', 'CREATE_USER', 'Users', '');
  
  // Validate required fields
  if (!userData.name || !userData.email || !userData.role) {
    throw new Error('Missing required fields: name, email, role');
  }
  
  // Check if user already exists
  const existingUsers = getSheetData(SHEETS.USERS, { Email: userData.email });
  if (existingUsers.length > 0) {
    throw new Error('User with this email already exists');
  }
  
  // Generate user ID
  const userID = generateUniqueID('USR');
  
  // Create user record
  const userRecord = {
    UserID: userID,
    Name: userData.name,
    Email: userData.email,
    Role: userData.role,
    BranchID: userData.branchID || 'BRN-001',
    TerritoryZips: userData.territoryZips || '',
    Active: true,
    PhoneNumber: userData.phoneNumber || '',
    EmailNotifications: userData.emailNotifications !== false,
    CreatedOn: new Date(),
    UpdatedOn: new Date()
  };
  
  // Insert into Users sheet using insertRow helper
  insertRow(SHEETS.USERS, userRecord);
  
  // Log audit
  logAudit('CREATE', 'Users', userID, 'Created user: ' + userData.name);
  
  return {
    success: true,
    userID: userID,
    message: 'User created successfully'
  };
}

/**
 * Toggle user active status
 * @param {string} userID - User ID
 * @return {Object} Result
 */
function toggleUserActive(userID) {
  authorizeRequest('admin:users', 'TOGGLE_USER_ACTIVE', 'Users', userID);
  
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) {
    throw new Error('User not found');
  }
  
  const newActiveStatus = !(user.Active !== false);
  
  // Update user record
  updateRowByID(SHEETS.USERS, 'UserID', userID, {
    Active: newActiveStatus,
    UpdatedOn: new Date()
  });
  
  // Log audit
  logAudit('UPDATE', 'Users', userID, 
    'Changed user active status to: ' + (newActiveStatus ? 'Active' : 'Inactive'));
  
  return {
    success: true,
    active: newActiveStatus,
    message: 'User status updated'
  };
}

/**
 * Get territories for admin view
 * @return {Array<Object>} Territories with details
 */
function getTerritories() {
  authorizeRequest('admin:config', 'GET_TERRITORIES', 'Territories', '');
  
  const territories = getSheetData(SHEETS.TERRITORIES);
  const users = getSheetData(SHEETS.USERS);
  
  return territories.map(function(territory) {
    const ae = users.find(function(u) {
      return u.UserID === territory.AE_UserID;
    });
    
    const zipCodes = String(territory.ZipCodes || '').split('|').filter(function(z) {
      return z.trim().length > 0;
    });
    
    return {
      TerritoryID: territory.TerritoryID,
      TerritoryName: territory.TerritoryName,
      AE_UserID: territory.AE_UserID,
      AE_Email: ae ? ae.Email : '',
      AE_Name: ae ? ae.Name : '',
      BranchID: territory.BranchID,
      ZipCodes: zipCodes,
      zipCount: zipCodes.length,
      Active: territory.Active !== false,
      CreatedOn: territory.CreatedOn,
      UpdatedOn: territory.UpdatedOn
    };
  });
}

/**
 * Get audit log entries
 * @param {Object} filters - Filter options (date, action)
 * @return {Array<Object>} Audit log entries
 */
function getAuditLog(filters) {
  authorizeRequest('admin:config', 'GET_AUDIT_LOG', 'AuditLog', '');
  
  const auditLog = getSheetData(SHEETS.AUDIT_LOG);
  
  let filtered = auditLog;
  
  // Filter by date if provided
  if (filters && filters.date) {
    const filterDate = new Date(filters.date);
    filtered = filtered.filter(function(entry) {
      const entryDate = new Date(entry.Timestamp || entry.timestamp);
      return entryDate.toDateString() === filterDate.toDateString();
    });
  }
  
  // Filter by action if provided
  if (filters && filters.action) {
    filtered = filtered.filter(function(entry) {
      return (entry.Action || entry.action) === filters.action;
    });
  }
  
  // Sort by timestamp descending (newest first)
  filtered.sort(function(a, b) {
    const dateA = new Date(a.Timestamp || a.timestamp || 0);
    const dateB = new Date(b.Timestamp || b.timestamp || 0);
    return dateB - dateA;
  });
  
  // Limit to last 100 entries
  return filtered.slice(0, 100);
}

/**
 * Get database statistics
 * @return {Object} Database statistics
 */
function getDatabaseStats() {
  authorizeRequest('admin:config', 'GET_DB_STATS', 'Database', '');
  
  const stats = {};
  
  // Count records in each sheet
  Object.keys(SHEETS).forEach(function(sheetKey) {
    const sheetName = SHEETS[sheetKey];
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        stats[sheetName] = lastRow > 1 ? lastRow - 1 : 0; // Subtract header row
      }
    } catch (e) {
      stats[sheetName] = 0;
    }
  });
  
  return stats;
}

/**
 * Save API token to script properties
 * @param {string} tokenKey - Token key (e.g., 'MAPBOX_TOKEN')
 * @param {string} token - Token value
 * @return {Object} Result
 */
function saveApiToken(tokenKey, token) {
  authorizeRequest('admin:config', 'SAVE_API_TOKEN', 'Config', '');
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty(tokenKey, token);
  
  // Log audit
  logAudit('UPDATE', 'Config', tokenKey, 'API token updated');
  
  return {
    success: true,
    message: 'Token saved successfully'
  };
}

/**
 * Get deployment status
 * @return {Object} Deployment status
 */
function getDeploymentStatus() {
  authorizeRequest('admin:config', 'GET_DEPLOYMENT_STATUS', 'Config', '');
  
  const props = PropertiesService.getScriptProperties();
  const scriptId = props.getProperty('SCRIPT_ID') || 
    ScriptApp.getScriptId();
  
  // Get file count from Apps Script project
  let fileCount = 0;
  try {
    fileCount = DriveApp.getFileById(scriptId).getParents().next().getFiles().hasNext() ? 
      DriveApp.getFileById(scriptId).getParents().next().getFiles().toArray().length : 0;
  } catch (e) {
    // If can't count, just show N/A
  }
  
  return {
    scriptId: scriptId,
    fileCount: fileCount,
    lastSync: props.getProperty('LAST_SYNC') || 'Unknown',
    environment: props.getProperty('ENVIRONMENT') || 'PRODUCTION'
  };
}

/**
 * Load demo/test data (admin only)
 * @return {Object} Result
 */
function loadDemoData() {
  authorizeRequest('admin:config', 'LOAD_DEMO_DATA', 'Database', '');
  
  try {
    const currentUser = getCurrentUser();
    const branchID = currentUser ? (currentUser.branchID || currentUser.BranchID) : 'BRN-001';
    
    // Seed demo data
    runDemoSeed(branchID);
    
    // Log audit
    logAudit('LOAD_DEMO_DATA', 'Database', '', 'Demo data loaded for branch: ' + branchID);
    
    return {
      success: true,
      message: 'Demo data loaded successfully',
      branchID: branchID
    };
    
  } catch (e) {
    Logger.log('❌ Load demo data failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Get calendar events for prospecting
 * @param {Object} options - Options (startDate, endDate)
 * @return {Array<Object>} Calendar events with locations
 */
function getCalendarEvents(options) {
  authorizeRequest('read:all', 'GET_CALENDAR_EVENTS', 'Calendar', '');
  
  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  const endDate = options.endDate ? new Date(options.endDate) : new Date();
  endDate.setDate(endDate.getDate() + 1); // Include tomorrow
  
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const events = calendar.getEvents(startDate, endDate);
    
    return events.map(function(event) {
      return {
        title: event.getTitle(),
        location: event.getLocation() || '',
        startTime: event.getStartTime(),
        endTime: event.getEndTime(),
        description: event.getDescription() || ''
      };
    }).filter(function(event) {
      return event.location && event.location.trim().length > 0;
    });
  } catch (e) {
    Logger.log('Calendar access error: ' + e.message);
    return [];
  }
}

/**
 * Get AE calendar events for route mapping
 * @param {Object} options - Options (startDate, endDate, aeEmail)
 * @return {Array<Object>} Calendar events with AE information
 */
function getAECalendarEvents(options) {
  authorizeRequest('read:all', 'GET_AE_CALENDAR_EVENTS', 'Calendar', '');
  
  const startDate = options && options.startDate ? new Date(options.startDate) : new Date();
  const endDate = options && options.endDate ? new Date(options.endDate) : new Date();
  endDate.setDate(endDate.getDate() + 1);
  
  const aeEmail = options && options.aeEmail ? options.aeEmail : null;
  
  try {
    // Get all users who are Account Executives
    const users = getSheetData(SHEETS.USERS);
    const aeUsers = users.filter(function(user) {
      const role = String(user.Role || '').toLowerCase();
      const isAE = role.includes('account executive') || role.includes('ae') || role === 'account executive';
      if (!isAE) return false;
      if (aeEmail && user.Email !== aeEmail) return false;
      return true;
    });
    
    // Get tracker entries (appointments/visits) for these AEs
    const trackerData = getSheetData(SHEETS.TRACKER);
    const events = [];
    
    aeUsers.forEach(function(ae) {
      const aeEntries = trackerData.filter(function(entry) {
        const entryDate = entry.Date_Proposal || entry.CreatedOn || entry.UpdatedOn;
        if (!entryDate) return false;
        const eventDate = new Date(entryDate);
        return eventDate >= startDate && eventDate <= endDate && 
               String(entry.AE_UserID) === String(ae.UserID);
      });
      
      aeEntries.forEach(function(entry) {
        if (entry.Service_Address) {
          events.push({
            title: entry.Customer_Name || 'Customer Visit',
            location: entry.Service_Address,
            startTime: entry.Date_Proposal || entry.CreatedOn,
            endTime: entry.UpdatedOn,
            aeEmail: ae.Email,
            aeName: ae.Name,
            aeUserID: ae.UserID,
            entryID: entry.EntryID,
            stage: entry.Stage || '',
            status: entry.Status || ''
          });
        }
      });
    });
    
    // Also try to get Google Calendar events if available
    try {
      const calendar = CalendarApp.getDefaultCalendar();
      const calendarEvents = calendar.getEvents(startDate, endDate);
      
      calendarEvents.forEach(function(event) {
        const location = event.getLocation();
        if (!location) return;
        
        // Try to match calendar event to an AE by parsing description or title
        const title = event.getTitle() || '';
        const description = event.getDescription() || '';
        const combined = (title + ' ' + description).toLowerCase();
        
        aeUsers.forEach(function(ae) {
          const aeNameLower = (ae.Name || '').toLowerCase();
          const aeEmailLower = (ae.Email || '').toLowerCase();
          
          if (combined.includes(aeNameLower) || combined.includes(aeEmailLower)) {
            events.push({
              title: title || 'Calendar Event',
              location: location,
              startTime: event.getStartTime(),
              endTime: event.getEndTime(),
              aeEmail: ae.Email,
              aeName: ae.Name,
              aeUserID: ae.UserID
            });
          }
        });
      });
    } catch (e) {
      Logger.log('Calendar access limited: ' + e.message);
    }
    
    return events;
  } catch (e) {
    Logger.log('Failed to get AE calendar events: ' + e.message);
    return [];
  }
}

/**
 * Update user information (admin only)
 * @param {string} userID - User ID
 * @param {Object} userData - Updated user data
 * @return {Object} Result
 */
function updateUser(userID, userData) {
  authorizeRequest('admin:users', 'UPDATE_USER', 'Users', userID);
  
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Check if email is being changed and if it conflicts with another user
  if (userData.email && userData.email !== user.Email) {
    const existingUsers = getSheetData(SHEETS.USERS, { Email: userData.email });
    if (existingUsers.length > 0 && existingUsers[0].UserID !== userID) {
      throw new Error('User with this email already exists');
    }
  }
  
  // Build update object
  const updates = {
    UpdatedOn: new Date()
  };
  
  if (userData.name) updates.Name = userData.name;
  if (userData.email) updates.Email = userData.email;
  if (userData.role) updates.Role = userData.role;
  if (userData.branchID) updates.BranchID = userData.branchID;
  if (userData.phoneNumber !== undefined) updates.PhoneNumber = userData.phoneNumber;
  if (userData.active !== undefined) updates.Active = userData.active;
  if (userData.territoryZips !== undefined) updates.TerritoryZips = userData.territoryZips;
  if (userData.emailNotifications !== undefined) updates.EmailNotifications = userData.emailNotifications;
  
  // Update user record
  updateRowByID(SHEETS.USERS, 'UserID', userID, updates);
  
  // Log audit
  logAudit('UPDATE', 'Users', userID, 'Updated user information');
  
  return {
    success: true,
    message: 'User updated successfully'
  };
}

/**
 * Create a new territory (admin only)
 * @param {Object} territoryData - Territory data
 * @return {Object} Created territory
 */
function createTerritory(territoryData) {
  authorizeRequest('admin:config', 'CREATE_TERRITORY', 'Territories', '');
  
  // Validate required fields
  if (!territoryData.aeUserID || !territoryData.branchID || !territoryData.zipCodes || territoryData.zipCodes.length === 0) {
    throw new Error('Missing required fields: aeUserID, branchID, zipCodes');
  }
  
  // Validate AE exists
  const ae = findRowByID(SHEETS.USERS, 'UserID', territoryData.aeUserID);
  if (!ae) {
    throw new Error('Account Executive not found');
  }
  
  // Generate territory ID
  const territoryID = generateUniqueID('TER');
  
  // Create territory record
  const territoryRecord = {
    TerritoryID: territoryID,
    AE_UserID: territoryData.aeUserID,
    BranchID: territoryData.branchID,
    ZipCodes: Array.isArray(territoryData.zipCodes) ? territoryData.zipCodes.join('|') : territoryData.zipCodes,
    TerritoryName: territoryData.territoryName || 'Territory ' + territoryID,
    Active: territoryData.active !== false,
    CreatedOn: new Date(),
    UpdatedOn: new Date()
  };
  
  // Insert into Territories sheet
  insertRow(SHEETS.TERRITORIES, territoryRecord);
  
  // Update user's TerritoryZips field
  const userTerritoryZips = (ae.TerritoryZips || '').split('|').filter(function(z) { return z.trim(); });
  territoryData.zipCodes.forEach(function(zip) {
    if (userTerritoryZips.indexOf(zip) === -1) {
      userTerritoryZips.push(zip);
    }
  });
  updateRowByID(SHEETS.USERS, 'UserID', territoryData.aeUserID, {
    TerritoryZips: userTerritoryZips.join('|')
  });
  
  // Log audit
  logAudit('CREATE', 'Territories', territoryID, 'Created territory: ' + territoryRecord.TerritoryName);
  
  return {
    success: true,
    territoryID: territoryID,
    message: 'Territory created successfully'
  };
}

/**
 * Update territory information (admin only)
 * @param {string} territoryID - Territory ID
 * @param {Object} territoryData - Updated territory data
 * @return {Object} Result
 */
function updateTerritory(territoryID, territoryData) {
  authorizeRequest('admin:config', 'UPDATE_TERRITORY', 'Territories', territoryID);
  
  const territory = findRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID);
  if (!territory) {
    throw new Error('Territory not found');
  }
  
  // Build update object
  const updates = {
    UpdatedOn: new Date()
  };
  
  if (territoryData.aeUserID) updates.AE_UserID = territoryData.aeUserID;
  if (territoryData.branchID) updates.BranchID = territoryData.branchID;
  if (territoryData.zipCodes) {
    updates.ZipCodes = Array.isArray(territoryData.zipCodes) ? territoryData.zipCodes.join('|') : territoryData.zipCodes;
  }
  if (territoryData.territoryName) updates.TerritoryName = territoryData.territoryName;
  if (territoryData.active !== undefined) updates.Active = territoryData.active;
  
  // Update territory record
  updateRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID, updates);
  
  // Log audit
  logAudit('UPDATE', 'Territories', territoryID, 'Updated territory information');
  
  return {
    success: true,
    message: 'Territory updated successfully'
  };
}

/**
 * Delete a territory (admin only)
 * @param {string} territoryID - Territory ID
 * @return {Object} Result
 */
function deleteTerritory(territoryID) {
  authorizeRequest('admin:config', 'DELETE_TERRITORY', 'Territories', territoryID);
  
  const territory = findRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID);
  if (!territory) {
    throw new Error('Territory not found');
  }
  
  // Delete territory record
  deleteRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID);
  
  // Log audit
  logAudit('DELETE', 'Territories', territoryID, 'Deleted territory: ' + (territory.TerritoryName || territoryID));
  
  return {
    success: true,
    message: 'Territory deleted successfully'
  };
}

/**
 * Bulk delete territories (admin only)
 * @param {Array<string>} territoryIDs - Array of territory IDs
 * @return {Object} Result
 */
function bulkDeleteTerritories(territoryIDs) {
  authorizeRequest('admin:config', 'BULK_DELETE_TERRITORIES', 'Territories', '');
  
  if (!territoryIDs || !Array.isArray(territoryIDs) || territoryIDs.length === 0) {
    throw new Error('No territories specified for deletion');
  }
  
  let deletedCount = 0;
  const errors = [];
  
  territoryIDs.forEach(function(territoryID) {
    try {
      const territory = findRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID);
      if (territory) {
        deleteRowByID(SHEETS.TERRITORIES, 'TerritoryID', territoryID);
        deletedCount++;
        logAudit('DELETE', 'Territories', territoryID, 'Bulk deleted territory: ' + (territory.TerritoryName || territoryID));
      }
    } catch (e) {
      errors.push(territoryID + ': ' + e.message);
    }
  });
  
  return {
    success: deletedCount > 0,
    deletedCount: deletedCount,
    totalRequested: territoryIDs.length,
    errors: errors,
    message: 'Deleted ' + deletedCount + ' of ' + territoryIDs.length + ' territories'
  };
}

/**
 * Export territories to CSV format
 * @return {string} CSV data
 */
function exportTerritoriesCSV() {
  authorizeRequest('admin:config', 'EXPORT_TERRITORIES', 'Territories', '');
  
  const territories = getSheetData(SHEETS.TERRITORIES);
  const users = getSheetData(SHEETS.USERS);
  
  // Create user map for quick lookup
  const userMap = {};
  users.forEach(function(user) {
    userMap[user.UserID] = user;
  });
  
  // Build CSV
  let csv = 'ZipCode,AE_Email,BranchID,TerritoryName\n';
  
  territories.forEach(function(territory) {
    const ae = userMap[territory.AE_UserID];
    const zipCodes = String(territory.ZipCodes || '').split('|').filter(function(z) { return z.trim(); });
    const aeEmail = ae ? ae.Email : '';
    const branchID = territory.BranchID || '';
    const territoryName = territory.TerritoryName || '';
    
    zipCodes.forEach(function(zipCode) {
      csv += zipCode + ',' + aeEmail + ',' + branchID + ',' + territoryName + '\n';
    });
  });
  
  return csv;
}

