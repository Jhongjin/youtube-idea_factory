import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { writeAssetBytes } from "@/lib/asset-storage";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type GenerateVoiceRequest = {
  assetId: string;
  confirmSpend: string;
  text: string;
  voice: string;
  instructions?: string;
  responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
};

export type GenerateVoiceResult = {
  assetId: string;
  path: string;
  provider: string;
  model: string;
  voice: string;
  requestId: string;
  responseFormat: string;
};

type OpenAIErrorResponse = {
  error?: {
    message?: string;
  };
};

const confirmToken = "GENERATE_TTS";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function openAiBaseUrl(baseUrl: string) {
  return (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function ensureVoiceAsset(item: AssetManifestItem): asserts item is AssetManifestItem {
  if (item.kind !== "voice") {
    throw new Error("Only voice assets can use this adapter.");
  }
  if (item.provider_role !== "tts") {
    throw new Error("Asset provider role must be tts.");
  }
  if (item.status !== "pending_generation") {
    throw new Error(`Voice asset is not ready for generation: ${item.status}`);
  }
}

function cleanText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

async function appendGenerationLog(runId: string, entry: unknown) {
  const log: unknown[] = await readRunJson<unknown[]>(
    runId,
    "asset-generation-log.json",
  ).catch((): unknown[] => []);
  log.push(entry);
  await writeRunJson(runId, "asset-generation-log.json", log);
}

export async function generateOpenAITts(
  runId: string,
  request: GenerateVoiceRequest,
): Promise<GenerateVoiceResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== confirmToken) {
    throw new Error(`External spend requires confirmSpend="${confirmToken}".`);
  }

  const text = cleanText(request.text ?? "", 12000);
  const voice = cleanText(request.voice ?? "", 80);
  if (!text) {
    throw new Error("TTS text is required.");
  }
  if (!voice) {
    throw new Error("TTS voice is required.");
  }

  await createGenerationQueue(runId);

  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);
  const ttsProvider = providerSettings.roles.tts;
  if (ttsProvider.provider !== "OpenAI") {
    throw new Error("Only the OpenAI TTS provider is implemented for direct generation.");
  }
  if (!ttsProvider.apiKey?.trim()) {
    throw new Error("OpenAI TTS API key is missing.");
  }
  if (!ttsProvider.model.trim()) {
    throw new Error("OpenAI TTS model is missing.");
  }

  const item = manifest.items.find((candidate) => candidate.id === request.assetId);
  if (!item) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }
  ensureVoiceAsset(item);

  const responseFormat = request.responseFormat ?? "wav";
  const response = await fetch(`${openAiBaseUrl(ttsProvider.baseUrl)}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ttsProvider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ttsProvider.model,
      voice,
      input: text,
      instructions: cleanText(request.instructions ?? "", 1000) || undefined,
      response_format: responseFormat,
    }),
  });

  const requestId = response.headers.get("x-request-id") ?? "";
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as OpenAIErrorResponse | null;
    item.status = "failed";
    item.error = body?.error?.message ?? `OpenAI TTS generation failed with ${response.status}`;
    await writeRunJson(runId, "asset-manifest.json", manifest);
    throw new Error(item.error);
  }

  const actualPath = await writeAssetBytes(
    runId,
    item.expected_path,
    Buffer.from(await response.arrayBuffer()),
    `audio/${responseFormat}`,
  );

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = actualPath;
  item.provider = ttsProvider.provider;
  item.model = ttsProvider.model;
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
      provider: ttsProvider.provider,
      model: ttsProvider.model,
      request_id: requestId,
      actual_path: actualPath,
      expected_path: item.expected_path,
      voice,
      response_format: responseFormat,
    }),
  ]);

  return {
    assetId: item.id,
    path: actualPath,
    provider: ttsProvider.provider,
    model: ttsProvider.model,
    voice,
    requestId,
    responseFormat,
  };
}
