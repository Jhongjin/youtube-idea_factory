import { createEditingHandoff } from "@/lib/editing-handoff";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({ result: await createEditingHandoff(runId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Editing handoff creation failed." },
      { status: 400 },
    );
  }
}
