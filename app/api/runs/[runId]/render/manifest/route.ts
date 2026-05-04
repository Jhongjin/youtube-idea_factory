import { createRenderManifest } from "@/lib/render-manifest";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createRenderManifest(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Render manifest creation failed." },
      { status: 400 },
    );
  }
}
