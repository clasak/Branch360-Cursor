# Deploying Branch360 Territory Manager to Google Apps Script

The Express server mirrors logic that can run inside Google Apps Script (GAS) so the exact same UI works after it is served with HtmlService and `google.script.run` calls.

## 1. Map Express Routes to Apps Script Functions
| Express Route | Apps Script Equivalent | Notes |
| ------------- | ---------------------- | ----- |
| `GET /api/environment` | `function getEnvironment()` | Returns `{ environment }` stored in `PropertiesService`.
| `POST /api/environment/switch` | `function switchEnvironment(target)` | Toggles value, rewrites existing assignments, enforces TEST vs PROD flags.
| `GET /api/territories` | `function getTerritories()` | Returns `{ stats, territories }` from cached data.
| `POST /api/territories/bulk` | `function bulkUpload(csv)` | Parses CSV text, supports comment lines, updates the store.
| `POST /api/territories/add` | `function addZip(payload)` | Single zip insert/update.
| `POST /api/territories/remove` | `function removeZip(zip)` | Deletes entry.
| `GET /api/territories/search` | `function searchZip(zip)` | Looks up a single record.
| `GET /api/territories/export` | `function exportCsv()` | Streams CSV text to the browser.
| `POST /api/test/sample` | `function loadSamples()` | Restricted to TEST mode.
| `POST /api/test/clear` | `function clearTestData()` | Restricted to TEST mode.

Implementation tips:
- Persist JSON in `PropertiesService.getScriptProperties()` under keys like `environment` and `territories`.
- Use `Utilities.parseCsv()` to parse uploaded text, then reuse the same validation helpers from Express (copy/paste the logic, only removing CommonJS syntax).
- Replace `fs.writeFileSync` with property writes or a backing Google Sheet if you need auditing.

## 2. Reuse Validation & Formatting Helpers
Create a shared Apps Script file (e.g., `validation.gs`) and copy the helper functions from `server.js`:
- `normalizeZip`
- `sanitizeEmail`
- `formatTerritoryNameForEnv`
- `buildTerritoryGroups`
- `buildStats`

Convert them to GAS syntax (remove `const` requires, use `var` or `const` where supported) and export by simply defining them in the global scope.

## 3. Update the Front-End to Use `google.script.run`
1. Host `public/territory-manager.html` via HtmlService (`return HtmlService.createHtmlOutputFromFile('territory-manager')`).
2. Replace each `fetch('/api/...')` call with `google.script.run.withSuccessHandler(...).withFailureHandler(...).functionName(args)`.
3. For CSV upload, pass the textarea string directly to `google.script.run.bulkUpload(csvText)`.
4. For export, have GAS return the CSV string and construct a Blob client-side: `const blob = Utilities.newBlob(csv, 'text/csv', 'territories-export.csv');` then `google.script.host.createBlobUrl` (or create a hidden iframe form) to trigger download.

## 4. Deployment Steps
1. Create a new Apps Script project and copy the `server.js` logic into `.gs` files (no `require`).
2. Copy `public/index.html` and `public/territory-manager.html` into HtmlService files (`Index`, `TerritoryManager`).
3. Replace `<script>` network calls with `google.script.run` as described above.
4. Test functions with the built-in GAS IDE debugger (e.g., run `getTerritories`).
5. Deploy as a *web app* (`Deploy > Test deployments`) using *Execute as Me* and *Anyone with the link* for the TEST version.
6. After verification, create a *New deployment* for production and flip the default environment to `PRODUCTION` or expose a secure toggle for admins only.

## 5. Recommended Enhancements in GAS
- Use `CacheService` to store the grouped territories for faster dashboard loads.
- Mirror the JSON structure from Express so the UI code stays unchanged besides the transport layer.
- Send notifications via Gmail or Chat Apps Script services when in PRODUCTION mode (replace the placeholder "send notification" comments in Express).

Following this guide keeps the code paths nearly identical, making it easy to maintain a single source of truth while supporting both local development and Apps Script deployment.
