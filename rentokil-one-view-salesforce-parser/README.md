# Salesforce Quote Parser for Rentokil One View

Complete standalone implementation of the Salesforce quote PDF parser.

## 📦 Files Included

1. **salesforce-parser.js** - Core parser logic (standalone, no dependencies)
2. **pdf-extractor.js** - PDF.js integration for text extraction
3. **integration-example.html** - Complete working example with UI
4. **README.md** - This file

## 🚀 Quick Start

### Option 1: Use the Demo Page

Open `integration-example.html` in your browser. It includes everything you need:
- PDF.js library loaded from CDN
- File upload interface
- Live parsing demonstration
- Results display with formatted output

### Option 2: Integrate Into Your Dashboard

#### Step 1: Add PDF.js to your HTML

```html
<!-- Add before your closing </head> tag -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
</script>
```

#### Step 2: Include the Parser Scripts

```html
<!-- Add before your closing </body> tag -->
<script src="pdf-extractor.js"></script>
<script src="salesforce-parser.js"></script>
```

#### Step 3: Add File Upload Input

```html
<input type="file"
       id="salesforceQuoteFile"
       accept="application/pdf"
       onchange="handleFileSelect(event)">
<button onclick="processSalesforceQuote()">Parse Quote</button>
```

#### Step 4: Implement Upload Handler

```javascript
let selectedFile = null;

function handleFileSelect(event) {
  selectedFile = event.target.files[0];
}

async function processSalesforceQuote() {
  if (!selectedFile) {
    alert('Please select a PDF file');
    return;
  }

  try {
    // Extract text from PDF
    const text = await extractTextFromPdfFile(selectedFile);

    // Parse the text
    const draft = parseSalesforceQuoteTextToStartPacketDraft(text);

    // Use the parsed data
    console.log('Parsed quote:', draft);

    // Example: populate form fields
    document.getElementById('accountName').value = draft.accountName || '';
    document.getElementById('contactEmail').value = draft.contactEmail || '';
    // ... populate other fields

  } catch (err) {
    alert('Failed to parse: ' + err.message);
    console.error(err);
  }
}
```

## 📊 Output Structure

The parser returns a `StartPacketDraft` object:

```javascript
{
  // Account & Contact
  accountName: "Tayho",
  contactName: "Lee Morrison",
  contactEmail: "lee.morrison@tayho.com",

  // Service Address
  serviceAddressLine1: "17213 Aldine Westfield Road",
  serviceCity: "Houston",
  serviceState: "TX",
  serviceZip: "77073",

  // Account Executive
  aeName: "Cody Lytle",
  aeEmail: "cody.lytle@prestox.com",

  // Job Info
  branchId: "BRN-001",
  jobType: "Contract", // or null

  // Services Array
  services: [
    {
      serviceName: "General Pest Control",
      serviceCode: "GPC",
      category: "GPC",
      programType: "General Pest Control",
      frequencyLabel: "Monthly",
      servicesPerYear: 12,
      // ... more fields
    }
    // ... more services
  ],

  // Equipment
  equipment: {
    multCatchQty: 22,    // MRT count
    rbsQty: 14,          // RBS count
    iltQty: 4,           // ILT count
    otherEquipment: [],  // Other equipment
    summary: "22 MRT, 14 RBS, 4 ILT"
  },

  // Pricing
  equipmentOneTimeTotal: 3455.60,
  servicesInitialTotal: 924.34,
  combinedInitialTotal: 4379.94,
  servicesMonthlyTotal: 356.16,
  servicesAnnualTotal: 4273.92,

  // Schedule
  requestedStartDate: "2025-11-19",  // ISO format
  startMonth: "November",

  // Covered Pests
  coveredPests: [
    "Pavement Ants",
    "Common Rodents",
    // ... more pests
  ],

  // Auto-Generated Descriptions
  initialServiceDescription: "Initial service and install 22 MRT, 14 RBS, & 4 ILT",
  maintenanceScopeDescription: "Monthly GPC, Monthly Exterior Rodent Monitoring, ...",

  // Additional Fields
  leadType: "Inbound",
  serviceType: null,
  logBookNeeded: true
}
```

## 🎯 What It Parses

From a Salesforce quote PDF, the parser extracts:

- ✅ Account name, contact info (name, email)
- ✅ Service address (street, city, state, zip)
- ✅ Account Executive (AE) name and email
- ✅ Equipment list with quantities (MRT, RBS, ILT, Other)
- ✅ Services with frequencies and pricing
- ✅ Investment summary (one-time, initial service, monthly costs)
- ✅ Requested start date and month
- ✅ Covered pests list
- ✅ Auto-generated service descriptions

