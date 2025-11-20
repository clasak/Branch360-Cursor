/**
 * Branch360 - Archive System
 * Moves old/closed records to archive spreadsheet for performance
 * C. PERFORMANCE: Keeps active sheets under 50k cells for speed
 */

/**
 * Archive configuration
 */
const ARCHIVE_CONFIG = {
  // Days before archiving
  CLOSED_DEALS_DAYS: 90,    // Archive deals closed > 90 days ago
  DEAD_LEADS_DAYS: 60,       // Archive dead leads > 60 days ago
  COMPLETED_INSTALLS_DAYS: 120, // Archive completed installs > 120 days ago
  RESOLVED_ISSUES_DAYS: 90,  // Archive resolved issues > 90 days ago
  
  // Archive spreadsheet name
  ARCHIVE_SPREADSHEET_NAME: 'Branch360_Archive',
  
  // Archive sheet names (mirror main sheets with '_Archive' suffix)
  ARCHIVE_SHEETS: {
    UNIFIED_SALES: 'Unified_Sales_Archive',
    TRACKER: 'TrackerData_Archive',
    START_PACKETS: 'StartPackets_Archive',
    SERVICE_ISSUES: 'Service_Issues_Archive',
    LEADS: 'Leads_Archive',
    ACTIVITY_LOG: 'ActivityLog_Archive'
  }
};

/**
 * Get or create archive spreadsheet
 * @return {Spreadsheet} Archive spreadsheet
 */
function getOrCreateArchiveSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let archiveSpreadsheetId = props.getProperty('ARCHIVE_SPREADSHEET_ID');
  
  // Try to open existing archive
  if (archiveSpreadsheetId) {
    try {
      const ss = SpreadsheetApp.openById(archiveSpreadsheetId);
      Logger.log('✅ Opened existing archive spreadsheet: ' + ss.getName());
      return ss;
    } catch (e) {
      Logger.log('⚠️ Could not open archive spreadsheet: ' + e.message);
      archiveSpreadsheetId = null;
    }
  }
  
  // Create new archive spreadsheet
  const newSS = SpreadsheetApp.create(ARCHIVE_CONFIG.ARCHIVE_SPREADSHEET_NAME);
  props.setProperty('ARCHIVE_SPREADSHEET_ID', newSS.getId());
  
  // Share with same users as main spreadsheet
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const editors = mainSS.getEditors();
    editors.forEach(function(editor) {
      newSS.addEditor(editor.getEmail());
    });
  } catch (e) {
    Logger.log('⚠️ Could not share archive with editors: ' + e.message);
  }
  
  Logger.log('✅ Created new archive spreadsheet: ' + newSS.getName());
  return newSS;
}

/**
 * Get or create archive sheet within archive spreadsheet
 * @param {Spreadsheet} archiveSS - Archive spreadsheet
 * @param {string} archiveSheetName - Archive sheet name
 * @param {Array} headers - Column headers (from source sheet)
 * @return {Sheet} Archive sheet
 */
function getOrCreateArchiveSheet(archiveSS, archiveSheetName, headers) {
  let sheet = archiveSS.getSheetByName(archiveSheetName);
  
  if (!sheet) {
    // Create new archive sheet
    sheet = archiveSS.insertSheet(archiveSheetName);
    
    // Set headers
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    Logger.log('✅ Created archive sheet: ' + archiveSheetName);
  }
  
  return sheet;
}

/**
 * Archive closed deals from Unified_Sales
 * @return {Object} Archive results
 */
function archiveClosedDeals() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = mainSS.getSheetByName(SHEETS.UNIFIED_SALES);
  
  if (!sourceSheet) {
    return { success: false, message: 'Unified_Sales sheet not found' };
  }
  
  const archiveSS = getOrCreateArchiveSpreadsheet();
  const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  const archiveSheet = getOrCreateArchiveSheet(archiveSS, ARCHIVE_CONFIG.ARCHIVE_SHEETS.UNIFIED_SALES, headers);
  
  const data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
  const statusIndex = headers.indexOf('Status');
  const soldDateIndex = headers.indexOf('SoldDate');
  const updatedOnIndex = headers.indexOf('UpdatedOn');
  
  if (statusIndex === -1) {
    return { success: false, message: 'Status column not found' };
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_CONFIG.CLOSED_DEALS_DAYS);
  
  const rowsToArchive = [];
  const rowsToDelete = [];
  
  // Find rows to archive
  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusIndex]).toLowerCase();
    const soldDate = data[i][soldDateIndex];
    const updatedOn = data[i][updatedOnIndex];
    
    const relevantDate = updatedOn || soldDate;
    
    // Archive if status is "Dead" or "Completed" and older than cutoff
    if ((status === 'dead' || status === 'install complete' || status === 'cancelled') && relevantDate) {
      const recordDate = new Date(relevantDate);
      if (recordDate < cutoffDate) {
        rowsToArchive.push(data[i]);
        rowsToDelete.push(i + 2); // +2 for 0-based array and header row
      }
    }
  }
  
  if (rowsToArchive.length === 0) {
    return { success: true, archivedCount: 0, message: 'No records to archive' };
  }
  
  // Append to archive sheet
  if (rowsToArchive.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
  }
  
  // Delete from source sheet (in reverse order to maintain row indices)
  rowsToDelete.reverse().forEach(function(rowIndex) {
    sourceSheet.deleteRow(rowIndex);
  });
  
  Logger.log('✅ Archived ' + rowsToArchive.length + ' closed deals');
  
  // Invalidate caches
  invalidateCachesForSheet(SHEETS.UNIFIED_SALES);
  
  return {
    success: true,
    archivedCount: rowsToArchive.length,
    message: 'Archived ' + rowsToArchive.length + ' closed deals'
  };
}

/**
 * Archive dead leads
 * @return {Object} Archive results
 */
function archiveDeadLeads() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = mainSS.getSheetByName(SHEETS.LEADS);
  
  if (!sourceSheet) {
    return { success: false, message: 'Leads sheet not found' };
  }
  
  const archiveSS = getOrCreateArchiveSpreadsheet();
  const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  const archiveSheet = getOrCreateArchiveSheet(archiveSS, ARCHIVE_CONFIG.ARCHIVE_SHEETS.LEADS, headers);
  
  const data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
  const statusIndex = headers.indexOf('Status');
  const dateIndex = headers.indexOf('Date');
  
  if (statusIndex === -1) {
    return { success: false, message: 'Status column not found' };
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_CONFIG.DEAD_LEADS_DAYS);
  
  const rowsToArchive = [];
  const rowsToDelete = [];
  
  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusIndex]).toLowerCase();
    const date = data[i][dateIndex];
    
    if ((status === 'dead' || status === 'lost' || status === 'converted') && date) {
      const recordDate = new Date(date);
      if (recordDate < cutoffDate) {
        rowsToArchive.push(data[i]);
        rowsToDelete.push(i + 2);
      }
    }
  }
  
  if (rowsToArchive.length === 0) {
    return { success: true, archivedCount: 0, message: 'No leads to archive' };
  }
  
  if (rowsToArchive.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
  }
  
  rowsToDelete.reverse().forEach(function(rowIndex) {
    sourceSheet.deleteRow(rowIndex);
  });
  
  Logger.log('✅ Archived ' + rowsToArchive.length + ' dead leads');
  
  invalidateCachesForSheet(SHEETS.LEADS);
  
  return {
    success: true,
    archivedCount: rowsToArchive.length,
    message: 'Archived ' + rowsToArchive.length + ' dead leads'
  };
}

/**
 * Archive completed installations
 * @return {Object} Archive results
 */
