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
| public-home-auth-admin-channels | Phase 7 | done | codex | no | Public homepage, login/signup/my page, admin users, and channel management are implemented. |
| supabase-auth-channel-schema | Phase 7 | done | operator | no | `docs/templates/supabase-auth-schema.sql` has been applied; health reports `appUsers` and `youtubeChannels` as ready. |
| channel-oauth-inventory | Phase 7 | done | codex | no | Admin channel records can persist upload and analytics token inventory in Supabase. |
| channel-run-linking | Phase 7 | done | codex | no | New runs can store a selected brand channel in `package.brief.channel`; upload jobs and workers use the selected channel token when present. |
| dashboard-channel-filtering | Phase 7 | done | codex | no | Dashboard sidebar can filter run history by brand channel, and new runs inherit the selected channel context. |
| channel-analytics-snapshot | Phase 7 | done | codex | no | Performance snapshots attach YouTube Analytics API metrics when the selected channel has an analytics refresh token. |
| dashboard-guided-flow | Phase 7 | done | codex | no | Dashboard now starts with an operating channel selector and a guided five-step production workspace. |
| dashboard-focused-artifacts | Phase 7 | done | codex | no | Guided dashboard steps now show only the most relevant artifact tabs first, with full context behind disclosure. |
| dashboard-inspector-guide | Phase 7 | done | codex | no | The right inspector now leads with a compact progress decision, active approval gate summary, and shorter check list. |
| homepage-editorial-redesign | Phase 7 | done | codex | no | Public homepage now uses a lighter editorial production-board design with responsive hero previews. |
| api-session-hardening | Phase 7 | done | codex | no | Sensitive run, settings, YouTube, analytics, and ops APIs require an authenticated session; settings/admin APIs require admin authority. |
| phase-6-feedback-loop-flow | Phase 6 | done | codex | no | Run once against a real uploaded video ID after deployment. |
| phase-6-work-queue | Phase 6 | done | codex | no | Use this queue to separate completed, deferred, and skipped work. |
| youtube-analytics-oauth | Phase 6 | deferred | operator | no | Enable YouTube Analytics API and issue a refresh token with analytics read scope for each brand channel that needs private analytics. |
| taste-interaction-polish | Phase 5 | done | codex | no | Apply TasteSkill interaction/accessibility polish: skip link, focus rings, pointer cursors, and hover/active states. |
| first-run-next-step-guide | Phase 5 | done | codex | no | Show a three-step guide after new run creation so operators move from sources to draft execution. |
| new-run-onboarding-form | Phase 5 | done | codex | no | Rework the new-run form into brief, source, and advanced option sections with preset buttons. |
| inspector-action-focus | Phase 5 | done | codex | no | Put current-stage action buttons and required inputs in the inspector focus card, with validation/operations folded. |
| pipeline-current-stage-highlight | Phase 5 | done | codex | no | Highlight the pipeline row that matches the computed next action. |
| pipeline-stage-navigation | Phase 5 | done | codex | no | Make pipeline rows jump to the relevant search or artifact workspace and auto-select artifact tabs. |
| guided-stage-rail | Phase 5 | done | codex | no | Show the 1-10 production sequence inside the next-action panel so operators can follow the click order. |
| taste-skill-guided-inspector | Phase 5 | done | codex | no | Apply TasteSkill-style guided UX: current-stage inspector first, advanced controls folded. |
| guided-dashboard-ux | Phase 5 | done | codex | no | Default dashboard path shows one next action and hides advanced tools behind disclosure. |
| run-next-action-panel | Phase 5 | done | codex | no | Dashboard shows the next actionable step for the active run. |
| operator-status-cli | Phase 5 | done | codex | no | Use `npm run ops:status -- --storage supabase` before worker commands. |
| external-render-upload-workers | Phase 5 | deferred | external | no | Run render/upload worker polling in a separate long-running environment. |
| provider-capability-labels | Phase 4 | done | codex | no | Keep direct, manual, and pending providers visible in settings. |
| manual-provider-handoff | Phase 4 | done | codex | no | Create external generation packets for manual or adapter-pending providers. |
| provider-adapter-depth | Phase 4 | skipped | codex | yes | Reopen when a preferred provider needs direct API automation. |

The dashboard exposes the same queue summary through `GET /api/ops/work-queue`.
