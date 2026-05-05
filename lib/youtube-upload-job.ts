import { randomUUID } from "node:crypto";
import { createPublishingHandoff, type PublishingHandoff } from "@/lib/publishing-handoff";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

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
      privacy_status: privacyStatus(request.privacyStatus),
      scheduled_at: request.scheduledAt?.trim() ?? "",
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
  ]);

  return {
    file: "youtube-upload-job.json",
    jobId: job.job_id,
    status: "queued",
    privacyStatus: job.metadata.privacy_status,
  };
}
