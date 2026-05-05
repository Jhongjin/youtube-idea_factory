# Work Queue

This queue keeps the build loop explicit:

`finish work -> report -> commit/push -> next job`

## Rules

- Codex-owned `next` work should be implemented, verified, committed, pushed, and then followed by the next item.
- Skippable work can be skipped only when it does not block the current phase. Record why it was skipped.
- Non-skippable work that needs user credentials, external accounts, paid approvals, or infrastructure is marked `deferred` and carried forward.
- Publishing, upload, paid generation, and unattended spend always keep a human approval gate.

## Current Phase Queue

| ID | Phase | Status | Owner | Can Skip | Next Action |
| --- | --- | --- | --- | --- | --- |
| phase-6-feedback-loop-flow | Phase 6 | done | codex | no | Run once against a real uploaded video ID after deployment. |
| phase-6-work-queue | Phase 6 | done | codex | no | Use this queue to separate completed, deferred, and skipped work. |
| youtube-analytics-oauth | Phase 6 | deferred | operator | no | Enable YouTube Analytics API and issue a refresh token with analytics read scope. |
| operator-status-cli | Phase 5 | done | codex | no | Use `npm run ops:status -- --storage supabase` before worker commands. |
| external-render-upload-workers | Phase 5 | deferred | external | no | Run render/upload worker polling in a separate long-running environment. |
| provider-capability-labels | Phase 4 | done | codex | no | Keep direct, manual, and pending providers visible in settings. |
| manual-provider-handoff | Phase 4 | done | codex | no | Create external generation packets for manual or adapter-pending providers. |
| provider-adapter-depth | Phase 4 | skipped | codex | yes | Reopen when a preferred provider needs direct API automation. |

The dashboard exposes the same queue summary through `GET /api/ops/work-queue`.
