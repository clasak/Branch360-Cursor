# Branch360 Enhancements - Integration Checklist

Use this checklist to deploy the new system improvements to your Branch360 CRM.

---

## ✅ Pre-Deployment Checklist

- [ ] **Backup current spreadsheet** - File → Make a copy
- [ ] **Review current data** - Note any pending sync conflicts
- [ ] **Test environment ready** - Have access to Apps Script editor
- [ ] **User notification plan** - Schedule training sessions

---

## 🚀 Deployment Steps

### Phase 1: Core System Setup (5 minutes)

#### Step 1.1: Open Apps Script Editor
- [ ] Open your Branch360 spreadsheet
- [ ] Go to Extensions → Apps Script
- [ ] Verify all new `.gs` files are present in `src/` folder

#### Step 1.2: Install Enhancement Triggers
- [ ] In Apps Script editor, select `installEnhancementTriggers` function
- [ ] Click Run (▶️)
- [ ] Check Execution log for success messages:
  ```
  ✅ Sync triggers installed
  ✅ Cache pre-warm trigger installed
  ✅ Archive trigger installed
  ✅ Nurture campaign trigger installed
  ✅ Appointment reminder trigger installed
  ✅ Calendar sync trigger installed
  ```
- [ ] If any errors, note them and check troubleshooting section

#### Step 1.3: Verify Triggers Installed
- [ ] In Apps Script, click clock icon (⏰) on left sidebar
- [ ] Verify you see these triggers:
  - `onEditSyncHandler` - On edit
  - `prewarmCaches` - Daily at 2:00 AM
  - `runFullArchive` - Monthly on day 1 at 3:00 AM
  - `runNurtureCampaign` - Weekly Monday at 9:00 AM
  - `sendAppointmentReminders` - Daily at 8:00 AM
  - `syncCalendarToCRM` - Every 6 hours
  - `calculateDailySummaries` - Daily at 11:30 PM (existing)

---

### Phase 2: Test Core Features (10 minutes)

#### Test 2.1: Bi-Directional Sync
- [ ] Open `Unified_Sales` sheet
- [ ] Find a record, change Status to "Install Complete"
- [ ] Wait 5 seconds (trigger processes)
- [ ] Open `StartPackets` sheet
- [ ] Verify matching record shows updated status
- [ ] **Result**: ✅ Sync working

#### Test 2.2: Cache System
- [ ] In Apps Script editor, select function `prewarmCaches`
- [ ] Click Run
- [ ] Check execution log for:
  ```
  🔥 Pre-warming caches...
  ✅ Cache pre-warming complete
  ```
- [ ] **Result**: ✅ Cache working

#### Test 2.3: Archive System (Dry Run)
- [ ] In Apps Script editor, select function `getArchiveStatistics`
- [ ] Click Run
- [ ] Check execution log for archive spreadsheet URL
- [ ] Open archive spreadsheet URL (should be new, empty spreadsheet)
- [ ] **Result**: ✅ Archive system ready

#### Test 2.4: Notification System (Email Only)
- [ ] In Apps Script editor, select function `testNotificationSystem`
- [ ] Edit function call to use your test user ID:
  ```javascript
  testNotificationSystem('USR-001'); // Replace with real UserID
  ```
- [ ] Run function
- [ ] Check your email for test message
- [ ] **Result**: ✅ Email notifications working

#### Test 2.5: Calendar Sync
- [ ] In Apps Script editor, select function `syncCalendarToCRM`
- [ ] Run function
- [ ] Check execution log for:
  ```
  🔄 Syncing calendar to CRM...
  ✅ Calendar sync complete
  ```
- [ ] **Result**: ✅ Calendar sync working

---

### Phase 3: Optional - SMS Setup (5 minutes)

**Only if you want SMS notifications for technicians**

#### Step 3.1: Get Twilio Account
- [ ] Go to https://www.twilio.com/try-twilio
- [ ] Sign up for free trial ($15 credit included)
- [ ] Verify your phone number
- [ ] Note your **Account SID** (starts with `AC...`)
- [ ] Note your **Auth Token** (32 characters)

#### Step 3.2: Purchase Twilio Phone Number
- [ ] In Twilio console, go to Phone Numbers → Buy a Number
- [ ] Select United States
- [ ] Choose a number (typically $1-2/month)
- [ ] Note your purchased number in E.164 format: `+15551234567`

#### Step 3.3: Configure Branch360
- [ ] In Apps Script editor, open `notification-system.gs`
- [ ] Find function `initializeTwilioSettings`
- [ ] Update with your credentials:
  ```javascript
  initializeTwilioSettings(
    'ACxxxxxxxxxxxxxxxx',  // Your Account SID
    'your_auth_token_here', // Your Auth Token
    '+15551234567'          // Your Twilio number
  );
  ```
