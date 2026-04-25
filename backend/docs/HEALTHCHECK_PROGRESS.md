# Healthcheck Progress

This batch adds simple backend health endpoints.

## Added routes
- `GET /health`
- `GET /health/storage`
- `GET /health/mail`
- `GET /health/database`

## Purpose
These endpoints help verify local environment readiness during development:
- backend boot status
- upload directory availability
- mail provider mode
- database configuration visibility
