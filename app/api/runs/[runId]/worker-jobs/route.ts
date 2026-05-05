import { getWorkerJobRecords } from "@/lib/worker-job-records";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ records: await getWorkerJobRecords(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Worker jobs could not be loaded." },
      { status: 400 },
    );
  }
}
