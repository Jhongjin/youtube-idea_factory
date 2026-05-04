import { refineScriptWithLlm } from "@/lib/script-refine";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await refineScriptWithLlm(runId);
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "LLM script refinement failed." },
      { status: 400 },
    );
  }
}
