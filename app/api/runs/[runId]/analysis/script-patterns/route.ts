import { createScriptPatternAnalysis } from "@/lib/script-pattern-analysis";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createScriptPatternAnalysis(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Script pattern analysis failed." },
      { status: 400 },
    );
  }
}
