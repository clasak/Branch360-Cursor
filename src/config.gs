/**
 * Branch360 CRM - Configuration
 * All sheet names and schema definitions
 */

// SHEET NAMES
const SHEETS = {
  // Core Tables
  USERS: "Users",
  BRANCHES: "Branches",
  REGIONS: "Regions",
  MARKETS: "Markets",
  TERRITORIES: "Territories",
  
  // Sales Tables
  TRACKER: "TrackerData",
  QUOTES: "Quotes",
  SALES_ACTIVITY: "Sales_Activity",
  ACCOUNTS: "Accounts",
  
  // Operations Tables
  LEADS: "Leads",
  OPERATIONS_METRICS: "Operations_Metrics",
  START_PACKETS: "StartPackets",
  SERVICE_ISSUES: "Service_Issues",
  UNIFIED_SALES: "Unified_Sales",
  SERVICE_MONTHS: "Service_Months",
  SRA_HAZARDS: "SRA_Hazards",
  OPS_PIPELINE: "Ops_Pipeline",

  // Reporting Tables
  BRANCH_DAILY_SUMMARY: "Branch_Daily_Summary",
  REGION_SUMMARY: "Region_Summary",
  MARKET_SUMMARY: "Market_Summary",
  REVENUE: "Revenue",
  ACTIVITY_LOG: "ActivityLog",
  
  // System Tables
  AUDIT_LOG: "AuditLog",
  NOTIFICATIONS: "Notifications",
  PREFERENCES: "Preferences"
};

