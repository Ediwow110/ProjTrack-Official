# Release Evidence

This directory holds **real** evidence captured during each production-readiness
gate. Nothing in this directory may be edited by hand to make a release look
better than it is. If a step did not pass, leave the failure log in place and
re-attempt; the failed log is itself useful evidence.

## Per-release directory layout

Create one dated subdirectory per release attempt:

```
docs/release-evidence/
├── README.md                          (this file)
├── 2026-05-03/                        (one folder per attempt)
│   ├── 00-ci-links.md
│   ├── 01-runtime-boot.log
│   ├── 02-worker-smoke.log
│   ├── 03-staging-smoke.log
│   ├── 04-backup-drill.log
│   ├── 05-dns-records.png
│   ├── 06-do-resources.md
│   ├── 07-monitoring-alerts.md
│   ├── 08-caddy-https.log
│   ├── 09-container-health.log
│   ├── 10-prisma-migrate.log
│   ├── 11-npm-audit.log
│   ├── 12-production-smoke.log
│   └── 13-go-no-go-signoff.md
└── ...
```

## What each file should contain

| File | Source | What's evidence |
| --- | --- | --- |
| `00-ci-links.md` | GitHub Actions | Direct URLs to `CI` and `Production Candidate Verification` runs that gated this release, with their commit SHAs. |
| `01-runtime-boot.log` | `npm run check:runtime:prod` on the target Droplet | Full stdout/stderr; must end with the script's success line. |
| `02-worker-smoke.log` | `npm run smoke:worker` on the target Droplet | Full stdout/stderr; clean SIGTERM exit. |
| `03-staging-smoke.log` | `npm run smoke:staging:summary` against `https://api-staging.projtrack.codes` | Full PASS/FAIL summary; capture even on failure. |
| `04-backup-drill.log` | `node backend/scripts/backup-restore-drill.mjs` against a disposable target DB | pg_dump line, restore line, table verification, row counts. |
| `05-dns-records.png` (or `.csv`) | Name.com DNS export | Full zone export so we can prove MX/SPF/DKIM/DMARC were preserved. |
| `06-do-resources.md` | DigitalOcean console | List of Droplet, Postgres clusters, Spaces buckets, reserved IP, project tags. |
| `07-monitoring-alerts.md` | DigitalOcean Monitoring → Alerts | Each alert policy ID + the timestamp of the test fire that proved it works. |
| `08-caddy-https.log` | `curl -vI https://api.projtrack.codes/health` (and the other 4 hostnames) | TLS handshake + status code per hostname. |
| `09-container-health.log` | `docker ps --format ...` and `docker inspect --format '{{.State.Health.Status}}' ...` | All four containers reporting `healthy`. |
| `10-prisma-migrate.log` | `npx prisma migrate deploy` against staging then production | Migration list applied, with timestamps. |
| `11-npm-audit.log` | `npm audit --audit-level=high --omit=dev` (root + backend) | Final summary lines (vulnerabilities=0, or list of findings). |
| `12-production-smoke.log` | Manual end-to-end run after Stage 3 cutover | Login, refresh, logout, upload, role checks, audit log entries. |
| `13-go-no-go-signoff.md` | Stakeholder signature | Names, roles, date, GO / CONDITIONAL GO / NO-GO, reasoning. |

## Rules

1. **No fabrication.** If a step did not run, the file is absent. If a step
   failed, the failure log stays.
2. **Never paste secrets** into evidence files. Redact `DATABASE_URL`
   passwords, API keys, JWT secrets, and Spaces credentials before saving.
3. **Use the verification scripts** rather than ad-hoc curl when one exists.
   The script outputs are designed to be the evidence.
4. **Sign-off is the last file**, after every other file is in place.

## How this maps to the release verdict

`PRODUCTION_READINESS_AUDIT.md` and `FINAL_READINESS_CHECKLIST.md` cite the
evidence files in this directory. The verdict is:

- **GO** — every numbered file present and showing PASS, plus stakeholder sign-off.
- **CONDITIONAL GO** — automation gates and code are ready, but one or more of the manual evidence files is missing or shows a non-blocking issue documented in `13-go-no-go-signoff.md`.
- **NO-GO** — any P0/critical security finding, or any of `01`–`04` failing.
