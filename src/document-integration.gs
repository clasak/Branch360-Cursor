/**
 * Branch360 - Document Integration Module
 * Automatically fills out existing Google Docs and Forms from CRM data
 */

/**
 * Fill out a Google Doc template with data from a record
 * @param {string} templateKey - Key from DOCUMENT_TEMPLATES (e.g., 'TRACKER_DOC')
 * @param {Object} data - Data object with fields matching placeholders
 * @param {string} newDocName - Name for the new filled document
 * @return {Object} {success: boolean, docUrl: string, docId: string}
 */
function fillDocumentTemplate(templateKey, data, newDocName) {
  try {
    const template = getDocumentTemplate(templateKey);
    if (!template) {
      throw new Error('Template not found: ' + templateKey);
    }
    
    if (!template.enabled) {
      Logger.log('Template ' + templateKey + ' is not enabled');
      return { success: false, message: 'Template not enabled' };
    }
    
    if (template.type !== 'doc') {
      throw new Error('Template ' + templateKey + ' is not a document template');
    }
    
    if (!template.id) {
      throw new Error('Template ID not configured for ' + templateKey);
    }
    
    // Open the template document
    const templateDoc = DocumentApp.openById(template.id);
    
    // Create a copy
    const newDoc = templateDoc.makeCopy(newDocName || 'Filled Document');
    const newDocId = newDoc.getId();
    
    // Get the body of the new document
    const body = newDoc.getBody();
    
    // Replace all placeholders with actual data
    Object.keys(template.placeholders).forEach(function(placeholder) {
      const fieldName = template.placeholders[placeholder];
      let value = data[fieldName] || '';
      
      // Format dates
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      }
      
      // Format currency
      if (fieldName.includes('Fee') || fieldName.includes('Price') || fieldName.includes('Value')) {
        if (typeof value === 'number') {
          value = '$' + value.toFixed(2);
        }
      }
      
      // Replace placeholder in document
      body.replaceText(placeholder, String(value));
    });
    
    // Save the document
    newDoc.saveAndClose();
    
    const docUrl = newDoc.getUrl();
    
    Logger.log('Document filled: ' + docUrl);
    logAudit('FILL_DOCUMENT', 'Documents', templateKey, 'Created: ' + newDocName);
    
    return {
      success: true,
      docUrl: docUrl,
      docId: newDocId,
      message: 'Document created successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Fill document failed: ' + e.message);
    return {
      success: false,
      message: 'Failed to fill document: ' + e.message
    };
  }
}

/**
 * Fill out a Google Form with data from a record
 * @param {string} templateKey - Key from DOCUMENT_TEMPLATES (e.g., 'DAILY_ACTIVITY_FORM')
 * @param {Object} data - Data object with fields matching form fields
 * @return {Object} {success: boolean, formUrl: string, responseUrl: string}
 */
function fillFormTemplate(templateKey, data) {
  try {
    const template = getDocumentTemplate(templateKey);
    if (!template) {
      throw new Error('Template not found: ' + templateKey);
    }
    
    if (!template.enabled) {
      Logger.log('Template ' + templateKey + ' is not enabled');
      return { success: false, message: 'Template not enabled' };
    }
    
    if (template.type !== 'form') {
      throw new Error('Template ' + templateKey + ' is not a form template');
    }
    
    if (!template.id) {
      throw new Error('Form ID not configured for ' + templateKey);
    }
    
    // Open the form
    const form = FormApp.openById(template.id);
    const formUrl = form.getPublishedUrl();
    
    // Get form items
    const items = form.getItems();
    
    // Create a form response
    const formResponse = form.createResponse();
    
    // Map data to form items
    let filledCount = 0;
    items.forEach(function(item) {
      const itemTitle = item.getTitle();
      
      // Find matching field in template configuration
      let fieldName = null;
      Object.keys(template.fields).forEach(function(key) {
        if (template.fields[key] === itemTitle || key === itemTitle) {
          fieldName = key;
        }
      });
      
      if (!fieldName) {
        // Try to match by partial title
        Object.keys(template.fields).forEach(function(key) {
          if (itemTitle.toLowerCase().includes(key.toLowerCase()) || 
              key.toLowerCase().includes(itemTitle.toLowerCase())) {
            fieldName = key;
          }
        });
      }
      
      if (fieldName && data[fieldName] !== undefined && data[fieldName] !== null) {
        let value = data[fieldName];
        
        // Format dates
        if (value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM/dd/yyyy');
        }
        
        // Handle different form item types
        const itemType = item.getType();
        
        try {
          if (itemType === FormApp.ItemType.TEXT || itemType === FormApp.ItemType.PARAGRAPH_TEXT) {
            formResponse.withItemResponse(item.asTextItem().createResponse(String(value)));
            filledCount++;
          } else if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
            formResponse.withItemResponse(item.asMultipleChoiceItem().createResponse(String(value)));
            filledCount++;
          } else if (itemType === FormApp.ItemType.CHECKBOX) {
            // For checkboxes, value might be an array
            const responses = Array.isArray(value) ? value : [String(value)];
            formResponse.withItemResponse(item.asCheckboxItem().createResponse(responses));
            filledCount++;
          } else if (itemType === FormApp.ItemType.LIST) {
            formResponse.withItemResponse(item.asListItem().createResponse(String(value)));
            filledCount++;
          } else if (itemType === FormApp.ItemType.SCALE) {
            formResponse.withItemResponse(item.asScaleItem().createResponse(Number(value)));
            filledCount++;
          } else if (itemType === FormApp.ItemType.DATE) {
            if (value instanceof Date) {
              formResponse.withItemResponse(item.asDateItem().createResponse(value));
              filledCount++;
            }
          } else if (itemType === FormApp.ItemType.TIME) {
            if (value instanceof Date) {
              formResponse.withItemResponse(item.asTimeItem().createResponse(value));
              filledCount++;
            }
          } else if (itemType === FormApp.ItemType.DATETIME) {
            if (value instanceof Date) {
              formResponse.withItemResponse(item.asDateTimeItem().createResponse(value));
              filledCount++;
            }
          }
        } catch (e) {
          Logger.log('Warning: Could not fill form item "' + itemTitle + '": ' + e.message);
        }
      }
    });
    
    // Submit the form response
    formResponse.submit();
    
    Logger.log('Form filled: ' + filledCount + ' fields filled');
    logAudit('FILL_FORM', 'Forms', templateKey, 'Filled ' + filledCount + ' fields');
    
    return {
      success: true,
      formUrl: formUrl,
      fieldsFilled: filledCount,
      message: 'Form submitted successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Fill form failed: ' + e.message);
    return {
      success: false,
      message: 'Failed to fill form: ' + e.message
    };
  }
}

