import { generateVideoAsset, type GenerateVideoRequest } from "@/lib/video-generation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as GenerateVideoRequest;
    return Response.json({ result: await generateVideoAsset(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video generation failed." },
      { status: 400 },
    );
  }
}
