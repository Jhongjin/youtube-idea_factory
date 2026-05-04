"use client";

import { useState } from "react";
import { Loader2, PanelsTopLeft } from "lucide-react";

export function RenderManifestButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buildRenderManifest() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/render/manifest`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Render manifest creation failed.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={buildRenderManifest} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <PanelsTopLeft size={15} />}
        Render Plan
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
