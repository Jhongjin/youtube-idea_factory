"use client";

import { useState } from "react";
import { Boxes, Loader2 } from "lucide-react";

export function AssetManifestButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createManifest() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/assets/manifest`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "자산 매니페스트 생성에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createManifest} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Boxes size={15} />}
        자산 구성
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
