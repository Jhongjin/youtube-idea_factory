import { getYouTubeChannelCredentials } from "@/lib/channels";
import { getYouTubeApiKey } from "@/lib/youtube-finder";
import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type CreatePerformanceSnapshotInput = {
  videoId?: string;
};

export type PerformanceSnapshot = {
  fetched_at: string;
  source: "youtube-data-api" | "youtube-data-api+youtube-analytics-api";
  video_id: string;
  url: string;
  title: string;
  channel: string;
  channel_id: string;
  published_at: string;
  duration: string;
  thumbnail_url: string;
  statistics: {
    comment_count: number;
    like_count: number;
    view_count: number;
  };
  analytics?: {
    fetched_at: string;
    source: "youtube-analytics-api";
    start_date: string;
    end_date: string;
    metrics: {
      average_view_duration_seconds?: number;
      average_view_percentage?: number;
      comments?: number;
      estimated_minutes_watched?: number;
      likes?: number;
      shares?: number;
      subscribers_gained?: number;
      subscribers_lost?: number;
      views?: number;
    };
    raw_columns: string[];
    notes: string[];
  };
  previous?: {
    fetched_at: string;
    comment_count: number;
    like_count: number;
    view_count: number;
  };
  deltas?: {
    comment_count: number;
    like_count: number;
    view_count: number;
  };
  notes: string[];
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    snippet?: {
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        high?: { url?: string };
        maxres?: { url?: string };
        medium?: { url?: string };
        standard?: { url?: string };
      };
      title?: string;
    };
    statistics?: {
      commentCount?: string;
      likeCount?: string;
      viewCount?: string;
    };
  }>;
};

type UploadLog = {
  video_id?: string;
  video_url?: string;
};

type AnalyticsResponse = {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<number | string>>;
};

const videosEndpoint = "https://www.googleapis.com/youtube/v3/videos";
const analyticsEndpoint = "https://youtubeanalytics.googleapis.com/v2/reports";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const historyPath = "09-performance-history.json";
const snapshotPath = "09-performance-snapshot.json";
const snapshotMarkdownPath = "09-performance-snapshot.md";
const analyticsMetricNames = [
  "views",
  "likes",
  "comments",
  "shares",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "subscribersGained",
  "subscribersLost",
];

function parseNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeYouTubeVideoId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    const fromQuery = parsed.searchParams.get("v") ?? "";
    if (fromQuery) {
      return fromQuery.trim();
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const markerIndex = parts.findIndex((part) => part === "shorts" || part === "embed");
    if (markerIndex >= 0 && parts[markerIndex + 1]) {
      return parts[markerIndex + 1].trim();
    }
    if (parsed.hostname.includes("youtu.be") && parts[0]) {
      return parts[0].trim();
    }
  } catch {
    // Treat plain strings as candidate video IDs below.
  }

  return trimmed;
}

function assertVideoId(value: string) {
  const videoId = normalizeYouTubeVideoId(value);
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    throw new Error("A valid YouTube video ID or URL is required for performance snapshot.");
  }
  return videoId;
}

async function inferVideoId(pkg: ProductionPackage, input: CreatePerformanceSnapshotInput) {
  if (input.videoId?.trim()) {
    return assertVideoId(input.videoId);
  }
  if (pkg.publishing_handoff?.uploaded_video_id) {
    return assertVideoId(pkg.publishing_handoff.uploaded_video_id);
  }
  if (pkg.publishing_handoff?.uploaded_video_url) {
    return assertVideoId(pkg.publishing_handoff.uploaded_video_url);
  }
  const uploadLog = await readRunFileIfExists(pkg.run_id, "youtube-upload-log.json")
    .then((content) => (content ? (JSON.parse(content) as UploadLog) : null))
    .catch(() => null);
  if (uploadLog?.video_id) {
    return assertVideoId(uploadLog.video_id);
  }
  if (uploadLog?.video_url) {
    return assertVideoId(uploadLog.video_url);
  }
  throw new Error("No uploaded YouTube video ID found. Provide a videoId after upload.");
}

async function fetchYouTubeStats(videoId: string) {
  const apiKey = await getYouTubeApiKey();
  const url = new URL(videosEndpoint);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,contentDetails,statistics");
  url.searchParams.set("id", videoId);

  const response = await fetch(url, {
    headers: { "User-Agent": "youtube-idea-factory/0.1" },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`YouTube performance API ${response.status}: ${detail.slice(0, 240)}`);
  }
  const body = (await response.json()) as VideosResponse;
  const item = body.items?.[0];
  if (!item) {
    throw new Error("YouTube video was not found or is not accessible with the configured API key.");
  }
  return item;
}

function utcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function analyticsDateRange(publishedAt?: string) {
  const endDate = utcDate(new Date());
  const fallbackStart = new Date();
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 90);
  const published = publishedAt ? new Date(publishedAt) : fallbackStart;
  const startDate =
    Number.isFinite(published.getTime()) && published.getTime() <= Date.now()
      ? utcDate(published)
      : utcDate(fallbackStart);
  return { endDate, startDate: startDate > endDate ? endDate : startDate };
}

async function getAnalyticsAccessToken(refreshToken: string) {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET are required.");
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description ?? body?.error ?? `OAuth refresh failed with ${response.status}`);
  }
  return body.access_token;
}

function analyticsMetricKey(name: string) {
  const keys: Record<string, keyof NonNullable<PerformanceSnapshot["analytics"]>["metrics"]> = {
    averageViewDuration: "average_view_duration_seconds",
    averageViewPercentage: "average_view_percentage",
    comments: "comments",
    estimatedMinutesWatched: "estimated_minutes_watched",
    likes: "likes",
    shares: "shares",
    subscribersGained: "subscribers_gained",
    subscribersLost: "subscribers_lost",
    views: "views",
  };
  return keys[name];
}

function parseAnalyticsSnapshot(
  body: AnalyticsResponse,
  startDate: string,
  endDate: string,
): NonNullable<PerformanceSnapshot["analytics"]> {
  const headers = body.columnHeaders?.map((header) => header.name ?? "") ?? [];
  const row = body.rows?.[0] ?? [];
  const metrics: NonNullable<PerformanceSnapshot["analytics"]>["metrics"] = {};
  headers.forEach((name, index) => {
    const key = analyticsMetricKey(name);
    if (key) {
      metrics[key] = parseNumber(row[index]);
    }
  });

  return {
    end_date: endDate,
    fetched_at: new Date().toISOString(),
    metrics,
    notes:
      body.rows && body.rows.length > 0
        ? ["Uses the selected channel analytics OAuth refresh token."]
        : ["YouTube Analytics API returned no rows for this video/date range yet."],
    raw_columns: headers,
    source: "youtube-analytics-api",
    start_date: startDate,
  };
}

