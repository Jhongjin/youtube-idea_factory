import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { writeAssetBytes } from "@/lib/asset-storage";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProviderRoleSetting } from "@/lib/provider-settings-shared";
import { createRenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type GenerateFalImageRequest = {
  assetId: string;
  confirmSpend: string;
  providerProfileId?: string;
  timeoutSeconds?: number;
};

export type GenerateFalVideoRequest = {
  assetId: string;
  confirmSpend: string;
  providerProfileId?: string;
  timeoutSeconds?: number;
};

export type GenerateFalMediaResult = {
  assetId: string;
  path: string;
  provider: string;
  model: string;
  requestId: string;
  mediaUrl: string;
};

type FalQueueSubmitResponse = {
  request_id?: string;
  response_url?: string;
  status_url?: string;
  error?: string;
};

type FalQueueStatusResponse = {
  status?: string;
  request_id?: string;
  response_url?: string;
  error?: string;
  error_type?: string;
};

const imageConfirmToken = "GENERATE_IMAGE";
const videoConfirmToken = "GENERATE_VIDEO";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function cleanModel(value: string) {
  return value.trim().replace(/^\/+/, "");
}

function falQueueBaseUrl(baseUrl: string) {
  return (baseUrl.trim() || "https://queue.fal.run").replace(/\/+$/, "");
}

function falQueueUrl(baseUrl: string, model: string) {
  const clean = cleanModel(model);
  if (!clean) {
    throw new Error("fal.ai model path is missing. Example: fal-ai/flux-pro/v1.1");
  }
  return `${falQueueBaseUrl(baseUrl)}/${clean}`;
}

function imageSizeForAspectRatio(aspectRatio?: string) {
  if (aspectRatio === "9:16") {
    return "portrait_16_9";
  }
  if (aspectRatio === "16:9") {
    return "landscape_16_9";
  }
  return "square_hd";
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

function ensureImageAsset(item: AssetManifestItem) {
  if (item.kind !== "image" && item.kind !== "thumbnail") {
    throw new Error("Only image and thumbnail assets can use this adapter.");
  }
  if (item.provider_role !== "image") {
    throw new Error("Asset provider role must be image.");
  }
  ensureGeneratableAsset(item);
}

function ensureVideoAsset(item: AssetManifestItem) {
  if (item.kind !== "video") {
    throw new Error("Only video assets can use this adapter.");
  }
  if (item.provider_role !== "video") {
    throw new Error("Asset provider role must be video.");
  }
  ensureGeneratableAsset(item);
}

function ensureGeneratableAsset(item: AssetManifestItem) {
  if (item.status !== "pending_generation") {
    throw new Error(`Asset is not ready for generation: ${item.status}`);
  }
  if (!item.prompt?.trim()) {
    throw new Error("Asset prompt is empty.");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function firstMediaFromArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const item of value) {
    const record = asRecord(item);
    if (typeof record?.url === "string") {
      return record.url;
    }
  }
  return null;
}

function firstMediaUrl(body: unknown, kind: "image" | "video"): string {
  const record = asRecord(body);
  if (!record) {
    return "";
  }

  const preferredArray = kind === "image" ? "images" : "videos";
  const directArray = firstMediaFromArray(record[preferredArray]);
  if (directArray) {
    return directArray;
  }

  const directObject = asRecord(record[kind]);
  if (typeof directObject?.url === "string") {
    return directObject.url;
  }

  if (typeof record.url === "string") {
    return record.url;
  }

  const output = asRecord(record.output) ?? asRecord(record.data);
  return output ? firstMediaUrl(output, kind) : "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function falJsonFetch<T>(url: string, apiKey: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      asRecord(body)?.error ?? asRecord(body)?.message ?? `fal.ai request failed with ${response.status}`;
    throw new Error(String(message));
  }
  return body;
}

async function falSubmitAndWait({
  apiKey,
  baseUrl,
  input,
  model,
  timeoutSeconds,
}: {
  apiKey: string;
  baseUrl: string;
  input: Record<string, unknown>;
  model: string;
  timeoutSeconds: number;
}) {
  const submit = await falJsonFetch<FalQueueSubmitResponse>(falQueueUrl(baseUrl, model), apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const requestId = submit?.request_id ?? "";
  const statusUrl = submit?.status_url;
  let responseUrl = submit?.response_url;
  if (!requestId || !statusUrl || !responseUrl) {
    throw new Error("fal.ai queue response is missing request URLs.");
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const status = await falJsonFetch<FalQueueStatusResponse>(`${statusUrl}?logs=1`, apiKey);
    responseUrl = status?.response_url ?? responseUrl;
    if (status?.status === "COMPLETED") {
      if (status.error) {
        throw new Error(status.error);
      }
      return {
        data: await falJsonFetch<unknown>(responseUrl, apiKey),
        requestId,
      };
    }
    await sleep(1800);
  }

  throw new Error(`fal.ai generation did not complete within ${timeoutSeconds} seconds.`);
}

async function downloadMedia(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Generated media download failed with ${response.status}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

async function appendGenerationLog(runId: string, entry: unknown) {
  const log: unknown[] = await readRunJson<unknown[]>(
    runId,
    "asset-generation-log.json",
  ).catch((): unknown[] => []);
  log.push(entry);
  await writeRunJson(runId, "asset-generation-log.json", log);
}

async function persistGeneratedAsset({
  item,
  manifest,
  model,
  provider,
  requestId,
  runId,
  actualPath,
  pkg,
  mediaUrl,
}: {
  item: AssetManifestItem;
  manifest: AssetManifest;
  model: string;
  provider: string;
  requestId: string;
  runId: string;
  actualPath: string;
  pkg: ProductionPackage;
  mediaUrl: string;
}) {
  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = actualPath;
  item.provider = provider;
  item.model = model;
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
      provider,
      model,
      request_id: requestId,
      actual_path: actualPath,
      expected_path: item.expected_path,
      media_url: mediaUrl,
    }),
  ]);
  await createRenderManifest(runId).catch(() => null);
}

