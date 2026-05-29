import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { createGenerationQueue } from "@/lib/generation-queue";
import { createRenderManifest } from "@/lib/render-manifest";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type AssetStatusAction = "retry" | "skip";

export type AssetStatusActionRequest = {
  action: AssetStatusAction;
  assetId: string;
  reason?: string;
};

export type AssetStatusActionResult = {
  action: AssetStatusAction;
  assetId: string;
  status: AssetManifestItem["status"];
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function cleanAssetId(value: string | undefined) {
  const assetId = value?.trim() ?? "";
  if (!assetId) {
    throw new Error("assetId is required.");
  }
  return assetId;
}

function cleanAction(value: string | undefined): AssetStatusAction {
  if (value === "retry" || value === "skip") {
    return value;
  }
  throw new Error("Unsupported asset status action.");
}

export async function updateAssetStatus(
  runId: string,
  request: AssetStatusActionRequest,
): Promise<AssetStatusActionResult> {
  assertSafeRunId(runId);
  const assetId = cleanAssetId(request.assetId);
  const action = cleanAction(request.action);
  const manifest = await readRunJson<AssetManifest>(runId, "asset-manifest.json");
  const item = manifest.items.find((candidate) => candidate.id === assetId);
  if (!item) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  if (action === "retry") {
    if (item.status !== "failed" && item.status !== "skipped") {
      throw new Error("Only failed or skipped assets can be retried.");
    }
    item.status = "pending_approval";
    item.error = "";
    item.actual_path = undefined;
    item.generated_at = undefined;
    item.request_id = undefined;
  }

  if (action === "skip") {
    if (item.status === "generated") {
      throw new Error("Generated assets cannot be skipped. Replace them by registering a new file.");
    }
    item.status = "skipped";
    item.error = request.reason?.trim() || "Operator skipped this asset.";
    item.actual_path = undefined;
    item.generated_at = undefined;
    item.request_id = undefined;
  }

  manifest.updated_at = new Date().toISOString();
  await writeRunJson(runId, "asset-manifest.json", manifest);
  await createGenerationQueue(runId);
  await createRenderManifest(runId).catch(() => null);

  return {
    action,
    assetId,
    status: item.status,
  };
}
