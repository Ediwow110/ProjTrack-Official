# Security Hardening Backlog

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This backlog consolidates remaining security-hardening work before `2nd-main` can be considered production-ready or school-scale ready.

## Rule

A hardening item is not complete until it has:

- implementation or documented compensating control,
- regression test or explicit risk acceptance,
- evidence recorded in `docs/SECURITY_ACCEPTANCE_GATE.md` or a linked evidence document.

## Remaining hardening areas

| Area | Risk | Status | Required evidence |
|---|---|---|---|
| Rate limits | Brute force, scraping, expensive route abuse | Open | Runtime tests and config evidence |
| Signed URL TTL | Long-lived file access URLs | Open | TTL enforcement test/evidence |
| Malware scanning | Uploads accepted when scanner fails | Open | Fail-closed behavior or accepted local-only exception |
| Pagination/sort/filter | Large scans, sort abuse, filter injection | Open | Allowlist tests and max-page tests |
| Admin reports/exports | Privileged data over-export | Open | Scope, cap, audit, queue/stream decision |
| Notifications | Cross-user notification reads/writes | Open | Owner-scope tests |
| Subject/group scope | Enrollment/group authorization drift | Open | Wrong-student/wrong-teacher tests |
| Webhooks | Replay/duplicate/retry storms | Open | Signature, idempotency, and retry tests |
| File download/signing | Cross-owner file access | Partially reviewed | Owner/scope and TTL tests |
| Health/config endpoints | Secret/config disclosure | Partially reviewed | Redaction tests already exist; keep evidence current |
| Secrets lifecycle | Secret rotation and leak response | Partially documented | Rotation checklist and drill evidence |
| Incident response | No proof responders can execute plan | Open | Tabletop/drill checklist evidence |

## Rate-limit hardening checklist

- [ ] Login route has rate-limit coverage.
- [ ] Password reset/account action routes have rate-limit coverage.
- [ ] File upload routes have rate-limit or size/throughput protections.
- [ ] Export/report routes have rate-limit, cap, queue, or streaming strategy.
- [ ] Runtime tests prove throttling behavior or accepted provider-level control.

## Signed URL TTL checklist

- [ ] Signed URLs have explicit maximum TTL.
- [ ] Expired URLs fail.
- [ ] Wrong-owner requests fail before signing.
- [ ] TTL cannot be overridden by client input.
- [ ] Tests cover TTL and owner scope.

## Malware scan fail-closed checklist

- [ ] Production upload mode fails closed when scanner is unavailable, unless explicitly risk-accepted.
- [ ] Local/dev mode exception is documented.
- [ ] Scanner timeout behavior is bounded.
- [ ] Failed scan does not persist accepted upload metadata as usable.

## Pagination/sort/filter abuse checklist

- [ ] Every list route has backend max page size.
- [ ] Every sort field is allowlisted.
- [ ] Every filter field is allowlisted.
- [ ] Search input is bounded by length.
- [ ] Invalid filters fail safely.

## Admin report/export checklist

- [ ] Admin reports have explicit authorization tests.
- [ ] Exports are capped, queued, or streamed.
- [ ] Exports are audited.
- [ ] Exports do not bypass row-level ownership/scope rules.
- [ ] Large exports do not run synchronously without a cap.

## Notification scope checklist

- [ ] User can only read own notifications unless admin policy explicitly allows otherwise.
- [ ] User can only mark own notifications read.
- [ ] Notification creation paths cannot spoof arbitrary recipients unless privileged.
- [ ] Bulk notification routes are admin-scoped and audited.

## Subject/group scope checklist

- [ ] Student cannot access subjects without enrollment.
- [ ] Student cannot submit as another group.
- [ ] Teacher cannot review submissions outside assigned subjects.
- [ ] Removed group members cannot submit through group membership.
- [ ] Admin overrides are explicit and audited.

## Webhook checklist

- [ ] Webhook signature validation is required.
- [ ] Replay protection/idempotency is enforced.
- [ ] Duplicate events are safe.
- [ ] Provider retries cannot create duplicate side effects.
- [ ] Webhook processing has bounded work and error logging.

## Current blockers

1. `npm --prefix backend run test:security` evidence is not recorded.
2. Several hardening areas have docs/tests planned but not implemented.
3. No production incident drill evidence exists.
4. No current secret scan/dependency audit evidence is recorded.