export async function generateFalImage(
  runId: string,
  request: GenerateFalImageRequest,
  providerOverride?: ProviderRoleSetting,
): Promise<GenerateFalMediaResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== imageConfirmToken) {
    throw new Error(`External spend requires confirmSpend="${imageConfirmToken}".`);
  }

  await createGenerationQueue(runId);
  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);
  const imageProvider = providerOverride ?? providerSettings.roles.image;
  if (imageProvider.provider !== "fal.ai") {
    throw new Error("fal.ai image adapter requires Image provider fal.ai.");
  }
  if (!imageProvider.apiKey?.trim()) {
    throw new Error("fal.ai image API key is missing.");
  }

  const item = manifest.items.find((candidate) => candidate.id === request.assetId);
  if (!item) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }
  ensureImageAsset(item);

  const result = await falSubmitAndWait({
    apiKey: imageProvider.apiKey,
    baseUrl: imageProvider.baseUrl,
    model: imageProvider.model,
    timeoutSeconds: request.timeoutSeconds ?? 90,
    input: {
      prompt: promptFor(item),
      negative_prompt: item.negative_prompt || undefined,
      image_size: imageSizeForAspectRatio(item.aspect_ratio),
      num_images: 1,
      output_format: "png",
    },
  });
  const mediaUrl = firstMediaUrl(result.data, "image");
  if (!mediaUrl) {
    throw new Error("fal.ai image response did not include an image URL.");
  }
  const media = await downloadMedia(mediaUrl);
  const actualPath = await writeAssetBytes(runId, item.expected_path, media.bytes, media.contentType);
  await persistGeneratedAsset({
    actualPath,
    item,
    manifest,
    mediaUrl,
    model: imageProvider.model,
    pkg,
    provider: imageProvider.provider,
    requestId: result.requestId,
    runId,
  });

  return {
    assetId: item.id,
    path: actualPath,
    provider: imageProvider.provider,
    model: imageProvider.model,
    requestId: result.requestId,
    mediaUrl,
  };
}

export async function generateFalVideo(
  runId: string,
  request: GenerateFalVideoRequest,
  providerOverride?: ProviderRoleSetting,
): Promise<GenerateFalMediaResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== videoConfirmToken) {
    throw new Error(`External spend requires confirmSpend="${videoConfirmToken}".`);
  }

  await createGenerationQueue(runId);
  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);
  const videoProvider = providerOverride ?? providerSettings.roles.video;
  if (videoProvider.provider !== "fal.ai") {
    throw new Error("fal.ai video adapter requires Video provider fal.ai.");
  }
  if (!videoProvider.apiKey?.trim()) {
    throw new Error("fal.ai video API key is missing.");
  }

  const item = manifest.items.find((candidate) => candidate.id === request.assetId);
  if (!item) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }
  ensureVideoAsset(item);

  const result = await falSubmitAndWait({
    apiKey: videoProvider.apiKey,
    baseUrl: videoProvider.baseUrl,
    model: videoProvider.model,
    timeoutSeconds: request.timeoutSeconds ?? 180,
    input: {
      prompt: promptFor(item),
      negative_prompt: item.negative_prompt || undefined,
      aspect_ratio: item.aspect_ratio,
      duration: item.duration_seconds,
      duration_seconds: item.duration_seconds,
    },
  });
  const mediaUrl = firstMediaUrl(result.data, "video");
  if (!mediaUrl) {
    throw new Error("fal.ai video response did not include a video URL.");
  }
  const media = await downloadMedia(mediaUrl);
  const actualPath = await writeAssetBytes(runId, item.expected_path, media.bytes, media.contentType);
  await persistGeneratedAsset({
    actualPath,
    item,
    manifest,
    mediaUrl,
    model: videoProvider.model,
    pkg,
    provider: videoProvider.provider,
    requestId: result.requestId,
    runId,
  });

  return {
    assetId: item.id,
    path: actualPath,
    provider: videoProvider.provider,
    model: videoProvider.model,
    requestId: result.requestId,
    mediaUrl,
  };
}
