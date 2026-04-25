# File Storage Progress

This batch adds a local-disk file storage prototype.

## Added
- `FilesModule`
- `FilesService`
- `FilesController`
- protected routes:
  - `POST /files/upload-base64`
  - `GET /files?scope=...`
  - `DELETE /files/:scope/:storedName`

## Behavior
- files are stored under `backend/uploads/<scope>/`
- current upload path uses base64 payloads
- intended for local development and prototype flows

## Roles
- upload: student / teacher / admin
- list: teacher / admin
- delete: admin

## Remaining work
- multipart/form-data upload support
- object storage support (S3, GCS, etc.)
- DB metadata persistence for uploaded files
- submission file attachment integration
- signed download URLs / access policies
