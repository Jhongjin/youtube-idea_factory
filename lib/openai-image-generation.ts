import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProductionPackage } from "@/lib/runs";

export type GenerateImageRequest = {
  assetId: string;
  confirmSpend: string;
  quality?: "low" | "medium" | "high" | "auto";
  size?: string;
};

export type GenerateImageResult = {
  assetId: string;
  path: string;
  provider: string;
  model: string;
  requestId: string;
  quality: string;
  size: string;
};

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");
const confirmToken = "GENERATE_IMAGE";

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

function imageSizeForAspectRatio(aspectRatio?: string) {
  if (aspectRatio === "9:16") {
    return "1024x1536";
  }
  if (aspectRatio === "16:9") {
    return "1536x1024";
  }
  return "1024x1024";
}

function outputPathFor(runId: string, expectedPath: string) {
  const root = path.join(artifactsDir, runId);
  const outputPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), expectedPath);
  const relative = path.relative(root, outputPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Asset output path must stay inside artifacts/:runId.");
  }
  return outputPath;
}

function promptFor(item: AssetManifestItem) {
  return [
    item.prompt,
    item.negative_prompt ? `Avoid: ${item.negative_prompt}` : "",
    item.safety_notes ? `Safety notes: ${item.safety_notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function openAiBaseUrl(baseUrl: string) {
  return (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function ensureImageAsset(item: AssetManifestItem): asserts item is AssetManifestItem {
  if (item.kind !== "image" && item.kind !== "thumbnail") {
    throw new Error("Only image and thumbnail assets can use this adapter.");
  }
  if (item.provider_role !== "image") {
    throw new Error("Asset provider role must be image.");
  }
  if (item.status !== "pending_generation") {
    throw new Error(`Asset is not ready for generation: ${item.status}`);
  }
  if (!item.prompt?.trim()) {
    throw new Error("Asset prompt is empty.");
  }
}

async function appendGenerationLog(runDir: string, entry: unknown) {
  const logPath = path.join(runDir, "asset-generation-log.json");
  const log: unknown[] = await loadJson<unknown[]>(logPath).catch((): unknown[] => []);
  log.push(entry);
  await writeJson(logPath, log);
}

export async function generateOpenAIImage(
  runId: string,
  request: GenerateImageRequest,
): Promise<GenerateImageResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== confirmToken) {
    throw new Error(`External spend requires confirmSpend="${confirmToken}".`);
  }

  await createGenerationQueue(runId);

  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "asset-manifest.json");
  const [pkg, manifest, providerSettings] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<AssetManifest>(manifestPath),
    getProviderSettings(),
  ]);
  const imageProvider = providerSettings.roles.image;
  if (imageProvider.provider !== "OpenAI") {
    throw new Error("Only the OpenAI image provider is implemented for direct generation.");
  }
  if (!imageProvider.apiKey?.trim()) {
    throw new Error("OpenAI image API key is missing.");
  }
  if (!imageProvider.model.trim()) {
    throw new Error("OpenAI image model is missing.");
  }

  const item = manifest.items.find((candidate) => candidate.id === request.assetId);
  if (!item) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }
  ensureImageAsset(item);

  const quality = request.quality ?? "low";
  const size = request.size ?? imageSizeForAspectRatio(item.aspect_ratio);
  const outputPath = outputPathFor(runId, item.expected_path);
  const response = await fetch(`${openAiBaseUrl(imageProvider.baseUrl)}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${imageProvider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageProvider.model,
      prompt: promptFor(item),
      quality,
      size,
      n: 1,
    }),
  });

  const requestId = response.headers.get("x-request-id") ?? "";
  const body = (await response.json().catch(() => null)) as OpenAIImageResponse | null;
  const imageBase64 = body?.data?.[0]?.b64_json;
  if (!response.ok || !imageBase64) {
    item.status = "failed";
    item.error = body?.error?.message ?? `OpenAI image generation failed with ${response.status}`;
    await writeJson(manifestPath, manifest);
    throw new Error(item.error);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(imageBase64, "base64"));

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = item.expected_path;
  item.provider = imageProvider.provider;
  item.model = imageProvider.model;
  item.generated_at = now;
  item.request_id = requestId;
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
    writeJson(manifestPath, manifest),
    writeJson(packagePath, pkg),
    appendGenerationLog(runDir, {
      at: now,
      asset_id: item.id,
      provider: imageProvider.provider,
      model: imageProvider.model,
      request_id: requestId,
      expected_path: item.expected_path,
      quality,
      size,
    }),
  ]);

  return {
    assetId: item.id,
    path: item.expected_path,
    provider: imageProvider.provider,
    model: imageProvider.model,
    requestId,
    quality,
    size,
  };
}
