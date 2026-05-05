"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Save } from "lucide-react";
import type { SourceVideo } from "@/lib/runs";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

function getSourceKey(source: SourceVideo) {
  return source.video_id || `source-${source.rank ?? 0}`;
}

const transcriptStatusCopy: Record<string, string> = {
  not_checked: "미확인",
  missing: "없음",
  manual_transcript: "수동 입력",
  available: "확보됨",
};

export function SourceTranscriptPanel({
  runId,
  sources,
}: {
  runId: string;
  sources: SourceVideo[];
}) {
  const [activeKey, setActiveKey] = useState(() => (sources[0] ? getSourceKey(sources[0]) : ""));
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const activeSource = useMemo(
    () => sources.find((source) => getSourceKey(source) === activeKey) ?? sources[0],
    [activeKey, sources],
  );

  useEffect(() => {
    if (!activeKey) {
      return;
    }
    let cancelled = false;
    setState("loading");
    setError("");
    fetch(`/api/runs/${runId}/transcripts/${activeKey}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("스크립트 불러오기에 실패했습니다.");
        }
        return (await response.json()) as { transcript: { content: string } };
      })
      .then((body) => {
        if (cancelled) {
          return;
        }
        setContent(body.transcript.content);
        setSavedContent(body.transcript.content);
        setState("idle");
      })
      .catch((loadError: Error) => {
        if (cancelled) {
          return;
        }
        setError(loadError.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeKey, runId]);

  if (!activeSource) {
    return null;
  }

  const isDirty = content !== savedContent;

  async function save() {
    setState("saving");
    setError("");
    const response = await fetch(`/api/runs/${runId}/transcripts/${activeKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "스크립트 저장에 실패했습니다.");
      setState("error");
      return;
    }

    const body = (await response.json()) as { transcript: { content: string } };
    setContent(body.transcript.content);
    setSavedContent(body.transcript.content);
    setState("saved");
    window.setTimeout(() => setState("idle"), 1200);
  }

  return (
    <section className="transcript-panel">
      <div className="transcript-header">
        <div>
          <h4>스크립트 슬롯</h4>
          <p>{activeSource.title}</p>
        </div>
        <button className="text-button" disabled={!isDirty || state === "saving"} onClick={save} type="button">
          {state === "saving" || state === "loading" ? (
            <Loader2 className="spin" size={15} />
          ) : state === "saved" ? (
            <Check size={15} />
          ) : (
            <Save size={15} />
          )}
          {state === "saved" ? "저장됨" : "저장"}
        </button>
      </div>

      <div className="transcript-layout">
        <div className="transcript-source-list">
          {sources.map((source) => {
            const key = getSourceKey(source);
            return (
              <button
                className={`transcript-source ${key === activeKey ? "active" : ""}`}
                key={key}
                onClick={() => setActiveKey(key)}
                type="button"
              >
                <FileText size={14} />
                <span>{source.title}</span>
                <small>
                  {transcriptStatusCopy[source.transcript_status ?? "not_checked"] ??
                    source.transcript_status ??
                    "미확인"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="transcript-editor">
          <textarea
            aria-label="수동 소스 스크립트"
            placeholder="이 소스 영상의 스크립트를 붙여넣거나 편집하세요."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="artifact-footer">
            <span>{isDirty ? "저장되지 않은 스크립트 변경" : "스크립트 변경 없음"}</span>
            {error ? <strong>{error}</strong> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
