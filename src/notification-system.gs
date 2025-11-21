/**
 * Branch360 - Enhanced Notification System
 * B. AUTOMATION: Email alerts, SMS for technicians (Twilio-ready), nurture campaigns
 */

/**
 * Generate unique ID with prefix
 * @param {string} prefix - Prefix for the ID (e.g., 'NOT', 'USR', 'TRK')
 * @return {string} Unique ID
 */
function generateUniqueID(prefix) {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000000);
  return prefix + '-' + timestamp + '-' + random;
}

/**
 * Notification configuration
 */
const NOTIFICATION_CONFIG = {
  // Email settings
  EMAIL_ENABLED: true,
  EMAIL_FROM_NAME: 'Branch360 CRM',
  
  // SMS settings (Twilio integration)
  SMS_ENABLED: false, // Set to true when Twilio credentials are configured
  TWILIO_ACCOUNT_SID: '', // Configure in Script Properties
  TWILIO_AUTH_TOKEN: '',  // Configure in Script Properties
  TWILIO_PHONE_NUMBER: '', // Your Twilio phone number
  
  // Nurture campaign settings
  NURTURE_CHECK_DAYS: 30, // Check for leads older than 30 days
  
  // Notification types
  TYPES: {
    LEAD_ASSIGNED: 'lead_assigned',
    INSTALL_ASSIGNED: 'install_assignment',
    SERVICE_ISSUE: 'service_issue',
    NURTURE_REMINDER: 'nurture_reminder',
    STATUS_CHANGE: 'status_change',
    QUOTE_EXPIRING: 'quote_expiring',
    NEW_STOP_ADDED: 'new_stop_added',
    APPOINTMENT_REMINDER: 'appointment_reminder'
  }
};

/**
 * Initialize Twilio settings from Script Properties
 * Call this once to configure SMS
 */
function initializeTwilioSettings(accountSid, authToken, phoneNumber) {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'TWILIO_ACCOUNT_SID': accountSid,
    'TWILIO_AUTH_TOKEN': authToken,
    'TWILIO_PHONE_NUMBER': phoneNumber
  });
  
  NOTIFICATION_CONFIG.SMS_ENABLED = true;
  
  Logger.log('✅ Twilio settings configured');
  
  return { success: true, message: 'Twilio configured. SMS notifications enabled.' };
}

/**
 * Get Twilio settings from Script Properties
 */
function getTwilioSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    accountSid: props.getProperty('TWILIO_ACCOUNT_SID'),
    authToken: props.getProperty('TWILIO_AUTH_TOKEN'),
    phoneNumber: props.getProperty('TWILIO_PHONE_NUMBER')
  };
}

/**
 * Send SMS via Twilio
 * @param {string} toPhone - Recipient phone number (E.164 format: +1234567890)
 * @param {string} message - SMS message text
 * @return {Object} Send result
 */
