/**
 * Parses Salesforce quote text into a StartPacketDraft.
 * Extraction is gated by explicit Salesforce quote labels (Tailored/Prepared For,
 * Prepared By, Equipment, Total Cost of Equipment, Routine Management Services,
 * Investment Summary, Covered Pests, Requested Start Date).
 *
 * The resulting payload focuses on the fields needed by the Start Packet flow:
 * account + contact info, service address, AE info, program/services, equipment,
 * pricing (one-time/initial + monthly & derived annual), requested start month,
 * and covered pests inferred from the labeled sections.
 *
 * @param {string} text Raw text extracted from a Salesforce quote PDF
 * @return {Object} StartPacketDraft payload for the AE start packet form
 */

var HEADER_BLOCK_TERMINATORS = [
  'prepared by',
  'equipment',
  'total cost of equipment',
  'investment summary',
  'covered pests',
  'scope of service',
  'service specifications',
  'service frequency',
  'plan limitations',
  'documentation',
  'terms & conditions',
  'about presto-x',
  'experienced service personnel',
  'technical leadership',
  'corporate responsibility',
  'innovation & technology',
  'table of contents'
];

var ROUTINE_SECTION_TERMINATORS = [
  'investment summary',
  'plan limitations',
  'scope of service',
  'equipment summary',
  'covered pests',
  'timeline',
  'requested start date',
  'about presto-x',
  'innovation & technology'
];

var ADDRESS_LINE_REGEX = /^[0-9].*(?:\b(?:st|street|rd|road|dr|drive|ln|lane|blvd|boulevard|ave|avenue|hwy|highway|way|trail|trl|terrace|ter|pkwy|parkway|court|ct|cir|circle|loop|suite|ste|unit)\b)/i;
var CITY_STATE_ZIP_REGEX = /^(.+?),\s*([A-Z]{2})[,\s]*([0-9]{5})(?:-?[0-9]{4})?/;
var EMAIL_REGEX = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function logDebug(value) {
  if (typeof Logger !== 'undefined' && Logger && typeof Logger.log === 'function') {
    Logger.log(value);
  } else if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
    console.log(value);
  }
}

function normalizeLabelText(line) {
  if (!line) return '';
  return line.toLowerCase()
    .replace(/4/g, 'for')
    .replace(/[^a-z]/g, '');
}

function isTailoredPreparedAnchor(line) {
  if (!line) return false;
  var normalized = normalizeLabelText(line);
  return normalized.indexOf('tailoredfor') === 0 ||
    normalized.indexOf('tailorfor') === 0 ||
    normalized.indexOf('taylorfor') === 0 ||
    normalized.indexOf('preparedfor') === 0;
}

function stripHeaderLabelPrefixes(line) {
  if (!line) return '';
  var trimmed = line.trim();
  var result = trimmed;
  var patterns = [
    /^(tailor(?:ed)?|taylor)\s*(?:for|4)\b/i,
    /^prepared\s+for\b/i,
    /^account\s+name\b/i,
    /^customer\s+name\b/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(result)) {
      result = result.replace(patterns[i], '').trim();
      break;
    }
  }
  return result.replace(/^[:\s,-]+/, '');
}

function parseSalesforceQuoteTextToStartPacketDraft(text) {
  if (!text) {
    throw new Error('No PDF text provided for parsing.');
  }

  var normalized = text.replace(/\r\n/g, '\n');
  var rawLines = normalized.split('\n');
  var trimmedLines = rawLines.map(function(line) {
    return (line || '').trim();
  }).filter(function(line) {
    return line.length > 0;
  });
  var lines = expandLines(trimmedLines);

  if (!lines.length) {
    throw new Error('Unable to parse PDF text (no content).');
  }

  var header = extractPreparedForFields(lines);
  var preparedBy = extractPreparedBySection(lines);
  var equipmentInfo = extractEquipmentSection(lines);
  var pricing = extractPricing(lines);
  var schedule = extractRequestedStart(lines);
  var routine = extractRoutineServices(lines, equipmentInfo.equipment);
  var explicitPests = extractCoveredPestsSection(lines);
  var derivedPests = deriveCoveredPests(explicitPests, routine.signals, equipmentInfo.equipment);

  var oneTimeCost = pricing.oneTimeCost !== null ? pricing.oneTimeCost : equipmentInfo.totalCost;
  var initialSvcCost = pricing.initialSvcCost;
  var monthlyCost = pricing.avgMonthlyCost;
  var annualCost = monthlyCost !== null ? roundCurrency(monthlyCost * 12) : null;

  // Calculate combined initial (One-Time + Initial Svc Cost)
  // Use 0 for missing values so we can still calculate the total
  var combinedInitial = null;
  if (oneTimeCost !== null || initialSvcCost !== null) {
    var oneTime = oneTimeCost !== null ? oneTimeCost : 0;
    var initial = initialSvcCost !== null ? initialSvcCost : 0;
    combinedInitial = roundCurrency(oneTime + initial);
  }
  var combinedMonthly = monthlyCost !== null ? monthlyCost : null;
  var combinedAnnual = annualCost !== null ? annualCost : null;

  var equipmentSummary = buildEquipmentSignature(equipmentInfo.equipment);
  equipmentInfo.equipment.summary = equipmentSummary;

  var jobType = monthlyCost !== null && monthlyCost > 0 ? 'Contract' : null;

  // Generate auto-descriptions
  var autoInitialDesc = buildInitialDescription(equipmentInfo.equipment, initialSvcCost);
  var autoMaintenanceDesc = buildMaintenanceDescription(routine.services);

  var draft = {
    accountName: header.accountName,
    contactName: header.contactName,
    contactEmail: header.contactEmail,
    serviceAddressLine1: header.serviceAddressLine1,
    serviceCity: header.serviceCity,
    serviceState: header.serviceState,
    serviceZip: header.serviceZip,
    aeName: preparedBy.aeName,
    aeEmail: preparedBy.aeEmail,
    branchId: 'BRN-001',
    jobType: jobType,
    services: routine.services,
    equipment: equipmentInfo.equipment,
    equipmentOneTimeTotal: oneTimeCost,
    servicesInitialTotal: initialSvcCost,
    combinedInitialTotal: combinedInitial,
    servicesMonthlyTotal: monthlyCost,
    combinedMonthlyTotal: combinedMonthly,
    servicesAnnualTotal: annualCost,
    combinedAnnualTotal: combinedAnnual,
    monthlyCost: monthlyCost,
    annualCost: annualCost,
    requestedStartDate: schedule.requestedStartDate,
    startMonth: schedule.startMonth,
    coveredPests: derivedPests,
    leadType: 'Inbound',
    serviceType: null,
    initialServiceDescription: autoInitialDesc,
    maintenanceScopeDescription: autoMaintenanceDesc,
    logBookNeeded: true
  };

  logDebug(JSON.stringify(draft, null, 2));
  return draft;
}

