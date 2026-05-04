import { registerManualAsset, type RegisterAssetRequest } from "@/lib/manual-asset-registration";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const payload = (await request.json()) as RegisterAssetRequest;
    return Response.json({ result: await registerManualAsset(runId, payload) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Asset registration failed." },
      { status: 400 },
    );
  }
}
