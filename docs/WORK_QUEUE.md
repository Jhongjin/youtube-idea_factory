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
| dashboard-sidebar-simplify | Phase 7 | done | codex | no | Dashboard sidebar now keeps channel memory, work queue, and automation tools behind compact disclosures. |
| dashboard-primary-cta | Phase 7 | done | codex | no | Dashboard guided steps now mark the active step and lift the next executable action into a larger primary CTA. |
| health-security-copy | Phase 7 | done | codex | no | Deployment health now reports session-protected mutation gates instead of legacy token-only wording. |
| new-run-channel-clarity | Phase 7 | done | codex | no | The new-run form now confirms the selected brand channel and upload token state before creation. |
| upload-worker-channel-token-readiness | Phase 7 | done | codex | no | Deployment health now treats channel-specific upload refresh tokens as valid YouTube upload worker readiness. |
| upload-active-channel-gate | Phase 7 | done | codex | no | YouTube upload job creation and workers now require the selected brand channel to be active. |
| channel-token-readiness-insight | Phase 7 | done | codex | no | Deployment health and settings now show active, setup, and paused channel upload token inventory. |
| dashboard-channel-context-bar | Phase 7 | done | codex | no | Dashboard operating channel bar now includes upload token state and a 3-step operator flow lane. |
| dashboard-sidebar-channel-disclosure | Phase 7 | done | codex | no | Sidebar channel filters are collapsed behind a compact disclosure because channel choice is now primary in the top bar. |
| dashboard-single-channel-default | Phase 7 | done | codex | no | Dashboard defaults to the only registered channel while preserving an explicit all-channel view. |
| dashboard-channel-upload-nudge | Phase 7 | done | codex | no | Dashboard now warns when the selected channel is not active or lacks upload OAuth before upload steps. |
| admin-channel-status-clarity | Phase 7 | done | codex | no | Channel management cards now explain whether each channel is upload-ready, needs activation, or is blocked. |
| new-run-channel-readiness-warning | Phase 7 | done | codex | no | New-run form now explains selected channel upload readiness before creating a production run. |
| run-delete-dashboard-redirect | Phase 7 | done | codex | no | Deleting a run now returns operators to `/dashboard` instead of the public homepage. |
| dashboard-action-step-redirects | Phase 7 | done | codex | no | Production action buttons now return to the matching guided dashboard step and artifact anchor. |
| dashboard-empty-state-new-run-main | Phase 7 | done | codex | no | Empty dashboard states now show the new-run form in the main guided workspace instead of only the inspector. |
| admin-channel-activate-action | Phase 7 | done | codex | no | Channel cards now offer a quick action to switch setup or paused channels to active. |
| dashboard-refresh-link | Phase 7 | done | codex | no | Dashboard refresh control now reloads the current run and guided step instead of being an inert button. |
| auth-admin-approval-ux | Phase 7 | done | codex | no | Pending logins now explain the admin approval path, `/admin` shows a quick approve action, and non-admin admin-page access returns to the dashboard with a clear notice. |
| new-run-preserve-channel-context | Phase 7 | done | codex | no | New production runs now redirect back to the selected brand channel, created run, and research step after creation. |
| dashboard-single-primary-action | Phase 7 | done | codex | no | The right inspector now explains state only; the executable next-step button stays in the central guided card. |
| dashboard-sidebar-runs-first | Phase 7 | done | codex | no | Sidebar now prioritizes channel and run selection; the static section list is folded behind a disclosure. |
| dashboard-research-step-focus | Phase 7 | done | codex | no | Research now shows source review first when sources exist, keeps Finder behind a reinforcement disclosure, and preserves channel context after imports. |
| artifact-review-first | Phase 7 | done | codex | no | Artifact panels now show a readable preview first and keep raw markdown editing behind an explicit disclosure. |
| dashboard-advanced-tools-soften | Phase 7 | done | codex | no | Topbar advanced tools are now an icon-only overflow control so the guided next-step CTA remains visually dominant. |
| remove-legacy-dashboard-panels | Phase 7 | done | codex | no | Removed unused legacy next-action and first-run dashboard panels so the guided workflow remains the only maintained path. |
| channel-activation-guidance | Phase 7 | done | codex | no | Channel admin now highlights upload-token channels that still need activation and sorts those cards first. |
| channel-oauth-inline-guide | Phase 7 | done | codex | no | Channel registration now includes a compact OAuth preparation guide for client setup, scopes, refresh tokens, and activation. |
| new-run-form-simplification | Phase 7 | done | codex | no | New production creation now shows only channel, topic, source URL, and format presets first; detailed knobs are collapsed. |
| remove-sidebar-section-map | Phase 7 | done | codex | no | Removed the non-clickable sidebar section map so channel/run selection and the central guided steps remain the primary navigation. |
| contextual-advanced-tools | Phase 7 | done | codex | no | Advanced tools now show only actions relevant to the active guided step instead of the full production action grid. |
| homepage-hero-overlap-fix | Phase 7 | done | codex | no | Homepage hero now uses a real two-column grid so the product title no longer collides with the gallery preview at desktop widths. |
| youtube-oauth-setup-guide | Phase 7 | done | codex | no | Added a Google/YouTube OAuth setup guide and linked it from the channel registration guide. |
| channel-token-placeholder-clarity | Phase 7 | done | codex | no | Channel token fields now ask for actual refresh token values instead of placeholder text that looked like OAuth scope strings. |
| admin-channel-page-polish | Phase 7 | done | codex | no | Channel admin now leads with operational channel cards, shows a contained ready/warning banner, and folds per-channel edit controls. |
| settings-provider-progressive-disclosure | Phase 7 | done | codex | no | Provider settings now show role readiness summary first and fold API/model fields behind per-role disclosures. |
| dashboard-focus-layout-pass | Phase 7 | done | codex | no | Dashboard channel context is compacted into a current-channel header, folded channel switcher, and shorter three-step focus rail. |
| homepage-product-preview-pass | Phase 7 | done | codex | no | Homepage hero now treats the production preview as a full-bleed product scene and adds compact operational signals beside the primary CTA. |
| auth-product-context-panel | Phase 7 | done | codex | no | Login and signup pages now replace decorative stock imagery with a reusable product-context panel for approval, roles, and OAuth separation. |
| admin-member-approval-focus | Phase 7 | done | codex | no | Admin member management now surfaces pending signup approvals first and folds direct user creation behind a secondary disclosure. |
| channel-token-run-propagation-audit | Phase 7 | done | codex | no | Confirmed run channel selection reaches upload jobs/workers and enriched worker channel metadata when reading per-channel upload tokens. |
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
