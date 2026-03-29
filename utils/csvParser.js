/**
 * Parse CSV buffer to array of objects.
 * Handles quoted fields and normalizes headers for lead import.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === ',' && !inQuotes) || (ch === '\n' && !inQuotes)) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      current = '';
      if (ch === '\n') break;
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

const HEADER_MAP = {
  email: 'email',
  'first name': 'firstName',
  firstname: 'firstName',
  'last name': 'lastName',
  lastname: 'lastName',
  status: 'status',
  'last contacted': 'lastContacted',
  lastcontacted: 'lastContacted',
  'last contact': 'lastContacted',
  lastcontact: 'lastContacted',
  phone: 'phone',
  company: 'company',
  message: 'message',
};

function normalizeHeader(header) {
  const key = String(header || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return HEADER_MAP[key] || key;
}

/**
 * Parse CSV buffer to array of objects with normalized lead field names.
 * First row is headers. Returns { rows, errors }.
 */
function parseLeadCSV(buffer) {
  const text = (buffer || '').toString('utf8').trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    normalizedHeaders.forEach((norm, idx) => {
      const val = values[idx] !== undefined ? String(values[idx]).trim() : '';
      if (val) row[norm] = val;
    });
    if (!row.email) {
      errors.push(`Row ${i + 1}: missing email, skipped.`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}

module.exports = { parseLeadCSV, parseCSVLine };
