# Pull Request Checklist

## Scope

Target branch:

- [ ] `2nd-main`
- [ ] `main`
- [ ] Other: <!-- explain -->

Summary:

<!-- What changed and why? -->

## Final gate impact

- [ ] I reviewed `docs/FINAL_MERGE_GATE.md`.
- [ ] This PR does not mark a blocked gate as passed without recorded evidence.
- [ ] This PR updates evidence docs if it changes gate status.
- [ ] This PR does not bypass issues #37, #38, #39, #40, #41, or #42.

## Evidence issues

Check any evidence issue affected by this PR:

- [ ] #37 release guard / capacity claim / release hygiene evidence
- [ ] #38 backend build / security / unit / scan / audit evidence
- [ ] #39 school-scale validation tier `1k`
- [ ] #40 load validation smoke
- [ ] #41 production-check failure visibility
- [ ] #42 school-scale validation tiers `20k` / `50k`
- [ ] Not applicable

Evidence links or notes:

<!-- Workflow URLs, artifact names, command summaries, issue comments, or why not applicable. -->

## Capacity and readiness claims

- [ ] This PR does not add unsupported production-readiness, school-scale, 20k-50k, or concurrency claims.
- [ ] If this PR changes public/product wording, `npm run check:capacity-claims` passes.
- [ ] If this PR changes release hygiene, `npm run check:release-hygiene` passes.
- [ ] If this PR changes claim wording, `docs/CAPACITY_CLAIM_WORDING_GUIDE.md` was followed.

## Security and tests

Check what was run or why it was not run:

- [ ] `npm run evidence:local`
- [ ] `npm run check:release-hygiene`
- [ ] `npm run check:capacity-claims`
- [ ] `npm --prefix backend run build`
- [ ] `npm --prefix backend run test:security`
- [ ] `npm --prefix backend run test:unit`
- [ ] GitHub Actions `Evidence Gates`
- [ ] GitHub Actions `School Scale Validation`
- [ ] GitHub Actions `Load Validation`
- [ ] Not run; reason:

## Scale-sensitive code review

Required if this PR touches backend list, export, dashboard, report, search, notification, file, auth, subject, group, or webhook paths.

- [ ] Backend query is bounded or documented as small-cardinality.
- [ ] Owner/scope authorization is preserved.
- [ ] Pagination/sort/filter inputs are capped and allowlisted.
- [ ] Expensive routes are rate-limited, queued, capped, or explicitly risk-accepted.
- [ ] Export behavior preserves the current cap or follows `docs/ADR_EXPORT_STRATEGY.md`.
- [ ] Static bounded-submission guard remains valid.
- [ ] Not applicable.

## Reviewer hard stop

Do not approve merge into `main` if:

- final gate evidence is missing,
- security/build evidence is missing,
- a 20k/50k claim appears without matching validation evidence,
- a concurrency claim appears without matching load evidence,
- production-readiness is claimed without CI/security/ops evidence,
- blocked issues #37-#42 are ignored.
