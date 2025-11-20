/**
 * Branch360 - API Integrations
 * Placeholders for external systems + active Mapbox integration
 */

// ===== MAPBOX (ACTIVE) =====

const MAPBOX_TOKEN = API_TOKENS.MAPBOX;

/**
 * Geocode an address using Mapbox
 */
function geocodeAddress(address) {
  try {
    const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + 
      encodeURIComponent(address) + 
      '.json?access_token=' + MAPBOX_TOKEN;
    
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        success: true,
        latitude: feature.center[1],
        longitude: feature.center[0],
        formattedAddress: feature.place_name
      };
    }
    
    return { success: false, message: 'Address not found' };
    
  } catch (e) {
    Logger.log('❌ Geocoding failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Get static map image URL
 */
function getStaticMapURL(latitude, longitude, zoom) {
  zoom = zoom || 14;
  return 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/' +
    longitude + ',' + latitude + ',' + zoom + '/600x400@2x' +
    '?access_token=' + MAPBOX_TOKEN;
}

/**
 * Get territory map with multiple locations
 */
function getTerritoryMapURL(locations, zoom) {
  // locations = [{lat, lng, color}, ...]
  zoom = zoom || 10;
  
  var markers = locations.map(function(loc) {
    const color = loc.color || 'blue';
    return 'pin-s-' + loc.label + '+' + color + '(' + loc.lng + ',' + loc.lat + ')';
  }).join(',');
  
  return 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/' +
    markers + '/auto/800x600@2x' +
    '?access_token=' + MAPBOX_TOKEN;
}

// ===== PESTPAC (PLACEHOLDER) =====

/**
 * PLACEHOLDER - Sync customers from PestPac
 */
function syncFromPestPac() {
  Logger.log('[PLACEHOLDER] PestPac sync not yet implemented');
  Logger.log('TODO: Implement when API credentials available');
  Logger.log('Expected workflow:');
  Logger.log('1. Authenticate with PestPac API');
  Logger.log('2. Fetch customer records');
  Logger.log('3. Map to Branch360 schema (Accounts table)');
  Logger.log('4. Upsert records');
  
  return {
    status: 'pending',
    message: 'PestPac integration awaiting API credentials'
  };
}

/**
 * PLACEHOLDER - Push sold opportunity to PestPac
 */
function pushToPestPac(trackerEntryID) {
  Logger.log('[PLACEHOLDER] PestPac push not yet implemented');
  Logger.log('TrackerEntryID: ' + trackerEntryID);
  
  return {
    status: 'pending',
    message: 'PestPac integration awaiting API credentials'
  };
}

// ===== ROUTE1 (PLACEHOLDER) =====

/**
 * PLACEHOLDER - Fetch today's routes from Route1
 */
function syncRoutesFromRoute1() {
  Logger.log('[PLACEHOLDER] Route1 sync not yet implemented');
  Logger.log('TODO: Implement when API credentials available');
  Logger.log('Expected workflow:');
  Logger.log('1. Authenticate with Route1 API');
  Logger.log('2. Fetch routes for branch');
  Logger.log('3. Return structured route data');
  
  return {
    status: 'pending',
    message: 'Route1 integration awaiting API credentials',
    routes: []
  };
}

// ===== SALESFORCE (PLACEHOLDER) =====

/**
 * PLACEHOLDER - Sync opportunities from Salesforce
 */
function syncOpportunitiesFromSalesforce() {
  Logger.log('[PLACEHOLDER] Salesforce sync not yet implemented');
  Logger.log('TODO: Implement when API credentials available');
  Logger.log('Expected workflow:');
  Logger.log('1. Authenticate with Salesforce (OAuth)');
  Logger.log('2. Query opportunities');
  Logger.log('3. Map to TrackerData schema');
  Logger.log('4. Upsert records');
  
  return {
    status: 'pending',
    message: 'Salesforce integration awaiting API credentials'
  };
}

/**
 * PLACEHOLDER - Push quote to Salesforce
 */
function pushQuoteToSalesforce(quoteID) {
  Logger.log('[PLACEHOLDER] Salesforce push not yet implemented');
  Logger.log('QuoteID: ' + quoteID);
  
  return {
    status: 'pending',
    message: 'Salesforce integration awaiting API credentials'
  };
}

// ===== OKTA (PLACEHOLDER) =====

/**
 * PLACEHOLDER - Okta SSO authentication
 */
function authenticateWithOkta() {
  Logger.log('[PLACEHOLDER] Okta SSO not yet implemented');
  Logger.log('TODO: Implement when Okta tenant configured');
  Logger.log('Expected workflow:');
  Logger.log('1. Redirect to Okta login');
  Logger.log('2. Validate SAML/OAuth token');
  Logger.log('3. Create/update user session');
  
  return {
    status: 'pending',
    message: 'Okta SSO awaiting tenant configuration',
    authenticated: false
  };
}

/**
 * Get Mapbox token for client-side use
 */
function getMapboxToken() {
  // Try to get from PropertiesService first (for runtime access)
  const props = PropertiesService.getScriptProperties();
  const storedToken = props.getProperty('MAPBOX_TOKEN');
  if (storedToken) {
    return storedToken;
  }
  // Fallback to config constant
  return API_TOKENS.MAPBOX;
}

/**
 * Get integration status dashboard
 */
function getIntegrationStatus() {
  return {
    mapbox: { status: 'active', message: 'Geocoding and maps operational' },
    pestpac: { status: 'pending', message: 'Awaiting API credentials' },
    route1: { status: 'pending', message: 'Awaiting API credentials' },
    salesforce: { status: 'pending', message: 'Awaiting API credentials' },
    okta: { status: 'pending', message: 'Awaiting tenant configuration' }
  };
}

/**
 * Sends an email notification to Ops and Sales when a deal is sold.
 */
/**
 * Sends an email notification with the Start Packet details.
 */
function sendNewStartNotification(data) {
  const recipients = "midwestmarketsalesentry@rentokil.com,brad.hudson@prestox.com,bruce.hockless@prestox.com,joaquin.barrera@prestox.com,mitchell.james@prestox.com,april.shane@prestox.com";
  
  const subject = "Re: Onboarding Report - " + (data.AccountName || "Unknown") + " -- " + (data.POCName || "Unknown");
  
  const body = 
    "Team,\n\n" +
    "Please find the attached start packet for the location below.\n\n" +
    "Service Details\n" +
    "• Frequency: " + (data.Frequency || "Monthly") + "\n" +
    "• Covered Pests: " + (data.CoveredPests || "N/A") + "\n" +
    "• Scope: " + (data.Maintenance_Scope_Description || "N/A") + "\n" +
    "• Treatment Notes: " + (data.SpecialNotes || "N/A") + "\n\n" +
    "Commercials\n" +
    "• Total Initial: $" + (Number(data.InitialPrice)||0).toFixed(2) + "\n" +
    "• Monthly: $" + (Number(data.MaintenancePrice)||0).toFixed(2) + "/month\n\n" +
    "Account Details\n" +
    "• Customer: " + (data.AccountName || "N/A") + "\n" +
    "• Service Address: " + (data.ServiceAddress || "N/A") + "\n" +
    "• Billing Address: " + (data.BillingAddress || "Same as Service") + "\n" +
    "• Billing Email: " + (data.BillingEmail || "N/A") + "\n" +
    "• POC: " + (data.POCName || "N/A") + " (" + (data.POCPhone || "N/A") + ")";
  // In a real deployment, we would attach the PDF blob here
  MailApp.sendEmail({
    to: recipients,
    subject: subject,
    body: body
  });
}

