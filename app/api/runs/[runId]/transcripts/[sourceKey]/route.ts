import { getTranscript, saveTranscript } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string; sourceKey: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId, sourceKey } = await context.params;
    const transcript = await getTranscript(runId, sourceKey);
    return Response.json({ transcript });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Transcript not found." },
      { status: 404 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { runId, sourceKey } = await context.params;
    const body = (await request.json()) as { content?: unknown };
    const transcript = await saveTranscript(runId, sourceKey, String(body.content ?? ""));
    return Response.json({ transcript });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Transcript save failed." },
      { status: 400 },
    );
  }
}

