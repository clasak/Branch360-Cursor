# Branch360 API Documentation

## Overview

Branch360 is a Google Apps Script-based CRM system. All functions are server-side and accessible through the Apps Script runtime. This document provides a comprehensive reference for all available API endpoints and functions.

## Base URL

All functions are called directly from Google Apps Script:
```javascript
// Example: Calling from Apps Script
const dashboard = getAEDashboard();
```

## Authentication

Authentication is handled automatically via Google Apps Script's `Session.getActiveUser()`:
```javascript
// Current user is determined automatically
const user = getCurrentUser();
```

**Note:** Users must be registered in the Users sheet with a matching email address.

---

## API Endpoints

### Sales Module

#### GET /getAEDashboard
Get Account Executive dashboard data.

**Parameters:**
- `userID` (optional): Specific user ID. If not provided, uses current authenticated user.

**Returns:**
```javascript
{
  user: {
    name: string,
    email: string,
    branchID: string
  },
  todayMetrics: {
    tapGoal: number,
    tapActual: number,
    appointmentsSet: number,
    appointmentsCompleted: number,
    quotesCreated: number,
    quotesWon: number,
    salesGoal: number,
    salesActual: number,
    hasEntry: boolean
  },
  monthMetrics: {
    totalTAP: number,
    totalAppointments: number,
    totalQuotes: number,
    totalQuotesWon: number,
    totalSales: number,
    winRate: string,
    daysActive: number
  },
  pipeline: {
    stages: {
      proposal: Array<Object>,
      negotiation: Array<Object>,
      sold: Array<Object>,
      onHold: Array<Object>
    },
    totalValue: number,
    totalOpportunities: number
  },
  newLeads: Array<Object>,
  recentActivity: Array<Object>,
  upcomingTasks: Array<Object>
}
```

**Example:**
```javascript
const dashboard = getAEDashboard();
// Or for specific user:
const dashboard = getAEDashboard('USR-1234567890-1234');
```

---

#### POST /saveDailySalesActivity
Save daily sales activity metrics.

**Parameters:**
```javascript
{
  tapGoal: number,              // Default: 10
  tapActual: number,            // Required
  appointmentsSet: number,      // Required
  appointmentsCompleted: number, // Required
  quotesCreated: number,        // Required
  quotesWon: number,            // Required
  quoteValue: number,           // Required
  salesGoal: number,            // Default: 5000
  salesActual: number           // Required
}
```

**Returns:**
```javascript
{
  success: boolean,
  activityID: string,
  updated: boolean  // true if updated existing entry, false if created new
}
```

**Example:**
```javascript
const result = saveDailySalesActivity({
  tapGoal: 10,
  tapActual: 8,
  appointmentsSet: 3,
  appointmentsCompleted: 2,
  quotesCreated: 2,
  quotesWon: 1,
  quoteValue: 12000,
  salesGoal: 5000,
  salesActual: 4500
});
```

---

#### POST /createOpportunity
Create a new sales opportunity in the tracker.

**Parameters:**
```javascript
{
  customerName: string,          // Required
  serviceAddress: string,       // Required
  zipCode: string,               // Optional
  pocName: string,               // Optional
  pocPhone: string,              // Optional
  pocEmail: string,              // Optional
  source: string,                // Default: 'Direct'
  saleType: string,              // Default: 'New Business'
  serviceDescription: string,    // Optional
  initialFee: number,            // Default: 0
  monthlyFee: number,            // Default: 0
  frequency: number,             // Default: 12
  annualValue: number,           // Default: 0
  pestPacID: string,            // Optional
  notes: string                  // Optional
}
```

**Returns:**
```javascript
{
  success: boolean,
  entryID: string
}
```

**Example:**
```javascript
const result = createOpportunity({
  customerName: 'ABC Company',
  serviceAddress: '123 Main St, Houston, TX 77001',
  zipCode: '77001',
  pocName: 'John Smith',
  pocPhone: '555-1234',
  pocEmail: 'john@abc.com',
  source: 'Referral',
  saleType: 'New Business',
  serviceDescription: 'Commercial Pest Control',
  initialFee: 500,
  monthlyFee: 200,
  frequency: 12,
  annualValue: 2900,
  notes: 'Referred by existing customer'
});
```

