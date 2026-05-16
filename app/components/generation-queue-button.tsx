"use client";

import { useState } from "react";
import { ListChecks, Loader2 } from "lucide-react";

export function GenerationQueueButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function prepareQueue() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/assets/queue`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "생성 대기열 준비에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={prepareQueue} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <ListChecks size={15} />}
        대기열 준비
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
