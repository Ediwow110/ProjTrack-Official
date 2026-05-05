# Release Checklist

Use this checklist for every staging or production release. Do not approve public launch from documentation alone; attach command output, screenshots, or links where evidence is requested.

## Release Metadata

- Release version:
- Release branch:
- Pull request:
- Release owner:
- Reviewer:
- Target environment:
- Planned release date:

## Required Gates

- Frontend install, typecheck, and production build passed.
- Backend install, Prisma validate/generate, build, and tests passed.
- Prisma migrations reviewed and deployed with `prisma migrate deploy`.
- Production API boot check passed.
- Production worker boot check passed.
- Playwright smoke test passed or documented as intentionally skipped.
- `npm audit --audit-level=high` passed for frontend and backend or exceptions were approved.
- Secret scan passed.
- Staging smoke evidence attached.
- Backup restore evidence attached.
- Monitoring evidence attached.
- Rollback plan reviewed.

## Release Decision

- Decision: `go`, `hold`, or `rollback`.
- Blocking issues:
- Follow-up issues:
- Approver:
- Approval timestamp:
