# Final phase status checklist

## Completed in this pass
- Fixed frontend submission review status normalization import.
- Replaced legacy login page with a safe redirect to the supported login selector.
- Added missing store fields used by admin and subject flows (`department`, `program`, activity window/email/link fields).
- Fixed admin notification read state to use `isRead`.
- Fixed admin request action to await repository updates before reading fields.
- Tightened subject student id collection to return `string[]`.

## Still not proven
- Frontend production build
- Backend dependency install and Nest build
- Prisma generate/push/seed
- Runtime route checklist across student, teacher, admin, profile, groups, and system tools

## Release decision
Do not mark PROJTRACK official until build, backend boot, and runtime QA are all proven green.
