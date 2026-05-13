# Security Review

**Branch**: `2nd-main`
**Date Started**: 2026-05-13
**Status**: In Progress

> This document tracks findings, gaps, and improvements related to security (Priority 2 of the Master Improvement Plan).

## 1. Authentication & Authorization (Task 2.1)

### Current State
- JWT-based authentication is implemented.
- Role-based access control (students, teachers, admins) exists.
- Guards are used for protected routes.

### Findings
- [ ] Review JWT secret strength and rotation policy
- [ ] Verify role guards cover all sensitive endpoints
- [ ] Check for missing authorization on admin-only routes

### Recommendations
- Ensure proper `CanActivate` guards on all admin endpoints.
- Consider adding scope-based permissions if roles grow more complex.

---

## 2. MinIO / Object Storage Security (Task 2.2)

### Current State
- Supports MinIO (local) and S3-compatible storage (production).
- File uploads for avatars and submissions.

### Findings
- [ ] Review bucket policies and public/private access
- [ ] Verify signed URLs have appropriate expiration
- [ ] Check for path traversal or filename sanitization issues

### Recommendations
- Use least-privilege IAM policies in production.
- Implement content-type validation and malware scanning (already partially present).

---

## 3. Input Validation & Rate Limiting (Task 2.3)

### Current State
- NestJS ValidationPipe is likely used.
- Some rate limiting configuration exists (HTTP_RATE_LIMIT_STORE).

### Findings
- [ ] Confirm ValidationPipe is globally enabled with strict settings
- [ ] Review rate limiting on auth, password reset, and file upload endpoints
- [ ] Check for missing DTO validation on critical routes

### Recommendations
- Add global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Apply `@Throttle()` decorators on sensitive endpoints.

---

## 4. Security Headers (Task 2.4)

### Current State
- Helmet middleware status unknown.

### Findings
- [ ] Check if `Helmet` is applied in main.ts or app.module

### Recommendations
- Add `app.use(helmet())` in production bootstrap.
- Configure CSP if frontend allows.

---

## 5. Secrets Handling (Task 2.6)

### Current State
- Strong fail-fast behavior documented for missing critical secrets in production.
- Multiple `.env.*.example` files.
- CI uses test secrets.

### Findings
- [ ] Verify all critical secrets cause immediate failure in production mode.
- [ ] Review secret rotation procedures.

### Recommendations
- Document secret rotation schedule.
- Consider using a secrets manager (e.g., Doppler, AWS Secrets Manager) in production.

---

## Action Items

- [ ] Complete full audit of auth module
- [ ] Test MinIO access controls locally and in staging
- [ ] Implement missing rate limiting and validation enhancements
- [ ] Add Helmet middleware

**Next Update**: After completing Auth & MinIO review.
