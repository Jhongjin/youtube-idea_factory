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
$env:YOUTUBE_OAUTH_REFRESH_TOKEN="..."
```

For Supabase-backed production runs, the worker also needs server-side storage access:

```powershell
$env:APP_STORAGE_MODE="supabase"
$env:NEXT_PUBLIC_SUPABASE_URL="..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:SUPABASE_ASSETS_BUCKET="youtube-assets"
```

Do not paste the OAuth refresh token into the dashboard UI or commit it to the repository.

## Dashboard Sequence

1. Finish the production package and final render.
2. Approve the publish gate in the dashboard.
3. Run `Publish Check`.
4. Run `Upload Job` and choose visibility, optional schedule, and made-for-kids status.
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

The worker writes:

- `youtube-upload-log.json`
- updated `youtube-upload-job.json`
- updated `production-package.json`

The upload job defaults to `private` visibility. If a scheduled publish time is set, the worker
forces YouTube privacy to `private` because YouTube requires scheduled uploads to be private first.
