/**
 * Quantzo HR Portal -> Google Sheets attendance bridge.
 *
 * Create a Google Sheet in the Quantzo Google Drive account, open Extensions -> Apps Script,
 * paste this file, set SHEET_NAME if required, then Deploy -> New deployment -> Web app.
 * Execute as: Me. Who has access: Anyone with the web app URL.
 * Put the resulting URL in GOOGLE_SHEETS_WEBHOOK_URL in the portal environment.
 */
const SHEET_NAME = 'Attendance';
const WEBHOOK_SECRET = 'QHS_Attendance_2026_Secure_9x7K2';
const HEADERS = [
  'Employee ID', 'Employee Name', 'Department', 'Designation', 'Date', 'Hospital Name',
  'Travel Start', 'Reached Hospital', 'Punch Out', 'Travel Minutes', 'Working Minutes', 'Status',
  'Start Latitude', 'Start Longitude', 'Reached Latitude', 'Reached Longitude',
  'Punch Out Latitude', 'Punch Out Longitude', 'Last Latitude', 'Last Longitude', 'Last Location At', 'Synced At'
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.event !== 'ATTENDANCE_UPSERT') return json({ ok: false, error: 'Unsupported event' });
    if (!WEBHOOK_SECRET || data.secret !== WEBHOOK_SECRET) return json({ ok: false, error: 'Unauthorized' });

    const sheet = getSheet_();
    ensureHeaders_(sheet);
    const values = [
      data.employeeId || '', data.employeeName || '', data.department || '', data.designation || '', data.date || '', data.hospitalName || '',
      data.travelStart || '', data.reachedHospital || '', data.punchOut || '', data.travelMinutes || '', data.workingMinutes || '', data.status || '',
      data.startLatitude || '', data.startLongitude || '', data.reachedLatitude || '', data.reachedLongitude || '',
      data.punchOutLatitude || '', data.punchOutLongitude || '', data.lastLatitude || '', data.lastLongitude || '', data.lastLocationAt || '', data.syncedAt || ''
    ];

    const row = findRow_(sheet, data.employeeId, data.date);
    if (row) sheet.getRange(row, 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);

    return json({ ok: true, row: row || sheet.getLastRow() });
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function findRow_(sheet, employeeId, date) {
  if (!employeeId || !date || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(employeeId) && String(rows[i][4]) === String(date)) return i + 2;
  }
  return null;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
