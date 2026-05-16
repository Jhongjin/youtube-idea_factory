"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  defaultLlmProfileId,
  LlmProfilePicker,
} from "@/app/components/llm-profile-picker";
import type { SafeProviderSettings } from "@/lib/provider-settings-shared";

export function AnalysisRefineButton({
  providerSettings,
  runId,
}: {
  providerSettings: SafeProviderSettings;
  runId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providerProfileId, setProviderProfileId] = useState(() =>
    defaultLlmProfileId(providerSettings),
  );

  async function refine() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/analysis/refine`, {
      body: JSON.stringify({ providerProfileId: providerProfileId || undefined }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "LLM 분석 고도화에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=draft#artifact-video-analysis`;
  }

  return (
    <div className="draft-action">
      <LlmProfilePicker
        disabled={loading}
        onChange={setProviderProfileId}
        settings={providerSettings}
        value={providerProfileId}
      />
      <button className="text-button" disabled={loading} onClick={refine} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
        분석 고도화
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