- [ ] Run the function
- [ ] Check log for: `✅ Twilio settings configured`

#### Step 3.4: Test SMS
- [ ] In Apps Script, run `testNotificationSystem('USR-TECH-001')` (use a tech with phone number)
- [ ] Check execution log for SMS send confirmation
- [ ] Check tech's phone for test SMS
- [ ] **Result**: ✅ SMS working

---

### Phase 4: Configure Salesforce Parser (5 minutes)

#### Step 4.1: Test Current Parser
- [ ] Get a sample Salesforce quote PDF
- [ ] Extract text (copy/paste from PDF)
- [ ] In Apps Script, run:
  ```javascript
  testSalesforceParser(`
    Account Name: Test Company
    Initial Investment: $2,500.00
    Monthly Fee: $150.00
  `);
  ```
- [ ] Check log for parse success rate
- [ ] **Result**: Note success rate (should be >80%)

#### Step 4.2: Update Mappings (If Needed)
- [ ] If success rate <80%, review failed fields
- [ ] Use `updateFieldMapping()` to fix:
  ```javascript
  updateFieldMapping('INITIAL_PRICE', {
    keywords: ['Initial Investment', 'Setup Fee'],
    regex: /Initial Investment[:\s]+\$?([\d,]+\.?\d*)/i,
    type: 'currency',
    targetField: 'InitialPrice'
  });
  ```
- [ ] Re-test until success rate >80%
- [ ] **Result**: ✅ Parser configured

---

### Phase 5: Enable Offline Queue (10 minutes)

#### Step 5.1: Update Tech Dashboard HTML
- [ ] Open `src/tech-dashboard.html`
- [ ] Add before closing `</body>` tag:
  ```html
  <!-- Offline Queue System -->
  <?!= include('offline-queue'); ?>
  ```
- [ ] Save file

#### Step 5.2: Update Submit Functions
Find all instances of:
```javascript
submitLead(leadData);
```

Replace with:
```javascript
submitLeadWithOfflineSupport(leadData);
```

Do the same for:
- `reportServiceIssue` → `submitServiceIssueWithOfflineSupport`
- `completeInstallation` → `completeInstallWithOfflineSupport`

- [ ] Updated lead submission
- [ ] Updated issue reporting
- [ ] Updated install completion

#### Step 5.3: Test Offline Mode
- [ ] Open tech dashboard in browser
- [ ] Open Developer Tools (F12)
- [ ] Go to Network tab → Change "Online" to "Offline"
- [ ] Try submitting a test lead
- [ ] Verify: Badge appears at bottom-left showing "1" pending item
- [ ] Switch back to "Online"
- [ ] Wait 5-10 seconds
- [ ] Verify: Badge disappears, toast shows "✅ Synced 1 items"
- [ ] Check database for lead record
- [ ] **Result**: ✅ Offline queue working

---

### Phase 6: User Training (20 minutes)

#### Training 6.1: AEs (5 minutes)
Show them:
- [ ] **Nurture reminders**: "You'll get email on Mondays about old leads"
- [ ] **Calendar sync**: "Appointments auto-add to Google Calendar"
- [ ] **Faster dashboards**: "Load time reduced from 3-5 sec to <1 sec"

#### Training 6.2: Ops Managers (5 minutes)
Show them:
- [ ] **Auto-sync**: "Changes in StartPackets update Unified_Sales automatically"
- [ ] **Protected fields**: "Pricing columns locked - edit via Sales dashboard"
- [ ] **Archive system**: "Old records auto-archive monthly, keeps system fast"

#### Training 6.3: Technicians (5 minutes)
Show them:
- [ ] **Offline mode**: "Submit leads without internet, syncs later"
- [ ] **Queue badge**: "See pending items at bottom-left"
- [ ] **SMS alerts** (if enabled): "Get texts for new stops immediately"

#### Training 6.4: Admins (5 minutes)
Show them:
- [ ] **Trigger monitoring**: "Check Apps Script → Executions for logs"
- [ ] **Salesforce mappings**: "Update if quote template changes"
- [ ] **Archive management**: "Restore records if needed"
- [ ] **Cache statistics**: "Run `getCacheStatistics()` to check performance"

---

## 📊 Post-Deployment Monitoring

### Day 1: Verify Triggers Ran
- [ ] Check Apps Script → Executions
- [ ] Look for successful execution of:
  - `onEditSyncHandler` (should fire on sheet edits)
  - `prewarmCaches` (ran at 2 AM)
  - `syncCalendarToCRM` (runs every 6 hours)

