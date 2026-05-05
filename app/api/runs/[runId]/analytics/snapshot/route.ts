import { createPerformanceSnapshot, type CreatePerformanceSnapshotInput } from "@/lib/youtube-performance";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as CreatePerformanceSnapshotInput;
    return Response.json({ snapshot: await createPerformanceSnapshot(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Performance snapshot failed." },
      { status: 400 },
    );
  }
}
