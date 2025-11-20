/**
 * Branch360 - Bi-Directional Sync Triggers
 * Ensures data integrity across Unified_Sales, StartPackets, TrackerData, and Ops_Pipeline
 * A. SOURCE OF TRUTH: Unified_Sales is the master record
 * B. CHILD SHEETS: StartPackets, Ops_Pipeline sync back to master on status changes
 */

/**
 * Install bi-directional sync triggers
 * Called during setup or manually via admin panel
 */
function installSyncTriggers() {
  // Remove existing sync triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    const handlerName = trigger.getHandlerFunction();
    if (handlerName === 'onEditSyncHandler' || handlerName === 'onChangeSyncHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Install new onChange trigger for spreadsheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onEditSyncHandler')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  
  Logger.log('✅ Bi-directional sync triggers installed');
  
  return { success: true, message: 'Sync triggers installed' };
}

/**
 * Main sync handler - triggered on any edit to the spreadsheet
 * Routes to appropriate sync function based on sheet name
 */
function onEditSyncHandler(e) {
  if (!e || !e.range) return;
  
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();
    
    // Skip header row
    if (row === 1) return;
    
    // Route to appropriate sync handler
    switch (sheetName) {
      case SHEETS.START_PACKETS:
        syncStartPacketToUnifiedSales(sheet, row);
        break;
      
      case SHEETS.OPS_PIPELINE:
        syncOpsPipelineToUnifiedSales(sheet, row);
        break;
      
      case SHEETS.TRACKER:
        syncTrackerToUnifiedSales(sheet, row);
        break;
      
      case SHEETS.UNIFIED_SALES:
        // Master sheet changed - propagate to children if needed
        syncUnifiedSalesToChildren(sheet, row);
        break;
    }
    
  } catch (error) {
    Logger.log('⚠️ Sync handler error: ' + error.message);
    // Don't throw - we don't want to block user edits
  }
}

/**
 * Sync StartPacket changes back to Unified_Sales
 * Triggers: Status changes, confirmed dates, specialist assignments
 */
function syncStartPacketToUnifiedSales(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Build row object
  const rowData = {};
  headers.forEach(function(header, index) {
    rowData[header] = data[index];
  });
  
  const packetID = rowData['PacketID'];
  const trackerEntryID = rowData['TrackerEntryID'];
  const status = rowData['Status'];
  const confirmedStartDate = rowData['Confirmed_Start_Date'];
  const installComplete = rowData['Status_Install_Complete'];
  
  if (!packetID) return;
  
  // Log the sync event
  Logger.log('🔄 Syncing StartPacket to Unified Sales: ' + packetID);
  
  // Find corresponding Unified_Sales record via TrackerEntryID or reverse lookup
  const unifiedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.UNIFIED_SALES);
  if (!unifiedSheet) return;
  
  const unifiedHeaders = unifiedSheet.getRange(1, 1, 1, unifiedSheet.getLastColumn()).getValues()[0];
  const unifiedData = unifiedSheet.getRange(2, 1, unifiedSheet.getLastRow() - 1, unifiedSheet.getLastColumn()).getValues();
  
  // Find matching record
  let matchRowIndex = -1;
  for (let i = 0; i < unifiedData.length; i++) {
    const unifiedRow = unifiedData[i];
    const recordID = unifiedRow[unifiedHeaders.indexOf('RecordID')];
    const unifiedAccount = unifiedRow[unifiedHeaders.indexOf('AccountName')];
    const packetAccount = rowData['Account_Name'];
    
    // Match by account name if TrackerEntryID not available
    if (unifiedAccount === packetAccount) {
      matchRowIndex = i + 2; // +2 because arrays are 0-based and we skip header
      break;
    }
  }
  
  if (matchRowIndex === -1) return;
  
  // Update status in Unified_Sales based on StartPacket status
  const statusColumnIndex = unifiedHeaders.indexOf('Status') + 1;
  const updatedOnIndex = unifiedHeaders.indexOf('UpdatedOn') + 1;
  
  if (statusColumnIndex > 0) {
    let newStatus = status || 'New Sale';
    
    // Map StartPacket statuses to Unified_Sales statuses
    if (installComplete === true || installComplete === 'TRUE') {
      newStatus = 'Install Complete';
    } else if (status === 'Submitted' || status === 'In Progress') {
      newStatus = 'In Production';
    }
    
    unifiedSheet.getRange(matchRowIndex, statusColumnIndex).setValue(newStatus);
    
    if (updatedOnIndex > 0) {
      unifiedSheet.getRange(matchRowIndex, updatedOnIndex).setValue(new Date());
    }
    
    Logger.log('✅ Updated Unified_Sales status to: ' + newStatus);
  }
}

/**
 * Sync Ops_Pipeline changes back to Unified_Sales
 * Triggers: Confirmed start dates, materials ordered, install started
 */
