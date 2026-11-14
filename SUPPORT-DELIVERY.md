# Winlog Calls support workspace delivery

## Added routes
- `/support`: inbox with status, priority, channel, assignee, overdue SLA, subject search and 25-row pagination; create manual cases or link an existing readable team call/follow-up.
- `/support-case/$ticketId`: status/priority/category/tags/assignment, resolve/reopen, retained-history merge, internal notes vs in-app replies, private attachments, case audit, editable AI draft generation and approval.
- `/support-customers` and `/support-customers/$customerId`: profiles, masked contacts with authorized reveal, communication consent/preferences, notes, account linking, linked cases, call and interaction timelines.
- `/support-knowledge`: article search, draft/published approval, editing, version snapshots and source URLs.
- `/support-messages`: private linked-customer conversations, customer-submitted web inquiries, stored/read states.
- `/support-analytics`: actual case channel/status/category totals, workload, measured response/resolution time, SLA breaches and reopen rate. CSAT remains “No survey data”.
- `/support-admin`: existing-account team roles, categories, priority SLA hours, AI enablement, integration health, audit log and supplied Android audit/readiness findings.

All routes use existing authentication. Existing dashboard includes a support-workspace icon. Bengali navigation labels are available; full translation is not implemented.

## Applied migrations
- `drizzle/migrations/0006_support_workspace.sql`
- `drizzle/migrations/0007_support_portal_hardening.sql`

Tables: support_teams, support_members, support_customers, support_customer_contacts, support_tickets, support_messages, support_ai_drafts, support_articles, support_article_versions, support_attachments, support_audit.

Explicit grants, RLS, team-scoped composite foreign keys, indexes, unique creation keys, active-call deduplication, audited mutations, article snapshots, operator assignment validation, safe customer portal projections, file-signature validation and read-receipt operations are included. Existing manager accounts were additively mapped to support workspaces; legacy roles and call records were not changed.

## Verified
- Full automated suite: **75 tests passed across 14 files** (`bun run test`, with authenticated live database test environment supplied only in memory).
- New support rules: 19 tests; live database authorization/idempotency: 3 tests.
- Additional live checks: anonymous read exclusion, unrelated-team write denial, duplicate case/message IDs, stale revision rejection, missing customer consent denial, AI draft send gating, invalid attachment rejection, resolved→open read-back and reopen count.
- Authenticated browser: case creation, persisted internal note, live AI summary and approval, resolve/reopen, customer create/read-back, draft article revisions 1→2, admin/inbox/analytics pages, desktop 1280px and mobile 390px. No page errors observed; mobile document had no horizontal overflow.
- Latest automated preview check: build OK.
- QA case, customer and article records were removed after validation; audit entries remain. The live idempotency integration test requires a deliberately supplied QA validation case fixture when rerun; absent its fixture, it is not a self-seeding test.

## Connected vs unavailable
- Existing Lovable Cloud database/auth and legacy call/follow-up storage remain connected.
- New server-side Lovable AI Gateway SDK: workspace model eligibility checked; one live support summary generated and saved successfully. Existing AI calls/models were left unchanged. New support AI uses the existing default openai/gpt-6-astra. Demo/mock output is clearly labelled when no credential is configured.
- In-app message persistence is connected; customer account ownership and consent are checked. A separate real customer session was unavailable, so cross-account customer inquiry/reply/read-receipt flow is **not verified end-to-end**.
- SMS, WhatsApp messaging, email delivery, telephony and Pulse CRM: **configuration required**, no delivery claimed.

## Remaining limits / blockers
- Real call count remains zero; no physical phone, SIM, WhatsApp, background upload or CRM acceptance tests were performed.
- Only one existing user was available: genuine Admin/Manager/Agent/Viewer multi-account RLS behavior remains unverified beyond rule tests, anonymous exclusion and unrelated-team denial.
- Workspace currently selects the first assigned team; multi-team switching and new-team provisioning are not exposed in the UI.
- The inbox links existing follow-ups and offers existing-call selection; it does not automatically materialize every legacy AI follow-up as a ticket.
- Attachments: private operator-only PDF/PNG/JPEG, maximum 2 MB, checked by signature and size. No malware scanning or customer attachment delivery; add scanning before allowing untrusted production uploads.
- Knowledge retrieval ranks the newest 50 published articles and cites matching sources; large-corpus search/indexing and exhaustive citation verification are not implemented.
- Audits record actor, operation, entity and time, not full before/after diffs. Audit UI shows newest 200; customer list caps at 500, timeline at 200 calls/300 messages.
- No CSAT collection/provider, outbound messaging providers, multilingual full UI, business-hours SLA calendar or automatic escalation scheduler is configured.

## Preservation
No Android package identity, keystore, signing secrets, signing configuration, versioning workflow or release settings were accessed or changed. No APK was built/released, and no publication was requested. The supplied package/version/v2-signature findings are explicitly labelled supplied audit; signer approval, source provenance and device/CRM tests remain NOT VERIFIED.
