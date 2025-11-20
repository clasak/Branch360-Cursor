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

/**
 * Generate daily report (called from dashboard)
 */
function generateBranchDailyReport() {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  return generateDailyCadenceReport(branchID);
}

/**
 * Export branch data to CSV
 */
function exportBranchManagerData() {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  // Get all relevant data
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY).filter(function(row) {
    return row.BranchID === branchID;
  });
  
  const trackerData = getSheetData(SHEETS.TRACKER).filter(function(row) {
    return row.BranchID === branchID;
  });
  
  const opsData = getSheetData(SHEETS.OPERATIONS_METRICS).filter(function(row) {
    return row.BranchID === branchID;
  });
  
  // Create CSV content
  var csvContent = 'Branch Export - ' + branchID + ' - ' + dateStr + '\n\n';
  csvContent += 'Sales Activity\n';
  csvContent += 'Date,AE,Revenue,TAP,Appointments,Quotes\n';
  
  salesData.forEach(function(row) {
    csvContent += [
      row.Date || '',
      row.AE_UserID || '',
      row.Daily_Sales_Actual || 0,
      row.TAP_Actual || 0,
      row.Appointments_Completed || 0,
      row.Quotes_Created || 0
    ].join(',') + '\n';
  });
  
  csvContent += '\nPipeline\n';
  csvContent += 'Customer,Stage,Value,AE,Date\n';
  
  trackerData.forEach(function(row) {
    csvContent += [
      row.Customer_Name || '',
      row.Stage || '',
      row.Annual_Value || 0,
      row.AE_UserID || '',
      row.Date || ''
    ].join(',') + '\n';
  });
  
  // Create a temporary file in Drive
  const fileName = 'Branch360_Export_' + branchID + '_' + dateStr + '.csv';
  const folder = DriveApp.getRootFolder();
  const file = folder.createFile(fileName, csvContent, MimeType.CSV);
  
  // Make file accessible
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return {
    success: true,
    url: file.getUrl(),
    fileName: fileName
  };
}

/**
 * Get detailed pipeline with all entries
 */
