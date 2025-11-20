# 🎯 Branch360 Presentation Readiness Checklist

## ✅ Code Deployment Status

### Code Push Status: ✅ COMPLETE
- **33 files** successfully pushed to Apps Script
- Script ID: `12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg`
- Apps Script Editor: https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit

---

## ⚠️ CRITICAL: Items That MUST Be Verified Before Presentation

### 1. **Google Spreadsheet Binding** 🔴 CRITICAL
**Status: ⚠️ NEEDS VERIFICATION**

The Apps Script project **MUST** be bound to a Google Spreadsheet. The code uses `SpreadsheetApp.getActiveSpreadsheet()` which requires this.

**Action Required:**
1. Open your Apps Script project: https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit
2. Check if there's a spreadsheet linked (look for a spreadsheet icon or link in the Apps Script editor)
3. **If NO spreadsheet is bound:**
   - Create a new Google Spreadsheet
   - In the spreadsheet, go to: **Extensions → Apps Script**
   - Copy your Script ID from `.clasp.json` and open that project
   - OR: In Apps Script, go to **File → New → Spreadsheet** to create and bind one

**Verify:** Run `setupDatabase()` function in Apps Script to create all required sheets.

---

### 2. **Web App Deployment** 🔴 CRITICAL
**Status: ⚠️ NEEDS VERIFICATION**

The web app must be deployed as a web application to be accessible via URL.

**Action Required:**
1. In Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" → Choose **Web app**
3. Configure:
   - **Description:** "Branch360 CRM - Production"
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone (or "Anyone with Google account" for more security)
4. Click **Deploy**
5. **Copy the Web App URL** - you'll need this for the presentation!

**Test the URL:**
- Open the deployment URL in an incognito/private browser window
- Verify it loads the dashboard
- Test different views: `?view=admin`, `?view=ae`, `?view=branch`, `?view=ops`, `?view=tech`

---

### 3. **Database Initialization** 🟡 IMPORTANT
**Status: ⚠️ NEEDS VERIFICATION**

All required sheets must be created in the bound spreadsheet.

**Action Required:**
1. In Apps Script editor, open the **Run** menu
2. Select function: `setupDatabase`
3. Click **Run** (you may need to authorize permissions)
4. Check the **Execution log** to verify all sheets were created
5. Open the bound spreadsheet and verify you see sheets like:
   - Users
   - Branches
   - Leads
   - TrackerData
   - etc.

**If setup fails:**
- Check execution logs for errors
- Verify the spreadsheet is properly bound
- Ensure you have edit permissions on the spreadsheet

---

### 4. **User Authentication Setup** 🟡 IMPORTANT
**Status: ⚠️ NEEDS VERIFICATION**

At least one user must exist in the Users sheet for login to work.

**Action Required:**
1. Open the bound spreadsheet
2. Go to the **Users** sheet
3. Verify there's at least one user row (after the header)
4. **If empty, add a test user:**
   - UserID: `TEST001`
   - Name: `Test Admin`
   - Email: `your-email@prestox.com` (must match your Google account)
   - Role: `Administrator`
   - Active: `TRUE`
   - BranchID: `BR001` (create a branch first if needed)

**Test Login:**
- Access the web app URL
- Verify you can see your user info
- Test role-based access (admin dashboard should be accessible)

---

### 5. **Permissions & Authorization** 🟡 IMPORTANT
**Status: ⚠️ NEEDS VERIFICATION**

The Apps Script project needs proper OAuth scopes.

**Action Required:**
1. In Apps Script editor, go to **Overview** (left sidebar)
2. Check **OAuth consent screen** - ensure it's configured
3. Review **Scopes** - should include:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/script.container.ui`
   - `https://www.googleapis.com/auth/script.external_request`
4. If scopes are missing, they're defined in `appsscript.json` - redeploy if needed

**First-time access:**
- Users may need to authorize the app on first access
- This is normal - they'll see a Google OAuth consent screen

---

## 🟢 Secondary Checks (Nice to Have)

### 6. **Test All Dashboards**
- [ ] Admin Dashboard: `?view=admin`
- [ ] AE Dashboard: `?view=ae`
- [ ] Branch Manager: `?view=branch`
- [ ] Operations Manager: `?view=ops`
- [ ] Technician: `?view=tech`
- [ ] Default Dashboard: (no view parameter)

### 7. **Test Key Functions**
- [ ] User login/authentication
- [ ] Lead submission (tech form)
- [ ] Sales pipeline view
- [ ] Operations metrics
- [ ] Reporting features

### 8. **Performance Check**
- [ ] Page load times are acceptable (< 3 seconds)
- [ ] No console errors in browser DevTools
- [ ] All API calls complete successfully

### 9. **Mobile Responsiveness**
- [ ] Test on mobile device or browser DevTools mobile view
- [ ] Verify dashboards are usable on small screens

---

## 📋 Quick Pre-Presentation Checklist

Before your presentation, verify:

- [ ] ✅ Code is pushed to Apps Script (DONE - 33 files)
- [ ] ⚠️ Spreadsheet is bound to Apps Script project
- [ ] ⚠️ Web app is deployed and URL is accessible
- [ ] ⚠️ Database is initialized (all sheets created)
- [ ] ⚠️ At least one test user exists in Users sheet
- [ ] ⚠️ You can access the web app URL and see a dashboard
- [ ] ⚠️ Admin dashboard is accessible with your account
- [ ] ⚠️ No critical errors in browser console

---

## 🚨 If Something's Not Working

### Common Issues & Fixes:

1. **"Spreadsheet not found" error:**
   - Ensure Apps Script is bound to a spreadsheet
   - Run `setupDatabase()` to create sheets

2. **"User not authenticated" error:**
   - Add your email to the Users sheet
   - Ensure Role is set correctly (case-sensitive: "Administrator")

3. **"Access denied" on admin dashboard:**
   - Check your role in Users sheet is exactly "Administrator"
   - Verify Active = TRUE

4. **Web app shows blank page:**
   - Check browser console for errors
   - Verify deployment is active (not just code pushed)
   - Try redeploying the web app

5. **Sheets don't exist:**
   - Run `setupDatabase()` function in Apps Script
   - Check execution logs for errors

---

## 📞 Quick Commands Reference

```bash
# Push latest code to Apps Script
npm run clasp:push

# Open Apps Script editor
npm run clasp:open

# Pull code from Apps Script (to verify)
npm run clasp:pull
```

---

## 🎯 Presentation URLs to Have Ready

1. **Apps Script Editor:**
   https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit

2. **Web App URL:** 
   ⚠️ **GET THIS FROM DEPLOYMENT** (Deploy → Manage deployments → Copy URL)

3. **Bound Spreadsheet:**
   ⚠️ **VERIFY THIS EXISTS** (should be linked in Apps Script editor)

---

## ✅ Final Status

**Code Deployment:** ✅ READY (33 files pushed)  
**Web App Deployment:** ⚠️ **NEEDS VERIFICATION**  
**Database Setup:** ⚠️ **NEEDS VERIFICATION**  
**User Setup:** ⚠️ **NEEDS VERIFICATION**  

**Overall Status:** ⚠️ **REQUIRES ACTION** - Critical items need verification before presentation.

---

**Next Steps:**
1. Verify spreadsheet binding
2. Deploy web app and get URL
3. Run database setup
4. Add test user
5. Test all dashboards
6. Document deployment URL for presentation

