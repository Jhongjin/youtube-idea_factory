"use client";

import { useMemo, useState } from "react";
import { Check, FileText, Save } from "lucide-react";
import type { RunArtifact } from "@/lib/artifacts";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ArtifactWorkspace({
  runId,
  artifacts,
}: {
  runId: string;
  artifacts: RunArtifact[];
}) {
  const [activeId, setActiveId] = useState(artifacts[0]?.id ?? "");
  const [contents, setContents] = useState(() =>
    Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact.content])),
  );
  const [savedContents, setSavedContents] = useState(() =>
    Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact.content])),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const activeArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === activeId) ?? artifacts[0],
    [activeId, artifacts],
  );

  if (!activeArtifact) {
    return null;
  }

  const activeContent = contents[activeArtifact.id] ?? "";
  const originalContent = savedContents[activeArtifact.id] ?? activeArtifact.content;
  const isDirty = activeContent !== originalContent;

  async function saveArtifact() {
    setSaveState("saving");
    setError("");

    const response = await fetch(`/api/runs/${runId}/artifacts/${activeArtifact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: activeContent }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "저장에 실패했습니다.");
      setSaveState("error");
      return;
    }

    const body = (await response.json()) as { artifact: RunArtifact };
    setContents((current) => ({
      ...current,
      [activeArtifact.id]: body.artifact.content,
    }));
    setSavedContents((current) => ({
      ...current,
      [activeArtifact.id]: body.artifact.content,
    }));
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1400);
  }

  return (
    <section className="panel artifact-workspace">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">작업 산출물 편집기</h3>
          <p className="panel-subtitle">{activeArtifact.description}</p>
        </div>
        <button
          className="text-button primary"
          disabled={!isDirty || saveState === "saving"}
          onClick={saveArtifact}
          type="button"
        >
          {saveState === "saved" ? <Check size={16} /> : <Save size={16} />}
          {saveState === "saving" ? "저장 중" : saveState === "saved" ? "저장됨" : "저장"}
        </button>
      </div>

      <div className="artifact-layout">
        <div className="artifact-tabs" role="tablist" aria-label="실행 산출물">
          {artifacts.map((artifact) => (
            <button
              aria-selected={artifact.id === activeArtifact.id}
              className={`artifact-tab ${artifact.id === activeArtifact.id ? "active" : ""}`}
              key={artifact.id}
              onClick={() => {
                setActiveId(artifact.id);
                setSaveState("idle");
                setError("");
              }}
              role="tab"
              type="button"
            >
              <FileText size={15} />
              <span>{artifact.label}</span>
            </button>
          ))}
        </div>

        <div className="artifact-editor">
          <div className="artifact-meta">
            <span>{activeArtifact.filename}</span>
            <span>{activeArtifact.skill}</span>
            <span>{activeArtifact.size.toLocaleString()}바이트</span>
          </div>
          <textarea
            aria-label={`${activeArtifact.label} 마크다운 내용`}
            value={activeContent}
            onChange={(event) =>
              setContents((current) => ({
                ...current,
                [activeArtifact.id]: event.target.value,
              }))
            }
          />
          <div className="artifact-footer">
            <span>{isDirty ? "저장되지 않은 변경 사항" : "로컬 변경 없음"}</span>
            {error ? <strong>{error}</strong> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
