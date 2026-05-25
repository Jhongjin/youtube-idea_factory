"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Mic2,
  Video,
} from "lucide-react";
import type { AssetGenerationState, AssetGenerationStateItem } from "@/lib/asset-generation-state";
import { getProviderCapability } from "@/lib/provider-capabilities";
import {
  providerRoles,
  type ProviderRoleId,
  type SafeProviderProfile,
  type SafeProviderRoleSetting,
  type SafeProviderSettings,
} from "@/lib/provider-settings-shared";

const imageConfirmToken = "GENERATE_IMAGE";
const ttsConfirmToken = "GENERATE_TTS";
const videoConfirmToken = "GENERATE_VIDEO";

const assetKindCopy: Record<string, string> = {
  image: "이미지",
  thumbnail: "썸네일",
  voice: "음성",
  subtitles: "자막",
  video: "영상",
  bgm: "BGM",
};

const generationProviderRoles: ProviderRoleId[] = ["image", "video", "tts"];

type ProviderOption = {
  capability: ReturnType<typeof getProviderCapability>;
  hasApiKey: boolean;
  id: string;
  label: string;
  profileId?: string;
  provider: string;
};

function roleLabel(role: ProviderRoleId) {
  return providerRoles.find((item) => item.id === role)?.label ?? role;
}

function settingLabel(setting: SafeProviderRoleSetting) {
  const suffix = setting.model.trim() ? ` / ${setting.model}` : "";
  return `기본 ${setting.provider}${suffix}`;
}

function profileLabel(profile: SafeProviderProfile) {
  const suffix = profile.model.trim() ? ` / ${profile.model}` : "";
  return `${profile.provider}${suffix}`;
}

function providerOptionsForRole(settings: SafeProviderSettings, role: ProviderRoleId): ProviderOption[] {
  const base = settings.roles[role];
  const options: ProviderOption[] = [];
  if (base.enabled) {
    options.push({
      capability: getProviderCapability(role, base.provider),
      hasApiKey: base.hasApiKey,
      id: "default",
      label: settingLabel(base),
      provider: base.provider,
    });
  }
  for (const profile of settings.profiles.filter((item) => item.role === role && item.enabled)) {
    options.push({
      capability: getProviderCapability(role, profile.provider),
      hasApiKey: profile.hasApiKey,
      id: profile.id,
      label: profileLabel(profile),
      profileId: profile.id,
      provider: profile.provider,
    });
  }
  return options;
}

