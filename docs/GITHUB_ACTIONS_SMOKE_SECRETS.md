# GitHub Actions Smoke Secrets

## 1. Purpose

This repository uses real Playwright smoke tests in GitHub Actions. Those tests must authenticate as admin, teacher, and student users. If any required smoke secret is missing, the smoke gate must fail loudly.

This is intentional. Missing secrets should block CI rather than produce false-green smoke.

## 2. Required secrets

Add all six repository secrets:

- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEACHER_IDENTIFIER`
- `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_IDENTIFIER`
- `SMOKE_STUDENT_PASSWORD`

Admin-only secrets are not enough. Teacher and student credentials are required for `portal-navigation.spec.ts`, `workflow-smoke.spec.ts`, and `authenticated-responsive.spec.ts`.

## 3. Where to add them

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Open `Secrets and variables`.
4. Open `Actions`.
5. Click `New repository secret`.
6. Add each missing `SMOKE_*` secret by name.

## 4. Safe value guidance

- Use test-only or staging-only smoke accounts.
- Do not use production user credentials.
- Do not commit these values anywhere in the repository.
- Do not paste these values into workflow YAML.
- Store strong passwords only in GitHub Actions secrets.

Safe identifier placeholders:

- `SMOKE_TEACHER_IDENTIFIER=teacher.smoke@example.test`
- `SMOKE_STUDENT_IDENTIFIER=student.smoke@example.test`

For passwords:

- Use a strong test-only password stored only as a GitHub secret.

## 5. How CI uses them

These secrets are consumed by the real browser smoke gate:

- `.github/workflows/ci.yml` -> `e2e` job
- `.github/workflows/production-checks.yml` -> `smoke` job

Those jobs run:

1. `npm run check:smoke-env`
2. `npm run seed:smoke`
3. `npm run e2e:smoke`
4. `npm run e2e:responsive:auth`

If any required secret is missing, `check:smoke-env` exits nonzero before smoke can skip.

## 6. How to rerun failed jobs

After adding the missing secrets:

1. Open `Actions`.
2. Open the failed `CI` run.
3. Click `Re-run jobs` or `Re-run all jobs`.
4. Open the failed `Production Checks` run.
5. Click `Re-run jobs` or `Re-run all jobs`.

## 7. How to verify CI is real-green

Treat CI as real-green only when all of the following are true:

- `check:smoke-env` passes
- `seed:smoke` passes
- `e2e:smoke` passes
- `e2e:responsive:auth` passes
- workflow logs show real tests executed, not skipped

## 8. Why admin-only secrets are not enough

The smoke suite covers cross-role flows:

- student login and navigation
- teacher login, subject activity creation, and grading
- admin navigation and configuration flows

Without teacher and student credentials, GitHub Actions cannot produce production-reviewable smoke evidence.

## 9. Troubleshooting missing secrets

If CI fails with missing `SMOKE_*` variables:

- compare the missing names in the log with the six required names above
- add the missing repository secrets exactly as named
- rerun the failed workflow

If `npm run e2e:responsive` passes while smoke fails, that is expected. Public auth-page responsive QA does not require smoke credentials.

## 10. Production credential warning

Never use production credentials for smoke.

Use dedicated test or staging smoke accounts that are safe to rotate, safe to reseed, and safe to expose only through GitHub repository secrets.
