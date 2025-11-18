/**
 * Branch360 - Lead Routing System
 * Auto-assigns leads to AEs based on zip code territories
 */

/**
 * [HELPER] Upload territories from CSV data
 * Run this function after pasting your CSV data into the csvData variable
 * 
 * Example usage:
 * 1. Replace the csvData string below with your actual CSV data
 * 2. Run this function from Apps Script Editor
 * 
 * CSV Format: ZipCode,AE_Email,BranchID,TerritoryName
 */
function uploadMyTerritories() {
  const csvData = `ZipCode,AE_Email,BranchID,TerritoryName
77001,john@example.com,BRN-001,Downtown Houston
77002,john@example.com,BRN-001,Downtown Houston
77003,sarah@example.com,BRN-001,East Houston
78701,mike@example.com,BRN-002,Central Austin
78702,mike@example.com,BRN-002,Central Austin`;

  const result = uploadTerritories(csvData);
  Logger.log(result);
  
  // Show result in UI
  SpreadsheetApp.getUi().alert(
    result.success ? '✅ Territories Uploaded' : '❌ Upload Failed',
    result.message + '\n\n' +
    'Zip Codes Processed: ' + (result.zipCodesProcessed || 0) + '\n' +
    'Territories Created: ' + (result.territoriesCreated || 0),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  
  return result;
}

/**
 * Upload territory assignments from CSV
 * CSV Format: ZipCode, AE_Email, BranchID, TerritoryName
 * 
 * @param {Object} params - Parameters object with csvData
 * @return {Object} Upload result
 */
function uploadTerritories(params) {
  try {
    const csvData = params && params.csvData ? params.csvData : '';
    if (!csvData) {
      throw new Error('CSV data is required');
    }
    const lines = csvData.split('\n');
    const territoriesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TERRITORIES);
    const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.USERS);
    
    if (!territoriesSheet || !usersSheet) {
      throw new Error('Required sheets not found');
    }
    
    // Clear existing territories
    if (territoriesSheet.getLastRow() > 1) {
      territoriesSheet.deleteRows(2, territoriesSheet.getLastRow() - 1);
    }
    
    // Group zip codes by AE
    const territoryMap = {};
    var recordCount = 0;
    
    for (var i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length < 2) continue;
      
      const zipCode = parts[0].trim();
      const aeEmail = parts[1].trim();
      const branchID = parts.length > 2 ? parts[2].trim() : '';
      const territoryName = parts.length > 3 ? parts[3].trim() : '';
      
      if (!territoryMap[aeEmail]) {
        territoryMap[aeEmail] = {
          zipCodes: [],
          branchID: branchID,
          territoryName: territoryName
        };
      }
      
      territoryMap[aeEmail].zipCodes.push(zipCode);
      recordCount++;
    }
    
    // Get AE user IDs
    const usersData = getSheetData(SHEETS.USERS);
    const aeMap = {};
    usersData.forEach(function(user) {
      if (user.Email) {
        aeMap[user.Email] = user.UserID;
      }
    });
    
    // Insert territory records
    var territoriesCreated = 0;
    Object.keys(territoryMap).forEach(function(aeEmail) {
      const aeUserID = aeMap[aeEmail];
      if (!aeUserID) {
        Logger.log('⚠ AE not found: ' + aeEmail);
        return;
      }
      
      const territory = territoryMap[aeEmail];
      const territoryID = generateUniqueID('TER');
      
      territoriesSheet.appendRow([
        territoryID,
        aeUserID,
        territory.branchID,
        territory.zipCodes.join('|'), // Store as pipe-delimited
        territory.territoryName || 'Territory ' + (territoriesCreated + 1),
        true,
        new Date(),
        new Date()
      ]);
      
      // Update user's TerritoryZips field
      updateRowByID(SHEETS.USERS, 'UserID', aeUserID, {
        'TerritoryZips': territory.zipCodes.join('|')
      });
      
      territoriesCreated++;
    });
    
    logAudit('UPLOAD_TERRITORIES', SHEETS.TERRITORIES, null, recordCount + ' zip codes, ' + territoriesCreated + ' territories');
    
    return {
      success: true,
      message: 'Territories uploaded successfully',
      zipCodesProcessed: recordCount,
      territoriesCreated: territoriesCreated
    };
    
  } catch (e) {
    Logger.log('❌ Territory upload failed: ' + e.message);
    return {
      success: false,
      message: 'Upload failed: ' + e.message
    };
  }
}

