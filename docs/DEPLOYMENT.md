# Deployment And Persistence

## Current State

Vercel and Supabase can host the production version, but the MVP still defaults to local filesystem storage:

- `runs/` stores production package JSON and markdown artifacts.
- `artifacts/` stores generated media files.
- `config/provider-settings.local.json` stores local provider settings and is ignored by git.

This is correct for local harness work, but not durable on Vercel serverless functions. Vercel can run the dashboard, but writes to the application filesystem should not be treated as persistent production data.

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
YOUTUBE_API_KEY=...
```

Keep provider API keys either in Vercel Environment Variables or the dashboard provider settings. Never commit `.env.local` or `config/provider-settings.local.json`.

## Supabase Notes

Use Supabase for durable run state, approvals, logs, and later media storage pointers. The seed schema lives at:

- `docs/templates/supabase-schema.sql`

Initial policy:

1. Apply the schema in Supabase SQL Editor after review.
2. Keep row level security enabled.
3. Do not add public table policies until the auth model is decided.
4. Use `SUPABASE_SERVICE_ROLE_KEY` only from server-side adapters.
5. Store large binary media in Supabase Storage or object storage, with table rows tracking storage paths and provenance.

## Readiness Checks

Local CLI:

```powershell
python .\scripts\check_deployment_ready.py --target vercel
```

Runtime API:

```text
GET /api/health/deployment
```

The readiness check intentionally blocks Vercel production operations while `APP_STORAGE_MODE=local`, because local run and artifact writes are not durable in serverless production.

## References

- Vercel environment variables: https://vercel.com/docs/projects/environment-variables
- Vercel project settings: https://vercel.com/docs/projects/project-configuration/project-settings
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
