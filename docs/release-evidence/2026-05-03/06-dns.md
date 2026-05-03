# 06 — DNS Records

**Date:** 2026-05-03  
**Resolver:** 1.1.1.1 (Cloudflare)  
**Registrar:** Name.com (nameservers unchanged)

## Stage 1 A records (staging only)

```
$ dig +short A staging.projtrack.codes @1.1.1.1
168.144.48.112

$ dig +short A api-staging.projtrack.codes @1.1.1.1
168.144.48.112
```

168.144.48.112 is the Reserved IP attached to Droplet projtrack-staging-01.
Droplet primary NIC: 139.59.110.93 — reserved IP routes traffic to it.

## Email records (preserved — unchanged)

```
$ dig +short MX projtrack.codes @1.1.1.1
10 mx.zoho.com.
20 mx2.zoho.com.
50 mx3.zoho.com.
```

MX, SPF, DKIM, DMARC records confirmed untouched.  
@, www, api A records not yet added (Stage 2 / Stage 3 of VERCEL_CUTOVER_PLAN.md).
