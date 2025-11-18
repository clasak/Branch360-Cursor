# Branch360 Documentation

## Overview

This directory contains comprehensive documentation for the Branch360 CRM system, including user guides, API documentation, and testing information.

## Documentation Files

### User Guides

1. **[AE User Guide](./ae-user-guide.md)**
   - Account Executive user manual
   - Dashboard overview
   - Daily activity submission
   - Pipeline management
   - Lead conversion workflows

2. **[Technician User Guide](./technician-user-guide.md)**
   - Technician dashboard
   - Lead submission process
   - Installation management
   - Issue reporting
   - Job completion

3. **[Operations Manager User Guide](./operations-manager-user-guide.md)**
   - Operations dashboard
   - Team metrics monitoring
   - Specialist assignment
   - Issue resolution
   - Daily metrics logging

4. **[Branch Manager User Guide](./branch-manager-user-guide.md)**
   - Branch dashboard overview
   - Team performance analysis
   - Report generation
   - Alert management
   - Coaching workflows

5. **[Admin Guide](./admin-guide.md)**
   - Database setup
   - User management
   - Territory configuration
   - System maintenance
   - Troubleshooting

### Technical Documentation

6. **[API Documentation](./api-documentation.md)**
   - Complete API reference
   - Function signatures
   - Request/response formats
   - Error handling
   - Code examples

7. **Unified Dashboard & Time Saved (see below)**
   - Entry point: `/dashboard`
   - Persona switching (AE, Tech, Ops, Branch Manager, Market Director)
   - Territory Manager shortcut
   - Time Saved analytics and ActivityLog usage

### Unified Dashboard Highlights

- **Location**: `src/dashboard.html` and supporting `.gs` modules (`dashboard-kpis.gs`, `activity-log.gs`).
- **Views**:
  - Embedded AE, Tech, and Ops dashboards (existing HTML files).
  - New Branch Manager KPI grids (per-AE + per-Ops workload) and branch cards.
  - New Market Director rollups (trend chart, AE summary).
  - Time Saved analytics powered by ActivityLog.
- **Filters**: Branch selector (Houston pilot), date range, demo/live tag.
- **Time Saved Panel**:
  - Aggregates ActivityLog sheet.
  - Shows hours/dollars saved per persona and per user.
  - Weekly chart for the pilot window.
- **ActivityLog**:
  - Sheet defined in `config.gs` (SHEETS.ACTIVITY_LOG).
  - Client helper `activity-client.js` starts/stops timers.
  - Server logging for automated flows (start packet creation, assigning techs, etc.).
  - Functions: `recordActivity`, `getActivityAnalytics`.

### Brand Presets & Logos

- Centralized in `src/code.gs` (`BRAND_PRESETS`).
- Supported brands for the Houston pilot:
  - Presto-X *(default)* – red theme, Presto-X ImageKit logo.
  - BugOut – green theme + BugOut logo.
  - Terminix – green Terminix palette + logo.
  - Rentokil – red theme sharing Presto-X colors.
- Helpers:
  - `getBrandConfig(brandKey)` – returns the preset.
  - `getBrandColors(brandKey)` – returns primary/accent/dark/background colors.
  - `getBrandLogoUrl(brandKey)` – returns the appropriate ImageKit URL.
- Use cases: start packet templates, dashboard branding, branch settings panels.
- The `/dashboard` Settings view now lists every preset with logo preview plus **Save**, **Save & Close**, and **Close** controls. The chosen preset is stored locally so demos remember the brand, and the active colors/palette immediately update the UI + pricing helper formulas for a true “preview before save” flow.

### Route & Prospects View

- Accessible via `/dashboard` → "Route & Prospects" tab.
- Pulls territories from the `Territories` sheet and maps assigned AEs, ZIP counts, and prospect counts.
- Prospects list is driven by `Leads` matching the selected territory ZIP codes; includes quick search filter.
- Pricing Helper card provides manual inputs (sqft, linear feet, acres, excluder units) and now pulls rate cards from the active brand preset. It shows monthly/initial/annual totals plus a line-item breakdown (base, sqft, linear, acreage, excluder) so Cody/Adam can narrate exactly how each quote was derived. Designed to plug in Google Earth/Maps APIs later.
- Includes excluder-unit pricing and a stub “Estimate via Google Earth” action so the pilot audience sees the upcoming integration.
- Heatmap sidebar ranks territories by prospect volume so AEs can prioritize.

