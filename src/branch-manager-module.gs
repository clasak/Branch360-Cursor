/**
 * Branch360 - Branch Manager Module
 */

/**
 * Get Branch Manager Dashboard
 */
function getBranchManagerDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  
  return {
    user: {
      name: currentUser.Name || currentUser.name,
      branchID: branchID
    },
    todaySummary: getBranchDailySummaryToday(branchID),
    salesTeam: getSalesTeamPerformance(branchID),
    opsTeam: getOpsTeamPerformance(branchID),
    pipeline: getBranchPipeline(branchID),
    alerts: getBranchAlerts(branchID),
    weekTrends: getWeekTrends(branchID)
  };
}

/**
 * Get today's branch summary
 */
function getBranchDailySummaryToday(branchID) {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  // Get sales activity for branch
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  const todaySales = salesData.filter(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.BranchID === branchID;
  });
  
  // Get ops metrics for branch
  const opsData = getSheetData(SHEETS.OPERATIONS_METRICS);
  const todayOps = opsData.filter(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.BranchID === branchID;
  });
  
  // Aggregate sales
  var totalTAP = 0;
  var totalAppointments = 0;
  var totalQuotes = 0;
  var totalSales = 0;
  
  todaySales.forEach(function(activity) {
    totalTAP += Number(activity.TAP_Actual) || 0;
    totalAppointments += Number(activity.Appointments_Completed) || 0;
    totalQuotes += Number(activity.Quotes_Created) || 0;
    totalSales += Number(activity.Daily_Sales_Actual) || 0;
  });
  
  // Aggregate ops
  var totalMissedStops = 0;
  var avgBacklog = 0;
  
  todayOps.forEach(function(metric) {
    totalMissedStops += (Number(metric.MissedStops_TMX) || 0) + (Number(metric.MissedStops_RNA) || 0);
    avgBacklog += Number(metric.Backlog_Percent) || 0;
  });
  
  return {
    sales: {
      tap: totalTAP,
      appointments: totalAppointments,
      quotes: totalQuotes,
      revenue: totalSales
    },
    operations: {
      missedStops: totalMissedStops,
      backlog: todayOps.length > 0 ? (avgBacklog / todayOps.length).toFixed(1) : 0
    }
  };
}

/**
 * Get sales team performance
 */
function getSalesTeamPerformance(branchID) {
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  const aes = users.filter(function(user) {
    const role = String(user.Role || '').toLowerCase();
    return role.includes('account executive') || role === 'ae' || role.includes('sales');
  });
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  return aes.map(function(ae) {
    const aeActivities = salesData.filter(function(activity) {
      const activityDate = new Date(activity.Date);
      return activity.AE_UserID === ae.UserID && 
             activityDate >= monthRange.startDate && 
             activityDate <= monthRange.endDate;
    });
    
    var totalSales = 0;
    var totalTAP = 0;
    var totalQuotes = 0;
    
    aeActivities.forEach(function(activity) {
      totalSales += Number(activity.Daily_Sales_Actual) || 0;
      totalTAP += Number(activity.TAP_Actual) || 0;
      totalQuotes += Number(activity.Quotes_Created) || 0;
    });
    
    return {
      name: ae.Name,
      email: ae.Email,
      monthSales: totalSales,
      monthTAP: totalTAP,
      monthQuotes: totalQuotes
    };
  }).sort(function(a, b) {
    return b.monthSales - a.monthSales; // Sort by sales descending
  });
}

/**
 * Get operations team performance
 */
function getOpsTeamPerformance(branchID) {
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  const techs = users.filter(function(user) {
    const role = String(user.Role || '').toLowerCase();
    return role.includes('tech') || role.includes('specialist');
  });
  
  return techs.map(function(tech) {
    // Get leads submitted
    const leads = getSheetData(SHEETS.LEADS, { Tech_UserID: tech.UserID });
    
    // Get installations completed
    const packets = getSheetData(SHEETS.START_PACKETS);
    const completedInstalls = packets.filter(function(packet) {
      return packet.Assigned_Specialist === tech.UserID && packet.Status_Install_Complete;
    }).length;
    
    return {
      name: tech.Name,
      email: tech.Email,
      leadsSubmitted: leads.length,
      installsCompleted: completedInstalls
    };
  });
}

/**
 * Get branch pipeline summary
 */
function getBranchPipeline(branchID) {
  const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
  
  var proposalValue = 0;
  var negotiationValue = 0;
  var soldValue = 0;
  
  trackerData.forEach(function(entry) {
    const stage = String(entry.Stage || '').toLowerCase();
    const value = Number(entry.Annual_Value) || 0;
    const status = String(entry.Status || '').toLowerCase();
    
    if (status !== 'dead') {
      if (stage === 'proposal') proposalValue += value;
      else if (stage === 'negotiation') negotiationValue += value;
      else if (stage === 'sold') soldValue += value;
    }
  });
  
  return {
    proposal: proposalValue,
    negotiation: negotiationValue,
    sold: soldValue,
    total: proposalValue + negotiationValue + soldValue
  };
}

