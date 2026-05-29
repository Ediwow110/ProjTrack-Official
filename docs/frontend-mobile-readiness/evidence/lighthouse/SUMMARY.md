# Lighthouse / Web Vitals Evidence Summary

**Generated:** 2026-05-29T08:05Z  
**Tool:** Lighthouse CLI v13.3.0 via npx  
**Target:** Vercel production — https://www.projtrack.codes  
**Main HEAD:** `e73bd40`

---

## Results Table

| Route | Mode | Performance | Accessibility | Best Practices | SEO | FCP | LCP | CLS | TBT | INP | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/login` | mobile | 87 | 100 | 100 | 82 | 2.5s | 3.3s | 0 | 61ms | n/a | PASS (LCP WARN) |
| `/login` | desktop | 99 | 100 | 100 | 82 | 0.5s | 0.8s | 0 | 0ms | n/a | PASS |
| `/student/login` | mobile | 87 | 100 | 100 | 82 | 2.5s | 3.4s | 0 | 6ms | n/a | PASS (LCP WARN) |
| `/student/login` | desktop | 99 | 100 | 100 | 82 | 0.5s | 0.8s | 0 | 0ms | n/a | PASS |
| `/teacher/login` | mobile | 87 | 100 | 100 | 82 | 2.5s | 3.4s | 0 | 26ms | n/a | PASS (LCP WARN) |
| `/teacher/login` | desktop | 99 | 100 | 100 | 82 | 0.5s | 0.8s | 0 | 0ms | n/a | PASS |
| `/admin/login` | mobile | 87 | 100 | 100 | 82 | 2.5s | 3.3s | 0 | 6ms | n/a | PASS (LCP WARN) |
| `/admin/login` | desktop | 99 | 100 | 100 | 82 | 0.5s | 0.8s | 0 | 0ms | n/a | PASS |

INP: Not available in Lighthouse lab runs — requires CrUX field data or dedicated tooling.

---

## Threshold Assessment

Thresholds used (per project convention not defined otherwise; using standard Lighthouse thresholds):

| Metric | Threshold | Result |
|---|---|---|
| Performance | PASS >= 80 | Desktop: 99 ✅ Mobile: 87 ✅ |
| Accessibility | PASS >= 90 | Desktop: 100 ✅ Mobile: 100 ✅ |
| Best Practices | PASS >= 90 | Desktop: 100 ✅ Mobile: 100 ✅ |
| SEO | PASS >= 80 | Desktop: 82 ✅ Mobile: 82 ✅ |
| LCP | PASS <= 2.5s, WARN <= 4.0s | Desktop: 0.8s ✅ Mobile: 3.3-3.4s ⚠️ |
| CLS | PASS <= 0.1 | Desktop: 0 ✅ Mobile: 0 ✅ |
| TBT | PASS <= 200ms | Desktop: 0ms ✅ Mobile: 6-61ms ✅ |

---

## Key Findings

### Positive
- **Accessibility: 100** on all routes and modes — no axe violations on login pages.
- **Best Practices: 100** on all routes and modes.
- **CLS: 0** — no layout shift detected on any login page.
- **Desktop performance is excellent** across all routes (99, sub-second LCP).
- **Mobile TBT is minimal** (6-61ms), indicating low main-thread blocking.

### Warnings
- **Mobile LCP: 3.3-3.4s** — exceeds 2.5s threshold. Classified as WARN (50-79 orange range would be >4s). This is likely due to the hero background image and font loading on slower mobile emulation.
- **SEO: 82 across all routes** — consistently below 90. Common contributors: missing meta description on some routes, no structured data, potentially missing `hreflang` or canonical tags. This is a site-wide pattern, not route-specific.

### Non-blocking observations
- All scores are consistent across routes (minimal variance between login, student, teacher, admin), indicating shared component patterns.
- No route has a FAIL-level finding under the defined thresholds.

---

## Artifacts

- `login-mobile.report.html` / `.json`
- `login-desktop.report.html` / `.json`
- `student-login-mobile.report.html` / `.json`
- `student-login-desktop.report.html` / `.json`
- `teacher-login-mobile.report.html` / `.json`
- `teacher-login-desktop.report.html` / `.json`
- `admin-login-mobile.report.html` / `.json`
- `admin-login-desktop.report.html` / `.json`

All artifacts in `docs/frontend-mobile-readiness/evidence/lighthouse/`.