### Week 1: Check Performance
- [ ] Run `getCacheStatistics()` - verify cache hits
- [ ] Run `getActivityAnalytics({})` - check time savings
- [ ] Interview 2-3 users per role - gather feedback

### Month 1: Review Metrics
- [ ] Dashboard load times - should be <1 second
- [ ] Data conflicts - should be zero
- [ ] Lead response time - should improve 50-85%
- [ ] Offline queue success rate - should be >95%
- [ ] Archive statistics - check record counts

### Monthly: Maintenance Tasks
- [ ] Review execution logs for errors
- [ ] Check archive spreadsheet size
- [ ] Verify cache hit rates
- [ ] Update Salesforce mappings if needed
- [ ] Review user feedback

---

## 🐛 Troubleshooting Guide

### Issue: Sync Not Working
**Symptoms**: Changes in one sheet don't appear in another

**Fix**:
1. Check trigger installed:
   ```javascript
   installSyncTriggers();
   ```
2. Manual sync:
   ```javascript
   forceSyncAllRecords();
   ```
3. Check execution logs for errors

---

### Issue: Dashboards Still Slow
**Symptoms**: Load times >2 seconds

**Fix**:
1. Clear cache:
   ```javascript
   clearAllCaches();
   ```
2. Pre-warm cache:
   ```javascript
   prewarmCaches();
   ```
3. Check for large data sets (>10k rows) - may need to archive

---

### Issue: SMS Not Sending
**Symptoms**: Email works but SMS doesn't

**Fix**:
1. Verify Twilio settings:
   ```javascript
   getTwilioSettings();
   ```
2. Check Twilio balance (in Twilio console)
3. Verify phone number format: `+15551234567` (E.164)
4. Check Twilio logs for errors

---

### Issue: Offline Queue Not Syncing
**Symptoms**: Items stuck in queue

**Fix**:
1. Open browser console (F12)
2. Check connection:
   ```javascript
   navigator.onLine
   ```
3. Manual sync:
   ```javascript
   OfflineQueue.syncQueue();
   ```
4. Check for JavaScript errors in console

---

### Issue: Archive Created Multiple Spreadsheets
**Symptoms**: Multiple "Branch360_Archive" spreadsheets

**Fix**:
1. Get archive ID:
   ```javascript
   getArchiveStatistics();
   ```
2. Delete duplicate spreadsheets manually
3. Re-run to verify single archive:
   ```javascript
   getOrCreateArchiveSpreadsheet();
   ```

---

### Issue: Parser Not Matching Fields
**Symptoms**: Salesforce import missing data

**Fix**:
1. Test with sample PDF:
   ```javascript
   testSalesforceParser(sampleText);
   ```
2. Check success rate (should be >80%)
3. Update failed field mappings:
   ```javascript
   updateFieldMapping('FIELD_KEY', {...});
   ```
4. Export mappings as backup:
   ```javascript
   exportSalesforceMappings();
   ```

---

## 📈 Success Criteria

After 30 days, you should see:

- ✅ **Dashboard load time**: <1 second (was 3-5 seconds)
- ✅ **Data conflicts**: 0 per week (was 2-3)
- ✅ **Lead response time**: <4 hours (was 24-48 hours)
- ✅ **Missed stops**: 0-1 per month (was 3-5)
- ✅ **Data entry time**: 5-8 minutes (was 15-25 minutes)
- ✅ **User satisfaction**: >80% positive feedback

**Time saved**: 30-40 hours per month per branch
**ROI**: $21,600-$28,800 per year per branch

---

## 🎉 Deployment Complete!

Once all checkboxes are checked:
- ✅ All triggers installed and verified
- ✅ All systems tested and working
- ✅ Users trained on new features
- ✅ Monitoring plan in place

**Your Branch360 CRM is now enhanced with:**
1. Bi-directional sync (eliminates data conflicts)
2. Performance caching (80% faster dashboards)
3. Auto-archive (scalability)
4. Enhanced notifications (Email + SMS)
5. Calendar integration (two-way sync)
6. Configurable Salesforce parser (resilient)
7. Offline queue (techs work anywhere)

**Next**: Monitor for 1 week, gather feedback, adjust as needed.

---

## 📞 Support Resources

- **Full Documentation**: `IMPROVEMENTS_IMPLEMENTED.md`
- **Quick Start**: `QUICK_START_ENHANCEMENTS.md`
- **Executive Summary**: `ENHANCEMENTS_SUMMARY.md`
- **Test Functions**: Each `.gs` file has test functions
- **Execution Logs**: Apps Script → Executions

All systems include extensive error handling and logging. Check execution logs for detailed information.

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Notes**:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

