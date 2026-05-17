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
    const sourceMode = body.sourceMode === "categoryTop" ? "categoryTop" : "manual";
    const format = String(body.format ?? "shorts");
    const language = String(body.language ?? "ko");
    const durationSeconds = Number(body.durationSeconds ?? 60);
    let sourceCandidates: YouTubeCandidate[] = [];

    if (sourceMode === "categoryTop") {
      const categoryId = String(body.categoryId ?? "").trim();
      if (!categoryId) {
        throw new Error("유튜브 카테고리를 선택해야 TOP 10 후보를 가져올 수 있습니다.");
      }

      const candidates = await searchYouTubeVideos({
        query: String(body.topic ?? ""),
        maxResults: 25,
        order: "viewCount",
        publishedAfter: publishedAfterDays(7),
        regionCode: regionForLanguage(language),
        relevanceLanguage: language,
        videoCategoryId: categoryId,
        videoDuration: format === "shorts" ? "short" : durationSeconds > 1200 ? "long" : "medium",
      });
      sourceCandidates = selectFormatMatches(candidates, format, durationSeconds);

      if (sourceCandidates.length === 0) {
        throw new Error("최근 7일 기준으로 선택한 카테고리의 YouTube 후보 영상을 찾지 못했습니다.");
      }
    }

    const run = await createRun({
      topic: String(body.topic ?? ""),
      category: String(body.category ?? ""),
      categoryId: String(body.categoryId ?? ""),
      channelId: String(body.channelId ?? ""),
      format,
      language,
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
