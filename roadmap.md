# WinLog roadmap

## Security review and evidence empty state
- [x] Restricted privileged function grants (migration 0010); patched zod, seroval, js-yaml and source-map-js; dependency re-scan has no known advisories for 71 checked packages (SheetJS URL distribution not checked). 99 unit tests passed; 3 existing live tests skipped; 5 new live authorization tests passed. Basic security re-scan clear. Managed pg_net placement and 7 authenticated guarded function warnings remain for review.
- [x] Added Bengali no-call explanation and four next steps; authenticated 428px dashboard, refresh and /sync link verified; build OK. Website changes not published; database grants already applied.
- [ ] Review deep security scan results (waiting for background scan notification).

## Dashboard sync warning
- [x] Add combined staff sync/call evidence panel; 14 tests passed, authenticated desktop/mobile and refresh checked, build OK. Current real data: no call receipt, remote sync time unknown, test/device NOT VERIFIED. Not published.
- [x] Show staff-specific receipt warning and Bengali troubleshooting; 11 tests passed, authenticated desktop/mobile warning and refresh verified; no calls received for zhemon.sm123, remote phone cause remains unknown. Not published.

## Linked call details and real integrations
- [x] Add private /calls/$callId linked from Calls with date/time, reported duration, staff attribution, saved AI notes and permitted support links; 10 tests passed, build OK, signed-out privacy gate checked (authenticated real-call flow awaits user sign-in and uploaded call)
- [ ] Verify real-device call and support inbox evidence (blocked: physical team phone required; zero calls)
- [ ] Connect bidirectional Pulse staff/call sharing (blocked: inspected Pulse snapshot f0f35cb7; existing /api/public/os/events accepts bookings/payments/leads/site visits, not staff or call synchronization; source-side private export/import with stable staff mapping needed; cross-project snapshot is read-only)

## Agent integrations
- [x] Enable protected OAuth, consent return flow, and read-only call/case MCP tools
- [x] Add dashboard browser tools; verify manifest, 11 tests, anonymous rejection and consent error states (AGENT-INTEGRATIONS.md)
- [ ] Verify external OAuth client end-to-end and browser registration (requires republish and a compatible agent client/browser)

## Database and running-credit optimization
- [x] Measure recorded running usage, query plans, indexes, storage, scheduled jobs, and AI requests
- [x] Narrow daily-upload chart reads and index upload-arrival filters without changing privacy or refresh timing
- [x] Run 20 regression tests, verify authenticated empty dashboard and live query plans; findings in DATABASE-OPTIMIZATION.md (real-load savings unverified: zero calls)

## Support workspace extension
- [x] Queue server-received team calls for live summary and reply drafts, including closed-app uploads
- [x] Add bounded durable AI processing, visible error/pause states, and human-only approval
- [x] Verify live provider availability, protected worker, empty queue, and processing rules; Android unchanged
- [ ] Verify automatic summary and reply for a real uploaded phone call (blocked: zero real call records; unpublished worker route)
- [x] Add team-scoped support schema, authorization, audit, and duplicate-safe mutations
- [x] Add inbox, customer profiles, ticket workspace, approved AI drafts, knowledge base, messaging, analytics, and admin (limits recorded in SUPPORT-DELIVERY.md)
- [x] Preserve existing call/follow-up flows and show supplied Android audit as unverified release readiness
- [x] Run 75 automated tests and authenticated desktop/mobile workflow checks; no publish or APK build
- [ ] Verify separate customer and operator role sessions plus real call evidence (blocked: only one user and zero calls; physical device required)

- [x] Show Android build status and latest APK release directly on dashboard (authenticated desktop/mobile verified; eight status tests passed)
- [x] Retry Android APK build after SDK fix: build #9 succeeded; installation guidance provided (real phone test requires user)

