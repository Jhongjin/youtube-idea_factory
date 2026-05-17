import { getProviderSettings } from "@/lib/provider-settings";
import { decodeHtmlEntities } from "@/lib/html-text";

export type YouTubeSearchInput = {
  categoryTitle?: string;
  query?: string;
  maxResults?: number;
  minResults?: number;
  order?: "date" | "rating" | "relevance" | "title" | "videoCount" | "viewCount";
  regionCode?: string;
  relevanceLanguage?: string;
  publishedAfter?: string;
  safeSearch?: "moderate" | "none" | "strict";
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
  searchPublishedAfter?: string;
  searchQuery?: string;
  searchScope?: string;
};

type YouTubeSearchAttempt = YouTubeSearchInput & {
  query: string;
  requiredTerms?: string[];
  searchScope: string;
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
  return Math.max(1, Math.min(50, Math.floor(value ?? 10)));
}

function clampMinResults(value: number | undefined, maxResults: number) {
  if (!Number.isFinite(value)) {
    return Math.min(10, maxResults);
  }
  return Math.max(1, Math.min(maxResults, Math.floor(value ?? 10)));
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

function normalizeLanguage(language: string | undefined) {
  return (language ?? "").trim().toLowerCase().split("-")[0] || "en";
}

function termsForCategory(categoryTitle: string, language: string | undefined) {
  const normalizedTitle = categoryTitle.trim().toLowerCase();
  const normalizedLanguage = normalizeLanguage(language);
  const localized: Record<string, Record<string, string[]>> = {
    autos: {
      en: ["cars", "vehicles", "auto review", "driving"],
      es: ["autos", "vehiculos", "coches"],
      ja: ["車", "自動車", "試乗"],
      ko: ["자동차", "차량", "시승", "자동차 리뷰"],
    },
    comedy: {
      en: ["comedy", "funny", "sketch"],
      es: ["comedia", "humor"],
      ja: ["お笑い", "コメディ"],
      ko: ["코미디", "웃긴 영상", "개그"],
    },
    education: {
      en: ["education", "explainer", "tutorial"],
      es: ["educacion", "explicacion", "tutorial"],
      ja: ["教育", "解説", "学習"],
      ko: ["교육", "강의", "해설", "공부"],
    },
    entertainment: {
      en: ["entertainment", "show", "celebrity"],
      es: ["entretenimiento", "famosos"],
      ja: ["エンタメ", "芸能"],
      ko: ["엔터테인먼트", "연예", "예능"],
    },
    film: {
      en: ["film", "animation", "movie"],
      es: ["cine", "animacion", "pelicula"],
      ja: ["映画", "アニメーション"],
      ko: ["영화", "애니메이션", "무비"],
    },
    gaming: {
      en: ["gaming", "gameplay", "game review"],
      es: ["videojuegos", "gameplay"],
      ja: ["ゲーム", "実況"],
      ko: ["게임", "게임 리뷰", "플레이"],
    },
    howto: {
      en: ["how to", "style", "tips"],
      es: ["como hacer", "estilo", "consejos"],
      ja: ["ハウツー", "やり方"],
      ko: ["방법", "팁", "스타일", "노하우"],
    },
    music: {
      en: ["music", "official", "live"],
      es: ["musica", "concierto"],
      ja: ["音楽", "ライブ"],
      ko: ["음악", "라이브", "뮤직"],
    },
    news: {
      en: ["news", "politics", "breaking news", "current affairs"],
      es: ["noticias", "politica", "actualidad"],
      ja: ["ニュース", "政治", "時事"],
      ko: ["뉴스", "정치", "시사", "속보"],
    },
    people: {
      en: ["people", "blog", "vlog"],
      es: ["personas", "vlog"],
      ja: ["ブログ", "日常", "人物"],
      ko: ["브이로그", "사람", "일상"],
    },
    pets: {
      en: ["pets", "animals", "dog", "cat"],
      es: ["mascotas", "animales"],
      ja: ["ペット", "動物"],
      ko: ["동물", "반려동물", "강아지", "고양이"],
    },
    science: {
      en: ["science", "technology", "AI", "tech"],
      es: ["ciencia", "tecnologia", "IA"],
      ja: ["科学", "技術", "AI"],
      ko: ["과학", "기술", "테크", "AI"],
    },
    sports: {
      en: ["sports", "highlights", "match"],
      es: ["deportes", "resumen"],
      ja: ["スポーツ", "試合"],
      ko: ["스포츠", "경기", "하이라이트"],
    },
    travel: {
      en: ["travel", "events", "trip"],
      es: ["viajes", "eventos"],
      ja: ["旅行", "イベント"],
      ko: ["여행", "이벤트", "축제"],
    },
  };

  const key = (
    [
      ["news", ["news", "politics"]],
      ["science", ["science", "technology"]],
      ["education", ["education"]],
      ["entertainment", ["entertainment"]],
      ["people", ["people", "blog"]],
      ["howto", ["howto", "style"]],
      ["sports", ["sports"]],
      ["gaming", ["gaming"]],
      ["music", ["music"]],
      ["film", ["film", "animation"]],
      ["autos", ["autos", "vehicles"]],
      ["pets", ["pets", "animals"]],
      ["comedy", ["comedy"]],
      ["travel", ["travel", "events"]],
    ] as const
  ).find(([, needles]) => needles.some((needle) => normalizedTitle.includes(needle)))?.[0];

  const terms = key ? localized[key]?.[normalizedLanguage] ?? localized[key]?.en ?? [] : [];
  const fallback = categoryTitle.trim() ? [categoryTitle.trim()] : [];
  return Array.from(new Set((terms.length > 0 ? terms : fallback).filter(Boolean))).slice(0, 5);
}

function categoryFallbackQuery(input: YouTubeSearchInput) {
  const titleById: Record<string, string> = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
  };
  const categoryTitle = input.categoryTitle?.trim() || titleById[input.videoCategoryId?.trim() ?? ""] || "";
  const terms = termsForCategory(categoryTitle, input.relevanceLanguage);
  if (terms.length === 0) {
    return "";
  }
  return terms.join("|");
}

