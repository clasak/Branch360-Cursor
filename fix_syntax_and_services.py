
import os

def replace_block(file_path, start_line, end_line, new_content):
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    start_idx = start_line - 1
    end_idx = end_line - 1
    
    print(f"Replacing lines {start_line} to {end_line}")
    
    new_lines = lines[:start_idx] + [new_content + '\n'] + lines[end_idx+1:]
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)

new_code = r"""    function extractPricing(lines) {
      // 1. Find Investment Summary (allow slight variations)
      var startIdx = findFirstIndex(lines, l => /investment\s+summary/i.test(l) && !/^\d+/.test(l));
      
      // If no header found, try to find the pricing table directly via column headers
      if (startIdx === -1) {
         // Look for line with "One-Time Cost" and "Avg Monthly Cost"
         startIdx = findFirstIndex(lines, l => /one[-\s]?time\s+cost/i.test(l) && /monthly\s+cost/i.test(l));
         if (startIdx !== -1) startIdx = Math.max(0, startIdx - 2);
      }

      if (startIdx === -1) return { oneTimeCost: null, initialSvcCost: null, avgMonthlyCost: null };

      // 2. Define block scope
      var endIdx = findFirstIndexFrom(lines, startIdx + 1, l => 
         /^(documentation|additional services|terms|page)/i.test(l)
      );
      if (endIdx === -1) endIdx = Math.min(lines.length, startIdx + 25);
      var block = lines.slice(startIdx, endIdx);

      var oneTime = null, initial = null, monthly = null;

      // 3. Strategy A: Find the row with 3 distinct currency values
      for (var i = 0; i < block.length; i++) {
          var line = block[i];
          var matches = line.match(/(?:\$\s*)?([0-9,]+\.[0-9]{2})/g);
          if (matches && matches.length >= 3) {
             var nums = matches.map(v => parseFloat(v.replace(/[$,\s]/g, '')));
             oneTime = nums[0];
             initial = nums[1];
             monthly = nums[2];
             break; 
          }
      }

      // 4. Fallback Strategy B: Keyword search if table parse failed
      if (oneTime === null) oneTime = findCurrencyInBlock(block, /(?:one[-\s]?time|initial)\s+(?:cost|investment)/i);
      if (initial === null) initial = findCurrencyInBlock(block, /(?:initial\s+(?:svc|service)|start[-\s]?up)\s+(?:cost|investment)/i);
      if (monthly === null) monthly = findCurrencyInBlock(block, /(?:avg|average|monthly)\s+(?:monthly\s+)?(?:cost|investment)/i);

      return { oneTimeCost: oneTime, initialSvcCost: initial, avgMonthlyCost: monthly };
    }
    
    function findCurrencyInBlock(blockLines, regex) {
        for (var i = 0; i < blockLines.length; i++) {
            if (regex.test(blockLines[i])) {
                var textToCheck = blockLines[i] + " " + (blockLines[i+1] || "");
                var match = textToCheck.match(/(?:\$\s*)?([0-9,]+\.[0-9]{2})/);
                if (match) return parseFloat(match[1].replace(/,/g, ''));
            }
        }
        return null;
    }

    function extractRoutineServices(lines, equipment) {
      var idx = findFirstIndex(lines, l => /routine\s+management\s+services/i.test(l));
      if (idx === -1) return { services: [], signals: createServiceSignals() };

      var endIdx = findFirstIndexFrom(lines, idx + 1, l =>
        ROUTINE_SECTION_TERMINATORS.some(t => l.toLowerCase().indexOf(t) === 0)
      );
      if (endIdx === -1) endIdx = lines.length;

      var block = lines.slice(idx + 1, endIdx);
      var services = [];
      var signals = createServiceSignals();

      block.forEach(function(line) {
        if (!line) return;

        var parts = [line];
        if (/interior.*monthly.*exterior.*monthly/i.test(line)) {
            var split = line.match(/(.*?monthly)(.*)/i);
            if (split) parts = [split[1], split[2]];
        }

        parts.forEach(function(part) {
            var cleanLine = part.replace(/\$[\d,\.]+/g, "").trim();
            var freqMatch = cleanLine.match(/(.+?)\s+(?:service|svc)?\s*frequency\s*[-:]*\s*([A-Za-z0-9\-\(\)\s]+)/i);

            if (!freqMatch) {
                if (/exterior\s+monitoring/i.test(cleanLine) && /monthly/i.test(cleanLine)) freqMatch = [cleanLine, "Exterior Rodent Monitoring", "Monthly"];
                else if (/interior\s+monitoring/i.test(cleanLine) && /semi/i.test(cleanLine)) freqMatch = [cleanLine, "Interior Rodent Monitoring", "Semi-Monthly"];
                else if (/general\s+pest/i.test(cleanLine) && /monthly/i.test(cleanLine)) freqMatch = [cleanLine, "General Pest Control", "Monthly"];
                else if (/insect\s+light\s+trap\s+maintenance/i.test(cleanLine)) freqMatch = ["Insect Light Trap Maintenance", "Monthly"];
            }

            if (freqMatch) {
                var label = freqMatch[1] ? freqMatch[1].trim() : freqMatch[0];
                var freqLabel = extractFrequencyLabel(freqMatch[2] || freqMatch[1]);
                var service = buildServiceFromLabel(label, freqLabel, null, signals);

                if (service) {
                    if (/after\s+hours\s+service\??\s*(yes|- yes)/i.test(cleanLine)) service.afterHours = true;
                    upsertService(services, service);
                }
            }
        });
      });

      if (!services.some(s => s.serviceCode === 'MRT') && equipment.multCatchQty > 0)
         upsertService(services, createService('Interior Rodent Monitoring', 'MRT', 'Rodent', 'Interior', 'Semi-Monthly', 24));
      if (!services.some(s => s.serviceCode === 'RBS') && equipment.rbsQty > 0)
         upsertService(services, createService('Exterior Rodent Monitoring', 'RBS', 'Rodent', 'Exterior', 'Monthly', 12));
      if (!services.some(s => s.serviceCode === 'ILT') && equipment.iltQty > 0)
         upsertService(services, createService('Insect Light Trap', 'ILT', 'Fly', 'ILT', 'Monthly', 12));
      if (!services.some(s => s.serviceCode === 'GPC'))
         upsertService(services, createService('General Pest Control', 'GPC', 'GPC', 'GPC', 'Monthly', 12));

      services.sort((a, b) => serviceOrder(a.serviceCode) - serviceOrder(b.serviceCode));
      return { services: services, signals: signals };
    }"""

replace_block('src/ae-dashboard.html', 2707, 2754, new_code)

