import { searchYouTubeVideos, type YouTubeSearchInput } from "@/lib/youtube-finder";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<YouTubeSearchInput>;
    const candidates = await searchYouTubeVideos({
      categoryTitle: body.categoryTitle ? String(body.categoryTitle) : undefined,
      query: String(body.query ?? ""),
      maxResults: Number(body.maxResults ?? 10),
      minResults: Number(body.minResults ?? 10),
      order: body.order ?? "viewCount",
      regionCode: body.regionCode ? String(body.regionCode) : undefined,
      relevanceLanguage: body.relevanceLanguage ? String(body.relevanceLanguage) : undefined,
      publishedAfter: body.publishedAfter ? String(body.publishedAfter) : undefined,
      safeSearch: body.safeSearch ?? "moderate",
      videoCategoryId: body.videoCategoryId ? String(body.videoCategoryId) : undefined,
      videoDuration: body.videoDuration ?? "any",
    });

    return Response.json({ candidates });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "YouTube search failed." },
      { status: 400 },
    );
  }
}