/**
 * Get AE assigned to a zip code
 * @param {string} zipCode - 5-digit zip code
 * @return {Object|null} AE user object
 */
function getAEForZipCode(zipCode) {
  if (!zipCode || zipCode.length !== 5) return null;
  
  const territoriesData = getSheetData(SHEETS.TERRITORIES, { Active: true });
  
  for (var i = 0; i < territoriesData.length; i++) {
    const territory = territoriesData[i];
    const zipCodes = String(territory.ZipCodes || '').split('|');
    
    if (zipCodes.indexOf(zipCode) !== -1) {
      // Found territory, get AE details
      const ae = findRowByID(SHEETS.USERS, 'UserID', territory.AE_UserID);
      if (ae) {
        return {
          userID: ae.UserID,
          name: ae.Name,
          email: ae.Email,
          branchID: ae.BranchID,
          territoryID: territory.TerritoryID,
          territoryName: territory.TerritoryName
        };
      }
    }
  }
  
  return null;
}

/**
 * Technician submits a new lead
 * @param {Object} leadData - Lead information
 * @return {Object} Submission result
 */
function submitLead(leadData) {
  try {
    // Validate required fields
    if (!leadData.customer_name || !leadData.service_address || !leadData.zipCode) {
      throw new Error('Missing required fields');
    }
    
    // Validate zip code
    if (!/^\d{5}$/.test(leadData.zipCode)) {
      throw new Error('Invalid zip code format');
    }
    
    // Get current user (technician)
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Auto-assign to correct AE based on zip code
    const assignedAE = getAEForZipCode(leadData.zipCode);
    
    if (!assignedAE) {
      Logger.log('⚠ No AE found for zip code: ' + leadData.zipCode);
      // Still create lead, but mark as unassigned
    }
    
    // Generate lead ID
    const leadID = generateUniqueID('LEAD');
    
    // Insert lead record
    const leadsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEADS);
    leadsSheet.appendRow([
      leadID,
      new Date(), // Date
      currentUser.userID, // Tech_UserID
      leadData.customer_name,
      leadData.service_address,
      leadData.zipCode,
      leadData.phone || '',
      leadData.email || '',
      leadData.service_type || 'Pest Control',
      leadData.notes || '',
      'New', // Status
      assignedAE ? assignedAE.userID : '', // Assigned_AE_UserID
      assignedAE ? new Date() : null, // AssignedOn
      null, // LastContactDate
      null, // ConvertedToTrackerID
      new Date(), // CreatedOn
      new Date() // UpdatedOn
    ]);
    
    // Send notification to AE
    if (assignedAE) {
      notifyAEOfNewLead(assignedAE, leadData, leadID);
    } else {
      // Notify branch manager of unassigned lead
      notifyBranchManagerOfUnassignedLead(currentUser.branchID, leadData, leadID);
    }
    
    // Log action
    logAudit('SUBMIT_LEAD', SHEETS.LEADS, leadID, 'Tech: ' + currentUser.name + ', Assigned to: ' + (assignedAE ? assignedAE.name : 'UNASSIGNED'));
    
    return {
      success: true,
      leadID: leadID,
      assignedTo: assignedAE ? assignedAE.name : 'Unassigned',
      assignedAE: assignedAE,
      message: 'Lead submitted successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Lead submission failed: ' + e.message);
    return {
      success: false,
      message: 'Submission failed: ' + e.message
    };
  }
}

/**
 * Send real-time notification to AE
 * @param {Object} ae - AE user object
 * @param {Object} leadData - Lead data
 * @param {string} leadID - Lead ID
 */
function notifyAEOfNewLead(ae, leadData, leadID) {
  try {
    const notificationsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.NOTIFICATIONS);
    const notificationID = generateUniqueID('NOT');
    
    notificationsSheet.appendRow([
      notificationID,
      ae.userID,
      'new_lead',
      '🎯 New Lead Assigned',
      'New lead from ' + leadData.customer_name + ' in ' + leadData.zipCode,
      JSON.stringify({
        leadID: leadID,
        customer: leadData.customer_name,
        address: leadData.service_address,
        phone: leadData.phone,
        zipCode: leadData.zipCode
      }),
      false, // Read
      '/leads/' + leadID, // ActionURL
      new Date()
    ]);
    
    // Send email if enabled (check full user record for EmailNotifications setting)
    const fullAE = findRowByID(SHEETS.USERS, 'UserID', ae.userID);
    if (fullAE && fullAE.EmailNotifications !== false) {
      sendLeadAlertEmail(ae.email, leadData, leadID);
    }
    
  } catch (e) {
    Logger.log('⚠ Notification failed: ' + e.message);
  }
}

