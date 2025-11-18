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
      
      // Notify specialist
      notifyTechOfAssignment(specialistUserID, packetID);
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Assign specialist failed: ' + e.message);
    return { success: false, message: e.message };
  }
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
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Resolve issue failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

