# Incident Response

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This runbook defines how ProjTrack handles suspected security, availability, data-integrity, and operational incidents before the project can claim production readiness.

## Incident triggers

Treat the following as incidents until triaged:

- Suspected account takeover
- Unauthorized access to student, teacher, admin, submission, file, or backup data
- Secret, token, provider credential, database credential, or storage credential exposure
- Admin-only route reached by non-admin user
- Student accessing another student's private data
- Teacher accessing unrelated class, section, subject, submission, group, or file data
- Public endpoint exposing secrets or internal configuration
- Malicious or unsafe file upload bypass
- Webhook spoofing or replay
- Production configuration running with unsafe local or development settings
- Critical or high vulnerability discovered in reachable runtime dependency
- Data loss, failed migrations, backup failure, or restore failure
- Total outage or widespread login failure

## Severity

| Severity | Criteria | Required response |
|---|---|---|
| SEV1 | Active compromise, broad private-data exposure, real secret exposure, data loss, total outage, admin bypass, production RCE/data destruction risk | Stop release/merge; rotate/revoke where needed; owner response required |
| SEV2 | Exploitable authz bypass, sensitive endpoint exposure, unsafe file/storage path, major workflow unavailable, high dependency issue | Block merge/release until fixed or risk accepted |
| SEV3 | Limited-scope exposure, suspicious behavior, partial degradation with workaround, missing control evidence | Assign owner and due date |
| SEV4 | Hardening/documentation/monitoring gap | Track in backlog |

## First-hour checklist

1. Assign incident owner.
2. Preserve evidence without copying raw secrets.
3. Identify affected environment.
4. Determine whether user data, credentials, files, backups, or admin actions are involved.
5. Stop ongoing exposure.
6. Rotate/revoke exposed credentials if applicable.
7. Disable or gate affected feature if exploitation is plausible.
8. Record timeline.
9. Define validation commands.
10. Decide whether release/merge remains blocked.

## Evidence to collect

- Commit SHA or deployment version
- Workflow run or deployment event
- Request IDs and timestamps
- Affected route/controller/service
- Actor user ID or role, where safe to record
- IP/user-agent metadata, where available
- Audit log entries
- Relevant provider logs
- Validation command output
- Remediation PR/commit

Do not paste raw secrets into incident records.

## Containment actions

| Scenario | Minimum containment |
|---|---|
| Secret leak | Follow `docs/SECRET_LEAK_RESPONSE.md`; rotate and revoke affected credential |
| Authorization bypass | Disable affected route/feature or deploy fix; add regression test |
| File disclosure | Disable signing/download path if needed; add ownership test; review access logs |
| Webhook spoofing | Disable webhook endpoint or reject unsigned traffic; rotate verification material |
| Unsafe production config | Roll back config; run runtime safety checks; block release |
| Dependency exploit | Patch/upgrade or disable affected path; document exception only if non-reachable |
| Data loss or migration failure | Stop writes if needed; preserve database state; follow rollback/restore plan |
| Mail delivery incident | Inspect queue health, provider status, worker heartbeat, and recent failures |
| Backup failure | Preserve backup logs; run validation; verify latest restorable backup |

## Validation commands

Use the relevant subset:

```bash
npm run security:secrets
npm run security:audit
npm --prefix backend audit --audit-level=high
npm --prefix backend run test:security
npm --prefix backend run test:unit
npm --prefix backend run build
```

## Closure requirements

An incident cannot be closed until:

- Root cause is documented.
- Affected credentials are revoked/rotated if applicable.
- Regression test exists for application-level issues.
- Validation commands pass or exceptions are documented.
- Owner confirms mitigation.
- Follow-up tasks are captured with due dates.

## Incident record template

```text
Incident ID:
Severity:
Owner:
Detected at:
Detected by:
Affected environment:
Affected routes/services:
Impact summary:
User data affected? yes/no/unknown
Credentials affected? yes/no/unknown
Containment action:
Remediation commit/PR:
Validation commands:
Residual risk:
Follow-up tasks:
Closure approver:
Closed at:
```

## Current blockers

1. No named incident owner or escalation contact is recorded.
2. No production monitoring/alert destination is recorded.
3. Request ID/log correlation evidence is not complete.
4. Backup/restore incident drills are not recorded.
