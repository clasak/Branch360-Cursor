/**
 * Branch360 - Sales Module
 * AE dashboard, pipeline management, and sales tracking
 */

/**
 * Get AE Dashboard Overview
 * @param {string} userID - AE User ID (optional, uses current user if not provided)
 * @return {Object} Dashboard data
 */
function getAEDashboard(userID) {
  const currentUser = userID ? findRowByID(SHEETS.USERS, 'UserID', userID) : getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const dateRange = getDateRange('today');
  const monthRange = getDateRange('month');
  
  return {
    user: {
      name: currentUser.Name || currentUser.name,
      email: currentUser.Email || currentUser.email,
      branchID: currentUser.BranchID || currentUser.branchID
    },
    todayMetrics: getTodayMetrics(currentUser.UserID || currentUser.userID),
    monthMetrics: getMonthMetrics(currentUser.UserID || currentUser.userID),
    pipeline: getAEPipeline(currentUser.UserID || currentUser.userID),
    newLeads: getMyLeads(currentUser.UserID || currentUser.userID, 'New'), // From Agent 2
    recentActivity: getRecentActivity(currentUser.UserID || currentUser.userID),
    upcomingTasks: getUpcomingTasks(currentUser.UserID || currentUser.userID)
  };
}

/**
 * Get today's metrics for AE
 */
function getTodayMetrics(aeUserID) {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  // Get today's sales activity entry
  const activityData = getSheetData(SHEETS.SALES_ACTIVITY);
  const todayActivity = activityData.find(function(row) {
    const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return rowDate === todayStr && row.AE_UserID === aeUserID;
  });
  
  if (todayActivity) {
    return {
      tapGoal: todayActivity.TAP_Goal || 10,
      tapActual: todayActivity.TAP_Actual || 0,
      appointmentsSet: todayActivity.Appointments_Set || 0,
      appointmentsCompleted: todayActivity.Appointments_Completed || 0,
      quotesCreated: todayActivity.Quotes_Created || 0,
      quotesWon: todayActivity.Quotes_Won || 0,
      salesGoal: todayActivity.Daily_Sales_Goal || 5000,
      salesActual: todayActivity.Daily_Sales_Actual || 0,
      hasEntry: true
    };
  }
  
  // No entry yet, return default goals
  return {
    tapGoal: 10,
    tapActual: 0,
    appointmentsSet: 0,
    appointmentsCompleted: 0,
    quotesCreated: 0,
    quotesWon: 0,
    salesGoal: 5000,
    salesActual: 0,
    hasEntry: false
  };
}

/**
 * Get month-to-date metrics for AE
 */
function getMonthMetrics(aeUserID) {
  const monthRange = getDateRange('month');
  const activityData = getSheetData(SHEETS.SALES_ACTIVITY);
  
  const monthActivities = activityData.filter(function(row) {
    const rowDate = new Date(row.Date);
    return rowDate >= monthRange.startDate && 
           rowDate <= monthRange.endDate && 
           row.AE_UserID === aeUserID;
  });
  
  var totalTAP = 0;
  var totalAppointments = 0;
  var totalQuotes = 0;
  var totalSales = 0;
  var totalQuotesWon = 0;
  
  monthActivities.forEach(function(activity) {
    totalTAP += Number(activity.TAP_Actual) || 0;
    totalAppointments += Number(activity.Appointments_Completed) || 0;
    totalQuotes += Number(activity.Quotes_Created) || 0;
    totalQuotesWon += Number(activity.Quotes_Won) || 0;
    totalSales += Number(activity.Daily_Sales_Actual) || 0;
  });
  
  return {
    totalTAP: totalTAP,
    totalAppointments: totalAppointments,
    totalQuotes: totalQuotes,
    totalQuotesWon: totalQuotesWon,
    totalSales: totalSales,
    winRate: totalQuotes > 0 ? ((totalQuotesWon / totalQuotes) * 100).toFixed(1) : 0,
    daysActive: monthActivities.length
  };
}

