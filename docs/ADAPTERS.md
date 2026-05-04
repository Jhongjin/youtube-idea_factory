# Provider Adapters

Adapters keep the dashboard independent from provider-specific payloads.

## Approval Gate Contract

Status: deterministic guard and dashboard editor implemented.

Before any external adapter spends credits, renders, uploads, schedules, or publishes, it must pass:

```powershell
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate generation
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate render
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate publish
```

Run-level approvals live in `runs/:runId/approvals.json`, copied from `docs/templates/approvals.json`.

Dashboard routes:

- `GET /api/runs/:runId/approvals`
- `PUT /api/runs/:runId/approvals`

Behavior:

1. The dashboard inspector shows generation, render, and publish gates for the active run.
2. Each gate records approved status, approver, approval timestamp, and notes.
3. The API normalizes untrusted input and stores approvals only under the selected run folder.
4. Generation, render, and publishing adapters should still run the deterministic script preflight before spending credits or changing external state.

## Provider Settings

Status: local API registration page implemented.

Page:

- `/settings`

Route:

- `GET /api/settings/providers`
- `PUT /api/settings/providers`

Behavior:

1. Lets the operator choose providers for LLM, image generation, video generation, TTS, subtitles, BGM, and YouTube adapters.
2. Stores credentials in `config/provider-settings.local.json`, which is ignored by git.
3. Preserves an existing API key when the API key field is left blank during updates.
4. Returns only `hasApiKey` and a masked key preview to the browser.
5. Keeps provider-specific payloads out of the core production package until each adapter is implemented.

Adapter preflight:

```powershell
python .\scripts\check_provider_ready.py --role llm
python .\scripts\check_provider_ready.py --role image
python .\scripts\check_provider_ready.py --role youtube --require-key
```

## YouTube Finder

Status: initial implementation.

Environment:

```powershell
YOUTUBE_API_KEY=...
```

The YouTube API key can also be registered through `/settings` under the `YouTube API` provider role.

Routes:

- `POST /api/youtube/search`
- `POST /api/runs/:runId/sources/import`

Behavior:

1. Calls YouTube Data API `search.list` with `part=snippet`, `type=video`, query, order, region, language, and duration filters.
2. Calls `videos.list` with returned IDs to fetch `contentDetails` and `statistics`.
3. Returns normalized candidates with URL, title, channel, published date, duration, views, likes, comments, and thumbnail URL.
4. The dashboard can import returned candidates into the active run as source videos.

Official references:

- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/docs/videos/list

## Current Limits

- Requires a user-provided API key.
- Search ranking is only as representative as the YouTube Data API response.
- Import currently appends all returned candidates and skips duplicate URLs.
- It does not fetch transcripts yet.

## Transcript Storage

Status: manual transcript slot implemented.

Routes:

- `GET /api/runs/:runId/transcripts/:sourceKey`
- `PUT /api/runs/:runId/transcripts/:sourceKey`

Behavior:

1. Stores transcript text under `runs/:runId/transcripts/:sourceKey.txt`.
2. Updates `sources.json` and `production-package.json` with transcript status and path.
3. Keeps collection provider-agnostic until a compliant transcript adapter is chosen.

## Analysis Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/analysis/draft`

Behavior:

1. Reads `sources.json` and any available `transcripts/*.txt`.
2. Writes starter content to `02-video-analysis.md`.
3. Writes fact-check candidate rows to `03-claim-ledger.md` using simple deterministic claim heuristics.
4. Leaves final interpretation to `youtube-video-analysis` and `youtube-fact-check`.

## LLM Analysis Refinement

Status: optional provider-backed refinement implemented.

Route:

- `POST /api/runs/:runId/analysis/refine`

Behavior:

1. Reads `production-package.json`, transcripts, `02-video-analysis.md`, and `03-claim-ledger.md`.
2. Uses the selected `llm` provider from `/settings`.
3. Requires the model output to include `---FILE:02-video-analysis.md---` and `---FILE:03-claim-ledger.md---` markers before saving.
4. Rewrites both artifacts and syncs parsed claim rows into `production-package.json`.
5. Does not permit supported claim escalation without provided evidence/source context; human review remains required.

## Script Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/script/draft`

Behavior:

1. Reads `production-package.json`, `02-video-analysis.md`, and `03-claim-ledger.md`.
2. Writes a starter `04-script-plan.md` with strategy, angle candidates, hook options, beat map, and revision checklist.
3. Keeps final writing and judgment for `youtube-script-architect`.

## LLM Script Refinement

Status: optional provider-backed refinement implemented.

Route:

- `POST /api/runs/:runId/script/refine`

Behavior:

1. Reads `production-package.json`, `02-video-analysis.md`, `03-claim-ledger.md`, and the current `04-script-plan.md`.
2. Uses the selected `llm` provider from `/settings`.
3. Supports OpenAI through the Responses API.
4. Supports OpenRouter or Custom providers through an OpenAI-compatible chat completions endpoint.
5. Rewrites `04-script-plan.md` and records provider/model metadata in the artifact and package notes.
6. Fails before network calls when the LLM provider is disabled, missing a model, or missing an API key.
7. Keeps unsupported claims constrained by the claim ledger; human review is still required before storyboard, media generation, render, or publishing.

## Storyboard Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/storyboard/draft`

Behavior:

1. Reads `production-package.json` and `04-script-plan.md`.
2. Writes starter scene cards to `05-storyboard.md`.
3. Keeps final visual direction for `youtube-storyboard`.

## Media Prompt Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/media/draft`

Behavior:

1. Reads `production-package.json` and `05-storyboard.md`.
2. Writes provider-agnostic starter content to `06-media-prompts.md`.
3. Updates `production-package.json` with structured image and video prompt records.
4. Includes style bible, negative prompts, safety notes, continuity notes, thumbnail concepts, and a generation manifest.
5. Keeps paid generation behind human approval and final review by `youtube-production-qa`.

## Asset Manifest

Status: provider-agnostic manifest implemented.

Route:

- `POST /api/runs/:runId/assets/manifest`

Behavior:

1. Reads `production-package.json` media prompts and publishing thumbnail prompt.
2. Writes `asset-manifest.json` into the run folder.
3. Creates pending asset records for image, video, thumbnail, voice, subtitles, and BGM.
4. Assigns provider roles and expected output paths under `artifacts/:runId/`.
5. Marks assets as `pending_approval` so generation adapters can require `check_approval_gate.py --gate generation` before spending credits.
6. Updates `production-package.json` with manifest item counts and pending approval count.

## Publishing Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/publishing/draft`

Behavior:

1. Reads `production-package.json`, `04-script-plan.md`, `06-media-prompts.md`, and `03-claim-ledger.md`.
2. Writes title candidates, description draft, tags, thumbnail prompt, and upload checklist to `07-publishing-package.md`.
3. Updates `production-package.json` with the structured publishing package.
4. Flags needs-evidence rows in the description draft so upload approval cannot ignore unresolved claims.
5. Keeps upload, scheduling, and public publishing behind a human approval gate.

## QA Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/qa/draft`

Behavior:

1. Reads `production-package.json` and production artifacts `03` through `07`.
2. Writes blockers, warnings, fix list, approval checklist, coverage snapshot, and policy notes to `08-qa.md`.
3. Updates `production-package.json` with `qa.status`, `blockers`, `warnings`, `fix_list`, `approval_checklist`, and `publish_readiness`.
4. Blocks publishing when supported claims are missing, unresolved claims remain, script placeholders remain, or required artifacts are incomplete.
5. Keeps paid generation, final render, scheduling, and upload behind explicit human approval.
