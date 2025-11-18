/**
 * Branch360 - Reporting & Analytics Module
 * Regional Director and Market Director dashboards and reporting
 */

/**
 * Get Regional Director Dashboard
 * @param {string} userID - Optional user ID (uses current user if not provided)
 * @return {Object} Dashboard data
 */
function getRegionalDirectorDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  // Get user's regions (from branch mapping or direct assignment)
  const regions = getUserRegions(currentUser.UserID || currentUser.userID);
  
  return {
    user: currentUser,
    regions: regions,
    aggregatedMetrics: getRegionalAggregatedMetrics(regions),
    branchComparison: getRegionalBranchComparison(regions),
    trends: getRegionalTrends(regions)
  };
}

/**
 * Get user's regions
 * @param {string} userID - User ID
 * @return {Array<string>} Array of Region IDs
 */
function getUserRegions(userID) {
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) return [];
  
  // If user role is Regional Director, find regions they manage
  const regions = getSheetData(SHEETS.REGIONS);
  return regions.filter(function(region) {
    return region.DirectorUserID === userID;
  }).map(function(region) {
    return region.RegionID;
  });
}

/**
 * Get aggregated metrics across regions
 * @param {Array<string>} regionIDs - Array of Region IDs
 * @return {Object} Aggregated metrics
 */
function getRegionalAggregatedMetrics(regionIDs) {
  if (regionIDs.length === 0) return {};
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  const regionalSales = salesData.filter(function(activity) {
    const activityDate = new Date(activity.Date);
    return regionIDs.indexOf(activity.RegionID) !== -1 && 
           activityDate >= monthRange.startDate && 
           activityDate <= monthRange.endDate;
  });
  
  var totalRevenue = 0;
  var totalTAP = 0;
  var totalQuotes = 0;
  
  regionalSales.forEach(function(activity) {
    totalRevenue += Number(activity.Daily_Sales_Actual) || 0;
    totalTAP += Number(activity.TAP_Actual) || 0;
    totalQuotes += Number(activity.Quotes_Created) || 0;
  });
  
  return {
    monthRevenue: totalRevenue,
    monthTAP: totalTAP,
    monthQuotes: totalQuotes,
    branchCount: getRegionalBranchCount(regionIDs)
  };
}

/**
 * Get branch count for regions
 * @param {Array<string>} regionIDs - Array of Region IDs
 * @return {number} Branch count
 */
function getRegionalBranchCount(regionIDs) {
  const branches = getSheetData(SHEETS.BRANCHES);
  return branches.filter(function(branch) {
    return regionIDs.indexOf(branch.RegionID) !== -1 && branch.Active;
  }).length;
}

/**
 * Compare branches within region
 * @param {Array<string>} regionIDs - Array of Region IDs
 * @return {Array<Object>} Branch comparison data sorted by revenue
 */
function getRegionalBranchComparison(regionIDs) {
  const branches = getSheetData(SHEETS.BRANCHES);
  const regionalBranches = branches.filter(function(branch) {
    return regionIDs.indexOf(branch.RegionID) !== -1 && branch.Active;
  });
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  return regionalBranches.map(function(branch) {
    const branchSales = salesData.filter(function(activity) {
      const activityDate = new Date(activity.Date);
      return activity.BranchID === branch.BranchID && 
             activityDate >= monthRange.startDate && 
             activityDate <= monthRange.endDate;
    });
    
    var revenue = 0;
    branchSales.forEach(function(activity) {
      revenue += Number(activity.Daily_Sales_Actual) || 0;
    });
    
    return {
      branchName: branch.BranchName,
      branchID: branch.BranchID,
      monthRevenue: revenue
    };
  }).sort(function(a, b) {
    return b.monthRevenue - a.monthRevenue;
  });
}

/**
 * Get regional trends (last 6 months)
 * @param {Array<string>} regionIDs - Array of Region IDs
 * @return {Array<Object>} Monthly trend data
 */
function getRegionalTrends(regionIDs) {
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  const now = new Date();
  const months = [];
  
  // Get last 6 months
  for (var i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthSales = salesData.filter(function(activity) {
      const activityDate = new Date(activity.Date);
      return regionIDs.indexOf(activity.RegionID) !== -1 && 
             activityDate >= monthStart && 
             activityDate <= monthEnd;
    });
    
    var revenue = 0;
    monthSales.forEach(function(activity) {
      revenue += Number(activity.Daily_Sales_Actual) || 0;
    });
    
    months.push({
      month: Utilities.formatDate(monthStart, Session.getScriptTimeZone(), 'MMM yyyy'),
      revenue: revenue
    });
  }
  
  return months;
}

/**
 * Get Market Director Dashboard
 * @param {string} userID - Optional user ID (uses current user if not provided)
 * @return {Object} Dashboard data
 */
function getMarketDirectorDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) throw new Error('User not authenticated');
  
  const markets = getUserMarkets(currentUser.UserID || currentUser.userID);
  
  return {
    user: currentUser,
    markets: markets,
    executiveSummary: getMarketExecutiveSummary(markets),
    regionPerformance: getMarketRegionPerformance(markets),
    trends: getMarketTrends(markets)
  };
}

