/**
 * Salesforce Quote Parser for Rentokil One View
 * Standalone JavaScript implementation
 *
 * Parses Salesforce quote PDFs into structured StartPacketDraft objects
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const PARSER_CONFIG = {
  HEADER_BLOCK_TERMINATORS: [
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
  ],

  ROUTINE_SECTION_TERMINATORS: [
    'investment summary',
    'plan limitations',
    'scope of service',
    'equipment summary',
    'covered pests',
    'timeline',
    'requested start date',
    'about presto-x',
    'innovation & technology'
  ],

  ADDRESS_LINE_REGEX: /^[0-9].*(?:\b(?:st|street|rd|road|dr|drive|ln|lane|blvd|boulevard|ave|avenue|hwy|highway|way|trail|trl|terrace|ter|pkwy|parkway|court|ct|cir|circle|loop|suite|ste|unit)\b)/i,

  CITY_STATE_ZIP_REGEX: /^(.+?),\s*([A-Z]{2})[,\s]*([0-9]{5})(?:-?[0-9]{4})?/,

  EMAIL_REGEX: /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,

  MONTH_NAMES: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function logDebug(value) {
  if (typeof console !== 'undefined' && console.log) {
    console.log('[SF Parser]', value);
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
  const normalized = normalizeLabelText(line);
  return normalized.indexOf('tailoredfor') === 0 ||
    normalized.indexOf('tailorfor') === 0 ||
    normalized.indexOf('taylorfor') === 0 ||
    normalized.indexOf('preparedfor') === 0;
}

function stripHeaderLabelPrefixes(line) {
  if (!line) return '';
  let result = line.trim();
  const patterns = [
    /^(tailor(?:ed)?|taylor)\s*(?:for|4)\b/i,
    /^prepared\s+for\b/i,
    /^account\s+name\b/i,
    /^customer\s+name\b/i
  ];
  for (const pattern of patterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, '').trim();
      break;
    }
  }
  return result.replace(/^[:\s,-]+/, '');
}

function roundCurrency(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100) / 100;
}

function parseFirstCurrency(value) {
  if (!value) return null;
  const match = value.match(/\$([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

function splitCommaSafe(value) {
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
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

function dedupeList(list) {
  const result = [];
  const seen = {};
  list.forEach(item => {
    if (!item) return;
    const key = item.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(item);
  });
  return result;
}

function pad2(value) {
  value = String(value);
  return value.length === 1 ? '0' + value : value;
}

function toTitleCase(value) {
  if (!value) return '';
  return value.split(/\s+/).map(part => {
    if (!part.length) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

function findFirstIndex(lines, predicate) {
  return findFirstIndexFrom(lines, 0, predicate);
}

function findFirstIndexFrom(lines, start, predicate) {
  for (let i = start; i < lines.length; i++) {
    if (predicate(lines[i], i)) {
      return i;
    }
  }
  return -1;
}

function gatherBlock(lines, startIdx, stopCheck, limit) {
  const block = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (limit && block.length >= limit) break;
    const line = lines[i];
    if (!line) continue;
    if (i !== startIdx && stopCheck(line)) {
      break;
    }
    block.push(line);
  }
  return block;
}

function isHeaderBlockStop(line) {
  if (!line) return false;
  const lower = line.toLowerCase();
  for (const terminator of PARSER_CONFIG.HEADER_BLOCK_TERMINATORS) {
    if (lower.indexOf(terminator) === 0) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// LINE EXPANSION
// ============================================================================

function expandLines(inputLines) {
  const result = [];
  inputLines.forEach(line => {
    if (!line) return;

    // Split on "PREPARED BY:" and "TAILORED FOR:" patterns first
    const splitPattern = /(PREPARED\s+BY:|TAILORED\s+FOR:)/i;
    if (splitPattern.test(line)) {
      const parts = line.split(splitPattern);
      let current = '';
      for (let i = 0; i < parts.length; i++) {
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
      line.split(/\s{2,}/).forEach(part => {
        part = part.trim();
        if (part.length) result.push(part);
      });
    } else if (line.length > 140 && /\s{2,}/.test(line)) {
      line.split(/\s{2,}/).forEach(part => {
        part = part.trim();
        if (part.length) result.push(part);
      });
    } else {
      result.push(line);
    }
  });
  return result;
}

// ============================================================================
// EQUIPMENT EXTRACTION
// ============================================================================

function categorizeEquipment(equipment, name, qty) {
  const lower = name.toLowerCase();
  if (/bait\s+station|rodent\s+bait|\brbs\b|rodent\s+station/.test(lower) ||
      lower.indexOf('eradico') !== -1) {
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
  const parts = [];
  if (equipment.multCatchQty) parts.push(formatQuantity(equipment.multCatchQty) + ' MRT');
  if (equipment.rbsQty) parts.push(formatQuantity(equipment.rbsQty) + ' RBS');
  if (equipment.iltQty) parts.push(formatQuantity(equipment.iltQty) + ' ILT');
  (equipment.otherEquipment || []).forEach(item => {
    if (!item || !item.name) return;
    const qty = item.quantity ? formatQuantity(item.quantity) + ' ' : '';
    parts.push((qty ? qty : '') + item.name);
  });
  return parts.join(', ');
}

function formatQuantity(value) {
  if (value === null || value === undefined) return '';
  if (Math.abs(value - Math.round(value)) < 0.00001) {
    return String(Math.round(value));
  }
  return String(value);
}

function extractEquipmentSection(lines) {
  const equipment = {
    rbsQty: 0,
    multCatchQty: 0,
    iltQty: 0,
    otherEquipment: [],
    summary: ''
  };
  let totalCost = null;

  // Anchor to "Total Cost of Equipment" to avoid TOC rows
  const totalIdx = findFirstIndex(lines, line => /^total\s+cost\s+of\s+equipment/i.test(line));
  if (totalIdx === -1) {
    return { equipment: equipment, totalCost: totalCost };
  }

  let startIdx = -1;
  for (let back = totalIdx - 1; back >= Math.max(0, totalIdx - 30); back--) {
    const line = lines[back] || '';
    if (/equipment\s+summary/i.test(line)) continue;
    if (/^equipment\b/i.test(line) || /equipment\s+quantity/i.test(line) || /\bequipment\b/i.test(line)) {
      startIdx = back;
      break;
    }
  }
  if (startIdx === -1) {
    return { equipment: equipment, totalCost: totalCost };
  }

  const endIdx = totalIdx;

  for (let i = startIdx + 1; i < endIdx; i++) {
    const row = lines[i];
    if (!row || isHeaderBlockStop(row)) continue;
    if (/routine\s+management\s+services/i.test(row)) break;
    if (/service\s+frequency/i.test(row)) continue;

    // Check 1: Number at END of line (Standard)
    let qtyMatch = row.match(/([0-9]+(?:\.[0-9]+)?)\s*$/);

    // Check 2: Number at START of line (Fallback)
    if (!qtyMatch) {
      const startMatch = row.match(/^\s*([0-9]+)\s+(.*)/);
      if (startMatch) {
        const qty = parseFloat(startMatch[1]);
        const name = startMatch[2].trim();
        categorizeEquipment(equipment, name, qty);
        continue;
      }
    }

    if (!qtyMatch) continue;
    const qty = parseFloat(qtyMatch[1]);
    if (isNaN(qty)) continue;
    const name = row.slice(0, row.length - qtyMatch[0].length).trim();
    if (!name) continue;
    categorizeEquipment(equipment, name, qty);
  }

  const totalLine = lines[endIdx];
  const parsedTotal = parseFirstCurrency(totalLine);
  if (parsedTotal !== null) {
    totalCost = parsedTotal;
  }

  equipment.summary = buildEquipmentSignature(equipment);
  return { equipment: equipment, totalCost: totalCost };
}

// ============================================================================
// ADDRESS EXTRACTION
// ============================================================================

function extractInlineAddress(line) {
  if (!line) return null;
  const cleaned = line.replace(/\s+\d{1,2}\s*$/, '').trim();
  const stateZipMatch = cleaned.match(/([A-Z]{2})[,\s]*([0-9]{5}(?:-?[0-9]{4})?)\s*$/);
  if (!stateZipMatch) return null;

  const beforeState = cleaned.slice(0, stateZipMatch.index).trim().replace(/[,\s]+$/, '');
  let street = beforeState;
  let city = null;

  const streetSuffixPattern = /\b(Road|Rd|Street|St|Drive|Dr|Lane|Ln|Boulevard|Blvd|Avenue|Ave|Way|Court|Ct|Trail|Trl|Parkway|Pkwy|Circle|Cir)\b/ig;
  let suffixMatch = null;
  let match;
  while ((match = streetSuffixPattern.exec(beforeState)) !== null) {
    suffixMatch = match;
  }
  if (suffixMatch) {
    const suffixEnd = suffixMatch.index + suffixMatch[0].length;
    const potentialCity = beforeState.slice(suffixEnd).trim().replace(/^,/, '').trim();
    if (potentialCity) {
      city = potentialCity;
      street = beforeState.slice(0, suffixEnd).trim();
    }
  }
  if (!city) {
    const lastComma = beforeState.lastIndexOf(',');
    if (lastComma !== -1) {
      city = beforeState.slice(lastComma + 1).trim();
      street = beforeState.slice(0, lastComma).trim();
    }
  }
  if (!city) {
    const tokens = beforeState.split(/\s+/);
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

function findFirstEmail(lines) {
  for (const line of lines) {
    const match = line.match(PARSER_CONFIG.EMAIL_REGEX);
    if (match) {
      return match[1];
    }
  }
  return null;
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
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 5) return false;
  return /^[A-Za-z]/.test(parts[0]);
}

function splitAccountAndContact(text) {
  if (!text) return [];
  const tokens = text.trim().split(/\s+/);

  // Avoid splitting address-like strings
  if ((/^\d/.test(text) && PARSER_CONFIG.ADDRESS_LINE_REGEX.test(text)) ||
      PARSER_CONFIG.CITY_STATE_ZIP_REGEX.test(text)) {
    return [text];
  }
  if (tokens.length < 3) return [text];

  for (let split = 1; split <= tokens.length - 2; split++) {
    const accountCandidate = tokens.slice(0, split).join(' ');
    const contactCandidate = tokens.slice(split).join(' ');
    if (looksLikeContactName(contactCandidate)) {
      return [accountCandidate, contactCandidate];
    }
  }
  return [text];
}

function splitMergedHeaderLine(line) {
  if (!line) return [];
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Don't split obvious address or city/state/zip lines
  if (PARSER_CONFIG.ADDRESS_LINE_REGEX.test(trimmed) || PARSER_CONFIG.CITY_STATE_ZIP_REGEX.test(trimmed)) {
    return [trimmed];
  }

  const results = [];
  const firstDigit = trimmed.search(/\d/);
  if (firstDigit > 0) {
    const before = trimmed.slice(0, firstDigit).trim();
    const after = trimmed.slice(firstDigit).trim();
    if (before) {
      splitAccountAndContact(before).forEach(part => {
        if (part) results.push(part);
      });
    }
    if (after) {
      results.push(after);
    }
    return results;
  }

  const splitParts = splitAccountAndContact(trimmed);
  if (splitParts.length > 1) {
    return splitParts;
  }
  return [trimmed];
}

function expandMergedHeaderLines(lines) {
  const expanded = [];
  lines.forEach(line => {
    if (!line) return;
    const parts = splitMergedHeaderLine(line);
    parts.forEach(part => {
      if (part && part.trim().length) {
        expanded.push(part.trim());
      }
    });
  });
  return expanded;
}

function sanitizeHeaderBlock(block) {
  const sanitized = [];
  block.forEach(line => {
    if (!line) return;
    const cleaned = stripHeaderLabelPrefixes(line);
    if (!cleaned) return;
    if (isHeaderBlockStop(cleaned)) return;
    if (/^page\s+\d+/i.test(cleaned)) return;
    if (/https?:\/\//i.test(cleaned)) return;
    if (/^[0-9]+$/.test(cleaned)) return;
    sanitized.push(cleaned);
  });
  return sanitized;
}

// ============================================================================
// HEADER EXTRACTION (Account, Contact, Address)
// ============================================================================

function extractPreparedForFields(lines) {
  const data = {
    accountName: null,
    contactName: null,
    contactEmail: null,
    serviceAddressLine1: null,
    serviceCity: null,
    serviceState: null,
    serviceZip: null
  };

  const idx = findFirstIndex(lines, line =>
    isTailoredPreparedAnchor(line) || /account\s+name/i.test(line) || /customer\s+name/i.test(line)
  );
  if (idx === -1) {
    return data;
  }

  const block = gatherBlock(lines, idx, isHeaderBlockStop, 15);
  if (!block.length) {
    return data;
  }

  let sanitized = sanitizeHeaderBlock(block);
  if (!sanitized.length) {
    return data;
  }

  data.contactEmail = findFirstEmail(sanitized);
  sanitized = sanitized.map(line => line.replace(PARSER_CONFIG.EMAIL_REGEX, '').trim())
    .filter(line => line.length > 0);

  sanitized = expandMergedHeaderLines(sanitized);

  let cursor = 0;
  while (cursor < sanitized.length && !data.accountName) {
    const candidate = sanitized[cursor];
    if (looksLikeAccountName(candidate)) {
      data.accountName = candidate;
    }
    cursor++;
  }

  while (cursor < sanitized.length && !data.contactName) {
    const contactCandidate = sanitized[cursor];
    if (looksLikeContactName(contactCandidate)) {
      data.contactName = contactCandidate;
      break;
    }
    cursor++;
  }

  for (let i = 0; i < sanitized.length; i++) {
    const line = sanitized[i];
    if (!data.serviceAddressLine1 && PARSER_CONFIG.ADDRESS_LINE_REGEX.test(line)) {
      const components = extractInlineAddress(line);
      if (components) {
        data.serviceAddressLine1 = components.street || components.raw;
        data.serviceCity = components.city || data.serviceCity;
        data.serviceState = components.state || data.serviceState;
        data.serviceZip = components.zip || data.serviceZip;
      } else {
        data.serviceAddressLine1 = line;
        if (i + 1 < sanitized.length) {
          const cityMatch = sanitized[i + 1].match(PARSER_CONFIG.CITY_STATE_ZIP_REGEX);
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

// ============================================================================
// PREPARED BY (AE) EXTRACTION
// ============================================================================

function extractPreparedBySection(lines) {
  const result = { aeName: null, aeEmail: null };
  const idx = findFirstIndex(lines, line => /prepared\s+by\b/i.test(line));
  if (idx === -1) {
    return result;
  }

  const block = gatherBlock(lines, idx, line => {
    if (!line) return false;
    const lower = line.toLowerCase();
    if (/(tailored|prepared)\s+for/.test(lower)) return true;
    return isHeaderBlockStop(line);
  }, 8);

  if (!block.length) return result;

  let inline = block[0].replace(/^prepared\s+by[:\s-]*/i, '').trim();
  if (inline) {
    const inlineEmail = inline.match(PARSER_CONFIG.EMAIL_REGEX);
    if (inlineEmail) {
      result.aeEmail = inlineEmail[1];
      inline = inline.replace(PARSER_CONFIG.EMAIL_REGEX, '').trim();
    }
    if (inline && inline.indexOf('@') === -1) {
      result.aeName = inline;
    }
  }

  for (let i = 1; i < block.length; i++) {
    let line = block[i];
    if (!line) continue;
    if (!result.aeEmail) {
      const email = line.match(PARSER_CONFIG.EMAIL_REGEX);
      if (email) {
        result.aeEmail = email[1];
        line = line.replace(PARSER_CONFIG.EMAIL_REGEX, '').trim();
      }
    }
    if (!result.aeName) {
      let nameCandidate = line.indexOf('@') === -1 ? line : '';
      if (!nameCandidate) {
        nameCandidate = line.replace(PARSER_CONFIG.EMAIL_REGEX, '').trim();
      }
      if (nameCandidate && nameCandidate.indexOf('@') === -1) {
        result.aeName = nameCandidate.trim();
      }
    }
  }

  return result;
}

