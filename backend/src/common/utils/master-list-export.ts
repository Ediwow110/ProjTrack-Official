import ExcelJS from 'exceljs';

export type MasterListRow = {
  studentId: string;
  lastName: string;
  firstName: string;
  middleInitial?: string | null;
  accountStatus?: string | null;
};

export type MasterListContext = {
  academicYear: string;
  yearLevel: string;
  section: string;
  course?: string | null;
  adviser?: string | null;
};

function sanitizeFilePart(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function buildMasterListFileName(context: MasterListContext) {
  return `masters-list-${sanitizeFilePart(context.academicYear)}-${sanitizeFilePart(
    context.yearLevel,
  )}-${sanitizeFilePart(context.section)}.xlsx`;
}

export async function buildMasterListWorkbookBuffer(
  context: MasterListContext,
  rows: MasterListRow[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ProjTrack';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Master List', {
    views: [{ state: 'frozen', ySplit: 8 }],
  });

  const sheetRows: Array<Array<string>> = [
    ['ProjTrack Master List'],
    [`Academic Year: ${context.academicYear}`],
    [`Course / Program: ${String(context.course ?? '').trim() || 'Unassigned'}`],
    [`Year Level: ${context.yearLevel}`],
    [`Section: ${context.section}`],
    [`Adviser: ${String(context.adviser ?? '').trim() || 'Unassigned'}`],
    [],
    ['Student ID', 'Last Name', 'First Name', 'M.I.', 'Account Status'],
    ...rows.map((row) => [
      row.studentId,
      row.lastName,
      row.firstName,
      String(row.middleInitial ?? '').trim(),
      String(row.accountStatus ?? '').trim(),
    ]),
  ];

  sheet.addRows(sheetRows);
  sheet.columns = [
    { width: 20 },
    { width: 24 },
    { width: 24 },
    { width: 8 },
    { width: 18 },
  ];
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(8).font = { bold: true };

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}
