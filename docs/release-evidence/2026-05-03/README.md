# Release evidence — placeholder for the next staging run

This directory will hold real captured output from the Phase F runbook
(`docs/release-evidence/README.md` defines the file contract).

**Status as of this commit:** none of the evidence files exist yet because
none of the steps have been executed. The Phase F runbook
(`docs/release-evidence/<this-date>/00-phase-f-runbook.md`) is the only
file in this directory; it is the operator's instruction set, not evidence.

When the operator runs the steps, they fill in the numbered files below
and commit them. **Do not create or merge any of these files until the real
step has actually passed** — empty or fabricated evidence violates the
release-evidence contract.

| File | Created by which step |
|---|---|
| `00-phase-f-runbook.md` | (already present — operator instructions) |
| `01-ci-workflow-patch.md` | Step 0 |
| `02-bootstrap.md` | Step 3 |
| `03-runtime-boot.md` | Step 6 |
| `04-staging-smoke.md` | Step 7 |
| `05-backup-drill.md` | Step 8 |
| `06-dns.md` | Step 2 |
| `07-do-resources.md` | Step 1 |
| `08-monitoring.md` | Step 9 |
| `09-caddy-https.md` | Step 6 |
| `10-container-health.md` | Step 5 |
| `11-prisma-migrate.md` | Step 5 |
| `12-npm-audit.md` | Step 10 |
| `13-production-smoke.md` | only after Stage 2 cutover (out of Phase F scope) |
| `14-go-no-go-signoff.md` | last, after every other file is in place |