function syncOpsPipelineToUnifiedSales(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowData = {};
  headers.forEach(function(header, index) {
    rowData[header] = data[index];
  });
  
  const recordID = rowData['RecordID'];
  const opsStatus = rowData['Status'];
  const confirmedStartDate = rowData['ConfirmedStartDate'];
  const materialsOrdered = rowData['MaterialsOrdered'];
  const installStarted = rowData['InstallStarted'];
  
  if (!recordID) return;
  
  Logger.log('🔄 Syncing Ops_Pipeline to Unified Sales: ' + recordID);
  
  // Update Unified_Sales
  const unifiedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.UNIFIED_SALES);
  if (!unifiedSheet) return;
  
  const unifiedHeaders = unifiedSheet.getRange(1, 1, 1, unifiedSheet.getLastColumn()).getValues()[0];
  const recordIDIndex = unifiedHeaders.indexOf('RecordID');
  const statusIndex = unifiedHeaders.indexOf('Status');
  const updatedOnIndex = unifiedHeaders.indexOf('UpdatedOn');
  
  if (recordIDIndex === -1 || statusIndex === -1) return;
  
  const unifiedData = unifiedSheet.getRange(2, 1, unifiedSheet.getLastRow() - 1, unifiedSheet.getLastColumn()).getValues();
  
  for (let i = 0; i < unifiedData.length; i++) {
    if (unifiedData[i][recordIDIndex] === recordID) {
      const matchRow = i + 2;
      
      // Map Ops status to Unified_Sales status
      let newStatus = opsStatus || 'New Sale';
      if (installStarted === true) {
        newStatus = 'Install In Progress';
      } else if (materialsOrdered === true) {
        newStatus = 'Materials Ordered';
      } else if (confirmedStartDate) {
        newStatus = 'Scheduled';
      }
      
      unifiedSheet.getRange(matchRow, statusIndex + 1).setValue(newStatus);
      if (updatedOnIndex >= 0) {
        unifiedSheet.getRange(matchRow, updatedOnIndex + 1).setValue(new Date());
      }
      
      Logger.log('✅ Updated Unified_Sales from Ops_Pipeline: ' + newStatus);
      break;
    }
  }
}

/**
 * Sync Tracker changes back to Unified_Sales
 * Triggers: Stage changes, status changes
 */
function syncTrackerToUnifiedSales(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowData = {};
  headers.forEach(function(header, index) {
    rowData[header] = data[index];
  });
  
  const entryID = rowData['EntryID'];
  const trackerStage = rowData['Stage'];
  const trackerStatus = rowData['Status'];
  
  if (!entryID) return;
  
  Logger.log('🔄 Syncing Tracker to Unified Sales: ' + entryID);
  
  // Find Unified_Sales records via StartPackets (TrackerEntryID linkage)
  const packetsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.START_PACKETS);
  if (!packetsSheet) return;
  
  const packetHeaders = packetsSheet.getRange(1, 1, 1, packetsSheet.getLastColumn()).getValues()[0];
  const packetData = packetsSheet.getRange(2, 1, packetsSheet.getLastRow() - 1, packetsSheet.getLastColumn()).getValues();
  
  const trackerIDIndex = packetHeaders.indexOf('TrackerEntryID');
  if (trackerIDIndex === -1) return;
  
  // Find packet with this TrackerEntryID
  for (let i = 0; i < packetData.length; i++) {
    if (packetData[i][trackerIDIndex] === entryID) {
      // Found matching packet - now update its status based on tracker
      const accountNameIndex = packetHeaders.indexOf('Account_Name');
      const accountName = packetData[i][accountNameIndex];
      
      // Update Unified_Sales via account name match
      const unifiedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.UNIFIED_SALES);
      const unifiedHeaders = unifiedSheet.getRange(1, 1, 1, unifiedSheet.getLastColumn()).getValues()[0];
      const unifiedData = unifiedSheet.getRange(2, 1, unifiedSheet.getLastRow() - 1, unifiedSheet.getLastColumn()).getValues();
      
      const unifiedAccountIndex = unifiedHeaders.indexOf('AccountName');
      const statusIndex = unifiedHeaders.indexOf('Status');
      const updatedOnIndex = unifiedHeaders.indexOf('UpdatedOn');
      
      for (let j = 0; j < unifiedData.length; j++) {
        if (unifiedData[j][unifiedAccountIndex] === accountName) {
          const matchRow = j + 2;
          
          // Map Tracker stage/status to Unified_Sales
          let newStatus = trackerStatus;
          if (trackerStage === 'Sold') {
            newStatus = 'Sold - Pending Setup';
          } else if (trackerStage === 'Dead') {
            newStatus = 'Dead';
          }
          
          unifiedSheet.getRange(matchRow, statusIndex + 1).setValue(newStatus);
          if (updatedOnIndex >= 0) {
            unifiedSheet.getRange(matchRow, updatedOnIndex + 1).setValue(new Date());
          }
          
          Logger.log('✅ Updated Unified_Sales from Tracker: ' + newStatus);
          break;
        }
      }
      break;
    }
  }
}

