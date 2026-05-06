# Worker Queue

The dashboard can queue external worker jobs in `public.worker_jobs` while still writing the
JSON handoff artifacts used by the original manual CLI flow.

## Queue Records

`worker_jobs` stores:

- `kind`: `render`, `youtube-upload`, or future generation job kinds
- `status`: `queued`, `running`, `completed`, `failed`, or `cancelled`
- `run_id`
- `job_artifact_key`
- `log_artifact_key`
- `attempts`
- `last_error`
- `payload`

The queue is intentionally an execution index. The canonical job payloads remain in run artifacts
such as `render-worker-job.json` and `youtube-upload-job.json`.

## Operator Status

List recent run IDs and queued worker jobs before running a worker command:

```powershell
npm run ops:status -- --storage supabase
```

The worker CLI scripts automatically load `.env.local` from the project root. Copy `.env.example`
to `.env.local`, fill the Supabase and YouTube OAuth values, and keep that file out of git.
PowerShell `$env:` values override `.env.local` for the current terminal.

The command prints real `run-id` values and an upload dry-run example so placeholders such as
`<run-id>` are not pasted into PowerShell.

If this command reports `Supabase request failed`, first confirm the current PowerShell window has
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set. If worker commands only work when
`NODE_TLS_REJECT_UNAUTHORIZED=0` is set, fix the local Windows/Node certificate trust path before
running unattended workers.

On Node 24+, try the system certificate store first:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm run ops:status -- --storage supabase
```

If your network or antivirus injects a private root CA that Node still cannot see, export that root
certificate as a PEM file and set `NODE_EXTRA_CA_CERTS`:

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\path\to\company-root-ca.pem"
npm run ops:status -- --storage supabase
```

Use `NODE_TLS_REJECT_UNAUTHORIZED=0` only as a short-lived local diagnostic workaround.
If a terminal was already set to that workaround, remove it before running real workers:

```powershell
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
```

If the warning returns after opening a fresh terminal, check whether `NODE_TLS_REJECT_UNAUTHORIZED=0`
was added to Windows environment variables or `.env.local`, then remove it there as well.
On Windows, a user-level variable can override a safer machine-level value:

```powershell
[Environment]::GetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", "User")
[Environment]::GetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", "Machine")
[Environment]::SetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", $null, "User")
```

## Render Worker

Direct run:

```powershell
npm run render:worker -- --run-id <run-id> --confirm RUN_RENDER_WORKER --storage supabase
```

Claim one queued render job:

```powershell
npm run render:worker -- --next --confirm RUN_RENDER_WORKER --storage supabase
```

Poll continuously:

```powershell
npm run render:worker -- --poll --confirm RUN_RENDER_WORKER --storage supabase --interval-seconds 15
```

## YouTube Upload Worker

Direct preflight:

```powershell
npm run youtube:upload-worker -- --run-id <run-id> --confirm RUN_YOUTUBE_UPLOAD --storage supabase --dry-run
```

Direct upload:

```powershell
npm run youtube:upload-worker -- --run-id <run-id> --confirm RUN_YOUTUBE_UPLOAD --storage supabase
```

Claim one queued upload job:

```powershell
npm run youtube:upload-worker -- --next --confirm RUN_YOUTUBE_UPLOAD --storage supabase
```

Poll continuously:

```powershell
npm run youtube:upload-worker -- --poll --confirm RUN_YOUTUBE_UPLOAD --storage supabase --interval-seconds 15
```

## Notes

- `--next` defaults to one claimed job or an idle result; `--max-jobs <n>` can process more.
- `--poll` keeps checking the queue; use `--max-jobs <n>` for bounded worker runs.
- Queue mode marks a row `running` before processing to reduce duplicate claims.
- `--dry-run` is supported only with explicit `--run-id`, because queue mode claims real work.
- The dashboard operations panel can cancel `queued` jobs and retry `failed` or `cancelled` jobs.
- Queue actions are exposed through `PATCH /api/runs/:runId/worker-jobs/:jobId`.
- Workers still require the same environment variables documented in `DEPLOYMENT.md` and
  `YOUTUBE_UPLOAD_WORKER.md`.
