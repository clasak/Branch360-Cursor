/**
 * Branch360 - Salesforce Mapping Configuration
 * D. SALESFORCE PARSER SETTINGS: Configure field mappings without code changes
 * Prevents parser from breaking when Salesforce quote templates change
 */

/**
 * Default Salesforce field mappings
 * Can be overridden via admin UI
 */
const DEFAULT_SALESFORCE_MAPPINGS = {
  // Account/Customer fields
  'ACCOUNT_NAME': {
    keywords: ['Account Name', 'Customer Name', 'Company Name'],
    regex: /Account Name[:\s]+(.+?)(?:\n|$)/i,
    type: 'text',
    targetField: 'AccountName'
  },
  
  'SERVICE_ADDRESS': {
    keywords: ['Service Address', 'Service Location', 'Property Address'],
    regex: /Service Address[:\s]+(.+?)(?:\n|$)/i,
    type: 'text',
    targetField: 'Service_Address'
  },
  
  'BILLING_ADDRESS': {
    keywords: ['Billing Address', 'Bill To'],
    regex: /Billing Address[:\s]+(.+?)(?:\n|$)/i,
    type: 'text',
    targetField: 'Billing_Address'
  },
  
  // Contact fields
  'CONTACT_NAME': {
    keywords: ['Contact Name', 'POC Name', 'Primary Contact'],
    regex: /Contact Name[:\s]+(.+?)(?:\n|$)/i,
    type: 'text',
    targetField: 'POCName'
  },
  
  'CONTACT_PHONE': {
    keywords: ['Contact Phone', 'Phone', 'Mobile'],
    regex: /(?:Contact )?Phone[:\s]+([\d\(\)\-\s\.]+)/i,
    type: 'phone',
    targetField: 'POCPhone'
  },
  
  'CONTACT_EMAIL': {
    keywords: ['Contact Email', 'Email', 'E-mail'],
    regex: /Email[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    type: 'email',
    targetField: 'POCEmail'
  },
  
  // Pricing fields
  'INITIAL_PRICE': {
    keywords: ['Initial Investment', 'Initial Price', 'Initial Fee', 'Setup Fee', 'One Time Fee'],
    regex: /(?:Initial Investment|Initial Price|Initial Fee)[:\s]+\$?([\d,]+\.?\d*)/i,
    type: 'currency',
    targetField: 'InitialPrice'
  },
  
  'MONTHLY_PRICE': {
    keywords: ['Monthly Price', 'Monthly Fee', 'Recurring Fee', 'Monthly Investment'],
    regex: /Monthly (?:Price|Fee|Investment)[:\s]+\$?([\d,]+\.?\d*)/i,
    type: 'currency',
    targetField: 'MaintenancePrice'
  },
  
  'ANNUAL_VALUE': {
    keywords: ['Annual Value', 'Total Annual', 'Yearly Value'],
    regex: /Annual Value[:\s]+\$?([\d,]+\.?\d*)/i,
    type: 'currency',
    targetField: 'AnnualValue'
  },
  
  // Service fields
  'SERVICE_TYPE': {
    keywords: ['Service Type', 'Program Type', 'Service Category'],
    regex: /Service Type[:\s]+(.+?)(?:\n|$)/i,
    type: 'text',
    targetField: 'ServiceType'
  },
  
  'FREQUENCY': {
    keywords: ['Frequency', 'Service Frequency', 'Visits Per Year', 'Annual Services'],
    regex: /Frequency[:\s]+(\d+)/i,
    type: 'number',
    targetField: 'Frequency'
  },
  
  // Date fields
  'QUOTE_DATE': {
    keywords: ['Quote Date', 'Proposal Date', 'Date'],
    regex: /Quote Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    type: 'date',
    targetField: 'SoldDate'
  },
  
  'START_DATE': {
    keywords: ['Start Date', 'Requested Start', 'Service Start Date'],
    regex: /Start Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    type: 'date',
    targetField: 'RequestedStartMonth'
  }
};

/**
 * Get Salesforce mappings from Script Properties or return defaults
 * @return {Object} Field mappings
 */
function getSalesforceMappings() {
  const props = PropertiesService.getScriptProperties();
  const customMappings = props.getProperty('SALESFORCE_MAPPINGS');
  
  if (customMappings) {
    try {
      return JSON.parse(customMappings);
    } catch (e) {
      Logger.log('⚠️ Could not parse custom Salesforce mappings: ' + e.message);
    }
  }
  
  return DEFAULT_SALESFORCE_MAPPINGS;
}

/**
 * Save custom Salesforce mappings
 * @param {Object} mappings - Custom field mappings
 * @return {Object} Save result
 */
function saveSalesforceMappings(mappings) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('SALESFORCE_MAPPINGS', JSON.stringify(mappings));
    
    Logger.log('✅ Salesforce mappings saved');
    
    return {
      success: true,
      message: 'Salesforce mappings saved successfully'
    };
    
  } catch (e) {
    Logger.log('❌ Failed to save Salesforce mappings: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Reset Salesforce mappings to defaults
 * @return {Object} Reset result
 */
function resetSalesforceMappings() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SALESFORCE_MAPPINGS');
  
  Logger.log('✅ Salesforce mappings reset to defaults');
  
  return {
    success: true,
    message: 'Salesforce mappings reset to defaults'
  };
}

/**
 * Parse Salesforce PDF using configured mappings
 * Enhanced version of existing salesforce-parser.gs logic
 * @param {string} pdfText - Extracted PDF text
 * @return {Object} Parsed data
 */
function parseSalesforcePDFWithMappings(pdfText) {
  const mappings = getSalesforceMappings();
  const parsed = {};
  
  Logger.log('🔍 Parsing Salesforce PDF with ' + Object.keys(mappings).length + ' field mappings');
  
  // Parse each field using configured mappings
  Object.keys(mappings).forEach(function(fieldKey) {
    const mapping = mappings[fieldKey];
    
    // Try regex first
    if (mapping.regex) {
      const match = pdfText.match(mapping.regex);
      if (match && match[1]) {
        let value = match[1].trim();
        
        // Apply type conversions
        switch (mapping.type) {
          case 'currency':
            value = parseCurrency(value);
            break;
          case 'number':
            const num = parseInt(value, 10);
            value = isNaN(num) ? null : num;
            break;
          case 'date':
            value = parseDate(value);
            break;
          case 'phone':
            value = formatPhone(value);
            break;
        }
        
        parsed[mapping.targetField] = value;
        Logger.log('✅ Matched ' + fieldKey + ': ' + value);
      }
    }
    
    // Fallback: keyword search if regex didn't match
    if (!parsed[mapping.targetField] && mapping.keywords) {
      mapping.keywords.forEach(function(keyword) {
        if (!parsed[mapping.targetField]) {
          const keywordMatch = searchByKeyword(pdfText, keyword, mapping.type);
          if (keywordMatch) {
            parsed[mapping.targetField] = keywordMatch;
            Logger.log('✅ Found by keyword "' + keyword + '": ' + keywordMatch);
          }
        }
      });
    }
  });
  
  Logger.log('✅ Parsed ' + Object.keys(parsed).length + ' fields from Salesforce PDF');
  
  return parsed;
}

/**
 * Parse currency value
 * @param {string} value - Currency string (e.g., "$1,234.56" or "1234.56")
 * @return {number} Numeric value
 */
function parseCurrency(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Parse date value
 * @param {string} value - Date string (various formats)
 * @return {Date} Date object
 */
function parseDate(value) {
  if (!value) return null;

  try {
    const trimmedValue = String(value).trim();

    // Try to parse delimited dates (MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY, etc.)
    const parts = trimmedValue.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let month, day, year;

      // Determine format by checking which part is likely the year
      const part1 = parseInt(parts[0], 10);
      const part2 = parseInt(parts[1], 10);
      const part3 = parseInt(parts[2], 10);

      // If third part is > 31, it's likely the year (YYYY format)
      // If first part is > 31 or all 4 digits, it's likely YYYY-MM-DD
      if (part3 > 31 || parts[2].length === 4) {
        // Format: MM/DD/YYYY or DD/MM/YYYY
        year = part3;

        // Disambiguate MM/DD vs DD/MM by checking if first part > 12
        if (part1 > 12) {
          // Must be DD/MM/YYYY
          day = part1;
          month = part2 - 1;
        } else if (part2 > 12) {
          // Must be MM/DD/YYYY
          month = part1 - 1;
          day = part2;
        } else {
          // Ambiguous - default to MM/DD/YYYY (US format)
          month = part1 - 1;
          day = part2;
        }
      } else if (part1 > 31 || parts[0].length === 4) {
        // Format: YYYY-MM-DD or YYYY/MM/DD
        year = part1;
        month = part2 - 1;
        day = part3;
      } else {
        // Assume MM/DD/YY or DD/MM/YY
        if (part1 > 12) {
          // Must be DD/MM/YY
          day = part1;
          month = part2 - 1;
        } else {
          // Default to MM/DD/YY
          month = part1 - 1;
          day = part2;
        }
        year = part3;
      }

      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900; // 00-49 = 2000-2049, 50-99 = 1950-1999
      }

      // Validate date components
      if (month < 0 || month > 11 || day < 1 || day > 31) {
        Logger.log('⚠️ Invalid date components: ' + value);
        return null;
      }

      const date = new Date(year, month, day);

      // Verify the date is valid (catches invalid dates like Feb 30)
      if (date.getMonth() !== month || date.getDate() !== day) {
        Logger.log('⚠️ Invalid date: ' + value);
        return null;
      }

      return date;
    }

    // Try ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
    if (trimmedValue.includes('T')) {
      const date = new Date(trimmedValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Fallback: try JavaScript date parser
    const fallbackDate = new Date(trimmedValue);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }

    Logger.log('⚠️ Could not parse date: ' + value);
    return null;

  } catch (e) {
    Logger.log('⚠️ Error parsing date "' + value + '": ' + e.message);
    return null;
  }
}

/**
 * Format phone number
 * @param {string} value - Phone string
 * @return {string} Formatted phone
 */
function formatPhone(value) {
  if (!value) return '';
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
  }
  
  // If not 10 digits, return as-is
  return value;
}

