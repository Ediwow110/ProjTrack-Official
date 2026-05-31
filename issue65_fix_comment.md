**Update:** Fix for missing image revision label.

The staging verify-deploy script failed because the `org.opencontainers.image.revision` label was empty on the built container.

**Root cause:** `ARG VCS_REF` was declared before the final `FROM node:20-alpine AS runner` stage. In Docker, `ARG` variables declared before a `FROM` are only accessible in `FROM` instructions, not inside the stage itself unless redeclared. The `LABEL` command could not see the argument, resulting in an empty label.

**Fix Commit:** `9c49266`

**Local validation:** Local Docker build was not able to complete due to environment constraints, but a fallback `bash -n scripts/verify-deploy.sh` exited with code 0 indicating the script syntax is fine. Note: the Docker build syntax logic has been directly corrected by moving the `ARG` into the runner scope, and the `VCS_REF` arg is correctly passed from compose.

Issue #65 remains open pending live staging rebuild and staging/production verification without `SKIP_DOCKER=1`. 

**Next step for human operator:**
Pull this fix on staging, rebuild backend with VCS_REF, rerun verify-deploy staging.