function expandLines(inputLines) {
  var result = [];
  inputLines.forEach(function(line) {
    if (!line) return;
    // Split on "PREPARED BY:" and "TAILORED FOR:" patterns first
    var splitPattern = /(PREPARED\s+BY:|TAILORED\s+FOR:)/i;
    if (splitPattern.test(line)) {
      var parts = line.split(splitPattern);
      var current = '';
      for (var i = 0; i < parts.length; i++) {
        if (splitPattern.test(parts[i])) {
          if (current.trim()) {
            result.push(current.trim());
          }
          current = parts[i];
        } else {
          current += parts[i];
        }
      }
      if (current.trim()) {
        result.push(current.trim());
      }
    } else if (line.length > 200 && /\s{2,}/.test(line)) {
      line.split(/\s{2,}/).forEach(function(part) {
        part = part.trim();
        if (part.length) result.push(part);
      });
    } else if (line.length > 140 && /\s{2,}/.test(line)) {
      line.split(/\s{2,}/).forEach(function(part) {
        part = part.trim();
        if (part.length) result.push(part);
      });
    } else {
      result.push(line);
    }
  });
  return result;
}

function roundCurrency(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100) / 100;
}

function extractPreparedForFields(lines) {
  var data = {
    accountName: null,
    contactName: null,
    contactEmail: null,
    serviceAddressLine1: null,
    serviceCity: null,
    serviceState: null,
    serviceZip: null
  };

  var idx = findFirstIndex(lines, function(line) {
    return isTailoredPreparedAnchor(line) || /account\s+name/i.test(line) || /customer\s+name/i.test(line);
  });
  if (idx === -1) {
    return data;
  }

  var block = gatherBlock(lines, idx, isHeaderBlockStop, 15);
  if (!block.length) {
    return data;
  }

  var sanitized = sanitizeHeaderBlock(block);
  if (!sanitized.length) {
    return data;
  }

  data.contactEmail = findFirstEmail(sanitized);
  sanitized = sanitized.map(function(line) {
    return line.replace(EMAIL_REGEX, '').trim();
  }).filter(function(line) {
    return line.length > 0;
  });

  sanitized = expandMergedHeaderLines(sanitized);

  var cursor = 0;
  while (cursor < sanitized.length && !data.accountName) {
    var candidate = sanitized[cursor];
    if (looksLikeAccountName(candidate)) {
      data.accountName = candidate;
    }
    cursor++;
  }

  while (cursor < sanitized.length && !data.contactName) {
    var contactCandidate = sanitized[cursor];
    if (looksLikeContactName(contactCandidate)) {
      data.contactName = contactCandidate;
      break;
    }
    cursor++;
  }

  for (var i = 0; i < sanitized.length; i++) {
    var line = sanitized[i];
    if (!data.serviceAddressLine1 && ADDRESS_LINE_REGEX.test(line)) {
      var components = extractInlineAddress(line);
      if (components) {
        data.serviceAddressLine1 = components.street || components.raw;
        data.serviceCity = components.city || data.serviceCity;
        data.serviceState = components.state || data.serviceState;
        data.serviceZip = components.zip || data.serviceZip;
      } else {
        data.serviceAddressLine1 = line;
        if (i + 1 < sanitized.length) {
          var cityMatch = sanitized[i + 1].match(CITY_STATE_ZIP_REGEX);
          if (cityMatch) {
            data.serviceCity = cityMatch[1].trim();
            data.serviceState = cityMatch[2];
            data.serviceZip = cityMatch[3];
          }
        }
      }
      break;
    }
  }

  return data;
}

function sanitizeHeaderBlock(block) {
  var sanitized = [];
  block.forEach(function(line, index) {
    if (!line) return;
    var cleaned = stripHeaderLabelPrefixes(line);
    var lower = cleaned.toLowerCase();
    if (!cleaned) return;
    if (isHeaderBlockStop(cleaned)) return;
    if (/^page\s+\d+/i.test(cleaned)) return;
    if (/https?:\/\//i.test(cleaned)) return;
    if (/^[0-9]+$/.test(cleaned)) return;
    sanitized.push(cleaned);
  });
  return sanitized;
}

function expandMergedHeaderLines(lines) {
  var expanded = [];
  lines.forEach(function(line) {
    if (!line) return;
    var parts = splitMergedHeaderLine(line);
    parts.forEach(function(part) {
      if (part && part.trim().length) {
        expanded.push(part.trim());
      }
    });
  });
  return expanded;
}

function splitMergedHeaderLine(line) {
  if (!line) return [];
  var trimmed = line.trim();
  if (!trimmed) return [];
  // Don't split obvious address or city/state/zip lines; doing so drops the street for Tailored/Prepared blocks
  if (ADDRESS_LINE_REGEX.test(trimmed) || (typeof CITY_STATE_ZIP_REGEX !== 'undefined' && CITY_STATE_ZIP_REGEX.test(trimmed))) {
    return [trimmed];
  }
  var results = [];
  var firstDigit = trimmed.search(/\d/);
  if (firstDigit > 0) {
    var before = trimmed.slice(0, firstDigit).trim();
    var after = trimmed.slice(firstDigit).trim();
    if (before) {
      splitAccountAndContact(before).forEach(function(part) {
        if (part) results.push(part);
      });
    }
    if (after) {
      results.push(after);
    }
    return results;
  }
  var splitParts = splitAccountAndContact(trimmed);
  if (splitParts.length > 1) {
    return splitParts;
  }
  return [trimmed];
}

function splitAccountAndContact(text) {
  if (!text) return [];
  var tokens = text.trim().split(/\s+/);
  // Avoid splitting address-like strings (start with a digit or match City, ST ZIP)
  if ((/^\d/.test(text) && ADDRESS_LINE_REGEX.test(text)) || (typeof CITY_STATE_ZIP_REGEX !== 'undefined' && CITY_STATE_ZIP_REGEX.test(text))) {
    return [text];
  }
  if (tokens.length < 3) return [text];
  for (var split = 1; split <= tokens.length - 2; split++) {
    var accountCandidate = tokens.slice(0, split).join(' ');
    var contactCandidate = tokens.slice(split).join(' ');
    if (looksLikeContactName(contactCandidate)) {
      return [accountCandidate, contactCandidate];
    }
  }
  return [text];
}

function looksLikeAccountName(value) {
  if (!value) return false;
  if (value.indexOf('@') !== -1) return false;
  if (/^[0-9]/.test(value)) return false;
  if (value.length > 80) return false;
  return true;
}

function looksLikeContactName(value) {
  if (!value) return false;
  if (value.indexOf('@') !== -1) return false;
  var parts = value.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 5) return false;
  return /^[A-Za-z]/.test(parts[0]);
}