// ============================================================================
// PRICING EXTRACTION
// ============================================================================

function findCurrencyAfterLabel(lines, labelRegex) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = line.match(labelRegex);
    if (!match) continue;

    // Try to find currency on the same line after the label
    let remainder = line.slice(match.index + match[0].length).trim();
    remainder = remainder.replace(/^[:\s-]+/, '').trim();
    let value = parseFirstCurrency(remainder);
    if (value !== null) {
      return value;
    }

    // Try next 5 lines
    for (let look = 1; look <= 5; look++) {
      const nextIdx = i + look;
      if (nextIdx >= lines.length) break;
      const candidate = lines[nextIdx];
      if (!candidate) continue;
      if (/^[a-z]+\s+(?:cost|price|total|investment)/i.test(candidate) && !/\$/.test(candidate)) break;
      if (/\b(road|street|avenue|blvd|boulevard|drive|lane|way|court|circle|houston|tx|texas|us)\b/i.test(candidate)) continue;
      if (/^\d+\s+[a-z]/i.test(candidate)) continue;
      const fallback = parseFirstCurrency(candidate);
      if (fallback !== null) {
        return fallback;
      }
    }
  }
  return null;
}

function extractPricing(lines) {
  // Find Investment Summary section
  let summaryIdx = findFirstIndex(lines, line => {
    if (!line) return false;
    if (/^\d+\s+(investment\s+summary|total\s+investment)/i.test(line)) {
      return false;
    }
    if (/investment\s+summary/i.test(line) && !/^\d+\s+investment/i.test(line)) {
      return true;
    }
    if (/total\s+investment/i.test(line.toLowerCase()) && !/^\d+\s+total/i.test(line)) {
      return true;
    }
    return false;
  });

  // Fallback: search entire document
  if (summaryIdx === -1) {
    logDebug('Investment Summary section not found, searching entire document');

    // Try to find "Total investment" line
    let totalLine = null;
    for (let k = 0; k < lines.length; k++) {
      if (/total\s+investment/i.test(lines[k].toLowerCase())) {
        totalLine = lines[k];
        logDebug('Found Total investment line in full document: ' + totalLine);
        break;
      }
    }

    if (totalLine) {
      const allCurrencies = [];
      const currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
      let match;
      while ((match = currencyRegex.exec(totalLine)) !== null) {
        allCurrencies.push(parseFloat(match[1].replace(/,/g, '')));
      }
      logDebug('Extracted ' + allCurrencies.length + ' currency values from Total investment line: ' + allCurrencies.join(', '));
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

  logDebug('Found Investment Summary at line ' + summaryIdx + ': ' + lines[summaryIdx]);

  // Extract pricing from Investment Summary section
  const summaryLines = [];
  let foundTotalInvestment = false;
  for (let i = summaryIdx; i < lines.length && i < summaryIdx + 30; i++) {
    const line = lines[i];
    if (!line) continue;
    const lower = line.toLowerCase();

    if (/total\s+investment/i.test(lower)) {
      summaryLines.push(line);
      foundTotalInvestment = true;
      continue;
    }

    if (i > summaryIdx + 1 && (
      /^(scope|equipment|routine|covered|timeline|requested|about|innovation|table|documentation|additional|terms)/i.test(lower) ||
      /^page\s+\d+/i.test(lower)
    )) {
      if (!foundTotalInvestment && i < summaryIdx + 15) {
        summaryLines.push(line);
        continue;
      }
      break;
    }
    summaryLines.push(line);
  }

  logDebug('Extracted ' + summaryLines.length + ' lines from Investment Summary section');

  // Try to find "Total investment" line with all three values
  let totalLine = null;
  for (const line of summaryLines) {
    if (/total\s+investment/i.test(line.toLowerCase())) {
      totalLine = line;
      logDebug('Found Total investment line: ' + totalLine);
      break;
    }
  }

  let oneTimeCost = null;
  let initialSvcCost = null;
  let avgMonthlyCost = null;

  if (totalLine) {
    const allCurrencies = [];
    const currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
    let match;
    while ((match = currencyRegex.exec(totalLine)) !== null) {
      allCurrencies.push(parseFloat(match[1].replace(/,/g, '')));
    }
    logDebug('Extracted ' + allCurrencies.length + ' currency values: ' + allCurrencies.join(', '));
    if (allCurrencies.length >= 3) {
      oneTimeCost = allCurrencies[0];
      initialSvcCost = allCurrencies[1];
      avgMonthlyCost = allCurrencies[2];
      logDebug('Using values from Total investment line');
    }
  }

  // Try individual label search if needed
  if (!oneTimeCost || !initialSvcCost || !avgMonthlyCost) {
    // Look for header line with all three labels
    let headerLineIdx = -1;
    for (let h = 0; h < summaryLines.length; h++) {
      const headerLine = summaryLines[h];
      if (/one[-\s]?time\s+cost/i.test(headerLine) &&
          /initial\s+(?:svc|service)\s+cost/i.test(headerLine) &&
          /(?:avg|average)\s+monthly\s+cost/i.test(headerLine)) {
        headerLineIdx = h;
        logDebug('Found header line with all three labels at index ' + h);
        break;
      }
    }

    if (headerLineIdx >= 0) {
      let nextValueIndex = 0;
      for (let v = headerLineIdx + 1; v < summaryLines.length && v <= headerLineIdx + 10; v++) {
        const valueLine = summaryLines[v];
        if (!valueLine) continue;
        if (/\b(road|street|avenue|blvd|boulevard|drive|lane|way|court|circle|houston|tx|texas|us|tayho)\b/i.test(valueLine)) continue;
        if (/^\d+\s+[a-z]/i.test(valueLine)) continue;
        if (/^[A-Z][a-z]+,\s*\d+/i.test(valueLine) && !/\$/.test(valueLine)) continue;

        const currencies = [];
        const currencyRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
        let match;
        while ((match = currencyRegex.exec(valueLine)) !== null) {
          currencies.push(parseFloat(match[1].replace(/,/g, '')));
        }

        if (currencies.length >= 3) {
          if (!oneTimeCost) oneTimeCost = currencies[0];
          if (!initialSvcCost) initialSvcCost = currencies[1];
          if (!avgMonthlyCost) avgMonthlyCost = currencies[2];
          logDebug('Extracted all three values from line ' + v + ': ' + currencies.join(', '));
          break;
        } else if (currencies.length === 1) {
          if (nextValueIndex === 0 && !oneTimeCost) {
            oneTimeCost = currencies[0];
            nextValueIndex = 1;
            logDebug('Extracted oneTimeCost from line ' + v + ': ' + oneTimeCost);
          } else if (nextValueIndex === 1 && !initialSvcCost) {
            initialSvcCost = currencies[0];
            nextValueIndex = 2;
            logDebug('Extracted initialSvcCost from line ' + v + ': ' + initialSvcCost);
          } else if (nextValueIndex === 2 && !avgMonthlyCost) {
            avgMonthlyCost = currencies[0];
            logDebug('Extracted avgMonthlyCost from line ' + v + ': ' + avgMonthlyCost);
            break;
          } else if (nextValueIndex === 0 && oneTimeCost) {
            nextValueIndex = 1;
          } else if (nextValueIndex === 1 && initialSvcCost) {
            nextValueIndex = 2;
          }
        } else if (currencies.length === 2) {
          if (!oneTimeCost && !initialSvcCost) {
            oneTimeCost = currencies[0];
            initialSvcCost = currencies[1];
            logDebug('Extracted oneTimeCost and initialSvcCost from line ' + v);
          } else if (!initialSvcCost && !avgMonthlyCost) {
            initialSvcCost = currencies[0];
            avgMonthlyCost = currencies[1];
            logDebug('Extracted initialSvcCost and avgMonthlyCost from line ' + v);
            break;
          }
        }

        if (oneTimeCost && initialSvcCost && avgMonthlyCost) break;
      }
    }
  }

  // Final fallback to individual label search
  if (!oneTimeCost) {
    oneTimeCost = findCurrencyAfterLabel(summaryLines, /one[-\s]?time\s+cost/i);
  }
  if (!initialSvcCost) {
    initialSvcCost = findCurrencyAfterLabel(summaryLines, /initial\s+(?:svc|service)\s+cost/i);
  }
  if (!avgMonthlyCost) {
    avgMonthlyCost = findCurrencyAfterLabel(summaryLines, /(?:avg|average)\s+monthly\s+cost/i);
  }

  logDebug('Final values - oneTimeCost: ' + oneTimeCost + ', initialSvcCost: ' + initialSvcCost + ', avgMonthlyCost: ' + avgMonthlyCost);

  return {
    oneTimeCost: oneTimeCost,
    initialSvcCost: initialSvcCost,
    avgMonthlyCost: avgMonthlyCost
  };
}

// ============================================================================
// DATE EXTRACTION
// ============================================================================

function parseDateLine(line) {
  if (!line) return null;

  // MM/DD/YYYY format
  const slashMatch = line.match(/([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})/);
  if (slashMatch) {
    const month = slashMatch[1];
    const day = slashMatch[2];
    const year = slashMatch[3];
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  // "January 15, 2025" format
  const textMatch = line.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-9]{1,2})(?:,?\s+([0-9]{4}))?/i);
  if (textMatch) {
    const monthIndex = PARSER_CONFIG.MONTH_NAMES.indexOf(
      textMatch[1].charAt(0).toUpperCase() + textMatch[1].slice(1).toLowerCase()
    );
    if (monthIndex !== -1) {
      const dayText = textMatch[2];
      const yearText = textMatch[3] || new Date().getFullYear();
      return yearText + '-' + pad2(monthIndex + 1) + '-' + pad2(dayText);
    }
  }

  return null;
}

