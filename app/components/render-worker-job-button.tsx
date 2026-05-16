"use client";

import { useState } from "react";
import { Loader2, ServerCog } from "lucide-react";

const confirmToken = "QUEUE_RENDER_JOB";

export function RenderWorkerJobButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function queueRenderJob() {
    setError("");
    const confirmation = window.prompt(`${confirmToken}를 입력하면 렌더 작업을 큐에 등록합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== confirmToken) {
      setError(`렌더 작업 등록에는 ${confirmToken}가 필요합니다.`);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/runs/${runId}/render/job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmQueue: confirmToken }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "렌더 작업 등록에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={queueRenderJob} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <ServerCog size={15} />}
        렌더 작업
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
