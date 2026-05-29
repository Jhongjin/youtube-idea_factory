"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
  return profile.provider || "엔진 슬롯";
}

function looksLikeAutofilledAccount(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}

function requiresSavedKeyForModelRefresh(provider: string) {
  return ["anthropic", "google", "openai"].includes(provider.trim().toLowerCase());
}

function formatSavedKeyPreview(_preview: string) {
  return "•••••••••••••••••••••••• (보안 저장됨)";
}

function providerCapabilityLabel(status: ReturnType<typeof getProviderCapability>["status"]) {
  switch (status) {
    case "direct":
      return "✅ 즉시 자동화 지원";
    case "manual":
      return "🛠️ 수동/외부 워크플로우";
    case "pending":
    default:
      return "⚪ 연결 대기 중";
  }
}

function modelOptionLabel(model: ProviderModelOption) {
  return `${model.label} (${model.source === "live" ? "실시간 확인" : "권장"})`;
}

function providerCapabilityOptionLabel(status: ReturnType<typeof getProviderCapability>["status"]) {
  switch (status) {
    case "direct":
      return "직접 연동";
    case "manual":
      return "수동 워크플로우";
    case "pending":
    default:
      return "연결 대기";
  }
}

function apiKeyFormatHint(provider: string) {
  const normalized = provider.trim().toLowerCase();
  if (normalized.includes("openai")) return "sk-... 또는 sk-proj-...";
  if (normalized.includes("anthropic")) return "sk-ant-...";
  if (normalized.includes("google") || normalized.includes("youtube")) return "AIza...";
  if (normalized.includes("runway")) return "key_...";
  if (normalized.includes("fal.ai")) return "fal-...";
  if (normalized.includes("stability")) return "sk-...";
  if (normalized.includes("elevenlabs")) return "xi-...";
  if (normalized.includes("deepseek")) return "sk-...";
  if (normalized.includes("mistral")) return "sk-...";
  if (normalized.includes("openrouter")) return "sk-or-...";
  if (normalized.includes("perplexity")) return "pplx-...";
  if (normalized.includes("supadata")) return "supadata-...";
  if (normalized.includes("inworld")) return "inworld-...";
  return "API";
}

function apiKeyPlaceholder(provider: string, hasApiKey: boolean) {
  if (hasApiKey) {
    return formatSavedKeyPreview("stored");
  }
  return `${apiKeyFormatHint(provider)} 형태로 시작하는 API 보안 키를 입력하세요`;
}