---

#### POST /updateOpportunityStage
Update the stage of an opportunity.

**Parameters:**
- `entryID` (string): Tracker entry ID
- `newStage` (string): New stage ('Proposal', 'Negotiation', 'Sold', 'Dead', 'On Hold')
- `notes` (string, optional): Notes about the stage change

**Returns:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
const result = updateOpportunityStage('TRK-1234567890-1234', 'Sold', 'Customer signed contract');
```

---

### Lead Routing Module

#### POST /submitLead
Submit a new lead from a technician.

**Parameters:**
```javascript
{
  customer_name: string,     // Required
  service_address: string,   // Required
  zipCode: string,           // Required (5 digits)
  phone: string,            // Optional
  email: string,             // Optional
  service_type: string,      // Default: 'Pest Control'
  notes: string              // Optional
}
```

**Returns:**
```javascript
{
  success: boolean,
  leadID: string,
  assignedTo: string,        // AE name or 'Unassigned'
  assignedAE: Object,       // AE object or null
  message: string
}
```

**Example:**
```javascript
const result = submitLead({
  customer_name: 'XYZ Restaurant',
  service_address: '456 Oak Ave, Houston, TX 77002',
  zipCode: '77002',
  phone: '555-5678',
  email: 'contact@xyz.com',
  service_type: 'Pest Control',
  notes: 'Customer mentioned seeing roaches in kitchen'
});
```

---

#### GET /getMyLeads
Get leads assigned to current AE.

**Parameters:**
- `userID` (optional): Specific user ID
- `status` (optional): Filter by status ('New', 'Contacted', 'Qualified', 'Converted', 'Lost')

**Returns:**
```javascript
Array<{
  leadID: string,
  date: Date,
  customer_name: string,
  service_address: string,
  zipCode: string,
  phone: string,
  email: string,
  service_type: string,
  notes: string,
  status: string,
  lastContactDate: Date,
  submittedBy: string
}>
```

**Example:**
```javascript
// All leads
const leads = getMyLeads();

// New leads only
const newLeads = getMyLeads(null, 'New');
```

---

#### POST /convertLeadToOpportunity
Convert a lead to a sales opportunity.

**Parameters:**
- `leadID` (string): Lead ID to convert

**Returns:**
```javascript
{
  success: boolean,
  entryID: string,
  message: string
}
```

**Example:**
```javascript
const result = convertLeadToOpportunity('LEAD-1234567890-1234');
```

---

#### GET /getAEForZipCode
Get the Account Executive assigned to a zip code.

**Parameters:**
- `zipCode` (string): 5-digit zip code

**Returns:**
```javascript
{
  userID: string,
  name: string,
  email: string,
  branchID: string,
  territoryID: string,
  territoryName: string
}
// Or null if no AE assigned
```

**Example:**
```javascript
const ae = getAEForZipCode('77001');
if (ae) {
  Logger.log('Assigned to: ' + ae.name);
}
```

---

### Operations Module

#### GET /getTechnicianDashboard
Get technician dashboard data.

**Parameters:**
- `userID` (optional): Specific user ID

**Returns:**
```javascript
{
  user: {
    name: string,
    email: string,
    branchID: string
  },
  todayRoute: {
    route_id: string,
    date: Date,
    stops: Array,
    total_stops: number,
    completed_stops: number,
    status: string
  },
  pendingInstalls: Array<Object>,
  leadsSubmitted: Array<Object>,
  recentIssues: Array<Object>
}
```

**Example:**
```javascript
const dashboard = getTechnicianDashboard();
```

---

#### GET /getOpsManagerDashboard
Get Operations Manager dashboard data.

**Parameters:**
- `userID` (optional): Specific user ID

**Returns:**
```javascript
{
  user: {
    name: string,
    email: string,
    branchID: string
  },
  todayMetrics: {
    missedStopsTMX: number,
    missedStopsRNA: number,
    backlogPercent: string,
    otPercent: string,
    hasEntry: boolean
  },
  teamTechnicians: Array<Object>,
  pendingInstalls: Array<Object>,
  openIssues: Array<Object>,
  weeklyMetrics: {
    totalMissedStops: number,
    avgBacklog: string,
    avgOT: string,
    totalCoachingRides: number,
    daysReported: number
  }
}
```

**Example:**
```javascript
const dashboard = getOpsManagerDashboard();
```

---

#### POST /reportServiceIssue
Report a service issue.

**Parameters:**
```javascript
{
  customerName: string,        // Required
  trackerEntryID: string,      // Optional
  accountID: string,           // Optional
  issueType: string,           // Required
  severity: string,            // Default: 'Medium' ('High', 'Medium', 'Low')
  description: string,         // Required
  assignedTechUserID: string   // Optional (defaults to current user)
}
```

**Returns:**
```javascript
{
  success: boolean,
  issueID: string
}
```

**Example:**
```javascript
const result = reportServiceIssue({
  customerName: 'ABC Company',
  issueType: 'Service Quality',
  severity: 'High',
  description: 'Customer reports service was not completed properly'
});
```

---

#### POST /completeInstallation
Mark an installation as complete.

**Parameters:**
- `packetID` (string): Start packet ID
- `completionData` (object):
  ```javascript
  {
    completionDate: Date,  // Optional (defaults to now)
    notes: string         // Optional
  }
  ```

**Returns:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
const result = completeInstallation('PKT-1234567890-1234', {
  completionDate: new Date(),
  notes: 'Installation completed successfully. Customer satisfied.'
});
```

