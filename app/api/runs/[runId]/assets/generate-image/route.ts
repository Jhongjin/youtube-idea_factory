import {
  generateImageAsset,
  type GenerateImageRequest,
} from "@/lib/image-generation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as GenerateImageRequest;
    return Response.json({ result: await generateImageAsset(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 400 },
    );
  }
}
