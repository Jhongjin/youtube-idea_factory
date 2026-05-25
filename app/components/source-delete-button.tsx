"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

type DeleteMode = "all" | "single";

export function SourceDeleteButton({
  label,
  mode,
  runId,
  sourceKey = "",
}: {
  label: string;
  mode: DeleteMode;
  runId: string;
  sourceKey?: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function removeSource() {
    const confirmed = window.confirm(
      mode === "all"
      ? "이 제작 기록의 소스 영상을 모두 삭제할까요? 저장된 스크립트는 남지만 소스 목록에서는 제거됩니다."
        : "이 소스 영상을 목록에서 삭제할까요?",
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/sources`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "all" ? { all: true } : { sourceKey }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "소스 삭제에 실패했습니다.");
      setDeleting(false);
      return;
    }

    window.location.reload();
  }

  return (
    <span className="source-delete-control">
      <button className="text-button danger" disabled={deleting} onClick={removeSource} type="button">
        {deleting ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
        {label}
      </button>
      {error ? <small>{error}</small> : null}
    </span>
  );
}
