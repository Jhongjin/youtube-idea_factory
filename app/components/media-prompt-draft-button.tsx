"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

export function MediaPromptDraftButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/media/draft`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "미디어 프롬프트 초안 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={draft} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <ImagePlus size={15} />}
        미디어 초안
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
