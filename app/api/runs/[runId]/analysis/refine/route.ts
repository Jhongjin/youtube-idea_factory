import { refineAnalysisWithLlm } from "@/lib/analysis-refine";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await refineAnalysisWithLlm(runId);
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "LLM analysis refinement failed." },
      { status: 400 },
    );
  }
}
