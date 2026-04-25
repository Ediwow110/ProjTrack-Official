# Next Real Implementation Steps

## 1. Security
- replace plain-text demo passwords with hashing
- add JWT access + refresh signing
- add token validation guards
- add role guards

## 2. Student Import
- replace CSV-style prototype parsing with true `.xlsx` parsing
- add duplicate detection against Prisma tables
- store import batch results

## 3. Mail
- replace mail stub with a real provider
- keep queue records in database
- add delivery and failure tracking

## 4. File Uploads
- add object storage integration
- persist file metadata
- validate size and MIME type on upload

## 5. Reports
- convert report summaries to real SQL/Prisma queries
- support filtered exports from the backend

## 6. Prototype cleanup
- move service modules off direct `AppStore` access
- keep `AppStore` only for mock/demo mode