/**
 * Notify branch manager of unassigned lead
 * @param {string} branchID - Branch ID
 * @param {Object} leadData - Lead data
 * @param {string} leadID - Lead ID
 */
function notifyBranchManagerOfUnassignedLead(branchID, leadData, leadID) {
  try {
    const branch = findRowByID(SHEETS.BRANCHES, 'BranchID', branchID);
    if (!branch || !branch.ManagerUserID) return;
    
    const manager = findRowByID(SHEETS.USERS, 'UserID', branch.ManagerUserID);
    if (!manager) return;
    
    const notificationsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.NOTIFICATIONS);
    const notificationID = generateUniqueID('NOT');
    
    notificationsSheet.appendRow([
      notificationID,
      manager.UserID,
      'unassigned_lead',
      '⚠️ Unassigned Lead',
      'Lead from ' + leadData.customer_name + ' in ' + leadData.zipCode + ' needs manual assignment',
      JSON.stringify({
        leadID: leadID,
        customer: leadData.customer_name,
        zipCode: leadData.zipCode
      }),
      false,
      '/leads/' + leadID,
      new Date()
    ]);
    
  } catch (e) {
    Logger.log('⚠ Branch manager notification failed: ' + e.message);
  }
}

/**
 * Send lead alert email
 * @param {string} email - Recipient email
 * @param {Object} leadData - Lead data
 * @param {string} leadID - Lead ID
 */
function sendLeadAlertEmail(email, leadData, leadID) {
  try {
    const subject = '🎯 New Lead Assigned: ' + leadData.customer_name;
    
    const htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px;">' +
      '<h2 style="color: #2563EB;">New Lead Assigned to You</h2>' +
      '<div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">' +
      '<p><strong>Customer:</strong> ' + leadData.customer_name + '</p>' +
      '<p><strong>Address:</strong> ' + leadData.service_address + '</p>' +
      '<p><strong>Zip Code:</strong> ' + leadData.zipCode + '</p>' +
      '<p><strong>Phone:</strong> <a href="tel:' + leadData.phone + '">' + leadData.phone + '</a></p>' +
      (leadData.email ? '<p><strong>Email:</strong> <a href="mailto:' + leadData.email + '">' + leadData.email + '</a></p>' : '') +
      '<p><strong>Service Type:</strong> ' + (leadData.service_type || 'Pest Control') + '</p>' +
      (leadData.notes ? '<p><strong>Notes:</strong> ' + leadData.notes + '</p>' : '') +
      '</div>' +
      '<p>Log in to Branch360 to view and manage this lead.</p>' +
      '<p style="font-size: 12px; color: #6B7280;">Lead ID: ' + leadID + '</p>' +
      '</div>';
    
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (e) {
    Logger.log('⚠ Email send failed: ' + e.message);
  }
}

/**
 * Get leads for current AE
 * @param {string} userID - AE User ID (optional, uses current user if not provided)
 * @param {string} status - Filter by status (optional)
 * @return {Array<Object>} Array of leads
 */
function getMyLeads(userID, status) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) return [];
  
  const filters = { Assigned_AE_UserID: currentUser.userID || currentUser.UserID };
  if (status) {
    filters.Status = status;
  }
  
  var leads = getSheetData(SHEETS.LEADS, filters);
  
  // Sort by date (newest first)
  leads.sort(function(a, b) {
    return new Date(b.Date) - new Date(a.Date);
  });
  
  return leads.map(function(lead) {
    return {
      leadID: lead.LeadID,
      date: lead.Date,
      customer_name: lead.Customer_Name,
      service_address: lead.Service_Address,
      zipCode: lead.ZipCode,
      phone: lead.Phone,
      email: lead.Email,
      service_type: lead.Service_Type,
      notes: lead.Notes,
      status: lead.Status,
      lastContactDate: lead.LastContactDate,
      submittedBy: getTechName(lead.Tech_UserID)
    };
  });
}

/**
 * Helper: Get technician name
 */
function getTechName(techUserID) {
  const tech = findRowByID(SHEETS.USERS, 'UserID', techUserID);
  return tech ? tech.Name : 'Unknown';
}

/**
 * Mark lead as contacted
 * @param {string} leadID - Lead ID
 * @return {boolean} Success
 */
