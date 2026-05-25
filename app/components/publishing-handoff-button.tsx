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
      setError(body?.error ?? "업로드 전 확인 목록을 만들지 못했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review#artifact-publishing`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={buildHandoff} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Send size={15} />}
        업로드 전 확인
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
