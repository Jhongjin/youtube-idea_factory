"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Mic2,
  RotateCcw,
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

function sceneDisplayName(sceneId?: string | null) {
  if (!sceneId) return "";
  const numericScene = sceneId.match(/^s?0*(\d+)$/i);
  if (numericScene) return `${Number(numericScene[1])}번 장면`;
  return `${sceneId} 장면`;
}

function assetDisplayName(item: AssetGenerationStateItem) {
  const kind = assetKindCopy[item.kind] ?? item.kind;
  const scene = sceneDisplayName(item.scene_id);
  if (item.kind === "voice") return "내레이션";
  if (item.kind === "bgm") return "배경음악";
  if (item.kind === "thumbnail") return scene ? `${scene} 썸네일` : "썸네일";
  return scene ? `${scene} ${kind}` : kind;
}

function assetDebugTitle(item: AssetGenerationStateItem) {
  return [item.id, item.scene_id, compactPath(item.expected_path)].filter(Boolean).join(" · ");
}

function blockerCopy(value: string) {
  const text = value.trim();
  if (text.includes("Required before paid image, video, TTS, subtitle, or BGM generation")) {
    return "이미지, 영상, 음성 제작 전 사람이 먼저 승인해야 합니다.";
  }
  if (text.includes("Required before final video assembly or render spend")) {
    return "최종 영상 조립 전 사람이 먼저 승인해야 합니다.";
  }
  if (text.includes("Required before YouTube upload, scheduling, or publishing")) {
    return "YouTube 업로드 전 사람이 먼저 승인해야 합니다.";
  }
  if (text.toLowerCase().includes("approval")) {
    return "승인이 끝나면 진행할 수 있습니다.";
  }
  if (text.includes("provider is not enabled")) {
    return "사용할 제작 도구가 꺼져 있습니다.";
  }
  if (text.includes("API key is missing")) {
    return "API 키가 저장되어 있지 않습니다.";
  }
  if (text.includes("model is missing")) {
    return "모델명이 비어 있습니다.";
  }
  if (text.includes("custom provider base URL is missing")) {
    return "커스텀 제작 도구 주소가 비어 있습니다.";
  }
  if (text.includes("prompt is empty")) {
    return "제작 요청 문장이 비어 있습니다.";
  }
  if (text.includes("expected_path is empty")) {
    return "저장 위치가 비어 있습니다.";
  }
  if (text.includes("qa.status is blocked")) {
    return "검수에서 확인할 항목이 남아 있습니다.";
  }
  return text;
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

function assetStatusLabel(status: AssetGenerationStateItem["status"], isApproved = false) {
  if (isApproved && status === "pending_approval") return "승인 및 생성 대기";
  if (status === "pending_generation") return "바로 만들기";
  if (status === "generated") return "완료";
  if (status === "pending_approval") return "검토 및 승인 대기";
  if (status === "failed") return "실패";
  return "건너뜀";
}

function AssetStatus({ isApproved = false, item }: { isApproved?: boolean; item: AssetGenerationStateItem }) {
  const isApprovalReady = isApproved && item.status === "pending_approval";
  const tone =
    isApprovalReady
      ? "ready approved"
      : item.status === "generated"
      ? "done"
      : item.status === "pending_generation"
        ? "ready"
        : item.status === "failed"
          ? "failed"
          : item.status === "skipped"
            ? "muted"
            : "blocked";
  return (
    <span className={`asset-status ${tone}`}>
      {isApprovalReady || tone === "ready" || tone === "done" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {assetStatusLabel(item.status, isApprovalReady)}
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
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [narration, setNarration] = useState(defaultNarration);
  const [registerAssetId, setRegisterAssetId] = useState(
    state.items.find((item) => item.status !== "generated")?.id ?? "",
  );
  const [registerPath, setRegisterPath] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [approvedAssetIds, setApprovedAssetIds] = useState<Set<string>>(() => new Set());

  async function createManualHandoff() {
    setMessage("");
    setLoadingId("manual-handoff");
    const response = await fetch(`/api/runs/${runId}/assets/manual-handoff`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "수동 업로드 파일을 반영하지 못했습니다.");
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

  async function updateAssetStatus(assetId: string, action: "retry" | "skip") {
    setMessage("");
    const label = action === "retry" ? "다시 만들 수 있게 열기" : "건너뛰기";
    if (action === "skip") {
      const confirmed = window.confirm("이 항목을 건너뛰기로 표시할까요? 최종 조립 단계에서 다시 필요하다고 표시될 수 있습니다.");
      if (!confirmed) {
        return;
      }
    }
    setLoadingId(`${action}:${assetId}`);
    const response = await fetch(`/api/runs/${runId}/assets/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        assetId,
        reason: action === "skip" ? "Operator skipped from media workboard." : undefined,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? `${label}에 실패했습니다.`);
      setLoadingId("");
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=production`;
  }

  async function saveAssetPrompt(assetId: string) {
    setMessage("");
    const prompt = promptDrafts[assetId]?.trim() ?? "";
    if (!prompt) {
      setMessage("제작 요청문을 입력하세요.");
      return;
    }
    setLoadingId(`prompt:${assetId}`);
    const response = await fetch(`/api/runs/${runId}/assets/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        prompt,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "제작 요청문 저장에 실패했습니다.");
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
  const voiceItems = state.items.filter((item) => item.kind === "voice");
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
      return `${roleLabel(role)} 제작 방식이 아직 준비되지 않았습니다. 설정에서 사용할 API를 저장하세요.`;
    }
    if (option.capability.status !== "direct") {
      return `${option.provider}는 여기서 바로 만들 수 없습니다. 직접 만든 파일을 등록해서 이어가세요.`;
    }
    if (!option.hasApiKey) {
      return `${option.provider} 키가 저장되어 있지 않습니다. 설정에서 키를 저장한 뒤 다시 시도하세요.`;
    }
    return "";
  };
  const imageGenerationBlocker = directGenerationBlocker("image");
  const videoGenerationBlocker = directGenerationBlocker("video");
  const voiceGenerationBlocker = directGenerationBlocker("tts");
  const readyItems = state.items.filter((item) => item.status === "pending_generation");
  const blockedItems = state.items.filter((item) => item.status === "pending_approval");
  const failedItems = state.items.filter((item) => item.status === "failed");
  const skippedItems = state.items.filter((item) => item.status === "skipped");
  const generatedItems = state.items.filter((item) => item.status === "generated");
  const manualRegisterItems = state.items.filter((item) => item.status !== "generated");
  const summary = {
    blocked: state.summary?.blocked ?? blockedItems.length,
    failed: state.summary?.failed ?? failedItems.length,
    generated: state.summary?.generated ?? generatedItems.length,
    ready: state.summary?.ready ?? readyItems.length,
    skipped: state.summary?.skipped ?? skippedItems.length,
    total: state.summary?.total ?? state.items.length,
  };
  const readyDirectItems = readyItems.filter((item) => item.kind === "image" || item.kind === "thumbnail" || item.kind === "video" || item.kind === "voice");
  const readyManualItems = readyItems.filter((item) => !readyDirectItems.includes(item));

  const generationBlockerForItem = (item: AssetGenerationStateItem) => {
    if (item.kind === "image" || item.kind === "thumbnail") return imageGenerationBlocker;
    if (item.kind === "video") return videoGenerationBlocker;
    if (item.kind === "voice") return voiceGenerationBlocker;
    return "이 항목은 여기서 바로 만들 수 없습니다. 직접 제작한 에셋 업로드로 이어가세요.";
  };

  const selectForManualRegistration = (assetId: string) => {
    setRegisterAssetId(assetId);
    setApprovedAssetIds((current) => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
    setMessage("아래 직접 제작한 에셋 업로드에서 파일 경로를 넣고 저장하세요.");
  };

  const runDirectGeneration = (item: AssetGenerationStateItem) => {
    if (item.kind === "image" || item.kind === "thumbnail") {
      generateImage(item.id);
      return;
    }
    if (item.kind === "video") {
      generateVideo(item.id);
      return;
    }
    if (item.kind === "voice") {
      generateVoice(item.id);
      return;
    }
    selectForManualRegistration(item.id);
  };

  const directActionLabel = (item: AssetGenerationStateItem) => {
    if (item.kind === "thumbnail") return "썸네일 만들기";
    if (item.kind === "image") return "이미지 만들기";
    if (item.kind === "video") return "영상 만들기";
    if (item.kind === "voice") return "음성 만들기";
    return "파일 등록";
  };

  const directActionIcon = (item: AssetGenerationStateItem) => {
    if (loadingId === item.id) return <Loader2 className="spin" size={15} />;
    if (item.kind === "video") return <Video size={15} />;
    if (item.kind === "voice") return <Mic2 size={15} />;
    if (item.kind === "image" || item.kind === "thumbnail") return <ImageIcon size={15} />;
    return <FilePlus2 size={15} />;
  };

  const isApprovedForManualFlow = (item: AssetGenerationStateItem) =>
    item.status === "pending_approval" && approvedAssetIds.has(item.id);

  const assetRowClassName = (item: AssetGenerationStateItem, extraClass = "") =>
    ["asset-action-row", "media-work-row", extraClass, isApprovedForManualFlow(item) ? "is-approved" : ""]
      .filter(Boolean)
      .join(" ");

  const statusDetail = (item: AssetGenerationStateItem) =>
    item.error?.trim() || item.blockers.map(blockerCopy).join(", ") || "파일을 직접 등록하거나 건너뛸 수 있습니다.";

  const canEditPrompt = (item: AssetGenerationStateItem) =>
    item.status !== "generated" && (item.kind === "image" || item.kind === "thumbnail" || item.kind === "video");

  const promptDraftValue = (item: AssetGenerationStateItem) => promptDrafts[item.id] ?? item.prompt ?? "";

  const promptEditor = (item: AssetGenerationStateItem) => {
    if (!canEditPrompt(item)) {
      return null;
    }
    const draft = promptDraftValue(item);
    const originalPrompt = item.prompt ?? "";
    const promptChanged = draft.trim() !== originalPrompt.trim();
    return (
      <details className="asset-prompt-editor">
        <summary>AI 생성 프롬프트 수정</summary>
        <div className="asset-prompt-editor-body">
          <textarea
            aria-label={`${assetDisplayName(item)} 제작 요청문`}
            onChange={(event) =>
              setPromptDrafts((current) => ({
                ...current,
                [item.id]: event.target.value,
              }))
            }
            rows={4}
            value={draft}
          />
          <div className="asset-prompt-meta">
            {item.aspect_ratio ? <span>비율 {item.aspect_ratio}</span> : null}
            {item.duration_seconds ? <span>{item.duration_seconds}초</span> : null}
            {item.negative_prompt ? <span>제외 요청 있음</span> : null}
            {item.safety_notes ? <span>검수 메모 있음</span> : null}
          </div>
          <button
            className="text-button"
            disabled={!draft.trim() || !promptChanged || Boolean(loadingId)}
            onClick={() => saveAssetPrompt(item.id)}
            type="button"
          >
            {loadingId === `prompt:${item.id}` ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />}
            요청문 저장
          </button>
        </div>
      </details>
    );
  };

  const assetInfo = (item: AssetGenerationStateItem) => (
    <div className="asset-row-info">
      <span className={`asset-thumb ${item.kind}`} aria-hidden="true">
        {item.kind === "video" ? (
          <Video size={18} />
        ) : item.kind === "voice" ? (
          <Mic2 size={18} />
        ) : item.kind === "image" || item.kind === "thumbnail" ? (
          <ImageIcon size={18} />
        ) : (
          <FilePlus2 size={18} />
        )}
      </span>
      <div className="asset-row-copy">
        <strong className={`asset-kind-label ${item.kind}`} title={assetDebugTitle(item)}>
          {assetDisplayName(item)}
        </strong>
        <small>{statusDetail(item)}</small>
        {promptEditor(item)}
      </div>
    </div>
  );

  const manualSelectButton = (item: AssetGenerationStateItem) => (
    <button
      className="text-button primary"
      disabled={Boolean(loadingId)}
      onClick={() => selectForManualRegistration(item.id)}
      type="button"
    >
      <FilePlus2 size={15} />
      등록 선택
    </button>
  );

  const skipButton = (item: AssetGenerationStateItem) => (
    <button
      className="text-button quiet"
      disabled={Boolean(loadingId)}
      onClick={() => updateAssetStatus(item.id, "skip")}
      type="button"
    >
      {loadingId === `skip:${item.id}` ? <Loader2 className="spin" size={15} /> : <Ban size={15} />}
      건너뛰기
    </button>
  );

  const retryButton = (item: AssetGenerationStateItem) => (
    <button
      className="text-button"
      disabled={Boolean(loadingId)}
      onClick={() => updateAssetStatus(item.id, "retry")}
      type="button"
    >
      {loadingId === `retry:${item.id}` ? <Loader2 className="spin" size={15} /> : <RotateCcw size={15} />}
      다시 열기
    </button>
  );

  const directGenerateButton = (item: AssetGenerationStateItem) => {
    const blocker = generationBlockerForItem(item);
    return (
      <button
        className="text-button primary"
        disabled={item.status !== "pending_generation" || Boolean(loadingId) || Boolean(blocker)}
        onClick={() => runDirectGeneration(item)}
        title={blocker || undefined}
        type="button"
      >
        {directActionIcon(item)}
        {directActionLabel(item)}
      </button>
    );
  };

  return (
    <div className="asset-console">
      <div className="asset-console-summary expanded">
        <span>
          <small>전체</small>
          <strong>{summary.total}</strong>
        </span>
        <span>
          <small>바로 만들기</small>
          <strong>{summary.ready}</strong>
        </span>
        <span>
          <small>완료</small>
          <strong>{summary.generated}</strong>
        </span>
        <span>
          <small>검토 및 승인 대기</small>
          <strong>{summary.blocked}</strong>
        </span>
        <span>
          <small>실패</small>
          <strong>{summary.failed}</strong>
        </span>
        <span>
          <small>건너뜀</small>
          <strong>{summary.skipped}</strong>
        </span>
      </div>

      {!state.manifestExists ? <p className="form-error">필요한 미디어 목록이 아직 없습니다.</p> : null}

      {state.items.length === 0 ? (
        <p className="asset-console-empty">아직 만들 항목이 없습니다. 먼저 에셋 생성 요청서를 만들어 주세요.</p>
      ) : null}

      {readyDirectItems.length > 0 ? (
        <section className="asset-work-section primary">
          <div className="asset-action-section-title">
            <div>
              <strong>바로 만들 수 있는 항목</strong>
              <span>
                이미지 {imageItems.filter((item) => item.status === "pending_generation").length}개 · 영상{" "}
                {videoItems.filter((item) => item.status === "pending_generation").length}개 · 음성{" "}
                {voiceItems.filter((item) => item.status === "pending_generation").length}개
              </span>
            </div>
          </div>
          <div className="asset-action-list">
            {readyDirectItems.map((item) => {
              const blocker = generationBlockerForItem(item);
              return (
                <div className={assetRowClassName(item)} key={item.id}>
                  {assetInfo(item)}
                  <AssetStatus isApproved={isApprovedForManualFlow(item)} item={item} />
                  <div className="asset-row-actions">
                    {blocker ? <p className="asset-action-note compact">{blocker}</p> : directGenerateButton(item)}
                    {manualSelectButton(item)}
                    {skipButton(item)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="asset-work-section manual" id="manual-asset-register">
        <div className="asset-action-section-title">
          <div>
            <strong>직접 제작한 에셋 업로드</strong>
            <span>직접 만든 이미지, 영상, 음성, 자막, BGM을 등록합니다.</span>
          </div>
        </div>
        <div className="asset-register">
          <label>
            <span>미디어</span>
            <select value={registerAssetId} onChange={(event) => setRegisterAssetId(event.target.value)}>
              {manualRegisterItems.length === 0 ? <option value="">등록할 항목 없음</option> : null}
              {manualRegisterItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {assetDisplayName(item)} · {assetStatusLabel(item.status, isApprovedForManualFlow(item))}
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
            className="text-button primary"
            disabled={manualRegisterItems.length === 0 || !registerAssetId || !registerPath.trim() || Boolean(loadingId)}
            onClick={registerAsset}
            type="button"
          >
            {loadingId === "manual-register" ? <Loader2 className="spin" size={15} /> : <FilePlus2 size={15} />}
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
          수동 업로드 파일 반영
        </button>
      </section>

      {failedItems.length > 0 ? (
        <section className="asset-work-section failed">
          <div className="asset-action-section-title">
            <div>
              <strong>실패 재시도</strong>
              <span>다시 열면 비용 없이 바로 만들기 목록으로 돌아갑니다.</span>
            </div>
          </div>
          <div className="asset-action-list">
            {failedItems.map((item) => (
              <div className={assetRowClassName(item)} key={item.id}>
                {assetInfo(item)}
                <AssetStatus isApproved={isApprovedForManualFlow(item)} item={item} />
                <div className="asset-row-actions">
                  {retryButton(item)}
                  {manualSelectButton(item)}
                  {skipButton(item)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {blockedItems.length > 0 ? (
        <section className="asset-work-section blocked">
          <div className="asset-action-section-title">
            <div>
              <strong>검토 및 승인 대기</strong>
              <span>승인, API 설정, 요청서 문제가 풀리면 만들 수 있습니다.</span>
            </div>
          </div>
          <div className="asset-action-list">
            {blockedItems.map((item) => (
              <div className={assetRowClassName(item)} key={item.id}>
                {assetInfo(item)}
                <AssetStatus isApproved={isApprovedForManualFlow(item)} item={item} />
                <div className="asset-row-actions">
                  {manualSelectButton(item)}
                  {skipButton(item)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {readyManualItems.length > 0 ? (
        <section className="asset-work-section manual-only">
          <div className="asset-action-section-title">
            <div>
              <strong>수동으로 넣을 항목</strong>
              <span>자막과 BGM처럼 직접 생성 버튼이 없는 항목입니다.</span>
            </div>
          </div>
          <div className="asset-action-list">
            {readyManualItems.map((item) => (
              <div className={assetRowClassName(item)} key={item.id}>
                {assetInfo(item)}
                <AssetStatus isApproved={isApprovedForManualFlow(item)} item={item} />
                <div className="asset-row-actions">
                  {manualSelectButton(item)}
                  {skipButton(item)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {generatedItems.length > 0 || skippedItems.length > 0 ? (
        <details className="asset-console-worklist">
          <summary>
            <span>완료/건너뜀 보기</span>
            <small>
              완료 {generatedItems.length}개 · 건너뜀 {skippedItems.length}개
            </small>
          </summary>
          <div className="asset-console-worklist-body">
            {[...generatedItems, ...skippedItems].map((item) => (
              <div className={assetRowClassName(item, "compact")} key={item.id}>
                {assetInfo(item)}
                <AssetStatus isApproved={isApprovedForManualFlow(item)} item={item} />
                <div className="asset-row-actions">
                  {item.status === "skipped" ? retryButton(item) : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <details className="asset-console-settings">
        <summary>
          <span>생성 설정</span>
          <small>도구, 이미지 품질, 목소리를 바꿀 때만 엽니다.</small>
        </summary>
        <div className="asset-console-settings-body">
          <div className="generation-provider-selector">
            <div className="generation-provider-selector-head">
              <div>
                <strong>제작 방식</strong>
                <span>이미지, 영상, 음성을 만들 도구를 고릅니다.</span>
              </div>
              <a className="text-button" href="/settings">
                설정 열기
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
                        ? `${selectedOption.hasApiKey ? "키 저장됨" : "키 필요"} · ${selectedOption.capability.label}`
                        : "설정에서 사용할 도구를 등록하세요."}
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
        </div>
      </details>

      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
