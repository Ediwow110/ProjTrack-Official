# Secrets Management Checklist

**Branch**: `2nd-main`

## Rules

- Never commit real secrets to git
- Use `.env.*.example` files only
- All critical secrets must cause **fail-fast** in production
- Rotate secrets regularly
- Use different secrets for dev / staging / production

## Critical Secrets (Must Fail Fast)
- JWT secrets
- Database credentials (production)
- Object storage keys (S3/MinIO)
- Mail provider API keys
- Any encryption keys

## Recommended Practices
- Use a proper secrets manager in production (Doppler, AWS Secrets Manager, etc.)
- Audit secret usage regularly
- Document rotation schedule
- CI should never have production secrets
