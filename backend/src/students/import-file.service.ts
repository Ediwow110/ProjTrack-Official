import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

type ImportRow = Record<string, string>;

@Injectable()
export class ImportFileService {
  private readonly maxRows = Number(process.env.STUDENT_IMPORT_MAX_ROWS || 1000);
  private readonly maxColumns = Number(process.env.STUDENT_IMPORT_MAX_COLUMNS || 32);
  private readonly maxSheets = Number(process.env.STUDENT_IMPORT_MAX_SHEETS || 1);
  private readonly maxFileBytes = Number(process.env.STUDENT_IMPORT_MAX_FILE_MB || 5) * 1024 * 1024;

  parseBase64Spreadsheet(fileBase64: string, fileName?: string): ImportRow[] {
    if (!fileBase64) {
      throw new BadRequestException('No spreadsheet content provided.');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 spreadsheet payload.');
    }
    if (buffer.byteLength > this.maxFileBytes) {
      throw new BadRequestException(`Import file exceeds the ${Math.round(this.maxFileBytes / (1024 * 1024))} MB limit.`);
    }

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      if (workbook.SheetNames.length > this.maxSheets) {
        throw new BadRequestException(`Import file exceeds the ${this.maxSheets} sheet limit.`);
      }
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('Spreadsheet has no sheets.');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });
      if (rows.length > this.maxRows) {
        throw new BadRequestException(`Import file exceeds the ${this.maxRows} row limit.`);
      }

      return rows.map((row) => {
        if (Object.keys(row).length > this.maxColumns) {
          throw new BadRequestException(`Import file exceeds the ${this.maxColumns} column limit.`);
        }
        const normalized: ImportRow = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[String(key).trim().toLowerCase()] = String(value ?? '').trim();
        }
        return normalized;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const label = fileName ? ` for ${fileName}` : '';
      throw new BadRequestException(`Unable to parse spreadsheet${label}.`);
    }
  }

  parseCsvText(csvText: string): ImportRow[] {
    if (Buffer.byteLength(csvText || '', 'utf8') > this.maxFileBytes) {
      throw new BadRequestException(`CSV import exceeds the ${Math.round(this.maxFileBytes / (1024 * 1024))} MB limit.`);
    }
    const parsed = this.parseDelimited(csvText);
    if (parsed.length < 2) return [];
    if (parsed.length - 1 > this.maxRows) {
      throw new BadRequestException(`CSV import exceeds the ${this.maxRows} row limit.`);
    }
    const headers = parsed[0].map((item) => item.trim().toLowerCase());
    if (headers.length > this.maxColumns) {
      throw new BadRequestException(`CSV import exceeds the ${this.maxColumns} column limit.`);
    }
    return parsed.slice(1).map((cells) => {
      const row: ImportRow = {};
      headers.forEach((header, index) => {
        row[header] = String(cells[index] ?? '').trim();
      });
      return row;
    });
  }

  private parseDelimited(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    const delimiter = text.includes('\t') && !text.includes(',') ? '\t' : ',';

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && char === delimiter) {
        row.push(cell);
        cell = '';
        continue;
      }
      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += char;
    }
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    if (inQuotes) {
      throw new BadRequestException('CSV import has an unterminated quoted value.');
    }
    return rows;
  }
}
