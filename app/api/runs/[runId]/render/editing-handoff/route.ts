import { createEditingHandoff } from "@/lib/editing-handoff";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

type EditingHandoffRequest = {
  providerProfileId?: unknown;
};

async function readProviderProfileId(request: Request) {
  const body = (await request.json().catch(() => null)) as EditingHandoffRequest | null;
  return typeof body?.providerProfileId === "string" && body.providerProfileId.trim()
    ? body.providerProfileId.trim()
    : undefined;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    return Response.json({
      result: await createEditingHandoff(runId, {
        providerProfileId: await readProviderProfileId(request),
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Editing handoff creation failed." },
      { status: 400 },
    );
  }
}
