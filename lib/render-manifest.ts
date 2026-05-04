import { promises as fs } from "node:fs";
import path from "node:path";
import { getRunApprovals } from "@/lib/approvals";
import type { AssetManifest, AssetManifestItem } from "@/lib/asset-manifest";
import type { ProductionPackage } from "@/lib/runs";

type StoryboardScene = {
  scene_id?: string;
  duration_seconds?: number;
  narration?: string;
  visual?: string;
  on_screen_text?: string;
};

export type RenderTimelineItem = {
  scene_id: string;
  start_seconds: number;
  duration_seconds: number;
  primary_asset_id: string;
  primary_asset_kind: AssetManifestItem["kind"];
  primary_asset_path: string;
  primary_asset_status: AssetManifestItem["status"];
  narration: string;
  on_screen_text: string;
  blockers: string[];
};

export type RenderManifest = {
  version: 1;
  run_id: string;
  created_at: string;
  updated_at: string;
  format: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  target_duration_seconds: number;
  output: {
    draft_path: string;
    final_path: string;
  };
  timeline: RenderTimelineItem[];
  audio: {
    voice_asset_id: string;
    voice_path: string;
    voice_status: AssetManifestItem["status"] | "missing";
    bgm_asset_id: string;
    bgm_path: string;
    bgm_status: AssetManifestItem["status"] | "missing";
    blockers: string[];
  };
  subtitles: {
    asset_id: string;
    path: string;
    status: AssetManifestItem["status"] | "missing";
    blockers: string[];
  };
  approvals: {
    render: {
      approved: boolean;
      approved_by: string;
      approved_at: string;
    };
  };
  summary: {
    timeline_items: number;
    ready_timeline_items: number;
    blockers: number;
    render_ready: boolean;
  };
};

