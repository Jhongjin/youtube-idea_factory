import { getCurrentUser } from "@/lib/auth";
import { createRun, type CreateRunInput } from "@/lib/create-run";
import { getRuns } from "@/lib/runs";
import { searchYouTubeVideos, type YouTubeCandidate } from "@/lib/youtube-finder";

export const dynamic = "force-dynamic";

async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}

function regionForLanguage(language: string) {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "JP";
  }
  if (normalized.startsWith("es")) {
    return "ES";
  }
  if (normalized.startsWith("en")) {
    return "US";
  }
  return "KR";
}

function normalizeSourceMode(value: unknown) {
  if (value === "categoryTop") {
    return "categoryTop" as const;
  }
  if (value === "manual") {
    return "manual" as const;
  }
  return "topicSearch" as const;
}

function publishedAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function selectFormatMatches(candidates: YouTubeCandidate[], format: string, targetSeconds: number) {
  const normalized = format.toLowerCase();
  let matches: YouTubeCandidate[];

  if (normalized === "shorts") {
    matches = candidates.filter((candidate) => candidate.durationSeconds > 0 && candidate.durationSeconds <= 75);
  } else {
    const target = Number.isFinite(targetSeconds) && targetSeconds > 0 ? targetSeconds : 480;
    const lower = Math.max(240, Math.floor(target * 0.5));
    const upper = Math.max(lower + 60, Math.ceil(target * 1.75));
    const durationMatches = candidates.filter(
      (candidate) => candidate.durationSeconds >= lower && candidate.durationSeconds <= upper,
    );
    matches =
      durationMatches.length >= 5
        ? durationMatches
        : candidates.filter((candidate) => candidate.durationSeconds >= 240);
  }

  const base = matches.length >= 5 ? matches : candidates;
  return base
    .slice()
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);
}

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) {
    return unauthorized;
  }

  const runs = await getRuns();
  return Response.json({ runs });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as Partial<CreateRunInput>;
    const sourceMode = normalizeSourceMode(body.sourceMode);
    const format = String(body.format ?? "shorts");
    const language = String(body.language ?? "ko");
    const regionCode = String(body.regionCode ?? "").trim().toUpperCase() || regionForLanguage(language);
    const durationSeconds = Number(body.durationSeconds ?? 60);
    let sourceCandidates: YouTubeCandidate[] = [];

    if (sourceMode !== "manual") {
      const query = String(body.topic ?? "").trim();
      const categoryId = String(body.categoryId ?? "").trim();
      if (sourceMode === "topicSearch" && !query) {
        throw new Error("아이디어 직접 작성 모드에서는 영상 주제나 리서치 키워드가 필요합니다.");
      }
      if (sourceMode === "categoryTop" && !categoryId) {
        throw new Error("카테고리 선택 모드에서는 유튜브 카테고리가 필요합니다.");
      }

      const candidates = await searchYouTubeVideos({
        categoryTitle: String(body.category ?? ""),
        query: sourceMode === "topicSearch" ? query : "",
        maxResults: 50,
        minResults: 10,
        order: "viewCount",
        publishedAfter: publishedAfterDays(7),
        regionCode,
        relevanceLanguage: language,
        videoCategoryId: sourceMode === "categoryTop" ? categoryId : "",
        videoDuration: format === "shorts" ? "short" : durationSeconds > 1200 ? "long" : "medium",
      });
      sourceCandidates = selectFormatMatches(candidates, format, durationSeconds);

      if (sourceCandidates.length === 0) {
        throw new Error("검색 조건을 완화해도 YouTube 후보 영상을 찾지 못했습니다. 검색어, 국가, 카테고리를 바꿔보세요.");
      }
    }

    const run = await createRun({
      topic: String(body.topic ?? ""),
      category: String(body.category ?? ""),
      categoryId: String(body.categoryId ?? ""),
      channelId: String(body.channelId ?? ""),
      format,
      language,
      regionCode,
      sourceCandidates,
      sourceMode,
      targetAudience: String(body.targetAudience ?? ""),
      tone: String(body.tone ?? ""),
      durationSeconds,
      seedUrls: sourceMode === "manual" && Array.isArray(body.seedUrls) ? body.seedUrls.map(String) : [],
    });

    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Run creation failed." },
      { status: 400 },
    );
  }
}
