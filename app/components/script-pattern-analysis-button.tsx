"use client";

import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

export function ScriptPatternAnalysisButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/analysis/script-patterns`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "대본 유형 분석에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=draft&notice=script-patterns#artifact-script-patterns`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={analyze} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <BarChart3 size={15} />}
        TOP10 대본 유형
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
