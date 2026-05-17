import { listYouTubeVideoCategories } from "@/lib/youtube-finder";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionCode = searchParams.get("regionCode") ?? "KR";
    const categories = await listYouTubeVideoCategories(regionCode);
    return Response.json({ categories });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "YouTube categories failed." },
      { status: 400 },
    );
  }
}
