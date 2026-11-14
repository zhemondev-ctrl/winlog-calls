# Support AI processing
- Wake the durable call-AI queue from successful foreground/background uploads and use hourly reconciliation for interrupted wakes; process bounded work under team leases, never fan out from a page render. Why: uploads persist independently and model calls must not duplicate or storm.
- Permanent policy/credit failures and ambiguous model outcomes pause processing; unknown outcomes are never automatically replayed. Why: remote work may already have been billed.
- One live request creates metadata summary and neutral reply drafts only; no transcript means no spoken-content summary. Why: device call logs cannot establish conversation facts.
