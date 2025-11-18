/**
 * Branch360 - Operations Module
 * Technician workflows and operations manager tools
 */

/**
 * Get Technician Dashboard
 * @param {string} userID - Tech User ID (optional)
 * @return {Object} Dashboard data
 */
function getTechnicianDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  return {
    user: {
      name: currentUser.Name || currentUser.name,
      email: currentUser.Email || currentUser.email,
      branchID: currentUser.BranchID || currentUser.branchID
    },
    todayRoute: getTodayRoute(currentUser.UserID || currentUser.userID),
    pendingInstalls: getPendingInstallsForTech(currentUser.UserID || currentUser.userID),
    leadsSubmitted: getLeadsSubmittedByTech(currentUser.UserID || currentUser.userID),
    recentIssues: getRecentIssuesForTech(currentUser.UserID || currentUser.userID)
  };
}

/**
 * Get today's route for technician
 * PLACEHOLDER - will integrate with Route1 when API available
 */
function getTodayRoute(techUserID) {
  // TODO: Integrate with Route1 API
  Logger.log('[PLACEHOLDER] Route1 integration pending');
  
  // Return mock structure for now
  return {
    route_id: 'ROUTE-' + new Date().getTime(),
    date: new Date(),
    stops: [],
    total_stops: 0,
    completed_stops: 0,
    status: 'Route1 integration pending'
  };
}

/**
 * Get pending installations assigned to technician
 */
function getPendingInstallsForTech(techUserID) {
  const packets = getSheetData(SHEETS.START_PACKETS);
  
  return packets
    .filter(function(packet) {
      return packet.Assigned_Specialist === techUserID && 
             !packet.Status_Install_Complete;
    })
    .map(function(packet) {
      return {
        packetID: packet.PacketID,
        accountName: packet.Account_Name,
        serviceAddress: packet.Service_Address,
        scheduledDate: packet.Date_Install_Scheduled,
        serviceType: packet.Service_Type,
        pocInfo: packet.POC_Name_Phone,
        notes: packet.Special_Notes,
        materialsOrdered: packet.Materials_Ordered
      };
    });
}

/**
 * Get leads submitted by technician
 */
function getLeadsSubmittedByTech(techUserID) {
  const leads = getSheetData(SHEETS.LEADS, { Tech_UserID: techUserID });
  
  // Sort by date (newest first)
  leads.sort(function(a, b) {
    return new Date(b.Date) - new Date(a.Date);
  });
  
  return leads.slice(0, 10).map(function(lead) {
    return {
      leadID: lead.LeadID,
      date: lead.Date,
      customer: lead.Customer_Name,
      status: lead.Status,
      assignedAE: getAEName(lead.Assigned_AE_UserID)
    };
  });
}

/**
 * Helper: Get AE name
 */
function getAEName(aeUserID) {
  if (!aeUserID) return 'Unassigned';
  const ae = findRowByID(SHEETS.USERS, 'UserID', aeUserID);
  return ae ? ae.Name : 'Unknown';
}

/**
 * Get recent service issues reported by tech
 */
function getRecentIssuesForTech(techUserID) {
  const issues = getSheetData(SHEETS.SERVICE_ISSUES);
  
  const techIssues = issues.filter(function(issue) {
    return issue.ReportedBy_UserID === techUserID || 
           issue.Assigned_Tech_UserID === techUserID;
  });
  
  techIssues.sort(function(a, b) {
    return new Date(b.CreatedOn) - new Date(a.CreatedOn);
  });
  
  return techIssues.slice(0, 5).map(function(issue) {
    return {
      issueID: issue.IssueID,
      date: issue.Date,
      customer: issue.Customer_Name,
      issueType: issue.Issue_Type,
      severity: issue.Severity,
      status: issue.Status,
      description: issue.Description
    };
  });
}

/**
 * Report a service issue
 */
