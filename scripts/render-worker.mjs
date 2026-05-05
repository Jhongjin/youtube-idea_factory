#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const runsDir = path.join(root, "runs");
const artifactsDir = path.join(root, "artifacts");
const confirmToken = "RUN_RENDER_WORKER";
const defaultBucket = "youtube-assets";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/render-worker.mjs --run-id <runId> --confirm ${confirmToken}

Options:
  --next                    Claim and run the next queued render job.
  --poll                    Keep polling queued render jobs.
  --storage local|supabase   Defaults to APP_STORAGE_MODE or local.
  --work-dir <path>          Optional temporary render workspace.
  --interval-seconds <n>     Poll interval. Defaults to 15.
  --max-jobs <n>             Stop after n jobs. Defaults to 1 for --next, unlimited for --poll.
`);
}

function assertSafeRunId(runId) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function encodePath(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseSupabaseUri(value) {
  if (!value.startsWith("supabase://")) {
    return null;
  }
  const rest = value.slice("supabase://".length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex < 1 || slashIndex === rest.length - 1) {
    throw new Error(`Invalid Supabase URI: ${value}`);
  }
  return {
    bucket: rest.slice(0, slashIndex),
    objectPath: rest.slice(slashIndex + 1),
  };
}

function normalizeRunFilePath(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.split("/").includes("..")) {
    throw new Error("Invalid run file path.");
  }
  return normalized;
}

function localRunFile(runId, filePath) {
  const runDir = path.join(runsDir, runId);
  const resolved = path.resolve(runDir, normalizeRunFilePath(filePath));
  const rootPath = path.resolve(runDir);
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error("Run file path must stay inside runs/:runId.");
  }
  return resolved;
}

function localArtifactFile(runId, artifactPath) {
  const normalized = String(artifactPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const runRoot = path.resolve(artifactsDir, runId);
  const resolved = path.resolve(root, normalized);
  if (!normalized.startsWith(`artifacts/${runId}/`)) {
    throw new Error(`Artifact path must start with artifacts/${runId}/`);
  }
  if (resolved !== runRoot && !resolved.startsWith(`${runRoot}${path.sep}`)) {
    throw new Error("Artifact path must stay inside artifacts/:runId.");
  }
  return resolved;
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase worker mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return {
    bucket: process.env.SUPABASE_ASSETS_BUCKET?.trim() || defaultBucket,
    key,
    url,
  };
}

async function supabaseRequest(pathSuffix, init = {}) {
  const { key, url } = supabaseConfig();
  const response = await fetch(`${url}/${pathSuffix}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  }
  return response;
}

async function readSupabasePackage(runId) {
  const response = await supabaseRequest(
    `rest/v1/production_runs?id=eq.${encodeURIComponent(runId)}&select=package&limit=1`,
  );
  const rows = await response.json();
  if (!rows[0]?.package) {
    throw new Error(`Run package not found in Supabase: ${runId}`);
  }
  return rows[0].package;
}

async function writeSupabasePackage(pkg, status = "needs_review") {
  await supabaseRequest("rest/v1/production_runs?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      category: pkg.brief?.category ?? null,
      format: pkg.brief?.format ?? "",
      id: pkg.run_id,
      language: pkg.brief?.language ?? "",
      package: pkg,
      status,
      topic: pkg.brief?.topic ?? "",
      updated_at: new Date().toISOString(),
    }),
  });
}

async function readSupabaseArtifact(runId, artifactKey) {
  const query = new URLSearchParams({
    artifact_key: `eq.${artifactKey}`,
    limit: "1",
    run_id: `eq.${runId}`,
    select: "content",
  });
  const response = await supabaseRequest(`rest/v1/run_artifacts?${query}`);
  const rows = await response.json();
  if (!rows[0]?.content) {
    throw new Error(`Run artifact not found in Supabase: ${artifactKey}`);
  }
  return JSON.parse(rows[0].content);
}