// DATABASE SCHEMAS
const DB_SCHEMA = {
  [SHEETS.USERS]: [
    "UserID", "Name", "Email", "Role", "BranchID", "TerritoryZips", 
    "Active", "PhoneNumber", "EmailNotifications", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.BRANCHES]: [
    "BranchID", "BranchName", "BranchCode", "RegionID", "ManagerUserID", 
    "Address", "Phone", "Active", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.REGIONS]: [
    "RegionID", "RegionName", "RegionCode", "MarketID", "DirectorUserID", 
    "Active", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.MARKETS]: [
    "MarketID", "MarketName", "MarketCode", "DirectorUserID", 
    "Active", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.TERRITORIES]: [
    "TerritoryID", "AE_UserID", "BranchID", "ZipCodes", "TerritoryName",
    "Active", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.TRACKER]: [
    "EntryID", "Date", "AE_UserID", "BranchID", "Stage", "Customer_Name", 
    "Service_Address", "ZipCode", "POC_Name", "POC_Phone", "POC_Email", 
    "Source", "Sale_Type", "Service_Description", "Initial_Fee", "Monthly_Fee", 
    "Frequency", "Annual_Value", "PestPac_ID", "Date_Proposal", "Date_Sold", 
    "Date_Dead", "Status", "Notes", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.QUOTES]: [
    "QuoteID", "TrackerEntryID", "AE_UserID", "AccountID", "BranchID",
    "Quote_Value", "Status", "Services", "CreatedDate", "ClosedDate", 
    "WinRate", "Salesforce_ID", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.SALES_ACTIVITY]: [
    "ActivityID", "Date", "AE_UserID", "BranchID", "RegionID", "MarketID",
    "Proposals_Delivered", "LOBs_On_Proposals", "LOBs_Sold", "Dollars_Sold",
    "Dollars_Proposed", "NextDay_CONF_Count", "Events_Completed", "Events_Summary",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.ACCOUNTS]: [
    "AccountID", "Customer_Name", "Service_Address", "Billing_Address",
    "POC_Name", "POC_Phone", "POC_Email", "AE_UserID", "BranchID",
    "Vertical", "Status", "LifetimeValue", "PestPac_ID", "Salesforce_ID",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.LEADS]: [
    "LeadID", "Date", "Tech_UserID", "Customer_Name", "Service_Address", 
    "ZipCode", "Phone", "Email", "Service_Type", "Notes", "Status", 
    "Assigned_AE_UserID", "AssignedOn", "LastContactDate", "ConvertedToTrackerID",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.OPERATIONS_METRICS]: [
    "MetricID", "Date", "UserID", "BranchID", "RegionID", "MarketID",
    "MissedStops_TMX", "MissedStops_RNA", "Backlog_Percent", "OT_Percent",
    "Forecasted_Hours", "Request_Review_Goal", "Request_Review_Actual",
    "Coaching_Rides", "TAP_From_Coaching", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.START_PACKETS]: [
    "PacketID", "BranchID", "TrackerEntryID", "Sold_Date", "Account_Name", "Service_Address",
    "Sales_Rep", "Initial_Job_Price", "Maintenance_Price", "Service_Type",
    "Frequency", "Operations_Manager", "Assigned_Specialist", "Date_Install_Scheduled",
    "Status_Install_Complete", "Materials_Ordered", "Log_Book_Needed",
    "POC_Name_Phone", "Confirmed_Start_Date", "Special_Notes", "Status", "PestPac_ID",
    "Billing_Email", "Billing_Address", "Billing_Address_Different", 
    "MRT_Count", "RBS_Count", "ILT_Count", "Initial_Service_Description",
    "Maintenance_Scope_Description", "Service_Areas",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.SERVICE_ISSUES]: [
    "IssueID", "Date", "Customer_Name", "TrackerEntryID", "AccountID",
    "Issue_Type", "Severity", "Description", "Assigned_Tech_UserID",
    "Status", "Resolution_Notes", "ReportedBy_UserID", "CreatedOn", "ResolvedOn"
  ],

  [SHEETS.UNIFIED_SALES]: [
    "RecordID", "BranchID", "SoldDate", "AccountName", "Service_Address", "SalesRepIDs",
    "POCName", "POCPhone", "RequestedStartMonth", "PestPacConfirmed", "TapLeadFlag",
    "InitialPrice", "MaintenancePrice", "ServiceType", "LeadType", "JobType",
    "Frequency", "ServiceName", "ServiceMonths", "CoveredPests", "SpecialNotes",
    "LogBookNeeded", "PNOLRequired", "SRACompletedBy", "SRADate", "SRATime",
    "SRAAdditionalHazards", "SRAHazardRef", "Status", "Initial_Service_Description",
    "Maintenance_Scope_Description", "CreatedOn", "UpdatedOn"
  ],

  [SHEETS.SERVICE_MONTHS]: [
    "ServiceMonthID", "RecordID", "MonthName", "CreatedOn"
  ],

  [SHEETS.SRA_HAZARDS]: [
    "HazardID", "RecordID", "Hazard", "ControlMeasure", "SafeToProceed", "CreatedOn"
  ],

  [SHEETS.OPS_PIPELINE]: [
    "WorkflowID", "RecordID", "OperationsManager", "ConfirmedStartDate", "AssignedSpecialist",
    "MaterialsOrdered", "InstallStarted", "Status", "Notes", "UpdatedOn"
  ],
  
  [SHEETS.BRANCH_DAILY_SUMMARY]: [
    "SummaryID", "Date", "BranchID", "RegionID", "MarketID",
    "TAP_Goal", "TAP_Actual", "Appointments_Set", "Appointments_Completed",
    "Quotes_Created", "Quotes_Won", "Quote_Value", "WinRate_Percent",
    "Daily_Sales_Goal", "Daily_Sales_Actual", "MissedStops_TMX", "MissedStops_RNA",
    "Backlog_Percent", "OT_Percent", "Forecasted_Hours", "Request_Review_Goal",
    "Request_Review_Actual", "Coaching_Rides", "TAP_From_Coaching",
    "Revenue_Percent_Goal", "Backlog_Index", "Labor_Efficiency", "Forecast_Accuracy",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.REGION_SUMMARY]: [
    "SummaryID", "Date", "RegionID", "MarketID",
    "TAP_Goal", "TAP_Actual", "Appointments_Set", "Appointments_Completed",
    "Quotes_Created", "Quotes_Won", "Quote_Value", "WinRate_Percent",
    "Daily_Sales_Goal", "Daily_Sales_Actual", "MissedStops_TMX", "MissedStops_RNA",
    "Backlog_Percent", "OT_Percent", "Total_Revenue", "Total_Revenue_Goal",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.MARKET_SUMMARY]: [
    "SummaryID", "Date", "MarketID",
    "TAP_Goal", "TAP_Actual", "Appointments_Set", "Appointments_Completed",
    "Quotes_Created", "Quotes_Won", "Quote_Value", "WinRate_Percent",
    "Daily_Sales_Goal", "Daily_Sales_Actual", "Total_Revenue", "Total_Revenue_Goal",
    "Total_Employees", "Total_Branches", "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.REVENUE]: [
    "RevID", "Date", "BranchID", "RegionID", "MarketID",
    "Daily_Goal", "Daily_Actual", "Scheduled_Tomorrow", "Forecasted_Revenue",
    "YOY_Target", "YOY_Actual", "CreatedOn", "UpdatedOn"
  ],

  [SHEETS.ACTIVITY_LOG]: [
    "ActivityID", "UserID", "Role", "BranchID", "ActionType",
    "ContextID", "StartedAt", "CompletedAt", "DurationSeconds",
    "TimeSavedSeconds", "Meta", "Environment"
  ],
  
  [SHEETS.AUDIT_LOG]: [
    "Timestamp", "UserEmail", "UserID", "Action", "Table", "RecordID",
    "Details", "IPAddress", "UserAgent"
  ],
  
  [SHEETS.NOTIFICATIONS]: [
    "NotificationID", "UserID", "Type", "Title", "Message", "Data",
    "Read", "ActionURL", "CreatedOn"
  ],
  
  [SHEETS.PREFERENCES]: [
    "UserID", "DefaultDashboard", "DefaultMarket", "DefaultRegion", "DefaultBranch",
    "EmailNotifications", "Theme", "UpdatedOn"
  ]
};