/**
 * Get branch alerts
 */
function getBranchAlerts(branchID) {
  const alerts = [];
  
  // Check for overdue proposals
  const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
  const now = new Date();
  
  trackerData.forEach(function(entry) {
    if (entry.Stage === 'Proposal' && entry.Date_Proposal) {
      const daysSince = (now - new Date(entry.Date_Proposal)) / (1000 * 60 * 60 * 24);
      if (daysSince >= 14) {
        alerts.push({
          type: 'overdue_proposal',
          severity: 'high',
          message: 'Proposal overdue: ' + entry.Customer_Name + ' (' + Math.floor(daysSince) + ' days)',
          data: entry
        });
      }
    }
  });
  
  // Check for unassigned installations
  const packets = getSheetData(SHEETS.START_PACKETS);
  packets.forEach(function(packet) {
    const trackerEntry = trackerData.find(function(e) { return e.EntryID === packet.TrackerEntryID; });
    if (trackerEntry && trackerEntry.BranchID === branchID) {
      if (!packet.Assigned_Specialist) {
        alerts.push({
          type: 'unassigned_install',
          severity: 'medium',
          message: 'Installation needs assignment: ' + packet.Account_Name,
          data: packet
        });
      }
    }
  });
  
  // Check for open high-severity issues
  const issues = getSheetData(SHEETS.SERVICE_ISSUES);
  issues.forEach(function(issue) {
    const trackerEntry = trackerData.find(function(e) { return e.EntryID === issue.TrackerEntryID; });
    if (trackerEntry && trackerEntry.BranchID === branchID) {
      if (issue.Status === 'Open' && issue.Severity === 'High') {
        alerts.push({
          type: 'high_severity_issue',
          severity: 'high',
          message: 'High-priority issue: ' + issue.Customer_Name,
          data: issue
        });
      }
    }
  });
  
  return alerts;
}

/**
 * Get week-over-week trends
 */
function getWeekTrends(branchID) {
  const thisWeek = getDateRange('week');
  const lastWeekStart = new Date(thisWeek.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(thisWeek.startDate.getTime() - 1);
  
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  // This week
  const thisWeekSales = salesData.filter(function(row) {
    const rowDate = new Date(row.Date);
    return rowDate >= thisWeek.startDate && rowDate <= thisWeek.endDate && row.BranchID === branchID;
  });
  
  var thisWeekTotal = 0;
  thisWeekSales.forEach(function(activity) {
    thisWeekTotal += Number(activity.Daily_Sales_Actual) || 0;
  });
  
  // Last week
  const lastWeekSales = salesData.filter(function(row) {
    const rowDate = new Date(row.Date);
    return rowDate >= lastWeekStart && rowDate <= lastWeekEnd && row.BranchID === branchID;
  });
  
  var lastWeekTotal = 0;
  lastWeekSales.forEach(function(activity) {
    lastWeekTotal += Number(activity.Daily_Sales_Actual) || 0;
  });
  
  return {
    thisWeek: thisWeekTotal,
    lastWeek: lastWeekTotal,
    change: lastWeekTotal > 0 ? (((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(1) : 0
  };
}

/**
 * Generate daily cadence report
 */
function generateDailyCadenceReport(branchID) {
  const summary = getBranchDailySummaryToday(branchID);
  const date = new Date();
  
  const summaryID = generateUniqueID('SUM');
  const summarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.BRANCH_DAILY_SUMMARY);
  
  const hierarchy = getBranchHierarchy(branchID);
  
  summarySheet.appendRow([
    summaryID,
    date,
    branchID,
    hierarchy.region ? hierarchy.region.RegionID : '',
    hierarchy.market ? hierarchy.market.MarketID : '',
    0, // TAP_Goal (to be filled)
    summary.sales.tap,
    summary.sales.appointments,
    summary.sales.appointments,
    summary.sales.quotes,
    0, // Quotes_Won
    0, // Quote_Value
    0, // WinRate_Percent
    0, // Daily_Sales_Goal
    summary.sales.revenue,
    0, // MissedStops_TMX
    0, // MissedStops_RNA
    summary.operations.backlog,
    0, // OT_Percent
    0, // Forecasted_Hours
    0, // Request_Review_Goal
    0, // Request_Review_Actual
    0, // Coaching_Rides
    0, // TAP_From_Coaching
    0, // Revenue_Percent_Goal
    0, // Backlog_Index
    0, // Labor_Efficiency
    0, // Forecast_Accuracy
    new Date(),
    new Date()
  ]);
  
  logAudit('GENERATE_CADENCE', SHEETS.BRANCH_DAILY_SUMMARY, summaryID, 'Branch: ' + branchID);
  
  return { success: true, summaryID: summaryID };
}