---

#### POST /saveDailyOpsMetrics
Save daily operations metrics.

**Parameters:**
```javascript
{
  missedStopsTMX: number,           // Required
  missedStopsRNA: number,           // Required
  backlogPercent: number,            // Required
  otPercent: number,                 // Required
  forecastedHours: number,           // Optional
  requestReviewGoal: number,         // Optional
  requestReviewActual: number,       // Optional
  coachingRides: number,             // Optional
  tapFromCoaching: number            // Optional
}
```

**Returns:**
```javascript
{
  success: boolean,
  metricID: string,
  updated: boolean
}
```

**Example:**
```javascript
const result = saveDailyOpsMetrics({
  missedStopsTMX: 2,
  missedStopsRNA: 1,
  backlogPercent: 5.5,
  otPercent: 3.2,
  forecastedHours: 160,
  requestReviewGoal: 10,
  requestReviewActual: 8,
  coachingRides: 2,
  tapFromCoaching: 1
});
```

---

#### POST /assignSpecialistToInstall
Assign a specialist to an installation.

**Parameters:**
- `packetID` (string): Start packet ID
- `specialistUserID` (string): User ID of the specialist

**Returns:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
const result = assignSpecialistToInstall('PKT-1234567890-1234', 'USR-1234567890-5678');
```

---

#### POST /resolveServiceIssue
Resolve a service issue.

**Parameters:**
- `issueID` (string): Issue ID
- `resolutionNotes` (string): Notes about the resolution

**Returns:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
const result = resolveServiceIssue('ISS-1234567890-1234', 'Issue resolved by sending technician for follow-up service. Customer satisfied.');
```

---

### Branch Manager Module

#### GET /getBranchManagerDashboard
Get Branch Manager dashboard data.

**Parameters:**
- `userID` (optional): Specific user ID

**Returns:**
```javascript
{
  user: {
    name: string,
    branchID: string
  },
  todaySummary: {
    sales: {
      tap: number,
      appointments: number,
      quotes: number,
      revenue: number
    },
    operations: {
      missedStops: number,
      backlog: string
    }
  },
  salesTeam: Array<Object>,
  opsTeam: Array<Object>,
  pipeline: {
    proposal: number,
    negotiation: number,
    sold: number,
    total: number
  },
  alerts: Array<Object>,
  weekTrends: {
    thisWeek: number,
    lastWeek: number,
    change: string
  }
}
```

**Example:**
```javascript
const dashboard = getBranchManagerDashboard();
```

---

#### POST /generateDailyCadenceReport
Generate daily cadence report for branch.

**Parameters:**
- `branchID` (string): Branch ID

**Returns:**
```javascript
{
  success: boolean,
  summaryID: string
}
```

**Example:**
```javascript
const result = generateDailyCadenceReport('BRN-1234567890-1234');
```

---

### Reporting Module

#### GET /exportReportToCSV
Export report data to CSV format.

