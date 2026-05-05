"use client";

import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";

const confirmToken = "QUEUE_YOUTUBE_UPLOAD";

export function YouTubeUploadJobButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function queueUploadJob() {
    setError("");
    const confirmation = window.prompt(`${confirmToken}를 입력하면 YouTube 업로드 작업을 큐에 등록합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== confirmToken) {
      setError(`YouTube 업로드 작업 등록에는 ${confirmToken}가 필요합니다.`);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/runs/${runId}/publishing/upload-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmQueue: confirmToken, privacyStatus: "private" }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "YouTube 업로드 작업 등록에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action">
      <button className="text-button" disabled={loading} onClick={queueUploadJob} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <UploadCloud size={15} />}
        업로드 작업
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
