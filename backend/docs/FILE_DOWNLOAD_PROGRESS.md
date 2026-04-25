# File Download Progress

This batch adds protected download support for stored files.

## Added
- backend route:
  - `GET /files/download/:scope/:storedName`
- frontend helper to build backend download URLs for stored file paths
- submission views can now render downloadable attachment links when `relativePath` is available

## Why this helps
The upload prototype now has a more complete loop:
- upload file
- store relative path
- attach it to submission metadata
- render a download link later

## Remaining work
- signed or expiring download URLs
- DB-backed authorization rules per file
- object storage download integration
