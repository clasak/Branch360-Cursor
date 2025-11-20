/**
 * Diagnostic utility for debugging Salesforce parser failures
 * Use this to identify which sections are being found/missed in your PDF
 */

function debugSalesforceParser(pdfText) {
  if (!pdfText) {
    return {
      error: 'No PDF text provided',
      instructions: 'Extract text from your Salesforce PDF and pass it to this function'
    };
  }

  var normalized = pdfText.replace(/\r\n/g, '\n');
  var rawLines = normalized.split('\n');
  var trimmedLines = rawLines.map(function(line) {
    return (line || '').trim();
  }).filter(function(line) {
    return line.length > 0;
  });
  var lines = expandLines(trimmedLines);

  var diagnostics = {
    totalLines: lines.length,
    sectionsFound: {},
    sectionLines: {},
    extractedData: {},
    missingFields: [],
    recommendations: []
  };

  // Check for "Tailored For" / "Prepared For" section
  var tailoredIdx = findFirstIndex(lines, function(line) {
    return isTailoredPreparedAnchor(line) || /account\s+name/i.test(line) || /customer\s+name/i.test(line);
  });
  diagnostics.sectionsFound['Tailored For / Prepared For'] = tailoredIdx !== -1;
  if (tailoredIdx !== -1) {
    diagnostics.sectionLines['Tailored For / Prepared For'] = {
      lineNumber: tailoredIdx,
      content: lines.slice(tailoredIdx, Math.min(tailoredIdx + 10, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Tailored For" or "Prepared For" section. Looking for lines that start with these labels.');
  }

  // Check for "Prepared By" section
  var preparedByIdx = findFirstIndex(lines, function(line) {
    return /prepared\s+by[:\s]/i.test(line);
  });
  diagnostics.sectionsFound['Prepared By'] = preparedByIdx !== -1;
  if (preparedByIdx !== -1) {
    diagnostics.sectionLines['Prepared By'] = {
      lineNumber: preparedByIdx,
      content: lines.slice(preparedByIdx, Math.min(preparedByIdx + 5, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Prepared By" section. This should contain the AE name and email.');
  }

  // Check for "Equipment" section
  var equipmentIdx = findFirstIndex(lines, function(line) {
    return /^equipment\b/i.test(line);
  });
  diagnostics.sectionsFound['Equipment'] = equipmentIdx !== -1;
  if (equipmentIdx !== -1) {
    var equipmentEndIdx = findFirstIndexFrom(lines, equipmentIdx + 1, function(line) {
      return /^total\s+cost\s+of\s+equipment/i.test(line);
    });
    diagnostics.sectionLines['Equipment'] = {
      lineNumber: equipmentIdx,
      endLine: equipmentEndIdx,
      content: lines.slice(equipmentIdx, equipmentEndIdx !== -1 ? equipmentEndIdx + 1 : Math.min(equipmentIdx + 15, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Equipment" section. Looking for a line that starts with "Equipment".');
  }

  // Check for "Investment Summary" section
  var investmentIdx = findFirstIndex(lines, function(line) {
    if (!line) return false;
    var lower = line.toLowerCase();
    // Skip table of contents entries
    if (/^\d+\s+(investment\s+summary|total\s+investment)/i.test(line)) {
      return false;
    }
    // Look for Investment Summary or Total investment
    if (/investment\s+summary/i.test(line) && !/^\d+\s+investment/i.test(line)) {
      return true;
    }
    if (/total\s+investment/i.test(lower) && !/^\d+\s+total/i.test(line)) {
      return true;
    }
    return false;
  });
  diagnostics.sectionsFound['Investment Summary'] = investmentIdx !== -1;
  if (investmentIdx !== -1) {
    diagnostics.sectionLines['Investment Summary'] = {
      lineNumber: investmentIdx,
      content: lines.slice(investmentIdx, Math.min(investmentIdx + 30, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Investment Summary" section. This should contain pricing (One-Time Cost, Initial Svc Cost, Avg Monthly Cost).');

    // Try to find "Total investment" line as fallback
    var totalInvestmentIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/total\s+investment/i.test(lines[i].toLowerCase())) {
        totalInvestmentIdx = i;
        break;
      }
    }
    if (totalInvestmentIdx !== -1) {
      diagnostics.recommendations.push('Found "Total investment" line at index ' + totalInvestmentIdx + ': "' + lines[totalInvestmentIdx] + '"');
    }
  }

  // Check for "Routine Management Services" section
  var routineIdx = findFirstIndex(lines, function(line) {
    return /routine\s+management\s+services/i.test(line);
  });
  diagnostics.sectionsFound['Routine Management Services'] = routineIdx !== -1;
  if (routineIdx !== -1) {
    diagnostics.sectionLines['Routine Management Services'] = {
      lineNumber: routineIdx,
      content: lines.slice(routineIdx, Math.min(routineIdx + 20, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Routine Management Services" section. This should list service types and frequencies.');
  }

  // Check for "Requested Start Date" section
  var startDateIdx = findFirstIndex(lines, function(line) {
    return /requested\s+start\s+date/i.test(line);
  });
  diagnostics.sectionsFound['Requested Start Date'] = startDateIdx !== -1;
  if (startDateIdx !== -1) {
    diagnostics.sectionLines['Requested Start Date'] = {
      lineNumber: startDateIdx,
      content: lines.slice(startDateIdx, Math.min(startDateIdx + 4, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Requested Start Date" section.');
  }

  // Check for "Covered Pests" section
  var pestsIdx = findFirstIndex(lines, function(line) {
    return /^covered\s+pests/i.test(line);
  });
  diagnostics.sectionsFound['Covered Pests'] = pestsIdx !== -1;
  if (pestsIdx !== -1) {
    diagnostics.sectionLines['Covered Pests'] = {
      lineNumber: pestsIdx,
      content: lines.slice(pestsIdx, Math.min(pestsIdx + 10, lines.length))
    };
  } else {
    diagnostics.recommendations.push('Cannot find "Covered Pests" section (optional - will be derived from services if missing).');
  }

  // Try to extract data using the actual parser
  try {
    var result = parseSalesforceQuoteTextToStartPacketDraft(pdfText);
    diagnostics.extractedData = result;

    // Check for missing critical fields
    var criticalFields = [
      { field: 'accountName', label: 'Account Name' },
      { field: 'contactName', label: 'Contact Name' },
      { field: 'contactEmail', label: 'Contact Email' },
      { field: 'serviceAddressLine1', label: 'Service Address' },
      { field: 'aeName', label: 'AE Name' },
      { field: 'aeEmail', label: 'AE Email' },
      { field: 'equipmentOneTimeTotal', label: 'Equipment One-Time Cost' },
      { field: 'servicesInitialTotal', label: 'Initial Service Cost' },
      { field: 'servicesMonthlyTotal', label: 'Monthly Cost' },
      { field: 'requestedStartDate', label: 'Requested Start Date' }
    ];

    criticalFields.forEach(function(item) {
      if (!result[item.field] || result[item.field] === null) {
        diagnostics.missingFields.push(item.label + ' (' + item.field + ')');
      }
    });

  } catch (e) {
    diagnostics.extractedData = { error: e.message, stack: e.stack };
    diagnostics.recommendations.push('Parser threw an error: ' + e.message);
  }

  // Summary
  var foundCount = Object.keys(diagnostics.sectionsFound).filter(function(key) {
    return diagnostics.sectionsFound[key];
  }).length;
  var totalSections = Object.keys(diagnostics.sectionsFound).length;

  diagnostics.summary = {
    sectionsFoundCount: foundCount + ' / ' + totalSections,
    missingFieldsCount: diagnostics.missingFields.length,
    status: diagnostics.missingFields.length === 0 ? 'SUCCESS' : 'INCOMPLETE'
  };

  // Add first 50 lines for reference
  diagnostics.firstLines = lines.slice(0, 50);

  Logger.log('=== SALESFORCE PARSER DIAGNOSTICS ===');
  Logger.log(JSON.stringify(diagnostics, null, 2));

  return diagnostics;
}

/**
 * Quick test with sample PDF text
 * Usage:
 * 1. Extract text from your Salesforce PDF
 * 2. Run: testMyPDF()
 * 3. Paste your PDF text when prompted
 */
function testMyPDF() {
  // Replace this with your actual PDF text
  var pdfText = `
    PASTE YOUR SALESFORCE PDF TEXT HERE
  `;

  var diagnostics = debugSalesforceParser(pdfText);

  Logger.log('\n=== SUMMARY ===');
  Logger.log('Sections found: ' + diagnostics.summary.sectionsFoundCount);
  Logger.log('Missing critical fields: ' + diagnostics.missingFieldsCount);
  Logger.log('Status: ' + diagnostics.summary.status);
  Logger.log('\nMissing fields:');
  diagnostics.missingFields.forEach(function(field) {
    Logger.log('  - ' + field);
  });
  Logger.log('\nRecommendations:');
  diagnostics.recommendations.forEach(function(rec) {
    Logger.log('  - ' + rec);
  });

  return diagnostics;
}
