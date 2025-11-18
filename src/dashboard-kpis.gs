/**
 * Branch360 - Unified dashboard KPIs
 */

function getBranchManagerKPIs(filters) {
  const branchId = filters && filters.branchId ? filters.branchId : 'BRN-001';
  const dateFilters = normalizeDateFilters(filters);
  const selectedAE = filters && filters.aeId ? filters.aeId : null;
  const serviceType = filters && filters.serviceType ? String(filters.serviceType).toLowerCase() : '';
  const analytics = getActivityAnalytics({
    branchId: branchId,
    startDate: dateFilters.start.toISOString(),
    endDate: dateFilters.end.toISOString()
  });
  const userAnalytics = {};
  (analytics.rows || []).forEach(function(row) {
    if (row.userId) {
      userAnalytics[row.userId] = row;
    }
  });

  const aes = getSheetData(SHEETS.USERS, { BranchID: branchId }).filter(function(user) {
    return String(user.Role || '').toLowerCase().indexOf('account executive') !== -1 || String(user.Role || '').toLowerCase() === 'ae';
  });

  const rawSales = getUnifiedSales({ branchId: branchId }) || [];
  const unifiedSales = filterByDate(rawSales.filter(function(record) {
    if (!serviceType) return true;
    const label = String(record.ServiceName || record.Service_Type || '').toLowerCase();
    return label.indexOf(serviceType) !== -1;
  }), dateFilters, 'SoldDate');
  const startRecords = unifiedSales.filter(function(record) { return deriveStatusCategory(record.Status) === 'start'; });
  const quoteRecords = unifiedSales.filter(function(record) { return deriveStatusCategory(record.Status) === 'quote'; });

  const aeMetrics = aes.map(function(ae) {
    const aeRecords = unifiedSales.filter(function(record) {
      return recordBelongsToAE(record, ae.UserID);
    });
    const aeQuotes = aeRecords.filter(function(record) { return deriveStatusCategory(record.Status) === 'quote'; });
    const aeStarts = aeRecords.filter(function(record) { return deriveStatusCategory(record.Status) === 'start'; });
    const conversion = aeQuotes.length > 0 ? ((aeStarts.length / aeQuotes.length) * 100) : 0;
    const avgLeadToStart = calculateAverageLeadToStartUnified(aeRecords);
    const totalMonthly = aeStarts.reduce(function(sum, record) {
      return sum + (Number(record.MaintenancePrice) || 0);
    }, 0);
    const totalInitial = aeStarts.reduce(function(sum, record) {
      return sum + (Number(record.InitialPrice) || 0);
    }, 0);

    return {
      name: ae.Name,
      aeId: ae.UserID,
      leads: aeRecords.length,
      quotes: aeQuotes.length,
      starts: aeStarts.length,
      conversion: conversion,
      avgLeadToStart: avgLeadToStart,
      revenueMonthly: totalMonthly,
      revenueInitial: totalInitial,
      hoursSaved: (userAnalytics[ae.UserID] ? userAnalytics[ae.UserID].hoursSaved || 0 : 0),
      dollarsSaved: (userAnalytics[ae.UserID] ? userAnalytics[ae.UserID].dollarsSaved || 0 : 0)
    };
  });

  const opsWorkload = buildOpsWorkload(unifiedSales);

  const branchTotals = startRecords.reduce(function(sum, record) {
    sum.starts += 1;
    sum.revenueMonthly += Number(record.MaintenancePrice) || 0;
    sum.revenueInitial += Number(record.InitialPrice) || 0;
    return sum;
  }, { starts: 0, revenueMonthly: 0, revenueInitial: 0 });
  const branchQuotes = quoteRecords.length || aeMetrics.reduce(function(total, row) { return total + row.quotes; }, 0);
  const branchConversion = branchQuotes > 0 ? ((branchTotals.starts / branchQuotes) * 100) : 0;

  const displayAeTable = aeMetrics.filter(function(row) {
    if (selectedAE && row.aeId !== selectedAE) return false;
    return true;
  });

  return {
    aeTable: displayAeTable,
    opsTable: opsWorkload.rows,
    opsThreshold: opsWorkload.threshold,
    branchCards: {
      starts: branchTotals.starts,
      revenueMonthly: branchTotals.revenueMonthly,
      revenueInitial: branchTotals.revenueInitial,
      quotes: branchQuotes,
      conversion: branchConversion,
      hoursSaved: analytics.totals ? analytics.totals.hoursSaved || 0 : 0,
      dollarsSaved: analytics.totals ? analytics.totals.dollarsSaved || 0 : 0
    },
    analytics: {
      totals: analytics.totals,
      rows: analytics.rows,
      breakdownByRole: analytics.breakdownByRole
    }
  };
}