function markLeadContacted(leadID) {
  const success = updateRowByID(SHEETS.LEADS, 'LeadID', leadID, {
    'Status': 'Contacted',
    'LastContactDate': new Date()
  });
  
  if (success) {
    logAudit('CONTACT_LEAD', SHEETS.LEADS, leadID, 'Lead marked as contacted');
  }
  
  return success;
}

/**
 * Convert lead to opportunity (TrackerData entry)
 * @param {string} leadID - Lead ID
 * @return {Object} Result with tracker entry ID
 */
function convertLeadToOpportunity(leadID) {
  try {
    const lead = findRowByID(SHEETS.LEADS, 'LeadID', leadID);
    if (!lead) throw new Error('Lead not found');
    
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    // Create tracker entry
    const entryID = generateUniqueID('TRK');
    const trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TRACKER);
    
    trackerSheet.appendRow([
      entryID,
      new Date(), // Date
      currentUser.userID, // AE_UserID
      currentUser.branchID, // BranchID
      'Proposal', // Stage
      lead.Customer_Name,
      lead.Service_Address,
      lead.ZipCode,
      lead.Customer_Name, // POC_Name (default to customer name)
      lead.Phone,
      lead.Email,
      'Field Lead', // Source
      'New Business', // Sale_Type
      lead.Service_Type || 'Pest Control', // Service_Description
      0, // Initial_Fee
      0, // Monthly_Fee
      12, // Frequency
      0, // Annual_Value
      '', // PestPac_ID
      new Date(), // Date_Proposal
      null, // Date_Sold
      null, // Date_Dead
      'Active', // Status
      'Converted from lead. ' + (lead.Notes || ''), // Notes
      new Date(), // CreatedOn
      new Date() // UpdatedOn
    ]);
    
    // Update lead status
    updateRowByID(SHEETS.LEADS, 'LeadID', leadID, {
      'Status': 'Converted',
      'ConvertedToTrackerID': entryID
    });
    
    logAudit('CONVERT_LEAD', SHEETS.TRACKER, entryID, 'Converted from lead: ' + leadID);
    
    return {
      success: true,
      entryID: entryID,
      message: 'Lead converted to opportunity'
    };
    
  } catch (e) {
    Logger.log('❌ Lead conversion failed: ' + e.message);
    return {
      success: false,
      message: 'Conversion failed: ' + e.message
    };
  }
}

/**
 * Get unread notifications for user
 * @param {string} userID - User ID (optional, uses current user if not provided)
 * @return {Array<Object>} Unread notifications
 */
function getUnreadNotifications(userID) {
  const currentUser = userID ? { userID: userID } : getCurrentUser();
  if (!currentUser) return [];
  
  const notifications = getSheetData(SHEETS.NOTIFICATIONS, {
    UserID: currentUser.userID,
    Read: false
  });
  
  // Sort by date (newest first)
  notifications.sort(function(a, b) {
    return new Date(b.CreatedOn) - new Date(a.CreatedOn);
  });
  
  return notifications;
}

/**
 * Mark notification as read
 * @param {string} notificationID - Notification ID
 * @return {boolean} Success
 */
function markNotificationRead(notificationID) {
  return updateRowByID(SHEETS.NOTIFICATIONS, 'NotificationID', notificationID, {
    'Read': true
  });
}

/**
 * Get all territories with stats
 * @param {Object} params - Parameters object with optional branchId
 * @return {Object} Territories with stats
 */
