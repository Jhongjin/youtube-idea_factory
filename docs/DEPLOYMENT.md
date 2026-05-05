# Deployment And Persistence

## Current State

Vercel and Supabase can host the production version. The MVP still defaults to local filesystem storage for local harness work:

- `runs/` stores production package JSON and markdown artifacts.
- `artifacts/` stores generated media files.
- `config/provider-settings.local.json` stores local provider settings and is ignored by git.

This is correct for local harness work, but not durable on Vercel serverless functions. Set `APP_STORAGE_MODE=supabase` in Vercel when production run state should be persisted.

Implemented Supabase-backed state:

- production run list and run package records
- markdown/JSON run artifacts through `run_artifacts`
- approval gates through `run_approvals`
- provider API settings through `provider_settings`
- generated image/TTS bytes and manually registered media pointers through Supabase Storage
- external worker queue records through `worker_jobs` when the latest schema is applied

Still local or adapter-specific:

- ffmpeg render execution should run in an external worker process, not inside Vercel
- provider-specific video generation adapters
- subtitle/BGM generation adapters
- final YouTube uploads should run through an external OAuth worker

## Vercel Notes

- Production deployments normally follow the production branch, usually `main`.
- Preview deployments are created from non-production branches such as `codex/dashboard-mvp`.
- Environment variables are configured per environment in Vercel Project Settings.
- Vercel environment variable changes apply to new deployments, not already-built deployments.
- `vercel.json` pins the framework preset to `nextjs` and clears the custom output directory override so a project-level static output override such as `public` does not break Next.js deployments.

If Vercel shows `No Output Directory named "public" found`, check Project Settings and remove any Output Directory override, or keep the repository `vercel.json` override in place with `outputDirectory: null`.

Recommended production environment variables:

```text
APP_STORAGE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ASSETS_BUCKET=youtube-assets
YOUTUBE_API_KEY=...
DASHBOARD_ADMIN_TOKEN=...
```

Keep provider API keys either in Vercel Environment Variables or the dashboard provider settings. Never commit `.env.local` or `config/provider-settings.local.json`.
YouTube upload OAuth secrets are only needed in the external upload worker environment, not in the browser dashboard.

External YouTube upload worker variables:

```text
APP_STORAGE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ASSETS_BUCKET=youtube-assets
YOUTUBE_OAUTH_CLIENT_ID=...
YOUTUBE_OAUTH_CLIENT_SECRET=...
YOUTUBE_OAUTH_REFRESH_TOKEN=...
```

See `docs/YOUTUBE_UPLOAD_WORKER.md` for the dry-run and upload commands, and
`docs/WORKER_QUEUE.md` for queue polling commands.

## Admin Mutation Gate

All mutating dashboard API routes (`POST`, `PUT`, `DELETE`) are protected by `proxy.ts`.
On Vercel, set `DASHBOARD_ADMIN_TOKEN` before using the production dashboard. The browser does not receive this value from the server; enter the same token in the dashboard's floating 관리자 토큰 panel so client-side requests can attach it as `X-YIF-Admin-Token`.

If `DASHBOARD_ADMIN_TOKEN` is missing on Vercel, mutating API routes return a locked response instead of running. Local development remains unrestricted unless a token is configured.

## Supabase Notes

Use Supabase for durable run state, approvals, provider settings, logs, and media storage pointers. The seed schema lives at:

- `docs/templates/supabase-schema.sql`

Initial policy:

1. Apply the schema in Supabase SQL Editor after review.
2. Keep row level security enabled.
3. Do not add public table policies until the auth model is decided.
4. Use `SUPABASE_SERVICE_ROLE_KEY` only from server-side adapters.
5. Treat `provider_settings.api_key` as server-only secret material. Move to Supabase Vault or a dedicated secrets manager before multi-user operation.
6. Store generated image/TTS binaries in Supabase Storage. By default the server adapters use the private `youtube-assets` bucket unless `SUPABASE_ASSETS_BUCKET` is set.

When `APP_STORAGE_MODE=supabase`, these dashboard APIs use Supabase instead of local files:

- `GET/POST /api/runs`
- `DELETE /api/runs/:runId`
- `GET/PUT /api/runs/:runId/artifacts/:artifactId`
- `GET /api/runs/:runId/artifacts`
- `GET/PUT /api/runs/:runId/approvals`
- `GET/PUT /api/settings/providers`
- `POST /api/runs/:runId/analytics/insights`
- `POST /api/runs/:runId/analytics/snapshot`
- `POST /api/runs/:runId/sources/import`
- `POST /api/runs/:runId/sources/enrich`
- `GET/PUT /api/runs/:runId/transcripts/:sourceKey`
- `GET /api/runs/:runId/worker-jobs`
- `PATCH /api/runs/:runId/worker-jobs/:jobId`
- text draft/refinement routes for analysis, script, storyboard, media prompts, publishing package, QA, asset manifest, generation queue, image/TTS generation, manual media registration, and render manifest checks
- render/upload job queue creation records in `worker_jobs` when the table exists

These routes remain local-worker or adapter-specific:

- subtitle asset file generation
- local MP4 render
- external ffmpeg render worker execution
- external YouTube upload worker execution

External workers can run one queued job with `--next` or keep polling with `--poll`. They claim
rows from `worker_jobs` and keep the queue status in sync with the JSON job artifacts.

## Readiness Checks

Local CLI:

```powershell
python .\scripts\check_deployment_ready.py --target vercel
```

Runtime API:

```text
GET /api/health/deployment
```

The `/settings` page renders the same readiness model with Supabase tables, provider role status, and the external render/upload worker command requirements.

The readiness check intentionally blocks Vercel production operations while `APP_STORAGE_MODE=local`, because local run and artifact writes are not durable in serverless production.

## References

- Vercel environment variables: https://vercel.com/docs/projects/environment-variables
- Vercel project settings: https://vercel.com/docs/projects/project-configuration/project-settings
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
