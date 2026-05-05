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
  runId,
  state,
}: {
  defaultNarration: string;
  runId: string;
  state: AssetGenerationState;
}) {
  const [quality, setQuality] = useState<"low" | "medium" | "high" | "auto">("low");
  const [voice, setVoice] = useState("alloy");
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
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  async function generateImage(assetId: string) {
    setMessage("");
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
      body: JSON.stringify({ assetId, confirmSpend: imageConfirmToken, quality }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "이미지 생성에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  async function generateVideo(assetId: string) {
    setMessage("");
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
      body: JSON.stringify({ assetId, confirmSpend: videoConfirmToken }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "영상 생성에 실패했습니다.");
      setLoadingId("");
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
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
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  async function generateVoice(assetId: string) {
    setMessage("");
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
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  const imageItems = state.items.filter((item) => item.kind === "image" || item.kind === "thumbnail");
  const videoItems = state.items.filter((item) => item.kind === "video");
  const voiceItem = state.items.find((item) => item.kind === "voice");

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
              disabled={item.status !== "pending_generation" || Boolean(loadingId)}
              onClick={() => generateImage(item.id)}
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
              disabled={item.status !== "pending_generation" || Boolean(loadingId)}
              onClick={() => generateVideo(item.id)}
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
              disabled={voiceItem.status !== "pending_generation" || Boolean(loadingId)}
              onClick={() => generateVoice(voiceItem.id)}
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
