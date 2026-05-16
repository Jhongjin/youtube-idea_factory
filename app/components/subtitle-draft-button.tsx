"use client";

import { useState } from "react";
import { Captions, Loader2 } from "lucide-react";

export function SubtitleDraftButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function draftSubtitles() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/subtitles/draft`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "자막 초안 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={draftSubtitles} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Captions size={15} />}
        자막 초안
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
