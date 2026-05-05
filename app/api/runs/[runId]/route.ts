import { deleteRunWorkspace } from "@/lib/run-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    await deleteRunWorkspace(runId);
    return Response.json({ deleted: true, runId });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Run deletion failed." },
      { status: 400 },
    );
  }
}
