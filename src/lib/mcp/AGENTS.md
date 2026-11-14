# Agent access
- MCP tools use verified OAuth caller tokens and a shared typed RLS client, never privileged clients. Why: external assistants must retain existing account and team access boundaries.
- Start with bounded read-only metadata tools; keep contact numbers and message bodies out. Why: agent integration does not authorize sending, destructive work, or unnecessary personal data.