function compactPath(value: string) {
  return value.replace(/^supabase:\/\/[^/]+\//, "").replace(/^artifacts\//, "");
}

function assetDisplayName(item: AssetGenerationStateItem) {
  const kind = assetKindCopy[item.kind] ?? item.kind;
  return item.scene_id ? `${item.scene_id} ${kind}` : `${kind} ${item.id}`;
}

function sortedAssetPreview(items: AssetGenerationStateItem[], limit: number) {
  const order: Record<AssetGenerationStateItem["status"], number> = {
    pending_generation: 0,
    pending_approval: 1,
    failed: 2,
    generated: 3,
    skipped: 4,
  };
  return [...items].sort((left, right) => order[left.status] - order[right.status]).slice(0, limit);
}

function AssetStatus({ item }: { item: AssetGenerationStateItem }) {
  const ready = item.status === "pending_generation" || item.status === "generated";
  return (
    <span className={`asset-status ${ready ? "ready" : "blocked"}`}>
      {ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {item.status === "pending_generation"
        ? "생성 대기"
        : item.status === "generated"
          ? "생성 완료"
          : item.status === "pending_approval"
            ? "승인 대기"
            : item.status === "failed"
              ? "실패"
              : "건너뜀"}
    </span>
  );
}

export function AssetGenerationConsole({
  defaultNarration,
  providerSettings,
  runId,
  state,
}: {
  defaultNarration: string;
  providerSettings: SafeProviderSettings;
  runId: string;
  state: AssetGenerationState;
}) {
  const [quality, setQuality] = useState<"low" | "medium" | "high" | "auto">("low");
  const [voice, setVoice] = useState("alloy");
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [narration, setNarration] = useState(defaultNarration);
  const [registerAssetId, setRegisterAssetId] = useState(state.items[0]?.id ?? "");
  const [registerPath, setRegisterPath] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [message, setMessage] = useState("");

  async function createManualHandoff() {
    setMessage("");
    setLoadingId("manual-handoff");
    const response = await fetch(`/api/runs/${runId}/assets/manual-handoff`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "수동 작업 파일을 만들지 못했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  async function generateImage(assetId: string) {
    setMessage("");
    const providerBlocker = directGenerationBlocker("image");
    if (providerBlocker) {
      setMessage(providerBlocker);
      return;
    }
    const confirmation = window.prompt(`${imageConfirmToken}를 입력하면 이미지를 생성합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== imageConfirmToken) {
      setMessage(`이미지 생성에는 ${imageConfirmToken}가 필요합니다.`);
      return;
    }

    setLoadingId(assetId);
    const response = await fetch(`/api/runs/${runId}/assets/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        confirmSpend: imageConfirmToken,
        providerProfileId: selectedProviderProfile("image"),
        quality,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "이미지 생성에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  async function generateVideo(assetId: string) {
    setMessage("");
    const providerBlocker = directGenerationBlocker("video");
    if (providerBlocker) {
      setMessage(providerBlocker);
      return;
    }
    const confirmation = window.prompt(`${videoConfirmToken}를 입력하면 영상을 생성합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== videoConfirmToken) {
      setMessage(`영상 생성에는 ${videoConfirmToken}가 필요합니다.`);
      return;
    }

    setLoadingId(assetId);
    const response = await fetch(`/api/runs/${runId}/assets/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        confirmSpend: videoConfirmToken,
        providerProfileId: selectedProviderProfile("video"),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "영상 생성에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  async function registerAsset() {
    setMessage("");
    setLoadingId("manual-register");
    const response = await fetch(`/api/runs/${runId}/assets/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifactPath: registerPath,
        assetId: registerAssetId,
        model: "external-file",
        provider: "manual",
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "미디어 파일 등록에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  async function generateVoice(assetId: string) {
    setMessage("");
    const providerBlocker = directGenerationBlocker("tts");
    if (providerBlocker) {
      setMessage(providerBlocker);
      return;
    }
    const confirmation = window.prompt(`${ttsConfirmToken}를 입력하면 음성을 생성합니다.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== ttsConfirmToken) {
      setMessage(`음성 생성에는 ${ttsConfirmToken}가 필요합니다.`);
      return;
    }

    setLoadingId(assetId);
    const response = await fetch(`/api/runs/${runId}/assets/generate-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        confirmSpend: ttsConfirmToken,
        instructions,
        providerProfileId: selectedProviderProfile("tts"),
        responseFormat: "wav",
        text: narration,
        voice,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "음성 생성에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  const imageItems = state.items.filter((item) => item.kind === "image" || item.kind === "thumbnail");
  const videoItems = state.items.filter((item) => item.kind === "video");
  const voiceItem = state.items.find((item) => item.kind === "voice");
  const providerRows = generationProviderRoles.map((role) => ({
    options: providerOptionsForRole(providerSettings, role),
    role,
  }));
  const selectedProviderOption = (role: ProviderRoleId) => {
    const row = providerRows.find((item) => item.role === role);
    const selectedId = selectedProviders[role] ?? row?.options[0]?.id ?? "";
    return row?.options.find((option) => option.id === selectedId);
  };
  const selectedProviderProfile = (role: ProviderRoleId) => {
    const value = selectedProviders[role];
    return value && value !== "default" ? value : undefined;
  };
  const directGenerationBlocker = (role: "image" | "video" | "tts") => {
    const option = selectedProviderOption(role);
    if (!option) {
      return `${roleLabel(role)} API가 아직 설정되지 않았습니다. API 설정에서 직접 실행 가능한 항목을 먼저 저장하세요.`;
    }
    if (option.capability.status !== "direct") {
      return `${option.provider}는 지금 바로 생성할 수 없는 방식입니다. 수동 파일로 진행한 뒤 완료 파일을 등록하세요.`;
    }
    if (!option.hasApiKey) {
      return `${option.provider} API 키가 저장되어 있지 않습니다. API 등록에서 키를 저장한 뒤 다시 시도하세요.`;
    }
    return "";
  };
  const imageGenerationBlocker = directGenerationBlocker("image");
  const videoGenerationBlocker = directGenerationBlocker("video");
  const voiceGenerationBlocker = directGenerationBlocker("tts");
  const previewImageItems = sortedAssetPreview(imageItems, 4);
  const previewVideoItems = sortedAssetPreview(videoItems, 3);

  return (
    <div className="asset-console">
      <div className="asset-console-summary">
        <span>
          <small>준비</small>
          <strong>{state.summary?.ready ?? 0}</strong>
        </span>
        <span>
          <small>완료</small>
          <strong>{state.summary?.generated ?? 0}</strong>
        </span>
        <span>
          <small>막힘</small>
          <strong>{state.summary?.blocked ?? 0}</strong>
        </span>
      </div>

      <details className="asset-console-settings">
        <summary>
          <span>API와 수동 등록</span>
          <small>필요할 때만 열어 수정합니다.</small>
        </summary>
        <div className="asset-console-settings-body">
          <div className="generation-provider-selector">
            <div className="generation-provider-selector-head">
              <div>
                <strong>사용할 API</strong>
                <span>이미지, 영상, 음성 생성에 사용할 API를 고릅니다.</span>
              </div>
              <a className="text-button" href="/settings">
                API 설정
              </a>
            </div>
            <div className="generation-provider-grid">
              {providerRows.map(({ options, role }) => {
                const selectedId = selectedProviders[role] ?? options[0]?.id ?? "";
                const selectedOption = options.find((option) => option.id === selectedId);
                return (
                  <label key={role}>
                    <span>{roleLabel(role)}</span>
                    <select
                      disabled={options.length === 0}
                      onChange={(event) =>
                        setSelectedProviders((current) => ({ ...current, [role]: event.target.value }))
                      }
                      value={selectedId}
                    >
                      {options.length === 0 ? <option value="">설정 없음</option> : null}
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} · {option.capability.shortLabel}
                        </option>
                      ))}
                    </select>
                    <small>
                      {selectedOption
                        ? `${selectedOption.hasApiKey ? "키 있음" : "키 없음"} · ${selectedOption.capability.label}`
                        : "설정 페이지에서 API를 등록하세요."}
                    </small>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="asset-control-grid">
            <label>
              <span>이미지 품질</span>
              <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="auto">자동</option>
              </select>
            </label>
            <label>
              <span>음성</span>
              <input value={voice} onChange={(event) => setVoice(event.target.value)} />
            </label>
          </div>

          <label className="asset-narration">
            <span>내레이션</span>
            <textarea value={narration} onChange={(event) => setNarration(event.target.value)} rows={4} />
          </label>
          <label className="asset-narration">
            <span>음성 지시사항</span>
            <input value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </label>

          <div className="asset-register">
            <label>
              <span>미디어</span>
              <select value={registerAssetId} onChange={(event) => setRegisterAssetId(event.target.value)}>
                {state.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} / {assetKindCopy[item.kind] ?? item.kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>파일 경로</span>
              <input
                placeholder={`artifacts/${runId}/...`}
                value={registerPath}
                onChange={(event) => setRegisterPath(event.target.value)}
              />
            </label>
            <button
              className="text-button"
              disabled={!registerAssetId || !registerPath.trim() || Boolean(loadingId)}
              onClick={registerAsset}
              type="button"
            >
              {loadingId === "manual-register" ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <FilePlus2 size={15} />
              )}
              파일 등록
            </button>
          </div>

          <button
            className="text-button"
            disabled={!state.manifestExists || Boolean(loadingId)}
            onClick={createManualHandoff}
            type="button"
          >
            {loadingId === "manual-handoff" ? <Loader2 className="spin" size={15} /> : <FilePlus2 size={15} />}
            수동 파일로 진행
          </button>
        </div>
      </details>

      <details className="asset-console-worklist">
        <summary>
          <span>생성할 항목</span>
          <small>
            전체 {state.items.length}개 · 이미지 {imageItems.length}개 · 영상 {videoItems.length}개 · 음성{" "}
            {voiceItem ? 1 : 0}개
          </small>
        </summary>
        <div className="asset-console-worklist-body">
          <div className="asset-action-list">
            {state.items.length === 0 ? (
              <p className="asset-console-empty">아직 생성할 항목이 없습니다. 먼저 미디어 프롬프트를 만들어 주세요.</p>
            ) : null}

            {imageItems.length > 0 ? (
              <div className="asset-action-section">
                <div className="asset-action-section-title">
                  <strong>이미지와 썸네일</strong>
                  <span>{imageItems.length}개 중 먼저 볼 {previewImageItems.length}개</span>
                </div>
                {imageGenerationBlocker ? <p className="asset-action-note">{imageGenerationBlocker}</p> : null}
                {previewImageItems.map((item) => {
                  const displayName = assetDisplayName(item);
                  const expectedPath = compactPath(item.expected_path);
                  return (
                    <div className="asset-action-row" key={item.id}>
                      <div>
                        <strong title={`${displayName} · ${expectedPath}`}>{displayName}</strong>
                        {item.blockers.length > 0 ? <small title={item.blockers[0]}>{item.blockers[0]}</small> : null}
                      </div>
                      <AssetStatus item={item} />
                      <button
                        className="text-button"
                        disabled={
                          item.status !== "pending_generation" || Boolean(loadingId) || Boolean(imageGenerationBlocker)
                        }
                        onClick={() => generateImage(item.id)}
                        title={imageGenerationBlocker || undefined}
                        type="button"
                      >
                        {loadingId === item.id ? <Loader2 className="spin" size={15} /> : <ImageIcon size={15} />}
                        이미지
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {videoItems.length > 0 ? (
              <div className="asset-action-section">
                <div className="asset-action-section-title">
                  <strong>영상 클립</strong>
                  <span>{videoItems.length}개 중 먼저 볼 {previewVideoItems.length}개</span>
                </div>
                {videoGenerationBlocker ? <p className="asset-action-note">{videoGenerationBlocker}</p> : null}
                {previewVideoItems.map((item) => {
                  const displayName = assetDisplayName(item);
                  const expectedPath = compactPath(item.expected_path);
                  return (
                    <div className="asset-action-row" key={item.id}>
                      <div>
                        <strong title={`${displayName} · ${expectedPath}`}>{displayName}</strong>
                        {item.blockers.length > 0 ? <small title={item.blockers[0]}>{item.blockers[0]}</small> : null}
                      </div>
                      <AssetStatus item={item} />
                      <button
                        className="text-button"
                        disabled={
                          item.status !== "pending_generation" || Boolean(loadingId) || Boolean(videoGenerationBlocker)
                        }
                        onClick={() => generateVideo(item.id)}
                        title={videoGenerationBlocker || undefined}
                        type="button"
                      >
                        {loadingId === item.id ? <Loader2 className="spin" size={15} /> : <Video size={15} />}
                        영상
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {voiceItem ? (
              <div className="asset-action-section">
                <div className="asset-action-section-title">
                  <strong>내레이션 음성</strong>
                  <span>1개</span>
                </div>
                {voiceGenerationBlocker ? <p className="asset-action-note">{voiceGenerationBlocker}</p> : null}
                <div className="asset-action-row">
                  <div>
                    <strong title={`${voiceItem.id} · ${compactPath(voiceItem.expected_path)}`}>내레이션</strong>
                    {voiceItem.blockers.length > 0 ? (
                      <small title={voiceItem.blockers[0]}>{voiceItem.blockers[0]}</small>
                    ) : null}
                  </div>
                  <AssetStatus item={voiceItem} />
                  <button
                    className="text-button"
                    disabled={
                      voiceItem.status !== "pending_generation" || Boolean(loadingId) || Boolean(voiceGenerationBlocker)
                    }
                    onClick={() => generateVoice(voiceItem.id)}
                    title={voiceGenerationBlocker || undefined}
                    type="button"
                  >
                    {loadingId === voiceItem.id ? <Loader2 className="spin" size={15} /> : <Mic2 size={15} />}
                    음성
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </details>

      {message ? <p className="form-error">{message}</p> : null}
      {!state.manifestExists ? <p className="form-error">필요한 미디어 목록이 아직 없습니다.</p> : null}
    </div>
  );
}
