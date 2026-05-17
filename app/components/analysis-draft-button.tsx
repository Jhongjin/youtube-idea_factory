"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

export function AnalysisDraftButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/analysis/draft`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "분석 초안 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=draft&notice=analysis-drafted#artifact-video-analysis`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={draft} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <FileText size={15} />}
        분석 초안
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
