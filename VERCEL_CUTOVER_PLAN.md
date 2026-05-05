# Vercel Cutover and Shutdown Plan

This plan migrates ProjTrack from Vercel to DigitalOcean **without** breaking
production. Vercel stays online throughout the cutover and is only torn down
after DigitalOcean has been verified healthy for at least 7 days.

DNS stays at Name.com. We never change Name.com nameservers.

---

## Pre-flight (do before any DNS change)

- [ ] DigitalOcean Droplet provisioned and bootstrapped (`infra/digitalocean-bootstrap.sh`).
- [ ] Managed Postgres for production AND staging both reachable from the Droplet.
- [ ] Spaces buckets created: `projtrack-prod-uploads`, `projtrack-staging-uploads`, `projtrack-prod-backups`.
- [ ] `backend.env.production` filled in with real secrets on the Droplet.
- [ ] `docker compose up -d` successful; `backend`, `mail-worker`, `backup-worker`, `clamav` all healthy.
- [ ] Static frontend built with `VITE_API_BASE_URL=https://api.projtrack.codes` and copied to `/var/www/projtrack`.
- [ ] Caddy installed; Caddyfile configured for all 5 hostnames.
- [ ] Monitoring per `MONITORING_RUNBOOK.md` configured.
- [ ] `npm run check:runtime:prod` and `npm run smoke:worker` pass on the Droplet.

If any of the above is not done, do not proceed.

---

## Stage 1 — staging cutover (zero risk to prod)

These are *new* hostnames; Vercel does not own them.

1. Add Name.com A records (TTL 300):
   - `staging` → `DROPLET_IP`
   - `api-staging` → `DROPLET_IP`
2. Wait for DNS to propagate: `dig +short staging.projtrack.codes`.
3. Caddy auto-issues Let's Encrypt certs for both.
4. Verify:
   ```bash
   curl -sS https://api-staging.projtrack.codes/health/ready
   curl -I  https://staging.projtrack.codes/
   ```
5. Run staging smoke from a workstation:
   ```bash
   cd backend
   SMOKE_ADMIN_EMAIL=...staging-admin... \
   SMOKE_ADMIN_PASSWORD=... \
   DATABASE_URL=postgresql://...staging... \
     npm run smoke:staging:summary
   ```
6. Run backup/restore drill against a *disposable* DB (NOT production):
   ```bash
   BACKUP_DRILL_SOURCE_DATABASE_URL=postgresql://...staging... \
   BACKUP_DRILL_TARGET_DATABASE_URL=postgresql://...drill-disposable... \
   BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND \
     node backend/scripts/backup-restore-drill.mjs
   ```

Stop here and review with stakeholders before stage 2.

---

## Stage 2 — backend-only production cutover

Production frontend stays on Vercel. Production API moves to DigitalOcean.

1. On Vercel, set `VITE_API_BASE_URL=https://api.projtrack.codes` on the
   production project. Trigger a redeploy. Verify Vercel still serves the
   frontend on `projtrack.codes` and `www.projtrack.codes` (unchanged).
2. Add Name.com A record:
   - `api` → `DROPLET_IP`
3. Wait for DNS: `dig +short api.projtrack.codes`.
4. Caddy issues the cert. Verify:
   ```bash
   curl -sS https://api.projtrack.codes/health/ready
   ```
5. Real-user smoke:
   - Log in as admin via `https://projtrack.codes/admin/login` (now hitting DO API).
   - Create a project, upload a file, log out, log back in.
6. Watch monitoring for **24 hours** before stage 3:
   - `/health/ready` 100% over 24 h
   - 5xx rate < 0.5%
   - Mail jobs flowing (queue depth back to 0 between bursts)
   - Backup worker runs at least once (the daily schedule)

If anything goes red: rollback (see "Rollback to Vercel" below).

---

## Stage 3 — frontend production cutover

1. Build frontend on the Droplet:
   ```bash
   cd /opt/projtrack/repo
   sudo VITE_API_BASE_URL=https://api.projtrack.codes npm ci
   sudo VITE_API_BASE_URL=https://api.projtrack.codes npm run build
   sudo rm -rf /var/www/projtrack && sudo mkdir -p /var/www/projtrack
   sudo cp -r dist/* /var/www/projtrack/
   ```
2. Lower TTL on `@` and `www` to 300 on Name.com (do this 24 h before).
3. Update Name.com A records:
   - `@` → `DROPLET_IP` (was Vercel)
   - `www` → `DROPLET_IP` (was Vercel)
4. Wait for DNS. Verify in incognito:
   - `https://projtrack.codes/` shows the new frontend.
   - Login flow works end-to-end.
5. Watch monitoring for **7 days** with Vercel still warm.

---

## Rollback to Vercel (any stage)

If a problem appears after a DNS flip:

1. Re-set the affected Name.com A records back to the Vercel-provided values
   you recorded before the cutover. Use TTL 300 so revert is fast.
2. If the issue is in the API only and the frontend is still on Vercel,
   revert just the `api` record. The frontend continues to work because the
   bundle is rebuilt on Vercel and uses whatever `VITE_API_BASE_URL` was set.
3. If you already moved `@` and `www`: revert them too. Vercel deployment is
   still live — Vercel does not auto-delete projects when DNS leaves.
4. Capture a postmortem in `data/release-evidence/<date>-rollback.md`.

**Pre-recorded Vercel target values** (record before the first DNS change and
keep in your password manager / runbook):

| Host | Vercel value (before cutover) |
| --- | --- |
| `@` | _record before stage 3_ |
| `www` | _record before stage 3_ |

---

## Vercel shutdown (only after 7 days healthy on DO)

1. Confirm 7 consecutive days of:
   - 100% uptime on `/health/live`
   - ≥ 99.9% uptime on `/health/ready`
   - 5xx rate < 0.5%
   - No paged alerts
2. In Vercel:
   - Disable production deployments (Settings → Git → "Disable").
   - Remove production env vars (`VITE_API_BASE_URL`, etc.) — but keep the
     project for one more billing cycle as a safety net.
3. After **another 14 days** of stability, delete the Vercel project.

Do not skip the 7-day watch. Do not skip the 14-day grace period.

---

## DNS records to KEEP intact through every stage

These records are not part of the cutover and must not be touched:

- `MX` records (Mailrelay / your mail provider).
- `SPF` `TXT` records.
- `DKIM` `TXT` records (selectors like `mailrelay._domainkey`).
- `DMARC` `TXT` (`_dmarc`).
- Any domain-verification `TXT` for SSO, Mailrelay, Stripe, etc.

If in doubt, snapshot the entire Name.com DNS zone to a text file before any
change:

```bash
# At Name.com: Domains → projtrack.codes → DNS Records → "Export" (CSV)
```
