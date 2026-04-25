import * as XLSX from 'xlsx';

export type MasterListRow = {
  studentId: string;
  lastName: string;
  firstName: string;
  middleInitial?: string | null;
};

export type MasterListContext = {
  academicYear: string;
  yearLevel: string;
  section: string;
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

export function buildMasterListWorkbookBuffer(
  context: MasterListContext,
  rows: MasterListRow[],
) {
  const sheetRows: Array<Array<string>> = [
    ['ProjTrack Master’s List'],
    [`Academic Year: ${context.academicYear}`],
    [`Year Level: ${context.yearLevel}`],
    [`Section: ${context.section}`],
    [`Adviser: ${String(context.adviser ?? '').trim() || 'Unassigned'}`],
    [],
    ['Student ID', 'Last Name', 'First Name', 'M.I.'],
    ...rows.map((row) => [
      row.studentId,
      row.lastName,
      row.firstName,
      String(row.middleInitial ?? '').trim(),
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  sheet['!cols'] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
    { wch: 8 },
  ];
  (sheet as any)['!freeze'] = { xSplit: 0, ySplit: 7 };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Master List');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
