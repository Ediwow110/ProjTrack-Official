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
- Playwright smoke test passed, or is explicitly blocked with attached evidence. A skipped smoke run is not production evidence.
- `npm audit --audit-level=high` passed for frontend and backend or exceptions were approved.
- Secret scan passed.
- Staging smoke evidence attached.
- Backup restore evidence attached.
- Monitoring evidence attached.
- Rollback plan reviewed.

## GitHub Actions smoke secrets

Real GitHub Actions browser smoke requires these repository secrets:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEACHER_IDENTIFIER`
- `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_IDENTIFIER`
- `SMOKE_STUDENT_PASSWORD`

Add them in `Settings -> Secrets and variables -> Actions`.

- Use test-only or staging-only credentials.
- Do not use production credentials.
- Do not commit these values.
- Admin-only secrets are not enough.

See [docs/GITHUB_ACTIONS_SMOKE_SECRETS.md](/docs/GITHUB_ACTIONS_SMOKE_SECRETS.md).

## Release Decision

- Decision: `go`, `hold`, or `rollback`.
- Blocking issues:
- Follow-up issues:
- Approver:
- Approval timestamp:
