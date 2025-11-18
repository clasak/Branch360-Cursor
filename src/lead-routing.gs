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
 * @param {string} csvData - CSV content
 * @return {Object} Upload result
 */
function uploadTerritories(csvData) {
  try {
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