/**
 * Get AE's sales pipeline
 */
function getAEPipeline(aeUserID) {
  const trackerData = getSheetData(SHEETS.TRACKER, { AE_UserID: aeUserID });
  
  // Group by stage
  const pipeline = {
    proposal: [],
    negotiation: [],
    sold: [],
    onHold: []
  };
  
  trackerData.forEach(function(entry) {
    const stage = String(entry.Stage || '').toLowerCase();
    const status = String(entry.Status || '').toLowerCase();
    
    // Only include active opportunities
    if (status !== 'dead' && status !== 'inactive') {
      const opportunity = {
        entryID: entry.EntryID,
        customer: entry.Customer_Name,
        address: entry.Service_Address,
        value: entry.Annual_Value || 0,
        stage: entry.Stage,
        dateProposal: entry.Date_Proposal,
        pocName: entry.POC_Name,
        pocPhone: entry.POC_Phone,
        pocEmail: entry.POC_Email,
        notes: entry.Notes
      };
      
      if (stage === 'proposal') {
        pipeline.proposal.push(opportunity);
      } else if (stage === 'negotiation') {
        pipeline.negotiation.push(opportunity);
      } else if (stage === 'sold') {
        pipeline.sold.push(opportunity);
      } else if (stage === 'on hold') {
        pipeline.onHold.push(opportunity);
      }
    }
  });
  
  // Calculate pipeline value
  const totalValue = trackerData.reduce(function(sum, entry) {
    const status = String(entry.Status || '').toLowerCase();
    return status !== 'dead' ? sum + (Number(entry.Annual_Value) || 0) : sum;
  }, 0);
  
  return {
    stages: pipeline,
    totalValue: totalValue,
    totalOpportunities: trackerData.length
  };
}

/**
 * Get recent activity for AE
 */
function getRecentActivity(aeUserID) {
  const trackerData = getSheetData(SHEETS.TRACKER, { AE_UserID: aeUserID });
  
  // Sort by most recent
  trackerData.sort(function(a, b) {
    return new Date(b.UpdatedOn || b.CreatedOn) - new Date(a.UpdatedOn || a.CreatedOn);
  });
  
  return trackerData.slice(0, 10).map(function(entry) {
    return {
      entryID: entry.EntryID,
      customer: entry.Customer_Name,
      action: getLastAction(entry),
      date: entry.UpdatedOn || entry.CreatedOn,
      stage: entry.Stage
    };
  });
}

/**
 * Helper: Determine last action on opportunity
 */
function getLastAction(entry) {
  if (entry.Date_Sold) return 'Won';
  if (entry.Date_Dead) return 'Lost';
  if (entry.Stage === 'Proposal') return 'Proposal Sent';
  if (entry.Stage === 'Negotiation') return 'In Negotiation';
  return 'Updated';
}

/**
 * Get upcoming tasks/appointments
 */
function getUpcomingTasks(aeUserID) {
  // TODO: Integrate with calendar when available
  // For now, return opportunities that need follow-up
  const trackerData = getSheetData(SHEETS.TRACKER, { AE_UserID: aeUserID });
  const now = new Date();
  
  return trackerData
    .filter(function(entry) {
      const stage = String(entry.Stage || '').toLowerCase();
      const status = String(entry.Status || '').toLowerCase();
      const proposalDate = entry.Date_Proposal ? new Date(entry.Date_Proposal) : null;
      
      // Proposals older than 7 days need follow-up
      if (stage === 'proposal' && status === 'active' && proposalDate) {
        const daysSince = (now - proposalDate) / (1000 * 60 * 60 * 24);
        return daysSince >= 7;
      }
      
      return false;
    })
    .slice(0, 5)
    .map(function(entry) {
      return {
        entryID: entry.EntryID,
        customer: entry.Customer_Name,
        task: 'Follow up on proposal',
        daysOverdue: Math.floor((now - new Date(entry.Date_Proposal)) / (1000 * 60 * 60 * 24)) - 7
      };
    });
}

