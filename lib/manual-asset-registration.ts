import type { AssetManifest } from "@/lib/asset-manifest";
import { normalizeRegisteredAssetPath } from "@/lib/asset-storage";
import { createRenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type RegisterAssetRequest = {
  assetId: string;
  artifactPath: string;
  provider?: string;
  model?: string;
};

export type RegisterAssetResult = {
  assetId: string;
  path: string;
  status: "generated";
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

export async function registerManualAsset(
  runId: string,
  request: RegisterAssetRequest,
): Promise<RegisterAssetResult> {
  assertSafeRunId(runId);
  const assetId = request.assetId?.trim();
  if (!assetId) {
    throw new Error("assetId is required.");
  }

  const [pkg, manifest] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
  ]);
  const item = manifest.items.find((candidate) => candidate.id === assetId);
  if (!item) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const assetPath = await normalizeRegisteredAssetPath(runId, request.artifactPath);

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = assetPath;
  item.provider = request.provider?.trim() || "manual";
  item.model = request.model?.trim() || "external-file";
  item.generated_at = now;
  item.error = "";
  manifest.updated_at = now;

  pkg.asset_manifest = {
    path: "asset-manifest.json",
    items: manifest.items.length,
    pending_approval: manifest.items.filter((asset) => asset.status === "pending_approval").length,
    ready_for_generation: manifest.items.filter((asset) => asset.status === "pending_generation")
      .length,
    blocked: pkg.asset_manifest?.blocked ?? 0,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, "asset-manifest.json", manifest),
    writeRunJson(runId, "production-package.json", pkg),
  ]);
  await createRenderManifest(runId).catch(() => null);

  return {
    assetId,
    path: assetPath,
    status: "generated",
  };
}
