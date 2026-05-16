"use client";

import { useState } from "react";
import { Film, Loader2 } from "lucide-react";

const confirmToken = "RENDER_VIDEO";

export function LocalRenderButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function renderVideo() {
    setError("");
    const confirmation = window.prompt(`${confirmToken}를 입력하면 로컬 렌더를 시작합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== confirmToken) {
      setError(`렌더를 시작하려면 ${confirmToken}가 필요합니다.`);
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
      setError(body?.error ?? "로컬 렌더에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={renderVideo} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Film size={15} />}
        MP4 렌더
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
