# Document Integration Setup Guide

## Overview

The Branch360 system can automatically fill out existing Google Docs and Google Forms when data is created or updated in the CRM. This eliminates manual data entry and ensures consistency across your documents.

## Supported Documents & Forms

### 1. Tracker Documents (for AEs)
- **When**: Created when an opportunity is created or updated
- **Template Key**: `TRACKER_DOC`
- **Data Source**: TrackerData sheet
- **Fields**: EntryID, Customer_Name, Service_Address, POC info, pricing, dates, notes

### 2. Start Packet Documents (for Operations)
- **When**: Created when an opportunity is marked "Sold"
- **Template Key**: `START_PACKET_DOC`
- **Data Source**: StartPackets sheet
- **Fields**: PacketID, Account_Name, Service_Address, Sales_Rep, pricing, service details

### 3. Daily Activity Forms (for AEs)
- **When**: Submitted when AE logs daily activity
- **Template Key**: `DAILY_ACTIVITY_FORM`
- **Data Source**: Sales_Activity sheet
- **Fields**: Date, proposals, LOBs, dollars sold/proposed, events

### 4. Operations Metrics Forms (for Ops Managers)
- **When**: Submitted when Ops Manager logs daily metrics
- **Template Key**: `OPS_METRICS_FORM`
- **Data Source**: Operations_Metrics sheet
- **Fields**: Date, missed stops, backlog, OT%, forecasted hours, coaching

### 5. Lead Forms (for Technicians)
- **When**: Submitted when technician submits a lead
- **Template Key**: `LEAD_FORM`
- **Data Source**: Leads sheet
- **Fields**: Date, Customer_Name, Service_Address, ZipCode, contact info, notes

## Setup Instructions

### Step 1: Create Your Templates

#### For Google Docs:
1. Create a Google Doc with placeholders like `{{Customer_Name}}`, `{{EntryID}}`, etc.
2. Copy the Document ID from the URL:
   - URL format: `https://docs.google.com/document/d/[DOCUMENT_ID]/edit`
   - The Document ID is the long string between `/d/` and `/edit`

#### For Google Forms:
1. Create a Google Form with fields matching your data
2. Copy the Form ID from the URL:
   - URL format: `https://docs.google.com/forms/d/[FORM_ID]/edit`
   - The Form ID is the long string between `/d/` and `/edit`

### Step 2: Configure Templates

You have two options:

#### Option A: Configure via Script Properties (Recommended)

Run this function in the Apps Script editor for each template:

```javascript
// Example: Configure start packet document
configureDocumentTemplate('START_PACKET_DOC', {
  id: 'YOUR_DOCUMENT_ID_HERE',
  enabled: true
});

// Example: Configure daily activity form
configureDocumentTemplate('DAILY_ACTIVITY_FORM', {
  id: 'YOUR_FORM_ID_HERE',
  enabled: true
});
```

#### Option B: Edit config.gs Directly

1. Open `src/config.gs`
2. Find the `DOCUMENT_TEMPLATES` constant
3. Update the template you want to use:
   ```javascript
   START_PACKET_DOC: {
     type: 'doc',
     id: 'YOUR_DOCUMENT_ID_HERE',  // Add your document ID
     enabled: true,                  // Change to true
     placeholders: { ... }
   }
   ```

### Step 3: Map Placeholders (For Google Docs)

For Google Docs, you need to use placeholders in your template that match the configuration:

**Available Placeholders for Tracker Documents:**
- `{{EntryID}}`
- `{{Customer_Name}}`
- `{{Service_Address}}`
- `{{POC_Name}}`
- `{{POC_Phone}}`
- `{{POC_Email}}`
- `{{Stage}}`
- `{{Initial_Fee}}`
- `{{Monthly_Fee}}`
- `{{Annual_Value}}`
- `{{Service_Description}}`
- `{{Date_Proposal}}`
- `{{Date_Sold}}`
- `{{Notes}}`

**Available Placeholders for Start Packet Documents:**
- `{{PacketID}}`
- `{{Account_Name}}`
- `{{Service_Address}}`
- `{{Sales_Rep}}`
- `{{Initial_Job_Price}}`
- `{{Maintenance_Price}}`
- `{{Service_Type}}`
- `{{Frequency}}`
- `{{POC_Name_Phone}}`
- `{{Special_Notes}}`
- `{{Sold_Date}}`
- `{{Service_Areas}}`
- `{{Initial_Service_Description}}`
- `{{Maintenance_Scope_Description}}`

### Step 4: Map Form Fields (For Google Forms)

For Google Forms, the system will try to match form field titles with data fields. Make sure your form field titles match the field names in the configuration, or use partial matching.

**Example Form Field Titles:**
- "Date" → matches `Date` field
- "Customer Name" → matches `Customer_Name` field
- "Service Address" → matches `Service_Address` field

### Step 5: Test the Integration

1. Create a test record in the CRM (e.g., submit a lead, create an opportunity)
2. Check the Apps Script execution log (View > Logs) for success messages
3. Verify the document/form was filled correctly

## How It Works

### For Google Docs:
1. System creates a copy of your template document
2. Replaces all placeholders with actual data
3. Formats dates and currency automatically
4. Saves the new document
5. Returns the document URL

### For Google Forms:
1. System opens your form
2. Matches form fields with data fields
3. Fills in the form responses
4. Submits the form automatically
5. Returns the form URL and number of fields filled

## Troubleshooting

### Document/Form Not Being Created

1. **Check if template is enabled:**
   ```javascript
   const template = getDocumentTemplate('START_PACKET_DOC');
   Logger.log('Enabled: ' + template.enabled);
   Logger.log('ID: ' + template.id);
   ```

2. **Check Apps Script logs** for error messages (View > Logs)

3. **Verify document/form IDs** are correct

4. **Check permissions** - the script needs access to Google Drive

### Placeholders Not Replaced

1. **Verify placeholder syntax** - must be exactly `{{FieldName}}`
2. **Check field names** match the configuration
3. **Ensure data exists** in the source record

### Form Fields Not Filled

1. **Check form field titles** match data field names
2. **Verify form is published** (required for programmatic access)
3. **Check field types** - some types (like checkboxes) require specific data formats

## Advanced Configuration

### Custom Placeholder Mapping

You can customize which fields map to which placeholders by editing the `placeholders` object in `config.gs`:

```javascript
TRACKER_DOC: {
  placeholders: {
    '{{CustomField}}': 'Customer_Name',  // Maps {{CustomField}} to Customer_Name data
    '{{EntryID}}': 'EntryID'
  }
}
```

### Dynamic Template Selection

You can select different templates based on conditions by modifying the integration functions in `document-integration.gs`.

## Security Notes

- Document templates should be stored in a shared Drive folder with appropriate permissions
- Form responses are submitted automatically - ensure forms are configured correctly
- All document creation is logged in the audit log

## Support

For issues or questions:
1. Check the Apps Script execution logs
2. Review the audit log for document creation events
3. Verify template configurations match your documents/forms