export function ProviderSettingsForm({ initialSettings }: { initialSettings: SafeProviderSettings }) {
  const router = useRouter();
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
    if (!supportsLiveProviderModelRefresh(provider)) {
      setModelCatalogs((current) => ({
        ...current,
        [key]: getStaticProviderModels(role, provider),
      }));
      setModelCatalogErrors((current) => ({ ...current, [key]: "" }));
      return;
    }

    setLoadingModelCatalog(key);
    setModelCatalogErrors((current) => ({ ...current, [key]: "" }));

    try {
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
        return;
      }

      setModelCatalogs((current) => ({ ...current, [key]: body.models ?? [] }));
    } catch (error) {
      setModelCatalogErrors((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "모델 목록 새로고침에 실패했습니다.",
      }));
    } finally {
      setLoadingModelCatalog("");
    }
  }

  function ModelField({
    name,
    onChange,
    placeholder,
    profileId,
    provider,
    hasSavedApiKey,
    role,
    value,
  }: {
    hasSavedApiKey: boolean;
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
    const canRefresh = supportsLiveRefresh || getStaticProviderModels(role, provider).length > 0;
    const loading = loadingModelCatalog === key;
    const missingSavedKey =
      supportsLiveRefresh && requiresSavedKeyForModelRefresh(provider) && !hasSavedApiKey;
    const normalizedValue = looksLikeAutofilledAccount(value) ? "" : value;
    const hasCurrentModel = Boolean(
      normalizedValue && !options.some((model) => model.id === normalizedValue),
    );
    return (
      <>
        <div className="provider-model-field">
          <input name={name} type="hidden" value={normalizedValue} />
          {options.length > 0 ? (
            <select
              aria-label="모델 선택"
              className="provider-model-select"
              onChange={(event) => onChange(event.target.value)}
              value={normalizedValue}
            >
              <option value="">{looksLikeAutofilledAccount(value) ? "모델을 다시 선택하세요" : placeholder}</option>
              {hasCurrentModel ? <option value={normalizedValue}>{normalizedValue} (직접 입력)</option> : null}
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {modelOptionLabel(model)}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-autocomplete="none"
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect="off"
              data-1p-ignore="true"
              data-form-type="other"
              data-lpignore="true"
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              spellCheck={false}
              value={normalizedValue}
            />
          )}
          {canRefresh ? (
            <button
              className="icon-button"
              disabled={loading || missingSavedKey}
              onClick={() => refreshModelCatalog(role, provider, profileId)}
              title={
                missingSavedKey
                  ? "API 키를 저장한 뒤 모델 목록을 새로고침할 수 있습니다"
                  : supportsLiveRefresh
                    ? "저장된 API 키로 역할별 모델 목록 새로고침"
                    : "내장 모델 목록 다시 불러오기"
              }
              type="button"
            >
              {loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
            </button>
          ) : null}
        </div>
        <small>
          {missingSavedKey
            ? "API 키를 먼저 저장하면 이 역할에 맞는 모델만 새로고침합니다."
            : supportsLiveRefresh
            ? "저장된 키 기준으로 모델 목록을 새로고침합니다."
            : options.length > 0
              ? "API별 권장 모델 목록입니다."
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
      setError(body?.error ?? "API 설정 저장에 실패했습니다.");
      setState("error");
      return;
    }

    const body = (await response.json()) as { settings: SafeProviderSettings };
    setSettings(body.settings);
    setState("saved");
    router.refresh();
  }

  return (
    <form className="provider-settings-form" onSubmit={onSubmit}>
      <div className="settings-summary">
        <div>
          <p className="eyebrow">AI 크레덴셜 보관소</p>
          <h2>🔒 보안 AI 크레덴셜(API 키) 등록</h2>
          <p className="muted">
            모든 API 키는 강력하게 암호화되어 안전하게 보관되며, 등록 후 유출 방지를 위해
            원문은 시스템 외부로 절대 노출되지 않습니다.
          </p>
        </div>
        <button className="text-button primary" disabled={state === "saving"} type="submit">
          {state === "saving" ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
          API 설정 저장
        </button>
      </div>

      <section className="provider-setup-strip" aria-label="API 설정 요약">
        <div>
          <span>활성 엔진</span>
          <strong>{enabledCount}/{roleList.length}</strong>
        </div>
        <div>
          <span>보안 저장 키</span>
          <strong>{keyCount}</strong>
        </div>
        <div>
          <span>즉시 자동화</span>
          <strong>{directCount}</strong>
        </div>
        <div>
          <span>수동/외부</span>
          <strong>{manualCount}</strong>
        </div>
      </section>

      {error ? <p className="settings-message error">{error}</p> : null}
      {state === "saved" ? (
        <p className="settings-message saved">
          <CheckCircle2 size={15} />
          API 설정이 저장되었습니다.
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
                <div className="provider-card-heading">
                  <div className="provider-card-title-row">
                    <label className="provider-toggle provider-switch">
                      <input
                        checked={setting.enabled}
                        name={`${id}.enabled`}
                        onChange={(event) => updateRole(id, { enabled: event.target.checked })}
                        type="checkbox"
                      />
                      <span className="provider-toggle-track" aria-hidden="true">
                        <span />
                      </span>
                      <span>{setting.enabled ? "엔진 가동" : "연결 대기"}</span>
                    </label>
                    <h3>{label}</h3>
                  </div>
                  <p>{description}</p>
                </div>
              </div>

              <div className="provider-status">
                <KeyRound size={14} />
                <span>
                  {preferredSetting.hasApiKey
                    ? formatSavedKeyPreview(preferredSetting.apiKeyPreview)
                    : "저장된 키 없음"}
                </span>
                <span className={`provider-capability ${selectedCapability.status}`}>
                  {providerCapabilityLabel(selectedCapability.status)}
                </span>
                <span>{preferredSetting.provider || "API 미선택"}</span>
              </div>

              <details className="provider-config-details" open={setting.enabled}>
                <summary>
                  <span>{setting.enabled ? "엔진 연결 설정" : "연결 대기 설정"}</span>
                  <strong>{setting.enabled ? "가동 중" : "접힘"}</strong>
                </summary>
                <div className="provider-fields">
                  <label>
                    <span>AI 엔진</span>
                    <select
                      name={`${id}.provider`}
                      onChange={(event) => updateRole(id, { model: "", provider: event.target.value })}
                      value={setting.provider}
                    >
                      {providers.map((provider) => {
                        const capability = getProviderCapability(id, provider);
                        return (
                          <option key={provider} value={provider}>
                            {provider} ({providerCapabilityOptionLabel(capability.status)})
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
                      placeholder="모델 또는 워크플로우 선택"
                      hasSavedApiKey={setting.hasApiKey}
                      provider={setting.provider}
                      role={id}
                      value={setting.model}
                    />
                  </label>
                  <label>
                    <span>보안 API 키</span>
                    <input
                      autoComplete="off"
                      name={`${id}.apiKey`}
                      placeholder={apiKeyPlaceholder(setting.provider, setting.hasApiKey)}
                      type="password"
                    />
                  </label>
                  <label>
                    <span>커스텀 엔드포인트</span>
                    <input
                      name={`${id}.baseUrl`}
                      onChange={(event) => updateRole(id, { baseUrl: event.target.value })}
                      placeholder="선택 사항: 커스텀 엔드포인트"
                      value={setting.baseUrl}
                    />
                  </label>
                  <label className="provider-notes">
                    <span>운영 메모</span>
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
                  <span>추가 엔진 슬롯</span>
                  <strong>{roleProfiles.length}개</strong>
                </summary>
                <div className="provider-profile-stack">
                  <div className="provider-profile-intro">
                    <div>
                      <strong>{label} 백업/대체 엔진</strong>
                      <span>
                        같은 역할에 여러 보안 키와 모델을 등록해두면 제작 단계에서 선택지로 노출됩니다.
                      </span>
                    </div>
                    <button className="text-button" onClick={() => addProfile(id)} type="button">
                      <Plus size={14} />
                      엔진 추가
                    </button>
                  </div>
                  {roleProfiles.length === 0 ? (
                    <p className="provider-profile-empty">아직 추가 엔진 슬롯이 없습니다.</p>
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
                            {profile.enabled ? "가동" : "대기"}
                          </label>
                          <strong>{providerProfileLabel(profile)}</strong>
                          <span className={`provider-capability ${capability.status}`}>
                            {providerCapabilityLabel(capability.status)}
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
                            <span>AI 엔진</span>
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
                                    {provider} ({providerCapabilityOptionLabel(itemCapability.status)})
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
                              placeholder="모델 또는 워크플로우 선택"
                              hasSavedApiKey={profile.hasApiKey}
                              profileId={profile.id}
                              provider={profile.provider}
                              role={profile.role}
                              value={profile.model}
                            />
                          </label>
                          <label>
                            <span>보안 API 키</span>
                            <input
                              autoComplete="off"
                              name={`profile.${profile.id}.apiKey`}
                              placeholder={apiKeyPlaceholder(profile.provider, profile.hasApiKey)}
                              type="password"
                            />
                          </label>
                          <label>
                            <span>커스텀 엔드포인트</span>
                            <input
                              name={`profile.${profile.id}.baseUrl`}
                              onChange={(event) => updateProfile(profile.id, { baseUrl: event.target.value })}
                              placeholder="선택 사항"
                              value={profile.baseUrl}
                            />
                          </label>
                          <label className="provider-profile-notes">
                            <span>운영 메모</span>
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
      <div className="provider-save-footer">
        <button className="text-button primary" disabled={state === "saving"} type="submit">
          {state === "saving" ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
          API 설정 저장
        </button>
      </div>
    </form>
  );
}
