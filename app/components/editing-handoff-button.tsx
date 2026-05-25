"use client";

import { useState } from "react";
import { FilePlus2, Loader2 } from "lucide-react";
import { getProviderCapability } from "@/lib/provider-capabilities";
import type { SafeProviderSettings } from "@/lib/provider-settings-shared";

type EditingProviderOption = {
  capability: ReturnType<typeof getProviderCapability>;
  id: string;
  label: string;
  profileId?: string;
};

function editingProviderOptions(settings: SafeProviderSettings): EditingProviderOption[] {
  const base = settings.roles.editing;
  const options: EditingProviderOption[] = [
    {
      capability: getProviderCapability("editing", base.provider),
      id: "default",
      label: `기본 ${base.provider}${base.model ? ` / ${base.model}` : ""}${base.enabled ? "" : " / 비활성"}`,
    },
  ];
  for (const profile of settings.profiles.filter((item) => item.role === "editing" && item.enabled)) {
    options.push({
      capability: getProviderCapability("editing", profile.provider),
      id: profile.id,
      label: `${profile.provider}${profile.model ? ` / ${profile.model}` : ""}`,
      profileId: profile.id,
    });
  }
  return options;
}

export function EditingHandoffButton({
  providerSettings,
  runId,
}: {
  providerSettings: SafeProviderSettings;
  runId: string;
}) {
  const options = editingProviderOptions(providerSettings);
  const [providerOptionId, setProviderOptionId] = useState(options[0]?.id ?? "default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedOption = options.find((option) => option.id === providerOptionId) ?? options[0];

  async function createHandoff() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/render/editing-handoff`, {
      body: JSON.stringify({
        providerProfileId: selectedOption?.profileId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "편집 전달 파일을 만들지 못했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action">
      <label className="editing-provider-picker">
        <span>편집/렌더 방식</span>
        <select
          disabled={loading}
          onChange={(event) => setProviderOptionId(event.target.value)}
          value={providerOptionId}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} · {option.capability.shortLabel}
            </option>
          ))}
        </select>
        <small>{selectedOption?.capability.label ?? "설정 페이지에서 편집/렌더 API를 등록하세요."}</small>
      </label>
      <button className="text-button" disabled={loading} onClick={createHandoff} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <FilePlus2 size={15} />}
        편집 전달 파일
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