function getAllTerritories(params) {
  try {
    // Handle empty or null params
    if (!params) params = {};
    const branchId = params.branchId || null;
    
    // Get territories sheet - handle if it doesn't exist
    let territories = [];
    try {
      territories = getSheetData(SHEETS.TERRITORIES) || [];
    } catch (e) {
      Logger.log('⚠ Territories sheet not found or empty: ' + e.message);
      territories = [];
    }
    
    territories = territories.filter(function(territory) {
      if (branchId && territory.BranchID !== branchId) return false;
      return territory.Active !== false;
    });
    
    // Get users
    let users = [];
    try {
      users = getSheetData(SHEETS.USERS) || [];
    } catch (e) {
      Logger.log('⚠ Users sheet not found: ' + e.message);
      users = [];
    }
    
    const userMap = {};
    users.forEach(function(user) {
      if (user.UserID) {
        userMap[user.UserID] = user;
      }
    });
    
    // Get leads
    let leads = [];
    try {
      leads = getSheetData(SHEETS.LEADS) || [];
    } catch (e) {
      Logger.log('⚠ Leads sheet not found: ' + e.message);
      leads = [];
    }
    
    const territoryList = territories.map(function(territory) {
      const ae = userMap[territory.AE_UserID] || {};
      const zipList = String(territory.ZipCodes || '').split('|').filter(Boolean);
      const territoryProspects = leads.filter(function(lead) {
        return zipList.indexOf(lead.ZipCode) !== -1;
      });
      
      return {
        territoryID: territory.TerritoryID,
        territoryName: territory.TerritoryName,
        aeUserID: territory.AE_UserID,
        aeName: ae.Name || 'Unassigned',
        aeEmail: ae.Email || '',
        branchID: territory.BranchID || '',
        zipCodes: zipList,
        zipCount: zipList.length,
        prospectCount: territoryProspects.length,
        active: territory.Active !== false
      };
    });
    
    // Calculate stats
    const totalAEs = new Set(territoryList.map(t => t.aeEmail).filter(Boolean)).size;
    const totalZips = territoryList.reduce((sum, t) => sum + t.zipCount, 0);
    const avgCoverage = totalAEs > 0 ? (totalZips / totalAEs).toFixed(2) : 0;
    
    return {
      success: true,
      territories: territoryList,
      stats: {
        totalAEs: totalAEs,
        totalZipCodes: totalZips,
        averageCoverage: parseFloat(avgCoverage),
        totalTerritories: territoryList.length
      }
    };
    
  } catch (e) {
    Logger.log('❌ Get territories failed: ' + e.message);
    return {
      success: false,
      message: 'Failed to load territories: ' + e.message,
      territories: [],
      stats: { totalAEs: 0, totalZipCodes: 0, averageCoverage: 0, totalTerritories: 0 }
    };
  }
}

/**
 * Add or update a single zip code assignment
 * @param {Object} params - Parameters object with zipCode, aeEmail, branchID, territoryName
 * @return {Object} Result
 */