function getDetailedBranchPipeline() {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
  const users = getSheetData(SHEETS.USERS);
  
  const entries = trackerData
    .filter(function(entry) {
      const status = String(entry.Status || '').toLowerCase();
      return status !== 'dead';
    })
    .map(function(entry) {
      const ae = users.find(function(u) { return u.UserID === entry.AE_UserID; });
      return {
        entryID: entry.EntryID,
        customerName: entry.Customer_Name || '',
        stage: entry.Stage || '',
        value: Number(entry.Annual_Value) || 0,
        aeName: ae ? ae.Name : 'Unknown',
        date: entry.Date ? Utilities.formatDate(new Date(entry.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''
      };
    });
  
  return { entries: entries };
}

/**
 * Get pipeline entries for a specific stage
 */
function getPipelineStageDetails(stage) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
  const users = getSheetData(SHEETS.USERS);
  
  const entries = trackerData
    .filter(function(entry) {
      const entryStage = String(entry.Stage || '').toLowerCase();
      const status = String(entry.Status || '').toLowerCase();
      return entryStage === stage.toLowerCase() && status !== 'dead';
    })
    .map(function(entry) {
      const ae = users.find(function(u) { return u.UserID === entry.AE_UserID; });
      return {
        entryID: entry.EntryID,
        customerName: entry.Customer_Name || '',
        value: Number(entry.Annual_Value) || 0,
        aeName: ae ? ae.Name : 'Unknown',
        date: entry.Date ? Utilities.formatDate(new Date(entry.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''
      };
    });
  
  return { entries: entries };
}

/**
 * Get detailed sales breakdown
 */
function getBranchSalesDetails() {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  const todaySales = salesData.filter(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.BranchID === branchID;
  });
  
  var totalTAP = 0;
  var totalAppointments = 0;
  var totalQuotes = 0;
  var totalRevenue = 0;
  const breakdown = {};
  
  todaySales.forEach(function(activity) {
    const aeID = activity.AE_UserID;
    if (!breakdown[aeID]) {
      breakdown[aeID] = {
        name: aeID,
        revenue: 0,
        tap: 0,
        appointments: 0,
        quotes: 0
      };
    }
    
    breakdown[aeID].revenue += Number(activity.Daily_Sales_Actual) || 0;
    breakdown[aeID].tap += Number(activity.TAP_Actual) || 0;
    breakdown[aeID].appointments += Number(activity.Appointments_Completed) || 0;
    breakdown[aeID].quotes += Number(activity.Quotes_Created) || 0;
    
    totalTAP += Number(activity.TAP_Actual) || 0;
    totalAppointments += Number(activity.Appointments_Completed) || 0;
    totalQuotes += Number(activity.Quotes_Created) || 0;
    totalRevenue += Number(activity.Daily_Sales_Actual) || 0;
  });
  
  // Get AE names
  const users = getSheetData(SHEETS.USERS);
  const breakdownArray = Object.keys(breakdown).map(function(aeID) {
    const ae = users.find(function(u) { return u.UserID === aeID; });
    return {
      name: ae ? ae.Name : aeID,
      revenue: breakdown[aeID].revenue,
      tap: breakdown[aeID].tap,
      appointments: breakdown[aeID].appointments,
      quotes: breakdown[aeID].quotes
    };
  });
  
  return {
    totalTAP: totalTAP,
    appointments: totalAppointments,
    quotes: totalQuotes,
    revenue: totalRevenue,
    breakdown: breakdownArray
  };
}

/**
 * Get detailed operations breakdown
 */
function getBranchOpsDetails() {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  const opsData = getSheetData(SHEETS.OPERATIONS_METRICS);
  const todayOps = opsData.filter(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.BranchID === branchID;
  });
  
  var totalMissedStops = 0;
  var totalBacklog = 0;
  
  todayOps.forEach(function(metric) {
    totalMissedStops += (Number(metric.MissedStops_TMX) || 0) + (Number(metric.MissedStops_RNA) || 0);
    totalBacklog += Number(metric.Backlog_Percent) || 0;
  });
  
  return {
    missedStops: totalMissedStops,
    backlog: todayOps.length > 0 ? (totalBacklog / todayOps.length).toFixed(1) : 0
  };
}

/**
 * Get metric details with targets and trends
 */
function getMetricDetails(metricType) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  var current = 0;
  var target = 'N/A';
  var status = 'N/A';
  var trend = 'N/A';
  
  if (metricType === 'TAP' || metricType === 'Appointments' || metricType === 'Quotes' || metricType === 'Revenue') {
    const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
    const todaySales = salesData.filter(function(row) {
      const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return rowDate === todayStr && row.BranchID === branchID;
    });
    
    todaySales.forEach(function(activity) {
      if (metricType === 'TAP') current += Number(activity.TAP_Actual) || 0;
      else if (metricType === 'Appointments') current += Number(activity.Appointments_Completed) || 0;
      else if (metricType === 'Quotes') current += Number(activity.Quotes_Created) || 0;
      else if (metricType === 'Revenue') current += Number(activity.Daily_Sales_Actual) || 0;
    });
    
    target = 'Daily Goal';
    status = current > 0 ? 'On Track' : 'Needs Attention';
  } else if (metricType === 'MissedStops' || metricType === 'Backlog') {
    const opsData = getSheetData(SHEETS.OPERATIONS_METRICS);
    const todayOps = opsData.filter(function(row) {
      const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return rowDate === todayStr && row.BranchID === branchID;
    });
    
    if (metricType === 'MissedStops') {
      todayOps.forEach(function(metric) {
        current += (Number(metric.MissedStops_TMX) || 0) + (Number(metric.MissedStops_RNA) || 0);
      });
      target = '0';
      status = current === 0 ? 'On Target' : 'Needs Attention';
    } else {
      var totalBacklog = 0;
      todayOps.forEach(function(metric) {
        totalBacklog += Number(metric.Backlog_Percent) || 0;
      });
      current = todayOps.length > 0 ? (totalBacklog / todayOps.length) : 0;
      target = '< 10%';
      status = current < 10 ? 'On Target' : (current < 15 ? 'Watch' : 'Over Target');
    }
  }
  
  return {
    current: current,
    target: target,
    status: status,
    trend: trend
  };
}

/**
 * Get detailed AE performance
 */
function getAEPerformanceDetails(userID) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  const ae = users.find(function(u) { 
    return u.UserID === userID || u.Email === userID;
  });
  
  if (!ae) throw new Error('AE not found');
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  const aeActivities = salesData.filter(function(activity) {
    const activityDate = new Date(activity.Date);
    return activity.AE_UserID === ae.UserID && 
           activityDate >= monthRange.startDate && 
           activityDate <= monthRange.endDate;
  });
  
  var monthSales = 0;
  var monthTAP = 0;
  var monthQuotes = 0;
  var quotesWon = 0;
  
  aeActivities.forEach(function(activity) {
    monthSales += Number(activity.Daily_Sales_Actual) || 0;
    monthTAP += Number(activity.TAP_Actual) || 0;
    monthQuotes += Number(activity.Quotes_Created) || 0;
  });
  
  // Get quotes won
  const quotes = getSheetData(SHEETS.QUOTES);
  const aeQuotes = quotes.filter(function(quote) {
    return quote.AE_UserID === ae.UserID && quote.Status === 'Won';
  });
  quotesWon = aeQuotes.length;
  
  const winRate = monthQuotes > 0 ? ((quotesWon / monthQuotes) * 100).toFixed(1) : 0;
  
  return {
    name: ae.Name,
    email: ae.Email,
    monthSales: monthSales,
    monthTAP: monthTAP,
    monthQuotes: monthQuotes,
    quotesWon: quotesWon,
    winRate: winRate
  };
}

/**
 * Get detailed technician performance
 */
