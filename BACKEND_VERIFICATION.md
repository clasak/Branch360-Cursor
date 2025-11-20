# 🔧 Backend Verification Guide

## Overview

This guide helps you verify that all backend functions are working correctly in Apps Script, not just the frontend demo mode.

## ⚠️ Critical Prerequisites

Before testing backend functions, ensure:

1. **Spreadsheet is bound to Apps Script project**
   - Apps Script must be linked to a Google Spreadsheet
   - Code uses `SpreadsheetApp.getActiveSpreadsheet()` which requires this

2. **Database is initialized**
   - Run `setupDatabase()` function once to create all sheets

3. **You're logged in with a valid Google account**
   - Your email must match a user in the Users sheet (or auto-created for cody.lytle@prestox.com)

---

## 🧪 Step 1: Run the Test Suite

The easiest way to verify backend functionality is to run the built-in test suite.

### In Apps Script Editor:

1. Open: https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit

2. Select function: `runAllTests` from the dropdown

3. Click **Run** ▶️

4. Check the **Execution log** (View → Execution log) for results

### What the tests verify:

- ✅ All database sheets exist
- ✅ Lead routing functions work
- ✅ Sales module functions exist and return proper structure
- ✅ Operations module functions work
- ✅ Reporting/CSV export works
- ✅ Branch manager functions work
- ✅ Salesforce parser works

---

## 🔍 Step 2: Manual Function Testing

Test individual functions to verify they work with real data:

### Test 1: Verify User Authentication

```javascript
// Run this in Apps Script editor
function testGetCurrentUser() {
  const user = getCurrentUser();
  Logger.log('Current User: ' + JSON.stringify(user));
  
  if (!user) {
    Logger.log('❌ No user found - check Users sheet or email match');
  } else {
    Logger.log('✅ User authenticated: ' + user.name + ' (' + user.role + ')');
  }
}
```

**Expected Result:** Should return your user object with name, email, role, etc.

---

### Test 2: Verify Database Setup

```javascript
// Run this in Apps Script editor
function testDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    'Users', 'Branches', 'Leads', 'TrackerData', 
    'Quotes', 'Sales_Activity', 'Operations_Metrics',
    'StartPackets', 'Service_Issues'
  ];
  
  const missing = [];
  requiredSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      missing.push(sheetName);
      Logger.log('❌ Missing sheet: ' + sheetName);
    } else {
      Logger.log('✅ Sheet exists: ' + sheetName);
    }
  });
  
  if (missing.length > 0) {
    Logger.log('⚠️ Run setupDatabase() to create missing sheets');
  } else {
    Logger.log('✅ All required sheets exist');
  }
}
```

---

### Test 3: Test Lead Submission (Real Backend)

```javascript
// Run this in Apps Script editor
function testSubmitLead() {
  const testLead = {
    customer_name: 'Test Customer - Backend Verification',
    service_address: '123 Test St, Houston, TX',
    zipCode: '77001',
    phone: '713-555-1234',
    email: 'test@example.com',
    service_type: 'Pest Control',
    notes: 'Backend test lead'
  };
  
  try {
    const result = submitLead(testLead);
    Logger.log('✅ Lead submitted successfully');
    Logger.log('Lead ID: ' + result.leadID);
    
    // Verify it was saved
    const leads = getSheetData(SHEETS.LEADS);
    const savedLead = leads.find(function(l) {
      return l.LeadID === result.leadID;
    });
    
    if (savedLead) {
      Logger.log('✅ Lead verified in database');
    } else {
      Logger.log('❌ Lead not found in database');
    }
  } catch (e) {
    Logger.log('❌ Lead submission failed: ' + e.message);
  }
}
```

---

### Test 4: Test AE Dashboard (Real Data)

```javascript
// Run this in Apps Script editor
function testAEDashboard() {
  try {
    const dashboard = getAEDashboard();
    
    Logger.log('✅ Dashboard loaded successfully');
    Logger.log('User: ' + dashboard.user.name);
    Logger.log('Today Metrics: ' + JSON.stringify(dashboard.todayMetrics));
    Logger.log('Month Metrics: ' + JSON.stringify(dashboard.monthMetrics));
    Logger.log('Pipeline stages: ' + Object.keys(dashboard.pipeline.stages).length);
    Logger.log('New Leads: ' + dashboard.newLeads.length);
    
    // Verify structure
    if (!dashboard.user || !dashboard.todayMetrics || !dashboard.pipeline) {
      Logger.log('❌ Dashboard structure incomplete');
    } else {
      Logger.log('✅ Dashboard structure valid');
    }
  } catch (e) {
    Logger.log('❌ Dashboard failed: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }
}
```

---

### Test 5: Test Operations Dashboard