/**
 * Fill tracker document when opportunity is created or updated
 * @param {string} entryID - Tracker entry ID
 * @param {boolean} createNew - Whether to create a new document or update existing
 */
function fillTrackerDocument(entryID, createNew) {
  try {
    const entry = findRowByID(SHEETS.TRACKER, 'EntryID', entryID);
    if (!entry) {
      throw new Error('Tracker entry not found: ' + entryID);
    }
    
    const template = getDocumentTemplate('TRACKER_DOC');
    if (!template || !template.enabled) {
      Logger.log('Tracker document template not configured or enabled');
      return { success: false, message: 'Template not configured' };
    }
    
    // Get AE info
    const ae = findRowByID(SHEETS.USERS, 'UserID', entry.AE_UserID);
    
    // Prepare data for document
    const data = {
      EntryID: entry.EntryID,
      Customer_Name: entry.Customer_Name || '',
      Service_Address: entry.Service_Address || '',
      POC_Name: entry.POC_Name || '',
      POC_Phone: entry.POC_Phone || '',
      POC_Email: entry.POC_Email || '',
      Stage: entry.Stage || '',
      Initial_Fee: entry.Initial_Fee || 0,
      Monthly_Fee: entry.Monthly_Fee || 0,
      Annual_Value: entry.Annual_Value || 0,
      Service_Description: entry.Service_Description || '',
      Date_Proposal: entry.Date_Proposal || null,
      Date_Sold: entry.Date_Sold || null,
      Notes: entry.Notes || ''
    };
    
    const docName = 'Tracker - ' + entry.Customer_Name + ' - ' + entryID;
    return fillDocumentTemplate('TRACKER_DOC', data, docName);
    
  } catch (e) {
    Logger.log('❌ Fill tracker document failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Fill start packet document when start packet is created
 * @param {string} packetID - Start packet ID
 */
function fillStartPacketDocument(packetID) {
  try {
    const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
    if (!packet) {
      throw new Error('Start packet not found: ' + packetID);
    }
    
    const template = getDocumentTemplate('START_PACKET_DOC');
    if (!template || !template.enabled) {
      Logger.log('Start packet document template not configured or enabled');
      return { success: false, message: 'Template not configured' };
    }
    
    // Prepare data for document
    const data = {
      PacketID: packet.PacketID,
      Account_Name: packet.Account_Name || '',
      Service_Address: packet.Service_Address || '',
      Sales_Rep: packet.Sales_Rep || '',
      Initial_Job_Price: packet.Initial_Job_Price || 0,
      Maintenance_Price: packet.Maintenance_Price || 0,
      Service_Type: packet.Service_Type || '',
      Frequency: packet.Frequency || 12,
      POC_Name_Phone: packet.POC_Name_Phone || '',
      Special_Notes: packet.Special_Notes || '',
      Sold_Date: packet.Sold_Date || null,
      Service_Areas: packet.Service_Areas || '',
      Initial_Service_Description: packet.Initial_Service_Description || '',
      Maintenance_Scope_Description: packet.Maintenance_Scope_Description || ''
    };
    
    const docName = 'Start Packet - ' + packet.Account_Name + ' - ' + packetID;
    return fillDocumentTemplate('START_PACKET_DOC', data, docName);
    
  } catch (e) {
    Logger.log('❌ Fill start packet document failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Fill daily activity form for AE
 * @param {string} activityID - Sales activity ID
 */
function fillDailyActivityForm(activityID) {
  try {
    const activity = findRowByID(SHEETS.SALES_ACTIVITY, 'ActivityID', activityID);
    if (!activity) {
      throw new Error('Activity not found: ' + activityID);
    }
    
    const template = getDocumentTemplate('DAILY_ACTIVITY_FORM');
    if (!template || !template.enabled) {
      Logger.log('Daily activity form template not configured or enabled');
      return { success: false, message: 'Template not configured' };
    }
    
    // Prepare data for form
    const data = {
      Date: activity.Date || new Date(),
      AE_UserID: activity.AE_UserID || '',
      Proposals_Delivered: activity.Proposals_Delivered || 0,
      LOBs_On_Proposals: activity.LOBs_On_Proposals || '',
      LOBs_Sold: activity.LOBs_Sold || '',
      Dollars_Sold: activity.Dollars_Sold || 0,
      Dollars_Proposed: activity.Dollars_Proposed || 0,
      NextDay_CONF_Count: activity.NextDay_CONF_Count || 0,
      Events_Completed: activity.Events_Completed || 0,
      Events_Summary: activity.Events_Summary || ''
    };
    
    return fillFormTemplate('DAILY_ACTIVITY_FORM', data);
    
  } catch (e) {
    Logger.log('❌ Fill daily activity form failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Fill operations metrics form
 * @param {string} metricID - Operations metric ID
 */
function fillOpsMetricsForm(metricID) {
  try {
    const metric = findRowByID(SHEETS.OPERATIONS_METRICS, 'MetricID', metricID);
    if (!metric) {
      throw new Error('Metric not found: ' + metricID);
    }
    
    const template = getDocumentTemplate('OPS_METRICS_FORM');
    if (!template || !template.enabled) {
      Logger.log('Operations metrics form template not configured or enabled');
      return { success: false, message: 'Template not configured' };
    }
    
    // Prepare data for form
    const data = {
      Date: metric.Date || new Date(),
      UserID: metric.UserID || '',
      BranchID: metric.BranchID || '',
      MissedStops_TMX: metric.MissedStops_TMX || 0,
      MissedStops_RNA: metric.MissedStops_RNA || 0,
      Backlog_Percent: metric.Backlog_Percent || 0,
      OT_Percent: metric.OT_Percent || 0,
      Forecasted_Hours: metric.Forecasted_Hours || 0,
      Request_Review_Goal: metric.Request_Review_Goal || 0,
      Request_Review_Actual: metric.Request_Review_Actual || 0,
      Coaching_Rides: metric.Coaching_Rides || 0,
      TAP_From_Coaching: metric.TAP_From_Coaching || 0
    };
    
    return fillFormTemplate('OPS_METRICS_FORM', data);
    
  } catch (e) {
    Logger.log('❌ Fill ops metrics form failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Fill lead form for technician submissions
 * @param {string} leadID - Lead ID
 */
function fillLeadForm(leadID) {
  try {
    const lead = findRowByID(SHEETS.LEADS, 'LeadID', leadID);
    if (!lead) {
      throw new Error('Lead not found: ' + leadID);
    }
    
    const template = getDocumentTemplate('LEAD_FORM');
    if (!template || !template.enabled) {
      Logger.log('Lead form template not configured or enabled');
      return { success: false, message: 'Template not configured' };
    }
    
    // Prepare data for form
    const data = {
      Date: lead.Date || new Date(),
      Customer_Name: lead.Customer_Name || '',
      Service_Address: lead.Service_Address || '',
      ZipCode: lead.ZipCode || '',
      Phone: lead.Phone || '',
      Email: lead.Email || '',
      Service_Type: lead.Service_Type || '',
      Notes: lead.Notes || ''
    };
    
    return fillFormTemplate('LEAD_FORM', data);
    
  } catch (e) {
    Logger.log('❌ Fill lead form failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Configure a document template via Script Properties
 * @param {string} templateKey - Template key
 * @param {Object} config - Configuration object {id: string, enabled: boolean}
 */
function configureDocumentTemplate(templateKey, config) {
  try {
    const props = PropertiesService.getScriptProperties();
    const propKey = 'DOC_TEMPLATE_' + templateKey;
    
    const override = {
      id: config.id || '',
      enabled: config.enabled !== undefined ? config.enabled : false
    };
    
    props.setProperty(propKey, JSON.stringify(override));
    Logger.log('Template configured: ' + templateKey);
    
    return { success: true, message: 'Template configured successfully' };
    
  } catch (e) {
    Logger.log('❌ Configure template failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

