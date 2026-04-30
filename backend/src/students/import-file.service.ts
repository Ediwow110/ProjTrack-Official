import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

type ImportRow = Record<string, string>;

function cellToText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && value.text !== undefined) return String(value.text ?? '').trim();
    if ('result' in value && value.result !== undefined) return String(value.result ?? '').trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || '').join('').trim();
    }
    if ('hyperlink' in value && value.hyperlink !== undefined) return String(value.hyperlink ?? '').trim();
    return '';
  }
  return String(value ?? '').trim();
}

@Injectable()
export class ImportFileService {
  private readonly maxRows = Number(process.env.STUDENT_IMPORT_MAX_ROWS || 1000);
  private readonly maxColumns = Number(process.env.STUDENT_IMPORT_MAX_COLUMNS || 32);
  private readonly maxSheets = Number(process.env.STUDENT_IMPORT_MAX_SHEETS || 1);
  private readonly maxFileBytes = Number(process.env.STUDENT_IMPORT_MAX_FILE_MB || 5) * 1024 * 1024;

  async parseBase64Spreadsheet(fileBase64: string, fileName?: string): Promise<ImportRow[]> {
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
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      if (workbook.worksheets.length > this.maxSheets) {
        throw new BadRequestException(`Import file exceeds the ${this.maxSheets} sheet limit.`);
      }
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new BadRequestException('Spreadsheet has no sheets.');
      }

      const headerValues = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1);
      const headers = headerValues.map((value) => cellToText(value).trim().toLowerCase());
      if (!headers.some(Boolean)) return [];
      if (headers.length > this.maxColumns) {
        throw new BadRequestException(`Import file exceeds the ${this.maxColumns} column limit.`);
      }

      const rows: ImportRow[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const values = (sheet.getRow(rowNumber).values as ExcelJS.CellValue[]).slice(1);
        if (!values.some((value) => cellToText(value))) continue;
        if (rows.length >= this.maxRows) {
          throw new BadRequestException(`Import file exceeds the ${this.maxRows} row limit.`);
        }
        const row: ImportRow = {};
        headers.forEach((header, index) => {
          if (!header) return;
          row[header] = cellToText(values[index]);
        });
        rows.push(row);
      }

      return rows;
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
