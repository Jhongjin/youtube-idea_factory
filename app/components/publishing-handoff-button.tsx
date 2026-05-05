"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

export function PublishingHandoffButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buildHandoff() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/publishing/handoff`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "배포 핸드오프 검사에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={buildHandoff} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Send size={15} />}
        배포 검사
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