### Start Packet Workflow (Ops)

- Ops dashboard now includes a "Start Packets" panel.
- Users can create drafts or submit packets with account details, pricing, POC, etc.
- AEs/Ops can **Import Salesforce Quote PDFs** directly from `/dashboard` → AE tab. The client-side pdf.js extractor converts the PDF to text, the Apps Script parser (`parseSalesforceQuoteTextToStartPacketDraft`) maps it into a `StartPacketDraft`, and the unified entry form is pre-filled (account, pricing, services, and SRA hazard checklist) before clicking **Mark Sold & Generate Start Packet**.
- Clicking **Mark Sold & Generate Start Packet** now persists the unified sale *and* immediately generates a start packet record in the Ops queue (calling `generateStartPacketFromUnifiedSale` behind the scenes). Hazard controls, additional-hazard notes, and SRA reviewer stamps flow into the Ops view so Brad/Ops can see the ready-to-run packet without retyping anything.
- The AE dashboard includes a **Salesforce Quote Tracker** card so every uploaded quote is logged as a proposal; when the AE clicks Mark Sold the tracker automatically moves the row to “Sold,” ensuring leadership can narrate the workflow end-to-end during the demo.
- Backend functions: `getStartPackets`, `saveStartPacket`, `updateStartPacketStatus` (all in `operations-module.gs`).
- Submitting a packet logs `OPS_CREATE_START_PACKET` in ActivityLog so time-saved analytics capture the workflow.
- StartPackets sheet schema now tracks `BranchID` + `Status` for filtering and reporting.
- Ops dashboard buttons expose the auto-generated scope summary and allow a stub HTML/PDF export per packet.

### Salesforce Quote Parser (`src/salesforce-parser.gs`)

- Converts pdf.js output into a clean `StartPacketDraft` by anchoring on the quote’s labeled sections (TAILORED/PREPARED FOR, PREPARED BY, EQUIPMENT, ROUTINE MANAGEMENT SERVICES, Investment Summary, Timeline, Covered Pests).
- Extracted fields: `accountName`, `contactName`, `contactTitle`, `contactEmail`, address lines (street/city/state/zip), `aeName`, `aeEmail`, `branchId`, `services[]`, `equipment`, pricing totals, `requestedStartDate`, `startMonth`, `coveredPests[]`, optional `leadType`/`jobType`.
- The parser intentionally ignores boilerplate/table-of-contents text and will leave any missing fields `null` instead of guessing. Equipment lines are categorized (MRT, RBS, ILT, other), RMS tables feed each service’s pricing/frequency, and Covered Pests are split while respecting parentheses (so “Cockroaches (German, American …)” remains a single entry).
- Every successful parse logs `Logger.log(JSON.stringify(draft, null, 2))` so Apps Script executions can be validated quickly.

### Backend Contracts (AE dashboard ↔ Apps Script)

- `getAEDashboard(userId)` → `{ user, todayMetrics, monthMetrics, pipeline, newLeads, upcomingTasks, recentActivity }`
  - `user`: `{ name, email, branchID, userID }`
  - `todayMetrics`: `{ proposalsDelivered, lobsOnProposals, lobsSold, dollarsSold, dollarsProposed, nextDayConfCount, eventsCount, eventsSummary }`
  - `monthMetrics`: `{ totalTAP, winRate, totalSales, totalAppointments }`
  - `pipeline.stages`: `{ proposal: [], negotiation: [], sold: [] }` where each row has `{ name, value }`