function findFirstEmail(lines) {
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(EMAIL_REGEX);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractPreparedBySection(lines) {
  var result = { aeName: null, aeEmail: null };
  var idx = findFirstIndex(lines, function(line) {
    return /prepared\s+by\b/i.test(line);
  });
  if (idx === -1) {
    return result;
  }

  var block = gatherBlock(lines, idx, function(line) {
    if (!line) return false;
    var lower = line.toLowerCase();
    if (/(tailored|prepared)\s+for/.test(lower)) return true;
    return isHeaderBlockStop(line);
  }, 8);

  if (!block.length) return result;

  var inline = block[0].replace(/^prepared\s+by[:\s-]*/i, '').trim();
  if (inline) {
    var inlineEmail = inline.match(EMAIL_REGEX);
    if (inlineEmail) {
      result.aeEmail = inlineEmail[1];
      inline = inline.replace(EMAIL_REGEX, '').trim();
    }
    if (inline && inline.indexOf('@') === -1) {
      result.aeName = inline;
    }
  }

  for (var i = 1; i < block.length; i++) {
    var line = block[i];
    if (!line) continue;
    if (!result.aeEmail) {
      var email = line.match(EMAIL_REGEX);
      if (email) {
        result.aeEmail = email[1];
        line = line.replace(EMAIL_REGEX, '').trim();
      }
    }
    if (!result.aeName) {
      var nameCandidate = line.indexOf('@') === -1 ? line : '';
      if (!nameCandidate) {
        nameCandidate = line.replace(EMAIL_REGEX, '').trim();
      }
      if (nameCandidate && nameCandidate.indexOf('@') === -1) {
        result.aeName = nameCandidate.trim();
      }
    }
  }

  return result;
}

function extractEquipmentSection(lines) {
  var equipment = {
    rbsQty: 0,
    multCatchQty: 0,
    iltQty: 0,
    otherEquipment: [],
    summary: ''
  };
  var totalCost = null;

  // Anchor to "Total Cost of Equipment" to avoid TOC rows
  var totalIdx = findFirstIndex(lines, function(line) {
    return /^total\s+cost\s+of\s+equipment/i.test(line);
  });
  if (totalIdx === -1) {
    return { equipment: equipment, totalCost: totalCost };
  }
  var startIdx = -1;
  for (var back = totalIdx - 1; back >= Math.max(0, totalIdx - 30); back--) {
    var line = lines[back] || '';
    if (/equipment\s+summary/i.test(line)) continue;
    if (/^equipment\b/i.test(line) || /equipment\s+quantity/i.test(line) || /\bequipment\b/i.test(line)) {
      startIdx = back;
      break;
    }
  }
  if (startIdx === -1) {
    return { equipment: equipment, totalCost: totalCost };
  }

  var endIdx = totalIdx;

  for (var i = startIdx + 1; i < endIdx; i++) {
    var row = lines[i];
    if (!row || isHeaderBlockStop(row)) continue;
    if (/routine\s+management\s+services/i.test(row)) break;
    if (/service\s+frequency/i.test(row)) continue;
    
    // Check 1: Number at END of line (Standard)
    var qtyMatch = row.match(/([0-9]+(?:\.[0-9]+)?)\s*$/);
    
    // Check 2: Number at START of line (Fallback)
    if (!qtyMatch) {
      var startMatch = row.match(/^\s*([0-9]+)\s+(.*)/);
      if (startMatch) {
        var qty = parseFloat(startMatch[1]);
        var name = startMatch[2].trim();
        categorizeEquipment(equipment, name, qty);
        continue;
      }
    }
    
    // Continue with standard logic if Check 1 worked
    if (!qtyMatch) continue;
    var qty = parseFloat(qtyMatch[1]);
    if (isNaN(qty)) continue;
    var name = row.slice(0, row.length - qtyMatch[0].length).trim();
    if (!name) continue;
    categorizeEquipment(equipment, name, qty);
  }

  var totalLine = lines[endIdx];
  var parsedTotal = parseFirstCurrency(totalLine);
  if (parsedTotal !== null) {
    totalCost = parsedTotal;
  }

  equipment.summary = buildEquipmentSignature(equipment);
  return { equipment: equipment, totalCost: totalCost };
}

function categorizeEquipment(equipment, name, qty) {
  var lower = name.toLowerCase();
  if (/bait\s+station|rodent\s+bait|\brbs\b|rodent\s+station/.test(lower) || lower.indexOf('eradico') !== -1) {
    equipment.rbsQty += qty;
    return;
  }
  if (/multicatch|multi-catch|\bmrt\b|mouse\s+trap/.test(lower)) {
    equipment.multCatchQty += qty;
    return;
  }
  if (/lumnia|insect\s+light\s+trap|\bilt\b|fly\s+light/.test(lower)) {
    equipment.iltQty += qty;
    return;
  }
  equipment.otherEquipment.push({ name: name, quantity: qty });
}

function buildEquipmentSignature(equipment) {
  if (!equipment) return '';
  var parts = [];
  if (equipment.multCatchQty) parts.push(formatQuantity(equipment.multCatchQty) + ' MRT');
  if (equipment.rbsQty) parts.push(formatQuantity(equipment.rbsQty) + ' RBS');
  if (equipment.iltQty) parts.push(formatQuantity(equipment.iltQty) + ' ILT');
  (equipment.otherEquipment || []).forEach(function(item) {
    if (!item || !item.name) return;
    var qty = item.quantity ? formatQuantity(item.quantity) + ' ' : '';
    parts.push((qty ? qty : '') + item.name);
  });
  return parts.join(', ');
}

function extractInlineAddress(line) {
  if (!line) return null;
  var cleaned = line.replace(/\s+\d{1,2}\s*$/, '').trim();
  var stateZipMatch = cleaned.match(/([A-Z]{2})[,\s]*([0-9]{5}(?:-?[0-9]{4})?)\s*$/);
  if (!stateZipMatch) return null;
  var beforeState = cleaned.slice(0, stateZipMatch.index).trim().replace(/[,\s]+$/, '');
  var street = beforeState;
  var city = null;

  var streetSuffixPattern = /\b(Road|Rd|Street|St|Drive|Dr|Lane|Ln|Boulevard|Blvd|Avenue|Ave|Way|Court|Ct|Trail|Trl|Parkway|Pkwy|Circle|Cir)\b/ig;
  var suffixMatch = null;
  var match;
  while ((match = streetSuffixPattern.exec(beforeState)) !== null) {
    suffixMatch = match;
  }
  if (suffixMatch) {
    var suffixEnd = suffixMatch.index + suffixMatch[0].length;
    var potentialCity = beforeState.slice(suffixEnd).trim().replace(/^,/, '').trim();
    if (potentialCity) {
      city = potentialCity;
      street = beforeState.slice(0, suffixEnd).trim();
    }
  }
  if (!city) {
    var lastComma = beforeState.lastIndexOf(',');
    if (lastComma !== -1) {
      city = beforeState.slice(lastComma + 1).trim();
      street = beforeState.slice(0, lastComma).trim();
    }
  }
  if (!city) {
    var tokens = beforeState.split(/\s+/);
    if (tokens.length >= 2) {
      city = tokens[tokens.length - 1];
      street = tokens.slice(0, -1).join(' ');
    }
  }

  return {
    raw: cleaned,
    street: street || beforeState,
    city: city || null,
    state: stateZipMatch[1],
    zip: stateZipMatch[2]
  };
}

function formatQuantity(value) {
  if (value === null || value === undefined) return '';
  if (Math.abs(value - Math.round(value)) < 0.00001) {
    return String(Math.round(value));
  }
  return String(value);
}

function extractPricing(lines) {
  // First, find the Investment Summary section (more flexible search)
  // Skip table of contents entries (lines that are just numbers or page numbers)
  var summaryIdx = findFirstIndex(lines, function(line) {
    if (!line) return false;
    var lower = line.toLowerCase();
    // Skip if it looks like a table of contents entry (just a number or page number)
    if (/^\d+\s+(investment\s+summary|total\s+investment)/i.test(line)) {
      return false;
    }
    // Look for Investment Summary or Total investment, but not in TOC format
    if (/investment\s+summary/i.test(line) && !/^\d+\s+investment/i.test(line)) {
      return true;
    }
    if (/total\s+investment/i.test(lower) && !/^\d+\s+total/i.test(line)) {
      return true;
    }
    return false;
  });
  
  // If not found, search entire document for pricing labels and "Total investment" line
  if (summaryIdx === -1) {
    logDebug('[Pricing] Investment Summary section not found, searching entire document');
    
    // First, try to find "Total investment" line (most reliable)
    var totalLine = null;
    for (var k = 0; k < lines.length; k++) {
      if (/total\s+investment/i.test(lines[k].toLowerCase())) {
        totalLine = lines[k];
        logDebug('[Pricing] Found Total investment line in full document: ' + totalLine);
        break;
      }
    }
    
    if (totalLine) {
      // Extract all currency values from this line
      var allCurrencies = [];
      var currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
      var match;
      while ((match = currencyRegex.exec(totalLine)) !== null) {
        allCurrencies.push(parseFloat(match[1].replace(/,/g, '')));
      }
      logDebug('[Pricing] Extracted ' + allCurrencies.length + ' currency values from Total investment line: ' + allCurrencies.join(', '));
      // If we found 3 or more values, use them
      if (allCurrencies.length >= 3) {
        return {
          oneTimeCost: allCurrencies[0],
          initialSvcCost: allCurrencies[1],
          avgMonthlyCost: allCurrencies[2]
        };
      }
    }
    
    // Fallback to searching for individual labels
    return {
      oneTimeCost: findCurrencyAfterLabel(lines, /one[-\s]?time\s+cost/i),
      initialSvcCost: findCurrencyAfterLabel(lines, /initial\s+(?:svc|service)\s+cost/i),
      avgMonthlyCost: findCurrencyAfterLabel(lines, /(?:avg|average)\s+monthly\s+cost/i)
    };
  }
  
  logDebug('[Pricing] Found Investment Summary at line ' + summaryIdx + ': ' + lines[summaryIdx]);
  
  // Extract pricing from Investment Summary section (next 30 lines, more generous)
  var summaryLines = [];
  var foundTotalInvestment = false;
  for (var i = summaryIdx; i < lines.length && i < summaryIdx + 30; i++) {
    var line = lines[i];
    if (!line) continue;
    var lower = line.toLowerCase();
    
    // Always include "Total investment" lines
    if (/total\s+investment/i.test(lower)) {
      summaryLines.push(line);
      foundTotalInvestment = true;
      continue;
    }
    
    // Stop if we hit another major section (but allow a few more lines after Investment Summary header)
    if (i > summaryIdx + 1 && (
      /^(scope|equipment|routine|covered|timeline|requested|about|innovation|table|documentation|additional|terms)/i.test(lower) ||
      /^page\s+\d+/i.test(lower)
    )) {
      // If we haven't found the total investment line yet, keep looking a bit more
      if (!foundTotalInvestment && i < summaryIdx + 15) {
        summaryLines.push(line);
        continue;
      }
      break;
    }
    summaryLines.push(line);
  }
  
  logDebug('[Pricing] Extracted ' + summaryLines.length + ' lines from Investment Summary section');
  if (summaryLines.length > 0) {
    logDebug('[Pricing] First few lines: ' + summaryLines.slice(0, 5).join(' | '));
  }
  
  // First, try to find "Total investment" line with all three values (most reliable)
  var totalLine = null;
  for (var j = 0; j < summaryLines.length; j++) {
    if (/total\s+investment/i.test(summaryLines[j].toLowerCase())) {
      totalLine = summaryLines[j];
      logDebug('[Pricing] Found Total investment line: ' + totalLine);
      break;
    }
  }
  
  var oneTimeCost = null;
  var initialSvcCost = null;
  var avgMonthlyCost = null;
  
  if (totalLine) {
    // Extract all currency values from this line
    var allCurrencies = [];
    var currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
    var match;
    while ((match = currencyRegex.exec(totalLine)) !== null) {
      allCurrencies.push(parseFloat(match[1].replace(/,/g, '')));
    }
    logDebug('[Pricing] Extracted ' + allCurrencies.length + ' currency values from Total investment line: ' + allCurrencies.join(', '));
    // If we found 3 or more values, use them in order: One-Time, Initial Svc, Monthly
    if (allCurrencies.length >= 3) {
      oneTimeCost = allCurrencies[0];
      initialSvcCost = allCurrencies[1];
      avgMonthlyCost = allCurrencies[2];
      logDebug('[Pricing] Using values from Total investment line');
    }
  }
  
  // If we didn't get all values from Total investment line, try individual labels
  // Also try to extract from table format where headers are on one line and values on subsequent lines
  if (!oneTimeCost || !initialSvcCost || !avgMonthlyCost) {
    // Look for header line with all three labels
    var headerLineIdx = -1;
    for (var h = 0; h < summaryLines.length; h++) {
      var headerLine = summaryLines[h];
      if (/one[-\s]?time\s+cost/i.test(headerLine) && 
          /initial\s+(?:svc|service)\s+cost/i.test(headerLine) && 
          /(?:avg|average)\s+monthly\s+cost/i.test(headerLine)) {
        headerLineIdx = h;
        logDebug('[Pricing] Found header line with all three labels at index ' + h);
        break;
      }
    }
    
    // If we found a header line, the values are likely on the next few lines
    if (headerLineIdx >= 0) {
      // Look for currency values on lines after the header
      // Track which value we're looking for next (0=oneTime, 1=initialSvc, 2=avgMonthly)
      var nextValueIndex = 0;
      for (var v = headerLineIdx + 1; v < summaryLines.length && v <= headerLineIdx + 10; v++) {
        var valueLine = summaryLines[v];
        if (!valueLine) continue;
        // Skip address lines
        if (/\b(road|street|avenue|blvd|boulevard|drive|lane|way|court|circle|houston|tx|texas|us|tayho)\b/i.test(valueLine)) continue;
        if (/^\d+\s+[a-z]/i.test(valueLine)) continue;
        // Skip lines that are just location names or headers
        if (/^[A-Z][a-z]+,\s*\d+/i.test(valueLine) && !/\$/.test(valueLine)) continue;
        
        // Extract all currency values from this line
        var currencies = [];
        var currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
        var match;
        while ((match = currencyRegex.exec(valueLine)) !== null) {
          currencies.push(parseFloat(match[1].replace(/,/g, '')));
        }
        
        // If we found values on this line, assign them
        // If all three are on one line, use them in order
        if (currencies.length >= 3) {
          if (!oneTimeCost) oneTimeCost = currencies[0];
          if (!initialSvcCost) initialSvcCost = currencies[1];
          if (!avgMonthlyCost) avgMonthlyCost = currencies[2];
          logDebug('[Pricing] Extracted all three values from line ' + v + ': ' + currencies.join(', '));
          break; // Found all three, we're done
        }
        // If only one value per line (table format), assign them sequentially based on position
        else if (currencies.length === 1) {
          if (nextValueIndex === 0 && !oneTimeCost) {
            oneTimeCost = currencies[0];
            nextValueIndex = 1;
            logDebug('[Pricing] Extracted oneTimeCost from line ' + v + ': ' + oneTimeCost);
          } else if (nextValueIndex === 1 && !initialSvcCost) {
            initialSvcCost = currencies[0];
            nextValueIndex = 2;
            logDebug('[Pricing] Extracted initialSvcCost from line ' + v + ': ' + initialSvcCost);
          } else if (nextValueIndex === 2 && !avgMonthlyCost) {
            avgMonthlyCost = currencies[0];
            logDebug('[Pricing] Extracted avgMonthlyCost from line ' + v + ': ' + avgMonthlyCost);
            break; // Found all three
          }
          // If we already have this value, move to next position
          else if (nextValueIndex === 0 && oneTimeCost) {
            nextValueIndex = 1;
          } else if (nextValueIndex === 1 && initialSvcCost) {
            nextValueIndex = 2;
          }
        }
        // If two values on a line
        else if (currencies.length === 2) {
          if (!oneTimeCost && !initialSvcCost) {
            oneTimeCost = currencies[0];
            initialSvcCost = currencies[1];
            logDebug('[Pricing] Extracted oneTimeCost and initialSvcCost from line ' + v);
          } else if (!initialSvcCost && !avgMonthlyCost) {
            initialSvcCost = currencies[0];
            avgMonthlyCost = currencies[1];
            logDebug('[Pricing] Extracted initialSvcCost and avgMonthlyCost from line ' + v);
            break;
          }
        }
        
        // If we found all three, we're done
        if (oneTimeCost && initialSvcCost && avgMonthlyCost) break;
      }
    }
  }
  
  // Fallback to individual label search if still missing values
  if (!oneTimeCost) {
    oneTimeCost = findCurrencyAfterLabel(summaryLines, /one[-\s]?time\s+cost/i);
  }
  if (!initialSvcCost) {
    initialSvcCost = findCurrencyAfterLabel(summaryLines, /initial\s+(?:svc|service)\s+cost/i);
  }
  if (!avgMonthlyCost) {
    avgMonthlyCost = findCurrencyAfterLabel(summaryLines, /(?:avg|average)\s+monthly\s+cost/i);
  }
  
  logDebug('[Pricing Extraction] Final values - oneTimeCost: ' + oneTimeCost + ', initialSvcCost: ' + initialSvcCost + ', avgMonthlyCost: ' + avgMonthlyCost);
  
  return {
    oneTimeCost: oneTimeCost,
    initialSvcCost: initialSvcCost,
    avgMonthlyCost: avgMonthlyCost
  };
}

function findCurrencyAfterLabel(lines, labelRegex) {
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var match = line.match(labelRegex);
    if (!match) continue;
    // Try to find currency on the same line after the label
    var remainder = line.slice(match.index + match[0].length).trim();
    // Remove any colons or dashes after the label
    remainder = remainder.replace(/^[:\s-]+/, '').trim();
    var value = parseFirstCurrency(remainder);
    if (value !== null) {
      return value;
    }
    // Try next 5 lines (in case value is on separate line)
    for (var look = 1; look <= 5; look++) {
      var nextIdx = i + look;
      if (nextIdx >= lines.length) break;
      var candidate = lines[nextIdx];
      if (!candidate) continue;
      // Skip if next line looks like another label (but allow currency-only lines)
      if (/^[a-z]+\s+(?:cost|price|total|investment)/i.test(candidate) && !/\$/.test(candidate)) break;
      // Skip lines that look like addresses (contain street names, city/state patterns)
      if (/\b(road|street|avenue|blvd|boulevard|drive|lane|way|court|circle|houston|tx|texas|us)\b/i.test(candidate)) continue;
      // Skip lines that are just addresses (numbers followed by street names)
      if (/^\d+\s+[a-z]/i.test(candidate)) continue;
      var fallback = parseFirstCurrency(candidate);
      if (fallback !== null) {
        return fallback;
      }
    }
  }
  return null;
}

