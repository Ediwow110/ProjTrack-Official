# Real-Device QA Checklist

Issue: #75
Status: NOT PERFORMED — OWNER RISK ACCEPTED

## Physical device matrix

| Device category | Status | Notes |
|---|---|---|
| iPhone portrait | NOT TESTED | Owner accepted limitation |
| iPhone landscape | NOT TESTED | Owner accepted limitation |
| Android phone portrait | NOT TESTED | Owner accepted limitation |
| Android phone landscape | NOT TESTED | Owner accepted limitation |
| Tablet portrait | NOT TESTED | Owner accepted limitation |
| Tablet landscape | NOT TESTED | Owner accepted limitation |

## Route/flow matrix

| Route/flow | Status | Notes |
|---|---|---|
| /login | AUTOMATED/BROWSER VERIFIED | No physical-device claim |
| /student/login | AUTOMATED/BROWSER VERIFIED | No student authenticated dashboard claim |
| /teacher/login | AUTOMATED/BROWSER VERIFIED | No teacher authenticated dashboard claim |
| /admin/login | AUTOMATED/BROWSER VERIFIED | Admin baseline separately verified |
| Admin authenticated dashboard | VERIFIED BY AUTOMATED BASELINE | Physical-device behavior not certified |
| Student authenticated dashboard | NOT CERTIFIED | No stable student smoke secrets |
| Teacher authenticated dashboard | NOT CERTIFIED | No stable teacher smoke secrets |
| Mobile drawer/menu | AUTOMATED GUARDRAILS ONLY | No physical-device claim |
| Tables/data cards | AUTOMATED GUARDRAILS ONLY | No physical-device claim |
| Forms/input fields | AUTOMATED GUARDRAILS ONLY | No physical-device claim |

## Final assessment

No critical physical-device blockers were found because no physical-device QA was performed.

This file records an accepted limitation, not a physical-device PASS.
