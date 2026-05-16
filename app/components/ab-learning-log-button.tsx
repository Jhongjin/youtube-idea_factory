"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";

export function AbLearningLogButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createLog() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/analytics/learning-log`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "A/B 학습 로그 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createLog} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <FlaskConical size={15} />}
        A/B 로그
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