**Parameters:**
- `reportType` (string): Report type ('sales_activity', 'leads', 'operations_metrics', 'tracker')
- `filters` (object, optional): Filter criteria

**Returns:**
```javascript
string  // CSV formatted string
```

**Example:**
```javascript
// Export all sales activity
const csv = exportReportToCSV('sales_activity', {});

// Export filtered leads
const csv = exportReportToCSV('leads', {
  Status: 'New',
  BranchID: 'BRN-1234567890-1234'
});
```

---

## Helper Functions

### getCurrentUser()
Get the current authenticated user.

**Returns:**
```javascript
{
  userID: string,
  name: string,
  email: string,
  role: string,
  branchID: string,
  active: boolean
}
// Or null if not found
```

---

### getSheetData(sheetName, filters)
Get data from a sheet with optional filters.

**Parameters:**
- `sheetName` (string): Sheet name from SHEETS constant
- `filters` (object, optional): Filter criteria

**Returns:**
```javascript
Array<Object>  // Array of row objects
```

**Example:**
```javascript
// Get all users
const users = getSheetData(SHEETS.USERS);

// Get filtered data
const leads = getSheetData(SHEETS.LEADS, {
  Status: 'New',
  BranchID: 'BRN-1234567890-1234'
});
```

---

### findRowByID(sheetName, idColumn, idValue)
Find a specific row by ID.

**Parameters:**
- `sheetName` (string): Sheet name
- `idColumn` (string): ID column name
- `idValue` (string): ID value to find

**Returns:**
```javascript
Object  // Row object or null
```

**Example:**
```javascript
const user = findRowByID(SHEETS.USERS, 'UserID', 'USR-1234567890-1234');
```

---

### updateRowByID(sheetName, idColumn, idValue, updates)
Update a row by ID.

**Parameters:**
- `sheetName` (string): Sheet name
- `idColumn` (string): ID column name
- `idValue` (string): ID value
- `updates` (object): Fields to update

**Returns:**
```javascript
boolean  // Success
```

**Example:**
```javascript
const success = updateRowByID(SHEETS.LEADS, 'LeadID', 'LEAD-1234567890-1234', {
  Status: 'Contacted',
  LastContactDate: new Date()
});
```

---

### generateUniqueID(prefix)
Generate a unique ID with prefix.

**Parameters:**
- `prefix` (string): ID prefix (e.g., 'USR', 'LEAD', 'TRK')

**Returns:**
```javascript
string  // Unique ID
```

**Example:**
```javascript
const leadID = generateUniqueID('LEAD');
// Returns: 'LEAD-1234567890-1234'
```

---

### logAudit(action, table, recordID, details)
Log an action to the audit log.

**Parameters:**
- `action` (string): Action performed
- `table` (string): Table affected
- `recordID` (string): Record ID
- `details` (string): Additional details

**Example:**
```javascript
logAudit('CREATE_OPPORTUNITY', SHEETS.TRACKER, 'TRK-1234567890-1234', 'Created new opportunity');
```

---

## Error Handling

Most functions return an object with a `success` boolean:
```javascript
{
  success: false,
  message: 'Error description'
}
```

Always check the `success` field before proceeding:
```javascript
const result = submitLead(leadData);
if (!result.success) {
  Logger.log('Error: ' + result.message);
  return;
}
// Proceed with success case
```

---

## Constants

### SHEETS
Sheet names constant:
```javascript
SHEETS.USERS
SHEETS.LEADS
SHEETS.TRACKER
SHEETS.SALES_ACTIVITY
// ... etc
```

### ROLES
User roles constant:
```javascript
ROLES.AE
ROLES.TECH
ROLES.OPS_MGR
ROLES.BRANCH_MGR
// ... etc
```

### STATUSES
Status definitions:
```javascript
STATUSES.LEAD
STATUSES.TRACKER
STATUSES.SERVICE_ISSUE
STATUSES.INSTALL
```

---

## Testing

Run the test suite:
```javascript
runAllTests();
```

Individual test functions:
- `testDatabaseSetup()`
- `testLeadRouting()`
- `testSalesModule()`
- `testOperationsModule()`
- `testReporting()`
- `testBranchManagerModule()`

---

**Last Updated:** 2024
**Version:** 1.0

