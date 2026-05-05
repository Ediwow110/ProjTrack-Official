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
| `360x800` | Pass via `npm run e2e:responsive` | Blocked | Blocked | Blocked | Authenticated QA needs admin smoke env plus generated teacher/student fixture credentials from `npm run seed:smoke`. |
| `390x844` | Pass via `npm run e2e:responsive` | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | `npm run e2e:responsive:auth` passed 9/9 on pushed commit `9e46249`, but not rerun in this shell. |
| `430x932` | Pass via `npm run e2e:responsive` | Blocked | Blocked | Blocked | Authenticated QA needs admin smoke env plus generated teacher/student fixture credentials from `npm run seed:smoke`. |
| `768x1024` | Pass via `npm run e2e:responsive` | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | `npm run e2e:responsive:auth` passed 9/9 on pushed commit `9e46249`, but not rerun in this shell. |
| `1024x768` | Pass via `npm run e2e:responsive` | Blocked | Blocked | Blocked | Authenticated QA needs admin smoke env plus generated teacher/student fixture credentials from `npm run seed:smoke`. |
| `1366x768` | Pass via `npm run e2e:responsive` | Blocked | Blocked | Blocked | Authenticated QA needs admin smoke env plus generated teacher/student fixture credentials from `npm run seed:smoke`. |
| `1440x900` | Pass via `npm run e2e:responsive` | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | Historical Pass on dashboard shell; current rerun blocked | `npm run e2e:responsive:auth` passed 9/9 on pushed commit `9e46249`, but not rerun in this shell. |
| `1920x1080` | Pass via `npm run e2e:responsive` | Blocked | Blocked | Blocked | Authenticated QA needs admin smoke env plus generated teacher/student fixture credentials from `npm run seed:smoke`. |

## 11. Known Remaining Issues

- Authenticated route QA requires a working backend plus admin smoke env and generated teacher/student credentials in the current shell.
- Earlier evidence shows authenticated dashboard shells passed at `390x844`, `768x1024`, and `1440x900`, but that was not rerun after the latest admin Sections fix because the credentials were unavailable locally.
- Manual visual review is still required for every role dashboard and for the admin Sections drilldown after the nested-button fix.
- Responsive approval is not enough for production readiness while smoke, CI, backup restore, monitoring, and signoff remain incomplete.

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