/**
 * Sync Unified_Sales changes to child sheets
 * Propagates critical changes downstream
 */
function syncUnifiedSalesToChildren(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowData = {};
  headers.forEach(function(header, index) {
    rowData[header] = data[index];
  });
  
  const recordID = rowData['RecordID'];
  const accountName = rowData['AccountName'];
  const status = rowData['Status'];
  
  if (!recordID && !accountName) return;
  
  Logger.log('🔄 Propagating Unified_Sales changes to children: ' + (recordID || accountName));
  
  // Update StartPackets if exists
  try {
    const packet = findRowByID(SHEETS.START_PACKETS, 'Account_Name', accountName);
    if (packet) {
      // Don't propagate status back if it came from StartPackets (avoid loops)
      // Only update pricing or account details
      updateRowByID(SHEETS.START_PACKETS, 'PacketID', packet.PacketID, {
        'Account_Name': rowData['AccountName'],
        'Service_Address': rowData['Service_Address'],
        'Initial_Job_Price': rowData['InitialPrice'],
        'Maintenance_Price': rowData['MaintenancePrice']
      });
      Logger.log('✅ Propagated pricing updates to StartPacket');
    }
  } catch (e) {
    Logger.log('⚠️ Could not propagate to StartPackets: ' + e.message);
  }
}

/**
 * Lock critical columns in child sheets to prevent data corruption
 * Called during setup
 */
function setupSheetProtections() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Protect pricing columns in StartPackets (sourced from Sales)
    const packetsSheet = ss.getSheetByName(SHEETS.START_PACKETS);
    if (packetsSheet) {
      const headers = packetsSheet.getRange(1, 1, 1, packetsSheet.getLastColumn()).getValues()[0];
      
      // Find columns to protect
      const protectColumns = ['Account_Name', 'Initial_Job_Price', 'Maintenance_Price', 'Sales_Rep'];
      protectColumns.forEach(function(colName) {
        const colIndex = headers.indexOf(colName);
        if (colIndex >= 0) {
          const range = packetsSheet.getRange(2, colIndex + 1, packetsSheet.getMaxRows() - 1, 1);
          const protection = range.protect();
          protection.setDescription('Protected: Sourced from Unified_Sales. Edit in Sales dashboard.');
          
          // Allow admins and the owner to edit
          protection.removeEditors(protection.getEditors());
          if (protection.canDomainEdit()) {
            protection.setDomainEdit(false);
          }
        }
      });
      
      Logger.log('✅ Protected critical columns in StartPackets');
    }
    
    return { success: true, message: 'Sheet protections configured' };
    
  } catch (e) {
    Logger.log('⚠️ Could not set up protections (may require manual setup): ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Manual sync function - force sync all records
 * Useful for one-time data migration or fixing inconsistencies
 */
function forceSyncAllRecords() {
  Logger.log('🔄 Starting full sync of all records...');
  
  const unifiedSales = getSheetData(SHEETS.UNIFIED_SALES);
  const startPackets = getSheetData(SHEETS.START_PACKETS);
  const opsWorkflows = getSheetData(SHEETS.OPS_PIPELINE);
  
  let synced = 0;
  
  // For each Unified_Sales record, check if children are in sync
  unifiedSales.forEach(function(sale) {
    const recordID = sale.RecordID;
    const accountName = sale.AccountName;
    
    // Find corresponding StartPacket
    const packet = startPackets.find(function(p) {
      return p.Account_Name === accountName || p.TrackerEntryID === recordID;
    });
    
    if (packet) {
      // Check if status needs sync
      let unifiedStatus = sale.Status;
      
      if (packet.Status_Install_Complete === true) {
        unifiedStatus = 'Install Complete';
      } else if (packet.Status === 'In Progress') {
        unifiedStatus = 'In Production';
      }
      
      // Update if different
      if (unifiedStatus !== sale.Status) {
        updateRowByID(SHEETS.UNIFIED_SALES, 'RecordID', recordID, {
          Status: unifiedStatus,
          UpdatedOn: new Date()
        });
        synced++;
      }
    }
    
    // Find corresponding Ops workflow
    const workflow = opsWorkflows.find(function(w) { return w.RecordID === recordID; });
    if (workflow) {
      let unifiedStatus = sale.Status;
      
      if (workflow.InstallStarted === true) {
        unifiedStatus = 'Install In Progress';
      } else if (workflow.MaterialsOrdered === true) {
        unifiedStatus = 'Materials Ordered';
      }
      
      if (unifiedStatus !== sale.Status) {
        updateRowByID(SHEETS.UNIFIED_SALES, 'RecordID', recordID, {
          Status: unifiedStatus,
          UpdatedOn: new Date()
        });
        synced++;
      }
    }
  });
  
  Logger.log('✅ Full sync complete. Synced ' + synced + ' records.');
  
  return {
    success: true,
    recordsSynced: synced,
    message: 'Synced ' + synced + ' records'
  };
}

