# 01 — CI Workflow Patch

**Date:** 2026-05-03
**Commit:** 22f32739e03d (main)
**Message:** Add Phase B backend CI gates
**Author:** Ediwow110 (applied via GitHub web editor)

## What was added

Three steps inserted into the `backend` job in `.github/workflows/ci.yml`
after `- run: npm run test` and before the smoke secrets step:

```yaml
- name: Runtime safety unit tests (jest)
  run: npm run test:unit
- name: Production runtime boot check (NODE_ENV=production)
  run: npm run check:runtime:prod
- name: Worker boot smoke (mail + backup workers)
  run: npm run smoke:worker
```

## Why this was deferred

The PAT available in the build environment has only `contents:write` scope.
GitHub blocks workflow-file edits via PATs without the `workflow` scope.
Applied manually via GitHub web editor directly to main.

## CI runs triggered on commit 22f32739e03d

| Workflow | Run ID | Result |
|---|---|---|
| Production Candidate Verification | 25287477841 | success |
| CI | 25287477833 | in_progress at capture time |

CI run: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/25287477833
