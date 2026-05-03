import { getRunArtifacts } from "@/lib/artifacts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const artifacts = await getRunArtifacts(runId);
    return Response.json({ artifacts });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Artifacts not found." },
      { status: 404 },
    );
  }
}