function archiveCompletedInstalls() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = mainSS.getSheetByName(SHEETS.START_PACKETS);
  
  if (!sourceSheet) {
    return { success: false, message: 'StartPackets sheet not found' };
  }
  
  const archiveSS = getOrCreateArchiveSpreadsheet();
  const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  const archiveSheet = getOrCreateArchiveSheet(archiveSS, ARCHIVE_CONFIG.ARCHIVE_SHEETS.START_PACKETS, headers);
  
  const data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
  const completeIndex = headers.indexOf('Status_Install_Complete');
  const dateIndex = headers.indexOf('Confirmed_Start_Date');
  
  if (completeIndex === -1) {
    return { success: false, message: 'Status_Install_Complete column not found' };
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_CONFIG.COMPLETED_INSTALLS_DAYS);
  
  const rowsToArchive = [];
  const rowsToDelete = [];
  
  for (let i = 0; i < data.length; i++) {
    const isComplete = data[i][completeIndex] === true || data[i][completeIndex] === 'TRUE';
    const date = data[i][dateIndex];
    
    if (isComplete && date) {
      const recordDate = new Date(date);
      if (recordDate < cutoffDate) {
        rowsToArchive.push(data[i]);
        rowsToDelete.push(i + 2);
      }
    }
  }
  
  if (rowsToArchive.length === 0) {
    return { success: true, archivedCount: 0, message: 'No installs to archive' };
  }
  
  if (rowsToArchive.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
  }
  
  rowsToDelete.reverse().forEach(function(rowIndex) {
    sourceSheet.deleteRow(rowIndex);
  });
  
  Logger.log('✅ Archived ' + rowsToArchive.length + ' completed installs');
  
  invalidateCachesForSheet(SHEETS.START_PACKETS);
  
  return {
    success: true,
    archivedCount: rowsToArchive.length,
    message: 'Archived ' + rowsToArchive.length + ' completed installs'
  };
}

/**
 * Archive resolved service issues
 * @return {Object} Archive results
 */
function archiveResolvedIssues() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = mainSS.getSheetByName(SHEETS.SERVICE_ISSUES);
  
  if (!sourceSheet) {
    return { success: false, message: 'Service_Issues sheet not found' };
  }
  
  const archiveSS = getOrCreateArchiveSpreadsheet();
  const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  const archiveSheet = getOrCreateArchiveSheet(archiveSS, ARCHIVE_CONFIG.ARCHIVE_SHEETS.SERVICE_ISSUES, headers);
  
  const data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
  const statusIndex = headers.indexOf('Status');
  const resolvedIndex = headers.indexOf('ResolvedOn');
  
  if (statusIndex === -1) {
    return { success: false, message: 'Status column not found' };
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_CONFIG.RESOLVED_ISSUES_DAYS);
  
  const rowsToArchive = [];
  const rowsToDelete = [];
  
  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusIndex]).toLowerCase();
    const resolvedDate = data[i][resolvedIndex];
    
    if (status === 'resolved' && resolvedDate) {
      const recordDate = new Date(resolvedDate);
      if (recordDate < cutoffDate) {
        rowsToArchive.push(data[i]);
        rowsToDelete.push(i + 2);
      }
    }
  }
  
  if (rowsToArchive.length === 0) {
    return { success: true, archivedCount: 0, message: 'No issues to archive' };
  }
  
  if (rowsToArchive.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length)
      .setValues(rowsToArchive);
  }
  
  rowsToDelete.reverse().forEach(function(rowIndex) {
    sourceSheet.deleteRow(rowIndex);
  });
  
  Logger.log('✅ Archived ' + rowsToArchive.length + ' resolved issues');
  
  invalidateCachesForSheet(SHEETS.SERVICE_ISSUES);
  
  return {
    success: true,
    archivedCount: rowsToArchive.length,
    message: 'Archived ' + rowsToArchive.length + ' resolved issues'
  };
}

/**
 * Run full archive process for all eligible records
 * @return {Object} Combined archive results
 */
function runFullArchive() {
  Logger.log('📦 Starting full archive process...');
  
  const results = {
    closedDeals: archiveClosedDeals(),
    deadLeads: archiveDeadLeads(),
    completedInstalls: archiveCompletedInstalls(),
    resolvedIssues: archiveResolvedIssues()
  };
  
  const totalArchived = 
    results.closedDeals.archivedCount +
    results.deadLeads.archivedCount +
    results.completedInstalls.archivedCount +
    results.resolvedIssues.archivedCount;
  
  Logger.log('✅ Full archive complete. Total archived: ' + totalArchived);
  
  return {
    success: true,
    totalArchived: totalArchived,
    details: results,
    message: 'Archived ' + totalArchived + ' total records'
  };
}

/**
 * Install monthly archive trigger
 * Runs on the 1st of each month at 3 AM
 */
function installArchiveTrigger() {
  // Remove existing archive triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runFullArchive') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Install new monthly trigger
  ScriptApp.newTrigger('runFullArchive')
    .timeBased()
    .onMonthDay(1)
    .atHour(3)
    .create();
  
  Logger.log('✅ Archive trigger installed (runs monthly on 1st at 3 AM)');
  
  return { success: true, message: 'Archive trigger installed' };
}