function buildOpsWorkload(records, tracker) {
  const threshold = 40;
  if (!records || records.length === 0) {
    return { rows: [], threshold: threshold };
  }
  const map = {};
  records.forEach(function(record) {
    const workflow = record.opsWorkflow || {};
    const manager = workflow.OperationsManager || record.Operations_Manager || 'Unassigned';
    if (!map[manager]) {
      map[manager] = { manager: manager, starts: 0, estimatedHours: 0 };
    }
    map[manager].starts += 1;
    const serviceLabel = record.ServiceName || record.Service_Type || record.serviceName || '';
    map[manager].estimatedHours += estimateHoursFromService(serviceLabel);
  });
  const rows = Object.keys(map).map(function(key) {
    const entry = map[key];
    return {
      manager: entry.manager,
      starts: entry.starts,
      estimatedHours: entry.estimatedHours,
      overload: entry.estimatedHours >= threshold
    };
  });
  return { rows: rows, threshold: threshold };
}

function estimateHours(packet) {
  if (!packet) return 0;
  return estimateHoursFromService(packet.Service_Type || packet.serviceType || packet.ServiceName || '');
}

function estimateHoursFromService(serviceLabel) {
  const service = String(serviceLabel || '').toLowerCase();
  var base = 3;
  if (service.indexOf('rodent') !== -1) base = 4;
  if (service.indexOf('mosquito') !== -1) base = 2;
  if (service.indexOf('fly') !== -1) base = 2.5;
  if (service.indexOf('termite') !== -1) base = 5;
  return base;
}

function calculateAverageLeadToStart(packets, tracker) {
  if (packets.length === 0) return 0;
  var totalDays = 0;
  var counted = 0;
  packets.forEach(function(packet) {
    const record = tracker.find(function(t) { return t.EntryID === packet.TrackerEntryID; });
    if (record && record.Date_Proposal && packet.Sold_Date) {
      const start = new Date(record.Date_Proposal);
      const sold = new Date(packet.Sold_Date);
      const diff = (sold - start) / 86400000;
      totalDays += diff;
      counted++;
    }
  });
  return counted > 0 ? totalDays / counted : 0;
}

function calculateAverageLeadToStartUnified(records) {
  if (!records || records.length === 0) return 0;
  var totalDays = 0;
  var counted = 0;
  records.forEach(function(record) {
    const created = record.CreatedOn ? new Date(record.CreatedOn) : null;
    const sold = record.SoldDate ? new Date(record.SoldDate) : null;
    if (created && sold) {
      totalDays += (sold - created) / 86400000;
      counted++;
    }
  });
  return counted > 0 ? totalDays / counted : 0;
}

function normalizeDateFilters(filters) {
  const now = new Date();
  const start = filters && filters.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = filters && filters.endDate ? new Date(filters.endDate) : now;
  return { start: start, end: end };
}

function filterByDate(rows, dateFilters, column) {
  return rows.filter(function(row) {
    const value = row[column];
    if (!value) return false;
    const date = new Date(value);
    if (dateFilters && dateFilters.start && date < dateFilters.start) return false;
    if (dateFilters && dateFilters.end && date > dateFilters.end) return false;
    return true;
  });
}

function getMarketDirectorKPIs(filters) {
  const branchId = filters && filters.branchId ? filters.branchId : 'BRN-001';
  const branchData = getBranchManagerKPIs(filters);
  const trend = buildStartTrend(branchId, 12);
  return {
    branchCards: branchData.branchCards,
    trend: trend,
    aeTable: branchData.aeTable.map(function(row) {
      return {
        name: row.name,
        starts: row.starts,
        conversion: row.conversion,
        avgLeadToStart: row.avgLeadToStart,
        hoursSaved: row.hoursSaved || 0,
        dollarsSaved: row.dollarsSaved || 0
      };
    })
  };
}