async function writeSupabaseArtifact(runId, artifactKey, data, source = "render-worker") {
  await supabaseRequest("rest/v1/run_artifacts?on_conflict=run_id,artifact_key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      artifact_key: artifactKey,
      content: `${JSON.stringify(data, null, 2)}\n`,
      filename: path.posix.basename(artifactKey),
      metadata: { source },
      run_id: runId,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function readRunJson(storageMode, runId, filePath) {
  if (storageMode === "supabase") {
    if (filePath === "production-package.json") {
      return readSupabasePackage(runId);
    }
    return readSupabaseArtifact(runId, normalizeRunFilePath(filePath));
  }
  return JSON.parse(await fs.readFile(localRunFile(runId, filePath), "utf-8"));
}

async function writeRunJson(storageMode, runId, filePath, data) {
  if (storageMode === "supabase") {
    if (filePath === "production-package.json") {
      await writeSupabasePackage(data);
      return;
    }
    await writeSupabaseArtifact(runId, normalizeRunFilePath(filePath), data);
    return;
  }
  const output = localRunFile(runId, filePath);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function isMissingWorkerJobsTable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PGRST205") || message.includes("Could not find the table");
}

async function readWorkerJobRecords(storageMode, runId) {
  if (storageMode === "supabase") {
    const query = new URLSearchParams({
      run_id: `eq.${runId}`,
      select: "*",
    });
    const response = await supabaseRequest(`rest/v1/worker_jobs?${query}`);
    return response.json();
  }
  return readRunJson(storageMode, runId, "worker-jobs.json").catch(() => []);
}

function renderQueueRecord(runId, job, status) {
  const now = job.updated_at || new Date().toISOString();
  return {
    approval_gate: "render",
    attempts: status === "queued" ? 0 : 1,
    completed_at: job.completed_at || job.failed_at || null,
    id: job.job_id,
    job_artifact_key: "render-worker-job.json",
    kind: "render",
    last_error: job.error || "",
    log_artifact_key: "render-log.json",
    payload: {
      output_path: job.output_path || "",
      timeline_items: Array.isArray(job.inputs?.timeline) ? job.inputs.timeline.length : 0,
    },
    provider_role: "render",
    queued_at: job.created_at || now,
    run_id: runId,
    started_at: job.started_at || null,
    status,
    updated_at: now,
    worker_type: "ffmpeg",
  };
}

async function writeWorkerJobRecord(storageMode, runId, job, status) {
  const record = renderQueueRecord(runId, job, status);
  if (storageMode === "supabase") {
    await supabaseRequest("rest/v1/worker_jobs?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(record),
    });
    return;
  }
  const records = await readWorkerJobRecords(storageMode, runId).catch(() => []);
  await writeRunJson(storageMode, runId, "worker-jobs.json", [
    record,
    ...records.filter((item) => item?.id !== record.id),
  ]);
}

async function writeLocalWorkerJobRecords(runId, records) {
  await writeRunJson("local", runId, "worker-jobs.json", records);
}

function workerRecordTimestamp(record) {
  const value = Date.parse(record?.queued_at || record?.updated_at || "");
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

async function listLocalQueuedWorkerJobs(kind) {
  const entries = await fs.readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const records = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runId = entry.name;
    const runRecords = await readWorkerJobRecords("local", runId).catch(() => []);
    for (const record of runRecords) {
      if (record?.kind === kind && record?.status === "queued") {
        records.push(record);
      }
    }
  }
  return records.sort((a, b) => workerRecordTimestamp(a) - workerRecordTimestamp(b));
}

async function patchWorkerJobRecord(storageMode, record, patch) {
  const now = new Date().toISOString();
  const nextPatch = { ...patch, updated_at: now };
  if (storageMode === "supabase") {
    const query = new URLSearchParams({
      id: `eq.${record.id}`,
    });
    const response = await supabaseRequest(`rest/v1/worker_jobs?${query}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(nextPatch),
    });
    const rows = await response.json();
    return rows[0] || { ...record, ...nextPatch };
  }
  const records = await readWorkerJobRecords("local", record.run_id).catch(() => []);
  const nextRecord = { ...record, ...nextPatch };
  await writeLocalWorkerJobRecords(record.run_id, records.map((item) => (item.id === record.id ? nextRecord : item)));
  return nextRecord;
}

async function claimSupabaseWorkerJob(kind) {
  const query = new URLSearchParams({
    kind: `eq.${kind}`,
    limit: "5",
    order: "queued_at.asc",
    select: "*",
    status: "eq.queued",
  });
  const response = await supabaseRequest(`rest/v1/worker_jobs?${query}`);
  const rows = await response.json();
  for (const row of rows) {
    const now = new Date().toISOString();
    const claimQuery = new URLSearchParams({
      id: `eq.${row.id}`,
      status: "eq.queued",
    });
    const claimResponse = await supabaseRequest(`rest/v1/worker_jobs?${claimQuery}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        attempts: Number(row.attempts || 0) + 1,
        last_error: "",
        started_at: now,
        status: "running",
        updated_at: now,
      }),
    });
    const claimed = await claimResponse.json();
    if (claimed[0]) {
      return claimed[0];
    }
  }
  return null;
}

async function claimLocalWorkerJob(kind) {
  const records = await listLocalQueuedWorkerJobs(kind);
  const record = records[0];
  if (!record) {
    return null;
  }
  return patchWorkerJobRecord("local", record, {
    attempts: Number(record.attempts || 0) + 1,
    last_error: "",
    started_at: new Date().toISOString(),
    status: "running",
  });
}

