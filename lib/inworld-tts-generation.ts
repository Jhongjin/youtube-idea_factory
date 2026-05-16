import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { writeAssetBytes } from "@/lib/asset-storage";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProviderRoleSetting } from "@/lib/provider-settings-shared";
import { createRenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";
import type { GenerateVoiceRequest, GenerateVoiceResult } from "@/lib/openai-tts-generation";

type InworldTtsResponse = {
  audioContent?: string;
  usage?: {
    modelId?: string;
    processedCharactersCount?: number;
  };
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

function inworldBaseUrl(baseUrl: string) {
  return (baseUrl.trim() || "https://api.inworld.ai/tts/v1").replace(/\/+$/, "");
}

function ensureVoiceAsset(item: AssetManifestItem) {
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

export async function generateInworldTts(
  runId: string,
  request: GenerateVoiceRequest,
  providerOverride?: ProviderRoleSetting,
): Promise<GenerateVoiceResult> {
  assertSafeRunId(runId);
  if (request.confirmSpend !== confirmToken) {
    throw new Error(`External spend requires confirmSpend="${confirmToken}".`);
  }

  const text = cleanText(request.text ?? "", 2000);
  const voice = cleanText(request.voice ?? "", 80);
  if (!text) {
    throw new Error("TTS text is required.");
  }
  if (!voice) {
    throw new Error("Inworld voiceId is required in the voice field.");
  }
  if ((request.text ?? "").trim().length > 2000) {
    throw new Error("Inworld TTS supports up to 2,000 characters per request. Split narration before generating.");
  }

  await createGenerationQueue(runId);
  const [pkg, manifest, providerSettings] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<AssetManifest>(runId, "asset-manifest.json"),
    getProviderSettings(),
  ]);
  const ttsProvider = providerOverride ?? providerSettings.roles.tts;
  if (ttsProvider.provider !== "Inworld") {
    throw new Error("Inworld TTS adapter requires TTS provider Inworld.");
  }
  if (!ttsProvider.apiKey?.trim()) {
    throw new Error("Inworld API key is missing.");
  }
  if (!ttsProvider.model.trim()) {
    throw new Error("Inworld model is missing. Example: inworld-tts-1.5-max");
  }

  const item = manifest.items.find((candidate) => candidate.id === request.assetId);
  if (!item) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }
  ensureVoiceAsset(item);

  const response = await fetch(`${inworldBaseUrl(ttsProvider.baseUrl)}/voice`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${ttsProvider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId: voice,
      modelId: ttsProvider.model,
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: 22050,
      },
      temperature: 1,
      applyTextNormalization: "ON",
    }),
  });

  const requestId = response.headers.get("x-request-id") ?? "";
  const body = (await response.json().catch(() => null)) as InworldTtsResponse | null;
  const audioBase64 = body?.audioContent;
  if (!response.ok || !audioBase64) {
    item.status = "failed";
    item.error = body?.error?.message ?? `Inworld TTS generation failed with ${response.status}`;
    await writeRunJson(runId, "asset-manifest.json", manifest);
    throw new Error(item.error);
  }

  const actualPath = await writeAssetBytes(
    runId,
    item.expected_path,
    Buffer.from(audioBase64, "base64"),
    "audio/wav",
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
      processed_characters: body?.usage?.processedCharactersCount,
      voice,
      response_format: "wav",
    }),
  ]);
  await createRenderManifest(runId).catch(() => null);

  return {
    assetId: item.id,
    path: actualPath,
    provider: ttsProvider.provider,
    model: ttsProvider.model,
    voice,
    requestId,
    responseFormat: "wav",
  };
}
