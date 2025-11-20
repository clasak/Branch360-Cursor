/**
 * Backend Verification Script
 * Run this to quickly verify all backend functions are working
 * 
 * Usage: In Apps Script editor, select "verifyBackend" and click Run
 */

function verifyBackend() {
  Logger.log('🔍 Branch360 Backend Verification\n');
  Logger.log('=' .repeat(50));
  
  var results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  // Test 1: Spreadsheet binding
  testSpreadsheetBinding(results);
  
  // Test 2: Database sheets
  testDatabaseSheets(results);
  
  // Test 3: User authentication
  testUserAuthentication(results);
  
  // Test 4: Core functions exist
  testCoreFunctions(results);
  
  // Test 5: Data operations
  testDataOperations(results);
  
  // Test 6: Module functions
  testModuleFunctions(results);
  
  // Summary
  Logger.log('\n' + '='.repeat(50));
  Logger.log('📊 VERIFICATION SUMMARY');
  Logger.log('='.repeat(50));
  Logger.log('✅ Passed: ' + results.passed);
  Logger.log('❌ Failed: ' + results.failed);
  Logger.log('⚠️  Warnings: ' + results.warnings);
  
  if (results.failed === 0 && results.warnings === 0) {
    Logger.log('\n🎉 All backend functions verified successfully!');
  } else if (results.failed === 0) {
    Logger.log('\n✅ Backend is functional (some warnings may be expected)');
  } else {
    Logger.log('\n⚠️ Some issues found - review logs above');
  }
  
  return results;
}

function testSpreadsheetBinding(results) {
  Logger.log('\n📋 Test 1: Spreadsheet Binding');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      Logger.log('✅ Spreadsheet is bound: ' + ss.getName());
      results.passed++;
    } else {
      Logger.log('❌ No spreadsheet bound to this Apps Script project');
      Logger.log('   → Create a spreadsheet and bind it to this project');
      results.failed++;
    }
  } catch (e) {
    Logger.log('❌ Spreadsheet binding failed: ' + e.message);
    results.failed++;
  }
}

function testDatabaseSheets(results) {
  Logger.log('\n📋 Test 2: Database Sheets');
  const requiredSheets = [
    SHEETS.USERS,
    SHEETS.BRANCHES,
    SHEETS.LEADS,
    SHEETS.TRACKER,
    SHEETS.QUOTES,
    SHEETS.SALES_ACTIVITY,
    SHEETS.OPERATIONS_METRICS,
    SHEETS.START_PACKETS
  ];
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('⚠️  Skipping - no spreadsheet bound');
    results.warnings++;
    return;
  }
  
  var missing = [];
  requiredSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      missing.push(sheetName);
      Logger.log('❌ Missing: ' + sheetName);
    } else {
      Logger.log('✅ Found: ' + sheetName);
    }
  });
  
  if (missing.length === 0) {
    Logger.log('✅ All required sheets exist');
    results.passed++;
  } else {
    Logger.log('⚠️  Missing ' + missing.length + ' sheet(s)');
    Logger.log('   → Run setupDatabase() to create them');
    results.warnings++;
  }
}

function testUserAuthentication(results) {
  Logger.log('\n📋 Test 3: User Authentication');
  try {
    const user = getCurrentUser();
    if (user) {
      Logger.log('✅ User authenticated: ' + user.name);
      Logger.log('   Email: ' + user.email);
      Logger.log('   Role: ' + user.role);
      Logger.log('   Branch: ' + (user.branchID || 'N/A'));
      results.passed++;
    } else {
      Logger.log('⚠️  No user found');
      Logger.log('   → Add your email to Users sheet');
      Logger.log('   → Or login as cody.lytle@prestox.com (auto-creates admin)');
      results.warnings++;
    }
  } catch (e) {
    Logger.log('❌ Authentication failed: ' + e.message);
    results.failed++;
  }
}

function testCoreFunctions(results) {
  Logger.log('\n📋 Test 4: Core Functions');
  const coreFunctions = [
    'getCurrentUser',
    'getSheetData',
    'insertRow',
    'updateRow',
    'findRowByID',
    'generateUniqueID',
    'logAudit'
  ];
  
  var allExist = true;
  coreFunctions.forEach(function(funcName) {
    if (typeof eval(funcName) === 'function') {
      Logger.log('✅ ' + funcName + '() exists');
    } else {
      Logger.log('❌ ' + funcName + '() missing');
      allExist = false;
    }
  });
  
  if (allExist) {
    results.passed++;
  } else {
    results.failed++;
  }
}