export type RenderManifestResult = {
  file: string;
  timelineItems: number;
  readyTimelineItems: number;
  blockers: number;
  renderReady: boolean;
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

async function fileExists(assetPath: string) {
  try {
    await fs.access(path.resolve(/* turbopackIgnore: true */ process.cwd(), assetPath));
    return true;
  } catch {
    return false;
  }
}

function asScenes(value: unknown): StoryboardScene[] {
  return Array.isArray(value)
    ? value.filter((item): item is StoryboardScene => typeof item === "object" && item !== null)
    : [];
}

function uniqueSceneIds(manifest: AssetManifest) {
  return Array.from(
    new Set(
      manifest.items
        .map((item) => item.scene_id)
        .filter((sceneId): sceneId is string => Boolean(sceneId)),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function resolutionFor(format: string) {
  return format.toLowerCase().includes("short")
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

function assetPath(item?: AssetManifestItem) {
  return item?.actual_path || item?.expected_path || "";
}

function renderAssetForScene(manifest: AssetManifest, sceneId: string) {
  const candidates = manifest.items.filter((item) => item.scene_id === sceneId);
  return (
    candidates.find((item) => item.kind === "video" && item.status === "generated") ??
    candidates.find((item) => item.kind === "image" && item.status === "generated") ??
    candidates.find((item) => item.kind === "video") ??
    candidates.find((item) => item.kind === "image")
  );
}

function assetByKind(manifest: AssetManifest, kind: AssetManifestItem["kind"]) {
  return manifest.items.find((item) => item.kind === kind);
}

async function assetBlockers(item: AssetManifestItem | undefined, label: string) {
  if (!item) {
    return [`${label} asset is missing from asset-manifest.json`];
  }
  const blockers: string[] = [];
  if (item.status !== "generated") {
    blockers.push(`${label} asset status is ${item.status}`);
  }
  const outputPath = assetPath(item);
  if (!outputPath) {
    blockers.push(`${label} asset path is empty`);
  } else if (item.status === "generated" && !(await fileExists(outputPath))) {
    blockers.push(`${label} file does not exist: ${outputPath}`);
  }
  return blockers;
}

function sceneDuration(
  scene: StoryboardScene | undefined,
  asset: AssetManifestItem | undefined,
  fallback: number,
) {
  return Math.max(1, scene?.duration_seconds ?? asset?.duration_seconds ?? fallback);
}

export async function createRenderManifest(runId: string): Promise<RenderManifestResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "asset-manifest.json");
  const [pkg, manifest, approvals] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<AssetManifest>(manifestPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error("Asset manifest not found. Build assets first.");
      }
      throw error;
    }),
    getRunApprovals(runId),
  ]);

  const now = new Date().toISOString();
  const scenes = asScenes(pkg.storyboard);
  const sceneIds = scenes.length > 0 ? scenes.map((scene, index) => scene.scene_id || `S${index + 1}`) : uniqueSceneIds(manifest);
  const fallbackDuration = Math.max(1, Math.round((pkg.brief.target_duration_seconds ?? 60) / Math.max(1, sceneIds.length)));
  let cursor = 0;
  const timeline: RenderTimelineItem[] = [];

  for (const [index, sceneId] of sceneIds.entries()) {
    const scene = scenes.find((candidate) => candidate.scene_id === sceneId) ?? scenes[index];
    const asset = renderAssetForScene(manifest, sceneId);
    const duration = sceneDuration(scene, asset, fallbackDuration);
    const blockers = await assetBlockers(asset, `scene ${sceneId}`);
    timeline.push({
      scene_id: sceneId,
      start_seconds: cursor,
      duration_seconds: duration,
      primary_asset_id: asset?.id ?? "",
      primary_asset_kind: asset?.kind ?? "image",
      primary_asset_path: assetPath(asset),
      primary_asset_status: asset?.status ?? "skipped",
      narration: scene?.narration ?? "",
      on_screen_text: scene?.on_screen_text ?? "",
      blockers,
    });
    cursor += duration;
  }

  const voice = assetByKind(manifest, "voice");
  const subtitles = assetByKind(manifest, "subtitles");
  const bgm = assetByKind(manifest, "bgm");
  const [voiceBlockers, subtitleBlockers, bgmBlockers] = await Promise.all([
    assetBlockers(voice, "voice"),
    assetBlockers(subtitles, "subtitles"),
    assetBlockers(bgm, "bgm"),
  ]);
  const renderApproval = approvals.render;
  const approvalBlockers =
    renderApproval.approved && renderApproval.approved_by.trim() && renderApproval.approved_at.trim()
      ? []
      : ["render approval gate is not complete"];
  const qaBlockers = pkg.qa.status === "blocked" ? ["qa.status is blocked"] : [];
  const totalBlockers =
    timeline.reduce((sum, item) => sum + item.blockers.length, 0) +
    voiceBlockers.length +
    subtitleBlockers.length +
    bgmBlockers.length +
    approvalBlockers.length +
    qaBlockers.length;
  const renderReady = totalBlockers === 0;
  const renderManifest: RenderManifest = {
    version: 1,
    run_id: runId,
    created_at: now,
    updated_at: now,
    format: pkg.brief.format,
    resolution: resolutionFor(pkg.brief.format),
    fps: 30,
    target_duration_seconds: pkg.brief.target_duration_seconds ?? cursor,
    output: {
      draft_path: path.join("artifacts", runId, "renders", "draft.mp4").replace(/\\/g, "/"),
      final_path: path.join("artifacts", runId, "renders", "final.mp4").replace(/\\/g, "/"),
    },
    timeline,
    audio: {
      voice_asset_id: voice?.id ?? "",
      voice_path: assetPath(voice),
      voice_status: voice?.status ?? "missing",
      bgm_asset_id: bgm?.id ?? "",
      bgm_path: assetPath(bgm),
      bgm_status: bgm?.status ?? "missing",
      blockers: [...voiceBlockers, ...bgmBlockers],
    },
    subtitles: {
      asset_id: subtitles?.id ?? "",
      path: assetPath(subtitles),
      status: subtitles?.status ?? "missing",
      blockers: subtitleBlockers,
    },
    approvals: {
      render: {
        approved: renderApproval.approved,
        approved_by: renderApproval.approved_by,
        approved_at: renderApproval.approved_at,
      },
    },
    summary: {
      timeline_items: timeline.length,
      ready_timeline_items: timeline.filter((item) => item.blockers.length === 0).length,
      blockers: totalBlockers,
      render_ready: renderReady,
    },
  };

  await fs.mkdir(path.join(artifactsDir, runId, "renders"), { recursive: true });
  await writeJson(path.join(runDir, "render-manifest.json"), renderManifest);
  pkg.render_manifest = {
    path: "render-manifest.json",
    timeline_items: renderManifest.summary.timeline_items,
    ready_timeline_items: renderManifest.summary.ready_timeline_items,
    blockers: renderManifest.summary.blockers,
    render_ready: renderManifest.summary.render_ready,
    updated_at: now,
  };
  await writeJson(packagePath, pkg);

  return {
    file: "render-manifest.json",
    timelineItems: renderManifest.summary.timeline_items,
    readyTimelineItems: renderManifest.summary.ready_timeline_items,
    blockers: renderManifest.summary.blockers,
    renderReady: renderManifest.summary.render_ready,
  };
}
