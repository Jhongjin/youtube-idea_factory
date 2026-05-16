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

const generationProviderRoles: ProviderRoleId[] = [
  "llm",
  "image",
  "video",
  "tts",
  "subtitles",
  "bgm",
  "editing",
];

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
      setMessage(body?.error ?? "수동 제공자 핸드오프 생성에 실패했습니다.");
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
      setMessage(body?.error ?? "자산 등록에 실패했습니다.");
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
      return `${roleLabel(role)} provider가 설정되어 있지 않습니다. API 등록에서 직접 실행 가능한 provider를 먼저 저장하세요.`;
    }
    if (option.capability.status !== "direct") {
      return `${option.provider}는 현재 직접 생성 어댑터가 아닙니다. 수동 핸드오프를 만들고 완료 파일을 등록하세요.`;
    }
    if (!option.hasApiKey) {
      return `${option.provider} API 키가 저장되어 있지 않습니다. API 등록에서 키를 저장한 뒤 다시 시도하세요.`;
    }
    return "";
  };
  const imageGenerationBlocker = directGenerationBlocker("image");
  const videoGenerationBlocker = directGenerationBlocker("video");
  const voiceGenerationBlocker = directGenerationBlocker("tts");

  return (
    <div className="asset-console">
      <div className="asset-console-summary">
        <span>준비 {state.summary?.ready ?? 0}</span>
        <span>생성 {state.summary?.generated ?? 0}</span>
        <span>차단 {state.summary?.blocked ?? 0}</span>
        <button
          className="text-button"
          disabled={!state.manifestExists || Boolean(loadingId)}
          onClick={createManualHandoff}
          type="button"
        >
          {loadingId === "manual-handoff" ? <Loader2 className="spin" size={15} /> : <FilePlus2 size={15} />}
          수동 핸드오프
        </button>
      </div>

      <div className="generation-provider-selector">
        <div className="generation-provider-selector-head">
          <div>
            <strong>생성 provider 선택</strong>
            <span>API 설정에 등록한 기본값과 추가 슬롯을 이 제작 단계에서 고릅니다.</span>
          </div>
          <a className="text-button" href="/settings">
            API 등록
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
                  {options.length === 0 ? <option value="">등록된 옵션 없음</option> : null}
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} · {option.capability.shortLabel}
                    </option>
                  ))}
                </select>
                <small>
                  {selectedOption
                    ? `${selectedOption.hasApiKey ? "키 등록" : "키 없음"} · ${selectedOption.capability.label}`
                    : "설정 페이지에서 provider를 등록하세요."}
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
        <textarea value={narration} onChange={(event) => setNarration(event.target.value)} rows={5} />
      </label>
      <label className="asset-narration">
        <span>음성 지시사항</span>
        <input value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      </label>

      <div className="asset-action-list">
        {imageItems.slice(0, 6).map((item) => (
          <div className="asset-action-row" key={item.id}>
            <div>
              <strong>
                {item.id}
                {item.scene_id ? ` / ${item.scene_id}` : ""}
              </strong>
              <small>{compactPath(item.expected_path)}</small>
              {item.blockers.length > 0 ? <small>{item.blockers[0]}</small> : null}
            </div>
            <AssetStatus item={item} />
            <button
              className="text-button"
              disabled={item.status !== "pending_generation" || Boolean(loadingId) || Boolean(imageGenerationBlocker)}
              onClick={() => generateImage(item.id)}
              title={imageGenerationBlocker || undefined}
              type="button"
            >
              {loadingId === item.id ? <Loader2 className="spin" size={15} /> : <ImageIcon size={15} />}
              이미지
            </button>
          </div>
        ))}

        {videoItems.slice(0, 4).map((item) => (
          <div className="asset-action-row" key={item.id}>
            <div>
              <strong>
                {item.id}
                {item.scene_id ? ` / ${item.scene_id}` : ""}
              </strong>
              <small>{compactPath(item.expected_path)}</small>
              {item.blockers.length > 0 ? <small>{item.blockers[0]}</small> : null}
            </div>
            <AssetStatus item={item} />
            <button
              className="text-button"
              disabled={item.status !== "pending_generation" || Boolean(loadingId) || Boolean(videoGenerationBlocker)}
              onClick={() => generateVideo(item.id)}
              title={videoGenerationBlocker || undefined}
              type="button"
            >
              {loadingId === item.id ? <Loader2 className="spin" size={15} /> : <Video size={15} />}
              영상
            </button>
          </div>
        ))}

        {voiceItem ? (
          <div className="asset-action-row">
            <div>
              <strong>{voiceItem.id}</strong>
              <small>{compactPath(voiceItem.expected_path)}</small>
              {voiceItem.blockers.length > 0 ? <small>{voiceItem.blockers[0]}</small> : null}
            </div>
            <AssetStatus item={voiceItem} />
            <button
              className="text-button"
              disabled={voiceItem.status !== "pending_generation" || Boolean(loadingId) || Boolean(voiceGenerationBlocker)}
              onClick={() => generateVoice(voiceItem.id)}
              title={voiceGenerationBlocker || undefined}
              type="button"
            >
              {loadingId === voiceItem.id ? <Loader2 className="spin" size={15} /> : <Mic2 size={15} />}
              음성
            </button>
          </div>
        ) : null}
      </div>

      <div className="asset-register">
        <label>
          <span>자산</span>
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
          등록
        </button>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {!state.manifestExists ? <p className="form-error">자산 매니페스트가 아직 없습니다.</p> : null}
    </div>
  );
}
