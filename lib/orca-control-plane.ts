import "server-only";

import { hasSupabaseServerConfig, supabaseRest } from "@/lib/supabase-rest";

const DEFAULT_GATE_URL = "http://127.0.0.1:4317";

export type OrcaFailure = {
  class: string;
  code: string;
  retryable: boolean;
  scope: string;
  detail: string;
};

export type OrcaRunSummary = {
  channel: string;
  run_name: string;
  run_dir: string;
  run_id: string;
  topic_key: string;
  state: "running" | "hold" | "completed" | "rejected";
  current_stage: string | null;
  next_stage: string | null;
  failure: OrcaFailure | null;
  updated_at_kst: string;
  progress: { completed: number; total: number };
};

export type OrcaStageState = {
  name: string;
  status: string;
  missing_required: string[];
  stale_reason: string | null;
};

export type OrcaRunState = OrcaRunSummary & {
  schema: "youtube-run-state-v1";
  fact_mode: string;
  policy_version: string;
  resume_from: string | null;
  stages: OrcaStageState[];
};

export type OrcaChannelPolicy = {
  fact_mode: "strict" | "conditional" | "world_bound";
  recommendation_mode: string;
  format_mode: string;
  risk_tier: string;
};

export type OrcaQueueRecord = {
  job_id: string;
  idempotency_key: string;
  run_dir: string;
  channel: string;
  stage: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  attempts: number;
  worker_id: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  last_error: string | null;
};

export type OrcaMediaQueueRecord = {
  job_id: string;
  idempotency_key: string;
  run_dir: string;
  channel: string;
  scene_id: string;
  media_kind: "image" | "video";
  provider: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  attempts: number;
  worker_id: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  last_error: string | null;
};

export type OrcaRenderQueueRecord = {
  job_id: string; idempotency_key: string; run_dir: string; channel: string;
  purpose: "preview" | "final"; status: OrcaQueueRecord["status"]; priority: number;
  attempts: number; worker_id: string | null; queued_at: string; started_at: string | null;
  completed_at: string | null; updated_at: string; last_error: string | null;
};

export type OrcaAudioQueueRecord = {
  job_id: string; idempotency_key: string; run_dir: string; channel: string;
  role: "voice" | "bgm"; provider: string; execution: "local_generation" | "external_api";
  status: OrcaQueueRecord["status"]; priority: number; attempts: number; worker_id: string | null;
  queued_at: string; started_at: string | null; completed_at: string | null; updated_at: string;
  last_error: string | null;
};

export type OrcaPublishQueueRecord = {
  job_id: string; idempotency_key: string; run_dir: string; channel: string; channel_ref: string;
  phase: "private_upload" | "publication"; status: OrcaQueueRecord["status"]; priority: number;
  attempts: number; worker_id: string | null; queued_at: string; started_at: string | null;
  completed_at: string | null; updated_at: string; last_error: string | null;
};

export class OrcaGateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrcaGateUnavailableError";
  }
}

export class OrcaRemoteReadOnlyError extends Error {
  constructor() {
    super("원격 Orca 화면은 현재 읽기 전용입니다. 작업 계약 생성과 큐 등록은 로컬 Gate Service에서 실행해 주세요.");
    this.name = "OrcaRemoteReadOnlyError";
  }
}

export class OrcaGateRequestError extends Error {
  constructor(public readonly status: number) {
    super(status === 409 ? "현재 작업이 이미 실행 중이거나 완료되었습니다." : "현재 실행 상태에서는 이 작업 계약을 만들 수 없습니다.");
    this.name = "OrcaGateRequestError";
  }
}

export function getOrcaGateUrl() {
  return (process.env.YOUTUBE_ORCA_GATE_URL || DEFAULT_GATE_URL).replace(/\/$/, "");
}

export function getOrcaBackendMode(): "gate" | "supabase" {
  const configured = process.env.ORCA_CONTROL_PLANE_MODE?.trim().toLowerCase();
  if (configured === "gate" || configured === "supabase") return configured;
  return process.env.VERCEL && hasSupabaseServerConfig() ? "supabase" : "gate";
}

