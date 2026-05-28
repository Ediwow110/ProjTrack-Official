# Capacity Claim Wording Guide

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This guide prevents accidental overclaiming about scale, production readiness, or concurrency.

## Golden rule

Claim only what the evidence proves. Everything else must be described as a target, plan, or blocker.

## Approved wording before evidence exists

Use this:

> ProjTrack is being hardened toward 20k-50k registered-user school-scale support. That claim remains blocked until school-scale validation and load-test evidence are recorded.

Use this:

> The project includes workflows and evidence ledgers for validating 1k, 20k, and 50k registered-user tiers, but those tiers are not yet proven.

Use this:

> Active submission list/export paths have been bounded, but overall school-scale readiness still requires validation runs, query-plan evidence, and load-test results.

## Forbidden wording before evidence exists

Do not write:

- Supports 20k users.
- Supports 50k users.
- 50k-user ready.
- School-scale ready.
- Production-ready.
- Handles 1000 concurrent users.
- Scales to 2000 concurrent users.
- Enterprise-grade scalability.
- Proven for 20k-50k users.

## Wording after Tier 1 passes

Allowed only after `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` records a passing Tier `1k` result:

> ProjTrack has passed baseline 1k synthetic registered-user data-volume validation. 20k-50k tiers remain unproven until their workflow results are recorded.

## Wording after Tier 2 passes

Allowed only after Tier `1k` and `20k` both pass:

> ProjTrack has passed 20k synthetic registered-user data-volume validation in the recorded test environment. Runtime concurrency claims still require load-test evidence.

## Wording after Tier 3 passes

Allowed only after Tier `1k`, `20k`, and `50k` pass:

> ProjTrack has passed 50k synthetic registered-user data-volume validation in the recorded test environment. This does not imply 50k concurrent users.

## Wording after load tests pass

Allowed only after `docs/LOAD_TEST_RESULTS.md` records passing load evidence:

> ProjTrack passed a recorded `N` VU load test for the documented dataset tier and target environment.

Never translate VUs into registered-user support without also citing data-volume validation.

## Required qualifiers

Every capacity statement should specify:

- registered users or concurrent users,
- dataset tier,
- environment,
- workflow/result document,
- known exclusions.

## Automated check

Unsupported claims are checked by:

```bash
npm run check:capacity-claims
```

This check is also part of:

```bash
npm run check:release-hygiene
```

## Current approved public summary

> ProjTrack is being hardened toward school-scale 20k-50k registered-user support. The repository now includes bounded high-volume submission paths, school-scale index migration, synthetic data generation, query-plan checks, and validation workflows. The claim remains blocked until validation and load evidence are recorded.