function monthNameFromIso(iso) {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex >= 0 && monthIndex < PARSER_CONFIG.MONTH_NAMES.length) {
    return PARSER_CONFIG.MONTH_NAMES[monthIndex];
  }
  return null;
}

function normalizeMonthName(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  for (const monthName of PARSER_CONFIG.MONTH_NAMES) {
    if (lower.indexOf(monthName.toLowerCase()) !== -1) {
      return monthName;
    }
  }
  return null;
}

function extractRequestedStart(lines) {
  const result = { requestedStartDate: null, startMonth: null };
  const idx = findFirstIndex(lines, line => /requested\s+start\s+date/i.test(line));
  if (idx === -1) {
    return result;
  }

  for (let i = idx; i <= idx + 3 && i < lines.length; i++) {
    const parsed = parseDateLine(lines[i]);
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
    const monthCandidate = normalizeMonthName(lines[idx + 1]);
    if (monthCandidate) {
      result.startMonth = monthCandidate;
    }
  }

  return result;
}

// ============================================================================
// SERVICES EXTRACTION
// ============================================================================

function createServiceSignals() {
  return {
    hasGpc: false,
    hasRodent: false,
    hasIlt: false
  };
}

function createService(name, code, category, programType, freqLabel, perYear) {
  const frequencyLabel = freqLabel ? toTitleCase(freqLabel) : null;
  let servicesPerYear = perYear || inferServicesPerYear(frequencyLabel);
  if (!servicesPerYear && frequencyLabel) {
    servicesPerYear = inferServicesPerYear(frequencyLabel);
  }
  if (!servicesPerYear && frequencyLabel && frequencyLabel.toLowerCase().indexOf('semi-monthly') !== -1) {
    servicesPerYear = 24;
  }
  if (!servicesPerYear && frequencyLabel && frequencyLabel.toLowerCase().indexOf('monthly') !== -1) {
    servicesPerYear = 12;
  }
  const normalizedFrequency = frequencyLabel || (servicesPerYear ? frequencyFromPerYear(servicesPerYear) : null);
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
  const order = {
    'GPC': 0,
    'MRT': 1,
    'RBS': 2,
    'RODENT': 3,
    'ILT': 4
  };
  return order.hasOwnProperty(code) ? order[code] : 10;
}