function sendSMS(toPhone, message) {
  const settings = getTwilioSettings();
  
  if (!settings.accountSid || !settings.authToken || !settings.phoneNumber) {
    Logger.log('⚠️ Twilio not configured. SMS not sent.');
    return { success: false, message: 'Twilio not configured' };
  }
  
  try {
    // Twilio API endpoint
    const url = 'https://api.twilio.com/2010-04-01/Accounts/' + settings.accountSid + '/Messages.json';
    
    // Prepare request
    const payload = {
      'From': settings.phoneNumber,
      'To': toPhone,
      'Body': message
    };
    
    const options = {
      'method': 'post',
      'payload': payload,
      'headers': {
        'Authorization': 'Basic ' + Utilities.base64Encode(settings.accountSid + ':' + settings.authToken)
      },
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200 || responseCode === 201) {
      Logger.log('✅ SMS sent to ' + toPhone);
      return { success: true, message: 'SMS sent successfully' };
    } else {
      Logger.log('❌ SMS failed: ' + response.getContentText());
      return { success: false, message: 'SMS failed: ' + responseCode };
    }
    
  } catch (e) {
    Logger.log('❌ SMS error: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Send email notification
 * @param {string} toEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML supported)
 * @return {Object} Send result
 */
function sendEmailNotification(toEmail, subject, body) {
  if (!NOTIFICATION_CONFIG.EMAIL_ENABLED) {
    Logger.log('⚠️ Email notifications disabled');
    return { success: false, message: 'Email notifications disabled' };
  }
  
  try {
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: body,
      name: NOTIFICATION_CONFIG.EMAIL_FROM_NAME
    });
    
    Logger.log('✅ Email sent to ' + toEmail);
    return { success: true, message: 'Email sent successfully' };
    
  } catch (e) {
    Logger.log('❌ Email error: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Create in-app notification
 * @param {string} userID - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data (JSON)
 * @param {string} actionURL - Action URL (optional)
 */
function createNotification(userID, type, title, message, data, actionURL) {
  const notificationsSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEETS.NOTIFICATIONS);
  
  if (!notificationsSheet) {
    Logger.log('⚠️ Notifications sheet not found');
    return { success: false, message: 'Notifications sheet not found' };
  }
  
  const notificationID = generateUniqueID('NOT');
  
  notificationsSheet.appendRow([
    notificationID,
    userID,
    type,
    title,
    message,
    JSON.stringify(data || {}),
    false, // Read = false
    actionURL || '',
    new Date()
  ]);
  
  Logger.log('✅ Created in-app notification for user: ' + userID);
  
  return { success: true, notificationID: notificationID };
}

/**
 * Send multi-channel notification (in-app + email + SMS)
 * @param {string} userID - User ID
 * @param {string} type - Notification type
 * @param {string} title - Title
 * @param {string} message - Message
 * @param {Object} options - Options (data, actionURL, sendEmail, sendSMS)
 * @return {Object} Send results
 */
function sendNotification(userID, type, title, message, options) {
  options = options || {};
  
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) {
    Logger.log('⚠️ User not found: ' + userID);
    return { success: false, message: 'User not found' };
  }
  
  const results = {
    inApp: false,
    email: false,
    sms: false
  };
  
  // 1. Create in-app notification
  const inAppResult = createNotification(userID, type, title, message, options.data, options.actionURL);
  results.inApp = inAppResult.success;
  
  // 2. Send email if enabled and user has email notifications enabled
  if (options.sendEmail !== false && user.EmailNotifications !== false && user.Email) {
    const emailBody = buildEmailTemplate(title, message, options.actionURL);
    const emailResult = sendEmailNotification(user.Email, title, emailBody);
    results.email = emailResult.success;
  }
  
  // 3. Send SMS if enabled and requested
  if (options.sendSMS === true && user.PhoneNumber) {
    const smsText = title + ': ' + message;
    const smsResult = sendSMS(user.PhoneNumber, smsText);
    results.sms = smsResult.success;
  }
  
  return {
    success: true,
    channels: results,
    message: 'Notification sent via ' + 
      (results.inApp ? 'in-app ' : '') +
      (results.email ? 'email ' : '') +
      (results.sms ? 'SMS' : '')
  };
}

/**
 * Build email template
 * @param {string} title - Email title
 * @param {string} message - Email message
 * @param {string} actionURL - Action URL (optional)
 * @return {string} HTML email body
 */
function buildEmailTemplate(title, message, actionURL) {
  let html = '<html><body style="font-family: Arial, sans-serif; padding: 20px;">';
  html += '<h2 style="color: #2563eb;">' + title + '</h2>';
  html += '<p>' + message + '</p>';
  
  if (actionURL) {
    html += '<p><a href="' + actionURL + '" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View Details</a></p>';
  }
  
  html += '<hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">';
  html += '<p style="color: #6b7280; font-size: 12px;">Branch360 CRM | Automated Notification</p>';
  html += '</body></html>';
  
  return html;
}

/**
 * Notify technician of new stop/installation (with SMS)
 * @param {string} techUserID - Technician user ID
 * @param {string} packetID - Start packet ID
 * @return {Object} Notification result
 */
function notifyTechOfNewStop(techUserID, packetID) {
  const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
  if (!packet) {
    return { success: false, message: 'Packet not found' };
  }
  
  const title = '🚨 New Stop Added to Your Route';
  const message = 'Installation for ' + packet.Account_Name + ' at ' + packet.Service_Address + '. Check your dashboard for details.';
  
  return sendNotification(techUserID, NOTIFICATION_CONFIG.TYPES.NEW_STOP_ADDED, title, message, {
    data: {
      packetID: packetID,
      customer: packet.Account_Name,
      address: packet.Service_Address
    },
    actionURL: '/installs/' + packetID,
    sendEmail: true,
    sendSMS: true // SMS for immediate awareness
  });
}

/**
 * Notify AE of lead assignment
 * @param {string} aeUserID - AE user ID
 * @param {string} leadID - Lead ID
 * @return {Object} Notification result
 */
function notifyAEOfLeadAssignment(aeUserID, leadID) {
  const lead = findRowByID(SHEETS.LEADS, 'LeadID', leadID);
  if (!lead) {
    return { success: false, message: 'Lead not found' };
  }
  
  const title = '🎯 New Lead Assigned';
  const message = 'Lead from ' + lead.Customer_Name + ' (' + lead.Service_Type + ') has been assigned to you.';
  
  return sendNotification(aeUserID, NOTIFICATION_CONFIG.TYPES.LEAD_ASSIGNED, title, message, {
    data: {
      leadID: leadID,
      customer: lead.Customer_Name,
      serviceType: lead.Service_Type
    },
    actionURL: '/leads/' + leadID,
    sendEmail: true,
    sendSMS: false
  });
}

/**
 * Nurture campaign: Check for stale leads and remind AEs
 * Triggered by daily/weekly timer
 */
function runNurtureCampaign() {
  Logger.log('💌 Running nurture campaign...');
  
  const leads = getSheetData(SHEETS.LEADS);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_CONFIG.NURTURE_CHECK_DAYS);
  
  let remindersSet = 0;
  
  leads.forEach(function(lead) {
    const status = String(lead.Status || '').toLowerCase();
    const lastContact = lead.LastContactDate ? new Date(lead.LastContactDate) : new Date(lead.Date);
    
    // Check if lead is in "Nurture" or "Contacted" status and hasn't been contacted in 30+ days
    if ((status === 'nurture' || status === 'contacted') && lastContact < cutoffDate) {
      const aeUserID = lead.Assigned_AE_UserID;
      
      if (aeUserID) {
        const title = '🌱 Nurture Lead Reminder';
        const message = 'Lead ' + lead.Customer_Name + ' hasn\'t been contacted in ' + 
          Math.floor((new Date() - lastContact) / (1000 * 60 * 60 * 24)) + ' days. Time to re-engage!';
        
        sendNotification(aeUserID, NOTIFICATION_CONFIG.TYPES.NURTURE_REMINDER, title, message, {
          data: {
            leadID: lead.LeadID,
            customer: lead.Customer_Name,
            daysSinceContact: Math.floor((new Date() - lastContact) / (1000 * 60 * 60 * 24))
          },
          actionURL: '/leads/' + lead.LeadID,
          sendEmail: true,
          sendSMS: false
        });
        
        remindersSet++;
      }
    }
  });
  
  Logger.log('✅ Nurture campaign complete. Sent ' + remindersSet + ' reminders.');
  
  return {
    success: true,
    remindersSent: remindersSet,
    message: 'Sent ' + remindersSet + ' nurture reminders'
  };
}

