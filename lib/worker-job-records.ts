import { getAppStorageMode } from "@/lib/storage-mode";
import { isSupabaseMissingTableError, supabaseEq, supabaseRest } from "@/lib/supabase-rest";
import { readRunFileIfExists, writeRunJson } from "@/lib/run-store";

export type WorkerJobKind =
  | "render"
  | "youtube-upload"
  | "image-generation"
  | "video-generation"
  | "tts"
  | "subtitles"
  | "bgm";

export type WorkerQueueStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type WorkerJobRecord = {
  id: string;
  run_id: string;
  kind: WorkerJobKind;
  status: WorkerQueueStatus;
  job_artifact_key: string;
  log_artifact_key: string;
  approval_gate: string;
  provider_role: string;
  worker_type: string;
  attempts: number;
  payload: Record<string, unknown>;
  last_error: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type UpsertWorkerJobRecordInput = {
  approvalGate?: string;
  attempts?: number;
  completedAt?: string;
  id: string;
  jobArtifactKey: string;
  kind: WorkerJobKind;
  lastError?: string;
  logArtifactKey?: string;
  payload?: Record<string, unknown>;
  providerRole?: string;
  queuedAt?: string;
  runId: string;
  startedAt?: string;
  status: WorkerQueueStatus;
  updatedAt?: string;
  workerType?: string;
};

export type WorkerJobAction = "cancel" | "retry";

const localQueueFile = "worker-jobs.json";

function asRecord(value: unknown): WorkerJobRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<WorkerJobRecord>;
  if (!candidate.id || !candidate.run_id || !candidate.kind || !candidate.status) {
    return null;
  }
  return {
    approval_gate: candidate.approval_gate ?? "",
    attempts: Number(candidate.attempts ?? 0),
    completed_at: candidate.completed_at ?? null,
    id: candidate.id,
    job_artifact_key: candidate.job_artifact_key ?? "",
    kind: candidate.kind,
    last_error: candidate.last_error ?? "",
    log_artifact_key: candidate.log_artifact_key ?? "",
    payload: candidate.payload ?? {},
    provider_role: candidate.provider_role ?? "",
    queued_at: candidate.queued_at ?? "",
    run_id: candidate.run_id,
    started_at: candidate.started_at ?? null,
    status: candidate.status,
    updated_at: candidate.updated_at ?? "",
    worker_type: candidate.worker_type ?? "",
  };
}

async function readLocalRecords(runId: string) {
  const raw = await readRunFileIfExists(runId, localQueueFile);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(asRecord).filter((record): record is WorkerJobRecord => Boolean(record)) : [];
  } catch {
    return [];
  }
}

function inputToRecord(input: UpsertWorkerJobRecordInput): WorkerJobRecord {
  const now = input.updatedAt ?? new Date().toISOString();
  return {
    approval_gate: input.approvalGate ?? "",
    attempts: input.attempts ?? 0,
    completed_at: input.completedAt ?? null,
    id: input.id,
    job_artifact_key: input.jobArtifactKey,
    kind: input.kind,
    last_error: input.lastError ?? "",
    log_artifact_key: input.logArtifactKey ?? "",
    payload: input.payload ?? {},
    provider_role: input.providerRole ?? "",
    queued_at: input.queuedAt ?? now,
    run_id: input.runId,
    started_at: input.startedAt ?? null,
    status: input.status,
    updated_at: now,
    worker_type: input.workerType ?? "",
  };
}

export async function getWorkerJobRecords(runId: string): Promise<WorkerJobRecord[]> {
  if (getAppStorageMode() === "supabase") {
    return supabaseRest<WorkerJobRecord[]>("worker_jobs", {
      query: {
        order: "updated_at.desc",
        run_id: supabaseEq(runId),
        select: "*",
      },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
  }
  return readLocalRecords(runId);
}

export async function upsertWorkerJobRecord(input: UpsertWorkerJobRecordInput) {
  const record = inputToRecord(input);
  if (getAppStorageMode() === "supabase") {
    await supabaseRest<WorkerJobRecord[]>("worker_jobs", {
      method: "POST",
      body: record,
      prefer: "resolution=merge-duplicates,return=minimal",
      query: { on_conflict: "id" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return null;
      }
      throw error;
    });
    return record;
  }

  const records = await readLocalRecords(input.runId);
  const next = [record, ...records.filter((item) => item.id !== record.id)];
  await writeRunJson(input.runId, localQueueFile, next);
  return record;
}

function actionPatch(record: WorkerJobRecord, action: WorkerJobAction) {
  const now = new Date().toISOString();
  if (action === "cancel") {
    if (record.status !== "queued") {
      throw new Error("Only queued worker jobs can be cancelled.");
    }
    return {
      completed_at: now,
      last_error: "cancelled by operator",
      status: "cancelled" as const,
      updated_at: now,
    };
  }

  if (record.status !== "failed" && record.status !== "cancelled") {
    throw new Error("Only failed or cancelled worker jobs can be retried.");
  }
  return {
    completed_at: null,
    last_error: "",
    queued_at: now,
    started_at: null,
    status: "queued" as const,
    updated_at: now,
  };
}

export async function updateWorkerJobAction(
  runId: string,
  jobId: string,
  action: WorkerJobAction,
): Promise<WorkerJobRecord> {
  if (action !== "cancel" && action !== "retry") {
    throw new Error("Unsupported worker job action.");
  }

  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<WorkerJobRecord[]>("worker_jobs", {
      query: {
        id: supabaseEq(jobId),
        limit: 1,
        run_id: supabaseEq(runId),
        select: "*",
      },
    });
    const record = rows[0];
    if (!record) {
      throw new Error("Worker job was not found.");
    }
    const patch = actionPatch(record, action);
    const updated = await supabaseRest<WorkerJobRecord[]>("worker_jobs", {
      method: "PATCH",
      body: patch,
      prefer: "return=representation",
      query: {
        id: supabaseEq(jobId),
        run_id: supabaseEq(runId),
      },
    });
    return updated[0] ?? { ...record, ...patch };
  }

  const records = await readLocalRecords(runId);
  const record = records.find((item) => item.id === jobId);
  if (!record) {
    throw new Error("Worker job was not found.");
  }
  const patch = actionPatch(record, action);
  const nextRecord = { ...record, ...patch };
  await writeRunJson(
    runId,
    localQueueFile,
    records.map((item) => (item.id === jobId ? nextRecord : item)),
  );
  return nextRecord;
}