- [x] Manually triggered Android build #7 and provided phone installation instructions; failed at SDK setup before signing
- [x] Publish signed APK: corrected obsolete SDK package; GitHub build #9 succeeded
- [ ] Private automatic Winstone Pulse staff/call connection (blocked: source app only exposes property facts; protected staff/call sharing must be implemented in its own chat)
- [ ] Automatically send live Winlog Calls records back to Winstone Pulse, including foreground and closed-app uploads (blocked: Pulse must provide a protected receiving endpoint and stable staff mapping; retries must not duplicate or echo records)
- [ ] Verify a real team-phone call after installation (physical phone access required)

- [x] Add installed-version screen and latest signed APK release link (browser verified; installed version uses existing native bridge)
- [x] Add latest Android workflow status panel with start/success/failure times (real GitHub build #4 failure verified; no stable release exists yet)

- [ ] Bring Winstone Pulse staff and real-call records here; live cross-project sharing requires a protected connection built in the source project, existing data requires its export
- [x] Requested dashboard publication and prepared team-phone installation/test steps

- [x] Private company-code setup with manager-selected staff assignment (successful staff activation pending: no staff account exists)
- [x] Signed Winlog Calls v6 APK built and signature verified; dashboard, recap, pending sync ready for publication
- [x] Renamed project and APK label to Winlog Calls; referenced ZIP is the already-inspected kit, no new attachment present

- [x] Backend: accounts, manager role, call log storage
- [x] Web screens: today/week stats, call log, team, phone setup, sign-in
- [x] Android app: SIM call history + WhatsApp call capture + upload
- [x] GitHub Actions job that builds and releases the APK
- [ ] Connect GitHub (user action in Lovable) so the APK build runs
- [x] Restyle app in Winstone navy + gold
- [x] Winstone logo as Android app icon + site icon
- [x] Manager AI assistant: separate saved conversations about team call activity
- [x] Background call uploads while the app is closed
- [x] Rebuild APK with icon + background uploads
- [x] Phone sync status screen: permissions, last SIM/WhatsApp sync, troubleshooting
- [x] GitHub Actions: build + publish signed APK on every app update
- [x] Remove Lovable badge from the live site and Android website shell
- [x] AI summary from manager-provided call records: activity summary + calls needing follow-up
- [x] Quick AI summary on each call card (pattern / follow-up)
- [ ] Connect project to GitHub so every change builds a fresh APK (user action: Project settings → Git)
- [ ] Real-phone test: install APK, SIM + WhatsApp call, confirm closed-app upload (user action; checklist provided)
- [x] Publish the Winstone version
- [x] Agent-focused dashboard with personal call details and manager agent filter
- [x] Signed APK build on every push, with stable latest download
- [ ] Create real manager and team accounts (blocked: user must create first account/invite members via More → Users; agent has no invitation tool)
- [ ] Resolve overdue Pro payment (user action: Plans & credits)
- [x] Rebuild WinLog from this project's Android source and verify shared website URL in the APK

- [x] Manager follow-up queue with resolve
- [x] Phone setup checklist (call history, notifications, battery)
- [x] Manager follow-up viewing and successful-resolution analytics
- [x] Foreground upload analytics: new SIM/WhatsApp calls only, counts without personal details
- [ ] Complete daily-upload goal analytics including closed-app uploads (blocked: analytics supports browser events only, not WorkManager/server uploads)
- [x] Stay signed in on phones
- [x] Dashboard chart: daily calls uploaded by team phones
- [ ] Remove sign-in: owner chose fully open; held back because it would put customer phone numbers on the open internet
- [x] Daily manager digest (AI recap of yesterday on dashboard)
- [ ] Merge all Winstone Connect APK features with WinLog (deferred: latest request focuses on building this site's WinLog APK; source inspected, remaining capabilities recorded in migration ledger)
- [x] Build a fresh signed Android APK using this site's shared screens
- [x] Phone dashboard: live count of calls waiting to upload (native receipts implemented; real-phone acceptance pending)
- [x] Deliver a clean complete source ZIP for rebuilding the final APK (private signing key excluded; build instructions included)
- [ ] Confirm a real phone call appears in dashboard and daily uploads chart (blocked until a team phone uploads a call; current call count is zero)

- [x] Supplied GitHub repository is accessible and contains the Android push-build workflow; Lovable Git sync status remains user-controlled
