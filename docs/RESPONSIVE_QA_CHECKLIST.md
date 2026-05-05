# Responsive QA Checklist

## 1. Purpose

Use this checklist to verify ProjTrack is usable across mobile, tablet, and desktop before marking responsive work ready for merge.

## 2. Scope

- Public auth/login pages.
- Student, teacher, and admin portal shells.
- Role dashboards and list/detail pages.
- Shared cards, forms, tables, modals, navigation, buttons, loading states, empty states, and error states.

## 3. Screen Sizes To Test

- `360x800`
- `390x844`
- `430x932`
- `768x1024`
- `1024x768`
- `1366x768`
- `1440x900`
- `1920x1080`

## 4. Auth/Login Checklist

- No body-level or page-level horizontal overflow.
- Login page has no entrance animation.
- Login page has no decorative background motion.
- Login form is visible and immediately usable.
- Inputs fit viewport and support autofill/password managers.
- Submit loading state still works.
- Validation and rate-limit messages wrap safely.
- Mobile keyboard does not make login impossible.
- Focus states are visible.
- Touch targets are practical on mobile.

## 5. Student Pages Checklist

- Dashboard cards stack on mobile.
- Due work, submitted work, group status, and feedback remain readable.
- My Submissions tables/lists are contained.
- Calendar content does not overflow.
- Activity/submission detail pages wrap filenames, URLs, and comments.

## 6. Teacher Pages Checklist

- Dashboard cards and charts stack or reflow cleanly.
- Students and submissions tables scroll inside their panels only.
- Subject view actions wrap on mobile.
- Submission review forms fit viewport.
- Long student names, emails, and filenames wrap safely.

## 7. Admin Pages Checklist

- Dashboard metrics and operations panels reflow cleanly.
- System tools action rows wrap.
- Mail jobs table remains locally scrollable.
- Backups and restore dialogs fit viewport.
- Reports and calendar content do not cause body overflow.
- Groups, notifications, profile, student view, teacher view, and subject view remain usable.

## 8. Shared Components Checklist

- Navigation usable at all target widths.
- Sidebar/header stable.
- Cards stack on mobile.
- Forms fit viewport.
- Buttons remain visible and stack/wrap when needed.
- Tables are contained inside local horizontal scroll regions.
- Modals fit viewport, scroll vertically, and keep close/action controls reachable.
- Text wraps safely, including emails, filenames, IDs, and URLs.
- Empty/loading/error states are readable.
- Accessibility focus states are preserved.

## 9. Login Animation Removal Checklist

- No framer-motion entrance wrappers on auth shell/card/form.
- No animated decorative auth background.
- No floating, pulsing, bouncing, or rotating decorative effects.
- No staggered auth content entrance.
- No layout shift before the form becomes interactive.
- Submit loading state preserved.

## 10. Manual QA Matrix

| Size | Auth | Student | Teacher | Admin | Notes |
| --- | --- | --- | --- | --- | --- |
| `360x800` | Pending | Pending | Pending | Pending | Verify mobile keyboard and no horizontal overflow. |
| `390x844` | Pending | Pending | Pending | Pending | Verify common phone viewport. |
| `430x932` | Pending | Pending | Pending | Pending | Verify large phone viewport. |
| `768x1024` | Pending | Pending | Pending | Pending | Verify portrait tablet. |
| `1024x768` | Pending | Pending | Pending | Pending | Verify landscape tablet. |
| `1366x768` | Pending | Pending | Pending | Pending | Verify compact desktop. |
| `1440x900` | Pending | Pending | Pending | Pending | Verify standard desktop. |
| `1920x1080` | Pending | Pending | Pending | Pending | Verify wide desktop. |

## 11. Known Remaining Issues

- Authenticated route QA requires a working backend and seeded or real test accounts.
- E2E smoke remains blocked locally if PostgreSQL is not reachable at `localhost:5432`.
- Manual visual review is still required for every role dashboard before production launch.

## 12. Signoff Section

- QA owner:
- Date:
- Browser/device coverage:
- Auth pages approved:
- Student pages approved:
- Teacher pages approved:
- Admin pages approved:
- Remaining blockers:
- Final responsive verdict:
