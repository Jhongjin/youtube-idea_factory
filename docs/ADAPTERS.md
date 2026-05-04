# Provider Adapters

Adapters keep the dashboard independent from provider-specific payloads.

## Approval Gate Contract

Status: deterministic guard implemented.

Before any external adapter spends credits, renders, uploads, schedules, or publishes, it must pass:

```powershell
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate generation
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate render
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate publish
```

Run-level approvals live in `runs/:runId/approvals.json`, copied from `docs/templates/approvals.json`.

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

## YouTube Finder

Status: initial implementation.

Environment:

```powershell
YOUTUBE_API_KEY=...
```

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

## Script Draft

Status: deterministic starter draft implemented.

Route:

- `POST /api/runs/:runId/script/draft`

Behavior:

1. Reads `production-package.json`, `02-video-analysis.md`, and `03-claim-ledger.md`.
2. Writes a starter `04-script-plan.md` with strategy, angle candidates, hook options, beat map, and revision checklist.
3. Keeps final writing and judgment for `youtube-script-architect`.

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
