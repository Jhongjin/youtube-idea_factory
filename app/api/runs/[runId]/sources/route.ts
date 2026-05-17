import { removeRunSources, type RemoveRunSourcesInput } from "@/lib/source-removal";

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
