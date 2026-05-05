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
| external-render-upload-workers | Phase 5 | deferred | external | no | Run render/upload worker polling in a separate long-running environment. |
| provider-adapter-depth | Phase 4 | next | codex | yes | Expand provider-specific adapters after the preferred provider order is chosen. |

The dashboard exposes the same queue summary through `GET /api/ops/work-queue`.