function extractFrequencyLabel(text) {
  if (!text) return null;
  const value = text.split('(')[0].replace(/[-–]+/g, ' ').trim();
  if (!value) return null;
  return toTitleCase(value);
}

function extractServicesPerYear(text, freqLabel) {
  if (!text) return null;
  const perYearMatch = text.match(/\((\d+)\s*x\)/i);
  if (perYearMatch) {
    return parseInt(perYearMatch[1], 10);
  }
  return inferServicesPerYear(freqLabel);
}

function inferServicesPerYear(label) {
  if (!label) return null;
  const lower = label.toLowerCase();
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

function buildFallbackServicesFromEquipment(equipment) {
  const signals = createServiceSignals();
  const services = [];
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

function extractRoutineServices(lines, equipment) {
  const idx = findFirstIndex(lines, line => /routine\s+management\s+services/i.test(line));
  if (idx === -1) {
    return buildFallbackServicesFromEquipment(equipment);
  }

  const endIdx = findFirstIndexFrom(lines, idx + 1, line => {
    if (!line) return false;
    const lower = line.toLowerCase();
    for (const terminator of PARSER_CONFIG.ROUTINE_SECTION_TERMINATORS) {
      if (lower.indexOf(terminator) === 0) {
        return true;
      }
    }
    return false;
  });
  const finalEndIdx = endIdx === -1 ? lines.length : endIdx;

  const block = lines.slice(idx + 1, finalEndIdx);
  const signals = createServiceSignals();
  const serviceTemplates = [
    { code: 'GPC', keywords: ['general pest'], serviceName: 'General Pest Control', category: 'GPC', programType: 'General Pest Control', defaultFreq: 'Monthly', defaultPerYear: 12, signal: 'hasGpc' },
    { code: 'MRT', keywords: ['interior monitoring'], serviceName: 'Interior Rodent Monitoring', category: 'Rodent Monitoring', programType: 'Interior Monitoring', defaultFreq: 'Semi-Monthly', defaultPerYear: 24, signal: 'hasRodent' },
    { code: 'RBS', keywords: ['exterior monitoring'], serviceName: 'Exterior Rodent Monitoring', category: 'Rodent Monitoring', programType: 'Exterior Monitoring', defaultFreq: 'Monthly', defaultPerYear: 12, signal: 'hasRodent' },
    { code: 'ILT', keywords: ['insect light trap', 'ilt maintenance', 'light trap maintenance'], serviceName: 'Insect Light Trap Maintenance', category: 'Fly / ILT', programType: 'Insect Light Trap Maintenance', defaultFreq: 'Semi-Monthly', defaultPerYear: 24, signal: 'hasIlt' }
  ];

  const servicesByCode = {};
  let currentCode = null;

  function ensureService(template) {
    if (!servicesByCode[template.code]) {
      servicesByCode[template.code] = createService(template.serviceName, template.code, template.category, template.programType, template.defaultFreq, template.defaultPerYear);
    }
    if (template.signal === 'hasGpc') signals.hasGpc = true;
    if (template.signal === 'hasRodent') signals.hasRodent = true;
    if (template.signal === 'hasIlt') signals.hasIlt = true;
  }

  let iltSemi = false;

  block.forEach(line => {
    if (!line) return;
    const lower = line.toLowerCase();
    if (/insect\s+light|ilt/.test(lower) && /semi/.test(lower)) iltSemi = true;

    for (const template of serviceTemplates) {
      const matched = template.keywords.some(keyword => lower.indexOf(keyword) !== -1);
      if (matched) {
        ensureService(template);
        currentCode = template.code;
        return;
      }
    }

    if (/service\s+frequency/i.test(lower) && currentCode && servicesByCode[currentCode]) {
      const freqLabel = extractFrequencyLabel(line);
      const perYear = extractServicesPerYear(line, freqLabel);
      if (freqLabel) servicesByCode[currentCode].frequencyLabel = freqLabel;
      if (perYear) servicesByCode[currentCode].servicesPerYear = perYear;
      return;
    }
  });

  let services = Object.keys(servicesByCode).map(code => servicesByCode[code]);

  if (iltSemi) {
    services.forEach(svc => {
      if (svc.serviceCode === 'ILT') {
        svc.frequencyLabel = 'Semi-Monthly';
        svc.servicesPerYear = 24;
      }
    });
  }

  if (!services.length) {
    return buildFallbackServicesFromEquipment(equipment);
  }

  if (!services.some(service => service.serviceCode === 'GPC')) {
    const gpcTemplate = serviceTemplates[0];
    ensureService(gpcTemplate);
    services.push(servicesByCode[gpcTemplate.code]);
  }

  services.sort((a, b) => serviceOrder(a.serviceCode) - serviceOrder(b.serviceCode));

  return { services: services, signals: signals };
}

// ============================================================================
// COVERED PESTS EXTRACTION
// ============================================================================

function extractCoveredPestsSection(lines) {
  const idx = findFirstIndex(lines, line => /^covered\s+pests/i.test(line));
  if (idx === -1) {
    return [];
  }

  const pests = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    if (/^service\s+\d+/i.test(line)) break;
    if (isHeaderBlockStop(line)) break;
    const normalized = line.replace(/^[•\-\*\u2022]+\s*/g, '').trim();
    if (!normalized) continue;
    const parts = splitCommaSafe(normalized);
    parts.forEach(part => {
      const cleaned = part.replace(/\s+/g, ' ').trim();
      if (cleaned) pests.push(cleaned);
    });
  }
  return dedupeList(pests);
}

function deriveCoveredPests(explicitList, signals, equipment) {
  const seen = {};
  const result = [];
  explicitList.forEach(item => {
    const key = (item || '').toLowerCase();
    if (item && !seen[key]) {
      seen[key] = true;
      result.push(item);
    }
  });

  function add(value) {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(value);
  }

  const hasRodentSignal = signals.hasRodent || (equipment && (equipment.rbsQty > 0 || equipment.multCatchQty > 0));
  const hasIltSignal = signals.hasIlt || (equipment && equipment.iltQty > 0);

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

// ============================================================================
// DESCRIPTION BUILDERS
// ============================================================================

function buildInitialDescription(equipment, initialCost) {
  const parts = [];
  if (equipment.multCatchQty > 0) parts.push(equipment.multCatchQty + " MRT");
  if (equipment.rbsQty > 0) parts.push(equipment.rbsQty + " RBS");
  if (equipment.iltQty > 0) parts.push(equipment.iltQty + " ILT");
  if (!parts.length && initialCost > 0) return "Initial service";
  if (!parts.length) return "Standard Initial Setup";
  const equipmentList = parts.length > 1 ? parts.slice(0, -1).join(", ") + ", & " + parts.slice(-1) : parts[0];
  return "Initial service and install " + equipmentList;
}

function buildMaintenanceDescription(services) {
  if (!services || services.length === 0) return "Monthly GPC";

  let hasAfterHours = false;
  const normalized = services.map(svc => {
    const rawName = (svc.serviceName || svc.programType || "").toLowerCase();
    if (/after\s+hours.*yes/i.test(rawName) || svc.afterHours) hasAfterHours = true;
    const code = (svc.serviceCode || '').toUpperCase();
    const label = (function(){
      if (code === 'GPC') return 'GPC';
      if (code === 'RBS') return 'Exterior Rodent Monitoring';
      if (code === 'MRT') return 'Interior Rodent Monitoring';
      if (code === 'ILT') return 'ILT Maintenance';
      const name = svc.serviceName || svc.programType || "Service";
      return name.replace(/maintenance/i, '').trim() || 'Service';
    })();
    let freq = svc.frequencyLabel || null;
    if (!freq && svc.servicesPerYear) {
      freq = svc.servicesPerYear >= 24 ? 'Semi-Monthly' : svc.servicesPerYear >= 12 ? 'Monthly' : null;
    }
    if (code === 'ILT' && svc.servicesPerYear >= 24) freq = 'Semi-Monthly';
    if (!freq) freq = 'Monthly';
    return { code: code, label: label, text: freq + " " + label };
  }).filter(entry => ['GPC','RBS','MRT','ILT'].indexOf(entry.code) !== -1);

  const order = { 'GPC':0,'RBS':1,'MRT':2,'ILT':3 };
  normalized.sort((a,b) => {
    const ao = order.hasOwnProperty(a.code) ? order[a.code] : 9;
    const bo = order.hasOwnProperty(b.code) ? order[b.code] : 9;
    if (ao === bo) return a.text.localeCompare(b.text);
    return ao - bo;
  });

  const dedup = [];
  normalized.forEach(entry => {
    if (!dedup.some(d => d.code === entry.code && d.label === entry.label)) dedup.push(entry);
  });

  const joined = dedup.length > 1 ? dedup.slice(0,-1).map(e => e.text).join(", ") + " & " + dedup.slice(-1)[0].text : dedup[0].text;
  if (hasAfterHours) return joined + " (Includes After Hours Service)";
  return joined;
}

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse Salesforce quote text into StartPacketDraft
 * @param {string} text - Raw text extracted from PDF
 * @returns {Object} StartPacketDraft payload
 */
function parseSalesforceQuoteTextToStartPacketDraft(text) {
  if (!text) {
    throw new Error('No PDF text provided for parsing.');
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  const trimmedLines = rawLines.map(line => (line || '').trim()).filter(line => line.length > 0);
  const lines = expandLines(trimmedLines);

  if (!lines.length) {
    throw new Error('Unable to parse PDF text (no content).');
  }

  const header = extractPreparedForFields(lines);
  const preparedBy = extractPreparedBySection(lines);
  const equipmentInfo = extractEquipmentSection(lines);
  const pricing = extractPricing(lines);
  const schedule = extractRequestedStart(lines);
  const routine = extractRoutineServices(lines, equipmentInfo.equipment);
  const explicitPests = extractCoveredPestsSection(lines);
  const derivedPests = deriveCoveredPests(explicitPests, routine.signals, equipmentInfo.equipment);

  const oneTimeCost = pricing.oneTimeCost !== null ? pricing.oneTimeCost : equipmentInfo.totalCost;
  const initialSvcCost = pricing.initialSvcCost;
  const monthlyCost = pricing.avgMonthlyCost;
  const annualCost = monthlyCost !== null ? roundCurrency(monthlyCost * 12) : null;

  // Calculate combined initial (One-Time + Initial Svc Cost)
  let combinedInitial = null;
  if (oneTimeCost !== null || initialSvcCost !== null) {
    const oneTime = oneTimeCost !== null ? oneTimeCost : 0;
    const initial = initialSvcCost !== null ? initialSvcCost : 0;
    combinedInitial = roundCurrency(oneTime + initial);
  }
  const combinedMonthly = monthlyCost !== null ? monthlyCost : null;
  const combinedAnnual = annualCost !== null ? annualCost : null;

  const equipmentSummary = buildEquipmentSignature(equipmentInfo.equipment);
  equipmentInfo.equipment.summary = equipmentSummary;

  const jobType = monthlyCost !== null && monthlyCost > 0 ? 'Contract' : null;

  // Generate auto-descriptions
  const autoInitialDesc = buildInitialDescription(equipmentInfo.equipment, initialSvcCost);
  const autoMaintenanceDesc = buildMaintenanceDescription(routine.services);

  const draft = {
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

  logDebug('Parsed draft: ' + JSON.stringify(draft, null, 2));
  return draft;
}

// ============================================================================
// EXPORTS (for Node.js/module environments)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseSalesforceQuoteTextToStartPacketDraft,
    PARSER_CONFIG
  };
}

// For browser environments, attach to window
if (typeof window !== 'undefined') {
  window.SalesforceParser = {
    parseSalesforceQuoteTextToStartPacketDraft,
    PARSER_CONFIG
  };
}
