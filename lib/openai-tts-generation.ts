import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import { createGenerationQueue } from "@/lib/generation-queue";
import { getProviderSettings } from "@/lib/provider-settings";
import type { ProductionPackage } from "@/lib/runs";
import { isSupabaseStorageMode } from "@/lib/storage-mode";

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

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");
const confirmToken = "GENERATE_TTS";

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

function outputPathFor(runId: string, expectedPath: string) {
  const root = path.join(artifactsDir, runId);
  const outputPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), expectedPath);
  const relative = path.relative(root, outputPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Voice output path must stay inside artifacts/:runId.");
  }
  return outputPath;
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

async function appendGenerationLog(runDir: string, entry: unknown) {
  const logPath = path.join(runDir, "asset-generation-log.json");
  const log: unknown[] = await loadJson<unknown[]>(logPath).catch((): unknown[] => []);
  log.push(entry);
  await writeJson(logPath, log);
}

export async function generateOpenAITts(
  runId: string,
  request: GenerateVoiceRequest,
): Promise<GenerateVoiceResult> {
  assertSafeRunId(runId);
  if (isSupabaseStorageMode()) {
    throw new Error("OpenAI TTS generation currently writes local artifact files. Supabase Storage support is next.");
  }
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

  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "asset-manifest.json");
  const [pkg, manifest, providerSettings] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<AssetManifest>(manifestPath),
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
  const outputPath = outputPathFor(runId, item.expected_path);
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
    await writeJson(manifestPath, manifest);
    throw new Error(item.error);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  const now = new Date().toISOString();
  item.status = "generated";
  item.actual_path = item.expected_path;
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
    writeJson(manifestPath, manifest),
    writeJson(packagePath, pkg),
    appendGenerationLog(runDir, {
      at: now,
      asset_id: item.id,
      provider: ttsProvider.provider,
      model: ttsProvider.model,
      request_id: requestId,
      expected_path: item.expected_path,
      voice,
      response_format: responseFormat,
    }),
  ]);

  return {
    assetId: item.id,
    path: item.expected_path,
    provider: ttsProvider.provider,
    model: ttsProvider.model,
    voice,
    requestId,
    responseFormat,
  };
}
