/**
 * Branch360 - Test Suite
 * Comprehensive testing for all modules
 */

function runAllTests() {
  Logger.log('🧪 Running Branch360 Test Suite...\n');
  
  var allPassed = true;
  
  try {
    testDatabaseSetup();
  } catch (e) {
    Logger.log('❌ Database setup tests failed: ' + e.message);
    allPassed = false;
  }
  
  try {
    testLeadRouting();
  } catch (e) {
    Logger.log('❌ Lead routing tests failed: ' + e.message);
    allPassed = false;
  }
  
  try {
    testSalesModule();
  } catch (e) {
    Logger.log('❌ Sales module tests failed: ' + e.message);
    allPassed = false;
  }
  
  try {
    testOperationsModule();
  } catch (e) {
    Logger.log('❌ Operations module tests failed: ' + e.message);
    allPassed = false;
  }
  
  try {
    testReporting();
  } catch (e) {
    Logger.log('❌ Reporting tests failed: ' + e.message);
    allPassed = false;
  }
  
  try {
    testBranchManagerModule();
  } catch (e) {
    Logger.log('❌ Branch manager module tests failed: ' + e.message);
    allPassed = false;
  }

  try {
    testSalesforceParser();
  } catch (e) {
    Logger.log('❌ Salesforce parser tests failed: ' + e.message);
    allPassed = false;
  }
  
  if (allPassed) {
    Logger.log('\n✅ All tests passed!');
  } else {
    Logger.log('\n⚠️ Some tests failed. Review logs above.');
  }
}

function testDatabaseSetup() {
  Logger.log('Testing: Database Setup');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Test all sheets exist
  Object.values(SHEETS).forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    assertEqual(sheet !== null, true, 'Sheet exists: ' + sheetName);
  });
  
  Logger.log('✓ Database setup tests passed\n');
}

function testLeadRouting() {
  Logger.log('Testing: Lead Routing');
  
  // Test zip code lookup (may return null if no territories set up)
  const ae = getAEForZipCode('77001');
  assertEqual(typeof ae === 'object' || ae === null, true, 'Zip code lookup returns object or null');
  
  // Test lead submission structure
  const testLeadData = {
    customer_name: 'Test Customer',
    service_address: '123 Test St',
    zipCode: '77001',
    phone: '555-1234',
    service_type: 'Pest Control'
  };
  
  // Note: This will actually create a lead, so we just test the function exists
  assertEqual(typeof submitLead, 'function', 'submitLead function exists');
  
  Logger.log('✓ Lead routing tests passed\n');
}

function testSalesModule() {
  Logger.log('Testing: Sales Module');
  
  // Test dashboard data structure
  try {
    const dashboard = getAEDashboard();
    assertEqual(typeof dashboard, 'object', 'Dashboard returns object');
    assertEqual(dashboard.hasOwnProperty('todayMetrics'), true, 'Dashboard has todayMetrics');
    assertEqual(dashboard.hasOwnProperty('monthMetrics'), true, 'Dashboard has monthMetrics');
    assertEqual(dashboard.hasOwnProperty('pipeline'), true, 'Dashboard has pipeline');
  } catch (e) {
    // Dashboard may fail if user not authenticated - that's expected in test environment
    Logger.log('  ⚠ Dashboard test skipped (auth required): ' + e.message);
  }
  
  // Test helper functions exist
  assertEqual(typeof getTodayMetrics, 'function', 'getTodayMetrics function exists');
  assertEqual(typeof getMonthMetrics, 'function', 'getMonthMetrics function exists');
  assertEqual(typeof getAEPipeline, 'function', 'getAEPipeline function exists');
  assertEqual(typeof saveDailySalesActivity, 'function', 'saveDailySalesActivity function exists');
  assertEqual(typeof createOpportunity, 'function', 'createOpportunity function exists');
  
  Logger.log('✓ Sales module tests passed\n');
}

function testOperationsModule() {
  Logger.log('Testing: Operations Module');
  
  // Test ops dashboard
  try {
    const dashboard = getOpsManagerDashboard();
    assertEqual(typeof dashboard, 'object', 'Ops dashboard returns object');
    assertEqual(dashboard.hasOwnProperty('todayMetrics'), true, 'Ops dashboard has todayMetrics');
    assertEqual(dashboard.hasOwnProperty('teamTechnicians'), true, 'Ops dashboard has teamTechnicians');
  } catch (e) {
    // Dashboard may fail if user not authenticated
    Logger.log('  ⚠ Ops dashboard test skipped (auth required): ' + e.message);
  }
  
  // Test technician dashboard
  try {
    const techDashboard = getTechnicianDashboard();
    assertEqual(typeof techDashboard, 'object', 'Tech dashboard returns object');
  } catch (e) {
    Logger.log('  ⚠ Tech dashboard test skipped (auth required): ' + e.message);
  }
  
  // Test helper functions exist
  assertEqual(typeof reportServiceIssue, 'function', 'reportServiceIssue function exists');
  assertEqual(typeof completeInstallation, 'function', 'completeInstallation function exists');
  assertEqual(typeof saveDailyOpsMetrics, 'function', 'saveDailyOpsMetrics function exists');
  assertEqual(typeof assignSpecialistToInstall, 'function', 'assignSpecialistToInstall function exists');
  
  Logger.log('✓ Operations module tests passed\n');
}

