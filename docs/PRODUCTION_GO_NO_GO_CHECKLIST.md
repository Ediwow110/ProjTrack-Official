# Production Go/No-Go Checklist

Check each item with evidence, not assumption.

## Build and CI

- [ ] CI green
- [ ] Local checks green
- [ ] Docker build green
- [ ] Docker boot green
- [ ] Staging Postgres reachable
- [ ] Prisma migrate deploy passed

## Health and Runtime

- [ ] `/health/live` passed
- [ ] `/health/api-ready` passed
- [ ] `/health/ready` passed
- [ ] Worker running
- [ ] Mail worker heartbeat fresh
- [ ] Backup worker configured and running

## Frontend and Auth

- [ ] Frontend loads
- [ ] Login works
- [ ] Refresh works
- [ ] Logout works
- [ ] RBAC works
- [ ] Mobile login layout verified
- [ ] Tablet layout verified
- [ ] Desktop layout verified

## File Flow

- [ ] File upload works
- [ ] File metadata works
- [ ] File download works
- [ ] File delete works
- [ ] Invalid file rejection works
- [ ] Oversized file rejection works
- [ ] S3 verified
- [ ] ClamAV verified

## Mail, Backup, Monitoring

- [ ] Mailrelay verified
- [ ] Backup runs
- [ ] Restore drill passed
- [ ] Monitoring receives logs/errors
- [ ] Rollback tested

## Environment and Secrets

- [ ] Secrets rotated
- [ ] Production env validated
- [ ] `DATABASE_URL` is production database
- [ ] JWT secrets are long, random, and distinct
- [ ] Refresh cookie name is `__Secure-` or `__Host-` prefixed
- [ ] Refresh cookie SameSite is `lax` or `strict`
- [ ] CORS origins are HTTPS production origins only
- [ ] S3 bucket is private
- [ ] Rate-limit backend is not memory-only
- [ ] Malware scanning is fail-closed

## Decision

- [ ] GO
- [ ] NO-GO

Decision owner:

Timestamp:

Evidence location:

