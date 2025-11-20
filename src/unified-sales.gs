/**
 * Branch360 - Unified Sales & Operations Schema Helpers
 * Provides single source of truth for AE, Ops, and Manager workflows
 */

function saveUnifiedSale(saleData) {
  if (!saleData) throw new Error('Missing sale data payload');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.UNIFIED_SALES);
  if (!sheet) throw new Error('Unified sales sheet missing. Run setup.');

  const recordID = saleData.recordID || generateUniqueID('SALE');
  const currentUser = getCurrentUser();
  const branchID = saleData.branchID || (currentUser ? (currentUser.branchID || currentUser.BranchID) : 'BRN-001');

  const rowPayload = {
    RecordID: recordID,
    BranchID: branchID,
    SoldDate: saleData.soldDate ? new Date(saleData.soldDate) : new Date(),
    AccountName: saleData.accountName || '',
    ServiceAddress: saleData.serviceAddress || '',
    SalesRepIDs: Array.isArray(saleData.salesRepIDs) ? saleData.salesRepIDs.join('|') : (saleData.salesRepIDs || (currentUser ? currentUser.userID : '')),
    POCName: saleData.pocName || '',
    POCPhone: saleData.pocPhone || '',
    RequestedStartMonth: saleData.requestedStartMonth || '',
    PestPacConfirmed: saleData.pestPacConfirmed || false,
    TapLeadFlag: saleData.tapLeadFlag || '',
    InitialPrice: Number(saleData.initialPrice) || 0,
    MaintenancePrice: Number(saleData.maintenancePrice) || 0,
    ServiceType: saleData.serviceType || '',
    LeadType: saleData.leadType || '',
    JobType: saleData.jobType || saleData.contractType || 'Contract',
    Frequency: saleData.frequency || 12,
    ServiceName: saleData.serviceName || '',
    ServiceMonths: Array.isArray(saleData.serviceMonths) ? saleData.serviceMonths.join(',') : '',
    CoveredPests: saleData.coveredPests || '',
    SpecialNotes: saleData.specialNotes || '',
    LogBookNeeded: saleData.logBookNeeded || false,
    PNOLRequired: saleData.pnolRequired || false,
    SRACompletedBy: saleData.sraCompletedBy || '',
    SRADate: saleData.sraDate ? new Date(saleData.sraDate) : '',
    SRATime: saleData.sraTime || '',
    SRAAdditionalHazards: saleData.sraAdditionalHazards || '',
    SRAHazardRef: saleData.sraHazardRef || '',
    Status: saleData.status || 'New Sale',
    UpdatedOn: new Date()
  };

  const existing = findRowByID(SHEETS.UNIFIED_SALES, 'RecordID', recordID);
  if (existing) {
    updateRowByID(SHEETS.UNIFIED_SALES, 'RecordID', recordID, rowPayload);
  } else {
    rowPayload.CreatedOn = new Date();
    insertRow(SHEETS.UNIFIED_SALES, rowPayload);
  }

  if (saleData.serviceMonths) {
    replaceServiceMonths(recordID, saleData.serviceMonths);
  }

  if (saleData.sraHazards) {
    replaceHazards(recordID, saleData.sraHazards);
    rowPayload.SRAHazardRef = 'SRA-' + recordID;
    updateRowByID(SHEETS.UNIFIED_SALES, 'RecordID', recordID, { SRAHazardRef: rowPayload.SRAHazardRef });
  }

  // Send email notification if status is Sold
  if (saleData.status === 'Sold' || saleData.status === 'New Sale') {
    try {
      // Map camelCase payload to PascalCase DB schema for the email function
      const emailData = {
        AccountName: saleData.accountName,
        POCName: saleData.pocName,
        Frequency: saleData.frequency,
        CoveredPests: saleData.coveredPests,
        Maintenance_Scope_Description: saleData.maintenanceScopeDescription,
        SpecialNotes: saleData.specialNotes,
        InitialPrice: saleData.initialPrice,
        MaintenancePrice: saleData.maintenancePrice,
        ServiceAddress: saleData.serviceAddress,
        BillingAddress: saleData.billingAddress,
        BillingEmail: saleData.billingEmail,
        POCPhone: saleData.pocPhone
      };
      
      sendNewStartNotification(emailData);
      logAudit('EMAIL_SENT', 'Notifications', recordID, 'New Start Notification sent to Ops');
    } catch (e) {
      Logger.log('Failed to send email: ' + e.message);
    }
  }

  logServerActivity('AE_CREATE_UNIFIED_SALE', recordID, {
    branch: branchID,
    value: rowPayload.InitialPrice + rowPayload.MaintenancePrice
  });

  return { success: true, recordID: recordID };
}

function replaceServiceMonths(recordID, months) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SERVICE_MONTHS);
  if (!sheet) return;
  purgeChildRows(sheet, 'RecordID', recordID);
  const list = Array.isArray(months) ? months : String(months || '').split(',');
  list.filter(Boolean).forEach(function(month) {
    insertRow(SHEETS.SERVICE_MONTHS, {
      ServiceMonthID: generateUniqueID('SRVMONTH'),
      RecordID: recordID,
      MonthName: month.trim(),
      CreatedOn: new Date()
    });
  });
}

