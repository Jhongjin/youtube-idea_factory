import { getProviderSettings } from "@/lib/provider-settings";

export type YouTubeSearchInput = {
  query?: string;
  maxResults?: number;
  order?: "date" | "rating" | "relevance" | "title" | "videoCount" | "viewCount";
  regionCode?: string;
  relevanceLanguage?: string;
  publishedAfter?: string;
  videoCategoryId?: string;
  videoDuration?: "any" | "short" | "medium" | "long";
};

export type YouTubeVideoCategory = {
  assignable: boolean;
  id: string;
  title: string;
};

export type YouTubeCandidate = {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

type SearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      publishedAt?: string;
      description?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
};

type CategoriesResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      assignable?: boolean;
      title?: string;
    };
  }>;
};

const categoriesEndpoint = "https://www.googleapis.com/youtube/v3/videoCategories";
const searchEndpoint = "https://www.googleapis.com/youtube/v3/search";
const videosEndpoint = "https://www.googleapis.com/youtube/v3/videos";

export async function getYouTubeApiKey() {
  const settings = await getProviderSettings();
  const settingsApiKey = settings.roles.youtube.enabled
    ? settings.roles.youtube.apiKey?.trim()
    : "";
  const apiKey = settingsApiKey || process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("YouTube API key is not configured. Add it at /settings or set YOUTUBE_API_KEY.");
  }
  return apiKey;
}

function clampMaxResults(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 10;
  }
  return Math.max(1, Math.min(25, Math.floor(value ?? 10)));
}

function parseNumber(value: string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDuration(duration: string | undefined) {
  if (!duration) {
    return 0;
  }
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return 0;
  }
  const [, days, hours, minutes, seconds] = match;
  return (
    parseNumber(days) * 86400 +
    parseNumber(hours) * 3600 +
    parseNumber(minutes) * 60 +
    parseNumber(seconds)
  );
}

async function fetchJson<T>(url: URL) {
  const response = await fetch(url, {
    headers: { "User-Agent": "youtube-idea-factory/0.1" },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`YouTube API ${response.status}: ${detail.slice(0, 240)}`);
  }

  return (await response.json()) as T;
}

export async function searchYouTubeVideos(input: YouTubeSearchInput) {
  const query = input.query?.trim() ?? "";
  const videoCategoryId = input.videoCategoryId?.trim() ?? "";
  if (!query && !videoCategoryId) {
    throw new Error("Search query or YouTube category is required.");
  }

  const apiKey = await getYouTubeApiKey();
  const maxResults = clampMaxResults(input.maxResults);
  const searchUrl = new URL(searchEndpoint);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("order", input.order ?? "viewCount");
  searchUrl.searchParams.set("safeSearch", "moderate");

  if (query) {
    searchUrl.searchParams.set("q", query);
  }
  if (videoCategoryId) {
    searchUrl.searchParams.set("videoCategoryId", videoCategoryId);
  }
  if (input.regionCode) {
    searchUrl.searchParams.set("regionCode", input.regionCode);
  }
  if (input.relevanceLanguage) {
    searchUrl.searchParams.set("relevanceLanguage", input.relevanceLanguage);
  }
  if (input.publishedAfter) {
    searchUrl.searchParams.set("publishedAfter", input.publishedAfter);
  }
  if (input.videoDuration && input.videoDuration !== "any") {
    searchUrl.searchParams.set("videoDuration", input.videoDuration);
  }

  const search = await fetchJson<SearchResponse>(searchUrl);
  const items = search.items ?? [];
  const ids = items
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  const detailById = new Map<string, NonNullable<VideosResponse["items"]>[number]>();
  if (ids.length > 0) {
    const videosUrl = new URL(videosEndpoint);
    videosUrl.searchParams.set("key", apiKey);
    videosUrl.searchParams.set("part", "contentDetails,statistics");
    videosUrl.searchParams.set("id", ids.join(","));

    const videos = await fetchJson<VideosResponse>(videosUrl);
    for (const item of videos.items ?? []) {
      if (item.id) {
        detailById.set(item.id, item);
      }
    }
  }

  return items
    .map((item): YouTubeCandidate | null => {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet) {
        return null;
      }

      const detail = detailById.get(videoId);
      const duration = detail?.contentDetails?.duration ?? "";

      return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title ?? "",
        channel: snippet.channelTitle ?? "",
        channelId: snippet.channelId ?? "",
        publishedAt: snippet.publishedAt ?? "",
        description: snippet.description ?? "",
        thumbnailUrl:
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.medium?.url ??
          snippet.thumbnails?.default?.url ??
          "",
        duration,
        durationSeconds: parseIsoDuration(duration),
        viewCount: parseNumber(detail?.statistics?.viewCount),
        likeCount: parseNumber(detail?.statistics?.likeCount),
        commentCount: parseNumber(detail?.statistics?.commentCount),
      };
    })
    .filter((candidate): candidate is YouTubeCandidate => candidate !== null);
}

export async function listYouTubeVideoCategories(regionCode = "KR") {
  const apiKey = await getYouTubeApiKey();
  const categoriesUrl = new URL(categoriesEndpoint);
  categoriesUrl.searchParams.set("key", apiKey);
  categoriesUrl.searchParams.set("part", "snippet");
  categoriesUrl.searchParams.set("regionCode", regionCode.trim() || "KR");

  const response = await fetchJson<CategoriesResponse>(categoriesUrl);
  return (response.items ?? [])
    .map((item): YouTubeVideoCategory | null => {
      if (!item.id || !item.snippet?.title) {
        return null;
      }
      return {
        assignable: item.snippet.assignable ?? true,
        id: item.id,
        title: item.snippet.title,
      };
    })
    .filter((category): category is YouTubeVideoCategory => Boolean(category?.assignable));
}