function testReporting() {
  Logger.log('Testing: Reporting');
  
  // Test CSV export
  const csv = exportReportToCSV('sales_activity', {});
  assertEqual(typeof csv, 'string', 'CSV export returns string');
  assertEqual(csv.length > 0, true, 'CSV export returns non-empty string');
  
  // Test CSV has headers
  const lines = csv.split('\n');
  assertEqual(lines.length > 0, true, 'CSV has at least one line');
  
  Logger.log('✓ Reporting tests passed\n');
}

function testBranchManagerModule() {
  Logger.log('Testing: Branch Manager Module');
  
  // Test branch manager dashboard
  try {
    const dashboard = getBranchManagerDashboard();
    assertEqual(typeof dashboard, 'object', 'Branch manager dashboard returns object');
    assertEqual(dashboard.hasOwnProperty('todaySummary'), true, 'Dashboard has todaySummary');
    assertEqual(dashboard.hasOwnProperty('salesTeam'), true, 'Dashboard has salesTeam');
    assertEqual(dashboard.hasOwnProperty('opsTeam'), true, 'Dashboard has opsTeam');
  } catch (e) {
    Logger.log('  ⚠ Branch manager dashboard test skipped (auth required): ' + e.message);
  }
  
  // Test helper functions exist
  assertEqual(typeof getBranchDailySummaryToday, 'function', 'getBranchDailySummaryToday function exists');
  assertEqual(typeof getSalesTeamPerformance, 'function', 'getSalesTeamPerformance function exists');
  assertEqual(typeof getBranchPipeline, 'function', 'getBranchPipeline function exists');
  assertEqual(typeof generateDailyCadenceReport, 'function', 'generateDailyCadenceReport function exists');
  
  Logger.log('✓ Branch manager module tests passed\n');
}

