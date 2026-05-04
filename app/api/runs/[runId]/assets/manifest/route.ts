import { createAssetManifest } from "@/lib/asset-manifest";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const result = await createAssetManifest(runId);
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Asset manifest creation failed." },
      { status: 400 },
    );
  }
}