function getTechPerformanceDetails(userID) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  const tech = users.find(function(u) { 
    return u.UserID === userID || u.Email === userID;
  });
  
  if (!tech) throw new Error('Technician not found');
  
  const leads = getSheetData(SHEETS.LEADS, { Tech_UserID: tech.UserID });
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
}

/**
 * Get alert details
 */
function getAlertDetails(alertType, alertID) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  
  if (alertType === 'overdue_proposal') {
    const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
    const entry = trackerData.find(function(e) { 
      return e.EntryID === alertID;
    });
    
    if (!entry) throw new Error('Alert not found');
    
    const now = new Date();
    const daysSince = entry.Date_Proposal ? (now - new Date(entry.Date_Proposal)) / (1000 * 60 * 60 * 24) : 0;
    
    return {
      type: alertType,
      message: 'Proposal overdue: ' + entry.Customer_Name + ' (' + Math.floor(daysSince) + ' days)',
      severity: 'high',
      details: 'Customer: ' + entry.Customer_Name + ', Value: $' + (entry.Annual_Value || 0) + ', Days Overdue: ' + Math.floor(daysSince)
    };
  } else if (alertType === 'unassigned_install') {
    const packets = getSheetData(SHEETS.START_PACKETS);
    const packet = packets.find(function(p) { return p.PacketID === alertID || p.EntryID === alertID; });
    
    if (!packet) throw new Error('Alert not found');
    
    return {
      type: alertType,
      message: 'Installation needs assignment: ' + packet.Account_Name,
      severity: 'medium',
      details: 'Account: ' + packet.Account_Name + ', Address: ' + (packet.Service_Address || 'N/A')
    };
  } else if (alertType === 'high_severity_issue') {
    const issues = getSheetData(SHEETS.SERVICE_ISSUES);
    const issue = issues.find(function(i) { return i.IssueID === alertID; });
    
    if (!issue) throw new Error('Alert not found');
    
    return {
      type: alertType,
      message: 'High-priority issue: ' + issue.Customer_Name,
      severity: 'high',
      details: 'Customer: ' + issue.Customer_Name + ', Type: ' + (issue.Issue_Type || 'N/A') + ', Description: ' + (issue.Description || 'N/A')
    };
  }
  
  throw new Error('Unknown alert type');
}

/**
 * Resolve branch alert
 */
function resolveBranchAlert(alertType, alertID, notes) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  
  if (alertType === 'overdue_proposal') {
    // Update tracker entry with notes
    const trackerData = getSheetData(SHEETS.TRACKER, { BranchID: branchID });
    const entry = trackerData.find(function(e) { 
      return e.EntryID === alertID;
    });
    
    if (!entry) throw new Error('Alert not found');
    
    updateRowByID(SHEETS.TRACKER, 'EntryID', alertID, {
      Notes: (entry.Notes || '') + '\n[Branch Manager] ' + new Date().toISOString() + ': ' + notes
    });
    
    logAudit('RESOLVE_ALERT', SHEETS.TRACKER, alertID, 'Branch Manager resolved overdue proposal');
    
  } else if (alertType === 'unassigned_install') {
    // Log resolution
    logAudit('RESOLVE_ALERT', SHEETS.START_PACKETS, alertID, 'Branch Manager noted: ' + notes);
    
  } else if (alertType === 'high_severity_issue') {
    // Update issue status
    const issues = getSheetData(SHEETS.SERVICE_ISSUES);
    const issue = issues.find(function(i) { return i.IssueID === alertID; });
    
    if (!issue) throw new Error('Alert not found');
    
    updateRowByID(SHEETS.SERVICE_ISSUES, 'IssueID', alertID, {
      Status: 'Resolved',
      Resolution_Notes: (issue.Resolution_Notes || '') + '\n[Branch Manager] ' + new Date().toISOString() + ': ' + notes
    });
    
    logAudit('RESOLVE_ALERT', SHEETS.SERVICE_ISSUES, alertID, 'Branch Manager resolved high-severity issue');
  }
  
  return { success: true };
}

/**
 * Send message to branch team
 */
function sendBranchTeamMessage(message) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const branchID = currentUser.BranchID || currentUser.branchID;
  const users = getSheetData(SHEETS.USERS, { BranchID: branchID });
  
  // Create notification for each team member
  const notificationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.NOTIFICATIONS);
  if (!notificationSheet) {
    throw new Error('Notifications sheet not found');
  }
  
  users.forEach(function(user) {
    if (user.Active !== false) {
      const notificationID = generateUniqueID('NOT');
      notificationSheet.appendRow([
        notificationID,
        user.UserID,
        'Team Message from ' + currentUser.Name,
        message,
        'info',
        false, // Not read
        new Date(),
        new Date()
      ]);
    }
  });
  
  logAudit('TEAM_MESSAGE', SHEETS.NOTIFICATIONS, branchID, 'Branch Manager sent team message');
  
  return { success: true, recipients: users.length };
}