- `getUnifiedSales({ branchId })` → array of unified sale records used for the AE pipeline widgets (fields consumed: `RecordID`, `BranchID`, `AccountName`, `ServiceAddress`, `ServiceName`, `CoveredPests`, `SalesRepIDs`, `Status`, `InitialPrice`, `MaintenancePrice`, `Frequency`, `ServiceMonths`, `SpecialNotes`, `sraHazards`).
- `getMyTimeSavedSummary({ startDate, endDate })` → `{ user: { hoursSaved, activities } }` where hoursSaved aggregates ActivityLog baselines for AE actions (Mark Contacted, Convert Lead, Create Quote, Import Salesforce PDF, etc.).
- `saveDailySalesActivity(payload)` expects `{ proposalsDelivered, lobsOnProposals, lobsSold, dollarsSold, dollarsProposed, nextDayConfCount, eventsCount, eventsSummary }` plus derived values (`tapGoal`, `tapActual`, etc.) supplied by `buildDailyActivityPayload`.
- `saveUnifiedSale(payload)` receives the unified modal payload (`accountName`, `serviceAddress`, `soldDate`, `requestedStartMonth`, `pocName`, `pocPhone`, `pocEmail`, `initialPrice`, `maintenancePrice`, `serviceName`, `serviceType`, `coveredPests`, `leadType`, `jobType`, `frequency`, `serviceMonths[]`, `salesRepIDs[]`, `branchID`, `logBookNeeded`, `tapLeadFlag`, `pnolRequired`, `sraCompletedBy`, `sraDate`, `sraTime`, `sraAdditionalHazards`, `specialNotes`, `sraHazards`, `status`, `quoteTrackerId`). The backend should persist the unified sale, mirror `serviceMonths` + `SRA hazards` into their sheets, and return `{ success, recordID }`.
- `parseSalesforceQuoteTextToStartPacketDraft(text)` must return the StartPacketDraft structure described above so `applyStartPacketDraft()` can prefill the modal without additional transforms.

### Golden Parse Reference – Tayho Quote (Quote_00057472_11172025.pdf)

```json
{
  "accountName": "Tayho",
  "contactName": "Lee Morrison",
  "contactTitle": "GM",
  "contactEmail": "lee.morrison@tayho.com",
  "serviceAddressLine1": "17213 Aldine Westfield Road",
  "serviceCity": "Houston",
  "serviceState": "TX",
  "serviceZip": "77073",
  "aeName": "Cody Lytle",
  "aeEmail": "cody.lytle@prestox.com",
  "branchId": "BRN-001",
  "requestedStartDate": "2025-11-19",
  "startMonth": "November",
  "services": [
    {
      "serviceName": "GENERAL PEST CONTROL - CORE SERVICES",
      "programType": "GENERAL PEST CONTROL MAINTENANCE",
      "category": "GPC (Comm)",
      "descriptionText": "Initial and ongoing general pest control program for interior and exterior areas of the facility, using an IPM approach with inspections, monitoring, targeted applications and documentation per the attached plan.",
      "initialAmount": 629.62,
      "pricePerService": 314.80,
      "frequencyLabel": "Monthly",
      "servicesPerYear": 12,
      "afterHours": false
    },
    {
      "serviceName": "FLY",
      "programType": "INSECT LIGHT TRAP MAINTENANCE",
      "category": "Fly / ILT",
      "descriptionText": "Semi-monthly service of insect light traps (ILTs), including inspection, cleaning, glueboard replacement and bulb/LED maintenance in kitchen and back-of-house areas per the attached plan.",
      "initialAmount": 294.72,
      "pricePerService": 41.36,
      "frequencyLabel": "Semi-Monthly",
      "servicesPerYear": 24,
      "afterHours": false
    }
  ],
  "equipment": {
    "multCatchQty": 22,
    "rbsQty": 14,
    "iltQty": 4,
    "otherEquipment": []
  },
  "equipmentOneTimeTotal": 3455.60,
  "servicesInitialTotal": 924.34,
  "servicesMonthlyTotal": 356.16,
  "combinedInitialTotal": 4379.94,
  "combinedMonthlyTotal": 397.52,
  "coveredPests": [
    "Roof Rats",
    "Norway Rats",
    "House Mice",
    "Cockroaches (German, American, Oriental, Brown-Banded, Wood, Smokeybrown)",
    "Ants (Pavement, Odorous House, Argentine, Field, Larger Yellow)",
    "Ground Beetles",
    "Silverfish",
    "Earwigs",
    "Centipedes",
    "Millipedes",
    "House Crickets",
    "Spiders (excluding Brown Recluse and Black Widow)"
  ],
  "leadType": null,
  "jobType": null
}
```

Use this Tayho output as the regression baseline: any Rentokil/Presto-X Salesforce quote that follows the same template should map to a similar structure (correct account, contact, equipment totals, RMS pricing, investment summary, and pest list).

### Unified Sales & Ops Schema

- New master tables in `config.gs`:
  - `Unified_Sales`: single entry point for AE data (customer, contract, SRA details).
  - `Service_Months` & `SRA_Hazards`: child tables for recurring schedules and hazard assessments.
  - `Ops_Pipeline`: Operations manager updates (claimed assignment, start date, materials, install progress).
