import { createAbLearningLog } from "@/lib/ab-learning-log";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ log: await createAbLearningLog(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "A/B learning log failed." },
      { status: 400 },
    );
  }
}
