import { updateAssetPrompt, type UpdateAssetPromptRequest } from "@/lib/asset-prompt-actions";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as UpdateAssetPromptRequest;
    return Response.json({ result: await updateAssetPrompt(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Asset prompt update failed." },
      { status: 400 },
    );
  }
}
