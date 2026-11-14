# Winlog Calls agent integrations

- Prepared OAuth-protected MCP at `/mcp`; SDK-generated discovery at `/.well-known/oauth-protected-resource`.
- Remote read-only tools: `list_call_evidence` (no contact numbers/names; distinct device/notification evidence and server receipt), `list_support_cases` (bounded metadata list). Caller-scoped database RLS applies; no privileged client, writes or sends.
- Managed OAuth server activation confirmed this turn, with dynamic registration and `/.lovable/oauth/consent`. Existing app auth/database and asymmetric account signing were already present; signing migration was a no-op. Android signing was untouched.
- Consent preserves the return path through existing password sign-in and signup confirmation; current UI has no social login. Consent target is covered by the existing redirect allow-list. Includes loading, invalid request, switch-account, approval/cancellation error states.
- Dashboard browser tools: `read_dashboard_activity` and `set_dashboard_period`, with shared period validation and best-effort static telemetry. Browser registration was not observable in the available browser (API absent); ordinary UI remains usable.
- Manifest extraction succeeded with two tools. Eleven regression tests passed (six safe return-path tests and five upload-query tests). Preview build OK. Browser verified sign-out return preservation, actual invalid authorization handling, and anonymous `/mcp` rejection (401). Approval/cancel failure UI verified using clearly mocked provider responses, not real OAuth grants.
- Remaining verification: real external client registration/consent/token exchange and authenticated tool read-back, approve/deny successful redirects, already-authorized redirects, and full signup-confirmation return. These were not established by the manifest or invalid-request checks.
- Republish before external assistants use this revision: `https://winlog-calls.lovable.app/mcp`. No publication was performed.

Browser integration skill: webmcp-tools.