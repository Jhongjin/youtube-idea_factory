import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifest } from "@/lib/asset-manifest";
import { createRenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";

type SubtitleCue = {
  scene_id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
};

export type SubtitleDraftResult = {
  file: string;
  assetPath: string;
  cues: number;
};

type StoryboardScene = {
  scene_id?: string;
  duration_seconds?: number;
  narration?: string;
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

function asScenes(value: unknown): StoryboardScene[] {
  return Array.isArray(value)
    ? value.filter((item): item is StoryboardScene => typeof item === "object" && item !== null)
    : [];
}

function parseSeconds(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function parseTimeRange(value: string, fallbackStart: number, fallbackDuration: number) {
  const parts = value.replace(/s/gi, "").split("-").map((part) => part.trim());
  if (parts.length >= 2) {
    const start = parseSeconds(parts[0]);
    const end = Math.max(start + 1, parseSeconds(parts[1]));
    return { start, end };
  }
  return { start: fallbackStart, end: fallbackStart + fallbackDuration };
}

function cleanCell(value: string) {
  return value.replace(/`/g, "").trim();
}

function cuesFromStoryboardMarkdown(markdown: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let fallbackStart = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    if (line.includes("---") || line.includes("Scene | Time | Narration")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map(cleanCell);
    if (cells.length < 3 || !/^S\d+/i.test(cells[0])) {
      continue;
    }
    const range = parseTimeRange(cells[1], fallbackStart, 5);
    const text = cells[2];
    if (!text || text.toLowerCase() === "pending") {
      continue;
    }
    cues.push({
      scene_id: cells[0],
      start_seconds: range.start,
      end_seconds: range.end,
      text,
    });
    fallbackStart = range.end;
  }
  return cues;
}

function cuesFromPackageStoryboard(pkg: ProductionPackage): SubtitleCue[] {
  const scenes = asScenes(pkg.storyboard);
  const fallbackDuration = Math.max(
    1,
    Math.round((pkg.brief.target_duration_seconds ?? 60) / Math.max(1, scenes.length)),
  );
  let cursor = 0;
  return scenes.flatMap((scene, index) => {
    const duration = Math.max(1, scene.duration_seconds ?? fallbackDuration);
    const cue = scene.narration?.trim()
      ? [
          {
            scene_id: scene.scene_id || `S${index + 1}`,
            start_seconds: cursor,
            end_seconds: cursor + duration,
            text: scene.narration.trim(),
          },
        ]
      : [];
    cursor += duration;
    return cue;
  });
}

function formatSrtTime(seconds: number) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0",
  )},${String(ms).padStart(3, "0")}`;
}

function toSrt(cues: SubtitleCue[]) {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTime(cue.start_seconds)} --> ${formatSrtTime(
          cue.end_seconds,
        )}\n${cue.text}`,
    )
    .join("\n\n");
}

function relativeArtifactPath(runId: string) {
  return path.join("artifacts", runId, "subtitles", "subtitles-primary.srt").replace(/\\/g, "/");
}

export async function createSubtitleDraft(runId: string): Promise<SubtitleDraftResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "asset-manifest.json");
  const [pkg, manifest, storyboard] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<AssetManifest>(manifestPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error("Asset manifest not found. Build assets first.");
      }
      throw error;
    }),
    fs.readFile(path.join(runDir, "05-storyboard.md"), "utf-8").catch(() => ""),
  ]);

  const cues = cuesFromStoryboardMarkdown(storyboard);
  const fallbackCues = cues.length > 0 ? cues : cuesFromPackageStoryboard(pkg);
  if (fallbackCues.length === 0) {
    throw new Error("No narration found for subtitle draft.");
  }

  const subtitleAsset = manifest.items.find((item) => item.kind === "subtitles");
  if (!subtitleAsset) {
    throw new Error("Subtitle asset not found. Rebuild asset manifest.");
  }

  const now = new Date().toISOString();
  const assetPath = subtitleAsset.expected_path || relativeArtifactPath(runId);
  const outputPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), assetPath);
  const artifactRoot = path.join(artifactsDir, runId);
  const relative = path.relative(artifactRoot, outputPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Subtitle output path must stay inside artifacts/:runId.");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${toSrt(fallbackCues)}\n`, "utf-8");

  subtitleAsset.status = "generated";
  subtitleAsset.actual_path = assetPath;
  subtitleAsset.provider = "deterministic";
  subtitleAsset.model = "storyboard-srt-v1";
  subtitleAsset.generated_at = now;
  subtitleAsset.error = "";
  manifest.updated_at = now;

  pkg.asset_manifest = {
    path: "asset-manifest.json",
    items: manifest.items.length,
    pending_approval: manifest.items.filter((item) => item.status === "pending_approval").length,
    ready_for_generation: manifest.items.filter((item) => item.status === "pending_generation")
      .length,
    blocked: pkg.asset_manifest?.blocked ?? 0,
    updated_at: now,
  };

  await Promise.all([writeJson(manifestPath, manifest), writeJson(packagePath, pkg)]);
  await createRenderManifest(runId).catch(() => null);

  return {
    file: "subtitles-primary.srt",
    assetPath,
    cues: fallbackCues.length,
  };
}
