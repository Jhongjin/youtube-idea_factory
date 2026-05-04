import { createGenerationQueue } from "@/lib/generation-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createGenerationQueue(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Generation queue creation failed." },
      { status: 400 },
    );
  }
}