/**
 * Install nurture campaign trigger
 * Runs weekly on Monday at 9 AM
 */
function installNurtureCampaignTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runNurtureCampaign') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Install new weekly trigger
  ScriptApp.newTrigger('runNurtureCampaign')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  
  Logger.log('✅ Nurture campaign trigger installed (runs Mondays at 9 AM)');
  
  return { success: true, message: 'Nurture campaign trigger installed' };
}

/**
 * Send appointment reminder
 * @param {string} aeUserID - AE user ID
 * @param {Object} appointment - Appointment details
 * @return {Object} Notification result
 */
function sendAppointmentReminder(aeUserID, appointment) {
  const title = '📅 Appointment Reminder';
  const appointmentDate = new Date(appointment.startTime);
  const formattedDate = Utilities.formatDate(appointmentDate, Session.getScriptTimeZone(), 'MMM dd, yyyy h:mm a');
  
  const message = 'Reminder: Appointment with ' + appointment.customer + ' at ' + 
    appointment.location + ' on ' + formattedDate;
  
  return sendNotification(aeUserID, NOTIFICATION_CONFIG.TYPES.APPOINTMENT_REMINDER, title, message, {
    data: appointment,
    sendEmail: true,
    sendSMS: true // SMS for appointments to ensure tech sees it
  });
}