function relaxedUserQuery(query: string) {
  const stopwords = new Set(["브리프", "요약", "영상", "콘텐츠", "쇼츠", "롱폼", "youtube", "video"]);
  const terms = query
    .split(/[\s,，.。/|]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !stopwords.has(term.toLowerCase()))
    .slice(0, 5);
  if (terms.length === 0) {
    return query;
  }
  if (terms.length === 1) {
    return terms[0];
  }
  return Array.from(new Set(terms)).join("|");
}

function queryTerms(query: string) {
  return Array.from(
    new Set(
      query
        .split(/[\s,，.。/|]+/u)
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length > 1),
    ),
  ).slice(0, 6);
}

function dedupeAttempts(attempts: YouTubeSearchAttempt[]) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = JSON.stringify({
      publishedAfter: attempt.publishedAfter ?? "",
      query: attempt.query,
      regionCode: attempt.regionCode ?? "",
      relevanceLanguage: attempt.relevanceLanguage ?? "",
      safeSearch: attempt.safeSearch ?? "",
      videoCategoryId: attempt.videoCategoryId ?? "",
      videoDuration: attempt.videoDuration ?? "",
    });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildSearchAttempts(input: YouTubeSearchInput) {
  const userQuery = input.query?.trim() ?? "";
  const videoCategoryId = input.videoCategoryId?.trim() ?? "";
  const query = userQuery || categoryFallbackQuery(input);
  const relaxedQuery = userQuery ? relaxedUserQuery(userQuery) : query;
  if (!query && !videoCategoryId) {
    throw new Error("Search query or YouTube category is required.");
  }

  const base: YouTubeSearchAttempt = {
    ...input,
    query,
    requiredTerms: userQuery ? queryTerms(relaxedQuery || userQuery) : undefined,
    regionCode: input.regionCode?.trim().toUpperCase(),
    relevanceLanguage: input.relevanceLanguage?.trim(),
    safeSearch: input.safeSearch ?? "moderate",
    videoCategoryId,
    videoDuration: input.videoDuration ?? "any",
    searchScope: userQuery ? "기본 조건" : "카테고리 키워드 보강",
  };

  const attempts: YouTubeSearchAttempt[] = [base];

  if (relaxedQuery && relaxedQuery !== base.query) {
    attempts.push({
      ...base,
      query: relaxedQuery,
      requiredTerms: queryTerms(relaxedQuery),
      searchScope: "검색어 OR 확장",
    });
  }

  if (base.videoDuration && base.videoDuration !== "any") {
    attempts.push({
      ...base,
      videoDuration: "any",
      searchScope: `${base.searchScope} + 길이 필터 완화`,
    });
  }

  if (base.relevanceLanguage) {
    attempts.push({
      ...base,
      relevanceLanguage: "",
      searchScope: `${base.searchScope} + 언어 필터 완화`,
    });
  }

  if (base.videoCategoryId && base.query) {
    attempts.push({
      ...base,
      videoCategoryId: "",
      searchScope: `${base.searchScope} + 카테고리 필터 완화`,
    });
  }

  if (base.regionCode) {
    attempts.push({
      ...base,
      regionCode: "",
      searchScope: `${base.searchScope} + 지역 필터 완화`,
    });
  }

  if (base.publishedAfter) {
    attempts.push({
      ...base,
      publishedAfter: "",
      searchScope: `${base.searchScope} + 최근 날짜 필터 완화`,
    });
  }

  if (relaxedQuery && relaxedQuery !== base.query) {
    attempts.push({
      ...base,
      publishedAfter: "",
      query: relaxedQuery,
      requiredTerms: queryTerms(relaxedQuery),
      regionCode: "",
      relevanceLanguage: "",
      safeSearch: "none",
      videoCategoryId: "",
      videoDuration: "any",
      searchScope: "검색어 OR 확장 + 전체 fallback",
    });
  }

  attempts.push({
    ...base,
    publishedAfter: "",
    regionCode: "",
    relevanceLanguage: "",
    safeSearch: "none",
    videoCategoryId: base.query ? "" : base.videoCategoryId,
    videoDuration: "any",
    searchScope: `${base.searchScope} + 전체 fallback`,
  });

  return dedupeAttempts(attempts);
}