// USER ROLES
const ROLES = {
  AE: "Account Executive",
  TECH: "Technician",
  OPS_MGR: "Operations Manager",
  BRANCH_MGR: "Branch Manager",
  REGIONAL_DIR: "Regional Director",
  MARKET_DIR: "Market Director",
  EXECUTIVE: "Executive",
  ADMIN: "Administrator"
};

// LEAD/OPPORTUNITY STATUSES
const STATUSES = {
  LEAD: ["New", "Contacted", "Qualified", "Converted", "Lost"],
  TRACKER: ["Proposal", "Negotiation", "Sold", "Dead", "On Hold"],
  SERVICE_ISSUE: ["Open", "In Progress", "Resolved", "Escalated"],
  INSTALL: ["Pending", "Scheduled", "In Progress", "Complete", "Cancelled"]
};

// EXTERNAL API TOKENS
const API_TOKENS = {
  MAPBOX: 'pk.eyJ1IjoiY2xhc2FrIiwiYSI6ImNtaHduMzF4bTAxZjgya3BxMjMzYXNzM2kifQ.Ervu02B9hyFoRYmuQgodIA'
};

// DOCUMENT TEMPLATES & FORMS
// Configure Google Docs/Forms that should be auto-filled
// Set these IDs/URLs in Script Properties or update here
const DOCUMENT_TEMPLATES = {
  // Tracker/Opportunity Documents
  TRACKER_DOC: {
    type: 'doc', // 'doc' for Google Docs, 'form' for Google Forms
    id: '', // Google Doc ID (from URL: docs.google.com/document/d/[ID]/edit)
    enabled: false, // Set to true when template is configured
    placeholders: {
      '{{EntryID}}': 'EntryID',
      '{{Customer_Name}}': 'Customer_Name',
      '{{Service_Address}}': 'Service_Address',
      '{{POC_Name}}': 'POC_Name',
      '{{POC_Phone}}': 'POC_Phone',
      '{{POC_Email}}': 'POC_Email',
      '{{Stage}}': 'Stage',
      '{{Initial_Fee}}': 'Initial_Fee',
      '{{Monthly_Fee}}': 'Monthly_Fee',
      '{{Annual_Value}}': 'Annual_Value',
      '{{Service_Description}}': 'Service_Description',
      '{{Date_Proposal}}': 'Date_Proposal',
      '{{Date_Sold}}': 'Date_Sold',
      '{{Notes}}': 'Notes'
    }
  },
  
  // Start Packet Documents
  START_PACKET_DOC: {
    type: 'doc',
    id: '', // Google Doc ID for start packet template
    enabled: false,
    placeholders: {
      '{{PacketID}}': 'PacketID',
      '{{Account_Name}}': 'Account_Name',
      '{{Service_Address}}': 'Service_Address',
      '{{Sales_Rep}}': 'Sales_Rep',
      '{{Initial_Job_Price}}': 'Initial_Job_Price',
      '{{Maintenance_Price}}': 'Maintenance_Price',
      '{{Service_Type}}': 'Service_Type',
      '{{Frequency}}': 'Frequency',
      '{{POC_Name_Phone}}': 'POC_Name_Phone',
      '{{Special_Notes}}': 'Special_Notes',
      '{{Sold_Date}}': 'Sold_Date',
      '{{Service_Areas}}': 'Service_Areas',
      '{{Initial_Service_Description}}': 'Initial_Service_Description',
      '{{Maintenance_Scope_Description}}': 'Maintenance_Scope_Description'
    }
  },
  
  // Daily Activity Forms (for AEs)
  DAILY_ACTIVITY_FORM: {
    type: 'form',
    id: '', // Google Form ID (from URL: docs.google.com/forms/d/[ID]/edit)
    enabled: false,
    fields: {
      'Date': 'Date',
      'AE_UserID': 'AE_UserID',
      'Proposals_Delivered': 'Proposals_Delivered',
      'LOBs_On_Proposals': 'LOBs_On_Proposals',
      'LOBs_Sold': 'LOBs_Sold',
      'Dollars_Sold': 'Dollars_Sold',
      'Dollars_Proposed': 'Dollars_Proposed',
      'NextDay_CONF_Count': 'NextDay_CONF_Count',
      'Events_Completed': 'Events_Completed',
      'Events_Summary': 'Events_Summary'
    }
  },
  
  // Operations Metrics Forms (for Ops Managers)
  OPS_METRICS_FORM: {
    type: 'form',
    id: '',
    enabled: false,
    fields: {
      'Date': 'Date',
      'UserID': 'UserID',
      'BranchID': 'BranchID',
      'MissedStops_TMX': 'MissedStops_TMX',
      'MissedStops_RNA': 'MissedStops_RNA',
      'Backlog_Percent': 'Backlog_Percent',
      'OT_Percent': 'OT_Percent',
      'Forecasted_Hours': 'Forecasted_Hours',
      'Request_Review_Goal': 'Request_Review_Goal',
      'Request_Review_Actual': 'Request_Review_Actual',
      'Coaching_Rides': 'Coaching_Rides',
      'TAP_From_Coaching': 'TAP_From_Coaching'
    }
  },
  
  // Lead Submission Forms (for Technicians)
  LEAD_FORM: {
    type: 'form',
    id: '',
    enabled: false,
    fields: {
      'Date': 'Date',
      'Customer_Name': 'Customer_Name',
      'Service_Address': 'Service_Address',
      'ZipCode': 'ZipCode',
      'Phone': 'Phone',
      'Email': 'Email',
      'Service_Type': 'Service_Type',
      'Notes': 'Notes'
    }
  }
};

/**
 * Get document template configuration
 * Can be overridden via Script Properties for dynamic configuration
 */
function getDocumentTemplate(templateKey) {
  const template = DOCUMENT_TEMPLATES[templateKey];
  if (!template) return null;
  
  // Check Script Properties for override
  const props = PropertiesService.getScriptProperties();
  const propKey = 'DOC_TEMPLATE_' + templateKey;
  const propValue = props.getProperty(propKey);
  
  if (propValue) {
    try {
      const override = JSON.parse(propValue);
      return Object.assign({}, template, override);
    } catch (e) {
      Logger.log('Error parsing template override: ' + e.message);
    }
  }
  
  return template;
}
