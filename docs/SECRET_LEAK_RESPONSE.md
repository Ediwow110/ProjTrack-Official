# Secret Leak Response

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This runbook defines the required response when any credential, token, signing key, API key, database URL, storage credential, webhook secret, smoke credential, or deployment credential is suspected to be exposed.

## Severity

Treat every suspected real secret exposure as a security incident until proven otherwise.

## Immediate response checklist

1. Preserve evidence.
   - Record where the value was found.
   - Record commit SHA, workflow run, log URL, issue, screenshot, or artifact path.
   - Do not paste the exposed value into new tickets, docs, or chat.

2. Stop further exposure.
   - Remove the value from public/internal surfaces where possible.
   - Disable affected workflow/artifact/log access if needed.
   - Prevent further deployments from the contaminated branch if production credentials may be affected.

3. Revoke or rotate.
   - Rotate the affected credential at the provider.
   - Revoke the old value, not just replace it in configuration.
   - For token-signing material, follow the token/key rotation plan and invalidate affected sessions where required.
   - For database/storage/mail/provider credentials, verify the old credential no longer works.

4. Remediate repository history.
   - Remove the secret from current files.
   - If the repo was exposed outside trusted boundaries, rewrite history or follow GitHub secret-removal procedures as appropriate.
   - Keep a clean audit record without storing the secret value.

5. Validate.
   - Run secret scan.
   - Run backend security tests.
   - Run relevant smoke checks.
   - Confirm deployment/runtime configuration uses only the new value.

6. Document closure.
   - Record the secret category, exposure location, rotation time, revocation proof, validation commands, owner, and follow-up controls.

## Required validation commands

```bash
npm run security:secrets
npm --prefix backend run test:security
npm --prefix backend run build
```

Run additional provider-specific smoke tests where relevant.

## Exposure categories

| Category | Minimum response |
|---|---|
| Database credential | Rotate database user credential; verify old credential rejected; review database access logs if available |
| Token-signing material | Rotate signing material; invalidate affected sessions/tokens according to blast radius |
| Account-action encryption material | Rotate material; invalidate outstanding reset/activation tokens where applicable |
| Mail-provider credential | Rotate provider key; check delivery logs for abuse |
| Object-storage credential | Rotate storage credential; review bucket/object access logs where available |
| Webhook verification material | Rotate signing material; reject old signatures after cutover |
| Smoke/test credential | Rotate test account credential; ensure it is not reused by humans |
| Deployment credential | Rotate provider credential; review deployment/audit logs |

## Incident record template

```text
Incident ID:
Date detected:
Detected by:
Secret category:
Exposure location:
Affected environment:
First known exposure time:
Last known exposure time:
Revoked/rotated at:
Validated by:
Validation commands:
Blast-radius assessment:
Customer/user data exposure suspected? yes/no/unknown
Follow-up actions:
Owner:
Closure date:
```

## Fail conditions

`SEC-GATE` fails if:

- Any known real secret remains committed.
- A leaked credential is replaced but not revoked.
- Secret scan fails without documented exception.
- Rotation evidence is missing.
- Incident records include raw secret values.

## Current blockers

1. Real owner assignments for incident response are not recorded.
2. Provider-specific revocation commands are not documented.
3. Token/session invalidation behavior after signing-material rotation still needs proof.
