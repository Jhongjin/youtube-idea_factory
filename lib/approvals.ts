import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { supabaseEq, supabaseRest } from "@/lib/supabase-rest";

export type ApprovalGate = "generation" | "render" | "publish";

export type ApprovalRecord = {
  approved: boolean;
  approved_by: string;
  approved_at: string;
  notes: string;
};

export type RunApprovals = Record<ApprovalGate, ApprovalRecord>;

export type RunApprovalsUpdate = {
  approvals: Partial<Record<ApprovalGate, Partial<ApprovalRecord>>>;
};

type SupabaseApprovalRow = {
  approved: boolean;
  approved_at: string | null;
  approved_by: string;
  gate: ApprovalGate;
  notes: string;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

const approvalDefaults: RunApprovals = {
  generation: {
    approved: false,
    approved_by: "",
    approved_at: "",
    notes: "Required before paid image, video, TTS, subtitle, or BGM generation.",
  },
  render: {
    approved: false,
    approved_by: "",
    approved_at: "",
    notes: "Required before final video assembly or render spend.",
  },
  publish: {
    approved: false,
    approved_by: "",
    approved_at: "",
    notes: "Required before YouTube upload, scheduling, or public publishing.",
  },
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function cloneDefaults(): RunApprovals {
  return JSON.parse(JSON.stringify(approvalDefaults)) as RunApprovals;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function approvalsPath(runId: string) {
  assertSafeRunId(runId);
  return path.join(runsDir, runId, "approvals.json");
}

function normalizeText(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeApprovals(input: unknown): RunApprovals {
  const approvals = cloneDefaults();
  const data = typeof input === "object" && input !== null ? input : {};

  for (const gate of Object.keys(approvals) as ApprovalGate[]) {
    const saved = (data as Partial<RunApprovals>)[gate];
    if (!saved || typeof saved !== "object") {
      continue;
    }
    approvals[gate] = {
      approved: saved.approved === true,
      approved_by: normalizeText(saved.approved_by, 120),
      approved_at: normalizeText(saved.approved_at, 80),
      notes: normalizeText(saved.notes, 1000) || approvals[gate].notes,
    };
  }

  return approvals;
}

export async function getRunApprovals(runId: string): Promise<RunApprovals> {
  assertSafeRunId(runId);
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<SupabaseApprovalRow[]>("run_approvals", {
      query: {
        run_id: supabaseEq(runId),
        select: "gate,approved,approved_by,approved_at,notes",
      },
    });
    const approvals = cloneDefaults();
    for (const row of rows) {
      approvals[row.gate] = {
        approved: row.approved === true,
        approved_at: normalizeText(row.approved_at, 80),
        approved_by: normalizeText(row.approved_by, 120),
        notes: normalizeText(row.notes, 1000) || approvals[row.gate].notes,
      };
    }
    return approvals;
  }

  const filePath = approvalsPath(runId);
  if (!(await exists(filePath))) {
    return cloneDefaults();
  }
  return normalizeApprovals(JSON.parse(await fs.readFile(filePath, "utf-8")));
}

export async function updateRunApprovals(
  runId: string,
  update: RunApprovalsUpdate,
): Promise<RunApprovals> {
  const approvals = await getRunApprovals(runId);
  const now = new Date().toISOString();

  for (const gate of Object.keys(approvals) as ApprovalGate[]) {
    const incoming = update.approvals?.[gate];
    if (!incoming) {
      continue;
    }
    const wasApproved = approvals[gate].approved;
    const approved = incoming.approved === true;
    const approvedBy =
      incoming.approved_by === undefined
        ? approvals[gate].approved_by
        : normalizeText(incoming.approved_by, 120);
    approvals[gate] = {
      approved,
      approved_by: approved ? approvedBy : "",
      approved_at: approved ? (wasApproved ? approvals[gate].approved_at || now : now) : "",
      notes: incoming.notes === undefined ? approvals[gate].notes : normalizeText(incoming.notes, 1000),
    };
  }

  const filePath = approvalsPath(runId);
  if (getAppStorageMode() === "supabase") {
    await supabaseRest<SupabaseApprovalRow[]>("run_approvals", {
      method: "POST",
      body: (Object.keys(approvals) as ApprovalGate[]).map((gate) => ({
        approved: approvals[gate].approved,
        approved_at: approvals[gate].approved_at || null,
        approved_by: approvals[gate].approved_by,
        gate,
        notes: approvals[gate].notes,
        run_id: runId,
        updated_at: now,
      })),
      query: { on_conflict: "run_id,gate" },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return approvals;
  }

  await fs.writeFile(filePath, `${JSON.stringify(approvals, null, 2)}\n`, "utf-8");
  return approvals;
}
