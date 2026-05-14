# Release Evidence Checklist

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this checklist before merging `2nd-main` into `main`, before deploying, or before making any production/school-scale claim.

## Local evidence helper

To collect local evidence for release guardrails, backend build, tests, secret scan, and dependency audit, run:

```bash
npm run evidence:local
```

The command writes a generated Markdown report under:

```text
evidence/local-evidence-*.md
```

Generated evidence reports are ignored by Git by default. Commit one only if it is intentionally used as a durable audit artifact and contains no sensitive local/environment details.

## Required evidence before merge

- [ ] Latest `ci.yml` run URL recorded in `docs/CI_STATUS.md`.
- [ ] Latest `production-checks.yml` run URL recorded in `docs/CI_STATUS.md`.
- [ ] `npm run evidence:local` report generated or equivalent CI results recorded.
- [ ] `npm run check:release-hygiene` result recorded.
- [ ] `npm run check:capacity-claims` result recorded.
- [ ] `npm run check:release-guard-wiring` result recorded.
- [ ] `npm --prefix backend run test:security` result recorded.
- [ ] `npm --prefix backend run build` result recorded.
- [ ] Secret scan result recorded.
- [ ] Dependency audit result recorded.
- [ ] Final merge gate reviewed.

## Required evidence before school-scale claim

- [ ] `School Scale Validation` tier `1k` result recorded.
- [ ] `School Scale Validation` tier `20k` result recorded before any 20k registered-user claim.
- [ ] `School Scale Validation` tier `50k` result recorded before any 50k registered-user claim.
- [ ] Query-plan warnings resolved or risk-accepted.
- [ ] Dataset counts recorded.
- [ ] Migration deploy result recorded.
- [ ] Seed duration/resource impact recorded.

## Required evidence before concurrency claim

- [ ] Load smoke result recorded.
- [ ] 300 VU result recorded before any 300-concurrent-user claim.
- [ ] 500 VU result recorded before any 500-concurrent-user claim.
- [ ] 1000 VU passing result recorded before any 1000-concurrent-user claim.
- [ ] Memory and database connection trends recorded.
- [ ] Top slow/failing routes recorded.
- [ ] No authorization shortcuts used.

## Required evidence before production-readiness claim

- [ ] Production-check failure issue path live-verified.
- [ ] Incident drill/tabletop recorded.
- [ ] Backup/restore drill recorded or explicitly risk-accepted.
- [ ] Monitoring/alerting reviewed.
- [ ] Rollback strategy reviewed.
- [ ] Migration safety checklist reviewed.
- [ ] Operational readiness document updated.

## Forbidden before evidence exists

Do not publish or merge wording that says:

- production-ready,
- school-scale ready,
- supports 20k users,
- supports 50k users,
- handles 1000 concurrent users,
- proven at 20k-50k users.

Use `docs/CAPACITY_CLAIM_WORDING_GUIDE.md` for approved wording.

## Final reviewer sign-off template

```text
Reviewer:
Date:
Commit SHA:
CI evidence complete: yes/no
Security evidence complete: yes/no
School-scale evidence complete: yes/no/not claimed
Load evidence complete: yes/no/not claimed
Operational evidence complete: yes/no
Approved for merge: yes/no
Approved claims:
Required follow-up:
```