function buildStartTrend(branchId, weeks) {
  const sales = getUnifiedSales({ branchId: branchId });
  const weekly = {};
  sales.forEach(function(record) {
    if (!record.SoldDate || deriveStatusCategory(record.Status) !== 'start') return;
    const week = formatWeek(record.SoldDate);
    if (!weekly[week]) {
      weekly[week] = 0;
    }
    weekly[week] += 1;
  });
  return Object.keys(weekly).sort().slice(-weeks).map(function(key) {
    return { week: key, starts: weekly[key] };
  });
}

function recordBelongsToAE(record, aeId) {
  if (!aeId) return false;
  const reps = String(record.SalesRepIDs || '').split('|').map(function(rep) { return rep.trim().toLowerCase(); }).filter(Boolean);
  if (reps.indexOf(String(aeId).toLowerCase()) !== -1) return true;
  if (String(record.AE_UserID || '').toLowerCase() === String(aeId).toLowerCase()) return true;
  return false;
}

function deriveStatusCategory(status) {
  const value = String(status || '').toLowerCase();
  if (!value) return 'lead';
  if (value.indexOf('proposal') !== -1 || value.indexOf('negotiation') !== -1 || value.indexOf('quote') !== -1) {
    return 'quote';
  }
  if (value.indexOf('sold') !== -1 || value.indexOf('new sale') !== -1 || value.indexOf('converted') !== -1 || value.indexOf('start') !== -1) {
    return 'start';
  }
  return 'lead';
}

function getHoursSavedForUser(userId) {
  const logs = getSheetData(SHEETS.ACTIVITY_LOG, { UserID: userId });
  const seconds = logs.reduce(function(sum, log) { return sum + (Number(log.TimeSavedSeconds) || 0); }, 0);
  return seconds / 3600;
}

function exportBranchReport(filters) {
  filters = filters || {};
  const branchId = filters.branchId || 'BRN-001';
  const kpis = getBranchManagerKPIs(filters);
  const analytics = getActivityAnalytics(filters);
  const now = new Date();
  const lines = [];
  lines.push('Branch360 - Branch Report');
  lines.push('Branch: ' + branchId);
  if (filters.startDate && filters.endDate) {
    lines.push('Range: ' + filters.startDate + ' to ' + filters.endDate);
  }
  lines.push('Generated: ' + now.toISOString());
  lines.push('');
  lines.push('Cards');
  lines.push('New Starts: ' + kpis.branchCards.starts);
  lines.push('Monthly Revenue: ' + kpis.branchCards.revenueMonthly);
  lines.push('Initial Revenue: ' + kpis.branchCards.revenueInitial);
  lines.push('Quotes: ' + kpis.branchCards.quotes);
  lines.push('Conversion %: ' + kpis.branchCards.conversion);
  lines.push('Hours Saved: ' + (analytics.totals.hoursSaved || 0).toFixed(1));
  lines.push('');
  lines.push('Activity Summary');
  analytics.breakdownByRole.forEach(function(row) {
    lines.push(row.role + ': ' + row.hoursSaved.toFixed(1) + ' hrs');
  });
  lines.push('');
  lines.push('AE Performance');
  kpis.aeTable.forEach(function(row) {
    lines.push(row.name + ' - Leads: ' + row.leads + ', Quotes: ' + row.quotes + ', Starts: ' + row.starts + ', Conversion: ' + row.conversion.toFixed(1) + '%');
  });
  logServerActivity('BM_EXPORT_REPORT', branchId, filters);
  const fileName = 'branch-report-' + branchId + '-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd') + '.txt';
  return {
    success: true,
    content: lines.join('\n'),
    fileName: fileName
  };
}