/**
 * Get archive statistics
 * @return {Object} Archive statistics
 */
function getArchiveStatistics() {
  try {
    const archiveSS = getOrCreateArchiveSpreadsheet();
    const stats = {};
    
    Object.keys(ARCHIVE_CONFIG.ARCHIVE_SHEETS).forEach(function(key) {
      const sheetName = ARCHIVE_CONFIG.ARCHIVE_SHEETS[key];
      const sheet = archiveSS.getSheetByName(sheetName);
      
      if (sheet) {
        stats[key] = {
          sheetName: sheetName,
          recordCount: sheet.getLastRow() - 1, // Exclude header
          lastUpdated: sheet.getLastUpdated()
        };
      } else {
        stats[key] = {
          sheetName: sheetName,
          recordCount: 0,
          lastUpdated: null
        };
      }
    });
    
    return {
      success: true,
      archiveSpreadsheetId: archiveSS.getId(),
      archiveSpreadsheetUrl: archiveSS.getUrl(),
      sheets: stats,
      config: ARCHIVE_CONFIG
    };
    
  } catch (e) {
    Logger.log('❌ Error getting archive stats: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Restore archived records (admin only)
 * @param {string} archiveSheetName - Archive sheet name
 * @param {Array<string>} recordIDs - Array of record IDs to restore
 * @return {Object} Restore results
 */
function restoreArchivedRecords(archiveSheetName, recordIDs) {
  try {
    const archiveSS = getOrCreateArchiveSpreadsheet();
    const archiveSheet = archiveSS.getSheetByName(archiveSheetName);
    
    if (!archiveSheet) {
      return { success: false, message: 'Archive sheet not found' };
    }
    
    // Determine target sheet
    let targetSheetName = null;
    Object.keys(ARCHIVE_CONFIG.ARCHIVE_SHEETS).forEach(function(key) {
      if (ARCHIVE_CONFIG.ARCHIVE_SHEETS[key] === archiveSheetName) {
        targetSheetName = SHEETS[key];
      }
    });
    
    if (!targetSheetName) {
      return { success: false, message: 'Could not determine target sheet' };
    }
    
    const mainSS = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = mainSS.getSheetByName(targetSheetName);
    
    if (!targetSheet) {
      return { success: false, message: 'Target sheet not found: ' + targetSheetName };
    }
    
    const headers = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
    const data = archiveSheet.getRange(2, 1, archiveSheet.getLastRow() - 1, archiveSheet.getLastColumn()).getValues();
    
    // Find RecordID column (varies by sheet)
    const idColumns = ['RecordID', 'EntryID', 'PacketID', 'IssueID', 'LeadID'];
    let idColumnIndex = -1;
    
    for (let i = 0; i < idColumns.length; i++) {
      idColumnIndex = headers.indexOf(idColumns[i]);
      if (idColumnIndex !== -1) break;
    }
    
    if (idColumnIndex === -1) {
      return { success: false, message: 'Could not find ID column in archive' };
    }
    
    const rowsToRestore = [];
    const rowsToDelete = [];
    
    // Find rows to restore
    for (let i = 0; i < data.length; i++) {
      const recordID = data[i][idColumnIndex];
      if (recordIDs.indexOf(recordID) !== -1) {
        rowsToRestore.push(data[i]);
        rowsToDelete.push(i + 2);
      }
    }
    
    if (rowsToRestore.length === 0) {
      return { success: true, restoredCount: 0, message: 'No matching records to restore' };
    }
    
    // Append to target sheet
    targetSheet.getRange(targetSheet.getLastRow() + 1, 1, rowsToRestore.length, rowsToRestore[0].length)
      .setValues(rowsToRestore);
    
    // Delete from archive (in reverse)
    rowsToDelete.reverse().forEach(function(rowIndex) {
      archiveSheet.deleteRow(rowIndex);
    });
    
    Logger.log('✅ Restored ' + rowsToRestore.length + ' records');
    
    invalidateCachesForSheet(targetSheetName);
    
    return {
      success: true,
      restoredCount: rowsToRestore.length,
      message: 'Restored ' + rowsToRestore.length + ' records to ' + targetSheetName
    };
    
  } catch (e) {
    Logger.log('❌ Restore failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

