import { getRunArtifact, updateRunArtifact } from "@/lib/artifacts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string; artifactId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId, artifactId } = await context.params;
    const artifact = await getRunArtifact(runId, artifactId);
    return Response.json({ artifact });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Artifact not found." },
      { status: 404 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { runId, artifactId } = await context.params;
    const body = (await request.json()) as { content?: unknown };
    const artifact = await updateRunArtifact(runId, artifactId, String(body.content ?? ""));
    return Response.json({ artifact });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Artifact update failed." },
      { status: 400 },
    );
  }
}

