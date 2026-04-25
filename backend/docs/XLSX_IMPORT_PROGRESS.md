# XLSX Import Progress

This batch adds a real spreadsheet parsing path for the admin student import flow.

## Added
- `xlsx` dependency in backend `package.json`
- `ImportFileService`
- DTO support for:
  - `fileBase64`
  - `fileType`
  - `csvText`
  - `rows` fallback
- `AdminStudentsService.importPreview()` can now:
  - parse `.xlsx` payloads from base64
  - parse CSV text payloads
  - still accept direct JSON rows for prototype mode

## Current expected backend payload shapes

### XLSX
```json
{
  "fileName": "students.xlsx",
  "fileType": "xlsx",
  "fileBase64": "<base64 spreadsheet>"
}
```

### CSV
```json
{
  "fileName": "students.csv",
  "fileType": "csv",
  "csvText": "student_id,first_name,last_name,email,section,course,year_level\n..."
}
```

### Direct row fallback
```json
{
  "fileName": "students.xlsx",
  "rows": [
    {
      "student_id": "STU-2026-00001",
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "email": "juan@example.edu",
      "section": "BSIT 3A",
      "course": "BSIT",
      "year_level": "3"
    }
  ]
}
```

## Still missing
- frontend file-to-base64 upload bridge
- production-grade spreadsheet validation feedback
- strict template versioning
- duplicate detection against real PostgreSQL records in full prisma mode
