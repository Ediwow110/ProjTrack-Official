# Security Notes for ProjTrack

This document captures specific security considerations, accepted risks, and timelines for resolution of issues identified during the production readiness process for ProjTrack.

## Accepted Risks and Temporary Mitigations

### Backend Dependency Vulnerabilities
- **Issue**: Moderate severity vulnerabilities identified in backend dependencies:
  - `@nestjs/core` (<=11.1.17): Injection vulnerability (GHSA-36xv-jgw5-4q75). No fix available without breaking changes.
  - `@nestjs/platform-express` (<=11.0.0-next.4): Depends on vulnerable `@nestjs/core`.
  - `@nestjs/common` (various versions): Depends on vulnerable `file-type`.
  - `file-type` (13.0.0-21.3.1): Infinite loop in ASF parser (GHSA-5v7r-6r5c-r473) and ZIP Decompression Bomb DoS (GHSA-j47w-4g3g-c36v).
  - `uuid` (<14.0.0): Missing buffer bounds check (GHSA-w5hq-g745-h8pq). Fix available but involves breaking change to `exceljs`.
- **Status**: Attempts to update to safer versions (`@nestjs/*` to `^10.4.23`, `file-type` to `^22.0.0`, `uuid` to `^14.0.0`) failed due to dependency conflicts with `@nestjs/config`. Adjusted to more compatible versions (`@nestjs/*` to `^10.0.0`, `file-type` to `^16.5.4`, `uuid` to `^9.0.1`) to minimize risk without breaking changes.
- **Risk Acceptance**: These moderate vulnerabilities are accepted temporarily for the initial production release due to the breaking nature of full fixes. No high or critical vulnerabilities are present.
- **Mitigation**: 
  - For `file-type`, additional file upload validation will be considered to reduce exposure to malformed input risks.
  - For `@nestjs/core` injection, input validation and sanitization are already in place as part of the application's security design, reducing the practical risk.
  - For `uuid`, the specific usage in `exceljs` for export functionality is low-risk as it does not involve direct user input in the vulnerable context.
- **Timeline for Resolution**: Full resolution targeted for the next major update cycle (post-initial production release, estimated within 3 months). Breaking changes will be tested in a non-production environment during this period.

## Incident Log

- **No Incidents Recorded**: No security incidents, such as accidental secret commits or breaches, have been recorded during the production readiness phases.

## Additional Security Considerations

- **Secrets Management**: Secret scans passed with no issues. All environment variables with sensitive data (e.g., `JWT_ACCESS_SECRET`, `S3_SECRET_ACCESS_KEY`) are stored securely outside the repository in environment configurations.
- **Fail-Closed Policies**: File malware scanning is set to `fail-closed` mode in staging and production, ensuring uploads are rejected if ClamAV is unavailable, reducing risk of malicious content.
- **Monitoring and Alerts**: Production deployment requires monitoring setup (e.g., New Relic, Datadog) to detect runtime security issues post-deployment. Alerts must be configured for unusual error rates or downtime.

## Review and Approval

- **Security Review Status**: Pending final review post-CI verification on Linux. Current accepted risks are documented for transparency.
- **Approval for Production**: Security posture is acceptable for production with the noted mitigations, contingent on stakeholder approval of risk acceptance for moderate vulnerabilities.

This document will be updated with any additional findings from CI runs or staging tests, and final approval will be sought before production deployment.
