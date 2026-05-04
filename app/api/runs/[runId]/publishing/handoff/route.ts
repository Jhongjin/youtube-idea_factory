import { createPublishingHandoff } from "@/lib/publishing-handoff";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createPublishingHandoff(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Publishing handoff failed." },
      { status: 400 },
    );
  }
}
