# ⚡ Quick Backend Verification

## Fastest Way to Verify Backend

### Step 1: Open Apps Script Editor
https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit

### Step 2: Run Verification Function

1. In the function dropdown, select: **`verifyBackend`**
2. Click **Run** ▶️
3. Check **Execution log** (View → Execution log)

### Step 3: Review Results

The verification will test:
- ✅ Spreadsheet binding
- ✅ Database sheets exist
- ✅ User authentication
- ✅ Core functions exist
- ✅ Data operations work
- ✅ Module functions exist

---

## What Each Test Means

### ✅ Passed
Function/feature is working correctly

### ⚠️ Warning
May be expected (e.g., empty database, no user yet)

### ❌ Failed
Critical issue that needs fixing

---

## If Tests Fail

### "No spreadsheet bound"
**Fix:** Create a Google Spreadsheet and bind it to this Apps Script project

### "Missing sheets"
**Fix:** Run `setupDatabase()` function

### "No user found"
**Fix:** 
- Add your email to Users sheet, OR
- Login as `cody.lytle@prestox.com` (auto-creates admin)

---

## Additional Tests

### Test Lead Submission
Select function: **`testLeadSubmission`** → Run

This will:
- Submit a test lead
- Verify it's saved to database
- Show the lead ID

### Test Dashboard Functions
Select function: **`testDashboardFunctions`** → Run

This will test all dashboard functions return proper data structures.

---

## Full Test Suite

For comprehensive testing, run:
Select function: **`runAllTests`** → Run

This runs the complete test suite from `tests.gs`.

---

## Expected Output

When everything works, you should see:

```
🔍 Branch360 Backend Verification
==================================================
📋 Test 1: Spreadsheet Binding
✅ Spreadsheet is bound: Your Spreadsheet Name
📋 Test 2: Database Sheets
✅ Found: Users
✅ Found: Branches
✅ Found: Leads
... (all sheets)
✅ All required sheets exist
📋 Test 3: User Authentication
✅ User authenticated: Your Name
   Email: your@email.com
   Role: Administrator
📋 Test 4: Core Functions
✅ getCurrentUser() exists
✅ getSheetData() exists
... (all functions)
📋 Test 5: Data Operations
✅ getSheetData() works - retrieved X users
✅ generateUniqueID() works
📋 Test 6: Module Functions
✅ getAEDashboard() exists (Sales)
✅ getOpsManagerDashboard() exists (Operations)
... (all modules)

==================================================
📊 VERIFICATION SUMMARY
==================================================
✅ Passed: 6
❌ Failed: 0
⚠️  Warnings: 0

🎉 All backend functions verified successfully!
```

---

## Next Steps After Verification

Once backend is verified:

1. **Test from Web App**
   - Deploy web app (Deploy → New deployment)
   - Access the URL
   - Verify frontend calls backend successfully

2. **Test Real Workflows**
   - Submit a lead from tech form
   - View AE dashboard with real data
   - Test lead routing
   - Test reporting/export

3. **Seed Test Data** (optional)
   - Run `runDemoSeed('BRN-001')` to add sample data
   - Makes dashboards more realistic for demo

---

**Note:** Demo mode in the frontend uses hardcoded data. To verify the REAL backend, you must run these functions in Apps Script or access the deployed web app.