## 🔧 Advanced Usage

### Server-Side Parsing (Node.js)

```javascript
const { parseSalesforceQuoteTextToStartPacketDraft } = require('./salesforce-parser.js');

// Assuming you have PDF text from another source
const pdfText = `... extracted text ...`;

const draft = parseSalesforceQuoteTextToStartPacketDraft(pdfText);
console.log(draft);
```

### Error Handling

```javascript
try {
  const draft = parseSalesforceQuoteTextToStartPacketDraft(text);
  // Success - use the data
} catch (err) {
  if (err.message.includes('No PDF text provided')) {
    // Handle empty text
  } else if (err.message.includes('no content')) {
    // Handle parse failure
  } else {
    // Handle other errors
  }
}
```

### Validating Results

```javascript
const draft = parseSalesforceQuoteTextToStartPacketDraft(text);

// Check for required fields
if (!draft.accountName) {
  console.warn('Account name not found');
}

if (!draft.combinedInitialTotal) {
  console.warn('Pricing information incomplete');
}

// Validate equipment
if (draft.equipment.multCatchQty === 0 &&
    draft.equipment.rbsQty === 0 &&
    draft.equipment.iltQty === 0) {
  console.warn('No standard equipment found');
}
```

## 🧪 Testing

Use the included `integration-example.html` to test with your Salesforce quote PDFs:

1. Open `integration-example.html` in a browser
2. Click "Choose PDF File" and select a Salesforce quote
3. Click "Parse Quote"
4. Review the extracted data

### Test with Sample Data

```javascript
const sampleText = `TAILORED FOR:
Tayho
Lee Morrison
lee.morrison@tayho.com
17213 Aldine Westfield Road
Houston, TX 77073

PREPARED BY:
Cody Lytle
cody.lytle@prestox.com

EQUIPMENT:
Multi-Catch Mouse Trap - Presto-X           22
Rodent Bait Station - Eradico                14
Insect Light Trap - Lumnia LED 15 Watt        4

Total Cost of Equipment                $3,455.60

INVESTMENT SUMMARY:
                        One-Time Cost    Initial Svc Cost    Avg Monthly Cost
Total investment         $3,455.60          $924.34            $356.16`;

const draft = parseSalesforceQuoteTextToStartPacketDraft(sampleText);
console.log(draft);
```

## 📝 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🐛 Troubleshooting

### "PDF.js library not loaded"
- Make sure PDF.js is included before `pdf-extractor.js`
- Check that the CDN link is accessible
- Verify the worker script URL is correct

### "No PDF text provided for parsing"
- The PDF extraction failed - check the PDF file is valid
- Try a different PDF reader/generator
- Check browser console for PDF.js errors

### Incorrect or Missing Data
- Some Salesforce quote templates may vary
- Check the parser logs in console for debugging info
- The parser expects specific section headers (e.g., "TAILORED FOR", "EQUIPMENT")

### Equipment Not Categorized Correctly
- The parser uses keyword matching for equipment types
- Check `categorizeEquipment()` function for supported keywords
- Add custom keywords if needed

## 🔄 Customization

### Adding New Equipment Types

Edit `salesforce-parser.js`, function `categorizeEquipment()`:

```javascript
function categorizeEquipment(equipment, name, qty) {
  const lower = name.toLowerCase();

  // Add your custom equipment type
  if (/your-keyword|another-keyword/.test(lower)) {
    equipment.yourCustomType = (equipment.yourCustomType || 0) + qty;
    return;
  }

  // ... existing code
}
```

### Customizing Field Mappings

The parser uses specific section headers. To support different templates, modify:

```javascript
const PARSER_CONFIG = {
  HEADER_BLOCK_TERMINATORS: [
    'prepared by',
    'your-custom-header',  // Add custom terminators
    // ... more
  ],
  // ... other config
};
```

## 📚 Related Files

- **../SALESFORCE_PARSER_IMPLEMENTATION_GUIDE.md** - Complete implementation guide with detailed documentation
- **../src/salesforce-parser.gs** - Original Google Apps Script version
- **../src/salesforce-mapping-config.gs** - Configurable field mappings (advanced)

## 💡 Support

For issues or questions:
1. Check the implementation guide: `../SALESFORCE_PARSER_IMPLEMENTATION_GUIDE.md`
2. Review the example HTML file for working implementation
3. Check browser console for detailed error messages
4. Verify PDF.js is loaded correctly

## 📄 License

This implementation is part of the Branch360-Cursor project.
