# Security review — 2026-11-15

## Fixed and verified
- Applied `drizzle/migrations/0010_restrict_privileged_function_execution.sql`: all public SECURITY DEFINER functions deny anonymous/default-public execution. Trigger functions, phone-code claiming and AI worker claim/finish functions also deny direct authenticated execution. Trusted server execution remains allowed. Signed-in support functions retain their existing team checks.
- Updated production dependency resolution to Zod 4.6.6, Seroval 1.6.11, js-yaml 4.3.2 and source-map-js 1.2.2. Re-scan found no known advisories among 71 checked production packages; the URL-distributed SheetJS package was not checked by that scanner.
- 99 automated tests passed; 3 existing support integration tests skipped because their fixture/configuration was not supplied.
- Five new live authorization tests passed against the actual backend: anonymous AI claim and support mutation rejected; signed-in worker claim and phone-code RPC rejected; signed-in role lookup remains available.
- Basic security re-scan returned no findings. Preview build OK and authenticated mobile dashboard empty-state, refresh and troubleshooting navigation verified without browser errors.

## Still pending / limitations
- User-requested deep code analysis is running asynchronously; results have not yet arrived. This is not a complete or clean security certification.
- Database linter reduced from 25 to 8 warnings: seven intentional signed-in SECURITY DEFINER entry points with existing authorization, and managed non-relocatable `pg_net` in public. The extension was not dropped, moved or modified; background upload/AI scheduling must remain intact.
- No real call or physical-device acceptance test was performed. Empty-state verification does not verify Android capture or background uploads.
- Existing attachment malware scanning remains unavailable.
- Database privilege fixes are live immediately. Dependency and empty-state web changes have not been published; no APK/signing/release files were changed.

## Dashboard change
No call receipt explains why status is Not verified without asserting a phone permission fault. Four Bengali steps cover staff setup, permissions, a completed SIM call/upload, and read-back matching. Server receipt is explicitly separate from real-device test evidence.