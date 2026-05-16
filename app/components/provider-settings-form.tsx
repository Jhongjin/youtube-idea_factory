"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save } from "lucide-react";
import { getProviderCapability } from "@/lib/provider-capabilities";
import {
  providerRoles,
  type ProviderRoleId,
  type SafeProviderSettings,
} from "@/lib/provider-settings-shared";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProviderSettingsForm({ initialSettings }: { initialSettings: SafeProviderSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const roleList = useMemo(
    () => providerRoles.map((role) => ({ ...role, setting: settings.roles[role.id] })),
    [settings],
  );
  const enabledCount = roleList.filter((role) => role.setting.enabled).length;
  const keyCount = roleList.filter((role) => role.setting.hasApiKey).length;
  const directCount = roleList.filter(
    (role) => role.setting.enabled && getProviderCapability(role.id, role.setting.provider).status === "direct",
  ).length;
  const manualCount = roleList.filter(
    (role) => role.setting.enabled && getProviderCapability(role.id, role.setting.provider).status === "manual",
  ).length;

  function updateRole(role: ProviderRoleId, patch: Partial<SafeProviderSettings["roles"][ProviderRoleId]>) {
    setSettings((current) => ({
      ...current,
      roles: {
        ...current.roles,
        [role]: {
          ...current.roles[role],
          ...patch,
        },
      },
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError("");

    const formData = new FormData(event.currentTarget);
    const roles = providerRoles.map((role) => ({
      role: role.id,
      enabled: formData.get(`${role.id}.enabled`) === "on",
      provider: String(formData.get(`${role.id}.provider`) ?? ""),
      model: String(formData.get(`${role.id}.model`) ?? ""),
      apiKey: String(formData.get(`${role.id}.apiKey`) ?? ""),
      baseUrl: String(formData.get(`${role.id}.baseUrl`) ?? ""),
      notes: String(formData.get(`${role.id}.notes`) ?? ""),
    }));

    const response = await fetch("/api/settings/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "제공자 설정 저장에 실패했습니다.");
      setState("error");
      return;
    }

    const body = (await response.json()) as { settings: SafeProviderSettings };
    setSettings(body.settings);
    setState("saved");
  }

  return (
    <form className="provider-settings-form" onSubmit={onSubmit}>
      <div className="settings-summary">
        <div>
          <p className="eyebrow">
            {settings.configPath.startsWith("supabase") ? "Supabase 제공자 설정" : "로컬 제공자 설정"}
          </p>
          <h2>API 등록</h2>
          <p className="muted">
            <strong>{settings.configPath}</strong>에 저장됩니다. API 키 원문은 브라우저로 반환하지 않습니다.
          </p>
        </div>
        <button className="text-button primary" disabled={state === "saving"} type="submit">
          {state === "saving" ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
          설정 저장
        </button>
      </div>

      <section className="provider-setup-strip" aria-label="제공자 설정 요약">
        <div>
          <span>사용 중</span>
          <strong>{enabledCount}/{roleList.length}</strong>
        </div>
        <div>
          <span>저장된 키</span>
          <strong>{keyCount}</strong>
        </div>
        <div>
          <span>직접 실행</span>
          <strong>{directCount}</strong>
        </div>
        <div>
          <span>수동 전달</span>
          <strong>{manualCount}</strong>
        </div>
      </section>

      {error ? <p className="settings-message error">{error}</p> : null}
      {state === "saved" ? (
        <p className="settings-message saved">
          <CheckCircle2 size={15} />
          제공자 설정이 저장되었습니다.
        </p>
      ) : null}

      <div className="provider-grid">
        {roleList.map(({ id, label, description, providers, setting }) => {
          const selectedCapability = getProviderCapability(id, setting.provider);
          return (
            <section className={`provider-card ${setting.enabled ? "enabled" : "disabled"}`} key={id}>
              <div className="provider-card-header">
                <div>
                  <h3>{label}</h3>
                  <p>{description}</p>
                </div>
                <label className="provider-toggle">
                  <input
                    checked={setting.enabled}
                    name={`${id}.enabled`}
                    onChange={(event) => updateRole(id, { enabled: event.target.checked })}
                    type="checkbox"
                  />
                  사용
                </label>
              </div>

              <div className="provider-status">
                <KeyRound size={14} />
                <span>{setting.hasApiKey ? `키 ${setting.apiKeyPreview}` : "저장된 키 없음"}</span>
                <span className={`provider-capability ${selectedCapability.status}`}>
                  {selectedCapability.label}
                </span>
                <span>{setting.provider || "제공자 미선택"}</span>
              </div>

              <details className="provider-config-details" open={setting.enabled}>
                <summary>
                  <span>{setting.enabled ? "실행 설정 편집" : "비활성 역할 설정"}</span>
                  <strong>{setting.enabled ? "사용 중" : "접힘"}</strong>
                </summary>
                <div className="provider-fields">
                  <label>
                    <span>제공자</span>
                    <select
                      name={`${id}.provider`}
                      onChange={(event) => updateRole(id, { provider: event.target.value })}
                      value={setting.provider}
                    >
                      {providers.map((provider) => {
                        const capability = getProviderCapability(id, provider);
                        return (
                          <option key={provider} value={provider}>
                            {provider} · {capability.shortLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label>
                    <span>모델 / 프리셋</span>
                    <input
                      name={`${id}.model`}
                      onChange={(event) => updateRole(id, { model: event.target.value })}
                      placeholder="모델명, 음성, 프리셋, 워크플로 ID"
                      value={setting.model}
                    />
                  </label>
                  <label>
                    <span>API 키</span>
                    <input
                      autoComplete="off"
                      name={`${id}.apiKey`}
                      placeholder={setting.hasApiKey ? setting.apiKeyPreview : "API 키 붙여넣기"}
                      type="password"
                    />
                  </label>
                  <label>
                    <span>기본 URL</span>
                    <input
                      name={`${id}.baseUrl`}
                      onChange={(event) => updateRole(id, { baseUrl: event.target.value })}
                      placeholder="선택 사항: 커스텀 엔드포인트"
                      value={setting.baseUrl}
                    />
                  </label>
                  <label className="provider-notes">
                    <span>메모</span>
                    <textarea
                      name={`${id}.notes`}
                      onChange={(event) => updateRole(id, { notes: event.target.value })}
                      placeholder="쿼터, 계정, 안전 메모, 허용 사용 범위"
                      rows={3}
                      value={setting.notes}
                    />
                  </label>
                </div>
              </details>
            </section>
          );
        })}
      </div>
    </form>
  );
}