```javascript
// Run this in Apps Script editor
function testOpsDashboard() {
  try {
    const dashboard = getOpsManagerDashboard();
    
    Logger.log('✅ Ops Dashboard loaded');
    Logger.log('Today Metrics: ' + JSON.stringify(dashboard.todayMetrics));
    Logger.log('Team Technicians: ' + dashboard.teamTechnicians.length);
    Logger.log('Pending Issues: ' + dashboard.pendingIssues.length);
    
    if (!dashboard.todayMetrics || !dashboard.teamTechnicians) {
      Logger.log('❌ Dashboard structure incomplete');
    } else {
      Logger.log('✅ Dashboard structure valid');
    }
  } catch (e) {
    Logger.log('❌ Ops Dashboard failed: ' + e.message);
  }
}
```

---

### Test 6: Test Lead Routing

```javascript
// Run this in Apps Script editor
function testLeadRouting() {
  const testZips = ['77001', '77002', '77005', '77006'];
  
  testZips.forEach(function(zip) {
    const ae = getAEForZipCode(zip);
    if (ae) {
      Logger.log('✅ Zip ' + zip + ' → AE: ' + ae.name + ' (' + ae.email + ')');
    } else {
      Logger.log('⚠️ Zip ' + zip + ' → No AE assigned (may be expected if territories not set up)');
    }
  });
}
```

---

### Test 7: Test Data Retrieval Functions

```javascript
// Run this in Apps Script editor
function testDataRetrieval() {
  try {
    // Test getSheetData
    const users = getSheetData(SHEETS.USERS);
    Logger.log('✅ Users retrieved: ' + users.length);
    
    const leads = getSheetData(SHEETS.LEADS);
    Logger.log('✅ Leads retrieved: ' + leads.length);
    
    const tracker = getSheetData(SHEETS.TRACKER);
    Logger.log('✅ Tracker entries: ' + tracker.length);
    
    // Test with filters
    const activeUsers = getSheetData(SHEETS.USERS, {Active: true});
    Logger.log('✅ Active users: ' + activeUsers.length);
    
  } catch (e) {
    Logger.log('❌ Data retrieval failed: ' + e.message);
  }
}
```

---

## 🎯 Quick Verification Checklist

Run these in order to verify backend:

- [ ] **Database Setup**: Run `setupDatabase()` - all sheets created?
- [ ] **User Auth**: Run `testGetCurrentUser()` - user found?
- [ ] **Test Suite**: Run `runAllTests()` - all tests pass?
- [ ] **Lead Submission**: Run `testSubmitLead()` - lead saved?
- [ ] **AE Dashboard**: Run `testAEDashboard()` - dashboard loads?
- [ ] **Ops Dashboard**: Run `testOpsDashboard()` - dashboard loads?
- [ ] **Data Retrieval**: Run `testDataRetrieval()` - data accessible?

---

## 🐛 Common Issues & Fixes

### Issue: "Spreadsheet not found" or "getActiveSpreadsheet() failed"

**Fix:** 
- Ensure Apps Script is bound to a spreadsheet
- In Apps Script editor, check for spreadsheet link/icon
- If missing, create a new spreadsheet and bind it

### Issue: "User not authenticated" or getCurrentUser() returns null

**Fix:**
- Ensure your email exists in Users sheet
- Or ensure you're logged in as cody.lytle@prestox.com (auto-creates admin)
- Check Users sheet has proper headers

### Issue: "Sheet not found" errors

**Fix:**
- Run `setupDatabase()` function
- Verify all sheets were created
- Check sheet names match exactly (case-sensitive)

### Issue: Functions return empty data

**Fix:**
- This is normal if database is empty
- Run `runDemoSeed('BRN-001')` to seed test data
- Or manually add test records

### Issue: Dashboard functions fail

**Fix:**
- Check user has proper role in Users sheet
- Verify required sheets exist
- Check execution logs for specific errors

---

## 📊 Seed Demo Data (Optional)

If you want to test with realistic data:

```javascript
// Run this in Apps Script editor
function seedTestData() {
  // First ensure database is set up
  setupDatabase();
  
  // Then seed demo data
  runDemoSeed('BRN-001');
  
  Logger.log('✅ Demo data seeded');
}
```

This creates:
- 15 demo leads
- 10 demo start packets
- 40 demo activity log entries

---

## 🔗 Testing from Web App

Once backend is verified, test from the web app:

1. Deploy web app (Deploy → New deployment → Web app)
2. Access the URL
3. Check browser console (F12) for errors
4. Verify `google.script.run` calls succeed
5. Test actual functionality (submit lead, view dashboard, etc.)

---

## ✅ Success Criteria

Backend is working when:

- ✅ All test suite tests pass
- ✅ `getCurrentUser()` returns your user object
- ✅ Dashboard functions return proper data structures
- ✅ Lead submission saves to database
- ✅ Data retrieval functions work
- ✅ No errors in execution logs

---

## 📝 Next Steps After Verification

Once backend is verified:

1. Test web app deployment
2. Test from different user roles
3. Test all dashboard views
4. Test lead submission from tech form
5. Test reporting/export functions
6. Verify data flows between modules

---

**Note:** Demo mode in the frontend uses hardcoded data and doesn't call backend functions. To test the real backend, you must:
- Have a bound spreadsheet
- Run functions in Apps Script editor
- Or access the deployed web app (which calls real backend)

