# School-Scale Claim Review Checklist

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this checklist before README, product copy, release notes, or stakeholder updates mention school-scale support, 20k-50k registered users, or concurrency capacity.

## Required evidence before wording review

- [ ] `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` has passing tier evidence for the claimed registered-user level.
- [ ] `docs/LOAD_TEST_RESULTS.md` has passing runtime evidence for the claimed concurrency level.
- [ ] `docs/CI_STATUS.md` has latest CI/build/security evidence.
- [ ] `docs/PERFORMANCE_ACCEPTANCE_GATE.md` has no unresolved blocker for active high-volume paths.
- [ ] `docs/CAPACITY_CLAIM_WORDING_GUIDE.md` wording is followed.
- [ ] `npm run check:capacity-claims` passes.
- [ ] `npm run check:release-hygiene` passes.

## Claim review questions

1. Is the claim about registered users or concurrent users?
2. Is the exact tier named?
3. Is the test environment named?
4. Is the dataset tier named?
5. Is the workflow/result URL recorded?
6. Are exclusions stated?
7. Are unresolved warnings or risk acceptances disclosed?
8. Is the claim still true after latest code changes?

## Forbidden approvals

Do not approve a claim if:

- it says 20k/50k support but only 1k validation passed,
- it says 1000 concurrent users but only smoke/300 VU passed,
- it says production-ready but CI/security/build evidence is missing,
- it hides query-plan warnings,
- it uses production data as test evidence,
- it omits environment and dataset assumptions.

## Reviewer sign-off

```text
Claim text:
Reviewer:
Date:
Commit SHA:
Registered-user evidence: yes/no/not applicable
Concurrency evidence: yes/no/not applicable
CI/security evidence: yes/no
Operational evidence: yes/no
Approved wording: yes/no
Required edits:
```
