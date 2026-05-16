"use client";

import { useState } from "react";
import { FilePlus2, Loader2 } from "lucide-react";

export function EditingHandoffButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createHandoff() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/render/editing-handoff`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "편집 핸드오프 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createHandoff} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <FilePlus2 size={15} />}
        편집 핸드오프
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
