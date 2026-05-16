# YouTube Upload Worker

The dashboard never uploads to YouTube directly from the browser. It creates a reviewed
`youtube-upload-job.json`, then an external worker uploads the final MP4 with OAuth.

## Required OAuth Values

Use a Google Cloud OAuth client with the YouTube upload scope:

```text
https://www.googleapis.com/auth/youtube.upload
```

Worker environment variables:

```powershell
$env:YOUTUBE_OAUTH_CLIENT_ID="..."
$env:YOUTUBE_OAUTH_CLIENT_SECRET="..."
$env:YOUTUBE_OAUTH_REFRESH_TOKEN="..." # fallback when a run has no selected channel
```

For Supabase-backed production runs, the worker also needs server-side storage access:

```powershell
$env:APP_STORAGE_MODE="supabase"
$env:NEXT_PUBLIC_SUPABASE_URL="..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:SUPABASE_ASSETS_BUCKET="youtube-assets"
```

Do not paste the OAuth refresh token into the dashboard UI or commit it to the repository.

For channel-linked runs, `/admin/channels` stores the per-channel upload refresh token in
`youtube_channels.upload_refresh_token`. The upload job records the selected channel ID but not
the secret; the external worker reads the token server-side through Supabase service role access
or `config/youtube-channels.local.json` in local mode.

Channel-linked uploads require the channel status to be `active`. A `setup` or `paused` channel can
store OAuth inventory, but upload job creation and the external worker will stop before publishing.

## Dashboard Sequence

1. Finish the production package and final render.
2. Approve the publish gate in the dashboard.
3. Run `Publish Check`.
4. Run `Upload Job` and choose visibility, optional schedule, and made-for-kids status. If the run
   has a selected brand channel, that channel's upload token is used.
5. Run the external worker from a trusted terminal.

## Preflight

Before uploading, verify that OAuth refresh, the upload job, and the final media files are reachable:

```powershell
npm run youtube:upload-worker -- --run-id <run-id> --confirm RUN_YOUTUBE_UPLOAD --storage supabase --dry-run
```

`--dry-run` does not create a YouTube video. In Supabase mode it may download the referenced
video and thumbnail into the worker temp folder to prove the worker can read them.

## Upload

After the dry run succeeds:

```powershell
npm run youtube:upload-worker -- --run-id <run-id> --confirm RUN_YOUTUBE_UPLOAD --storage supabase
```

If `public.worker_jobs` is enabled, a worker can claim the next queued upload job without a run id:

```powershell
npm run youtube:upload-worker -- --next --confirm RUN_YOUTUBE_UPLOAD --storage supabase
```

For a long-running worker process:

```powershell
npm run youtube:upload-worker -- --poll --confirm RUN_YOUTUBE_UPLOAD --storage supabase --interval-seconds 15
```

Use `--max-jobs <n>` to stop a polling worker after a fixed number of jobs. `--dry-run` is only
supported with explicit `--run-id`; queue mode claims work and should only be used for real uploads.

The worker writes:

- `youtube-upload-log.json`
- updated `youtube-upload-job.json`
- updated `production-package.json`

The dashboard operations panel reads those files and shows upload status, failure messages,
thumbnail status, and the final YouTube URL when the upload completes.
If `public.worker_jobs` exists in Supabase, the upload job and worker also update a durable queue
record so future polling workers can discover and report jobs without scanning artifact files.

The upload job defaults to `private` visibility. If a scheduled publish time is set, the worker
forces YouTube privacy to `private` because YouTube requires scheduled uploads to be private first.
