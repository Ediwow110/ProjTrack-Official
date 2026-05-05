# GitHub Actions Smoke Secrets

## 1. Purpose

This repository uses real Playwright smoke tests in GitHub Actions. The smoke gate must authenticate as admin, teacher, and student users, but only the admin credentials are stored as repository secrets.

Teacher and student smoke accounts are provisioned during `npm run seed:smoke`. If admin secrets are missing or fixture creation fails, CI must fail loudly rather than produce false-green smoke.

## 2. Required secrets

Add these repository secrets:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`

Teacher and student repository secrets are not required.

## 3. Where to add them

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Open `Secrets and variables`.
4. Open `Actions`.
5. Click `New repository secret`.
6. Add each missing admin `SMOKE_*` secret by name.

## 4. Safe value guidance

- Use a test-only or staging-only admin smoke account.
- Do not use a production admin account.
- Do not commit these values anywhere in the repository.
- Do not paste these values into workflow YAML.
- Store the password only in GitHub Actions secrets.

Safe identifier placeholder:

- `SMOKE_ADMIN_IDENTIFIER=admin.smoke@example.test`

For passwords:

- Use a strong test-only password stored only as a GitHub secret.

## 5. Teacher/student credential handling

- `npm run seed:smoke` creates or reuses the teacher and student smoke accounts.
- Generated teacher/student credentials are written to `.tmp/smoke-credentials.json`.
- That file is ephemeral, ignored by git, and consumed only inside the same local or CI run.
- Passwords are never printed in logs.

Optional local overrides for debugging still exist:

- `SMOKE_TEACHER_IDENTIFIER`
- `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_IDENTIFIER`
- `SMOKE_STUDENT_PASSWORD`

These overrides are optional local inputs, not required GitHub repository secrets.

## 6. How CI uses them

These secrets are consumed by the real browser smoke gate:

- `.github/workflows/ci.yml` -> `e2e` job
- `.github/workflows/production-checks.yml` -> `smoke` job

Those jobs run:

1. `npm run check:smoke-env`
2. `npm run seed:smoke`
3. `npm run e2e:smoke`
4. `npm run e2e:responsive:auth`

If admin secrets are missing, `check:smoke-env` exits nonzero before smoke can skip.
If teacher/student fixture creation fails, `seed:smoke` exits nonzero and the job fails.

## 7. How to rerun failed jobs

After adding or correcting the admin smoke secrets:

1. Open `Actions`.
2. Open the failed `CI` run.
3. Click `Re-run jobs` or `Re-run all jobs`.
4. Open the failed `Production Checks` run.
5. Click `Re-run jobs` or `Re-run all jobs`.

## 8. How to verify CI is real-green

Treat CI as real-green only when all of the following are true:

- `check:smoke-env` passes
- `seed:smoke` passes
- `e2e:smoke` passes
- `e2e:responsive:auth` passes
- workflow logs show real tests executed, not skipped

## 9. Troubleshooting missing secrets

If CI fails with missing `SMOKE_*` variables:

- compare the missing names in the log with the two required admin names above
- add the missing repository secrets exactly as named
- rerun the failed workflow

If CI fails during `seed:smoke`, inspect the fixture-seeding logs. That means teacher/student account creation or reuse failed, which is a real smoke blocker.

If `npm run e2e:responsive` passes while smoke fails, that is expected. Public auth-page responsive QA does not require smoke credentials.

## 10. Production credential warning

Never use production credentials for smoke.

Use a dedicated test or staging admin account plus generated teacher/student fixture accounts that are safe to rotate and safe to reseed.
