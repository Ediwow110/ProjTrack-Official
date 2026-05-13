# Testing Strategy

**Branch**: `2nd-main`
**Created**: 2026-05-13

## Goals
- Ensure critical user flows work reliably
- Maintain high confidence when deploying
- Balance speed vs coverage

## Testing Pyramid

1. **Unit Tests** (Jest)
   - Backend services, repositories, utility functions
   - Fast feedback

2. **Integration Tests**
   - Prisma + Service layer
   - Module interactions

3. **E2E Tests** (Playwright)
   - Critical user journeys (auth, submissions, role-based access)
   - Responsive tests
   - Smoke tests with real accounts

## Priority Areas to Test

- Authentication & Role-based authorization
- Project / Task / Submission flows
- File upload (avatar + submissions)
- Admin operations
- Password recovery
- Health check endpoints

## Current State
- Strong E2E smoke tests exist
- Backend has unit + some smoke tests
- Need more integration tests

## Recommendations
- Add coverage reporting in CI
- Increase unit test coverage on services
- Create dedicated integration test suite for Prisma repositories
- Maintain deterministic smoke fixtures