type OrcaPolicyRow = OrcaChannelPolicy & {
  channel: string;
  policy_version: string;
  policy: OrcaChannelPolicy;
};

type OrcaRunRow = {
  run_id: string;
  channel: string;
  run_name: string;
  run_dir: string;
  topic_key: string;
  state: OrcaRunSummary["state"];
  current_stage: string | null;
  next_stage: string | null;
  resume_from: string | null;
  fact_mode: string;
  policy_version: string;
  failure: OrcaFailure | null;
  progress: { completed: number; total: number };
  stages: OrcaStageState[];
  updated_at_kst: string;
};

type OrcaQueueMirrorRow = {
  queue_kind: "llm" | "media" | "render" | "audio" | "publish";
  record: OrcaQueueRecord | OrcaMediaQueueRecord | OrcaRenderQueueRecord | OrcaAudioQueueRecord | OrcaPublishQueueRecord;
};

function runSummaryFromRow(row: OrcaRunRow): OrcaRunSummary {
  return {
    channel: row.channel,
    run_name: row.run_name,
    run_dir: row.run_dir,
    run_id: row.run_id,
    topic_key: row.topic_key,
    state: row.state,
    current_stage: row.current_stage,
    next_stage: row.next_stage,
    failure: row.failure,
    updated_at_kst: row.updated_at_kst,
    progress: row.progress,
  };
}

async function getSupabaseQueueMirror() {
  const rows = await supabaseRest<OrcaQueueMirrorRow[]>("orca_queue_jobs", {
    query: {
      limit: 250,
      order: "source_updated_at.desc.nullslast,synced_at.desc",
      select: "queue_kind,record",
    },
  });
  const byKind = <T,>(kind: OrcaQueueMirrorRow["queue_kind"]) =>
    rows.filter((row) => row.queue_kind === kind).map((row) => row.record as T);
  return {
    queue: byKind<OrcaQueueRecord>("llm"),
    mediaQueue: byKind<OrcaMediaQueueRecord>("media"),
    renderQueue: byKind<OrcaRenderQueueRecord>("render"),
    audioQueue: byKind<OrcaAudioQueueRecord>("audio"),
    publishQueue: byKind<OrcaPublishQueueRecord>("publish"),
  };
}

async function getSupabaseOverview(channel = "") {
  const [policyRows, runRows, queues] = await Promise.all([
    supabaseRest<OrcaPolicyRow[]>("orca_channel_policies", {
      query: { order: "channel.asc", select: "channel,policy_version,policy" },
    }),
    supabaseRest<OrcaRunRow[]>("orca_runs", {
      query: {
        ...(channel ? { channel: `eq.${channel}` } : {}),
        limit: 40,
        order: "synced_at.desc",
        select: "run_id,channel,run_name,run_dir,topic_key,state,current_stage,next_stage,resume_from,fact_mode,policy_version,failure,progress,stages,updated_at_kst",
      },
    }),
    getSupabaseQueueMirror(),
  ]);
  const channels = Object.fromEntries(policyRows.map((row) => [row.channel, row.policy]));
  return {
    runs: runRows.map(runSummaryFromRow),
    policies: { version: policyRows[0]?.policy_version ?? "", channels },
    ...queues,
  };
}

async function gateFetch<T>(pathname: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${getOrcaGateUrl()}${pathname}`, {
      ...init,
      cache: "no-store",
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal,
    });
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) throw new OrcaGateRequestError(response.status);
      throw new OrcaGateUnavailableError("Gate Service가 일시적으로 응답하지 않습니다.");
    }
    return body;
  } catch (error) {
    if (error instanceof OrcaGateRequestError || error instanceof OrcaGateUnavailableError) throw error;
    throw new OrcaGateUnavailableError("Gate Service에 연결할 수 없습니다.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOrcaOverview(channel = "") {
  if (getOrcaBackendMode() === "supabase") return getSupabaseOverview(channel);
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=40` : "?limit=40";
  const [runPayload, policies, queuePayload, mediaQueuePayload, renderQueuePayload, audioQueuePayload, publishQueuePayload] = await Promise.all([
    gateFetch<{ ok: true; runs: OrcaRunSummary[] }>(`/v1/runs${suffix}`),
    gateFetch<{ version: string; channels: Record<string, OrcaChannelPolicy> }>("/v1/policies"),
    getOrcaQueue(channel),
    getOrcaMediaQueue(channel),
    getOrcaRenderQueue(channel),
    getOrcaAudioQueue(channel),
    getOrcaPublishQueue(channel),
  ]);
  return { runs: runPayload.runs, policies, queue: queuePayload.jobs, mediaQueue: mediaQueuePayload.jobs, renderQueue: renderQueuePayload.jobs, audioQueue: audioQueuePayload.jobs, publishQueue: publishQueuePayload.jobs };
}

