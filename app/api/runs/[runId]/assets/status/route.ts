import { updateAssetStatus, type AssetStatusActionRequest } from "@/lib/asset-status-actions";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as AssetStatusActionRequest;
    return Response.json({ result: await updateAssetStatus(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Asset status update failed." },
      { status: 400 },
    );
  }
}
