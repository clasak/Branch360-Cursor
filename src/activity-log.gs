/**
 * Branch360 - Activity Log & Time Saved utilities
 * Tracks key workflows and computes automation savings
 */

const ACTIVITY_BASELINES = {
  'CREATE_LEAD': 240,
  'UPDATE_LEAD': 180,
  'CREATE_QUOTE': 540,
  'UPDATE_QUOTE': 360,
  'CREATE_START_PACKET': 1500,
  'OPS_CREATE_START_PACKET': 1500,
  'OPS_ASSIGN_TECH': 240,
  'OPS_RESOLVE_ISSUE': 300,
  'TECH_COMPLETE_INSTALL': 420,
  'BM_EXPORT_REPORT': 1200,
  'AE_MARK_CONTACTED': 120,
  'AE_CONVERT_LEAD': 240,
  'AE_CREATE_QUOTE': 540,
  'AE_IMPORT_SF_QUOTE': 900,
  'OPS_IMPORT_SF_QUOTE': 900
};

const ROLE_RATES = {
  'Account Executive': 50,
  'AE': 50,
  'Technician': 35,
  'Operations Manager': 55,
  'Ops Manager': 55,
  'Branch Manager': 70,
  'Regional Director': 80,
  'Market Director': 90,
  'Administrator': 75,
  'Executive': 95
};

/**
 * Records a completed activity with timestamps from the client.
 * @param {Object} payload activity payload
 */
function recordActivity(payload) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ACTIVITY_LOG);
  if (!sheet) {
    throw new Error('ActivityLog sheet missing. Run setupDatabase().');
  }

  const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();
  const completedAt = payload.completedAt ? new Date(payload.completedAt) : new Date();
  const durationSeconds = payload.durationSeconds !== undefined && payload.durationSeconds !== null ? Number(payload.durationSeconds) : Math.max(0, (completedAt - startedAt) / 1000);
  const baseline = ACTIVITY_BASELINES[payload.actionType] || 0;
  const timeSavedSeconds = Math.max(baseline - durationSeconds, 0);

  const activityId = generateUniqueID('ACTLOG');
  const row = [
    activityId,
    user.userID,
    user.role,
    user.branchID,
    payload.actionType,
    payload.contextId || '',
    startedAt,
    completedAt,
    durationSeconds,
    timeSavedSeconds,
    payload.meta ? JSON.stringify(payload.meta) : '',
    payload.environment || 'Live'
  ];

  sheet.appendRow(row);
  logAudit('LOG_ACTIVITY', SHEETS.ACTIVITY_LOG, activityId, payload.actionType);

  return {
    activityId: activityId,
    durationSeconds: durationSeconds,
    timeSavedSeconds: timeSavedSeconds
  };
}

/**
 * Helper for server-side flows when work is fully automated.
 */
function logServerActivity(actionType, contextId, meta, durationSeconds) {
  return recordActivity({
    actionType: actionType,
    contextId: contextId,
    meta: Object.assign({ automated: true }, meta || {}),
    durationSeconds: durationSeconds || 0,
    startedAt: new Date(),
    completedAt: new Date()
  });
}

/**
 * Returns aggregated activity metrics for analytics panel.
 * @param {Object} filters filter object (branchId, role, startDate, endDate)
 */
