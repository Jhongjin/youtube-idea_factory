"use client";

import { useState } from "react";
import { Ban, Loader2, RotateCcw } from "lucide-react";

type WorkerJobAction = "cancel" | "retry";

export function WorkerJobActions({
  jobId,
  runId,
  status,
}: {
  jobId: string;
  runId: string;
  status: string;
}) {
  const [loading, setLoading] = useState<WorkerJobAction | "">("");
  const [error, setError] = useState("");
  const canCancel = status === "queued";
  const canRetry = status === "failed" || status === "cancelled";

  async function runAction(action: WorkerJobAction) {
    setError("");
    const label = action === "cancel" ? "취소" : "재시도";
    const confirmation = window.confirm(`이 worker job을 ${label}할까요?`);
    if (!confirmation) {
      return;
    }
    setLoading(action);
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/worker-jobs/${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `worker job ${label}에 실패했습니다.`);
        setLoading("");
        return;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : `worker job ${label}에 실패했습니다.`);
      setLoading("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  if (!canCancel && !canRetry) {
    return null;
  }

  return (
    <div className="worker-job-actions">
      {canCancel ? (
        <button
          className="text-button danger"
          disabled={Boolean(loading)}
          onClick={() => runAction("cancel")}
          type="button"
        >
          {loading === "cancel" ? <Loader2 className="spin" size={14} /> : <Ban size={14} />}
          취소
        </button>
      ) : null}
      {canRetry ? (
        <button
          className="text-button"
          disabled={Boolean(loading)}
          onClick={() => runAction("retry")}
          type="button"
        >
          {loading === "retry" ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
          재시도
        </button>
      ) : null}
      {error ? <span>{error}</span> : null}
    </div>
  );
}