function replaceHazards(recordID, hazards) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SRA_HAZARDS);
  if (!sheet) return;
  purgeChildRows(sheet, 'RecordID', recordID);
  (hazards || []).forEach(function(hazard) {
    insertRow(SHEETS.SRA_HAZARDS, {
      HazardID: generateUniqueID('HZD'),
      RecordID: recordID,
      Hazard: hazard.hazard || '',
      ControlMeasure: hazard.control || '',
      SafeToProceed: hazard.safeToProceed !== false,
      CreatedOn: new Date()
    });
  });
}

function purgeChildRows(sheet, columnName, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndex = headers.indexOf(columnName);
  if (columnIndex === -1) return;
  for (var row = sheet.getLastRow(); row >= 2; row--) {
    const cellValue = sheet.getRange(row, columnIndex + 1).getValue();
    if (String(cellValue) === String(value)) {
      sheet.deleteRow(row);
    }
  }
}

function getUnifiedSales(filters) {
  filters = filters || {};
  const branchId = filters.branchId || null;
  const sales = getSheetData(SHEETS.UNIFIED_SALES);
  const serviceMonths = getSheetData(SHEETS.SERVICE_MONTHS);
  const hazards = getSheetData(SHEETS.SRA_HAZARDS);
  const ops = getSheetData(SHEETS.OPS_PIPELINE);
  return sales
    .filter(function(row) {
      if (branchId && row.BranchID !== branchId) return false;
      if (filters.status && row.Status !== filters.status) return false;
      return true;
    })
    .map(function(row) {
      const recordID = row.RecordID;
      return Object.assign({}, row, {
        serviceMonths: serviceMonths.filter(function(month) { return month.RecordID === recordID; }).map(function(m) { return m.MonthName; }),
        sraHazards: hazards.filter(function(hazard) { return hazard.RecordID === recordID; }),
        opsWorkflow: ops.find(function(wf) { return wf.RecordID === recordID; }) || null
      });
    });
}

function saveOpsWorkflow(updateData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.OPS_PIPELINE);
  if (!sheet) throw new Error('Ops pipeline sheet missing');
  const workflowID = updateData.workflowID || generateUniqueID('OPSWF');
  const payload = {
    WorkflowID: workflowID,
    RecordID: updateData.recordID,
    OperationsManager: updateData.operationsManager || '',
    ConfirmedStartDate: updateData.confirmedStartDate ? new Date(updateData.confirmedStartDate) : '',
    AssignedSpecialist: updateData.assignedSpecialist || '',
    MaterialsOrdered: updateData.materialsOrdered || false,
    InstallStarted: updateData.installStarted || false,
    Status: updateData.status || 'In Queue',
    Notes: updateData.notes || '',
    UpdatedOn: new Date()
  };
  const existing = findRowByID(SHEETS.OPS_PIPELINE, 'RecordID', updateData.recordID);
  if (existing) {
    updateRowByID(SHEETS.OPS_PIPELINE, 'RecordID', updateData.recordID, payload);
  } else {
    insertRow(SHEETS.OPS_PIPELINE, payload);
  }
  logServerActivity('OPS_UPDATE_WORKFLOW', updateData.recordID, payload);
  return { success: true, workflowID: workflowID };
}

function getOpsQueue(filters) {
  filters = filters || {};
  const sales = getUnifiedSales(filters);
  return sales.map(function(sale) {
    const workflow = sale.opsWorkflow || {};
    return {
      recordID: sale.RecordID,
      account: sale.AccountName,
      serviceAddress: sale.ServiceAddress,
      soldDate: sale.SoldDate,
      operationsManager: workflow.OperationsManager || '',
      status: workflow.Status || sale.Status,
      confirmedStartDate: workflow.ConfirmedStartDate,
      materialsOrdered: workflow.MaterialsOrdered,
      installStarted: workflow.InstallStarted
    };
  });
}

function calculateBranchDailyMetrics(date) {
  const targetDate = date ? new Date(date) : new Date();
  const sales = getUnifiedSales({});
  const sameDay = sales.filter(function(sale) {
    const soldDate = sale.SoldDate ? new Date(sale.SoldDate) : null;
    if (!soldDate) return false;
    return soldDate.toDateString() === targetDate.toDateString();
  });
  const totalInitial = sameDay.reduce(function(sum, sale) { return sum + (Number(sale.InitialPrice) || 0); }, 0);
  const totalMonthly = sameDay.reduce(function(sum, sale) { return sum + (Number(sale.MaintenancePrice) || 0); }, 0);
  return {
    date: targetDate.toISOString(),
    salesCount: sameDay.length,
    totalInitial: totalInitial,
    totalMonthly: totalMonthly
  };
}
