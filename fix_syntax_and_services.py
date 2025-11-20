
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
      );"""

replace_block('src/ae-dashboard.html', 2707, 2754, new_code)

