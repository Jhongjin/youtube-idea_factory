import { refineAnalysisWithLlm } from "@/lib/analysis-refine";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

async function readProviderProfileId(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return undefined;
  }
  const body = (await request.json().catch(() => null)) as { providerProfileId?: unknown } | null;
  return typeof body?.providerProfileId === "string" && body.providerProfileId.trim()
    ? body.providerProfileId.trim()
    : undefined;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await refineAnalysisWithLlm(runId, {
      providerProfileId: await readProviderProfileId(request),
    });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "LLM analysis refinement failed." },
      { status: 400 },
    );
  }
}
