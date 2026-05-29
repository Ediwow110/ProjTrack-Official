# Real-Device QA Evidence — Accepted Limitation

Issue: #75
Production frontend: https://www.projtrack.codes
API: https://api.projtrack.codes

## Status

Real-device QA: NOT PERFORMED — OWNER RISK ACCEPTED

No physical iPhone, Android phone, or tablet testing was performed for this evidence set.

The project owner explicitly accepts the real-device QA gap for #75.

## Completed evidence already available

- Production system: complete
- Login redesign: complete and live
- Mobile guardrails: merged and live
- Lighthouse/Web Vitals: PASS
- Admin authenticated production baseline: PASS
- Public login routes: verified through automated/browser-based evidence
- Vercel production: live

## Accepted limitations

The project owner accepts these limitations:

1. Real-device QA was not performed.
2. Student authenticated production dashboard baseline is not certified.
3. Teacher authenticated production dashboard baseline is not certified.
4. Student/teacher public login routes/connectivity are verified only.
5. Physical iPhone behavior is not certified.
6. Physical Android behavior is not certified.
7. Physical tablet behavior is not certified.
8. Untested devices, browsers, orientations, and authenticated role flows are outside the claim.

## Claim boundary

Certified within this issue:

- Vercel production public login routes under automated/browser-based checks.
- Lighthouse/Web Vitals public login-route evidence.
- Admin authenticated production baseline.
- Automated responsive/mobile guardrails.

Not certified within this issue:

- Physical iPhone behavior.
- Physical Android behavior.
- Physical tablet behavior.
- Student authenticated production dashboard baseline.
- Teacher authenticated production dashboard baseline.
- Untested real devices, browsers, orientations, and authenticated role flows.

## Final wording

Mobile readiness is complete with accepted limitations for the automated/Vercel/admin-baseline evidence scope.

This is not a claim of universal real-device mobile production readiness.
