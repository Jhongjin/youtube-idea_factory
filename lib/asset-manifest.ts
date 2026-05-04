import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductionPackage } from "@/lib/runs";

export type AssetKind = "image" | "video" | "thumbnail" | "voice" | "subtitles" | "bgm";

export type AssetManifestItem = {
  id: string;
  kind: AssetKind;
  scene_id?: string;
  prompt_id?: string;
  provider_role: "image" | "video" | "tts" | "subtitles" | "bgm";
  status: "pending_approval" | "pending_generation" | "generated" | "failed" | "skipped";
  approval_gate: "generation" | "render" | "publish";
  prompt?: string;
  negative_prompt?: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  expected_path: string;
  safety_notes?: string;
};

export type AssetManifest = {
  version: 1;
  run_id: string;
  created_at: string;
  updated_at: string;
  approval_required: true;
  items: AssetManifestItem[];
};

export type AssetManifestResult = {
  file: string;
  items: number;
  images: number;
  videos: number;
};

type MediaPrompt = {
  id?: string;
  scene_id?: string;
  prompt?: string;
  negative_prompt?: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  safety_notes?: string;
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

function asMediaPrompts(value: unknown): MediaPrompt[] {
  return Array.isArray(value)
    ? value.filter((item): item is MediaPrompt => typeof item === "object" && item !== null)
    : [];
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function artifactPath(runId: string, folder: string, filename: string) {
  return path.join("artifacts", runId, folder, filename).replace(/\\/g, "/");
}

function imageAsset(runId: string, prompt: MediaPrompt, index: number): AssetManifestItem {
  const promptId = prompt.id || `image-${index + 1}`;
  const id = safeId(promptId) || `image-${index + 1}`;
  return {
    id,
    kind: "image",
    scene_id: prompt.scene_id,
    prompt_id: promptId,
    provider_role: "image",
    status: "pending_approval",
    approval_gate: "generation",
    prompt: prompt.prompt,
    negative_prompt: prompt.negative_prompt,
    aspect_ratio: prompt.aspect_ratio,
    expected_path: artifactPath(runId, "images", `${id}.png`),
    safety_notes: prompt.safety_notes,
  };
}

function videoAsset(runId: string, prompt: MediaPrompt, index: number): AssetManifestItem {
  const promptId = prompt.id || `video-${index + 1}`;
  const id = safeId(promptId) || `video-${index + 1}`;
  return {
    id,
    kind: "video",
    scene_id: prompt.scene_id,
    prompt_id: promptId,
    provider_role: "video",
    status: "pending_approval",
    approval_gate: "generation",
    prompt: prompt.prompt,
    negative_prompt: prompt.negative_prompt,
    aspect_ratio: prompt.aspect_ratio,
    duration_seconds: prompt.duration_seconds,
    expected_path: artifactPath(runId, "videos", `${id}.mp4`),
    safety_notes: prompt.safety_notes,
  };
}

function supportingAssets(runId: string, pkg: ProductionPackage): AssetManifestItem[] {
  return [
    {
      id: "thumbnail-primary",
      kind: "thumbnail",
      provider_role: "image",
      status: pkg.publishing_package.thumbnail_prompt ? "pending_approval" : "skipped",
      approval_gate: "generation",
      prompt: pkg.publishing_package.thumbnail_prompt,
      aspect_ratio: pkg.brief.format === "shorts" ? "9:16" : "16:9",
      expected_path: artifactPath(runId, "thumbnails", "thumbnail-primary.png"),
      safety_notes: "Must match the final title/hook and avoid unsupported factual claims.",
    },
    {
      id: "voice-narration",
      kind: "voice",
      provider_role: "tts",
      status: "pending_approval",
      approval_gate: "generation",
      expected_path: artifactPath(runId, "audio", "voice-narration.wav"),
      safety_notes: "Use reviewed narration only. Do not synthesize a real person's likeness without approval.",
    },
    {
      id: "subtitles-primary",
      kind: "subtitles",
      provider_role: "subtitles",
      status: "pending_approval",
      approval_gate: "generation",
      expected_path: artifactPath(runId, "subtitles", "subtitles-primary.srt"),
      safety_notes: "Subtitles must match the final voice track and language settings.",
    },
    {
      id: "bgm-primary",
      kind: "bgm",
      provider_role: "bgm",
      status: "pending_approval",
      approval_gate: "generation",
      expected_path: artifactPath(runId, "audio", "bgm-primary.wav"),
      safety_notes: "Track license/provenance and keep music level below narration.",
    },
  ];
}

export async function createAssetManifest(runId: string): Promise<AssetManifestResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const pkg = await loadJson<ProductionPackage>(packagePath);
  const now = new Date().toISOString();
  const imagePrompts = asMediaPrompts(pkg.media_prompts.image_prompts);
  const videoPrompts = asMediaPrompts(pkg.media_prompts.video_prompts);
  const items = [
    ...imagePrompts.map((prompt, index) => imageAsset(runId, prompt, index)),
    ...videoPrompts.map((prompt, index) => videoAsset(runId, prompt, index)),
    ...supportingAssets(runId, pkg),
  ];

  const manifest: AssetManifest = {
    version: 1,
    run_id: runId,
    created_at: now,
    updated_at: now,
    approval_required: true,
    items,
  };

  await fs.mkdir(path.join(artifactsDir, runId), { recursive: true });
  await writeJson(path.join(runDir, "asset-manifest.json"), manifest);

  pkg.asset_manifest = {
    path: "asset-manifest.json",
    items: items.length,
    pending_approval: items.filter((item) => item.status === "pending_approval").length,
    updated_at: now,
  };
  await writeJson(packagePath, pkg);

  return {
    file: "asset-manifest.json",
    items: items.length,
    images: imagePrompts.length,
    videos: videoPrompts.length,
  };
}
