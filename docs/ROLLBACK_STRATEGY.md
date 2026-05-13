# Rollback Strategy

**Branch**: `2nd-main`

## Code Rollback
1. Revert the commit on `2nd-main`
2. Push the revert
3. Redeploy the previous stable version

## Database Rollback
- Prisma keeps migration history
- Revert to previous migration if possible
- Have tested manual rollback scripts ready
- **Never** delete migration files from git

## File Storage Rollback
- Use versioning in S3/MinIO when possible
- Keep recent backups of uploaded files

## Communication
- Announce rollback in team channels immediately
- Update any status pages
- Document the incident in INCIDENT_RESPONSE.md
