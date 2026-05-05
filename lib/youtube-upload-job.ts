import { randomUUID } from "node:crypto";
import { createPublishingHandoff, type PublishingHandoff } from "@/lib/publishing-handoff";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";
import { upsertWorkerJobRecord } from "@/lib/worker-job-records";

export type CreateYouTubeUploadJobRequest = {
  confirmQueue?: string;
  privacyStatus?: "private" | "unlisted" | "public";
  scheduledAt?: string;
  madeForKids?: boolean;
};

export type YouTubeUploadJob = {
  version: 1;
  job_id: string;
  run_id: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  approval_gate: "publish";
  worker: {
    type: "youtube-upload";
    mode: "external-worker";
    requires: string[];
  };
  video: {
    path: string;
  };
  thumbnail: {
    path: string;
  };
  metadata: {
    title: string;
    description: string;
    tags: string[];
    language: string;
    category: string;
    privacy_status: "private" | "unlisted" | "public";
    scheduled_at: string;
    made_for_kids: boolean;
  };
};

export type CreateYouTubeUploadJobResult = {
  file: "youtube-upload-job.json";
  jobId: string;
  madeForKids: boolean;
  scheduledAt: string;
  status: "queued";
  privacyStatus: string;
};

const confirmToken = "QUEUE_YOUTUBE_UPLOAD";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function privacyStatus(value?: string): "private" | "unlisted" | "public" {
  return value === "unlisted" || value === "public" ? value : "private";
}

function normalizeScheduledAt(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const scheduled = new Date(trimmed);
  if (Number.isNaN(scheduled.getTime())) {
    throw new Error("Scheduled publish time is invalid.");
  }
  if (scheduled.getTime() <= Date.now()) {
    throw new Error("Scheduled publish time must be in the future.");
  }
  return scheduled.toISOString();
}

export async function createYouTubeUploadJob(
  runId: string,
  request: CreateYouTubeUploadJobRequest,
): Promise<CreateYouTubeUploadJobResult> {
  assertSafeRunId(runId);
  if (request.confirmQueue !== confirmToken) {
    throw new Error(`YouTube upload queue requires confirmQueue="${confirmToken}".`);
  }

  const handoffResult = await createPublishingHandoff(runId);
  if (!handoffResult.ready) {
    throw new Error(`Publishing handoff is not ready. Blockers: ${handoffResult.blockers}`);
  }

  const [pkg, handoff] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<PublishingHandoff>(runId, "publish-handoff.json"),
  ]);
  const now = new Date().toISOString();
  const scheduledAt = normalizeScheduledAt(request.scheduledAt);
  const effectivePrivacyStatus = scheduledAt ? "private" : privacyStatus(request.privacyStatus);
  const job: YouTubeUploadJob = {
    version: 1,
    job_id: randomUUID(),
    run_id: runId,
    status: "queued",
    created_at: now,
    approval_gate: "publish",
    worker: {
      type: "youtube-upload",
      mode: "external-worker",
      requires: [
        "YouTube OAuth credentials with upload scope",
        "Readable final video and thumbnail paths",
        "Human approval gate already recorded in publish-handoff.json",
        "Worker must update youtube-upload-job.json and production-package.json after upload",
      ],
    },
    video: {
      path: handoff.video.path,
    },
    thumbnail: {
      path: handoff.thumbnail.path,
    },
    metadata: {
      title: handoff.metadata.title,
      description: handoff.metadata.description,
      tags: handoff.metadata.tags,
      language: handoff.metadata.language,
      category: handoff.metadata.category,
      privacy_status: effectivePrivacyStatus,
      scheduled_at: scheduledAt,
      made_for_kids: request.madeForKids ?? false,
    },
  };

  pkg.publishing_handoff = {
    path: "publish-handoff.json",
    ready: true,
    blockers: 0,
    upload_job_path: "youtube-upload-job.json",
    upload_job_status: "queued",
    upload_job_id: job.job_id,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, "youtube-upload-job.json", job),
    writeRunJson(runId, "production-package.json", pkg),
    upsertWorkerJobRecord({
      approvalGate: "publish",
      id: job.job_id,
      jobArtifactKey: "youtube-upload-job.json",
      kind: "youtube-upload",
      logArtifactKey: "youtube-upload-log.json",
      payload: {
        made_for_kids: job.metadata.made_for_kids,
        privacy_status: job.metadata.privacy_status,
        scheduled_at: job.metadata.scheduled_at,
        title: job.metadata.title,
      },
      providerRole: "youtube",
      queuedAt: now,
      runId,
      status: "queued",
      updatedAt: now,
      workerType: "youtube-upload",
    }),
  ]);

  return {
    file: "youtube-upload-job.json",
    jobId: job.job_id,
    madeForKids: job.metadata.made_for_kids,
    scheduledAt: job.metadata.scheduled_at,
    status: "queued",
    privacyStatus: job.metadata.privacy_status,
  };
}
