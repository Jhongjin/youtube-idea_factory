"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Save } from "lucide-react";
import type { RunArtifact } from "@/lib/artifacts";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ArtifactWorkspace({
  runId,
  artifacts,
  description = "현재 단계에서 필요한 결과를 먼저 확인합니다.",
  focusArtifactIds = [],
  title = "결과",
}: {
  runId: string;
  artifacts: RunArtifact[];
  description?: string;
  focusArtifactIds?: string[];
  title?: string;
}) {
  const focusedArtifacts = useMemo(() => {
    const focusSet = new Set(focusArtifactIds);
    return artifacts.filter((artifact) => focusSet.has(artifact.id));
  }, [artifacts, focusArtifactIds]);
  const focusKey = focusArtifactIds.join("|");
  const hasFocusFilter = focusedArtifacts.length > 0 && focusedArtifacts.length < artifacts.length;
  const defaultArtifactId = focusedArtifacts[0]?.id ?? artifacts[0]?.id ?? "";
  const [activeId, setActiveId] = useState(defaultArtifactId);
  const [showAllArtifacts, setShowAllArtifacts] = useState(!hasFocusFilter);
  const [contents, setContents] = useState(() =>
    Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact.content])),
  );
  const [savedContents, setSavedContents] = useState(() =>
    Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact.content])),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    function selectArtifactFromHash() {
      const artifactId = window.location.hash.replace(/^#artifact-/, "");
      if (!artifactId || artifactId === window.location.hash) {
        return;
      }
      const hashArtifact = artifacts.find((artifact) => artifact.id === artifactId);
      if (!hashArtifact) {
        return;
      }
      const hashBelongsToCurrentStep =
        !hasFocusFilter || focusedArtifacts.some((artifact) => artifact.id === artifactId);
      if (!hashBelongsToCurrentStep) {
        setActiveId(defaultArtifactId);
        setShowAllArtifacts(!hasFocusFilter);
        setSaveState("idle");
        setError("");
        return;
      }
      setActiveId(hashArtifact.id);
      setSaveState("idle");
      setError("");
    }

    selectArtifactFromHash();
    window.addEventListener("hashchange", selectArtifactFromHash);
    return () => window.removeEventListener("hashchange", selectArtifactFromHash);
  }, [artifacts, defaultArtifactId, focusedArtifacts, hasFocusFilter]);

  useEffect(() => {
    setShowAllArtifacts(!hasFocusFilter);
  }, [focusKey, hasFocusFilter]);

  useEffect(() => {
    if (!artifacts.some((artifact) => artifact.id === activeId)) {
      setActiveId(defaultArtifactId);
      return;
    }
    if (
      hasFocusFilter &&
      !showAllArtifacts &&
      !focusedArtifacts.some((artifact) => artifact.id === activeId)
    ) {
      setActiveId(defaultArtifactId);
    }
  }, [activeId, artifacts, defaultArtifactId, focusedArtifacts, hasFocusFilter, showAllArtifacts]);

  const activeArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === activeId) ?? artifacts[0],
    [activeId, artifacts],
  );
  const visibleArtifacts = showAllArtifacts || !hasFocusFilter ? artifacts : focusedArtifacts;

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
    <section className="panel artifact-workspace" id="artifact-workspace">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">{title}</h3>
          <p className="panel-subtitle">{description}</p>
        </div>
        <span className="artifact-read-mode">검토 우선</span>
      </div>

      <div className="artifact-layout">
        <div className="artifact-tabs" role="tablist" aria-label="실행 결과">
          <div className="artifact-tabs-heading">
            <span>{showAllArtifacts || !hasFocusFilter ? "전체 결과" : "이번 단계"}</span>
            <strong>
              {visibleArtifacts.length}/{artifacts.length}
            </strong>
          </div>
          {visibleArtifacts.map((artifact) => (
            <button
              aria-selected={artifact.id === activeArtifact.id}
              className={`artifact-tab ${artifact.id === activeArtifact.id ? "active" : ""}`}
              id={`artifact-${artifact.id}`}
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
          {hasFocusFilter ? (
            <button
              className="artifact-view-toggle"
              onClick={() => {
                const nextShowAll = !showAllArtifacts;
                setShowAllArtifacts(nextShowAll);
                if (!nextShowAll && !focusedArtifacts.some((artifact) => artifact.id === activeId)) {
                  setActiveId(defaultArtifactId);
                }
              }}
              type="button"
            >
              {showAllArtifacts ? "이번 단계만 보기" : "전체 결과 보기"}
            </button>
          ) : null}
        </div>

        <div className="artifact-editor">
          <div className="artifact-meta">
            <span>{activeArtifact.label}</span>
            <span>{activeArtifact.filename}</span>
            <span>{activeArtifact.skill}</span>
            <span>{activeArtifact.size.toLocaleString()}바이트</span>
          </div>
          <p className="artifact-description">{activeArtifact.description}</p>
          <article className="artifact-review-card">
            <div>
              <span>미리보기</span>
              <strong>{activeArtifact.label}</strong>
            </div>
            <pre>{activeContent.trim() || "아직 저장된 내용이 없습니다."}</pre>
          </article>
          <details className="artifact-edit-disclosure">
            <summary>
              <span>내용 편집</span>
              <strong>{isDirty ? "변경 있음" : "변경 없음"}</strong>
            </summary>
            <div className="artifact-edit-body">
              <textarea
                aria-label={`${activeArtifact.label} 내용`}
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
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
