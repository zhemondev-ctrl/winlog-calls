# Database optimization — 14 November 2026

## Recorded usage

Project recording window: 1 November 2026 00:00 UTC through 14 November 2026 23:29:38 UTC (last day partial; recording can lag activity).

| Category | Requested credits | Known quantity |
| --- | ---: | --- |
| AI Gateway | 0.046560 | Token quantities unavailable in cost baseline; request sample below |
| Database compute (pico) | 0.017806416 | 0.23 instance-hours |
| Total returned running categories | 0.064366416 | Not a complete deployed resource inventory |
| Build work (separate from running) | 62.800000 | Unknown resource quantity |

Current pico quote: 0.0774192 credits per active hour, before coverage. Continuous 720-hour scenario: 55.741824 credits, not measured monthly usage or a savings forecast. No database-storage usage item was returned; absence does not establish zero storage cost.

## Diagnosis

- Query statistics reset: 11 November 2026 20:28:31 UTC. Highest-total application query was support workspace loading: 24 calls, 19.81 ms cumulative, 0.83 ms average, 6.94 ms maximum. Cumulative query time is not CPU usage.
- Call-related statement sample: 76 calls, 49.86 ms cumulative. No measured heavy SQL bottleneck; empty tables favor sequential scans.
- Health snapshot: memory 56%, disk 16%, connections 10/60, pool clients 1/200; no recent exhaustion alerts. This is not sustained capacity history and does not justify a resize.
- Application tables and indexes occupied 1,064,960 bytes before this change. Whole database reported 13 MB; WAL 128 MB. Allocated billing storage was not measured. Attachments total zero bytes; no cleanup is justified.
- Zero call records and zero queued call-AI jobs prevent representative real-call/load validation.
- One managed hourly call-AI reconciliation schedule: `/api/public/jobs/call-ai`, up to 24 scheduled starts per day. It reads at most 20 pending rows and attempts one team job. Uploads already wake bounded processing. Execution history and successful scheduled handler outcomes were unavailable; configured cadence is not measured executions.
- Gateway sample returned two successful requests: 260 input/19 output tokens and 289 input/104 output tokens, totaling 0.04656 credits. No duplicate/error pattern was established. Queue leases, stored output before finalization, cached notes and daily digest already guard repeat generation. No model or quality change was made.
- Inspected chart queries in `src/lib/queries.ts` and dashboard, support ticket/analytics reads in `workspace.functions.ts`, support query polling, AI processor and reconciliation handler. Support detail polls multiple related tables every 15 seconds; analytics can read up to 100,000 rows. These are growth candidates, not measured current bottlenecks.
- Bounded call-log request analytics returned no matching records; deployed request frequency could not be inferred from that empty result.

## Applied fixes

1. Upload-chart queries now select only `created_at,source`, rather than full contact/device/call records. A separate query cache preserves existing full call activity. Same arrival-date window, staff filter, pagination limit, and 15-second refresh; existing call RLS remains unchanged.
2. Applied `drizzle/migrations/0009_call_upload_arrival_indexes.sql`: `(created_at DESC)` and `(user_id, created_at DESC)` indexes. Existing indexes covered call time, not upload arrival. No destructive change or widened permissions. Additional indexes impose small write/storage overhead.

## Verification

- 20 tests passed across `queries.uploads.test.ts`, `sync.analytics.test.ts`, and `support/call-ai.test.ts`. Chart tests assert narrow fields, arrival filtering, staff isolation/cache separation, continuation after 1,000 receipts, and surfaced errors.
- Signed-in dashboard rendered the upload chart. Network observations confirmed `created_at,source` requests on initial load and the next refresh, while full call activity still selects its existing fields. This verified the authenticated empty state, not real-call ingestion.
- Before/after bounded arrival query: estimated row width 122 for full records versus 12 for narrow fields. These are planner estimates, not measured response-byte savings.
- Narrow arrival query ran in 0.158 ms before indexes and 0.123 ms after; staff-scoped query ran in 0.126 ms after. Zero returned rows mean these small differences are noise, not a demonstrated speedup. Both plans still choose sequential scans; index existence was verified, but representative index use awaits actual data.
- Latest preview compilation reported `build OK`.
- No publication, APK/signing changes, data deletion, pause, resize, model change, or cadence change.

## Next decisions and measurements

1. After real calls arrive, repeat the same query plans and measure response bytes, latency and database active hours over comparable workloads. Faster SQL alone does not reduce per-instance-hour rates; credit savings remain unverified.
2. If idle scheduled starts keep compute active, consider work-aware retry scheduling that shuts down after queue drain. Preserve recovery of interrupted upload wakes and obtain approval for changed delivery timing; hourly reconciliation remains unchanged here.
3. When measured support traffic grows, replace full analytics downloads with authorized database aggregates and reduce repeated static ticket metadata downloads without slowing message freshness. Do not add speculative indexes or remove access checks on today's nearly empty database.

Skill used: database-optimization.