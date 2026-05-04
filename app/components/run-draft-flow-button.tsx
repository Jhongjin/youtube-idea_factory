"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";

const draftSteps = [
  { label: "analysis", path: "analysis/draft" },
  { label: "script", path: "script/draft" },
  { label: "storyboard", path: "storyboard/draft" },
  { label: "media", path: "media/draft" },
  { label: "assets", path: "assets/manifest" },
  { label: "publishing", path: "publishing/draft" },
  { label: "qa", path: "qa/draft" },
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
        setError(body?.error ?? `${step.label} step failed.`);
        setLoading(false);
        return;
      }
    }

    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  return (
    <div className="draft-action flow-action">
      <button className="text-button primary" disabled={loading} onClick={runFlow} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Rocket size={15} />}
        {loading ? `Running ${currentStep}` : "Run Draft Flow"}
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
