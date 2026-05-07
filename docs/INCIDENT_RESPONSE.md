# Incident Response

Use this during production incidents. Keep the tone factual and preserve evidence.

## Severity

- `SEV1`: data loss, active security incident, total outage, or widespread login failure.
- `SEV2`: major workflow unavailable for one role or degraded production health.
- `SEV3`: partial degradation with workaround.
- `SEV4`: low-risk issue or documentation-only incident.

## First 15 Minutes

- Assign incident commander.
- Open an incident notes document.
- Record start time, affected systems, and first symptom.
- Confirm whether data integrity, authentication, uploads, mail, or backups are affected.
- Decide whether to pause deploys.
- If security-sensitive, restrict details to approved responders.

## Stabilize

- Check `/health/live`, `/health/ready`, database health, mail worker health, backup health, and recent deploys.
- Roll back if the latest release is the likely cause and rollback is safer than forward-fix.
- Preserve logs and command output.
- Communicate user impact and next update time.

## Closeout

- Record root cause.
- Record user impact window.
- Record corrective actions.
- Create follow-up issues.
- Update runbooks or tests if the incident exposed a missing control.
