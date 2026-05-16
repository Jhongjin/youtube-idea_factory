import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { writeAssetBytes } from "@/lib/asset-storage";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProviderRoleSetting } from "@/lib/provider-settings-shared";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type GenerateImageRequest = {
  assetId: string;
  confirmSpend: string;
  providerProfileId?: string;
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

const confirmToken = "GENERATE_IMAGE";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
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

async function appendGenerationLog(runId: string, entry: unknown) {
  const log: unknown[] = await readRunJson<unknown[]>(
    runId,
    "asset-generation-log.json",
  ).catch((): unknown[] => []);
  log.push(entry);
  await writeRunJson(runId, "asset-generation-log.json", log);
}

export async function generateOpenAIImage(
  runId: string,
  request: GenerateImageRequest,
  providerOverride?: ProviderRoleSetting,
): Promise<GenerateImageResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== confirmToken) {
    throw new Error(`External spend requires confirmSpend="${confirmToken}".`);
  }

  await createGenerationQueue(runId);

  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);
  const imageProvider = providerOverride ?? providerSettings.roles.image;
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
    await writeRunJson(runId, "asset-manifest.json", manifest);
    throw new Error(item.error);
  }

  const actualPath = await writeAssetBytes(
    runId,
    item.expected_path,
    Buffer.from(imageBase64, "base64"),
    "image/png",
  );

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = actualPath;
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
    writeRunJson(runId, "asset-manifest.json", manifest),
    writeRunJson(runId, "production-package.json", pkg),
    appendGenerationLog(runId, {
      at: now,
      asset_id: item.id,
      provider: imageProvider.provider,
      model: imageProvider.model,
      request_id: requestId,
      actual_path: actualPath,
      expected_path: item.expected_path,
      quality,
      size,
    }),
  ]);

  return {
    assetId: item.id,
    path: actualPath,
    provider: imageProvider.provider,
    model: imageProvider.model,
    requestId,
    quality,
    size,
  };
}
