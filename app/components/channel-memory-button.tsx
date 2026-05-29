"use client";

import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";

export function ChannelMemoryButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createMemoryUpdate() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/analytics/channel-memory`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "AI 채널 데이터베이스 업데이트에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createMemoryUpdate} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Brain size={15} />}
        AI 채널 데이터베이스
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
