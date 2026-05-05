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
- Workers still require the same environment variables documented in `DEPLOYMENT.md` and
  `YOUTUBE_UPLOAD_WORKER.md`.