/**
 * Get user's markets
 * @param {string} userID - User ID
 * @return {Array<string>} Array of Market IDs
 */
function getUserMarkets(userID) {
  const markets = getSheetData(SHEETS.MARKETS);
  return markets.filter(function(market) {
    return market.DirectorUserID === userID;
  }).map(function(market) {
    return market.MarketID;
  });
}

/**
 * Get market executive summary
 * @param {Array<string>} marketIDs - Array of Market IDs
 * @return {Object} Executive summary metrics
 */
function getMarketExecutiveSummary(marketIDs) {
  if (marketIDs.length === 0) return {};
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  const marketSales = salesData.filter(function(activity) {
    const activityDate = new Date(activity.Date);
    return marketIDs.indexOf(activity.MarketID) !== -1 && 
           activityDate >= monthRange.startDate && 
           activityDate <= monthRange.endDate;
  });
  
  var totalRevenue = 0;
  var totalTAP = 0;
  
  marketSales.forEach(function(activity) {
    totalRevenue += Number(activity.Daily_Sales_Actual) || 0;
    totalTAP += Number(activity.TAP_Actual) || 0;
  });
  
  // Get region count
  const regions = getSheetData(SHEETS.REGIONS);
  const regionCount = regions.filter(function(region) {
    return marketIDs.indexOf(region.MarketID) !== -1;
  }).length;
  
  // Get branch count
  const branches = getSheetData(SHEETS.BRANCHES);
  const branchCount = branches.filter(function(branch) {
    const region = regions.find(function(r) { return r.RegionID === branch.RegionID; });
    return region && marketIDs.indexOf(region.MarketID) !== -1;
  }).length;
  
  return {
    monthRevenue: totalRevenue,
    monthTAP: totalTAP,
    regionCount: regionCount,
    branchCount: branchCount
  };
}

/**
 * Get market region performance
 * @param {Array<string>} marketIDs - Array of Market IDs
 * @return {Array<Object>} Region performance data sorted by revenue
 */
function getMarketRegionPerformance(marketIDs) {
  const regions = getSheetData(SHEETS.REGIONS);
  const marketRegions = regions.filter(function(region) {
    return marketIDs.indexOf(region.MarketID) !== -1;
  });
  
  const monthRange = getDateRange('month');
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  return marketRegions.map(function(region) {
    const regionSales = salesData.filter(function(activity) {
      const activityDate = new Date(activity.Date);
      return activity.RegionID === region.RegionID && 
             activityDate >= monthRange.startDate && 
             activityDate <= monthRange.endDate;
    });
    
    var revenue = 0;
    regionSales.forEach(function(activity) {
      revenue += Number(activity.Daily_Sales_Actual) || 0;
    });
    
    return {
      regionName: region.RegionName,
      regionID: region.RegionID,
      monthRevenue: revenue
    };
  }).sort(function(a, b) {
    return b.monthRevenue - a.monthRevenue;
  });
}

/**
 * Get market trends (last 12 months)
 * @param {Array<string>} marketIDs - Array of Market IDs
 * @return {Array<Object>} Monthly trend data
 */
function getMarketTrends(marketIDs) {
  const salesData = getSheetData(SHEETS.SALES_ACTIVITY);
  const now = new Date();
  const months = [];
  
  // Get last 12 months
  for (var i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthSales = salesData.filter(function(activity) {
      const activityDate = new Date(activity.Date);
      return marketIDs.indexOf(activity.MarketID) !== -1 && 
             activityDate >= monthStart && 
             activityDate <= monthEnd;
    });
    
    var revenue = 0;
    monthSales.forEach(function(activity) {
      revenue += Number(activity.Daily_Sales_Actual) || 0;
    });
    
    months.push({
      month: Utilities.formatDate(monthStart, Session.getScriptTimeZone(), 'MMM yyyy'),
      revenue: revenue
    });
  }
  
  return months;
}

/**
 * Export report to CSV
 * @param {string} reportType - Type of report ('sales_activity', 'operations_metrics', 'tracker')
 * @param {Object} params - Optional parameters {startDate, endDate}
 * @return {string} CSV string
 */
function exportReportToCSV(reportType, params) {
  var data = [];
  
  switch(reportType) {
    case 'sales_activity':
      data = getSheetData(SHEETS.SALES_ACTIVITY);
      break;
    case 'operations_metrics':
      data = getSheetData(SHEETS.OPERATIONS_METRICS);
      break;
    case 'tracker':
      data = getSheetData(SHEETS.TRACKER);
      break;
    default:
      throw new Error('Unknown report type: ' + reportType);
  }
  
  // Apply filters if provided
  if (params && params.startDate) {
    data = data.filter(function(row) {
      return new Date(row.Date) >= new Date(params.startDate);
    });
  }
  if (params && params.endDate) {
    data = data.filter(function(row) {
      return new Date(row.Date) <= new Date(params.endDate);
    });
  }
  
  // Convert to CSV
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  var csv = headers.join(',') + '\n';
  
  data.forEach(function(row) {
    const values = headers.map(function(header) {
      var value = row[header];
      if (value === null || value === undefined) return '';
      value = String(value).replace(/"/g, '""');
      return '"' + value + '"';
    });
    csv += values.join(',') + '\n';
  });
  
  return csv;
}

