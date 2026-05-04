"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Mic2,
} from "lucide-react";
import type { AssetGenerationState, AssetGenerationStateItem } from "@/lib/asset-generation-state";

const imageConfirmToken = "GENERATE_IMAGE";
const ttsConfirmToken = "GENERATE_TTS";

function compactPath(value: string) {
  return value.replace(/^artifacts\//, "");
}

function AssetStatus({ item }: { item: AssetGenerationStateItem }) {
  const ready = item.status === "pending_generation" || item.status === "generated";
  return (
    <span className={`asset-status ${ready ? "ready" : "blocked"}`}>
      {ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {item.status}
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

  async function generateImage(assetId: string) {
    setMessage("");
    const confirmation = window.prompt(`Type ${imageConfirmToken} to generate this image.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== imageConfirmToken) {
      setMessage(`Image generation requires ${imageConfirmToken}.`);
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
      setMessage(body?.error ?? "Image generation failed.");
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
      setMessage(body?.error ?? "Asset registration failed.");
      setLoadingId("");
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  async function generateVoice(assetId: string) {
    setMessage("");
    const confirmation = window.prompt(`Type ${ttsConfirmToken} to generate voice.`);
    if (confirmation === null) {
      return;
    }
    if (confirmation !== ttsConfirmToken) {
      setMessage(`Voice generation requires ${ttsConfirmToken}.`);
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
      setMessage(body?.error ?? "Voice generation failed.");
      setLoadingId("");
      return;
    }
    window.location.href = `/?run=${encodeURIComponent(runId)}`;
  }

  const imageItems = state.items.filter((item) => item.kind === "image" || item.kind === "thumbnail");
  const voiceItem = state.items.find((item) => item.kind === "voice");

  return (
    <div className="asset-console">
      <div className="asset-console-summary">
        <span>{state.summary?.ready ?? 0} ready</span>
        <span>{state.summary?.generated ?? 0} generated</span>
        <span>{state.summary?.blocked ?? 0} blocked</span>
      </div>

      <div className="asset-control-grid">
        <label>
          <span>Image quality</span>
          <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="auto">auto</option>
          </select>
        </label>
        <label>
          <span>Voice</span>
          <input value={voice} onChange={(event) => setVoice(event.target.value)} />
        </label>
      </div>

      <label className="asset-narration">
        <span>Narration</span>
        <textarea value={narration} onChange={(event) => setNarration(event.target.value)} rows={5} />
      </label>
      <label className="asset-narration">
        <span>Voice direction</span>
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
              Image
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
              Voice
            </button>
          </div>
        ) : null}
      </div>

      <div className="asset-register">
        <label>
          <span>Asset</span>
          <select value={registerAssetId} onChange={(event) => setRegisterAssetId(event.target.value)}>
            {state.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} / {item.kind}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>File path</span>
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
          Register
        </button>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {!state.manifestExists ? <p className="form-error">Asset manifest pending.</p> : null}
    </div>
  );
}
