import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifest } from "@/lib/asset-manifest";
import { createRenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";

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

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function normalizeArtifactPath(runId: string, artifactPath: string) {
  const trimmed = artifactPath.trim().replace(/\\/g, "/");
  if (!trimmed) {
    throw new Error("artifactPath is required.");
  }

  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), trimmed);
  const root = path.join(artifactsDir, runId);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Registered asset path must stay inside artifacts/:runId.");
  }

  return path.relative(/* turbopackIgnore: true */ process.cwd(), resolved).replace(/\\/g, "/");
}

async function assertFileExists(relativePath: string) {
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Registered asset file does not exist: ${relativePath}`);
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

  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "asset-manifest.json");
  const [pkg, manifest] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<AssetManifest>(manifestPath),
  ]);
  const item = manifest.items.find((candidate) => candidate.id === assetId);
  if (!item) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const relativePath = normalizeArtifactPath(runId, request.artifactPath);
  await assertFileExists(relativePath);

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = relativePath;
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

  await Promise.all([writeJson(manifestPath, manifest), writeJson(packagePath, pkg)]);
  await createRenderManifest(runId).catch(() => null);

  return {
    assetId,
    path: relativePath,
    status: "generated",
  };
}