/**
 * Notify on status change
 * @param {string} userID - User to notify
 * @param {string} recordType - Type of record (e.g., 'sale', 'lead', 'install')
 * @param {string} recordID - Record ID
 * @param {string} oldStatus - Old status
 * @param {string} newStatus - New status
 * @return {Object} Notification result
 */
function notifyStatusChange(userID, recordType, recordID, oldStatus, newStatus) {
  const title = '🔄 Status Update: ' + recordType;
  const message = 'Status changed from "' + oldStatus + '" to "' + newStatus + '"';
  
  return sendNotification(userID, NOTIFICATION_CONFIG.TYPES.STATUS_CHANGE, title, message, {
    data: {
      recordType: recordType,
      recordID: recordID,
      oldStatus: oldStatus,
      newStatus: newStatus
    },
    sendEmail: true,
    sendSMS: false
  });
}

/**
 * Get unread notifications for user
 * @param {string} userID - User ID
 * @return {Array<Object>} Unread notifications
 */
function getUnreadNotifications(userID) {
  const notifications = getSheetData(SHEETS.NOTIFICATIONS, { 
    UserID: userID,
    Read: false
  });
  
  // Sort by date descending
  notifications.sort(function(a, b) {
    return new Date(b.CreatedOn) - new Date(a.CreatedOn);
  });
  
  return notifications;
}

/**
 * Mark notification as read
 * @param {string} notificationID - Notification ID
 * @return {Object} Update result
 */
function markNotificationRead(notificationID) {
  const success = updateRowByID(SHEETS.NOTIFICATIONS, 'NotificationID', notificationID, {
    Read: true
  });
  
  return { success: success };
}

/**
 * Get notification preferences for user
 * @param {string} userID - User ID
 * @return {Object} Notification preferences
 */
function getNotificationPreferences(userID) {
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  
  if (!user) {
    return { success: false, message: 'User not found' };
  }
  
  return {
    success: true,
    emailNotifications: user.EmailNotifications !== false,
    smsEnabled: !!user.PhoneNumber,
    phoneNumber: user.PhoneNumber || ''
  };
}

/**
 * Update notification preferences
 * @param {string} userID - User ID
 * @param {Object} preferences - Preferences (emailNotifications, phoneNumber)
 * @return {Object} Update result
 */
function updateNotificationPreferences(userID, preferences) {
  const updates = {};
  
  if (preferences.emailNotifications !== undefined) {
    updates.EmailNotifications = preferences.emailNotifications;
  }
  
  if (preferences.phoneNumber !== undefined) {
    updates.PhoneNumber = preferences.phoneNumber;
  }
  
  const success = updateRowByID(SHEETS.USERS, 'UserID', userID, updates);
  
  return { 
    success: success,
    message: success ? 'Notification preferences updated' : 'Update failed'
  };
}

/**
 * Test notification system
 * @param {string} userID - User ID to test with
 * @return {Object} Test results
 */
function testNotificationSystem(userID) {
  const results = {
    inApp: false,
    email: false,
    sms: false
  };
  
  // Test in-app notification
  const inAppResult = createNotification(
    userID,
    'test',
    '🧪 Test Notification',
    'This is a test notification from Branch360.',
    { testData: 'test' },
    '/dashboard'
  );
  results.inApp = inAppResult.success;
  
  // Test email
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (user && user.Email) {
    const emailResult = sendEmailNotification(
      user.Email,
      '🧪 Test Email from Branch360',
      buildEmailTemplate(
        '🧪 Test Email',
        'This is a test email from the Branch360 notification system.',
        null
      )
    );
    results.email = emailResult.success;
  }
  
  // Test SMS (if configured and user has phone)
  if (user && user.PhoneNumber) {
    const smsResult = sendSMS(
      user.PhoneNumber,
      '🧪 Branch360 Test: This is a test SMS from your Branch360 CRM system.'
    );
    results.sms = smsResult.success;
  }
  
  return {
    success: true,
    results: results,
    message: 'Test complete. Check results for each channel.'
  };
}

