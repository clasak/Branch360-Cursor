/**
 * Demo data seeding helpers so Houston pilot always looks alive.
 */

function runDemoSeed(branchId) {
  branchId = branchId || 'BRN-001';
  const aes = [
    { userID: 'AE-HTX-001', name: 'Blair Sloat' },
    { userID: 'AE-HTX-002', name: 'Demo AE 2' }
  ];
  seedDemoLeads(branchId, aes);
  seedDemoStartPackets(branchId, aes);
  seedDemoActivityLog(branchId, aes);
}

function clearSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
}

function seedDemoLeads(branchId, aeUsers) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEADS);
  if (!sheet) return;
  clearSheetData(SHEETS.LEADS);
  const options = getStandardOptions();
  const statuses = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
  const now = new Date();
  for (var i = 0; i < 15; i++) {
    const ae = aeUsers[i % aeUsers.length];
    const leadID = generateUniqueID('LEAD');
    const createdDate = new Date(now.getTime() - (i * 86400000));
    const status = statuses[i % statuses.length];
    const serviceType = options.serviceTypes[i % options.serviceTypes.length];
    const row = [
      leadID,
      createdDate,
      '',
      'Demo Prospect #' + (i + 1),
      (1000 + i) + ' Westheimer Rd, Houston, TX',
      '7700' + (i % 9),
      '713-555-01' + (10 + i),
      'prospect' + i + '@example.com',
      serviceType,
      'Auto-seeded for demo',
      status,
      ae.userID,
      createdDate,
      createdDate,
      '',
      createdDate,
      createdDate
    ];
    sheet.appendRow(row);
  }
}

function seedDemoStartPackets(branchId, aeUsers) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.START_PACKETS);
  if (!sheet) return;
  clearSheetData(SHEETS.START_PACKETS);
  const options = getStandardOptions();
  const statuses = ['Draft', 'Submitted', 'Scheduled', 'Completed'];
  const now = new Date();
  for (var i = 0; i < 10; i++) {
    const ae = aeUsers[i % aeUsers.length];
    const packetID = generateUniqueID('PKT');
    const soldDate = new Date(now.getTime() - (i * 43200000));
    const status = statuses[i % statuses.length];
    const row = [
      packetID,
      branchId,
      '',
      soldDate,
      'Houston Account #' + (i + 1),
      (1400 + i) + ' Richmond Ave, Houston, TX',
      ae.name,
      2500 + i * 150,
      600 + i * 35,
      options.serviceTypes[i % options.serviceTypes.length],
      12,
      'Bruce Hockless',
      'Specialist #' + ((i % 4) + 1),
      new Date(now.getTime() + (i * 86400000)),
      status === 'Completed',
      true,
      'POC ' + (i + 1) + ' (713-555-0' + (20 + i) + ')',
      new Date(now.getTime() + (i * 86400000)),
      'Auto demo packet',
      status,
      '',
      soldDate,
      new Date()
    ];
    sheet.appendRow(row);
  }
}

function seedDemoActivityLog(branchId, aeUsers) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ACTIVITY_LOG);
  if (!sheet) return;
  clearSheetData(SHEETS.ACTIVITY_LOG);
  const actionTypes = [
    'AE_MARK_CONTACTED',
    'AE_CONVERT_LEAD',
    'AE_CREATE_QUOTE',
    'AE_IMPORT_SF_QUOTE',
    'OPS_CREATE_START_PACKET',
    'OPS_ASSIGN_TECH',
    'TECH_COMPLETE_INSTALL',
    'BM_EXPORT_REPORT'
  ];
  const now = new Date();
  for (var i = 0; i < 40; i++) {
    const ae = aeUsers[i % aeUsers.length];
    const action = actionTypes[i % actionTypes.length];
    const started = new Date(now.getTime() - i * 86400000);
    const completed = new Date(started.getTime() + (Math.random() * 300000));
    sheet.appendRow([
      generateUniqueID('ACTLOG'),
      ae.userID,
      action.indexOf('TECH_') === 0 ? 'Technician' : (action.indexOf('OPS_') === 0 ? 'Ops Manager' : 'AE'),
      branchId,
      action,
      'CTX-' + i,
      started,
      completed,
      Math.round((completed - started) / 1000),
      0,
      '{}',
      'Demo'
    ]);
  }
}