async function claimNextWorkerJob(storageMode, kind) {
  if (storageMode === "supabase") {
    return claimSupabaseWorkerJob(kind);
  }
  return claimLocalWorkerJob(kind);
}

async function downloadSupabaseObject(bucket, objectPath, outputPath) {
  const response = await supabaseRequest(
    `storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(objectPath)}`,
    { method: "GET" },
  );
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function uploadSupabaseObject(bucket, objectPath, inputPath, contentType) {
  await supabaseRequest(`storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(objectPath)}`, {
    method: "PUT",
    headers: {
      "Cache-Control": "3600",
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: await fs.readFile(inputPath),
  });
  return `supabase://${bucket}/${objectPath}`;
}

async function resolveInputAsset({ runId, storageMode, assetPath, workDir, label }) {
  if (!assetPath) {
    return "";
  }
  const parsed = parseSupabaseUri(assetPath);
  if (parsed) {
    const outputPath = path.join(workDir, "inputs", label, path.basename(parsed.objectPath));
    await downloadSupabaseObject(parsed.bucket, parsed.objectPath, outputPath);
    return outputPath;
  }
  if (storageMode === "supabase") {
    const { bucket } = supabaseConfig();
    const objectPath = assetPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const outputPath = path.join(workDir, "inputs", label, path.basename(objectPath));
    await downloadSupabaseObject(bucket, objectPath, outputPath);
    return outputPath;
  }
  return localArtifactFile(runId, assetPath);
}

async function resolveOutputAsset({ runId, storageMode, outputPath, workDir }) {
  const parsed = parseSupabaseUri(outputPath);
  const localOutput = parsed
    ? path.join(workDir, "output", path.basename(parsed.objectPath))
    : storageMode === "supabase"
      ? path.join(workDir, "output", path.basename(outputPath))
      : localArtifactFile(runId, outputPath);
  await fs.mkdir(path.dirname(localOutput), { recursive: true });
  return {
    localOutput,
    async publish() {
      if (parsed) {
        return uploadSupabaseObject(parsed.bucket, parsed.objectPath, localOutput, "video/mp4");
      }
      if (storageMode === "supabase") {
        const { bucket } = supabaseConfig();
        const objectPath = outputPath.replace(/\\/g, "/").replace(/^\/+/, "");
        return uploadSupabaseObject(bucket, objectPath, localOutput, "video/mp4");
      }
      return outputPath.replace(/\\/g, "/");
    },
  };
}

async function runFfmpeg(args) {
  try {
    await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    const stderr = error?.stderr?.slice?.(-3000);
    throw new Error(stderr || "ffmpeg failed.");
  }
}

function normalizeVideoFilter(width, height, fps) {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},format=yuv420p`;
}

function concatListLine(filePath) {
  return `file '${filePath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

async function renderSegment({ duration, fps, height, input, kind, output, width }) {
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

async function muxAudio({ bgmPath, inputVideo, outputVideo, voicePath }) {
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

async function embedSubtitles({ inputVideo, outputVideo, subtitlePath }) {
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

async function markJob(storageMode, runId, job, pkg, status, patch = {}) {
  const now = new Date().toISOString();
  const { render_manifest_patch: renderManifestPatch, ...jobPatch } = patch;
  const lifecyclePatch =
    status === "running"
      ? { started_at: job.started_at || now }
      : status === "completed"
        ? { completed_at: now }
        : status === "failed"
          ? { failed_at: now }
          : {};
  const nextJob = { ...job, ...lifecyclePatch, ...jobPatch, status, updated_at: now };
  const nextPackage = {
    ...pkg,
    render_manifest: {
      ...(pkg.render_manifest ?? {}),
      worker_job_id: job.job_id,
      worker_job_path: "render-worker-job.json",
      worker_job_status: status,
      updated_at: now,
      ...(renderManifestPatch ?? {}),
    },
  };
  await Promise.all([
    writeRunJson(storageMode, runId, "render-worker-job.json", nextJob),
    writeRunJson(storageMode, runId, "production-package.json", nextPackage),
  ]);
  await writeWorkerJobRecord(storageMode, runId, nextJob, status).catch((error) => {
    if (!isMissingWorkerJobsTable(error)) {
      console.warn(`worker_jobs update skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return { job: nextJob, pkg: nextPackage };
}

async function runRenderJob({ args, runId, storageMode }) {
  assertSafeRunId(runId);

  let job = await readRunJson(storageMode, runId, "render-worker-job.json");
  const manifest = await readRunJson(storageMode, runId, "render-manifest.json");
  let pkg = await readRunJson(storageMode, runId, "production-package.json");
  if (!job.checks?.render_ready || job.checks?.blockers !== 0) {
    throw new Error("Render worker job is not ready.");
  }

  const baseWorkDir =
    args["work-dir"] ||
    path.join(artifactsDir, runId, "render-worker", String(job.job_id || "job"));
  await fs.mkdir(baseWorkDir, { recursive: true });
  ({ job, pkg } = await markJob(storageMode, runId, job, pkg, "running"));

  try {
    const filterArgs = {
      fps: manifest.fps,
      height: manifest.resolution.height,
      width: manifest.resolution.width,
    };
    const segmentPaths = [];
    for (const [index, item] of job.inputs.timeline.entries()) {
      const input = await resolveInputAsset({
        assetPath: item.path,
        label: `scene-${index + 1}`,
        runId,
        storageMode,
        workDir: baseWorkDir,
      });
      const output = path.join(baseWorkDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
      await renderSegment({
        ...filterArgs,
        duration: item.duration_seconds,
        input,
        kind: item.kind,
        output,
      });
      segmentPaths.push(output);
    }

    const concatPath = path.join(baseWorkDir, "concat.txt");
    await fs.writeFile(concatPath, `${segmentPaths.map(concatListLine).join("\n")}\n`, "utf-8");
    const videoOnlyPath = path.join(baseWorkDir, "video-only.mp4");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", videoOnlyPath]);

    const voicePath = await resolveInputAsset({
      assetPath: job.inputs.voice_path,
      label: "voice",
      runId,
      storageMode,
      workDir: baseWorkDir,
    });
    const bgmPath = job.inputs.bgm_path
      ? await resolveInputAsset({
          assetPath: job.inputs.bgm_path,
          label: "bgm",
          runId,
          storageMode,
          workDir: baseWorkDir,
        })
      : "";
    const withAudioPath = path.join(baseWorkDir, "with-audio.mp4");
    await muxAudio({ bgmPath, inputVideo: videoOnlyPath, outputVideo: withAudioPath, voicePath });

    const output = await resolveOutputAsset({
      outputPath: job.output_path,
      runId,
      storageMode,
      workDir: baseWorkDir,
    });
    const subtitlePath = await resolveInputAsset({
      assetPath: job.inputs.subtitles_path,
      label: "subtitles",
      runId,
      storageMode,
      workDir: baseWorkDir,
    });
    await embedSubtitles({
      inputVideo: withAudioPath,
      outputVideo: output.localOutput,
      subtitlePath,
    });
    const publishedPath = await output.publish();
    const now = new Date().toISOString();
    const renderLog = {
      rendered_at: now,
      output_path: publishedPath,
      segments: segmentPaths.length,
      subtitles_embedded: true,
      bgm_mixed: Boolean(bgmPath),
      worker_job_id: job.job_id,
    };
    await writeRunJson(storageMode, runId, "render-log.json", renderLog);
    await markJob(storageMode, runId, job, pkg, "completed", {
      completed_at: now,
      output_path: publishedPath,
      render_manifest_patch: {
        rendered_at: now,
        rendered_path: publishedPath,
      },
    });
    console.log(JSON.stringify({ status: "completed", outputPath: publishedPath }, null, 2));
  } catch (error) {
    await markJob(storageMode, runId, job, pkg, "failed", {
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => null);
    throw error;
  }
}

function pollIntervalMs(args) {
  const seconds = Number(args["interval-seconds"] || 15);
  return Math.max(1, Number.isFinite(seconds) ? seconds : 15) * 1000;
}

function maxJobs(args) {
  if (args["max-jobs"] !== undefined) {
    const value = Number(args["max-jobs"]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }
  return args.poll === "true" ? Number.POSITIVE_INFINITY : 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQueuedMode(args, storageMode) {
  const limit = maxJobs(args);
  let processed = 0;
  while (processed < limit) {
    const claimed = await claimNextWorkerJob(storageMode, "render");
    if (!claimed) {
      const idle = { kind: "render", status: "idle", storageMode };
      console.log(JSON.stringify(idle, null, 2));
      if (args.poll !== "true") {
        return;
      }
      await sleep(pollIntervalMs(args));
      continue;
    }

    try {
      await runRenderJob({ args, runId: claimed.run_id, storageMode });
      processed += 1;
    } catch (error) {
      await patchWorkerJobRecord(storageMode, claimed, {
        completed_at: new Date().toISOString(),
        last_error: error instanceof Error ? error.message : String(error),
        status: "failed",
      }).catch(() => null);
      throw error;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = args["run-id"];
  const storageMode = args.storage || process.env.APP_STORAGE_MODE || "local";
  if (args.confirm !== confirmToken) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (storageMode !== "local" && storageMode !== "supabase") {
    throw new Error("--storage must be local or supabase.");
  }
  if (args.next === "true" || args.poll === "true") {
    await runQueuedMode(args, storageMode);
    return;
  }
  if (!runId) {
    usage();
    process.exitCode = 2;
    return;
  }
  await runRenderJob({ args, runId, storageMode });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
