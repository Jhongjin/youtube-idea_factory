"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";

export function GenerationQueueButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function prepareQueue() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/assets/queue`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "생성할 항목을 정리하지 못했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={prepareQueue} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Zap size={15} />}
        AI 제작 목록 빌드하기
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
