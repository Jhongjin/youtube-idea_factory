"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";

const draftSteps = [
  { label: "분석", path: "analysis/draft" },
  { label: "대본", path: "script/draft" },
  { label: "스토리보드", path: "storyboard/draft" },
  { label: "미디어", path: "media/draft" },
  { label: "자산", path: "assets/manifest" },
  { label: "배포", path: "publishing/draft" },
  { label: "검수", path: "qa/draft" },
] as const;

export function RunDraftFlowButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState("");

  async function runFlow() {
    setLoading(true);
    setError("");

    for (const step of draftSteps) {
      setCurrentStep(step.label);
      const response = await fetch(`/api/runs/${runId}/${step.path}`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `${step.label} 단계에 실패했습니다.`);
        setLoading(false);
        return;
      }
    }

    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review#artifact-qa`;
  }

  return (
    <div className="draft-action flow-action">
      <button className="text-button primary" disabled={loading} onClick={runFlow} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Rocket size={15} />}
        {loading ? `${currentStep} 실행 중` : "초안 전체 실행"}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