async function fetchYouTubeSearchAttempt(
  apiKey: string,
  input: YouTubeSearchAttempt,
  maxResults: number,
) {
  const searchUrl = new URL(searchEndpoint);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("order", input.order ?? "viewCount");
  searchUrl.searchParams.set("safeSearch", input.safeSearch ?? "moderate");

  if (input.query) {
    searchUrl.searchParams.set("q", input.query);
  }
  if (input.videoCategoryId) {
    searchUrl.searchParams.set("videoCategoryId", input.videoCategoryId);
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
        title: decodeHtmlEntities(snippet.title ?? ""),
        channel: decodeHtmlEntities(snippet.channelTitle ?? ""),
        channelId: snippet.channelId ?? "",
        publishedAt: snippet.publishedAt ?? "",
        description: decodeHtmlEntities(snippet.description ?? ""),
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
        searchPublishedAfter: input.publishedAfter,
        searchQuery: input.query,
        searchScope: input.searchScope,
      };
    })
    .filter((candidate): candidate is YouTubeCandidate => candidate !== null)
    .filter((candidate) => {
      const requiredTerms = input.requiredTerms ?? [];
      if (requiredTerms.length === 0) {
        return true;
      }
      const haystack = `${candidate.title} ${candidate.channel} ${candidate.description}`.toLowerCase();
      return requiredTerms.some((term) => haystack.includes(term));
    });
}

export async function searchYouTubeVideos(input: YouTubeSearchInput) {
  const apiKey = await getYouTubeApiKey();
  const maxResults = clampMaxResults(input.maxResults);
  const minResults = clampMinResults(input.minResults, maxResults);
  const attempts = buildSearchAttempts(input);
  const candidatesById = new Map<string, YouTubeCandidate>();

  for (const attempt of attempts) {
    const candidates = await fetchYouTubeSearchAttempt(apiKey, attempt, maxResults);
    for (const candidate of candidates) {
      if (!candidatesById.has(candidate.videoId)) {
        candidatesById.set(candidate.videoId, candidate);
      }
    }
    if (candidatesById.size >= minResults) {
      break;
    }
  }

  return Array.from(candidatesById.values())
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, maxResults);
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