function getActivityAnalytics(filters) {
  const data = getSheetData(SHEETS.ACTIVITY_LOG);
  const start = filters && filters.startDate ? new Date(filters.startDate) : null;
  const end = filters && filters.endDate ? new Date(filters.endDate) : null;
  const branchId = filters && filters.branchId ? filters.branchId : null;
  const roleFilter = filters && filters.role ? filters.role : null;
  const userFilter = filters && filters.userId ? filters.userId : null;

  const filtered = data.filter(function(activity) {
    if (branchId && activity.BranchID !== branchId) return false;
    if (roleFilter && activity.Role !== roleFilter) return false;
    if (userFilter && activity.UserID !== userFilter) return false;
    const started = activity.StartedAt ? new Date(activity.StartedAt) : null;
    if (start && started && started < start) return false;
    if (end && started && started > end) return false;
    return true;
  });

  const userMap = {};
  const weeklyMap = {};
  const roleMap = {};
  const actionMap = {};
  var totals = {
    totalSecondsSaved: 0,
    totalSecondsSpent: 0,
    aeSecondsSaved: 0,
    opsSecondsSaved: 0,
    branchMgrSecondsSaved: 0
  };

  filtered.forEach(function(activity) {
    const userId = activity.UserID || 'UNKNOWN';
    if (!userMap[userId]) {
      userMap[userId] = {
        userId: userId,
        role: activity.Role,
        name: getUserName(userId),
        activities: 0,
        durationSeconds: 0,
        timeSavedSeconds: 0
      };
    }

    const entry = userMap[userId];
    entry.activities += 1;
    entry.durationSeconds += Number(activity.DurationSeconds) || 0;
    entry.timeSavedSeconds += Number(activity.TimeSavedSeconds) || 0;

    totals.totalSecondsSpent += Number(activity.DurationSeconds) || 0;
    totals.totalSecondsSaved += Number(activity.TimeSavedSeconds) || 0;

    if (/Account Executive|AE/i.test(activity.Role || '')) {
      totals.aeSecondsSaved += Number(activity.TimeSavedSeconds) || 0;
    } else if (/Ops|Operations/i.test(activity.Role || '')) {
      totals.opsSecondsSaved += Number(activity.TimeSavedSeconds) || 0;
    } else if (/Branch Manager/i.test(activity.Role || '')) {
      totals.branchMgrSecondsSaved += Number(activity.TimeSavedSeconds) || 0;
    }

    const weekKey = formatWeek(activity.StartedAt);
    if (!weeklyMap[weekKey]) {
      weeklyMap[weekKey] = 0;
    }
    weeklyMap[weekKey] += Number(activity.TimeSavedSeconds) || 0;

    const roleKey = activity.Role || 'Unknown';
    if (!roleMap[roleKey]) {
      roleMap[roleKey] = {
        role: roleKey,
        secondsSaved: 0,
        activities: 0
      };
    }
    roleMap[roleKey].secondsSaved += Number(activity.TimeSavedSeconds) || 0;
    roleMap[roleKey].activities += 1;

    const actionKey = activity.ActionType || 'Other';
    if (!actionMap[actionKey]) {
      actionMap[actionKey] = {
        actionType: actionKey,
        secondsSaved: 0,
        activities: 0
      };
    }
    actionMap[actionKey].secondsSaved += Number(activity.TimeSavedSeconds) || 0;
    actionMap[actionKey].activities += 1;
  });

  const weeklySeries = Object.keys(weeklyMap).sort().map(function(key) {
    return {
      week: key,
      hoursSaved: (weeklyMap[key] / 3600)
    };
  });

  const userRows = Object.keys(userMap).map(function(userId) {
    const entry = userMap[userId];
    const hoursSaved = entry.timeSavedSeconds / 3600;
    const hoursSpent = entry.durationSeconds / 3600;
    const loadedRate = ROLE_RATES[entry.role] || 50;
    return {
      userId: userId,
      name: entry.name,
      role: entry.role,
      activities: entry.activities,
      hoursSpent: hoursSpent,
      hoursSaved: hoursSaved,
      dollarsSaved: hoursSaved * loadedRate,
      avgDurationMinutes: entry.activities > 0 ? (entry.durationSeconds / entry.activities) / 60 : 0
    };
  });

  return {
    totals: {
      hoursSaved: totals.totalSecondsSaved / 3600,
      hoursSpent: totals.totalSecondsSpent / 3600,
      hoursSavedAE: totals.aeSecondsSaved / 3600,
      hoursSavedOps: totals.opsSecondsSaved / 3600,
      hoursSavedBranch: totals.branchMgrSecondsSaved / 3600,
      dollarsSaved: userRows.reduce(function(sum, row) { return sum + row.dollarsSaved; }, 0)
    },
    weekly: weeklySeries,
    rows: userRows,
    breakdownByRole: Object.keys(roleMap).map(function(role) {
      return {
        role: role,
        hoursSaved: (roleMap[role].secondsSaved || 0) / 3600,
        activities: roleMap[role].activities
      };
    }),
    breakdownByAction: Object.keys(actionMap).map(function(key) {
      return {
        actionType: key,
        hoursSaved: (actionMap[key].secondsSaved || 0) / 3600,
        activities: actionMap[key].activities
      };
    })
  };
}

function getUserName(userId) {
  if (!userId) return 'Unknown';
  const user = findRowByID(SHEETS.USERS, 'UserID', userId);
  return user ? user.Name : 'Unknown';
}

function formatWeek(dateValue) {
  if (!dateValue) return 'Unknown';
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const pastDays = Math.floor((date - firstDay) / 86400000);
  const week = Math.floor((pastDays + firstDay.getUTCDay()) / 7) + 1;
  return year + '-W' + ('0' + week).slice(-2);
}

function getMyTimeSavedSummary(filters) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  filters = filters || {};
  filters.userId = user.userID || user.UserID;
  const analytics = getActivityAnalytics(filters);
  const row = analytics.rows.find(function(entry) {
    return entry.userId === (user.userID || user.UserID);
  });
  return {
    user: row || {
      userId: user.userID || user.UserID,
      name: user.name || user.Name,
      role: user.role || user.Role,
      activities: 0,
      hoursSaved: 0,
      hoursSpent: 0,
      dollarsSaved: 0,
      avgDurationMinutes: 0
    },
    totals: analytics.totals
  };
}
