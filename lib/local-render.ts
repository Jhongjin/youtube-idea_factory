import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { createRenderManifest, type RenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { isSupabaseStorageMode } from "@/lib/storage-mode";

export type LocalRenderRequest = {
  confirmRender?: string;
};

export type LocalRenderResult = {
  outputPath: string;
  segments: number;
  subtitlesEmbedded: boolean;
  bgmMixed: boolean;
};

const execFileAsync = promisify(execFile);
const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");
const confirmToken = "RENDER_VIDEO";

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

function assertArtifactPath(runId: string, artifactPath: string, label: string) {
  const root = path.join(artifactsDir, runId);
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), artifactPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside artifacts/:runId.`);
  }
  return resolved;
}

async function runFfmpeg(args: string[]) {
  try {
    await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.slice(-3000);
    throw new Error(stderr || "ffmpeg failed.");
  }
}

async function runApprovalGate(runDir: string) {
  const scriptPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "scripts",
    "check_approval_gate.py",
  );
  try {
    await execFileAsync("python", [scriptPath, runDir, "--gate", "render"], {
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const details = [
      (error as { stdout?: string }).stdout,
      (error as { stderr?: string }).stderr,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(-3000);
    throw new Error(details || "Render approval gate failed.");
  }
}

function normalizeVideoFilter(width: number, height: number, fps: number) {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},format=yuv420p`;
}

function concatListLine(filePath: string) {
  return `file '${filePath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

async function renderSegment({
  duration,
  fps,
  height,
  input,
  kind,
  output,
  width,
}: {
  duration: number;
  fps: number;
  height: number;
  input: string;
  kind: string;
  output: string;
  width: number;
}) {
  const filter = normalizeVideoFilter(width, height, fps);
  if (kind === "image") {
    await runFfmpeg([
      "-y",
      "-loop",
      "1",
      "-t",
      String(duration),
      "-i",
      input,
      "-vf",
      filter,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      output,
    ]);
    return;
  }

  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-t",
    String(duration),
    "-vf",
    filter,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    output,
  ]);
}

async function muxAudio({
  bgmPath,
  inputVideo,
  outputVideo,
  voicePath,
}: {
  bgmPath: string;
  inputVideo: string;
  outputVideo: string;
  voicePath: string;
}) {
  if (bgmPath) {
    await runFfmpeg([
      "-y",
      "-i",
      inputVideo,
      "-i",
      voicePath,
      "-i",
      bgmPath,
      "-filter_complex",
      "[2:a]volume=0.18[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]",
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-shortest",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputVideo,
    ]);
    return;
  }

  await runFfmpeg([
    "-y",
    "-i",
    inputVideo,
    "-i",
    voicePath,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-shortest",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    outputVideo,
  ]);
}

async function embedSubtitles({
  inputVideo,
  outputVideo,
  subtitlePath,
}: {
  inputVideo: string;
  outputVideo: string;
  subtitlePath: string;
}) {
  await runFfmpeg([
    "-y",
    "-i",
    inputVideo,
    "-i",
    subtitlePath,
    "-map",
    "0",
    "-map",
    "1",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-c:s",
    "mov_text",
    outputVideo,
  ]);
}

export async function renderLocalVideo(
  runId: string,
  request: LocalRenderRequest,
): Promise<LocalRenderResult> {
  assertSafeRunId(runId);
  if (isSupabaseStorageMode()) {
    throw new Error("Local MP4 rendering requires local artifact files. Use local storage mode until render workers/object storage are added.");
  }
  if (request.confirmRender !== confirmToken) {
    throw new Error(`Local render requires confirmRender="${confirmToken}".`);
  }

  await createRenderManifest(runId);

  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const manifestPath = path.join(runDir, "render-manifest.json");
  const [pkg, manifest] = await Promise.all([
    loadJson<ProductionPackage>(packagePath),
    loadJson<RenderManifest>(manifestPath),
  ]);

  if (!manifest.summary.render_ready) {
    throw new Error("Render manifest is not ready.");
  }
  if (manifest.timeline.length === 0) {
    throw new Error("Render manifest has no timeline items.");
  }
  await runApprovalGate(runDir);

  const workDir = path.join(artifactsDir, runId, "render-work");
  await fs.mkdir(workDir, { recursive: true });
  const filterArgs = {
    fps: manifest.fps,
    height: manifest.resolution.height,
    width: manifest.resolution.width,
  };
  const segmentPaths: string[] = [];

  for (const [index, item] of manifest.timeline.entries()) {
    const input = assertArtifactPath(runId, item.primary_asset_path, `scene ${item.scene_id}`);
    const output = path.join(workDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
    await renderSegment({
      ...filterArgs,
      duration: item.duration_seconds,
      input,
      kind: item.primary_asset_kind,
      output,
    });
    segmentPaths.push(output);
  }

  const concatPath = path.join(workDir, "concat.txt");
  await fs.writeFile(concatPath, `${segmentPaths.map(concatListLine).join("\n")}\n`, "utf-8");
  const videoOnlyPath = path.join(workDir, "video-only.mp4");
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", videoOnlyPath]);

  const voicePath = assertArtifactPath(runId, manifest.audio.voice_path, "voice");
  const bgmPath =
    manifest.audio.bgm_status === "generated"
      ? assertArtifactPath(runId, manifest.audio.bgm_path, "bgm")
      : "";
  const withAudioPath = path.join(workDir, "with-audio.mp4");
  await muxAudio({
    bgmPath,
    inputVideo: videoOnlyPath,
    outputVideo: withAudioPath,
    voicePath,
  });

  const finalPath = assertArtifactPath(runId, manifest.output.final_path, "final render");
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  const subtitlePath = assertArtifactPath(runId, manifest.subtitles.path, "subtitles");
  await embedSubtitles({
    inputVideo: withAudioPath,
    outputVideo: finalPath,
    subtitlePath,
  });

  const now = new Date().toISOString();
  pkg.render_manifest = {
    path: "render-manifest.json",
    timeline_items: manifest.summary.timeline_items,
    ready_timeline_items: manifest.summary.ready_timeline_items,
    blockers: manifest.summary.blockers,
    render_ready: manifest.summary.render_ready,
    rendered_path: manifest.output.final_path,
    rendered_at: now,
    updated_at: now,
  };
  await Promise.all([
    writeJson(packagePath, pkg),
    writeJson(path.join(runDir, "render-log.json"), {
      rendered_at: now,
      output_path: manifest.output.final_path,
      segments: segmentPaths.length,
      subtitles_embedded: true,
      bgm_mixed: Boolean(bgmPath),
    }),
  ]);

  return {
    outputPath: manifest.output.final_path,
    segments: segmentPaths.length,
    subtitlesEmbedded: true,
    bgmMixed: Boolean(bgmPath),
  };
}
