"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export function AnalysisRefineButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refine() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/analysis/refine`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "LLM 분석 고도화에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={refine} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
        분석 고도화
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
