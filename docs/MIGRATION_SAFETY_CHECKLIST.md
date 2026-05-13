# Migration Safety Checklist

**Branch**: `2nd-main`

## Pre-Migration Checklist

Before running `npx prisma migrate deploy` in production:

- [ ] Create database backup
- [ ] Review generated migration SQL (`npx prisma migrate diff`)
- [ ] Test the migration on a staging environment or production data copy
- [ ] Ensure a rollback plan exists (down migration or manual script)
- [ ] Check for long-running operations or locks
- [ ] Notify the team
- [ ] Schedule during low-traffic window if high risk

## Post-Migration
- [ ] Verify application health checks pass
- [ ] Run smoke tests
- [ ] Monitor error rates and performance
- [ ] Document any issues