- Helper module `src/unified-sales.gs` exposes:
  - `saveUnifiedSale()` – AE creates/edits the master record once.
  - `getUnifiedSales()` – used by AE dashboard, Ops queue, and reporting.
  - `saveOpsWorkflow()` – Ops managers update the same record (claim, assign, confirm start date).
  - `getOpsQueue()` / `calculateBranchDailyMetrics()` – drive Ops grid + automated manager KPIs.
- These tables feed every persona view:
  - AE dashboards pull their own records automatically (replaces personal trackers) and include a **New Start Entry** modal that writes straight to `saveUnifiedSale()` while instrumenting ActivityLog.
  - Ops Manager dashboard now renders the unified **Ops Queue** (via `getOpsQueue()`), so claiming starts, marking materials ordered, or toggling install status feeds both time-saved analytics and the Branch/Mkt KPIs.
  - "Generate Start Packet" uses the stored fields to render PDF stubs.
  - Daily cadence metrics & leadership cards derive from the unified rows instead of manual entry.

### AE Activity Logging

- AE lead actions now participate in ActivityLog automatically.
- `ae-leads-widget.html` wraps **Mark Contacted** and **Convert Lead** buttons with `ActivityClient.start/finish` so each workflow logs duration, context, and time saved.
- Baseline savings for AEs (`AE_MARK_CONTACTED`, `AE_CONVERT_LEAD`, `AE_CREATE_QUOTE`) are defined in `ACTIVITY_BASELINES`.
- `getMyTimeSavedSummary()` feeds the "My Time Saved" card on the AE dashboard so reps see their own ROI for the selected period.

### 90-Day Pilot Report

- New tab inside `/dashboard` ("90-Day Pilot Report").
- Filters: pilot start/end (defaults to last 90 days) + role filter.
- Metrics included:
  - Total / AE / Ops & Tech hours saved
  - Total dollar value + Approx. FTE equivalent
  - Executive summary paragraph auto-generated from the analytics
  - Per-user breakdown table (sortable by hours or dollars saved)
  - Weekly trend chart for hours saved
- Powered entirely by `getActivityAnalytics`, so any logged action (AE, Ops, Tech, etc.) shows up automatically.
- Empty-state messaging ensures leadership sees “No activity logged yet” instead of errors if the pilot has just begun.

### Ops Timeline & Sales → Ops Handoff Queue

- Ops timeline (Branch Manager tab) summarizes the latest lifecycle events per start packet.
- Sales → Ops Handoff tab lists sold opportunities lacking submitted packets so leadership can unblock the queue.

## Testing

### Test Suite

The test suite is located in `src/tests.gs` and includes:

- **testDatabaseSetup()**: Verifies all required sheets exist
- **testLeadRouting()**: Tests lead routing functionality
- **testSalesModule()**: Tests sales module functions
- **testOperationsModule()**: Tests operations module
- **testReporting()**: Tests reporting and CSV export
- **testBranchManagerModule()**: Tests branch manager functions

### Running Tests

```javascript
// Run all tests
runAllTests();

// Run individual test
testDatabaseSetup();
```

### Test Results

Tests output to the Logger. View results in Apps Script editor:
- View > Logs

## Success Criteria Checklist

- [x] All critical paths tested
- [x] User guides complete for each role
- [x] API documentation published
- [x] Test suite runs without errors

## Converting to Google Docs

These markdown files can be easily converted to Google Docs:

1. Open Google Docs
2. File > Import
3. Upload the markdown file
4. Google Docs will convert the formatting automatically

Alternatively, use a markdown-to-Google Docs converter tool.

## File Structure

```
Branch360/
├── src/
│   ├── tests.gs                    # Test suite
│   └── ... (other source files)
└── docs/
    ├── README.md                   # This file
    ├── ae-user-guide.md
    ├── technician-user-guide.md
    ├── operations-manager-user-guide.md
    ├── branch-manager-user-guide.md
    ├── admin-guide.md
    └── api-documentation.md
```

## Quick Links

- [Test Suite](../src/tests.gs)
- [Configuration](../src/config.gs)
- [Sales Module](../src/sales-module.gs)
- [Lead Routing](../src/lead-routing.gs)
- [Operations Module](../src/operations-module.gs)

## Support

For questions or issues:
1. Review the relevant user guide
2. Check the API documentation
3. Review test results
4. Contact system administrator

---

**Last Updated:** 2024
**Version:** 1.0
