import { updateWorkerJobAction, type WorkerJobAction } from "@/lib/worker-job-records";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string; jobId: string }>;
};

type PatchPayload = {
  action?: WorkerJobAction;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { jobId, runId } = await context.params;
    const payload = (await request.json()) as PatchPayload;
    if (payload.action !== "cancel" && payload.action !== "retry") {
      throw new Error('Worker job action must be "cancel" or "retry".');
    }
    return Response.json({
      record: await updateWorkerJobAction(runId, jobId, payload.action),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Worker job action failed." },
      { status: 400 },
    );
  }
}