/**
 * Save daily sales activity entry
 */
function saveDailySalesActivity(activityData) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Check if entry already exists for today
    const existingData = getSheetData(SHEETS.SALES_ACTIVITY);
    const existingEntry = existingData.find(function(row) {
      const rowDate = Utilities.formatDate(new Date(row.Date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return rowDate === todayStr && row.AE_UserID === currentUser.userID;
    });
    
    const hierarchy = getBranchHierarchy(currentUser.branchID);
    
    if (existingEntry) {
      // Update existing entry
      updateRowByID(SHEETS.SALES_ACTIVITY, 'ActivityID', existingEntry.ActivityID, {
        'TAP_Goal': activityData.tapGoal || 10,
        'TAP_Actual': activityData.tapActual || 0,
        'Appointments_Set': activityData.appointmentsSet || 0,
        'Appointments_Completed': activityData.appointmentsCompleted || 0,
        'Quotes_Created': activityData.quotesCreated || 0,
        'Quotes_Won': activityData.quotesWon || 0,
        'Quote_Value': activityData.quoteValue || 0,
        'WinRate_Percent': activityData.quotesCreated > 0 ? 
          ((activityData.quotesWon / activityData.quotesCreated) * 100).toFixed(1) : 0,
        'Daily_Sales_Goal': activityData.salesGoal || 5000,
        'Daily_Sales_Actual': activityData.salesActual || 0
      });
      
      logAudit('UPDATE_SALES_ACTIVITY', SHEETS.SALES_ACTIVITY, existingEntry.ActivityID, 
        'Updated daily activity');
      
      return { success: true, activityID: existingEntry.ActivityID, updated: true };
      
    } else {
      // Create new entry
      const activityID = generateUniqueID('ACT');
      const activitySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SALES_ACTIVITY);
      
      activitySheet.appendRow([
        activityID,
        today,
        currentUser.userID,
        currentUser.branchID,
        hierarchy.region ? hierarchy.region.RegionID : '',
        hierarchy.market ? hierarchy.market.MarketID : '',
        activityData.tapGoal || 10,
        activityData.tapActual || 0,
        activityData.appointmentsSet || 0,
        activityData.appointmentsCompleted || 0,
        activityData.quotesCreated || 0,
        activityData.quotesWon || 0,
        activityData.quoteValue || 0,
        activityData.quotesCreated > 0 ? 
          ((activityData.quotesWon / activityData.quotesCreated) * 100).toFixed(1) : 0,
        activityData.salesGoal || 5000,
        activityData.salesActual || 0,
        new Date(),
        new Date()
      ]);
      
      logAudit('CREATE_SALES_ACTIVITY', SHEETS.SALES_ACTIVITY, activityID, 
        'Created daily activity');
      
      return { success: true, activityID: activityID, updated: false };
    }
    
  } catch (e) {
    Logger.log('❌ Save sales activity failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Create new opportunity in tracker
 */
function createOpportunity(opportunityData) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');
    
    const entryID = generateUniqueID('TRK');
    const trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TRACKER);
    
    trackerSheet.appendRow([
      entryID,
      new Date(),
      currentUser.userID,
      currentUser.branchID,
      opportunityData.stage || 'Proposal',
      opportunityData.customerName,
      opportunityData.serviceAddress,
      opportunityData.zipCode || '',
      opportunityData.pocName || opportunityData.customerName,
      opportunityData.pocPhone || '',
      opportunityData.pocEmail || '',
      opportunityData.source || 'Direct',
      opportunityData.saleType || 'New Business',
      opportunityData.serviceDescription || '',
      opportunityData.initialFee || 0,
      opportunityData.monthlyFee || 0,
      opportunityData.frequency || 12,
      opportunityData.annualValue || 0,
      opportunityData.pestPacID || '',
      new Date(), // Date_Proposal
      null, // Date_Sold
      null, // Date_Dead
      'Active',
      opportunityData.notes || '',
      new Date(),
      new Date()
    ]);
    
    logAudit('CREATE_OPPORTUNITY', SHEETS.TRACKER, entryID, 
      'Created opportunity for ' + opportunityData.customerName);
    
    return { success: true, entryID: entryID };
    
  } catch (e) {
    Logger.log('❌ Create opportunity failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Update opportunity stage
 */
function updateOpportunityStage(entryID, newStage, notes) {
  try {
    const updates = { 'Stage': newStage };
    
    if (newStage === 'Sold') {
      updates['Date_Sold'] = new Date();
      updates['Status'] = 'Sold';
    } else if (newStage === 'Dead') {
      updates['Date_Dead'] = new Date();
      updates['Status'] = 'Dead';
    }
    
    if (notes) {
      const existing = findRowByID(SHEETS.TRACKER, 'EntryID', entryID);
      updates['Notes'] = (existing.Notes || '') + '\n' + new Date().toLocaleDateString() + ': ' + notes;
    }
    
    const success = updateRowByID(SHEETS.TRACKER, 'EntryID', entryID, updates);
    
    if (success) {
      logAudit('UPDATE_STAGE', SHEETS.TRACKER, entryID, 'Stage changed to: ' + newStage);
      
      // If sold, create start packet
      if (newStage === 'Sold') {
        createStartPacket(entryID);
      }
    }
    
    return { success: success };
    
  } catch (e) {
    Logger.log('❌ Update stage failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Create start packet when opportunity is sold
 */
function createStartPacket(trackerEntryID) {
  try {
    const entry = findRowByID(SHEETS.TRACKER, 'EntryID', trackerEntryID);
    if (!entry) throw new Error('Tracker entry not found');
    
    const packetID = generateUniqueID('PKT');
    const packetsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.START_PACKETS);
    
    const ae = findRowByID(SHEETS.USERS, 'UserID', entry.AE_UserID);
    
    packetsSheet.appendRow([
      packetID,
      trackerEntryID,
      entry.Date_Sold || new Date(),
      entry.Customer_Name,
      entry.Service_Address,
      ae ? ae.Name : '',
      entry.Initial_Fee || 0,
      entry.Monthly_Fee || 0,
      entry.Service_Description || '',
      entry.Frequency || 12,
      '', // Operations_Manager (to be assigned)
      '', // Assigned_Specialist (to be assigned)
      null, // Date_Install_Scheduled
      false, // Status_Install_Complete
      false, // Materials_Ordered
      false, // Log_Book_Needed
      entry.POC_Name + ' / ' + entry.POC_Phone,
      null, // Confirmed_Start_Date
      entry.Notes || '',
      entry.PestPac_ID || '',
      new Date(),
      new Date()
    ]);
    
    logAudit('CREATE_START_PACKET', SHEETS.START_PACKETS, packetID, 
      'Auto-created from sold opportunity: ' + trackerEntryID);
    
    return { success: true, packetID: packetID };
    
  } catch (e) {
    Logger.log('⚠ Start packet creation failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Search opportunities
 */
function searchOpportunities(searchTerm, filters) {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  
  var data = getSheetData(SHEETS.TRACKER, { AE_UserID: currentUser.userID });
  
  // Apply search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    data = data.filter(function(entry) {
      return (entry.Customer_Name || '').toLowerCase().includes(term) ||
             (entry.Service_Address || '').toLowerCase().includes(term) ||
             (entry.POC_Name || '').toLowerCase().includes(term) ||
             (entry.EntryID || '').toLowerCase().includes(term);
    });
  }
  
  // Apply filters
  if (filters) {
    if (filters.stage) {
      data = data.filter(function(entry) {
        return entry.Stage === filters.stage;
      });
    }
    if (filters.dateFrom) {
      data = data.filter(function(entry) {
        return new Date(entry.Date) >= new Date(filters.dateFrom);
      });
    }
    if (filters.dateTo) {
      data = data.filter(function(entry) {
        return new Date(entry.Date) <= new Date(filters.dateTo);
      });
    }
  }
  
  return data;
}

