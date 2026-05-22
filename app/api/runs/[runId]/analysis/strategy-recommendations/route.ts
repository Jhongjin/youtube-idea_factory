import {
  createStrategyRecommendations,
  type StrategyRecommendationOptions,
} from "@/lib/strategy-recommendations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as StrategyRecommendationOptions;
    return Response.json({
      result: await createStrategyRecommendations(runId, {
        providerProfileId: body.providerProfileId ? String(body.providerProfileId) : undefined,
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Strategy recommendations failed." },
      { status: 400 },
    );
  }
}
