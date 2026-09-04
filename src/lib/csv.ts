export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Minimal RFC-4180 CSV parser (quoted commas, escaped quotes, CRLF). Pure, tested. */
export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error("CSV is empty");

  const headers = splitLine(lines[0]).map((header) => header.trim());
  if (headers.some((header) => header.length === 0)) throw new Error("CSV headers must not be empty");

  const rows = lines.slice(1).map((line, index) => {
    const cells = splitLine(line);
    if (cells.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${cells.length} cells, expected ${headers.length}`);
    }
    const row: Record<string, string> = {};
    headers.forEach((header, position) => {
      row[header] = cells[position].trim();
    });
    return row;
  });
  return { headers, rows };
}

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
