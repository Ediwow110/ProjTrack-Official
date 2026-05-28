# Backend Build and Security Evidence Template

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this template after backend build, test, secret scan, dependency audit, or CI runs.

## Commands

```bash
npm --prefix backend run build
npm --prefix backend run test:security
npm run security:secrets
npm run security:audit
npm run check:release-hygiene
npm run check:capacity-claims
```

## Evidence template

```text
Date:
Commit SHA:
Environment:
Command:
Workflow run URL:
Passed: yes/no
Duration:
Output summary:
Failed test/file/step:
Security finding:
Dependency finding:
Required fix:
Owner:
Follow-up:
```

## Required recording locations

- `docs/CI_STATUS.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## Pass criteria

- Backend build passes.
- Security tests pass.
- Secret scan passes.
- Dependency audit has no unresolved high/critical issue.
- Release hygiene passes.
- Capacity claim checker passes.

## Fail handling

If any command fails:

1. Record the exact command and failing output summary.
2. Do not mark the gate passed.
3. Fix the blocker or document explicit risk acceptance.
4. Rerun the command.
5. Record the passing rerun.
