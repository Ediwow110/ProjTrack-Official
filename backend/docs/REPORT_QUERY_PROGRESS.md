# Report Query Progress

This batch moves admin report generation behind a repository.

## Added
- `AdminReportsRepository`
- repository-backed report methods for:
  - summary
  - current view
  - CSV export

## Why this helps
- report logic is less coupled to the admin service
- report generation now consistently composes data from:
  - submissions
  - subjects
  - users/groups
- this is a cleaner bridge toward full Prisma/PostgreSQL reporting

## Remaining work
- optimized SQL/Prisma aggregate queries
- monthly trend endpoints sourced from real DB aggregates
- pagination for large report sets
