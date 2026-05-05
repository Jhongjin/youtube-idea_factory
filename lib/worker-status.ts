import type { ProductionPackage } from "@/lib/runs";
import { readRunFileIfExists } from "@/lib/run-store";

export type WorkerStageStatus = "pending" | "queued" | "running" | "completed" | "failed" | "unknown";

export type WorkerStageStatusView = {
  completedAt: string;
  createdAt: string;
  details: Array<{ label: string; value: string; href?: string }>;
  error: string;
  jobId: string;
  jobPath: string;
  label: string;
  logPath: string;
  status: WorkerStageStatus;
  updatedAt: string;
};

export type RunWorkerStatus = {
  render: WorkerStageStatusView;
  upload: WorkerStageStatusView;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asStatus(value: unknown): WorkerStageStatus {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return value ? "unknown" : "pending";
}

async function readOptionalJson(runId: string, filePath: string): Promise<JsonObject | null> {
  const raw = await readRunFileIfExists(runId, filePath);
  if (!raw) {
    return null;
  }
  try {
    return asObject(JSON.parse(raw));
  } catch {
    return {
      error: `${filePath} could not be parsed as JSON.`,
      status: "unknown",
    };
  }
}

function compactDetails(details: Array<{ label: string; value?: string; href?: string }>) {
  return details
    .map((detail) => ({ ...detail, value: detail.value?.trim() ?? "" }))
    .filter((detail): detail is { label: string; value: string; href?: string } => Boolean(detail.value));
}

function renderStatus(pkg: ProductionPackage, job: JsonObject | null, log: JsonObject | null): WorkerStageStatusView {
  const status = asStatus(job?.status ?? pkg.render_manifest?.worker_job_status);
  const outputPath = asString(log?.output_path) || asString(job?.output_path) || pkg.render_manifest?.rendered_path || "";
  return {
    completedAt: asString(job?.completed_at) || asString(log?.rendered_at) || pkg.render_manifest?.rendered_at || "",
    createdAt: asString(job?.created_at),
    details: compactDetails([
      { label: "출력", value: outputPath },
      { label: "세그먼트", value: log?.segments === undefined ? "" : String(log.segments) },
      { label: "자막", value: asBoolean(log?.subtitles_embedded) ? "임베드 완료" : "" },
      { label: "BGM", value: asBoolean(log?.bgm_mixed) ? "믹스 완료" : "" },
    ]),
    error: asString(job?.error) || asString(log?.error),
    jobId: asString(job?.job_id) || pkg.render_manifest?.worker_job_id || "",
    jobPath: "render-worker-job.json",
    label: "렌더 워커",
    logPath: log ? "render-log.json" : "",
    status,
    updatedAt: asString(job?.updated_at) || asString(log?.rendered_at) || pkg.render_manifest?.updated_at || "",
  };
}

function uploadStatus(pkg: ProductionPackage, job: JsonObject | null, log: JsonObject | null): WorkerStageStatusView {
  const metadata = asObject(job?.metadata);
  const status = asStatus(job?.status ?? pkg.publishing_handoff?.upload_job_status);
  const videoUrl = asString(log?.video_url) || asString(job?.video_url) || pkg.publishing_handoff?.uploaded_video_url || "";
  const videoId = asString(log?.video_id) || asString(job?.video_id) || pkg.publishing_handoff?.uploaded_video_id || "";
  return {
    completedAt: asString(job?.completed_at) || asString(log?.uploaded_at) || pkg.publishing_handoff?.uploaded_at || "",
    createdAt: asString(job?.created_at),
    details: compactDetails([
      { label: "영상 URL", value: videoUrl, href: videoUrl },
      { label: "영상 ID", value: videoId },
      { label: "공개 범위", value: asString(log?.privacy_status) || asString(metadata?.privacy_status) },
      { label: "예약", value: asString(metadata?.scheduled_at) },
      { label: "썸네일", value: asBoolean(log?.thumbnail_uploaded) || asBoolean(job?.thumbnail_uploaded) ? "업로드 완료" : "" },
    ]),
    error: asString(job?.error) || asString(log?.error),
    jobId: asString(job?.job_id) || pkg.publishing_handoff?.upload_job_id || "",
    jobPath: "youtube-upload-job.json",
    label: "YouTube 업로드",
    logPath: log ? "youtube-upload-log.json" : "",
    status,
    updatedAt: asString(job?.updated_at) || asString(log?.uploaded_at) || pkg.publishing_handoff?.updated_at || "",
  };
}

export async function getRunWorkerStatus(runId: string, pkg: ProductionPackage): Promise<RunWorkerStatus> {
  const [renderJob, renderLog, uploadJob, uploadLog] = await Promise.all([
    readOptionalJson(runId, "render-worker-job.json"),
    readOptionalJson(runId, "render-log.json"),
    readOptionalJson(runId, "youtube-upload-job.json"),
    readOptionalJson(runId, "youtube-upload-log.json"),
  ]);

  return {
    render: renderStatus(pkg, renderJob, renderLog),
    upload: uploadStatus(pkg, uploadJob, uploadLog),
  };
}
