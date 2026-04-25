# File Metadata + Authorization Progress

This batch upgrades the local file storage prototype with persisted file metadata and a first pass at authorization.

## Added
- uploaded file records are now saved in the prototype store
- file metadata includes:
  - original filename
  - stored name
  - scope
  - relative path
  - uploader user/role
  - size
  - upload timestamp
- new endpoint:
  - `GET /files/meta/:scope/:storedName`
- student download restriction:
  - a student can only download a file they uploaded themselves

## Why this helps
The file layer now has more realistic ownership metadata and a better foundation for later DB-backed and object-storage-backed authorization.

## Remaining work
- teacher/student authorization rules based on subject membership
- DB-backed file ownership and submission linkage
- signed URLs for object storage