function reportServiceIssue(issueData) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    const issueID = generateUniqueID('ISS');
    const issuesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SERVICE_ISSUES);
    
    issuesSheet.appendRow([
      issueID,
      new Date(),
      issueData.customerName,
      issueData.trackerEntryID || '',
      issueData.accountID || '',
      issueData.issueType,
      issueData.severity || 'Medium',
      issueData.description,
      issueData.assignedTechUserID || currentUser.userID,
      'Open',
      '',
      currentUser.userID,
      new Date(),
      null
    ]);
    
    // Notify operations manager
    notifyOpsManagerOfIssue(currentUser.branchID, issueID, issueData);
    
    logAudit('REPORT_ISSUE', SHEETS.SERVICE_ISSUES, issueID, 
      'Tech: ' + currentUser.name + ', Type: ' + issueData.issueType);
    
    return { success: true, issueID: issueID };
    
  } catch (e) {
    Logger.log('❌ Report issue failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Notify operations manager of new issue
 */
function notifyOpsManagerOfIssue(branchID, issueID, issueData) {
  try {
    // Find ops managers for this branch
    const users = getSheetData(SHEETS.USERS);
    const opsManagers = users.filter(function(user) {
      return user.BranchID === branchID && 
             (user.Role === 'Operations Manager' || user.Role === 'Ops Manager');
    });
    
    opsManagers.forEach(function(manager) {
      const notificationsSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEETS.NOTIFICATIONS);
      const notificationID = generateUniqueID('NOT');
      
      notificationsSheet.appendRow([
        notificationID,
        manager.UserID,
        'service_issue',
        '⚠️ New Service Issue',
        issueData.severity + ' priority issue reported: ' + issueData.issueType,
        JSON.stringify({
          issueID: issueID,
          customer: issueData.customerName,
          type: issueData.issueType,
          severity: issueData.severity
        }),
        false,
        '/issues/' + issueID,
        new Date()
      ]);
    });
    
  } catch (e) {
    Logger.log('⚠ Ops manager notification failed: ' + e.message);
  }
}

/**
 * Complete installation
 */
function completeInstallation(packetID, completionData) {
  try {
    const updates = {
      'Status_Install_Complete': true,
      'Confirmed_Start_Date': completionData.completionDate || new Date()
    };
    
    if (completionData.notes) {
      const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
      updates['Special_Notes'] = (packet.Special_Notes || '') + '\n' + 
        new Date().toLocaleDateString() + ': ' + completionData.notes;
    }
    
    const success = updateRowByID(SHEETS.START_PACKETS, 'PacketID', packetID, updates);
    
    if (success) {
      logAudit('COMPLETE_INSTALL', SHEETS.START_PACKETS, packetID, 
        'Installation completed');
      logServerActivity('TECH_COMPLETE_INSTALL', packetID, { completionNotes: completionData.notes || '' });
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Complete installation failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Get Operations Manager Dashboard
 */
function getOpsManagerDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  return {
    user: {
      name: currentUser.Name || currentUser.name,
      email: currentUser.Email || currentUser.email,
      branchID: currentUser.BranchID || currentUser.branchID
    },
    todayMetrics: getOpsMetricsToday(currentUser.BranchID || currentUser.branchID),
    teamTechnicians: getTeamTechnicians(currentUser.BranchID || currentUser.branchID),
    pendingInstalls: getPendingInstallsForBranch(currentUser.BranchID || currentUser.branchID),
    openIssues: getOpenIssuesForBranch(currentUser.BranchID || currentUser.branchID),
    weeklyMetrics: getWeeklyOpsMetrics(currentUser.BranchID || currentUser.branchID)
  };
}

/**
 * Get today's operations metrics for branch
 */
function getOpsMetricsToday(branchID) {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  const metricsData = getSheetData(SHEETS.OPERATIONS_METRICS);
  const todayMetrics = metricsData.filter(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.BranchID === branchID;
  });
  
  if (todayMetrics.length === 0) {
    return {
      missedStopsTMX: 0,
      missedStopsRNA: 0,
      backlogPercent: 0,
      otPercent: 0,
      hasEntry: false
    };
  }
  
  // Aggregate if multiple entries
  var totalTMX = 0;
  var totalRNA = 0;
  var avgBacklog = 0;
  var avgOT = 0;
  
  todayMetrics.forEach(function(metric) {
    totalTMX += Number(metric.MissedStops_TMX) || 0;
    totalRNA += Number(metric.MissedStops_RNA) || 0;
    avgBacklog += Number(metric.Backlog_Percent) || 0;
    avgOT += Number(metric.OT_Percent) || 0;
  });
  
  const count = todayMetrics.length;
  
  return {
    missedStopsTMX: totalTMX,
    missedStopsRNA: totalRNA,
    backlogPercent: (avgBacklog / count).toFixed(1),
    otPercent: (avgOT / count).toFixed(1),
    hasEntry: true
  };
}

/**
 * Get team technicians
 */
function getTeamTechnicians(branchID) {
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  
  return users
    .filter(function(user) {
      const role = String(user.Role || '').toLowerCase();
      return role.includes('tech') || role.includes('specialist');
    })
    .map(function(user) {
      return {
        userID: user.UserID,
        name: user.Name,
        email: user.Email,
        active: user.Active
      };
    });
}

/**
 * Get pending installations for branch
 */
function getPendingInstallsForBranch(branchID) {
  // Get tracker entries that are sold but not yet installed
  const trackerData = getSheetData(SHEETS.TRACKER);
  const packets = getSheetData(SHEETS.START_PACKETS);
  
  // Create a map of completed packets
  const completedPackets = {};
  packets.forEach(function(packet) {
    if (packet.Status_Install_Complete) {
      completedPackets[packet.TrackerEntryID] = true;
    }
  });
  
  const pending = trackerData.filter(function(entry) {
    return entry.BranchID === branchID && 
           entry.Stage === 'Sold' && 
           !completedPackets[entry.EntryID];
  });
  
  return pending.map(function(entry) {
    const packet = packets.find(function(p) {
      return p.TrackerEntryID === entry.EntryID;
    });
    
    return {
      entryID: entry.EntryID,
      packetID: packet ? packet.PacketID : null,
      customer: entry.Customer_Name,
      address: entry.Service_Address,
      soldDate: entry.Date_Sold,
      assignedSpecialist: packet ? getTechName(packet.Assigned_Specialist) : '',
      scheduledDate: packet ? packet.Date_Install_Scheduled : null
    };
  });
}

/**
 * Get open issues for branch
 */
function getOpenIssuesForBranch(branchID) {
  const issues = getSheetData(SHEETS.SERVICE_ISSUES);
  
  // Filter by branch through tracker entries
  const trackerData = getSheetData(SHEETS.TRACKER);
  const branchTrackerIDs = trackerData
    .filter(function(entry) { return entry.BranchID === branchID; })
    .map(function(entry) { return entry.EntryID; });
  
  return issues
    .filter(function(issue) {
      return (issue.Status === 'Open' || issue.Status === 'In Progress') &&
             branchTrackerIDs.indexOf(issue.TrackerEntryID) !== -1;
    })
    .sort(function(a, b) {
      // Sort by severity then date
      const severityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
      const aSeverity = severityOrder[a.Severity] || 4;
      const bSeverity = severityOrder[b.Severity] || 4;
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      return new Date(b.CreatedOn) - new Date(a.CreatedOn);
    })
    .map(function(issue) {
      return {
        issueID: issue.IssueID,
        date: issue.Date,
        customer: issue.Customer_Name,
        issueType: issue.Issue_Type,
        severity: issue.Severity,
        status: issue.Status,
        assignedTech: getTechName(issue.Assigned_Tech_UserID),
        description: issue.Description
      };
    });
}

/**
 * Helper: Get tech name
 */
function getTechName(techUserID) {
  if (!techUserID) return 'Unassigned';
  const tech = findRowByID(SHEETS.USERS, 'UserID', techUserID);
  return tech ? tech.Name : 'Unknown';
}

/**
 * Get weekly operations metrics
 */
function getWeeklyOpsMetrics(branchID) {
  const weekRange = getDateRange('week');
  const metricsData = getSheetData(SHEETS.OPERATIONS_METRICS);
  
  const weekMetrics = metricsData.filter(function(row) {
    const rowDate = new Date(row.Date);
    return rowDate >= weekRange.startDate && 
           rowDate <= weekRange.endDate && 
           row.BranchID === branchID;
  });
  
  var totalTMX = 0;
  var totalRNA = 0;
  var avgBacklog = 0;
  var avgOT = 0;
  var totalCoachingRides = 0;
  
  weekMetrics.forEach(function(metric) {
    totalTMX += Number(metric.MissedStops_TMX) || 0;
    totalRNA += Number(metric.MissedStops_RNA) || 0;
    avgBacklog += Number(metric.Backlog_Percent) || 0;
    avgOT += Number(metric.OT_Percent) || 0;
    totalCoachingRides += Number(metric.Coaching_Rides) || 0;
  });
  
  const count = weekMetrics.length || 1;
  
  return {
    totalMissedStops: totalTMX + totalRNA,
    avgBacklog: (avgBacklog / count).toFixed(1),
    avgOT: (avgOT / count).toFixed(1),
    totalCoachingRides: totalCoachingRides,
    daysReported: weekMetrics.length
  };
}

/**
 * Save daily operations metrics
 */
function saveDailyOpsMetrics(metricsData) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Check if entry exists
    const existingData = getSheetData(SHEETS.OPERATIONS_METRICS);
    const existingEntry = existingData.find(function(row) {
      const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return rowDate === todayStr && row.BranchID === currentUser.branchID;
    });
    
    const hierarchy = getBranchHierarchy(currentUser.branchID);
    
    if (existingEntry) {
      // Update
      updateRowByID(SHEETS.OPERATIONS_METRICS, 'MetricID', existingEntry.MetricID, {
        'MissedStops_TMX': metricsData.missedStopsTMX || 0,
        'MissedStops_RNA': metricsData.missedStopsRNA || 0,
        'Backlog_Percent': metricsData.backlogPercent || 0,
        'OT_Percent': metricsData.otPercent || 0,
        'Forecasted_Hours': metricsData.forecastedHours || 0,
        'Request_Review_Goal': metricsData.requestReviewGoal || 0,
        'Request_Review_Actual': metricsData.requestReviewActual || 0,
        'Coaching_Rides': metricsData.coachingRides || 0,
        'TAP_From_Coaching': metricsData.tapFromCoaching || 0
      });
      
      return { success: true, metricID: existingEntry.MetricID, updated: true };
      
    } else {
      // Create
      const metricID = generateUniqueID('OPM');
      const metricsSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(SHEETS.OPERATIONS_METRICS);
      
      metricsSheet.appendRow([
        metricID,
        today,
        currentUser.userID,
        currentUser.branchID,
        hierarchy.region ? hierarchy.region.RegionID : '',
        hierarchy.market ? hierarchy.market.MarketID : '',
        metricsData.missedStopsTMX || 0,
        metricsData.missedStopsRNA || 0,
        metricsData.backlogPercent || 0,
        metricsData.otPercent || 0,
        metricsData.forecastedHours || 0,
        metricsData.requestReviewGoal || 0,
        metricsData.requestReviewActual || 0,
        metricsData.coachingRides || 0,
        metricsData.tapFromCoaching || 0,
        new Date(),
        new Date()
      ]);
      
      return { success: true, metricID: metricID, updated: false };
    }
    
  } catch (e) {
    Logger.log('❌ Save ops metrics failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Assign specialist to installation
 */
function assignSpecialistToInstall(packetID, specialistUserID) {
  try {
    const success = updateRowByID(SHEETS.START_PACKETS, 'PacketID', packetID, {
      'Assigned_Specialist': specialistUserID
    });
    
    if (success) {
      logAudit('ASSIGN_SPECIALIST', SHEETS.START_PACKETS, packetID, 
        'Assigned to: ' + specialistUserID);
      logServerActivity('OPS_ASSIGN_TECH', packetID, { specialist: specialistUserID });
      
      // Notify specialist
      notifyTechOfAssignment(specialistUserID, packetID);
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Assign specialist failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

function getStartPackets(branchId) {
  const currentUser = getCurrentUser();
  const targetBranch = branchId || (currentUser ? (currentUser.branchID || currentUser.BranchID) : 'BRN-001');
  const trackerMap = {};
  const trackerData = getSheetData(SHEETS.TRACKER);
  trackerData.forEach(function(entry) {
    trackerMap[entry.EntryID] = entry;
  });
  const packets = getSheetData(SHEETS.START_PACKETS);
  return packets
    .filter(function(packet) {
      if (packet.BranchID) {
        return String(packet.BranchID) === String(targetBranch);
      }
      const tracker = trackerMap[packet.TrackerEntryID];
      return tracker ? String(tracker.BranchID) === String(targetBranch) : true;
    })
    .map(function(packet) {
      const tracker = trackerMap[packet.TrackerEntryID];
      return {
        packetID: packet.PacketID,
        accountName: packet.Account_Name,
        serviceAddress: packet.Service_Address,
        salesRep: packet.Sales_Rep,
        serviceType: packet.Service_Type,
        frequency: packet.Frequency,
        monthlyPrice: packet.Maintenance_Price,
        initialPrice: packet.Initial_Job_Price,
        operationsManager: packet.Operations_Manager,
        assignedSpecialist: packet.Assigned_Specialist,
        status: packet.Status || 'Draft',
        soldDate: packet.Sold_Date,
        installDate: packet.Date_Install_Scheduled,
        confirmedDate: packet.Confirmed_Start_Date,
        notes: packet.Special_Notes,
        branchId: packet.BranchID || (tracker ? tracker.BranchID : ''),
        trackerEntryID: packet.TrackerEntryID
      };
    });
}

function saveStartPacket(packetData) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.START_PACKETS);
  if (!sheet) throw new Error('StartPackets sheet missing');
  const packetID = packetData.packetID || generateUniqueID('PKT');
  const status = packetData.status || 'Draft';
  const branchId = packetData.branchID || currentUser.branchID;
  const payload = {
    PacketID: packetID,
    BranchID: branchId,
    TrackerEntryID: packetData.trackerEntryID || '',
    Sold_Date: packetData.soldDate ? new Date(packetData.soldDate) : new Date(),
    Account_Name: packetData.accountName || '',
    Service_Address: packetData.serviceAddress || '',
    Sales_Rep: packetData.salesRep || currentUser.name,
    Initial_Job_Price: Number(packetData.initialPrice) || 0,
    Maintenance_Price: Number(packetData.monthlyPrice) || 0,
    Service_Type: packetData.serviceType || 'General Pest',
    Frequency: packetData.frequency || 12,
    Operations_Manager: packetData.operationsManager || currentUser.name,
    Assigned_Specialist: packetData.assignedSpecialist || '',
    Date_Install_Scheduled: packetData.installDate ? new Date(packetData.installDate) : '',
    Status_Install_Complete: false,
    Materials_Ordered: packetData.materialsOrdered || false,
    Log_Book_Needed: packetData.logBookNeeded || false,
    POC_Name_Phone: packetData.pocInfo || '',
    Confirmed_Start_Date: packetData.confirmedStartDate ? new Date(packetData.confirmedStartDate) : '',
    Special_Notes: packetData.notes || buildStartPacketScope(packetData),
    Status: status,
    PestPac_ID: packetData.pestPacId || '',
    UpdatedOn: new Date()
  };
  const existing = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
  if (existing) {
    updateRowByID(SHEETS.START_PACKETS, 'PacketID', packetID, payload);
  } else {
    payload.CreatedOn = new Date();
    insertRow(SHEETS.START_PACKETS, payload);
  }
  if (status === 'Submitted') {
    logServerActivity('OPS_CREATE_START_PACKET', packetID, {
      account: payload.Account_Name,
      branchId: branchId
    });
  }
  return { success: true, packetID: packetID };
}

function generateStartPacketFromUnifiedSale(draft) {
  if (!draft) throw new Error('Missing start packet draft payload');
  const primaryService = draft.services && draft.services.length ? draft.services[0] : null;
  const serviceType = draft.serviceName || (primaryService ? (primaryService.serviceName || primaryService.programType) : (draft.coveredPests ? 'Custom Program' : 'General Pest'));
  const frequency = primaryService && primaryService.servicesPerYear ? primaryService.servicesPerYear : (draft.frequency || 12);
  const notes = buildStartPacketNotesFromDraft(draft, primaryService);
  
  // Create tracker entry first (single source of truth)
  const trackerEntryID = createTrackerEntryFromUnifiedSale(draft);
  
  const packetPayload = {
    accountName: draft.accountName || '',
    serviceAddress: draft.serviceAddress || '',
    salesRep: (draft.salesRepIDs && draft.salesRepIDs.join ? draft.salesRepIDs.join(', ') : draft.aeName) || draft.aeName || '',
    initialPrice: draft.initialPrice || draft.combinedInitialTotal || draft.servicesInitialTotal || 0,
    monthlyPrice: draft.maintenancePrice || draft.combinedMonthlyTotal || draft.servicesMonthlyTotal || 0,
    serviceType: serviceType,
    frequency: frequency,
    branchID: draft.branchId || 'BRN-001',
    confirmedStartDate: draft.requestedStartDate || '',
    pocInfo: buildPocInfoString(draft),
    notes: notes,
    soldDate: draft.soldDate || new Date().toISOString(),
    trackerEntryID: trackerEntryID
  };
  const result = saveStartPacket(packetPayload);
  if (draft.sraHazards && draft.sraHazards.length) {
    replaceHazards(result.packetID, draft.sraHazards);
  }
  return result;
}

/**
 * Create tracker entry from unified sale (single source of truth)
 */
function createTrackerEntryFromUnifiedSale(draft) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    const entryID = generateUniqueID('TRK');
    const trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TRACKER);
    
    const soldDate = draft.soldDate ? new Date(draft.soldDate) : new Date();
    const initialPrice = Number(draft.initialPrice || draft.combinedInitialTotal || 0);
    const monthlyPrice = Number(draft.maintenancePrice || draft.combinedMonthlyTotal || 0);
    const annualValue = monthlyPrice * (draft.frequency || 12);
    
    trackerSheet.appendRow([
      entryID,
      new Date(), // Date
      currentUser.userID || currentUser.UserID, // AE_UserID
      draft.branchId || currentUser.branchID || currentUser.BranchID || 'BRN-001', // BranchID
      'Sold', // Stage (already sold when creating from unified sale)
      draft.accountName || '',
      draft.serviceAddress || '',
      extractZipFromAddress(draft.serviceAddress || ''),
      draft.pocName || draft.contactName || '',
      draft.pocPhone || '',
      draft.pocEmail || draft.contactEmail || '',
      'Salesforce Import', // Source
      'New Business', // Sale_Type
      draft.serviceName || draft.serviceType || '',
      initialPrice, // Initial_Fee
      monthlyPrice, // Monthly_Fee
      draft.frequency || 12, // Frequency
      annualValue, // Annual_Value
      '', // PestPac_ID
      soldDate, // Date_Proposal (use sold date as proposal date)
      soldDate, // Date_Sold
      null, // Date_Dead
      'Sold', // Status
      'Created from Salesforce import. ' + (draft.specialNotes || ''), // Notes
      new Date(), // CreatedOn
      new Date() // UpdatedOn
    ]);
    
    logAudit('CREATE_TRACKER_FROM_UNIFIED_SALE', SHEETS.TRACKER, entryID, 
      'Created tracker entry from unified sale: ' + (draft.accountName || ''));
    
    return entryID;
    
  } catch (e) {
    Logger.log('❌ Create tracker entry failed: ' + e.message);
    // Don't throw - allow start packet creation to continue
    return null;
  }
}

function extractZipFromAddress(address) {
  if (!address) return '';
  const zipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return zipMatch ? zipMatch[0] : '';
}

function buildStartPacketNotesFromDraft(draft, primaryService) {
  var serviceSummary = '';
  if (primaryService && (primaryService.descriptionText || primaryService.programType)) {
    serviceSummary = (primaryService.serviceName || primaryService.programType) + ': ' + (primaryService.descriptionText || primaryService.programType || '');
  } else if (draft.specialNotes) {
    serviceSummary = draft.specialNotes;
  }
  const hazardSummary = buildSraSummaryBlock(draft);
  return [serviceSummary, hazardSummary].filter(Boolean).join('\n\n');
}

function buildSraSummaryBlock(draft) {
  var lines = [];
  lines.push('SRA Review (include in Sales Agreement)');
  var hazards = draft.sraHazards || [];
  hazards.forEach(function(hazard) {
    lines.push('- ' + hazard.hazard + ' | ' + hazard.control + ' | Safe: ' + (hazard.safeToProceed !== false ? 'Yes' : 'No'));
  });
  if (draft.sraAdditionalHazards && draft.sraAdditionalHazards !== 'None') {
    lines.push('Additional Hazards: ' + draft.sraAdditionalHazards);
  }
  if (draft.sraCompletedBy || draft.sraCompletedAt) {
    lines.push('Completed By: ' + (draft.sraCompletedBy || 'N/A') + ' | Date: ' + (draft.sraCompletedAt || 'N/A'));
  }
  return lines.join('\n');
}

function buildPocInfoString(draft) {
  const parts = [];
  if (draft.pocName) parts.push(draft.pocName);
  if (draft.pocPhone) parts.push(draft.pocPhone);
  if (draft.contactEmail) parts.push(draft.contactEmail);
  return parts.join(' | ');
}

function updateStartPacketStatus(packetID, status) {
  const success = updateRowByID(SHEETS.START_PACKETS, 'PacketID', packetID, {
    Status: status || 'Draft'
  });
  if (success && status === 'Submitted') {
    logServerActivity('OPS_CREATE_START_PACKET', packetID, { manualSubmit: true });
  }
  return { success: success };
}

function buildStartPacketScope(packetData) {
  const service = String(packetData.serviceType || '').toLowerCase();
  var tasks = [];
  if (service.indexOf('rodent') !== -1) {
    tasks.push('Install rodent bait stations along perimeter');
    tasks.push('Seal primary openings / exclusion');
  } else if (service.indexOf('mosquito') !== -1) {
    tasks.push('Deploy mosquito misting units');
    tasks.push('Treat standing water zones');
  } else {
    tasks.push('General pest perimeter treatment');
    tasks.push('Interior inspection + targeted applications');
  }
  return 'Scope: ' + tasks.join('; ');
}

function generateStartPacketPDF(packetID) {
  const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
  if (!packet) {
    return { success: false, message: 'Start packet not found' };
  }
  const html = `<h1>Start Packet ${packet.PacketID}</h1>
    <p><strong>Account:</strong> ${packet.Account_Name}</p>
    <p><strong>Service Address:</strong> ${packet.Service_Address}</p>
    <p><strong>Service Type:</strong> ${packet.Service_Type}</p>
    <p><strong>Monthly:</strong> ${packet.Maintenance_Price}</p>
    <p><strong>Initial:</strong> ${packet.Initial_Job_Price}</p>
    <p><strong>Notes:</strong> ${packet.Special_Notes}</p>`;
  const blob = Utilities.newBlob(html, 'text/html', 'start-packet-' + packetID + '.html');
  logServerActivity('OPS_CREATE_START_PACKET', packetID, { action: 'PDF_EXPORT' }, 5);
  return {
    success: true,
    content: Utilities.base64Encode(blob.getBytes()),
    mimeType: 'text/html',
    fileName: 'start-packet-' + packetID + '.html'
  };
}

function getStartPacketScope(packetID) {
  const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
  if (!packet) {
    return { success: false, message: 'Start packet not found' };
  }
  return {
    success: true,
    scope: packet.Special_Notes || buildStartPacketScope(packet)
  };
}
/**
 * Notify technician of new assignment
 */
function notifyTechOfAssignment(techUserID, packetID) {
  try {
    const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
    if (!packet) return;
    
    const notificationsSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(SHEETS.NOTIFICATIONS);
    const notificationID = generateUniqueID('NOT');
    
    notificationsSheet.appendRow([
      notificationID,
      techUserID,
      'install_assignment',
      '🔧 New Installation Assigned',
      'Installation for ' + packet.Account_Name,
      JSON.stringify({
        packetID: packetID,
        customer: packet.Account_Name,
        address: packet.Service_Address
      }),
      false,
      '/installs/' + packetID,
      new Date()
    ]);
    
  } catch (e) {
    Logger.log('⚠ Tech notification failed: ' + e.message);
  }
}

/**
 * Resolve service issue
 */
function resolveServiceIssue(issueID, resolutionNotes) {
  try {
    const success = updateRowByID(SHEETS.SERVICE_ISSUES, 'IssueID', issueID, {
      'Status': 'Resolved',
      'Resolution_Notes': resolutionNotes,
      'ResolvedOn': new Date()
    });
    
    if (success) {
      logAudit('RESOLVE_ISSUE', SHEETS.SERVICE_ISSUES, issueID, resolutionNotes);
      logServerActivity('UPDATE_LEAD', issueID, { resolution: resolutionNotes });
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Resolve issue failed: ' + e.message);
    return { success: false, message: e.message };
  }
}
