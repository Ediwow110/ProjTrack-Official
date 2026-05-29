# Frontend Performance Report

Generated: 2026-05-29

## Current status

Not production-complete. Bundle-budget tooling is implemented, but deployed Lighthouse/Web Vitals evidence is still missing.

## Implemented guardrail

Run after a production build:

```bash
npm run build
npm run check:bundle-budget
```

Default gzip budgets:

- Largest JS chunk: 500 KB
- Other JS route chunks: 300 KB
- CSS asset: 180 KB

These defaults are guardrails, not final performance approval. Tighten them after measuring the real deployed app.

## Evidence still required

Run Lighthouse mobile against the deployed production build and record:

- Performance score
- Total Blocking Time
- Largest Contentful Paint
- Cumulative Layout Shift
- Interaction to Next Paint, if available

## Go/no-go rule

Do not call the frontend mobile production-ready until Lighthouse/Web Vitals are captured from the deployed app and P0/P1 performance issues are fixed or formally waived.
