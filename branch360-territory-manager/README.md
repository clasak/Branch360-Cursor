# Branch360 Territory Manager

A lightweight Node.js + Express Territory Manager with a modern web UI for Houston AE assignments. It runs locally for rapid iteration and mirrors the routes that will later be ported to Google Apps Script.

## Quick Start (5 steps)
1. `cd branch360-territory-manager` – start in the project directory.
2. `cp .env.example .env` (or edit `.env`) – ensure `PORT=3000` and `NODE_ENV=TEST` for local work.
3. `npm install` – install Express, CORS, body-parser, and dotenv.
4. `npm run dev` – start the watcher (or `npm start` for a single run).
5. Visit `http://localhost:3001/territories` – load sample data via the UI, then upload the Houston CSV.

## Project Structure
```
branch360-territory-manager/
├── server.js                # Express server + API routes + persistence
├── package.json             # Dependencies and scripts
├── .env                     # Environment defaults (TEST/PORT)
├── .gitignore               # Node & data exclusions
├── public/
│   ├── index.html           # Gradient landing page with server status
│   └── territory-manager.html # Main dashboard UI
├── data/
│   └── database.json        # Auto-created JSON persistence (ignored)
├── HOUSTON_TERRITORIES_READY_TO_UPLOAD.csv # Processed workbook export
├── README.md                # This guide
└── DEPLOY_TO_APPS_SCRIPT.md # Detailed Apps Script deployment walkthrough
```

## Application Modes
- **TEST**
  - Safe sandbox (default).
  - Enables sample data and clear-all routes.
  - Automatically prefixes territory names with `TEST_`.
- **PRODUCTION**
  - Disables destructive test routes.
  - Removes the `TEST_` prefix when switching over.
  - Intended for Apps Script notification hooks.

Switch modes via the UI button or `POST /api/environment/switch`.

## REST API Cheat Sheet
| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/api/environment` | Current environment.
| POST | `/api/environment/switch` | Toggle (or body `{"environment":"TEST"|"PRODUCTION"}`).
| GET | `/api/territories` | All territories grouped by AE with stats.
| POST | `/api/territories/bulk` | Upload CSV payload (`csvData`), ignores comment lines starting with `#`.
| POST | `/api/territories/add` | `{ zipCode, aeEmail, branchId, territoryName }`.
| POST | `/api/territories/remove` | `{ zipCode }` – unassign a zip.
| GET | `/api/territories/search/:zip` | Lookup zip ownership.
| GET | `/api/territories/export` | Download full CSV snapshot.
| POST | `/api/test/sample` | Load four canned territories (TEST only).
| POST | `/api/test/clear` | Wipe data store (TEST only).

Responses include friendly `message` strings and validation errors for UI display.

## Testing & Verification
1. `npm run dev` – start Nodemon for auto-reloads.
2. Load `http://localhost:3001/territories` – confirm stats cards render.
3. Click **🧪 Load Sample Territories** (available only in TEST) – expect 4 cards and a search result for `77001`.
4. Use the search bar to verify lookups and removal actions.
5. Upload `HOUSTON_TERRITORIES_READY_TO_UPLOAD.csv` – ensure 339 unique Houston zips appear and export works.

## Houston Territory CSV
The Excel workbook at `/Users/codylytle/Downloads/2025 - Houston Team Zip Code Territory.xlsx` was parsed into `HOUSTON_TERRITORIES_READY_TO_UPLOAD.csv` with these rules:
- Column B suffixes were zero-padded and prefixed with `77`.
- Duplicate zip codes per territory were removed.
- Each territory section includes descriptive comments and placeholder AE emails
  (`southwest/northwest/southeast/northeast-ae@company.com`).

Update the AE addresses before importing into production.

## Deploying to Google Apps Script
The Express routes map 1:1 with Apps Script HTTP functions. See `DEPLOY_TO_APPS_SCRIPT.md` for:
- Translating each route into `doGet`/`doPost` handlers.
- Replacing Express `fetch()` usage with `google.script.run` from HtmlService files.
- Publishing a web app that shares the same TEST/PRODUCTION behaviours.

## Need Help?
If anything fails (e.g., missing Excel file or server errors), check `server.js` logs in your terminal and confirm the `.env` values. Feel free to extend the `data/database.json` schema—the UI reads whatever the API sends.
