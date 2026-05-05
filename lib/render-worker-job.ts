import { randomUUID } from "node:crypto";
import { getRunApprovals } from "@/lib/approvals";
import { createRenderManifest, type RenderManifest } from "@/lib/render-manifest";
import type { ProductionPackage } from "@/lib/runs";
import { readRunJson, writeRunJson } from "@/lib/run-store";

export type CreateRenderWorkerJobRequest = {
  confirmQueue?: string;
};

export type RenderWorkerJob = {
  version: 1;
  job_id: string;
  run_id: string;
  status: "queued";
  created_at: string;
  approval_gate: "render";
  render_manifest_path: "render-manifest.json";
  output_path: string;
  worker: {
    type: "ffmpeg";
    mode: "external-worker";
    requires: string[];
  };
  inputs: {
    timeline: Array<{
      scene_id: string;
      kind: string;
      path: string;
      duration_seconds: number;
    }>;
    voice_path: string;
    subtitles_path: string;
    bgm_path: string;
  };
  checks: {
    render_ready: boolean;
    blockers: number;
    approved_by: string;
    approved_at: string;
  };
};

export type CreateRenderWorkerJobResult = {
  file: "render-worker-job.json";
  jobId: string;
  status: "queued";
  outputPath: string;
  timelineItems: number;
};

const confirmToken = "QUEUE_RENDER_JOB";

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

export async function createRenderWorkerJob(
  runId: string,
  request: CreateRenderWorkerJobRequest,
): Promise<CreateRenderWorkerJobResult> {
  assertSafeRunId(runId);
  if (request.confirmQueue !== confirmToken) {
    throw new Error(`Render worker queue requires confirmQueue="${confirmToken}".`);
  }

  await createRenderManifest(runId);
  const [pkg, manifest, approvals] = await Promise.all([
    readRunJson<ProductionPackage>(runId, "production-package.json"),
    readRunJson<RenderManifest>(runId, "render-manifest.json"),
    getRunApprovals(runId),
  ]);

  if (!manifest.summary.render_ready) {
    throw new Error("Render manifest is not ready.");
  }
  if (!approvals.render.approved || !approvals.render.approved_by || !approvals.render.approved_at) {
    throw new Error("Render approval gate is not complete.");
  }

  const now = new Date().toISOString();
  const job: RenderWorkerJob = {
    version: 1,
    job_id: randomUUID(),
    run_id: runId,
    status: "queued",
    created_at: now,
    approval_gate: "render",
    render_manifest_path: "render-manifest.json",
    output_path: manifest.output.final_path,
    worker: {
      type: "ffmpeg",
      mode: "external-worker",
      requires: [
        "Read render-manifest.json",
        "Resolve local or Supabase Storage asset paths",
        "Write final MP4 to output_path",
        "Update render-log.json and production-package.json after completion",
      ],
    },
    inputs: {
      timeline: manifest.timeline.map((item) => ({
        scene_id: item.scene_id,
        kind: item.primary_asset_kind,
        path: item.primary_asset_path,
        duration_seconds: item.duration_seconds,
      })),
      voice_path: manifest.audio.voice_path,
      subtitles_path: manifest.subtitles.path,
      bgm_path: manifest.audio.bgm_status === "generated" ? manifest.audio.bgm_path : "",
    },
    checks: {
      render_ready: manifest.summary.render_ready,
      blockers: manifest.summary.blockers,
      approved_by: approvals.render.approved_by,
      approved_at: approvals.render.approved_at,
    },
  };

  pkg.render_manifest = {
    path: "render-manifest.json",
    timeline_items: manifest.summary.timeline_items,
    ready_timeline_items: manifest.summary.ready_timeline_items,
    blockers: manifest.summary.blockers,
    render_ready: manifest.summary.render_ready,
    worker_job_path: "render-worker-job.json",
    worker_job_status: "queued",
    worker_job_id: job.job_id,
    updated_at: now,
  };

  await Promise.all([
    writeRunJson(runId, "render-worker-job.json", job),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    file: "render-worker-job.json",
    jobId: job.job_id,
    status: "queued",
    outputPath: job.output_path,
    timelineItems: job.inputs.timeline.length,
  };
}