async function fetchYouTubeAnalytics({
  publishedAt,
  refreshToken,
  videoId,
}: {
  publishedAt?: string;
  refreshToken: string;
  videoId: string;
}) {
  const { endDate, startDate } = analyticsDateRange(publishedAt);
  const accessToken = await getAnalyticsAccessToken(refreshToken);
  const url = new URL(analyticsEndpoint);
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("metrics", analyticsMetricNames.join(","));
  url.searchParams.set("filters", `video==${videoId}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "youtube-idea-factory/0.1",
    },
  });
  const body = (await response.json().catch(() => null)) as AnalyticsResponse | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message =
      body && "error" in body && body.error?.message
        ? body.error.message
        : `YouTube Analytics API ${response.status}`;
    throw new Error(message);
  }
  return parseAnalyticsSnapshot((body ?? {}) as AnalyticsResponse, startDate, endDate);
}

function thumbnailUrl(item: NonNullable<VideosResponse["items"]>[number]) {
  const thumbnails = item.snippet?.thumbnails;
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}

function previousSnapshot(runId: string) {
  return readRunJson<PerformanceSnapshot>(runId, snapshotPath).catch(() => null);
}

async function appendHistory(runId: string, snapshot: PerformanceSnapshot) {
  const history = await readRunJson<{ snapshots?: PerformanceSnapshot[]; version?: 1 }>(
    runId,
    historyPath,
  ).catch(() => ({ version: 1 as const, snapshots: [] }));
  const snapshots = [
    ...(history.snapshots ?? []).filter((item) => item.video_id === snapshot.video_id),
    snapshot,
  ].slice(-100);
  await writeRunJson(runId, historyPath, {
    latest_fetched_at: snapshot.fetched_at,
    snapshots,
    version: 1,
    video_id: snapshot.video_id,
  });
  return snapshots.length;
}

function snapshotMarkdown(snapshot: PerformanceSnapshot) {
  const previousLine = snapshot.previous
    ? `- Previous snapshot: ${snapshot.previous.fetched_at}`
    : "- Previous snapshot: none";
  const deltaLine = snapshot.deltas
    ? `- Delta: views ${snapshot.deltas.view_count}, likes ${snapshot.deltas.like_count}, comments ${snapshot.deltas.comment_count}`
    : "- Delta: first snapshot";
  return [
    "# Performance Snapshot",
    "",
    `- Video: [${snapshot.title}](${snapshot.url})`,
    `- Channel: ${snapshot.channel}`,
    `- Fetched at: ${snapshot.fetched_at}`,
    `- Published at: ${snapshot.published_at || "unknown"}`,
    "",
    "## Statistics",
    "",
    `- Views: ${snapshot.statistics.view_count}`,
    `- Likes: ${snapshot.statistics.like_count}`,
    `- Comments: ${snapshot.statistics.comment_count}`,
    previousLine,
    deltaLine,
    "",
    "## Channel Analytics",
    "",
    ...(snapshot.analytics
      ? [
          `- Source: ${snapshot.analytics.source}`,
          `- Date range: ${snapshot.analytics.start_date} to ${snapshot.analytics.end_date}`,
          `- Views: ${snapshot.analytics.metrics.views ?? "n/a"}`,
          `- Estimated minutes watched: ${snapshot.analytics.metrics.estimated_minutes_watched ?? "n/a"}`,
          `- Average view duration: ${snapshot.analytics.metrics.average_view_duration_seconds ?? "n/a"} seconds`,
          `- Shares: ${snapshot.analytics.metrics.shares ?? "n/a"}`,
          `- Subscribers gained: ${snapshot.analytics.metrics.subscribers_gained ?? "n/a"}`,
          ...snapshot.analytics.notes.map((note) => `- ${note}`),
        ]
      : ["- Not available for this snapshot."]),
    "",
    "## Notes",
    "",
    ...snapshot.notes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

export async function createPerformanceSnapshot(
  runId: string,
  input: CreatePerformanceSnapshotInput = {},
) {
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const videoId = await inferVideoId(pkg, input);
  const [item, previous] = await Promise.all([fetchYouTubeStats(videoId), previousSnapshot(runId)]);
  const now = new Date().toISOString();
  const statistics = {
    comment_count: parseNumber(item.statistics?.commentCount),
    like_count: parseNumber(item.statistics?.likeCount),
    view_count: parseNumber(item.statistics?.viewCount),
  };
  const notes = [
    "Uses public YouTube Data API video statistics.",
    "If the run has a brand channel with analytics OAuth, a YouTube Analytics API summary is attached.",
  ];
  let analytics: PerformanceSnapshot["analytics"];
  const packageChannelId = pkg.brief.channel?.id;
  if (packageChannelId) {
    const channelCredentials = await getYouTubeChannelCredentials(packageChannelId);
    const refreshToken = channelCredentials?.analytics_refresh_token?.trim();
    if (!channelCredentials) {
      notes.push("Selected brand channel record was not found for Analytics OAuth.");
    } else if (channelCredentials.status === "paused") {
      notes.push("Selected brand channel is paused, so Analytics OAuth was not used.");
    } else if (!refreshToken) {
      notes.push("Selected brand channel does not have an Analytics OAuth refresh token.");
    } else {
      try {
        analytics = await fetchYouTubeAnalytics({
          publishedAt: item.snippet?.publishedAt,
          refreshToken,
          videoId,
        });
        notes.push("Attached YouTube Analytics API metrics from the selected brand channel token.");
      } catch (error) {
        notes.push(
          `YouTube Analytics API metrics were not attached: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } else {
    notes.push("No brand channel is selected for this run, so Analytics OAuth was not used.");
  }
  const snapshot: PerformanceSnapshot = {
    fetched_at: now,
    source: analytics ? "youtube-data-api+youtube-analytics-api" : "youtube-data-api",
    video_id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: item.snippet?.title ?? "",
    channel: item.snippet?.channelTitle ?? "",
    channel_id: item.snippet?.channelId ?? "",
    published_at: item.snippet?.publishedAt ?? "",
    duration: item.contentDetails?.duration ?? "",
    thumbnail_url: thumbnailUrl(item),
    statistics,
    ...(analytics ? { analytics } : {}),
    notes,
  };
  if (previous) {
    snapshot.previous = {
      fetched_at: previous.fetched_at,
      comment_count: previous.statistics.comment_count,
      like_count: previous.statistics.like_count,
      view_count: previous.statistics.view_count,
    };
    snapshot.deltas = {
      comment_count: statistics.comment_count - previous.statistics.comment_count,
      like_count: statistics.like_count - previous.statistics.like_count,
      view_count: statistics.view_count - previous.statistics.view_count,
    };
  }

  const snapshotCount = await appendHistory(runId, snapshot);

  pkg.feedback_loop = {
    comment_count: statistics.comment_count,
    fetched_at: now,
    like_count: statistics.like_count,
    path: snapshotPath,
    source: snapshot.source,
    snapshot_count: snapshotCount,
    video_id: videoId,
    view_count: statistics.view_count,
  };

  await Promise.all([
    writeRunJson(runId, snapshotPath, snapshot),
    writeRunFile(runId, snapshotMarkdownPath, snapshotMarkdown(snapshot)),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return snapshot;
}