/**
 * Search for value by keyword in text
 * @param {string} text - Text to search
 * @param {string} keyword - Keyword to find
 * @param {string} type - Value type (for parsing)
 * @return {*} Found value or null
 */
function searchByKeyword(text, keyword, type) {
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      // Found the keyword - extract value after colon or on next line
      let value = null;
      
      // Try to extract from same line (after colon)
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1 && colonIndex < line.length - 1) {
        value = line.substring(colonIndex + 1).trim();
      }
      
      // If no value on same line, try next line
      if (!value && i < lines.length - 1) {
        value = lines[i + 1].trim();
      }
      
      if (value) {
        // Apply type conversion
        switch (type) {
          case 'currency':
            return parseCurrency(value);
          case 'number':
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          case 'date':
            return parseDate(value);
          case 'phone':
            return formatPhone(value);
          default:
            return value;
        }
      }
    }
  }
  
  return null;
}

/**
 * Test Salesforce parser with sample text
 * Useful for validating mappings in admin UI
 * @param {string} sampleText - Sample PDF text
 * @return {Object} Parse results
 */
function testSalesforceParser(sampleText) {
  try {
    const parsed = parseSalesforcePDFWithMappings(sampleText);
    const mappings = getSalesforceMappings();
    
    // Calculate success rate
    const totalFields = Object.keys(mappings).length;
    const parsedFields = Object.keys(parsed).length;
    const successRate = (parsedFields / totalFields * 100).toFixed(1);
    
    return {
      success: true,
      parsed: parsed,
      stats: {
        totalFields: totalFields,
        parsedFields: parsedFields,
        successRate: successRate + '%'
      },
      message: 'Parsed ' + parsedFields + ' of ' + totalFields + ' fields (' + successRate + '%)'
    };
    
  } catch (e) {
    Logger.log('❌ Parser test failed: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Add or update a field mapping
 * @param {string} fieldKey - Field key (e.g., 'ACCOUNT_NAME')
 * @param {Object} mapping - Mapping configuration
 * @return {Object} Update result
 */
function updateFieldMapping(fieldKey, mapping) {
  try {
    const mappings = getSalesforceMappings();
    
    // Validate mapping
    if (!mapping.targetField) {
      return { success: false, message: 'Target field is required' };
    }
    
    if (!mapping.regex && !mapping.keywords) {
      return { success: false, message: 'Either regex or keywords must be provided' };
    }
    
    // Update mapping
    mappings[fieldKey] = mapping;
    
    // Save
    const saveResult = saveSalesforceMappings(mappings);
    
    if (saveResult.success) {
      Logger.log('✅ Updated field mapping: ' + fieldKey);
    }
    
    return saveResult;
    
  } catch (e) {
    Logger.log('❌ Failed to update field mapping: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Delete a field mapping
 * @param {string} fieldKey - Field key to delete
 * @return {Object} Delete result
 */
function deleteFieldMapping(fieldKey) {
  try {
    const mappings = getSalesforceMappings();
    
    if (!mappings[fieldKey]) {
      return { success: false, message: 'Field mapping not found' };
    }
    
    delete mappings[fieldKey];
    
    const saveResult = saveSalesforceMappings(mappings);
    
    if (saveResult.success) {
      Logger.log('✅ Deleted field mapping: ' + fieldKey);
    }
    
    return saveResult;
    
  } catch (e) {
    Logger.log('❌ Failed to delete field mapping: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Get all available target fields (for admin UI dropdown)
 * @return {Array<Object>} Target fields
 */
function getAvailableTargetFields() {
  // Based on Unified_Sales schema
  return [
    { value: 'AccountName', label: 'Account Name' },
    { value: 'Service_Address', label: 'Service Address' },
    { value: 'Billing_Address', label: 'Billing Address' },
    { value: 'POCName', label: 'Contact Name' },
    { value: 'POCPhone', label: 'Contact Phone' },
    { value: 'POCEmail', label: 'Contact Email' },
    { value: 'InitialPrice', label: 'Initial Price' },
    { value: 'MaintenancePrice', label: 'Monthly Price' },
    { value: 'AnnualValue', label: 'Annual Value' },
    { value: 'ServiceType', label: 'Service Type' },
    { value: 'Frequency', label: 'Frequency' },
    { value: 'SoldDate', label: 'Quote/Sold Date' },
    { value: 'RequestedStartMonth', label: 'Requested Start Date' },
    { value: 'SpecialNotes', label: 'Special Notes' }
  ];
}

/**
 * Export mappings as JSON (for backup)
 * @return {string} JSON string
 */
function exportSalesforceMappings() {
  const mappings = getSalesforceMappings();
  return JSON.stringify(mappings, null, 2);
}

/**
 * Import mappings from JSON
 * @param {string} jsonString - JSON mappings
 * @return {Object} Import result
 */
function importSalesforceMappings(jsonString) {
  try {
    const mappings = JSON.parse(jsonString);
    
    // Validate structure
    if (typeof mappings !== 'object' || Array.isArray(mappings)) {
      return { success: false, message: 'Invalid mappings format' };
    }
    
    // Save
    const saveResult = saveSalesforceMappings(mappings);
    
    if (saveResult.success) {
      Logger.log('✅ Imported Salesforce mappings');
    }
    
    return saveResult;
    
  } catch (e) {
    Logger.log('❌ Failed to import mappings: ' + e.message);
    return { success: false, message: 'Invalid JSON: ' + e.message };
  }
}

