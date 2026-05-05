# 09 — Caddy HTTPS / TLS

**Date:** 2026-05-03

## staging.projtrack.codes

```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN),  TLS handshake, Server hello (2):
* TLSv1.3 (IN),  TLS handshake, Encrypted Extensions (8):
* TLSv1.3 (IN),  TLS handshake, Certificate (11):
* TLSv1.3 (IN),  TLS handshake, CERT verify (15):
* TLSv1.3 (IN),  TLS handshake, Finished (20):
* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
* TLSv1.3 (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 / X25519 / id-ecPublicKey
* subject: CN=staging.projtrack.codes
* expire date: Aug 1 09:31:51 2026 GMT
* subjectAltName: host "staging.projtrack.codes" matched cert's "staging.projtrack.codes"
* issuer: C=US; O=Let's Encrypt; CN=E7
* SSL certificate verify ok.
* using HTTP/2
```

## api-staging.projtrack.codes

```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN),  TLS handshake, Server hello (2):
* TLSv1.3 (IN),  TLS handshake, Encrypted Extensions (8):
* TLSv1.3 (IN),  TLS handshake, Certificate (11):
* TLSv1.3 (IN),  TLS handshake, CERT verify (15):
* TLSv1.3 (IN),  TLS handshake, Finished (20):
* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
* TLSv1.3 (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 / X25519 / id-ecPublicKey
* subject: CN=api-staging.projtrack.codes
```

Both domains: Let's Encrypt E7 CA, TLSv1.3, AES-128-GCM, HTTP/2.  
Certificates auto-issued by Caddy on first startup.
