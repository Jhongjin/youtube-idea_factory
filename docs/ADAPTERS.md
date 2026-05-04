# Provider Adapters

Adapters keep the dashboard independent from provider-specific payloads.

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
