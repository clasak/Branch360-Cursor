/**
 * Branch360 - Calendar Bidirectional Sync
 * C. CALENDAR: Read from and write to Google Calendar for appointments
 */

/**
 * Calendar sync configuration
 */
const CALENDAR_CONFIG = {
  // Event naming conventions
  EVENT_PREFIX: '[Branch360]',
  
  // Event colors (Google Calendar color IDs)
  COLORS: {
    PROPOSAL: '5',    // Yellow
    SOLD: '10',       // Green
    FOLLOW_UP: '7',   // Cyan
    INSTALL: '9'      // Blue
  },
  
  // Default duration for appointments (minutes)
  DEFAULT_DURATION: 60,
  
  // Sync settings
  SYNC_DAYS_AHEAD: 30, // Sync events up to 30 days in future
  SYNC_DAYS_BEHIND: 7  // Sync events up to 7 days in past
};

/**
 * Create calendar event from tracker entry
 * @param {string} entryID - Tracker entry ID
 * @param {Object} eventDetails - Event details (title, startTime, duration, location)
 * @return {Object} Created event info
 */
function createCalendarEventFromTracker(entryID, eventDetails) {
  try {
    const entry = findRowByID(SHEETS.TRACKER, 'EntryID', entryID);
    if (!entry) {
      return { success: false, message: 'Tracker entry not found' };
    }
    
    const ae = findRowByID(SHEETS.USERS, 'UserID', entry.AE_UserID);
    if (!ae || !ae.Email) {
      return { success: false, message: 'AE not found or has no email' };
    }
    
    // Get AE's calendar
    const calendar = CalendarApp.getDefaultCalendar();
    
    // Prepare event details
    const title = CALENDAR_CONFIG.EVENT_PREFIX + ' ' + (eventDetails.title || entry.Customer_Name || 'Customer Appointment');
    const location = eventDetails.location || entry.Service_Address || '';
    const startTime = eventDetails.startTime ? new Date(eventDetails.startTime) : new Date(entry.Date_Proposal);
    const duration = eventDetails.duration || CALENDAR_CONFIG.DEFAULT_DURATION;
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // Determine color based on stage
    let colorId = CALENDAR_CONFIG.COLORS.PROPOSAL;
    if (entry.Stage === 'Sold') {
      colorId = CALENDAR_CONFIG.COLORS.SOLD;
    }
    
    // Create description
    const description = buildEventDescription(entry, entryID);
    
    // Create event
    const event = calendar.createEvent(title, startTime, endTime, {
      location: location,
      description: description
    });
    
    // Set color
    event.setColor(colorId);
    
    // Store calendar event ID in tracker
    updateRowByID(SHEETS.TRACKER, 'EntryID', entryID, {
      Notes: (entry.Notes || '') + '\n[Calendar Event: ' + event.getId() + ']'
    });
    
    Logger.log('✅ Created calendar event for tracker entry: ' + entryID);
    
    // Send notification to AE
    sendNotification(ae.UserID, 'appointment_created', '📅 Appointment Added to Calendar', 
      'Appointment with ' + entry.Customer_Name + ' on ' + 
      Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'MMM dd, yyyy h:mm a'),
      {
        data: { entryID: entryID, eventID: event.getId() },
        sendEmail: true,
        sendSMS: false
      }
    );
    
    return {
      success: true,
      eventID: event.getId(),
      eventURL: event.getHtmlLink(),
      message: 'Calendar event created'
    };
    
  } catch (e) {
    Logger.log('❌ Calendar event creation failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Create calendar event from start packet (installation)
 * @param {string} packetID - Start packet ID
 * @param {Object} eventDetails - Event details
 * @return {Object} Created event info
 */
function createCalendarEventFromPacket(packetID, eventDetails) {
  try {
    const packet = findRowByID(SHEETS.START_PACKETS, 'PacketID', packetID);
    if (!packet) {
      return { success: false, message: 'Start packet not found' };
    }
    
    const tech = findRowByID(SHEETS.USERS, 'UserID', packet.Assigned_Specialist);
    
    const calendar = CalendarApp.getDefaultCalendar();
    
    const title = CALENDAR_CONFIG.EVENT_PREFIX + ' INSTALL - ' + (packet.Account_Name || 'Installation');
    const location = packet.Service_Address || '';
    const startTime = eventDetails.startTime ? new Date(eventDetails.startTime) : 
                      (packet.Date_Install_Scheduled ? new Date(packet.Date_Install_Scheduled) : new Date());
    const duration = eventDetails.duration || 120; // Installs typically take 2 hours
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    const description = buildPacketEventDescription(packet, packetID);
    
    const event = calendar.createEvent(title, startTime, endTime, {
      location: location,
      description: description
    });
    
    event.setColor(CALENDAR_CONFIG.COLORS.INSTALL);
    
    // Add technician as guest if available
    if (tech && tech.Email) {
      try {
        event.addGuest(tech.Email);
      } catch (e) {
        Logger.log('⚠️ Could not add tech as guest: ' + e.message);
      }
    }
    
    // Store event ID
    updateRowByID(SHEETS.START_PACKETS, 'PacketID', packetID, {
      Special_Notes: (packet.Special_Notes || '') + '\n[Calendar Event: ' + event.getId() + ']'
    });
    
    Logger.log('✅ Created calendar event for installation: ' + packetID);
    
    // Notify technician
    if (tech) {
      notifyTechOfNewStop(tech.UserID, packetID);
    }
    
    return {
      success: true,
      eventID: event.getId(),
      eventURL: event.getHtmlLink(),
      message: 'Installation calendar event created'
    };
    
  } catch (e) {
    Logger.log('❌ Installation calendar event failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Build event description for tracker entry
 */
function buildEventDescription(entry, entryID) {
  let desc = 'Branch360 CRM - Customer Appointment\n\n';
  desc += 'Customer: ' + (entry.Customer_Name || 'N/A') + '\n';
  desc += 'Service Type: ' + (entry.Service_Description || 'N/A') + '\n';
  desc += 'Stage: ' + (entry.Stage || 'N/A') + '\n';
  desc += 'POC: ' + (entry.POC_Name || 'N/A') + '\n';
  desc += 'Phone: ' + (entry.POC_Phone || 'N/A') + '\n';
  desc += 'Email: ' + (entry.POC_Email || 'N/A') + '\n\n';
  desc += 'Initial Fee: $' + (entry.Initial_Fee || 0) + '\n';
  desc += 'Monthly Fee: $' + (entry.Monthly_Fee || 0) + '\n\n';
  desc += 'Entry ID: ' + entryID + '\n';
  
  // Add link to CRM (if deployed as web app)
  const scriptURL = ScriptApp.getService().getUrl();
  if (scriptURL) {
    desc += '\nView in CRM: ' + scriptURL + '#/tracker/' + entryID;
  }
  
  return desc;
}

/**
 * Build event description for start packet
 */
function buildPacketEventDescription(packet, packetID) {
  let desc = 'Branch360 CRM - Installation\n\n';
  desc += 'Account: ' + (packet.Account_Name || 'N/A') + '\n';
  desc += 'Service Type: ' + (packet.Service_Type || 'N/A') + '\n';
  desc += 'Frequency: ' + (packet.Frequency || 0) + ' per year\n';
  desc += 'Initial Price: $' + (packet.Initial_Job_Price || 0) + '\n';
  desc += 'Maintenance: $' + (packet.Maintenance_Price || 0) + '/month\n\n';
  desc += 'Specialist: ' + (packet.Assigned_Specialist || 'Unassigned') + '\n';
  desc += 'Operations Manager: ' + (packet.Operations_Manager || 'N/A') + '\n\n';
  desc += 'Special Notes: ' + (packet.Special_Notes || 'None') + '\n\n';
  desc += 'Packet ID: ' + packetID + '\n';
  
  return desc;
}

/**
 * Update calendar event when tracker entry changes
 * @param {string} entryID - Tracker entry ID
 * @param {string} eventID - Calendar event ID
 * @param {Object} updates - Updates to apply
 * @return {Object} Update result
 */
function updateCalendarEvent(entryID, eventID, updates) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const event = calendar.getEventById(eventID);
    
    if (!event) {
      return { success: false, message: 'Calendar event not found' };
    }
    
    // Apply updates
    if (updates.title) {
      event.setTitle(CALENDAR_CONFIG.EVENT_PREFIX + ' ' + updates.title);
    }
    
    if (updates.location) {
      event.setLocation(updates.location);
    }
    
    if (updates.startTime) {
      const startTime = new Date(updates.startTime);
      const duration = updates.duration || CALENDAR_CONFIG.DEFAULT_DURATION;
      const endTime = new Date(startTime.getTime() + duration * 60000);
      event.setTime(startTime, endTime);
    }
    
    if (updates.description) {
      event.setDescription(updates.description);
    }
    
    if (updates.color) {
      event.setColor(updates.color);
    }
    
    Logger.log('✅ Updated calendar event: ' + eventID);
    
    return {
      success: true,
      message: 'Calendar event updated'
    };
    
  } catch (e) {
    Logger.log('❌ Calendar event update failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Delete calendar event
 * @param {string} eventID - Calendar event ID
 * @return {Object} Delete result
 */
function deleteCalendarEvent(eventID) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const event = calendar.getEventById(eventID);
    
    if (!event) {
      return { success: false, message: 'Calendar event not found' };
    }
    
    event.deleteEvent();
    
    Logger.log('✅ Deleted calendar event: ' + eventID);
    
    return { success: true, message: 'Calendar event deleted' };
    
  } catch (e) {
    Logger.log('❌ Calendar event deletion failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Sync calendar events back to CRM
 * Reads calendar events and creates/updates tracker entries
 * @return {Object} Sync results
 */
function syncCalendarToCRM() {
  try {
    Logger.log('🔄 Syncing calendar to CRM...');
    
    const calendar = CalendarApp.getDefaultCalendar();
    
    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - CALENDAR_CONFIG.SYNC_DAYS_BEHIND);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + CALENDAR_CONFIG.SYNC_DAYS_AHEAD);
    
    // Get all Branch360 events
    const events = calendar.getEvents(startDate, endDate);
    const branch360Events = events.filter(function(event) {
      return event.getTitle().startsWith(CALENDAR_CONFIG.EVENT_PREFIX);
    });
    
    Logger.log('Found ' + branch360Events.length + ' Branch360 calendar events');
    
    let synced = 0;
    let created = 0;
    
    branch360Events.forEach(function(event) {
      const title = event.getTitle().replace(CALENDAR_CONFIG.EVENT_PREFIX, '').trim();
      const location = event.getLocation();
      const startTime = event.getStartTime();
      const description = event.getDescription();
      
      // Try to extract Entry ID from description
      const entryIDMatch = description.match(/Entry ID: ([A-Z0-9-]+)/);
      
      if (entryIDMatch) {
        const entryID = entryIDMatch[1];
        
        // Update existing tracker entry
        const entry = findRowByID(SHEETS.TRACKER, 'EntryID', entryID);
        if (entry) {
          // Check if event time changed - update Date_Proposal
          const currentDate = entry.Date_Proposal ? new Date(entry.Date_Proposal) : null;
          if (!currentDate || Math.abs(currentDate - startTime) > 60000) { // More than 1 minute difference
            updateRowByID(SHEETS.TRACKER, 'EntryID', entryID, {
              Date_Proposal: startTime,
              UpdatedOn: new Date()
            });
            synced++;
          }
        }
      } else if (location) {
        // No Entry ID found - this might be a new appointment
        // Try to match by location or create new tracker entry
        const trackerData = getSheetData(SHEETS.TRACKER);
        const match = trackerData.find(function(entry) {
          return entry.Service_Address === location;
        });
        
        if (!match) {
          // Create new tracker entry from calendar event
          const currentUser = getCurrentUser();
          const newEntryID = generateUniqueID('TRK');
          
          insertRow(SHEETS.TRACKER, {
            EntryID: newEntryID,
            Date: new Date(),
            AE_UserID: currentUser ? currentUser.userID : '',
            BranchID: currentUser ? currentUser.branchID : 'BRN-001',
            Stage: 'Proposal',
            Customer_Name: title.replace('INSTALL -', '').trim(),
            Service_Address: location,
            ZipCode: '',
            POC_Name: '',
            POC_Phone: '',
            POC_Email: '',
            Source: 'Calendar Sync',
            Sale_Type: 'New Business',
            Service_Description: '',
            Initial_Fee: 0,
            Monthly_Fee: 0,
            Frequency: 12,
            Annual_Value: 0,
            PestPac_ID: '',
            Date_Proposal: startTime,
            Date_Sold: null,
            Date_Dead: null,
            Status: 'Active',
            Notes: 'Created from calendar event: ' + event.getId(),
            CreatedOn: new Date(),
            UpdatedOn: new Date()
          });
          
          created++;
          Logger.log('✅ Created tracker entry from calendar: ' + newEntryID);
        }
      }
    });
    
    Logger.log('✅ Calendar sync complete. Synced: ' + synced + ', Created: ' + created);
    
    return {
      success: true,
      synced: synced,
      created: created,
      message: 'Synced ' + synced + ' events, created ' + created + ' new entries'
    };
    
  } catch (e) {
    Logger.log('❌ Calendar sync failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Install calendar sync trigger
 * Runs every 6 hours to keep calendar and CRM in sync
 */
function installCalendarSyncTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncCalendarToCRM') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Install new trigger - every 6 hours
  ScriptApp.newTrigger('syncCalendarToCRM')
    .timeBased()
    .everyHours(6)
    .create();
  
  Logger.log('✅ Calendar sync trigger installed (runs every 6 hours)');
  
  return { success: true, message: 'Calendar sync trigger installed' };
}

/**
 * Get upcoming appointments for user
 * @param {string} userID - User ID
 * @param {number} daysAhead - Days to look ahead (default 7)
 * @return {Array<Object>} Upcoming appointments
 */
function getUpcomingAppointments(userID, daysAhead) {
  daysAhead = daysAhead || 7;
  
  const user = findRowByID(SHEETS.USERS, 'UserID', userID);
  if (!user) {
    return [];
  }
  
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    const events = calendar.getEvents(startDate, endDate);
    const branch360Events = events.filter(function(event) {
      return event.getTitle().startsWith(CALENDAR_CONFIG.EVENT_PREFIX);
    });
    
    return branch360Events.map(function(event) {
      return {
        eventID: event.getId(),
        title: event.getTitle().replace(CALENDAR_CONFIG.EVENT_PREFIX, '').trim(),
        location: event.getLocation(),
        startTime: event.getStartTime(),
        endTime: event.getEndTime(),
        description: event.getDescription(),
        url: event.getHtmlLink()
      };
    });
    
  } catch (e) {
    Logger.log('⚠️ Could not get appointments: ' + e.message);
    return [];
  }
}

/**
 * Send appointment reminders
 * Checks for appointments in next 24 hours and sends reminders
 */
function sendAppointmentReminders() {
  Logger.log('📅 Checking for appointment reminders...');
  
  const users = getSheetData(SHEETS.USERS, { Active: true });
  let remindersSent = 0;
  
  users.forEach(function(user) {
    const appointments = getUpcomingAppointments(user.UserID, 1); // Next 24 hours
    
    appointments.forEach(function(appointment) {
      // Check if reminder already sent (in last 24 hours)
      // For simplicity, send reminder for each appointment once
      const result = sendAppointmentReminder(user.UserID, {
        customer: appointment.title,
        location: appointment.location,
        startTime: appointment.startTime
      });
      
      if (result.success) {
        remindersSent++;
      }
    });
  });
  
  Logger.log('✅ Sent ' + remindersSent + ' appointment reminders');
  
  return {
    success: true,
    remindersSent: remindersSent,
    message: 'Sent ' + remindersSent + ' reminders'
  };
}

/**
 * Install appointment reminder trigger
 * Runs daily at 8 AM
 */
function installAppointmentReminderTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sendAppointmentReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('sendAppointmentReminders')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  
  Logger.log('✅ Appointment reminder trigger installed (runs daily at 8 AM)');
  
  return { success: true, message: 'Appointment reminder trigger installed' };
}

