# Auth Hardening Progress

This batch improves the backend prototype auth flow with:

- password hashing via Node `crypto.scrypt`
- backward-compatible login for legacy seeded plain-text prototype passwords
- automatic rehash on successful legacy login
- signed access/refresh token helper service using HMAC
- hashed password writes for:
  - account activation
  - reset password
  - upgraded login path

## Important
This is still **not final production auth**. Remaining work:
- HttpOnly cookie or robust token storage policy
- refresh-token rotation + revocation store
- request guards based on verified access tokens
- password complexity enforcement
- brute-force/rate-limit controls
- audit coverage for refresh/logout failure cases
