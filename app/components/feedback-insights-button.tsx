"use client";

import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";

export function FeedbackInsightsButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createInsights() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/analytics/insights`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "피드백 인사이트 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createInsights} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Lightbulb size={15} />}
        피드백 인사이트
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
