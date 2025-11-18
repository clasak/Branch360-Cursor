const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const INITIAL_ENV = (process.env.NODE_ENV || 'TEST').toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'TEST';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.text({ limit: '5mb', type: 'text/csv' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_DB = {
  environment: INITIAL_ENV,
  territories: {}
};

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.territories || typeof parsed.territories !== 'object') {
      parsed.territories = {};
    }
    if (!parsed.environment) {
      parsed.environment = DEFAULT_DB.environment;
    }
    return parsed;
  } catch (error) {
    console.error('[DB] Failed to read existing database, falling back to defaults.', error);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let db = ensureDataStore();

function persistDatabase() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function normalizeZip(zip) {
  if (!zip && zip !== 0) return null;
  const trimmed = String(zip).trim();
  if (!/^\d{5}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeEmail(email) {
  if (!email) return null;
  const cleaned = String(email).trim().toLowerCase();
  if (!cleaned.includes('@')) return null;
  return cleaned;
}

function formatTerritoryNameForEnv(name, environment) {
  if (!name) return null;
  const value = String(name).trim();
  if (environment === 'TEST') {
    return value.startsWith('TEST_') ? value : `TEST_${value}`;
  }
  return value.replace(/^TEST_/, '');
}

function reapplyEnvironmentPrefixes(targetEnvironment) {
  Object.keys(db.territories).forEach((zip) => {
    const territory = db.territories[zip];
    territory.territoryName = formatTerritoryNameForEnv(territory.territoryName, targetEnvironment);
  });
}

function upsertTerritoryRecord({ zipCode, aeEmail, branchId, territoryName }) {
  const normalizedZip = normalizeZip(zipCode);
  const cleanedEmail = sanitizeEmail(aeEmail);
  const trimmedBranch = branchId ? String(branchId).trim() : null;
  const formattedTerritoryName = formatTerritoryNameForEnv(territoryName, db.environment);

  if (!normalizedZip) {
    return { error: 'Zip must be 5 digits.' };
  }
  if (!cleanedEmail) {
    return { error: 'AE email must include @ and cannot be empty.' };
  }
  if (!trimmedBranch) {
    return { error: 'Branch ID is required.' };
  }
  if (!formattedTerritoryName) {
    return { error: 'Territory name is required.' };
  }

  const existing = db.territories[normalizedZip];
  db.territories[normalizedZip] = {
    zipCode: normalizedZip,
    aeEmail: cleanedEmail,
    branchId: trimmedBranch,
    territoryName: formattedTerritoryName
  };
  persistDatabase();
  return { record: db.territories[normalizedZip], isUpdate: Boolean(existing) };
}

function removeTerritory(zipCode) {
  const normalizedZip = normalizeZip(zipCode);
  if (!normalizedZip) {
    return { error: 'Zip must be 5 digits.' };
  }
  if (!db.territories[normalizedZip]) {
    return { error: 'Zip not found.' };
  }
  delete db.territories[normalizedZip];
  persistDatabase();
  return { removed: true, zipCode: normalizedZip };
}

function buildTerritoryGroups() {
  const groups = {};
  Object.values(db.territories).forEach((territory) => {
    const key = `${territory.aeEmail}::${territory.territoryName}`;
    if (!groups[key]) {
      groups[key] = {
        aeEmail: territory.aeEmail,
        branchId: territory.branchId,
        territoryName: territory.territoryName,
        zipCodes: []
      };
    }
    groups[key].zipCodes.push(territory.zipCode);
  });

  return Object.values(groups).map((group) => {
    group.zipCodes.sort();
    group.zipCount = group.zipCodes.length;
    return group;
  });
}

function buildStats(groups) {
  const totalAEs = new Set(groups.map((g) => g.aeEmail)).size;
  const totalZips = Object.keys(db.territories).length;
  const avgCoverage = totalAEs === 0 ? 0 : (totalZips / totalAEs);
  return {
    totalAEs,
    totalZipCodes: totalZips,
    averageCoverage: Number(avgCoverage.toFixed(2)),
    currentEnvironment: db.environment
  };
}

function parseCsvPayload(csvString) {
  const summary = {
    processed: 0,
    added: 0,
    updated: 0,
    errors: []
  };

  if (!csvString || typeof csvString !== 'string') {
    summary.errors.push('CSV payload missing.');
    return summary;
  }

  const lines = csvString.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }
    if (trimmedLine.toLowerCase().startsWith('zipcode')) {
      return;
    }

    summary.processed += 1;
    const columns = trimmedLine.split(',');
    if (columns.length < 4) {
      summary.errors.push(`Line ${index + 1}: Expected 4 columns.`);
      return;
    }

    const [zipCode, aeEmail, branchId, ...territoryParts] = columns;
    const territoryName = territoryParts.join(',');
    const result = upsertTerritoryRecord({ zipCode, aeEmail, branchId, territoryName });
    if (result.error) {
      summary.errors.push(`Line ${index + 1}: ${result.error}`);
      return;
    }
    if (result.isUpdate) {
      summary.updated += 1;
    } else {
      summary.added += 1;
    }
  });

  return summary;
}

