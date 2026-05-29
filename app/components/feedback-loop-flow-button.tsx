"use client";

import { useState } from "react";
import { Loader2, Repeat2 } from "lucide-react";

const steps = [
  { label: "성과 스냅샷", path: "snapshot" },
  { label: "피드백 인사이트", path: "insights" },
  { label: "A/B 로그", path: "learning-log" },
  { label: "AI 채널 데이터베이스", path: "channel-memory" },
];

export function FeedbackLoopFlowButton({ runId, videoId }: { runId: string; videoId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState("");

  async function runFeedbackLoop() {
    const nextVideoId =
      videoId?.trim() ||
      window.prompt("업로드된 YouTube 영상 URL 또는 video ID를 입력하면 피드백 루프를 실행합니다.")?.trim() ||
      "";
    if (!nextVideoId) {
      return;
    }

    setLoading(true);
    setError("");

    for (const step of steps) {
      setCurrentStep(step.label);
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/analytics/${step.path}`, {
        method: "POST",
        headers: step.path === "snapshot" ? { "Content-Type": "application/json" } : undefined,
        body: step.path === "snapshot" ? JSON.stringify({ videoId: nextVideoId }) : undefined,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `${step.label} 단계에 실패했습니다.`);
        setLoading(false);
        setCurrentStep("");
        return;
      }
    }

    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <button className="text-button primary" disabled={loading} onClick={runFeedbackLoop} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Repeat2 size={15} />}
        {loading ? currentStep || "피드백 실행" : "피드백 루프"}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
