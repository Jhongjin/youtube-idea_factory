"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function RunDeleteButton({
  runId,
  topic,
}: {
  runId: string;
  topic: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function deleteRun() {
    setError("");
    const confirmed = window.confirm(
      `"${topic}" 실행을 삭제할까요?\n\n이 작업은 실행 기록과 DB 산출물을 제거합니다.`,
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "실행 삭제에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <div className="run-delete-action">
      <button className="text-button danger" disabled={loading} onClick={deleteRun} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
        실행 삭제
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
