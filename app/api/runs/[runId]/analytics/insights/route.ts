import { createFeedbackInsights } from "@/lib/feedback-insights";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ insights: await createFeedbackInsights(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Feedback insights failed." },
      { status: 400 },
    );
  }
}
