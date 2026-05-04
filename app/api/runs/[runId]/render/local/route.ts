import { renderLocalVideo, type LocalRenderRequest } from "@/lib/local-render";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as LocalRenderRequest;
    return Response.json({ result: await renderLocalVideo(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Local render failed." },
      { status: 400 },
    );
  }
}
