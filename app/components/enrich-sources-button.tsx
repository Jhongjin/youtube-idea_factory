"use client";

import { useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";

export function EnrichSourcesButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enrich() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/sources/enrich`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "소스 보강에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="source-action">
      <button className="text-button" disabled={loading} onClick={enrich} type="button">
        {loading ? <RefreshCw className="spin" size={15} /> : <Wand2 size={15} />}
        소스 보강
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
