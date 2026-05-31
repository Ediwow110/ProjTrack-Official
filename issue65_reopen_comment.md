Reopened because #65 was closed before its own live verification acceptance criteria were satisfied.

The repo-only implementation landed in:
c1a8383857cec66ee0123e8679c4b830bb0810db

But full completion still requires running `scripts/verify-deploy.sh` on the actual staging and production droplets without `SKIP_DOCKER=1`, including Docker/container/build-context/image-label checks.

Local HTTP-only checks are not enough because they do not prove:
- backend compose build context
- running container health from Docker
- running image revision label
- repo/runtime/image alignment

Next gate:
1. Verify staging without `SKIP_DOCKER=1`.
2. Only if staging passes, verify production without `SKIP_DOCKER=1`.
3. Close #65 only after both environments pass and evidence is posted.
