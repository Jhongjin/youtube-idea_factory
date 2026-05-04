import { getRunApprovals, updateRunApprovals, type RunApprovalsUpdate } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ approvals: await getRunApprovals(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Approvals read failed." },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as RunApprovalsUpdate;
    const approvals = await updateRunApprovals(runId, payload);
    return Response.json({ approvals });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Approvals update failed." },
      { status: 400 },
    );
  }
}
