# Changelog

ProjTrack follows a simple release log for operator-visible changes. Keep entries factual, dated, and tied to pull requests when available.

## Unreleased

### Added

- Production boot-check scripts for API and worker entrypoint readiness.
- Production Checks GitHub Actions workflow for frontend, backend, Prisma, boot checks, smoke tests, secret scanning, and high-severity audit gates.
- Dependabot configuration for frontend, backend, and GitHub Actions updates.
- Launch evidence templates for release, staging smoke, backup/restore, monitoring, incident response, and production signoff.

### Changed

- Production-readiness documentation now has clearer evidence capture expectations before launch approval.

## Release Process

For each release, add:

- `Added` for new user/operator capabilities.
- `Changed` for behavior or workflow changes.
- `Fixed` for defects.
- `Security` for security-sensitive fixes or dependency updates.
- `Operations` for deployment, monitoring, backup, or runbook changes.
