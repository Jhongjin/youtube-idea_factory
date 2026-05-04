"use client";

import { useState } from "react";
import { Film, Loader2 } from "lucide-react";

const confirmToken = "RENDER_VIDEO";

export function LocalRenderButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function renderVideo() {
    setError("");
    const confirmation = window.prompt(`Type ${confirmToken} to start local render.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== confirmToken) {
      setError(`Render requires ${confirmToken}.`);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/runs/${runId}/render/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmRender: confirmToken }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Local render failed.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={renderVideo} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Film size={15} />}
        Render MP4
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
