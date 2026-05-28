# Supply Chain Security

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

Not fully accepted yet.

This document defines the supply-chain controls required before `SEC-GATE` can pass. The repository has CI dependency audit and secret scanning, but live passing evidence and exception handling still need to be recorded.

## In scope

- npm dependencies and lockfiles
- GitHub Actions workflows
- CI permissions and secrets exposure risk
- Docker build inputs
- Prisma generation/migrations in CI
- Playwright/browser install behavior
- Dependency audit exceptions
- Release hygiene checks

## Required controls

### Lockfiles

- `package-lock.json` and `backend/package-lock.json` must be committed.
- CI must use `npm ci` or equivalent frozen-lock install.
- Lockfile changes must be reviewed as code changes, not ignored as noise.

### Dependency audit

Required commands:

```bash
npm run security:audit
npm --prefix backend audit --audit-level=high
```

Acceptance:

- No high/critical vulnerabilities without documented exception.
- Any exception must include package, advisory, affected path, exploitability assessment, mitigation, owner, and expiry date.

### Secret scanning

Required command:

```bash
npm run security:secrets
```

Acceptance:

- Secret scan passes in CI.
- Any false positive must be documented and narrowly allowlisted.
- No real secret may be committed, even in examples.

### GitHub Actions permissions

Required policy:

- Default workflow permissions should be minimal.
- Production-oriented workflows must use `permissions: contents: read` unless a job requires more.
- No workflow should expose secrets to untrusted PRs.
- Deployment workflows, if added later, must use protected environments.

Current status:

- `production-checks.yml` sets `permissions: contents: read`.
- `ci.yml` and `production-candidate.yml` still need explicit permission review.

### Third-party GitHub Actions

Required policy:

- Prefer official actions where possible.
- Pinning by major version is acceptable for routine checks, but security-sensitive workflows should be reviewed for SHA pinning before production.
- Any non-official action must be justified.

Currently observed actions requiring review:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/cache@v5`

### Docker build

Required policy:

- Dockerfile must not copy `.env`, secrets, local uploads, cache directories, or test artifacts into runtime images.
- Runtime image must not require dev dependencies unless explicitly justified.
- Docker build must be covered by CI before production.

Current status:

- Production workflows build `Dockerfile.backend`.
- Dockerfile contents still need focused audit.

### Generated code and migrations

Required policy:

- Prisma validate/generate must run in CI.
- Production candidate gates must use migration deploy checks.
- Destructive migration risk must be reviewed before production.

Current status:

- CI workflows run Prisma validate/generate/migrate checks.
- Migration safety documentation still needs final proof in `docs/MIGRATION_SAFETY_CHECKLIST.md`.

## Dependency exception template

Use this format for any high/critical dependency exception:

```text
Package:
Advisory:
Severity:
Affected path:
Runtime reachable? yes/no
Exploit preconditions:
Current mitigation:
Upgrade/remediation plan:
Owner:
Expiry date:
Risk accepted by:
```

## Fail conditions

`SEC-GATE` fails if:

- Secret scan fails.
- High/critical dependency audit issue exists without documented exception.
- CI workflows expose secrets to untrusted PR contexts.
- Production workflows require broad permissions without justification.
- Docker runtime image includes secrets or local data.
- Lockfiles are missing or bypassed.

## Open tasks

1. Record latest CI audit/secret-scan results in `docs/CI_STATUS.md`.
2. Review `ci.yml` and `production-candidate.yml` permissions explicitly.
3. Audit `Dockerfile.backend` and `.dockerignore`.
4. Create dependency exception entries if audits fail.
5. Add explicit protected-environment rules if deployment workflows are added.

## Current acceptance status

In progress. Controls are defined, but live evidence and Docker/workflow permission review are still required.