app.get('/api/environment', (req, res) => {
  res.json({ environment: db.environment });
});

app.post('/api/environment/switch', (req, res) => {
  const desiredEnv = req.body?.environment ? String(req.body.environment).toUpperCase() : null;
  let targetEnv;
  if (desiredEnv && (desiredEnv === 'TEST' || desiredEnv === 'PRODUCTION')) {
    targetEnv = desiredEnv;
  } else {
    targetEnv = db.environment === 'TEST' ? 'PRODUCTION' : 'TEST';
  }

  if (targetEnv === db.environment) {
    return res.json({ environment: db.environment, message: `Already in ${db.environment}.` });
  }

  db.environment = targetEnv;
  reapplyEnvironmentPrefixes(targetEnv);
  persistDatabase();
  res.json({ environment: db.environment, message: `Switched to ${targetEnv}.` });
});

app.get('/api/territories', (req, res) => {
  const groups = buildTerritoryGroups();
  const stats = buildStats(groups);
  res.json({ environment: db.environment, stats, territories: groups });
});

app.post('/api/territories/bulk', (req, res) => {
  const csvPayload = req.body?.csvData || req.body?.csv || req.body;
  const summary = parseCsvPayload(csvPayload);
  const statusCode = summary.errors.length && !summary.added && !summary.updated ? 400 : 200;
  res.status(statusCode).json({
    message: `Processed ${summary.processed} rows. Added ${summary.added}, updated ${summary.updated}.`,
    summary
  });
});

app.post('/api/territories/add', (req, res) => {
  const { zipCode, aeEmail, branchId, territoryName } = req.body || {};
  const result = upsertTerritoryRecord({ zipCode, aeEmail, branchId, territoryName });
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  const statusCode = result.isUpdate ? 200 : 201;
  res.status(statusCode).json({
    message: result.isUpdate ? 'Zip updated.' : 'Zip added.',
    record: result.record
  });
});

app.post('/api/territories/remove', (req, res) => {
  const { zipCode } = req.body || {};
  const result = removeTerritory(zipCode);
  if (result.error) {
    const statusCode = result.error === 'Zip not found.' ? 404 : 400;
    return res.status(statusCode).json({ error: result.error });
  }
  res.json({ message: `Removed zip ${result.zipCode}.` });
});

app.get('/api/territories/search/:zipCode', (req, res) => {
  const zip = normalizeZip(req.params.zipCode);
  if (!zip) {
    return res.status(400).json({ error: 'Zip must be 5 digits.' });
  }
  const record = db.territories[zip];
  if (!record) {
    return res.status(404).json({ error: 'Zip not assigned.' });
  }
  res.json({ record });
});

app.get('/api/territories/export', (req, res) => {
  const rows = Object.values(db.territories).sort((a, b) => a.zipCode.localeCompare(b.zipCode));
  const csvLines = ['ZipCode,AE_Email,BranchID,TerritoryName'];
  rows.forEach((row) => {
    const sanitizedName = row.territoryName.replace(/"/g, "''");
    csvLines.push(`${row.zipCode},${row.aeEmail},${row.branchId},"${sanitizedName}"`);
  });

  const payload = csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="territories-export.csv"');
  res.send(payload);
});

app.post('/api/test/sample', (req, res) => {
  if (db.environment !== 'TEST') {
    return res.status(403).json({ error: 'Sample data is only available in TEST mode.' });
  }

  const samples = [
    {
      territoryName: 'Southwest Houston',
      aeEmail: 'southwest.ae@test.branch360.com',
      branchId: 'BRN-001',
      zipCodes: ['77001', '77002', '77003', '77004']
    },
    {
      territoryName: 'Northwest Houston',
      aeEmail: 'northwest.ae@test.branch360.com',
      branchId: 'BRN-001',
      zipCodes: ['77005', '77006', '77007', '77008']
    },
    {
      territoryName: 'Southeast Houston',
      aeEmail: 'southeast.ae@test.branch360.com',
      branchId: 'BRN-002',
      zipCodes: ['77009', '77010', '77011', '77012']
    },
    {
      territoryName: 'Northeast Houston',
      aeEmail: 'northeast.ae@test.branch360.com',
      branchId: 'BRN-002',
      zipCodes: ['77013', '77014', '77015', '77016']
    }
  ];

  samples.forEach((territory) => {
    territory.zipCodes.forEach((zip) => {
      upsertTerritoryRecord({
        zipCode: zip,
        aeEmail: territory.aeEmail,
        branchId: territory.branchId,
        territoryName: territory.territoryName
      });
    });
  });

  res.json({ message: 'Loaded sample territories.', totalSampleZips: samples.reduce((acc, t) => acc + t.zipCodes.length, 0) });
});

app.post('/api/test/clear', (req, res) => {
  if (db.environment !== 'TEST') {
    return res.status(403).json({ error: 'Clearing data is only allowed in TEST mode.' });
  }
  db.territories = {};
  persistDatabase();
  res.json({ message: 'All territories cleared for TEST mode.' });
});

app.get('/territories', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'territory-manager.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Branch360 Territory Manager listening on http://localhost:${PORT}`);
});
