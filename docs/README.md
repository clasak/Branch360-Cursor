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

