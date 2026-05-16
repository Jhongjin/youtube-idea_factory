"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { getProviderCapability } from "@/lib/provider-capabilities";
import {
  getStaticProviderModels,
  supportsLiveProviderModelRefresh,
  type ProviderModelOption,
} from "@/lib/provider-model-catalog-shared";
import {
  providerRoles,
  type ProviderRoleId,
  type SafeProviderProfile,
  type SafeProviderSettings,
} from "@/lib/provider-settings-shared";

type SaveState = "idle" | "saving" | "saved" | "error";

type ModelCatalogState = Record<string, ProviderModelOption[]>;

function providerProfileLabel(profile: SafeProviderProfile) {
  if (profile.model.trim()) {
    return `${profile.provider} / ${profile.model}`;
  }
  if (profile.baseUrl.trim()) {
    return `${profile.provider} / custom endpoint`;
  }
  return profile.provider || "등록 슬롯";
}

export function ProviderSettingsForm({ initialSettings }: { initialSettings: SafeProviderSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [modelCatalogs, setModelCatalogs] = useState<ModelCatalogState>({});
  const [modelCatalogErrors, setModelCatalogErrors] = useState<Record<string, string>>({});
  const [loadingModelCatalog, setLoadingModelCatalog] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const roleList = useMemo(
    () => providerRoles.map((role) => ({ ...role, setting: settings.roles[role.id] })),
    [settings],
  );
  const enabledCount =
    roleList.filter((role) => role.setting.enabled).length +
    settings.profiles.filter((profile) => profile.enabled).length;
  const keyCount =
    roleList.filter((role) => role.setting.hasApiKey).length +
    settings.profiles.filter((profile) => profile.hasApiKey).length;
  const directCount = roleList.filter(
    (role) => role.setting.enabled && getProviderCapability(role.id, role.setting.provider).status === "direct",
  ).length + settings.profiles.filter(
    (profile) => profile.enabled && getProviderCapability(profile.role, profile.provider).status === "direct",
  ).length;
  const manualCount = roleList.filter(
    (role) => role.setting.enabled && getProviderCapability(role.id, role.setting.provider).status === "manual",
  ).length + settings.profiles.filter(
    (profile) => profile.enabled && getProviderCapability(profile.role, profile.provider).status === "manual",
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

  function addProfile(role: ProviderRoleId) {
    const metadata = providerRoles.find((item) => item.id === role);
    const id = `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setSettings((current) => ({
      ...current,
      profiles: [
        ...current.profiles,
        {
          id,
          role,
          enabled: true,
          provider: metadata?.providers[0] ?? "Custom",
          model: "",
          baseUrl: "",
          notes: "",
          hasApiKey: false,
          apiKeyPreview: "",
        },
      ],
    }));
  }

  function updateProfile(
    profileId: string,
    patch: Partial<Omit<SafeProviderProfile, "id" | "role" | "hasApiKey" | "apiKeyPreview">>,
  ) {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              ...patch,
            }
          : profile,
      ),
    }));
  }

  function removeProfile(profileId: string) {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.filter((profile) => profile.id !== profileId),
    }));
  }

  function modelCatalogKey(role: ProviderRoleId, provider: string, profileId = "base") {
    return `${role}:${provider.trim().toLowerCase()}:${profileId}`;
  }

  function modelOptions(role: ProviderRoleId, provider: string, profileId?: string) {
    const key = modelCatalogKey(role, provider, profileId);
    return modelCatalogs[key] ?? getStaticProviderModels(role, provider);
  }

  async function refreshModelCatalog(role: ProviderRoleId, provider: string, profileId?: string) {
    const key = modelCatalogKey(role, provider, profileId);
    setLoadingModelCatalog(key);
    setModelCatalogErrors((current) => ({ ...current, [key]: "" }));

    const response = await fetch("/api/settings/provider-models", {
      body: JSON.stringify({ profileId, provider, role }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: string; models?: ProviderModelOption[] }
      | null;
    if (!response.ok || !body?.models) {
      setModelCatalogErrors((current) => ({
        ...current,
        [key]: body?.error ?? "모델 목록을 가져오지 못했습니다. 설정을 저장한 뒤 다시 시도하세요.",
      }));
      setLoadingModelCatalog("");
      return;
    }

    setModelCatalogs((current) => ({ ...current, [key]: body.models ?? [] }));
    setLoadingModelCatalog("");
  }

  function ModelField({
    name,
    onChange,
    placeholder,
    profileId,
    provider,
    role,
    value,
  }: {
    name: string;
    onChange: (value: string) => void;
    placeholder: string;
    profileId?: string;
    provider: string;
    role: ProviderRoleId;
    value: string;
  }) {
    const key = modelCatalogKey(role, provider, profileId);
    const options = modelOptions(role, provider, profileId);
    const supportsLiveRefresh = supportsLiveProviderModelRefresh(provider);
    const loading = loadingModelCatalog === key;
    return (
      <>
        <div className="provider-model-field">
          <input
            list={options.length > 0 ? `models-${key.replace(/[^a-z0-9_-]/giu, "-")}` : undefined}
            name={name}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            value={value}
          />
          {options.length > 0 ? (
            <datalist id={`models-${key.replace(/[^a-z0-9_-]/giu, "-")}`}>
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </datalist>
          ) : null}
          {supportsLiveRefresh ? (
            <button
              className="icon-button"
              disabled={loading}
              onClick={() => refreshModelCatalog(role, provider, profileId)}
              title="저장된 API 키로 모델 목록 새로고침"
              type="button"
            >
              {loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
            </button>
          ) : null}
        </div>
        <small>
          {supportsLiveRefresh
            ? "저장된 키 기준으로 모델 목록을 새로고침합니다."
            : options.length > 0
              ? "제공자별 권장 모델 목록입니다."
              : "모델 목록 API가 없으면 직접 입력합니다. 로그인형 도구는 SSO 연결 큐로 남깁니다."}
        </small>
        {modelCatalogErrors[key] ? <small className="field-error">{modelCatalogErrors[key]}</small> : null}
      </>
    );
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
    const profiles = settings.profiles.map((profile) => ({
      id: profile.id,
      role: profile.role,
      enabled: profile.enabled,
      provider: profile.provider,
      model: profile.model,
      apiKey: String(formData.get(`profile.${profile.id}.apiKey`) ?? ""),
      baseUrl: profile.baseUrl,
      notes: profile.notes,
    }));

    const response = await fetch("/api/settings/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles, roles }),
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
          const roleProfiles = settings.profiles.filter((profile) => profile.role === id);
          const preferredSetting = setting.enabled
            ? setting
            : roleProfiles.find((profile) => profile.enabled) ?? setting;
          const selectedCapability = getProviderCapability(id, preferredSetting.provider);
          return (
            <section className={`provider-card ${preferredSetting.enabled ? "enabled" : "disabled"}`} key={id}>
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
                <span>
                  {preferredSetting.hasApiKey
                    ? `키 ${preferredSetting.apiKeyPreview}`
                    : "저장된 키 없음"}
                </span>
                <span className={`provider-capability ${selectedCapability.status}`}>
                  {selectedCapability.label}
                </span>
                <span>{preferredSetting.provider || "제공자 미선택"}</span>
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
                      onChange={(event) => updateRole(id, { model: "", provider: event.target.value })}
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
                    <ModelField
                      name={`${id}.model`}
                      onChange={(value) => updateRole(id, { model: value })}
                      placeholder="모델명, 음성, 프리셋, 워크플로 ID"
                      provider={setting.provider}
                      role={id}
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

              <details className="provider-profile-details" open={roleProfiles.length > 0}>
                <summary>
                  <span>추가 등록 슬롯</span>
                  <strong>{roleProfiles.length}개</strong>
                </summary>
                <div className="provider-profile-stack">
                  <div className="provider-profile-intro">
                    <div>
                      <strong>{label} 다중 등록</strong>
                      <span>
                        같은 역할에 여러 API 키와 모델을 등록해두면 제작 단계에서 선택지로 노출됩니다.
                      </span>
                    </div>
                    <button className="text-button" onClick={() => addProfile(id)} type="button">
                      <Plus size={14} />
                      슬롯 추가
                    </button>
                  </div>
                  {roleProfiles.length === 0 ? (
                    <p className="provider-profile-empty">아직 추가 등록 슬롯이 없습니다.</p>
                  ) : null}
                  {roleProfiles.map((profile) => {
                    const capability = getProviderCapability(profile.role, profile.provider);
                    return (
                      <div className="provider-profile-row" key={profile.id}>
                        <div className="provider-profile-row-head">
                          <label className="provider-toggle">
                            <input
                              checked={profile.enabled}
                              onChange={(event) => updateProfile(profile.id, { enabled: event.target.checked })}
                              type="checkbox"
                            />
                            사용
                          </label>
                          <strong>{providerProfileLabel(profile)}</strong>
                          <span className={`provider-capability ${capability.status}`}>
                            {capability.shortLabel}
                          </span>
                          <button
                            className="icon-button danger"
                            onClick={() => removeProfile(profile.id)}
                            title="등록 슬롯 삭제"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="provider-profile-fields">
                          <label>
                            <span>제공자</span>
                            <select
                              name={`profile.${profile.id}.provider`}
                              onChange={(event) =>
                                updateProfile(profile.id, { model: "", provider: event.target.value })
                              }
                              value={profile.provider}
                            >
                              {providers.map((provider) => {
                                const itemCapability = getProviderCapability(id, provider);
                                return (
                                  <option key={provider} value={provider}>
                                    {provider} · {itemCapability.shortLabel}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label>
                            <span>모델 / 워크플로</span>
                            <ModelField
                              name={`profile.${profile.id}.model`}
                              onChange={(value) => updateProfile(profile.id, { model: value })}
                              placeholder="예: gpt-5.2, kling-2.1, render preset"
                              profileId={profile.id}
                              provider={profile.provider}
                              role={profile.role}
                              value={profile.model}
                            />
                          </label>
                          <label>
                            <span>API 키</span>
                            <input
                              autoComplete="off"
                              name={`profile.${profile.id}.apiKey`}
                              placeholder={profile.hasApiKey ? profile.apiKeyPreview : "새 API 키"}
                              type="password"
                            />
                          </label>
                          <label>
                            <span>기본 URL</span>
                            <input
                              name={`profile.${profile.id}.baseUrl`}
                              onChange={(event) => updateProfile(profile.id, { baseUrl: event.target.value })}
                              placeholder="선택 사항"
                              value={profile.baseUrl}
                            />
                          </label>
                          <label className="provider-profile-notes">
                            <span>메모</span>
                            <input
                              name={`profile.${profile.id}.notes`}
                              onChange={(event) => updateProfile(profile.id, { notes: event.target.value })}
                              placeholder="비용, 용도, 채널 제한"
                              value={profile.notes}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </section>
          );
        })}
      </div>
    </form>
  );
}