function parseFirstCurrency(value) {
  if (!value) return null;
  // Only match currency with $ sign - don't match plain numbers (could be addresses, zip codes, etc.)
  var match = value.match(/\$([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

function extractCoveredPestsSection(lines) {
  var idx = findFirstIndex(lines, function(line) {
    return /^covered\s+pests/i.test(line);
  });
  if (idx === -1) {
    return [];
  }

  var pests = [];
  for (var i = idx + 1; i < lines.length; i++) {
    var line = lines[i];
    if (!line) break;
    if (/^service\s+\d+/i.test(line)) break;
    if (isHeaderBlockStop(line)) break;
    var normalized = line.replace(/^[•\-\*\u2022]+\s*/g, '').trim();
    if (!normalized) continue;
    var parts = splitCommaSafe(normalized);
    parts.forEach(function(part) {
      var cleaned = part.replace(/\s+/g, ' ').trim();
      if (cleaned) pests.push(cleaned);
    });
  }
  return dedupeList(pests);
}

function splitCommaSafe(value) {
  var result = [];
  var current = '';
  var depth = 0;
  for (var i = 0; i < value.length; i++) {
    var char = value[i];
    if (char === '(') depth++;
    if (char === ')' && depth > 0) depth--;
    if (char === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function extractRoutineServices(lines, equipment) {
  var idx = findFirstIndex(lines, function(line) {
    return /routine\s+management\s+services/i.test(line);
  });
  if (idx === -1) {
    return buildFallbackServicesFromEquipment(equipment);
  }

  var endIdx = findFirstIndexFrom(lines, idx + 1, function(line) {
    if (!line) return false;
    var lower = line.toLowerCase();
    for (var i = 0; i < ROUTINE_SECTION_TERMINATORS.length; i++) {
      if (lower.indexOf(ROUTINE_SECTION_TERMINATORS[i]) === 0) {
        return true;
      }
    }
    return false;
  });
  if (endIdx === -1) {
    endIdx = lines.length;
  }

  var block = lines.slice(idx + 1, endIdx);
  var signals = createServiceSignals();
  var serviceTemplates = [
    { code: 'GPC', keywords: ['general pest'], serviceName: 'General Pest Control', category: 'GPC', programType: 'General Pest Control', defaultFreq: 'Monthly', defaultPerYear: 12, signal: 'hasGpc' },
    { code: 'MRT', keywords: ['interior monitoring'], serviceName: 'Interior Rodent Monitoring', category: 'Rodent Monitoring', programType: 'Interior Monitoring', defaultFreq: 'Semi-Monthly', defaultPerYear: 24, signal: 'hasRodent' },
    { code: 'RBS', keywords: ['exterior monitoring'], serviceName: 'Exterior Rodent Monitoring', category: 'Rodent Monitoring', programType: 'Exterior Monitoring', defaultFreq: 'Monthly', defaultPerYear: 12, signal: 'hasRodent' },
    { code: 'ILT', keywords: ['insect light trap', 'ilt maintenance', 'light trap maintenance'], serviceName: 'Insect Light Trap Maintenance', category: 'Fly / ILT', programType: 'Insect Light Trap Maintenance', defaultFreq: 'Semi-Monthly', defaultPerYear: 24, signal: 'hasIlt' }
  ];

  var servicesByCode = {};
  var currentCode = null;

  function ensureService(template) {
    if (!servicesByCode[template.code]) {
      servicesByCode[template.code] = createService(template.serviceName, template.code, template.category, template.programType, template.defaultFreq, template.defaultPerYear);
    }
    if (template.signal === 'hasGpc') signals.hasGpc = true;
    if (template.signal === 'hasRodent') signals.hasRodent = true;
    if (template.signal === 'hasIlt') signals.hasIlt = true;
  }

  var iltSemi = false;

  block.forEach(function(line) {
    if (!line) return;
    var lower = line.toLowerCase();
    if (/insect\s+light|ilt/.test(lower) && /semi/.test(lower)) iltSemi = true;
    for (var t = 0; t < serviceTemplates.length; t++) {
      var template = serviceTemplates[t];
      var matched = template.keywords.some(function(keyword) {
        return lower.indexOf(keyword) !== -1;
      });
      if (matched) {
        ensureService(template);
        currentCode = template.code;
        return;
      }
    }

    if (/service\s+frequency/i.test(lower) && currentCode && servicesByCode[currentCode]) {
      var freqLabel = extractFrequencyLabel(line);
      var perYear = extractServicesPerYear(line, freqLabel);
      if (freqLabel) servicesByCode[currentCode].frequencyLabel = freqLabel;
      if (perYear) servicesByCode[currentCode].servicesPerYear = perYear;
      return;
    }
  });

  var services = Object.keys(servicesByCode).map(function(code) {
    return servicesByCode[code];
  });

  if (iltSemi) {
    services.forEach(function(svc){
      if (svc.serviceCode === 'ILT') {
        svc.frequencyLabel = 'Semi-Monthly';
        svc.servicesPerYear = 24;
      }
    });
  }

  if (!services.length) {
    return buildFallbackServicesFromEquipment(equipment);
  }

  if (!services.some(function(service) { return service.serviceCode === 'GPC'; })) {
    var gpcTemplate = serviceTemplates[0];
    ensureService(gpcTemplate);
    services.push(servicesByCode[gpcTemplate.code]);
  }

  services.sort(function(a, b) {
    return serviceOrder(a.serviceCode) - serviceOrder(b.serviceCode);
  });

  return { services: services, signals: signals };
}

function buildFallbackServicesFromEquipment(equipment) {
  var signals = createServiceSignals();
  var services = [];
  services.push(createService('General Pest Control', 'GPC', 'GPC', 'General Pest Control', 'Monthly', 12));
  signals.hasGpc = true;
  if (equipment && (equipment.multCatchQty > 0 || equipment.rbsQty > 0)) {
    services.push(createService('Interior/Exterior Rodent Monitoring', 'RODENT', 'Rodent Monitoring', 'Rodent Monitoring', 'Monthly', 12));
    signals.hasRodent = true;
  }
  if (equipment && equipment.iltQty > 0) {
    services.push(createService('Insect Light Trap Maintenance', 'ILT', 'Fly / ILT', 'Insect Light Trap Maintenance', 'Semi-Monthly', 24));
    signals.hasIlt = true;
  }
  return { services: services, signals: signals };
}

function createService(name, code, category, programType, freqLabel, perYear) {
  var frequencyLabel = freqLabel ? toTitleCase(freqLabel) : null;
  var servicesPerYear = perYear || inferServicesPerYear(frequencyLabel);
  if (!servicesPerYear && frequencyLabel) {
    servicesPerYear = inferServicesPerYear(frequencyLabel);
  }
  if (!servicesPerYear && frequencyLabel && frequencyLabel.toLowerCase().indexOf('semi-monthly') !== -1) {
    servicesPerYear = 24;
  }
  if (!servicesPerYear && frequencyLabel && frequencyLabel.toLowerCase().indexOf('monthly') !== -1) {
    servicesPerYear = 12;
  }
  var normalizedFrequency = frequencyLabel || (servicesPerYear ? frequencyFromPerYear(servicesPerYear) : null);
  return {
    serviceName: name,
    serviceCode: code,
    category: category,
    programType: programType,
    descriptionText: 'Imported from Routine Management Services',
    frequencyLabel: normalizedFrequency,
    servicesPerYear: servicesPerYear,
    afterHours: null,
    initialAmount: null,
    pricePerService: null
  };
}

function serviceOrder(code) {
  var order = {
    'GPC': 0,
    'MRT': 1,
    'RBS': 2,
    'RODENT': 3,
    'ILT': 4
  };
  return order.hasOwnProperty(code) ? order[code] : 10;
}

function createServiceSignals() {
  return {
    hasGpc: false,
    hasRodent: false,
    hasIlt: false
  };
}

function extractFrequencyLabel(text) {
  if (!text) return null;
  var value = text.split('(')[0].replace(/[-–]+/g, ' ').trim();
  if (!value) return null;
  return toTitleCase(value);
}

function extractServicesPerYear(text, freqLabel) {
  if (!text) return null;
  var perYearMatch = text.match(/\((\d+)\s*x\)/i);
  if (perYearMatch) {
    return parseInt(perYearMatch[1], 10);
  }
  return inferServicesPerYear(freqLabel);
}

function inferServicesPerYear(label) {
  if (!label) return null;
  var lower = label.toLowerCase();
  if (lower.indexOf('weekly') !== -1) return 52;
  if (lower.indexOf('bi-weekly') !== -1) return 26;
  if (lower.indexOf('semi-monthly') !== -1) return 24;
  if (lower.indexOf('monthly') !== -1) return 12;
  if (lower.indexOf('quarter') !== -1) return 4;
  if (lower.indexOf('semi-annual') !== -1) return 2;
  if (lower.indexOf('annual') !== -1 || lower.indexOf('yearly') !== -1) return 1;
  return null;
}

function frequencyFromPerYear(perYear) {
  switch (perYear) {
    case 52: return 'Weekly';
    case 26: return 'Bi-Weekly';
    case 24: return 'Semi-Monthly';
    case 12: return 'Monthly';
    case 4: return 'Quarterly';
    case 2: return 'Semi-Annual';
    case 1: return 'Annual';
    default: return null;
  }
}

function deriveCoveredPests(explicitList, signals, equipment) {
  var seen = {};
  var result = [];
  explicitList.forEach(function(item) {
    var key = (item || '').toLowerCase();
    if (item && !seen[key]) {
      seen[key] = true;
      result.push(item);
    }
  });

  function add(value) {
    if (!value) return;
    var key = value.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(value);
  }

  var hasRodentSignal = signals.hasRodent || (equipment && (equipment.rbsQty > 0 || equipment.multCatchQty > 0));
  var hasIltSignal = signals.hasIlt || (equipment && equipment.iltQty > 0);

  if (signals.hasGpc) {
    add('Pavement Ants');
  }
  if (hasRodentSignal) {
    add('Common Rodents');
  }
  if (signals.hasGpc) {
    add('Common Roaches');
  }
  if (hasIltSignal) {
    add('Common House Fly');
  }

  return result;
}

function dedupeList(list) {
  var result = [];
  var seen = {};
  list.forEach(function(item) {
    if (!item) return;
    var key = item.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(item);
  });
  return result;
}

function extractRequestedStart(lines) {
  var result = { requestedStartDate: null, startMonth: null };
  var idx = findFirstIndex(lines, function(line) {
    return /requested\s+start\s+date/i.test(line);
  });
  if (idx === -1) {
    return result;
  }

  for (var i = idx; i <= idx + 3 && i < lines.length; i++) {
    var parsed = parseDateLine(lines[i]);
    if (parsed) {
      result.requestedStartDate = parsed;
      break;
    }
  }

  if (result.requestedStartDate) {
    result.startMonth = monthNameFromIso(result.requestedStartDate);
    return result;
  }

  if (idx + 1 < lines.length) {
    var monthCandidate = normalizeMonthName(lines[idx + 1]);
    if (monthCandidate) {
      result.startMonth = monthCandidate;
    }
  }

  return result;
}

function parseDateLine(line) {
  if (!line) return null;
  var slashMatch = line.match(/([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})/);
  if (slashMatch) {
    var month = slashMatch[1];
    var day = slashMatch[2];
    var year = slashMatch[3];
    return year + '-' + pad2(month) + '-' + pad2(day);
  }
  var textMatch = line.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-9]{1,2})(?:,?\s+([0-9]{4}))?/i);
  if (textMatch) {
    var monthIndex = MONTH_NAMES.indexOf(textMatch[1].charAt(0).toUpperCase() + textMatch[1].slice(1).toLowerCase());
    if (monthIndex !== -1) {
      var dayText = textMatch[2];
      var yearText = textMatch[3] || new Date().getFullYear();
      return yearText + '-' + pad2(monthIndex + 1) + '-' + pad2(dayText);
    }
  }
  return null;
}

function monthNameFromIso(iso) {
  if (!iso) return null;
  var parts = iso.split('-');
  if (parts.length !== 3) return null;
  var monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex >= 0 && monthIndex < MONTH_NAMES.length) {
    return MONTH_NAMES[monthIndex];
  }
  return null;
}

function normalizeMonthName(value) {
  if (!value) return null;
  var lower = value.toLowerCase();
  for (var i = 0; i < MONTH_NAMES.length; i++) {
    if (lower.indexOf(MONTH_NAMES[i].toLowerCase()) !== -1) {
      return MONTH_NAMES[i];
    }
  }
  return null;
}

function pad2(value) {
  value = String(value);
  return value.length === 1 ? '0' + value : value;
}

function gatherBlock(lines, startIdx, stopCheck, limit) {
  var block = [];
  for (var i = startIdx; i < lines.length; i++) {
    if (limit && block.length >= limit) break;
    var line = lines[i];
    if (!line) continue;
    if (i !== startIdx && stopCheck(line)) {
      break;
    }
    block.push(line);
  }
  return block;
}

function findFirstIndex(lines, predicate) {
  return findFirstIndexFrom(lines, 0, predicate);
}

function findFirstIndexFrom(lines, start, predicate) {
  for (var i = start; i < lines.length; i++) {
    if (predicate(lines[i], i)) {
      return i;
    }
  }
  return -1;
}

function isHeaderBlockStop(line) {
  if (!line) return false;
  var lower = line.toLowerCase();
  for (var i = 0; i < HEADER_BLOCK_TERMINATORS.length; i++) {
    if (lower.indexOf(HEADER_BLOCK_TERMINATORS[i]) === 0) {
      return true;
    }
  }
  return false;
}

function toTitleCase(value) {
  if (!value) return '';
  return value.split(/\s+/).map(function(part) {
    if (!part.length) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

function buildInitialDescription(equipment, initialCost) {
  var parts = [];
  if (equipment.multCatchQty > 0) parts.push(equipment.multCatchQty + " MRT");
  if (equipment.rbsQty > 0) parts.push(equipment.rbsQty + " RBS");
  if (equipment.iltQty > 0) parts.push(equipment.iltQty + " ILT");
  if (!parts.length && initialCost > 0) return "Initial service";
  if (!parts.length) return "Standard Initial Setup";
  var equipmentList = parts.length > 1 ? parts.slice(0, -1).join(", ") + ", & " + parts.slice(-1) : parts[0];
  return "Initial service and install " + equipmentList;
}

function buildMaintenanceDescription(services) {
  if (!services || services.length === 0) return "Monthly GPC";
  var hasAfterHours = false;
  var normalized = services.map(function(svc) {
    var rawName = (svc.serviceName || svc.programType || "").toLowerCase();
    if (/after\s+hours.*yes/i.test(rawName) || svc.afterHours) hasAfterHours = true;
    var code = (svc.serviceCode || '').toUpperCase();
    var label = (function(){
      if (code === 'GPC') return 'GPC';
      if (code === 'RBS') return 'Exterior Rodent Monitoring';
      if (code === 'MRT') return 'Interior Rodent Monitoring';
      if (code === 'ILT') return 'ILT Maintenance';
      var name = svc.serviceName || svc.programType || "Service";
      return name.replace(/maintenance/i, '').trim() || 'Service';
    })();
    var freq = svc.frequencyLabel || null;
    if (!freq && svc.servicesPerYear) {
      freq = svc.servicesPerYear >= 24 ? 'Semi-Monthly' : svc.servicesPerYear >= 12 ? 'Monthly' : null;
    }
    if (code === 'ILT' && svc.servicesPerYear >= 24) freq = 'Semi-Monthly';
    if (!freq) freq = 'Monthly';
    return { code: code, label: label, text: freq + " " + label };
  }).filter(function(entry){
    return ['GPC','RBS','MRT','ILT'].indexOf(entry.code) !== -1;
  });
  var order = { 'GPC':0,'RBS':1,'MRT':2,'ILT':3 };
  normalized.sort(function(a,b){
    var ao = order.hasOwnProperty(a.code)?order[a.code]:9;
    var bo = order.hasOwnProperty(b.code)?order[b.code]:9;
    if (ao === bo) return a.text.localeCompare(b.text);
    return ao - bo;
  });
  var dedup = [];
  normalized.forEach(function(entry){
    if (!dedup.some(function(d){ return d.code === entry.code && d.label === entry.label; })) dedup.push(entry);
  });
  var joined = dedup.length > 1 ? dedup.slice(0,-1).map(function(e){return e.text;}).join(", ") + " & " + dedup.slice(-1)[0].text : dedup[0].text;
  if (hasAfterHours) joined += " (Includes After Hours Service)";
  return joined;
}
