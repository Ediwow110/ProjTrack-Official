# Final consolidated checklist

## Hardened in code
- prototype mode requires explicit allow flags on frontend and backend
- auth routes now exist for activate, forgot password, and reset password
- login now has a real forgot-password path and respects protected-route return targets
- student submit requires a real activity id in the shared service path
- admin submission note save is backed by service and repository code
- store submission records now include description, notes, external links, and file relative paths
- several active backup/stub strings were rewritten to official-facing wording

## Still not proven
- frontend install/build/typecheck in a stable dependency environment
- backend install/build/dev boot
- prisma generate, push, and seed
- runtime QA across student, teacher, admin, group, profile, and system-tool flows
- final release gate evidence for every checklist box
