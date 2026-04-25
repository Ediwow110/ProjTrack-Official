import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

type ImportRow = Record<string, string>;

@Injectable()
export class ImportFileService {
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

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('Spreadsheet has no sheets.');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });

      return rows.map((row) => {
        const normalized: ImportRow = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[String(key).trim().toLowerCase()] = String(value ?? '').trim();
        }
        return normalized;
      });
    } catch (error) {
      const label = fileName ? ` for ${fileName}` : '';
      throw new BadRequestException(`Unable to parse spreadsheet${label}.`);
    }
  }

  parseCsvText(csvText: string): ImportRow[] {
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(',');
      const row: ImportRow = {};
      headers.forEach((header, index) => {
        row[header] = String(cells[index] ?? '').trim();
      });
      return row;
    });
  }
}
