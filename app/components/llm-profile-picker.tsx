"use client";

import type { SafeProviderSettings } from "@/lib/provider-settings-shared";

type LlmProfilePickerProps = {
  disabled?: boolean;
  onChange: (profileId: string) => void;
  settings: SafeProviderSettings;
  value: string;
};

export function defaultLlmProfileId(settings: SafeProviderSettings) {
  if (settings.roles.llm.enabled) {
    return "";
  }
  return settings.profiles.find((profile) => profile.role === "llm" && profile.enabled)?.id ?? "";
}

function providerLabel(provider: string, model: string, fallback: string) {
  const parts = [provider.trim(), model.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : fallback;
}

export function LlmProfilePicker({ disabled, onChange, settings, value }: LlmProfilePickerProps) {
  const base = settings.roles.llm;
  const profiles = settings.profiles.filter((profile) => profile.role === "llm" && profile.enabled);
  const hasSelectableProvider = base.enabled || profiles.length > 0;
  if (!hasSelectableProvider) {
    return (
      <div className="llm-profile-picker muted" aria-live="polite">
        LLM API가 아직 켜져 있지 않습니다. API 설정에서 LLM을 활성화하세요.
      </div>
    );
  }

  return (
    <label className="llm-profile-picker">
      <span>LLM</span>
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        {base.enabled ? (
          <option value="">{providerLabel(base.provider, base.model, "기본 LLM")}</option>
        ) : null}
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.id} - {providerLabel(profile.provider, profile.model, "LLM 슬롯")}
          </option>
        ))}
      </select>
    </label>
  );
}
