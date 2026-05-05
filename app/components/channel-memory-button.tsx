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
      setError(body?.error ?? "채널 메모리 업데이트에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createMemoryUpdate} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Brain size={15} />}
        채널 메모리
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
