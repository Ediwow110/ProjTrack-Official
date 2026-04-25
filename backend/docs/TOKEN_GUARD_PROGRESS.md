# Token Guard Progress

This batch adds a prototype bearer-token protection layer.

## Added
- frontend auth token persistence in local storage
- HTTP client automatically sends `Authorization: Bearer <token>`
- backend `PrototypeAuthGuard`
- backend `Roles` decorator
- protected controller coverage for:
  - admin controllers
  - admin student import controller
  - dashboard routes
  - subjects routes
  - submissions routes
  - notifications routes
  - profile routes

## Important limitations
- route handlers still mostly use default seeded user IDs internally
- the guard verifies role and token presence, but many services do not yet consume the authenticated request user as the real actor
- refresh-token revocation/rotation is still not finished
