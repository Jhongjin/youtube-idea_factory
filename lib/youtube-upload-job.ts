import { randomUUID } from "node:crypto";
import { getYouTubeChannel } from "@/lib/channels";
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
  channel?: {
    brand_name: string;
    channel_name: string;
    id: string;
    upload_token_source: "youtube_channels";
    youtube_channel_id?: string | null;
    youtube_handle?: string | null;
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
  const packageChannel = pkg.brief.channel;
  const uploadChannel = packageChannel?.id ? await getYouTubeChannel(packageChannel.id) : null;
  if (packageChannel?.id && !uploadChannel) {
    throw new Error("선택된 브랜드 채널을 찾을 수 없습니다. /admin/channels에서 채널 상태를 확인하세요.");
  }
  if (uploadChannel && uploadChannel.status !== "active") {
    throw new Error("선택된 브랜드 채널이 운영 중 상태가 아닙니다. /admin/channels에서 상태를 운영 중으로 변경하세요.");
  }
  if (uploadChannel && !uploadChannel.has_upload_refresh_token) {
    throw new Error("선택된 브랜드 채널에 업로드 OAuth refresh token이 없습니다.");
  }
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
        uploadChannel
          ? "Selected youtube_channels row must keep an upload refresh token with upload scope"
          : "YouTube OAuth credentials with upload scope",
        "Readable final video and thumbnail paths",
        "Human approval gate already recorded in publish-handoff.json",
        "Worker must update youtube-upload-job.json and production-package.json after upload",
      ],
    },
    ...(uploadChannel
      ? {
          channel: {
            brand_name: uploadChannel.brand_name,
            channel_name: uploadChannel.channel_name,
            id: uploadChannel.id,
            upload_token_source: "youtube_channels" as const,
            youtube_channel_id: uploadChannel.channel_id,
            youtube_handle: uploadChannel.youtube_handle,
          },
        }
      : {}),
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
    ...pkg.publishing_handoff,
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
        channel_id: job.channel?.id ?? "",
        channel_name: job.channel?.channel_name ?? "",
        channel_record_id: job.channel?.id ?? "",
        youtube_channel_id: job.channel?.youtube_channel_id ?? "",
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
