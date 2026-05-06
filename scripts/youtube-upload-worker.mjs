#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const root = process.cwd();
const runsDir = path.join(root, "runs");
const artifactsDir = path.join(root, "artifacts");
const confirmToken = "RUN_YOUTUBE_UPLOAD";
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
  npm run youtube:upload-worker -- --run-id <runId> --confirm ${confirmToken}

Required OAuth env:
  YOUTUBE_OAUTH_CLIENT_ID
  YOUTUBE_OAUTH_CLIENT_SECRET
  YOUTUBE_OAUTH_REFRESH_TOKEN

Options:
  --next                    Claim and run the next queued YouTube upload job.
  --poll                    Keep polling queued YouTube upload jobs.
  --storage local|supabase   Defaults to APP_STORAGE_MODE or local.
  --work-dir <path>          Optional temporary upload workspace.
  --dry-run                  Check OAuth and asset readiness without uploading.
  --skip-thumbnail           Upload video only.
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
  let response;
  try {
    response = await fetch(`${url}/${pathSuffix}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
    const code =
      cause && "code" in cause && typeof cause.code === "string" ? ` (${cause.code})` : "";
    throw new Error(
      [
        `Supabase request failed${code}: ${cause?.message ?? (error instanceof Error ? error.message : String(error))}`,
        "Check local network/TLS certificates. Prefer NODE_OPTIONS=--use-system-ca or NODE_EXTRA_CA_CERTS over disabling TLS verification.",
      ].join("\n"),
    );
  }
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

async function writeSupabaseArtifact(runId, artifactKey, data, source = "youtube-upload-worker") {
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

function uploadQueueRecord(runId, job, status) {
  const now = job.updated_at || new Date().toISOString();
  return {
    approval_gate: "publish",
    attempts: status === "queued" ? 0 : 1,
    completed_at: job.completed_at || job.failed_at || null,
    id: job.job_id,
    job_artifact_key: "youtube-upload-job.json",
    kind: "youtube-upload",
    last_error: job.error || "",
    log_artifact_key: "youtube-upload-log.json",
    payload: {
      made_for_kids: Boolean(job.metadata?.made_for_kids),
      privacy_status: job.metadata?.privacy_status || "",
      scheduled_at: job.metadata?.scheduled_at || "",
      title: job.metadata?.title || "",
      video_url: job.video_url || "",
    },
    provider_role: "youtube",
    queued_at: job.created_at || now,
    run_id: runId,
    started_at: job.started_at || null,
    status,
    updated_at: now,
    worker_type: "youtube-upload",
  };
}

async function writeWorkerJobRecord(storageMode, runId, job, status) {
  const record = uploadQueueRecord(runId, job, status);
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

function contentTypeFor(filePath, fallback) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".mp4") {
    return "video/mp4";
  }
  if (extension === ".mov") {
    return "video/quicktime";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return fallback;
}

async function resolveInputAsset({ runId, storageMode, assetPath, workDir, label }) {
  if (!assetPath) {
    throw new Error(`${label} path is missing.`);
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

function youtubeOAuthConfig() {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YouTube upload worker requires YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, and YOUTUBE_OAUTH_REFRESH_TOKEN.",
    );
  }
  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = youtubeOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description ?? body?.error ?? `OAuth refresh failed with ${response.status}`);
  }
  return body.access_token;
}

function categoryId(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d+$/.test(trimmed) ? trimmed : undefined;
}

function uploadMetadata(job) {
  const scheduledAt = job.metadata.scheduled_at?.trim();
  const privacyStatus = scheduledAt ? "private" : job.metadata.privacy_status;
  return {
    snippet: {
      title: job.metadata.title,
      description: job.metadata.description,
      tags: job.metadata.tags,
      categoryId: categoryId(job.metadata.category),
      defaultLanguage: job.metadata.language || undefined,
    },
    status: {
      privacyStatus,
      publishAt: scheduledAt || undefined,
      selfDeclaredMadeForKids: Boolean(job.metadata.made_for_kids),
    },
  };
}

async function uploadVideo({ accessToken, job, videoPath }) {
  const bytes = await fs.readFile(videoPath);
  const contentType = contentTypeFor(videoPath, "video/mp4");
  const metadata = uploadMetadata(job);
  const initiate = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.byteLength),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!initiate.ok) {
    const text = await initiate.text().catch(() => "");
    throw new Error(`YouTube upload initiation failed with ${initiate.status}: ${text.slice(0, 800)}`);
  }
  const location = initiate.headers.get("location");
  if (!location) {
    throw new Error("YouTube upload initiation did not return a resumable session URL.");
  }

  const upload = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
      "Content-Type": contentType,
    },
    body: bytes,
  });
  const body = await upload.json().catch(async () => ({ raw: await upload.text().catch(() => "") }));
  if (!upload.ok || !body?.id) {
    throw new Error(`YouTube video upload failed with ${upload.status}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return {
    response: body,
    videoId: body.id,
    videoUrl: `https://www.youtube.com/watch?v=${body.id}`,
  };
}

async function uploadThumbnail({ accessToken, thumbnailPath, videoId }) {
  const bytes = await fs.readFile(thumbnailPath);
  const contentType = contentTypeFor(thumbnailPath, "image/png");
  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": contentType,
      },
      body: bytes,
    },
  );
  const body = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
  if (!response.ok) {
    throw new Error(`YouTube thumbnail upload failed with ${response.status}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return body;
}

async function markJob(storageMode, runId, job, pkg, status, patch = {}) {
  const now = new Date().toISOString();
  const { package_patch: packagePatch, ...jobPatch } = patch;
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
    publishing_handoff: {
      ...(pkg.publishing_handoff ?? {}),
      upload_job_id: job.job_id,
      upload_job_path: "youtube-upload-job.json",
      upload_job_status: status,
      updated_at: now,
      ...(packagePatch ?? {}),
    },
  };
  await Promise.all([
    writeRunJson(storageMode, runId, "youtube-upload-job.json", nextJob),
    writeRunJson(storageMode, runId, "production-package.json", nextPackage),
  ]);
  await writeWorkerJobRecord(storageMode, runId, nextJob, status).catch((error) => {
    if (!isMissingWorkerJobsTable(error)) {
      console.warn(`worker_jobs update skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return { job: nextJob, pkg: nextPackage };
}

async function runUploadJob({ args, runId, storageMode }) {
  assertSafeRunId(runId);
  const dryRun = args["dry-run"] === "true";
  let job = await readRunJson(storageMode, runId, "youtube-upload-job.json");
  let pkg = await readRunJson(storageMode, runId, "production-package.json");
  if (!dryRun && job.status !== "queued" && args.force !== "true") {
    throw new Error(`Upload job status must be queued. Current status: ${job.status}`);
  }

  const baseWorkDir =
    args["work-dir"] ||
    path.join(artifactsDir, runId, "youtube-upload-worker", String(job.job_id || "job"));
  await fs.mkdir(baseWorkDir, { recursive: true });

  if (dryRun) {
    const [accessToken, videoPath, thumbnailPath] = await Promise.all([
      getAccessToken(),
      resolveInputAsset({
        assetPath: job.video.path,
        label: "video",
        runId,
        storageMode,
        workDir: baseWorkDir,
      }),
      args["skip-thumbnail"] === "true"
        ? Promise.resolve("")
        : resolveInputAsset({
            assetPath: job.thumbnail.path,
            label: "thumbnail",
            runId,
            storageMode,
            workDir: baseWorkDir,
          }),
    ]);
    console.log(JSON.stringify({
      status: "ready",
      dryRun: true,
      runId,
      jobId: job.job_id,
      jobStatus: job.status,
      storageMode,
      oauth: accessToken ? "access_token_refreshed" : "missing",
      videoPath,
      thumbnailPath: thumbnailPath || null,
      metadata: {
        title: job.metadata.title,
        privacyStatus: job.metadata.scheduled_at?.trim() ? "private" : job.metadata.privacy_status,
        scheduledAt: job.metadata.scheduled_at || null,
        madeForKids: Boolean(job.metadata.made_for_kids),
      },
    }, null, 2));
    return;
  }

  ({ job, pkg } = await markJob(storageMode, runId, job, pkg, "running"));

  try {
    const [accessToken, videoPath, thumbnailPath] = await Promise.all([
      getAccessToken(),
      resolveInputAsset({
        assetPath: job.video.path,
        label: "video",
        runId,
        storageMode,
        workDir: baseWorkDir,
      }),
      args["skip-thumbnail"] === "true"
        ? Promise.resolve("")
        : resolveInputAsset({
            assetPath: job.thumbnail.path,
            label: "thumbnail",
            runId,
            storageMode,
            workDir: baseWorkDir,
          }),
    ]);
    const video = await uploadVideo({ accessToken, job, videoPath });
    const thumbnail = thumbnailPath
      ? await uploadThumbnail({ accessToken, thumbnailPath, videoId: video.videoId })
      : null;
    const now = new Date().toISOString();
    const uploadLog = {
      uploaded_at: now,
      worker_job_id: job.job_id,
      video_id: video.videoId,
      video_url: video.videoUrl,
      privacy_status: video.response?.status?.privacyStatus ?? job.metadata.privacy_status,
      thumbnail_uploaded: Boolean(thumbnail),
      thumbnail_response: thumbnail,
    };
    await writeRunJson(storageMode, runId, "youtube-upload-log.json", uploadLog);
    await markJob(storageMode, runId, job, pkg, "completed", {
      completed_at: now,
      video_id: video.videoId,
      video_url: video.videoUrl,
      thumbnail_uploaded: Boolean(thumbnail),
      package_patch: {
        uploaded_at: now,
        uploaded_video_id: video.videoId,
        uploaded_video_url: video.videoUrl,
      },
    });
    console.log(JSON.stringify({ status: "completed", videoId: video.videoId, videoUrl: video.videoUrl }, null, 2));
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
  if (args["dry-run"] === "true") {
    throw new Error("Queue mode does not support --dry-run. Use --run-id with --dry-run for preflight checks.");
  }
  const limit = maxJobs(args);
  let processed = 0;
  while (processed < limit) {
    const claimed = await claimNextWorkerJob(storageMode, "youtube-upload");
    if (!claimed) {
      const idle = { kind: "youtube-upload", status: "idle", storageMode };
      console.log(JSON.stringify(idle, null, 2));
      if (args.poll !== "true") {
        return;
      }
      await sleep(pollIntervalMs(args));
      continue;
    }

    try {
      await runUploadJob({ args: { ...args, force: "true" }, runId: claimed.run_id, storageMode });
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
  await runUploadJob({ args, runId, storageMode });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
