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
  
  // Reporting Tables
  BRANCH_DAILY_SUMMARY: "Branch_Daily_Summary",
  REGION_SUMMARY: "Region_Summary",
  MARKET_SUMMARY: "Market_Summary",
  REVENUE: "Revenue",
  
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
    "TAP_Goal", "TAP_Actual", "Appointments_Set", "Appointments_Completed",
    "Quotes_Created", "Quotes_Won", "Quote_Value", "WinRate_Percent",
    "Daily_Sales_Goal", "Daily_Sales_Actual", "CreatedOn", "UpdatedOn"
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
    "PacketID", "TrackerEntryID", "Sold_Date", "Account_Name", "Service_Address",
    "Sales_Rep", "Initial_Job_Price", "Maintenance_Price", "Service_Type",
    "Frequency", "Operations_Manager", "Assigned_Specialist", "Date_Install_Scheduled",
    "Status_Install_Complete", "Materials_Ordered", "Log_Book_Needed",
    "POC_Name_Phone", "Confirmed_Start_Date", "Special_Notes", "PestPac_ID",
    "CreatedOn", "UpdatedOn"
  ],
  
  [SHEETS.SERVICE_ISSUES]: [
    "IssueID", "Date", "Customer_Name", "TrackerEntryID", "AccountID",
    "Issue_Type", "Severity", "Description", "Assigned_Tech_UserID",
    "Status", "Resolution_Notes", "ReportedBy_UserID", "CreatedOn", "ResolvedOn"
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

