import { createChannelMemoryUpdate } from "@/lib/channel-memory-update";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ update: await createChannelMemoryUpdate(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Channel memory update failed." },
      { status: 400 },
    );
  }
}