function getTerritoryProspects(filters) {
  const branchId = filters && filters.branchId ? filters.branchId : 'BRN-001';
  const territories = getSheetData(SHEETS.TERRITORIES).filter(function(territory) {
    return !territory.BranchID || territory.BranchID === branchId;
  });
  const users = getSheetData(SHEETS.USERS);
  const userMap = {};
  users.forEach(function(user) {
    userMap[user.UserID] = user;
  });
  const leads = getSheetData(SHEETS.LEADS);
  const territoryRows = territories.map(function(territory, index) {
    const ae = userMap[territory.AE_UserID] || {};
    const zipList = String(territory.ZipCodes || '').split('|').filter(Boolean);
    const territoryProspects = leads.filter(function(lead) {
      return zipList.indexOf(lead.ZipCode) !== -1;
    });
    return {
      id: territory.TerritoryID,
      name: territory.TerritoryName || ('Territory ' + (index + 1)),
      aeName: ae.Name || 'Unassigned',
      aeEmail: ae.Email || '',
      zipCount: zipList.length,
      totalProspects: territoryProspects.length,
      zipCodes: zipList
    };
  });
  const prospects = leads.filter(function(lead) {
    return !filters || !filters.zipFilter || filters.zipFilter.indexOf(lead.ZipCode) !== -1;
  }).map(function(lead) {
    return {
      customer: lead.Customer_Name,
      address: lead.Service_Address,
      status: lead.Status,
      zipCode: lead.ZipCode,
      serviceType: lead.Service_Type,
      phone: lead.Phone,
      date: lead.Date
    };
  });
  return {
    territories: territoryRows,
    prospects: prospects
  };
}

function getOpsTimeline(filters) {
  filters = filters || {};
  const branchId = filters.branchId || 'BRN-001';
  const packets = getSheetData(SHEETS.START_PACKETS).filter(function(packet) {
    return !packet.BranchID || packet.BranchID === branchId;
  });
  const tracker = getSheetData(SHEETS.TRACKER);
  const trackerMap = {};
  tracker.forEach(function(entry) { trackerMap[entry.EntryID] = entry; });
  const events = [];
  packets.forEach(function(packet) {
    const trackerEntry = trackerMap[packet.TrackerEntryID] || {};
    if (packet.Sold_Date) {
      events.push({
        packetID: packet.PacketID,
        label: 'Sold Opportunity',
        date: packet.Sold_Date,
        account: packet.Account_Name,
        status: 'Sold'
      });
    }
    if (packet.CreatedOn) {
      events.push({
        packetID: packet.PacketID,
        label: 'Packet Drafted',
        date: packet.CreatedOn,
        account: packet.Account_Name,
        status: packet.Status || 'Draft'
      });
    }
    if (packet.Status === 'Submitted') {
      events.push({
        packetID: packet.PacketID,
        label: 'Packet Submitted',
        date: packet.UpdatedOn || packet.CreatedOn,
        account: packet.Account_Name,
        status: 'Submitted'
      });
    }
    if (packet.Status_Install_Complete) {
      events.push({
        packetID: packet.PacketID,
        label: 'Install Complete',
        date: packet.Confirmed_Start_Date || packet.Date_Install_Scheduled,
        account: packet.Account_Name,
        status: 'Completed'
      });
    }
  });
  events.sort(function(a, b) {
    return new Date(a.date || 0) - new Date(b.date || 0);
  });
  return events;
}

function getSalesOpsHandoffQueue(filters) {
  filters = filters || {};
  const branchId = filters.branchId || 'BRN-001';
  const tracker = getSheetData(SHEETS.TRACKER).filter(function(entry) {
    return entry.BranchID === branchId && entry.Stage === 'Sold';
  });
  const packets = getSheetData(SHEETS.START_PACKETS);
  const packetMap = {};
  packets.forEach(function(packet) {
    packetMap[packet.TrackerEntryID] = packet;
  });
  return tracker.map(function(entry) {
    const packet = packetMap[entry.EntryID];
    return {
      trackerEntryID: entry.EntryID,
      customer: entry.Customer_Name,
      address: entry.Service_Address,
      aeName: entry.AE_UserID,
      soldDate: entry.Date_Sold,
      packetStatus: packet ? (packet.Status || 'Draft') : 'Not Created'
    };
  }).filter(function(item) {
    return item.packetStatus !== 'Submitted';
  });
}
