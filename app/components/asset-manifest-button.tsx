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
      setError(body?.error ?? "필요 자산 목록을 만들지 못했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={createManifest} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Boxes size={15} />}
        필요 자산 정리
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