function addTerritoryZip(params) {
  try {
    const zipCode = params && params.zipCode ? params.zipCode : null;
    const aeEmail = params && params.aeEmail ? params.aeEmail : null;
    const branchID = params && params.branchID ? params.branchID : null;
    const territoryName = params && params.territoryName ? params.territoryName : null;
    
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      throw new Error('Zip code must be 5 digits');
    }
    
    if (!aeEmail || !aeEmail.includes('@')) {
      throw new Error('Valid AE email is required');
    }
    
    // Find AE user
    const users = getSheetData(SHEETS.USERS);
    const ae = users.find(function(u) {
      return u.Email && u.Email.toLowerCase() === aeEmail.toLowerCase();
    });
    
    if (!ae) {
      throw new Error('AE not found: ' + aeEmail);
    }
    
    // Check if territory exists for this AE
    const territories = getSheetData(SHEETS.TERRITORIES);
    let territory = territories.find(function(t) {
      return t.AE_UserID === ae.UserID && 
             t.TerritoryName === territoryName &&
             t.BranchID === branchID;
    });
    
    const zipList = String(territory ? territory.ZipCodes : '').split('|').filter(Boolean);
    
    // Check if zip already assigned to another territory
    const existingTerritory = territories.find(function(t) {
      const zips = String(t.ZipCodes || '').split('|').filter(Boolean);
      return zips.indexOf(zipCode) !== -1 && t.TerritoryID !== (territory ? territory.TerritoryID : null);
    });
    
    if (existingTerritory) {
      throw new Error('Zip code ' + zipCode + ' is already assigned to ' + existingTerritory.TerritoryName);
    }
    
    // Add zip if not already in list
    if (zipList.indexOf(zipCode) === -1) {
      zipList.push(zipCode);
    }
    
    // Create or update territory
    if (!territory) {
      const territoryID = generateUniqueID('TER');
      const territoriesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TERRITORIES);
      territoriesSheet.appendRow([
        territoryID,
        ae.UserID,
        branchID,
        zipList.join('|'),
        territoryName,
        true,
        new Date(),
        new Date()
      ]);
      
      logAudit('CREATE_TERRITORY', SHEETS.TERRITORIES, territoryID, 'Created territory: ' + territoryName);
    } else {
      updateRowByID(SHEETS.TERRITORIES, 'TerritoryID', territory.TerritoryID, {
        'ZipCodes': zipList.join('|'),
        'UpdatedOn': new Date()
      });
      
      logAudit('UPDATE_TERRITORY', SHEETS.TERRITORIES, territory.TerritoryID, 'Added zip: ' + zipCode);
    }
    
    // Update user's TerritoryZips
    updateRowByID(SHEETS.USERS, 'UserID', ae.UserID, {
      'TerritoryZips': zipList.join('|')
    });
    
    return {
      success: true,
      message: 'Zip code ' + zipCode + ' assigned successfully',
      territoryID: territory ? territory.TerritoryID : null
    };
    
  } catch (e) {
    Logger.log('❌ Add territory zip failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Remove a zip code from a territory
 * @param {Object} params - Parameters object with zipCode
 * @return {Object} Result
 */
function removeTerritoryZip(params) {
  try {
    const zipCode = params && params.zipCode ? params.zipCode : null;
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      throw new Error('Zip code must be 5 digits');
    }
    
    const territories = getSheetData(SHEETS.TERRITORIES);
    const territory = territories.find(function(t) {
      const zips = String(t.ZipCodes || '').split('|').filter(Boolean);
      return zips.indexOf(zipCode) !== -1;
    });
    
    if (!territory) {
      throw new Error('Zip code ' + zipCode + ' not found in any territory');
    }
    
    const zipList = String(territory.ZipCodes || '').split('|').filter(Boolean);
    const index = zipList.indexOf(zipCode);
    if (index !== -1) {
      zipList.splice(index, 1);
    }
    
    // Update territory
    updateRowByID(SHEETS.TERRITORIES, 'TerritoryID', territory.TerritoryID, {
      'ZipCodes': zipList.join('|'),
      'UpdatedOn': new Date()
    });
    
    // Update AE's TerritoryZips
    const ae = findRowByID(SHEETS.USERS, 'UserID', territory.AE_UserID);
    if (ae) {
      updateRowByID(SHEETS.USERS, 'UserID', territory.AE_UserID, {
        'TerritoryZips': zipList.join('|')
      });
    }
    
    logAudit('REMOVE_TERRITORY_ZIP', SHEETS.TERRITORIES, territory.TerritoryID, 'Removed zip: ' + zipCode);
    
    return {
      success: true,
      message: 'Zip code ' + zipCode + ' removed successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Remove territory zip failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Search for a zip code assignment
 * @param {Object} params - Parameters object with zipCode
 * @return {Object} Territory assignment or null
 */
function searchTerritoryZip(params) {
  try {
    const zipCode = params && params.zipCode ? params.zipCode : null;
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return {
        success: false,
        message: 'Zip code must be 5 digits'
      };
    }
    
    const territories = getSheetData(SHEETS.TERRITORIES);
    const territory = territories.find(function(t) {
      const zips = String(t.ZipCodes || '').split('|').filter(Boolean);
      return zips.indexOf(zipCode) !== -1;
    });
    
    if (!territory) {
      return {
        success: false,
        message: 'Zip code not assigned'
      };
    }
    
    const ae = findRowByID(SHEETS.USERS, 'UserID', territory.AE_UserID);
    
    return {
      success: true,
      record: {
        zipCode: zipCode,
        territoryID: territory.TerritoryID,
        territoryName: territory.TerritoryName,
        aeUserID: territory.AE_UserID,
        aeName: ae ? ae.Name : 'Unknown',
        aeEmail: ae ? ae.Email : '',
        branchID: territory.BranchID || ''
      }
    };
    
  } catch (e) {
    Logger.log('❌ Search territory zip failed: ' + e.message);
    return {
      success: false,
      message: 'Search failed: ' + e.message
    };
  }
}

/**
 * Export territories to CSV
 * @return {string} CSV content
 */
function exportTerritoriesCSV() {
  try {
    const territories = getSheetData(SHEETS.TERRITORIES);
    const users = getSheetData(SHEETS.USERS);
    const userMap = {};
    users.forEach(function(user) {
      userMap[user.UserID] = user;
    });
    
    const csvLines = ['ZipCode,AE_Email,BranchID,TerritoryName'];
    
    territories.forEach(function(territory) {
      const ae = userMap[territory.AE_UserID] || {};
      const zipList = String(territory.ZipCodes || '').split('|').filter(Boolean);
      
      zipList.forEach(function(zip) {
        const sanitizedName = (territory.TerritoryName || '').replace(/"/g, "''");
        csvLines.push(zip + ',' + (ae.Email || '') + ',' + (territory.BranchID || '') + ',"' + sanitizedName + '"');
      });
    });
    
    return csvLines.join('\n');
    
  } catch (e) {
    Logger.log('❌ Export territories failed: ' + e.message);
    throw new Error('Export failed: ' + e.message);
  }
}

