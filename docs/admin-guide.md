# Branch360 - Administrator Guide

## Table of Contents
1. [Setting Up the Database](#setting-up-the-database)
2. [Managing Users](#managing-users)
3. [Configuring Territories](#configuring-territories)
4. [Running Reports](#running-reports)
5. [System Maintenance](#system-maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Setting Up the Database

### Initial Setup

The Branch360 system uses Google Sheets as its database. Follow these steps for initial setup:

1. **Create Required Sheets**
   - The system requires specific sheets to be created
   - Sheet names are defined in `config.gs` under the `SHEETS` constant
   - Run the database setup script to create all required sheets

2. **Sheet Structure**
   Each sheet follows a specific schema defined in `DB_SCHEMA`:
   - **Core Tables**: Users, Branches, Regions, Markets, Territories
   - **Sales Tables**: TrackerData, Quotes, Sales_Activity, Accounts
   - **Operations Tables**: Leads, Operations_Metrics, StartPackets, Service_Issues
   - **Reporting Tables**: Branch_Daily_Summary, Region_Summary, Market_Summary, Revenue
   - **System Tables**: AuditLog, Notifications, Preferences

3. **Running Database Setup**
   ```javascript
   // Run this function to set up all sheets
   function setupDatabase() {
     // This function should create all required sheets with headers
     // Refer to database-setup.gs for implementation
   }
   ```

4. **Verifying Setup**
   - Run the test suite: `runAllTests()`
   - Check that all sheets exist
   - Verify sheet headers match schema definitions

### Sheet Headers

Each sheet must have the correct headers in the first row. Headers are defined in `DB_SCHEMA` in `config.gs`.

**Example - Users Sheet:**
```
UserID | Name | Email | Role | BranchID | TerritoryZips | Active | PhoneNumber | EmailNotifications | CreatedOn | UpdatedOn
```

**Important:** 
- Headers must match exactly (case-sensitive)
- Order matters for some operations
- First column should always be the ID column

---

## Managing Users

### Adding New Users

1. **Access Users Sheet**
   - Open the "Users" sheet in the spreadsheet
   - Or use the user management interface (if available)

2. **Create User Record**
   Add a new row with the following information:
   - **UserID**: Generate using `generateUniqueID('USR')`
   - **Name**: Full name
   - **Email**: Google account email (must match Google account)
   - **Role**: One of:
     - "Account Executive"
     - "Technician"
     - "Operations Manager"
     - "Branch Manager"
     - "Regional Director"
     - "Market Director"
     - "Executive"
     - "Administrator"
   - **BranchID**: ID of the branch they belong to
   - **TerritoryZips**: Pipe-delimited list of zip codes (for AEs)
   - **Active**: true/false
   - **PhoneNumber**: Contact number
   - **EmailNotifications**: true/false
   - **CreatedOn**: Current date/time
   - **UpdatedOn**: Current date/time

3. **Verify User**
   - User should be able to log in immediately
   - Their dashboard should reflect their role
   - Test authentication: `getCurrentUser()`

### Updating Users

1. **Find User Record**
   - Use `findRowByID(SHEETS.USERS, 'UserID', userID)`
   - Or search in Users sheet

2. **Update Fields**
   - Use `updateRowByID()` function
   - Or edit directly in sheet
   - Always update `UpdatedOn` timestamp

3. **Common Updates**
   - Role changes
   - Branch transfers
   - Territory assignments
   - Active status changes

### Deactivating Users

1. **Set Active to false**
   - Don't delete user records
   - Set `Active` field to `false`
   - This preserves historical data

2. **Update Related Records**
   - Reassign leads if needed
   - Reassign opportunities if needed
   - Update territory assignments

### User Roles and Permissions

**Account Executive:**
- View own dashboard
- Manage own pipeline
- Submit daily activity
- Convert leads to opportunities

**Technician:**
- View own dashboard
- Submit leads
- Report issues
- Complete installations

**Operations Manager:**
- View ops dashboard
- Assign specialists
- Resolve issues
- Log daily metrics

**Branch Manager:**
- View branch dashboard
- View team performance
- Generate reports
- Manage alerts

**Administrator:**
- Full system access
- User management
- Territory configuration
- System configuration

---

## Configuring Territories

### Understanding Territories

Territories define which Account Executives handle leads from specific zip codes. When a technician submits a lead, the system automatically assigns it to the correct AE based on the zip code.

### Uploading Territories via CSV

1. **Prepare CSV File**
   Format: `ZipCode, AE_Email, BranchID, TerritoryName`
   
   Example:
   ```
   77001, john.doe@company.com, BRN-001, Downtown Houston
   77002, jane.smith@company.com, BRN-001, Midtown Houston
   ```

2. **Upload Territories**
   ```javascript
   // Read CSV file content
   const csvData = '77001,john.doe@company.com,BRN-001,Downtown Houston\n77002,jane.smith@company.com,BRN-001,Midtown Houston';
   
   // Upload
   const result = uploadTerritories(csvData);
   ```

3. **Verify Upload**
   - Check Territories sheet
   - Test zip code lookup: `getAEForZipCode('77001')`
   - Verify AE assignments

### Manual Territory Configuration

1. **Access Territories Sheet**
   - Open "Territories" sheet

2. **Create Territory Record**
   - **TerritoryID**: Generate using `generateUniqueID('TER')`
   - **AE_UserID**: User ID of the Account Executive
   - **BranchID**: Branch ID
   - **ZipCodes**: Pipe-delimited list (e.g., "77001|77002|77003")
   - **TerritoryName**: Descriptive name
   - **Active**: true/false
   - **CreatedOn**: Current date/time
   - **UpdatedOn**: Current date/time

3. **Update User Record**
   - Update AE's `TerritoryZips` field in Users sheet
   - Should match territory zip codes

### Territory Best Practices

- **No Overlaps**: Ensure zip codes aren't assigned to multiple AEs
- **Complete Coverage**: All service areas should have assigned AEs
- **Regular Updates**: Update territories when AEs change
- **Documentation**: Keep territory names descriptive
- **Testing**: Test zip code lookups after changes

---

## Running Reports

### Available Reports

**Sales Activity Report:**
- Daily sales metrics by AE
- Quote generation and win rates
- Revenue tracking

**Leads Report:**
- Leads submitted by technicians
- Lead assignment and conversion
- Lead status tracking

**Operations Metrics Report:**
- Missed stops tracking
- Backlog percentages
- Overtime metrics
- Coaching activities

**Tracker Data Report:**
- All sales opportunities
- Pipeline by stage
- Win/loss analysis

### Exporting Reports

1. **Using Export Function**
   ```javascript
   // Export sales activity
   const csv = exportReportToCSV('sales_activity', {
     BranchID: 'BRN-001',
     Date: '2024-01-15'
   });
   ```

2. **Report Types**
   - `'sales_activity'`: Sales activity data
   - `'leads'`: Lead data
   - `'operations_metrics'`: Operations metrics
   - `'tracker'`: Tracker/opportunity data

3. **Applying Filters**
   Filters are optional and can include:
   - `BranchID`: Filter by branch
   - `AE_UserID`: Filter by Account Executive
   - `Date`: Filter by date (requires date range logic)
   - `Status`: Filter by status

### Running Test Suite

**Run All Tests:**
```javascript
runAllTests();
```

**Individual Test Functions:**
- `testDatabaseSetup()`: Verify all sheets exist
- `testLeadRouting()`: Test lead routing functionality
- `testSalesModule()`: Test sales module functions
- `testOperationsModule()`: Test operations module
- `testReporting()`: Test reporting and CSV export
- `testBranchManagerModule()`: Test branch manager functions

**Viewing Test Results:**
- Check Logger output in Apps Script editor
- Review test logs for failures
- Fix any issues identified

---

## System Maintenance

### Daily Maintenance

**Automated Tasks:**
- Daily summary calculations (if triggers are set up)
- Notification cleanup (optional)
- Audit log management

**Manual Tasks:**
- Review error logs
- Check for failed operations
- Verify data integrity

### Weekly Maintenance

1. **Data Integrity Checks**
   - Verify all required sheets exist
   - Check for orphaned records
   - Validate relationships between tables

2. **Performance Review**
   - Check system performance
   - Review audit logs
   - Identify any issues

3. **User Management**
   - Review active users
   - Update user information as needed
   - Deactivate inactive users

### Monthly Maintenance

1. **Backup Data**
   - Export critical data
   - Archive old records if needed
   - Verify backup integrity

2. **System Updates**
   - Review and apply code updates
   - Test new features
   - Update documentation

3. **Territory Review**
   - Review territory assignments
   - Update as needed
   - Verify coverage

### Audit Log Management

The system maintains an audit log of all actions:
- **Location**: AuditLog sheet
- **Contents**: Timestamp, user, action, table, record ID, details
- **Retention**: Keep indefinitely or archive periodically
- **Review**: Check regularly for errors or issues

---

## Troubleshooting

### Common Issues

**User Cannot Log In:**
1. Verify user exists in Users sheet
2. Check that email matches Google account
3. Verify user is marked as Active
4. Check role assignment

**Leads Not Assigning:**
1. Verify territories are configured
2. Check zip code format (must be 5 digits)
3. Verify AE exists and is active
4. Test: `getAEForZipCode('77001')`

**Dashboard Not Loading:**
1. Check user authentication
2. Verify user has required role
3. Check for JavaScript errors
4. Verify all required sheets exist

**Data Not Saving:**
1. Check sheet permissions
2. Verify sheet exists
3. Check for validation errors
4. Review audit log for errors

**CSV Export Failing:**
1. Verify report type is valid
2. Check sheet exists
3. Verify data format
4. Check for special characters in data

### Debugging Tools

**Logger:**
```javascript
Logger.log('Debug message');
// View in Apps Script editor: View > Logs
```

**Test Functions:**
```javascript
// Test specific functions
const user = getCurrentUser();
Logger.log(user);

const ae = getAEForZipCode('77001');
Logger.log(ae);
```

**Data Verification:**
```javascript
// Check sheet data
const data = getSheetData(SHEETS.USERS);
Logger.log(data.length + ' users found');
```

### Getting Help

1. **Check Documentation**
   - Review this guide
   - Check API documentation
   - Review user guides

2. **Review Logs**
   - Check audit log
   - Review error logs
   - Check test results

3. **Contact Support**
   - Document the issue
   - Include error messages
   - Provide steps to reproduce

---

## System Configuration

### Configuration Files

**config.gs:**
- Sheet names
- Database schemas
- User roles
- Status definitions

**Modifying Configuration:**
- Update constants in config.gs
- Ensure all modules reference updated values
- Test changes thoroughly
- Update documentation

### Environment Setup

**Required:**
- Google Apps Script project
- Google Sheets spreadsheet
- User Google accounts
- Appropriate permissions

**Permissions:**
- Users need edit access to spreadsheet
- Script needs authorization for:
  - Spreadsheet access
  - Email sending (for notifications)
  - User information access

---

**Last Updated:** 2024
**Version:** 1.0

