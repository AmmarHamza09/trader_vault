// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes,
// and commas/newlines inside quotes. No external dependency needed for the
// simple broker-export CSVs this app imports.
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }

  const headers = (rows.shift() || []).map((h) => h.trim());
  return { headers, rows: rows.filter((r) => r.length === headers.length) };
}

export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return trimmed;
}

export function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return trimmed || '00:00';
}

export function normalizeDirection(raw: string): 'BUY' | 'SELL' {
  const v = raw.trim().toLowerCase();
  if (['buy', 'long', 'b', '1'].includes(v)) return 'BUY';
  if (['sell', 'short', 's', '-1', '2'].includes(v)) return 'SELL';
  return v.startsWith('s') ? 'SELL' : 'BUY';
}
