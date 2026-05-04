"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";

const draftSteps = [
  "analysis",
  "script",
  "storyboard",
  "media",
  "publishing",
  "qa",
] as const;

export function RunDraftFlowButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState("");

  async function runFlow() {
    setLoading(true);
    setError("");

    for (const step of draftSteps) {
      setCurrentStep(step);
      const response = await fetch(`/api/runs/${runId}/${step}/draft`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `${step} draft failed.`);
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
