# Phase 5 — Group state machine

## States
- Pending
- Active
- Locked

## Rules
- create group -> Pending
- valid join by code on Pending -> Active
- locked group rejects join
- full group rejects join
- duplicate same-subject membership is blocked

## Remaining work
- explicit leader reassignment flow not yet implemented
- admin approve/lock/unlock runtime QA still pending
