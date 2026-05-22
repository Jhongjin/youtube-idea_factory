"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  defaultLlmProfileId,
  LlmProfilePicker,
} from "@/app/components/llm-profile-picker";
import type { SafeProviderSettings } from "@/lib/provider-settings-shared";

export function StrategyRecommendationsButton({
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

  async function recommend() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/analysis/strategy-recommendations`, {
      body: JSON.stringify({ providerProfileId: providerProfileId || undefined }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "LLM 전략 추천에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=draft&notice=strategy-recommendations#artifact-strategy-recommendations`;
  }

  return (
    <div className="draft-action">
      <LlmProfilePicker
        disabled={loading}
        onChange={setProviderProfileId}
        settings={providerSettings}
        value={providerProfileId}
      />
      <button className="text-button" disabled={loading} onClick={recommend} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
        LLM 전략 추천
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
