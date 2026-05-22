import {
  removeRunSources,
  updateRunSources,
  type RemoveRunSourcesInput,
  type UpdateRunSourcesInput,
} from "@/lib/source-removal";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Partial<RemoveRunSourcesInput>;
    const result = await removeRunSources(runId, {
      all: body.all === true,
      sourceKey: body.sourceKey ? String(body.sourceKey) : "",
    });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Source removal failed." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Partial<UpdateRunSourcesInput>;
    const result = await updateRunSources(runId, {
      action: body.action,
      reason: body.reason ? String(body.reason) : "",
      sourceKeys: Array.isArray(body.sourceKeys) ? body.sourceKeys.map(String) : [],
    });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Source update failed." },
      { status: 400 },
    );
  }
}
