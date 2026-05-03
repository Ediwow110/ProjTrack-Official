# 05 — Backup / Restore Drill

**Date:** 2026-05-03
**Operator:** Ediwow110
**Source:** DO Managed PostgreSQL 18.3 — projtrack_staging database
**Target:** projtrack_drill_target (disposable, same cluster)
**Result:** PASS — EXIT=0

## Guard checks passed

```
BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND  ✓
TARGET URL contains keyword "drill"               ✓
SOURCE URL does not match any prod pattern        ✓
```

## Dump output

```
pg_dump binary: /usr/lib/postgresql/18/bin/pg_dump
dump size:      79581 bytes
```

## Restore

```
psql --single-transaction -v ON_ERROR_STOP=1  →  success
```

## Table verification

`BACKUP_DRILL_ALLOW_EMPTY=true` (staging DB seeded with smoke-admin only;
tables are structurally present but data volume is minimal).

Tables verified present: User, StudentProfile, TeacherProfile, Submission,
SubjectSection, EmailJob, BackupRun.

## Final line

```
backup-restore-drill PASSED
```

## Post-drill cleanup

Disposable database `projtrack_drill_target` dropped after drill completed.
