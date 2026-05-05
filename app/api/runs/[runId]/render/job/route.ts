import {
  createRenderWorkerJob,
  type CreateRenderWorkerJobRequest,
} from "@/lib/render-worker-job";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as CreateRenderWorkerJobRequest;
    return Response.json({ result: await createRenderWorkerJob(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Render worker job creation failed." },
      { status: 400 },
    );
  }
}
