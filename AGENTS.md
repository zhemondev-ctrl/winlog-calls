<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Phone pending-upload counts use per-user, per-source native upload receipts shared by foreground and background success handlers; poll only while visible. Why: overlap cursors and timestamps cannot count unsent calls accurately or distinguish accepted duplicates.
- Daily uploads query call_logs by created_at separately from call activity by started_at, with foreground polling. Why: delayed uploads must count on arrival day even if the call was made outside this week's activity window.

- Android app = Capacitor shell in `android/` whose `server.url` (capacitor.config.ts) loads the published site; web changes reach phones after publishing, native changes need a new APK. Why: TanStack Start SSR has no static bundle to ship inside the APK.
- Native call access lives only in the `WinLogNative` Capacitor plugin (`android/app/src/main/java/com/winlog/app/`); web code reaches it through `src/lib/native.ts`. Why: one typed bridge, browser builds stay safe.
- WhatsApp calls are inferred from WhatsApp call notifications by a NotificationListenerService and stored on-device until uploaded. Why: WhatsApp exposes no call history API.
- Call uploads are idempotent upserts keyed by (user_id, device_id, source, external_id) with a one-day overlap re-read. Why: repeated syncs never duplicate calls.
- Upload analytics emit `project.call_uploaded` directly after each foreground upsert, counting only returned inserted rows by source; daily totals sum `call_count`, not event counts. Background WorkManager uploads have no supported browser analytics emitter and are excluded. Why: duplicate overlap and retries must not inflate the goal metric or imply complete background coverage.
- APKs are built by `.github/workflows/android-apk.yml` and signed with the committed `android/app/winlog-release.keystore`. Why: internal sideloaded app; a fixed signature lets updates install over old versions.
- Roles live in `user_roles`; the first account to sign up becomes admin (manager). Why: no separate admin setup step for the company.
- Background uploads: each phone gets its own upload key (`registerDeviceKey`, hash stored in `device_upload_tokens`); a WorkManager job (`CallUploadWorker`, every 15 min + soon after WhatsApp calls) posts to `/api/public/device-upload`, which takes the owner from the key, never the body. Why: Supabase refresh tokens rotate, so the web session can't be shared with a background job.
- Manager AI assistant: `/api/assistant` streams Lovable AI Gateway answers; history is loaded from `assistant_messages` server-side (only the newest question comes from the browser) and team calls are condensed by `src/lib/call-digest.ts`. Why: smaller requests and the browser can't rewrite saved history.
- Brand assets: the Winstone logo drives the web header (CDN pointer in `src/assets`), `public/favicon.png`, and the Android launcher icons/splash in `android/app/src/main/res`. Why: one company mark everywhere.
- AI call-card notes: `getCallNotes` (managers only) writes one-line notes in batches for cards scrolled into view and saves them in `call_ai_notes`; a note is rewritten only when its contact has a newer call (`planNotes` in `src/lib/call-notes.ts`). Why: notes appear automatically without paying for the same note on every visit.
- "Summarize records" (`/summary` → `/api/summary`): uploaded/pasted records are read in the browser (Excel via SheetJS, loaded on demand) and sent as text; WinLog periods are condensed with `buildCallDigest`. Shared gateway setup lives in `src/lib/ai-gateway.server.ts`. Why: one model contract for every one-shot AI feature.
- Sync status screen (`/sync`) gets its fix-it steps from `diagnose()` in `src/lib/sync-health.ts`; the app records SIM and WhatsApp sync times separately. Why: the troubleshooting rules are tested in one place.
- APK workflow builds on every branch push and publishes a fixed-name `WinLog.apk`; only default-branch releases become latest. Why: every commit is buildable without letting an experimental branch replace the team's stable download.
- The dashboard uses existing call/profile queries for personal agent details and a manager agent selector; the Android shell renders this same route. Why: phone and website screens remain one implementation.

- Follow-up queue (`/follow-ups`, managers): open items are `call_ai_notes` rows with follow_up and no resolved_at, grouped per contact by `groupFollowUps` (`src/lib/follow-ups.ts`); a note rewrite clears resolved_at. Why: a contact who calls again reappears automatically.
- Follow-up analytics use built-in page views and navigation interactions for viewing, and a direct success-handler event for resolution with counts only. Why: avoids duplicate page-view events and personal data.
- Daily manager digest: `getDailyDigest` writes yesterday's recap from `buildCallDigest` once per day and saves it in `daily_digests` (managers only, refresh button regenerates). Why: one model call per day instead of per visit.
