"use client";

import { useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";

export function StoryboardDraftButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/storyboard/draft`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Storyboard draft failed.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={draft} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Clapperboard size={15} />}
        Draft Storyboard
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}