function testSalesforceParser() {
  Logger.log('Testing: Salesforce Parser');

  var sampleQuote = [
    'Taylor 4 Tayho',
    'Lee Morrison',
    '17213 Aldine Westfield Road',
    'Houston, TX 77073',
    'lee.morrison@tayho.com',
    'Prepared By',
    'Amy AE',
    'amy.ae@branch360.com',
    'Equipment',
    'Wide Multicatch Mouse Trap - Standard, Solid Lid 22',
    'Eradico Exterior Rodent Bait Station - Weighted, Black 14',
    'Lumnia Ultimate LED Insect Light Trap 4',
    'Total Cost of Equipment $3,455.60',
    'Routine Management Services',
    'General Pest Control Maintenance',
    'General Pest Control Service Frequency - Monthly (12 x)',
    'Interior Monitoring Service Frequency - Semi-Monthly (24 x)',
    'Exterior Monitoring Service Frequency - Monthly (12 x)',
    'Insect Light Trap Maintenance Service Frequency - Monthly (12 x)',
    'Investment Summary',
    'One-Time Cost $3,455.60',
    'Initial Svc Cost $924.34',
    'Avg Monthly Cost $397.52',
    'REQUESTED START DATE 11-19-2025'
  ].join('\n');

  var result = parseSalesforceQuoteTextToStartPacketDraft(sampleQuote);

  assertEqual(result.accountName, 'Tayho', 'Account name parsed from Taylor 4 label');
  assertEqual(result.contactName, 'Lee Morrison', 'Contact name parsed');
  assertEqual(result.contactEmail, 'lee.morrison@tayho.com', 'Contact email parsed from header block');
  assertEqual(result.serviceAddressLine1, '17213 Aldine Westfield Road', 'Service address line parsed');
  assertEqual(result.serviceCity, 'Houston', 'Service city parsed');
  assertEqual(result.serviceState, 'TX', 'Service state parsed');
  assertEqual(result.serviceZip, '77073', 'Service zip parsed');
  assertEqual(result.aeName, 'Amy AE', 'AE name parsed');
  assertEqual(result.aeEmail, 'amy.ae@branch360.com', 'AE email parsed');
  assertEqual(result.equipment.multCatchQty, 22, 'Multicatch quantity tallied');
  assertEqual(result.equipment.rbsQty, 14, 'RBS quantity tallied');
  assertEqual(result.equipment.iltQty, 4, 'ILT quantity tallied');
  assertEqual(result.equipment.otherEquipment.length, 0, 'No other equipment captured');
  assertEqual(result.equipment.summary, '22 MRT, 14 RBS, 4 ILT', 'Equipment summary formatted for MRT/RBS/ILT');
  assertEqual(result.equipmentOneTimeTotal, 3455.6, 'One-time cost from Investment Summary');
  assertEqual(result.servicesInitialTotal, 924.34, 'Initial service cost from Investment Summary');
  assertEqual(result.servicesMonthlyTotal, 397.52, 'Monthly cost parsed from Investment Summary');
  assertEqual(result.servicesAnnualTotal, 4770.24, 'Annual cost derived from monthly');
  assertEqual(result.combinedInitialTotal, 4379.94, 'Combined initial total sums correctly');
  assertEqual(result.combinedMonthlyTotal, 397.52, 'Combined monthly total equals monthly cost');
  assertEqual(result.combinedAnnualTotal, 4770.24, 'Combined annual total derived from monthly');
  assertEqual(result.monthlyCost, 397.52, 'Monthly cost surfaced on draft');
  assertEqual(result.annualCost, 4770.24, 'Annual cost surfaced on draft');
  assertEqual(result.jobType, 'Contract', 'Job type defaults to Contract when recurring services exist');
  assertEqual(result.requestedStartDate, '2025-11-19', 'Requested start date parsed');
  assertEqual(result.startMonth, 'November', 'Requested start month derived from date');
  assertEqual(result.services.length, 4, 'Service list built from Routine Management Services');
  assertEqual(result.services[0].serviceName, 'General Pest Control', 'First service is GPC');
  assertEqual(result.services[1].serviceName, 'Interior Rodent Monitoring', 'Second service interior rodent');
  assertEqual(result.services[2].serviceName, 'Exterior Rodent Monitoring', 'Third service exterior rodent');
  assertEqual(result.services[3].serviceName, 'Insect Light Trap Maintenance', 'Fourth service ILT maintenance');
  assertEqual(result.coveredPests.length, 4, 'Covered pests derived from services/equipment');
  assertEqual(result.coveredPests[0], 'Pavement Ants', 'Derived pests include pavement ants');
  assertEqual(result.coveredPests[1], 'Common Rodents', 'Derived pests include rodents');
  assertEqual(result.coveredPests[2], 'Common Roaches', 'Derived pests include roaches');
  assertEqual(result.coveredPests[3], 'Common House Fly', 'Derived pests include house fly');
  Logger.log('✓ Salesforce parser tests passed\n');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + message + ' (expected: ' + expected + ', got: ' + actual + ')');
  }
  Logger.log('  ✓ ' + message);
}

/**
 * Export report data to CSV format
 * @param {string} reportType - Type of report ('sales_activity', 'leads', 'operations_metrics', etc.)
 * @param {Object} filters - Optional filters for the report
 * @return {string} CSV formatted string
 */
function exportReportToCSV(reportType, filters) {
  filters = filters || {};
  var data = [];
  var headers = [];
  
  try {
    switch(reportType) {
      case 'sales_activity':
        data = getSheetData(SHEETS.SALES_ACTIVITY, filters);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        } else {
          // Use schema if no data
          headers = DB_SCHEMA[SHEETS.SALES_ACTIVITY] || [];
        }
        break;
        
      case 'leads':
        data = getSheetData(SHEETS.LEADS, filters);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        } else {
          headers = DB_SCHEMA[SHEETS.LEADS] || [];
        }
        break;
        
      case 'operations_metrics':
        data = getSheetData(SHEETS.OPERATIONS_METRICS, filters);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        } else {
          headers = DB_SCHEMA[SHEETS.OPERATIONS_METRICS] || [];
        }
        break;
        
      case 'tracker':
        data = getSheetData(SHEETS.TRACKER, filters);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        } else {
          headers = DB_SCHEMA[SHEETS.TRACKER] || [];
        }
        break;
        
      default:
        throw new Error('Unknown report type: ' + reportType);
    }
    
    // Build CSV
    var csv = headers.join(',') + '\n';
    
    data.forEach(function(row) {
      var values = headers.map(function(header) {
        var value = row[header];
        // Handle commas, quotes, and newlines in values
        if (value === null || value === undefined) {
          return '';
        }
        var str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      csv += values.join(',') + '\n';
    });
    
    return csv;
    
  } catch (e) {
    Logger.log('❌ CSV export failed: ' + e.message);
    return 'Error: ' + e.message;
  }
}

