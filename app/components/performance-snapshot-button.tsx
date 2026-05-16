"use client";

import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

export function PerformanceSnapshotButton({ runId, videoId }: { runId: string; videoId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createSnapshot() {
    const nextVideoId =
      videoId?.trim() ||
      window.prompt("업로드된 YouTube 영상 URL 또는 video ID를 입력하세요.")?.trim() ||
      "";
    if (!nextVideoId) {
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/analytics/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: nextVideoId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "성과 스냅샷 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createSnapshot} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <BarChart3 size={15} />}
        성과 스냅샷
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