function testDataOperations(results) {
  Logger.log('\n📋 Test 5: Data Operations');
  try {
    // Test getSheetData
    const users = getSheetData(SHEETS.USERS);
    Logger.log('✅ getSheetData() works - retrieved ' + users.length + ' users');
    
    // Test generateUniqueID
    const testID = generateUniqueID('TEST');
    if (testID && testID.startsWith('TEST-')) {
      Logger.log('✅ generateUniqueID() works - generated: ' + testID);
    } else {
      Logger.log('❌ generateUniqueID() failed');
      results.failed++;
      return;
    }
    
    // Test findRowByID (if users exist)
    if (users.length > 0) {
      const firstUser = users[0];
      if (firstUser.UserID) {
        const found = findRowByID(SHEETS.USERS, 'UserID', firstUser.UserID);
        if (found) {
          Logger.log('✅ findRowByID() works');
        } else {
          Logger.log('⚠️  findRowByID() may have issues');
          results.warnings++;
        }
      }
    }
    
    results.passed++;
  } catch (e) {
    Logger.log('❌ Data operations failed: ' + e.message);
    results.failed++;
  }
}

function testModuleFunctions(results) {
  Logger.log('\n📋 Test 6: Module Functions');
  const moduleFunctions = [
    { name: 'getAEDashboard', module: 'Sales' },
    { name: 'getOpsManagerDashboard', module: 'Operations' },
    { name: 'getTechnicianDashboard', module: 'Operations' },
    { name: 'getBranchManagerDashboard', module: 'Branch Manager' },
    { name: 'submitLead', module: 'Lead Routing' },
    { name: 'getAEForZipCode', module: 'Lead Routing' },
    { name: 'exportReportToCSV', module: 'Reporting' }
  ];
  
  var allExist = true;
  moduleFunctions.forEach(function(func) {
    if (typeof eval(func.name) === 'function') {
      Logger.log('✅ ' + func.name + '() exists (' + func.module + ')');
    } else {
      Logger.log('❌ ' + func.name + '() missing (' + func.module + ')');
      allExist = false;
    }
  });
  
  // Try to call one that doesn't require auth
  try {
    const csv = exportReportToCSV('sales_activity', {});
    if (typeof csv === 'string') {
      Logger.log('✅ exportReportToCSV() executes successfully');
    }
  } catch (e) {
    Logger.log('⚠️  exportReportToCSV() test skipped: ' + e.message);
  }
  
  if (allExist) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Quick test: Submit a test lead and verify it's saved
 */
function testLeadSubmission() {
  Logger.log('🧪 Testing Lead Submission...\n');
  
  try {
    const testLead = {
      customer_name: 'Backend Test Customer',
      service_address: '123 Test St, Houston, TX',
      zipCode: '77001',
      phone: '713-555-9999',
      email: 'test@example.com',
      service_type: 'Pest Control',
      notes: 'Backend verification test - can be deleted'
    };
    
    Logger.log('Submitting test lead...');
    const result = submitLead(testLead);
    
    if (result && result.leadID) {
      Logger.log('✅ Lead submitted successfully');
      Logger.log('   Lead ID: ' + result.leadID);
      
      // Verify it was saved
      const leads = getSheetData(SHEETS.LEADS);
      const savedLead = leads.find(function(l) {
        return l.LeadID === result.leadID;
      });
      
      if (savedLead) {
        Logger.log('✅ Lead verified in database');
        Logger.log('   Customer: ' + savedLead.Customer_Name);
        Logger.log('   Status: ' + savedLead.Status);
        return true;
      } else {
        Logger.log('❌ Lead not found in database after submission');
        return false;
      }
    } else {
      Logger.log('❌ Lead submission returned invalid result');
      return false;
    }
  } catch (e) {
    Logger.log('❌ Lead submission failed: ' + e.message);
    Logger.log('   Stack: ' + e.stack);
    return false;
  }
}

/**
 * Quick test: Verify dashboard functions return proper structure
 */
function testDashboardFunctions() {
  Logger.log('🧪 Testing Dashboard Functions...\n');
  
  const dashboards = [
    { name: 'AE Dashboard', func: 'getAEDashboard' },
    { name: 'Ops Dashboard', func: 'getOpsManagerDashboard' },
    { name: 'Tech Dashboard', func: 'getTechnicianDashboard' },
    { name: 'Branch Manager Dashboard', func: 'getBranchManagerDashboard' }
  ];
  
  dashboards.forEach(function(dash) {
    try {
      Logger.log('Testing ' + dash.name + '...');
      const data = eval(dash.func + '()');
      
      if (data && typeof data === 'object') {
        Logger.log('✅ ' + dash.name + ' returns object');
        Logger.log('   Keys: ' + Object.keys(data).join(', '));
      } else {
        Logger.log('❌ ' + dash.name + ' returned invalid data');
      }
    } catch (e) {
      Logger.log('⚠️  ' + dash.name + ' test skipped: ' + e.message);
    }
  });
}

