import { getYouTubeApiKey } from "@/lib/youtube-finder";
import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type CreatePerformanceSnapshotInput = {
  videoId?: string;
};

export type PerformanceSnapshot = {
  fetched_at: string;
  source: "youtube-data-api";
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

const videosEndpoint = "https://www.googleapis.com/youtube/v3/videos";
const snapshotPath = "09-performance-snapshot.json";
const snapshotMarkdownPath = "09-performance-snapshot.md";

function parseNumber(value: string | undefined) {
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
  const snapshot: PerformanceSnapshot = {
    fetched_at: now,
    source: "youtube-data-api",
    video_id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: item.snippet?.title ?? "",
    channel: item.snippet?.channelTitle ?? "",
    channel_id: item.snippet?.channelId ?? "",
    published_at: item.snippet?.publishedAt ?? "",
    duration: item.contentDetails?.duration ?? "",
    thumbnail_url: thumbnailUrl(item),
    statistics,
    notes: [
      "Uses public YouTube Data API video statistics.",
      "Private or restricted uploads may require a future OAuth analytics adapter.",
    ],
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

  pkg.feedback_loop = {
    comment_count: statistics.comment_count,
    fetched_at: now,
    like_count: statistics.like_count,
    path: snapshotPath,
    source: snapshot.source,
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