export async function getOrcaGateHealth() {
  if (getOrcaBackendMode() === "supabase") {
    await supabaseRest("orca_channel_policies", { query: { limit: 1, select: "channel" } });
    return { ok: true as const, service: "supabase-orca-control-plane", version: 1 };
  }
  return gateFetch<{ ok: true; service: string; version: number }>("/health");
}

export async function getOrcaRunState(runDir: string) {
  if (getOrcaBackendMode() === "supabase") {
    const rows = await supabaseRest<OrcaRunRow[]>("orca_runs", {
      query: {
        limit: 1,
        run_dir: `eq.${runDir}`,
        select: "run_id,channel,run_name,run_dir,topic_key,state,current_stage,next_stage,resume_from,fact_mode,policy_version,failure,progress,stages,updated_at_kst",
      },
    });
    const row = rows[0];
    if (!row) throw new OrcaGateRequestError(404);
    return {
      ...runSummaryFromRow(row),
      schema: "youtube-run-state-v1" as const,
      fact_mode: row.fact_mode,
      policy_version: row.policy_version,
      resume_from: row.resume_from,
      stages: row.stages,
    };
  }
  return gateFetch<OrcaRunState>("/v1/runs/state", {
    method: "POST",
    body: JSON.stringify({ run_dir: runDir }),
  });
}

export async function buildOrcaWorkerJob(input: { runDir: string; stage: string; attempt?: number }) {
  if (getOrcaBackendMode() === "supabase") throw new OrcaRemoteReadOnlyError();
  return gateFetch<{ ok: boolean; errors: string[]; job: Record<string, unknown> }>("/v1/jobs/build", {
    method: "POST",
    body: JSON.stringify({ run_dir: input.runDir, stage: input.stage, attempt: input.attempt || 1 }),
  });
}

export async function enqueueOrcaWorkerJob(job: Record<string, unknown>) {
  if (getOrcaBackendMode() === "supabase") throw new OrcaRemoteReadOnlyError();
  return gateFetch<{ok: true; created: boolean; record: OrcaQueueRecord}>("/v1/queue/enqueue", {
    method: "POST",
    body: JSON.stringify({job, confirmation: "QUEUE_VERIFIED_JOB"}),
  });
}

export async function getOrcaQueue(channel = "") {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=50` : "?limit=50";
  return gateFetch<{ok: true; jobs: OrcaQueueRecord[]}>(`/v1/queue${suffix}`);
}

export async function getOrcaMediaQueue(channel = "") {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=50` : "?limit=50";
  return gateFetch<{ok: true; jobs: OrcaMediaQueueRecord[]}>(`/v1/media/queue${suffix}`);
}

export async function getOrcaRenderQueue(channel = "") {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=50` : "?limit=50";
  return gateFetch<{ok: true; jobs: OrcaRenderQueueRecord[]}>(`/v1/render/queue${suffix}`);
}

export async function getOrcaAudioQueue(channel = "") {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=50` : "?limit=50";
  return gateFetch<{ok: true; jobs: OrcaAudioQueueRecord[]}>(`/v1/audio/queue${suffix}`);
}

export async function getOrcaPublishQueue(channel = "") {
  const suffix = channel ? `?channel=${encodeURIComponent(channel)}&limit=50` : "?limit=50";
  return gateFetch<{ok: true; jobs: OrcaPublishQueueRecord[]}>(`/v1/publish/queue${suffix}`);
}
