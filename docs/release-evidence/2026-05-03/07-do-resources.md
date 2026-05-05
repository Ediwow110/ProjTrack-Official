# 07 — DigitalOcean Resources

**Date:** 2026-05-03
**Region:** SGP1 (Singapore)

## Droplet

| Field | Value |
|---|---|
| Name | projtrack-staging-01 |
| ID | 568694345 |
| Public IP | 139.59.110.93 |
| Size | s-2vcpu-4gb (2 vCPU, 4 GB RAM, 120 GB SSD) |
| Image | Ubuntu 24.04 LTS x64 |
| Region | SGP1 |
| Monitoring agent | do-agent active (systemctl status do-agent — started 08:33:21 UTC) |
| SSH | key-only, password auth disabled |

## Managed PostgreSQL

| Field | Value |
|---|---|
| Engine | PostgreSQL 18.3 |
| Region | SGP1 |
| Nodes | 1 (dev/staging tier) |
| Trusted source | Droplet 568694345 (projtrack-staging-01) |
| Databases | projtrack_staging (app), projtrack_drill_target (drill — dropped post-test) |

## Networking

- UFW inbound rules: 22/tcp, 80/tcp, 443/tcp only
- Caddy handles TLS termination for staging.projtrack.codes and api-staging.projtrack.codes
- Port 3002 (backend) exposed on 127.0.0.1 only

## Secrets

All credentials stored in /opt/projtrack/backend.env.staging (chmod 600).
No secrets committed to this evidence file.
