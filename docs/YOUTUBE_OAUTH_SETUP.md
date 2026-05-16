# YouTube OAuth Setup

This guide is for preparing brand-channel OAuth values used by `/admin/channels`,
the YouTube upload worker, and the Analytics feedback loop.

## What To Create

Use one Google Cloud project for the app unless a client requires isolated billing or
security ownership.

1. Enable APIs in Google Cloud.
   - YouTube Data API v3 for uploads and public video metadata.
   - YouTube Analytics API for private channel/video performance metrics.
2. Configure the OAuth consent screen.
   - Add the Google accounts that own or manage the YouTube channels as test users while the app is in testing.
   - If Google shows an unverified-app warning, keep the app in testing for internal operations or complete Google's verification before public use.
3. Create an OAuth client.
   - Use a Desktop app client for manual local refresh-token issuance.
   - Use a Web application client only when a hosted OAuth callback flow is added to this dashboard.
4. Issue refresh tokens per brand channel.
   - Upload token scope: `https://www.googleapis.com/auth/youtube.upload`
   - Analytics token scope: `https://www.googleapis.com/auth/yt-analytics.readonly`
5. Store values.
   - Put `YOUTUBE_OAUTH_CLIENT_ID` and `YOUTUBE_OAUTH_CLIENT_SECRET` in Vercel env vars and local `.env.local`.
   - Put each channel's refresh tokens in `/admin/channels`.
   - Keep the channel status as `설정 중` until the token is verified, then switch it to `운영 중`.

## Refresh Token Requirements

Google only returns a refresh token for offline access. When generating tokens, request
offline access. If a Google account already granted consent and no refresh token is
returned, revoke the old grant or force a new consent screen before trying again.

For this project:

- The upload worker reads `youtube_channels.upload_refresh_token` when the run has a selected channel.
- The global `YOUTUBE_OAUTH_REFRESH_TOKEN` remains a compatibility fallback.
- The Analytics snapshot uses `youtube_channels.analytics_refresh_token` when the run has a selected channel.

## Channel Checklist

For each brand channel:

1. Confirm the Google account can access the target YouTube channel.
2. Generate an upload refresh token with `youtube.upload`.
3. Generate an Analytics refresh token with `yt-analytics.readonly` if private analytics are needed.
4. Register or edit the channel in `/admin/channels`.
5. Save tokens, keep status `설정 중`, then verify readiness.
6. Switch to `운영 중` only when this channel should be eligible for upload jobs.

## Official References

- [Google OAuth 2.0 scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [YouTube Analytics OAuth for desktop apps](https://developers.google.com/youtube/reporting/guides/authorization/installed-apps)
- [YouTube Analytics OAuth for server-side web apps](https://developers.google.com/youtube/reporting/guides/authorization/server-side-web-apps)
