"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  FileText,
  FilterX,
  Loader2,
  RotateCcw,
  Scissors,
  Square,
} from "lucide-react";
import { SourceDeleteButton } from "@/app/components/source-delete-button";
import { decodeHtmlEntities } from "@/lib/html-text";
import type { SourceVideo } from "@/lib/runs";
import { getTranscriptStatusView, hasUsableTranscript } from "@/lib/transcript-status-copy";

type SourceAction = "dedupe" | "exclude" | "include" | "keep";
type TranscriptMode = "native" | "auto";

const fetchTranscriptConfirmToken = "FETCH_TRANSCRIPT";

function sourceKey(source: SourceVideo) {
  if (source.video_id) {
    return source.video_id;
  }
  if (typeof source.rank === "number") {
    return `source-${source.rank}`;
  }
  return source.url;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "게시일 미확인";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("ko", { notation: "compact" }).format(number) : "미확인";
}

function formatDuration(seconds: number | undefined) {
  if (!seconds) {
    return "길이 미확인";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function sourceFormat(source: SourceVideo) {
  const seconds = Number(source.duration_seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "형식 미확인";
  }
  if (seconds <= 75) {
    return "쇼츠";
  }
  if (seconds >= 240) {
    return "롱폼";
  }
  return "중간 길이";
}

function sourceReason(source: SourceVideo) {
  const reason = source.inclusion_reason?.trim();
  if (!reason) {
    return "소스 검토 단계에서 추가한 영상입니다.";
  }
  if (reason.startsWith("Selected from YouTube category intake")) {
    return "최근성, 조회수, 영상 길이, 채널 다양성을 기준으로 고른 후보입니다.";
  }
  if (reason.startsWith("Selected from YouTube topic intake")) {
    return "입력한 아이디어와 최근 성과를 함께 보고 고른 후보입니다.";
  }
  if (reason.startsWith("Added manually")) {
    return "수동으로 추가한 소스입니다.";
  }
  return reason;
}

function sourceScopeCopy(value: string | undefined) {
  if (!value) {
    return "";
  }
  return value.replace("category keyword fallback", "카테고리 키워드 보강");
}

export function SourceReviewQueue({
  language = "ko",
  runId,
  sources,
}: {
  language?: string;
  runId: string;
  sources: SourceVideo[];
}) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [batchSummary, setBatchSummary] = useState("");
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("native");
  const selectedCount = selectedKeys.size;
  const selectedList = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
  const includedCount = sources.filter((source) => !source.analysis_excluded).length;
  const transcriptReadyCount = sources.filter((source) => hasUsableTranscript(source.transcript_status)).length;
  const missingCount = sources.filter((source) => source.transcript_status === "missing").length;
  const excludedCount = sources.length - includedCount;
  const needsTranscriptCount = sources.filter((source) => !hasUsableTranscript(source.transcript_status)).length;

  function toggleSource(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedKeys(new Set(sources.map(sourceKey)));
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  function redirectWithNotice(notice: string) {
    const params = new URLSearchParams({
      notice,
      run: runId,
      step: "research",
    });
    window.location.href = `/dashboard?${params.toString()}#sources-panel`;
  }

  async function updateSources(action: SourceAction, sourceKeys: string[], notice: string, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setLoadingAction(action);
    setError("");
    setBatchSummary("");
    const response = await fetch(`/api/runs/${runId}/sources`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sourceKeys }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "소스 작업에 실패했습니다.");
      setLoadingAction("");
      return;
    }

    redirectWithNotice(notice);
  }

  async function batchFetchTranscripts(failedOnly = false) {
    const sourceKeys = selectedCount > 0 ? selectedList : [];
    if (failedOnly && missingCount === 0 && selectedCount === 0) {
      setError("재시도할 실패 소스가 없습니다.");
      return;
    }
    const confirmation = window.prompt(
      `${fetchTranscriptConfirmToken}를 입력하면 ${selectedCount > 0 ? `선택한 ${selectedCount}개` : failedOnly ? "실패한 소스" : "자막이 없는 전체 소스"}의 자막을 순차 수집합니다.${transcriptMode === "auto" ? " 자동 방식은 공개 자막이 없으면 생성 비용이 발생할 수 있습니다." : " 공개 자막만 사용합니다."}`,
    );
    if (confirmation === null) {
      return;
    }
    if (confirmation !== fetchTranscriptConfirmToken) {
      setError(`배치 자막 가져오기에는 ${fetchTranscriptConfirmToken}가 필요합니다.`);
      return;
    }

    setLoadingAction(failedOnly ? "batch-failed" : "batch");
    setError("");
    setBatchSummary("");
    const response = await fetch(`/api/runs/${runId}/transcripts/batch-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmFetch: fetchTranscriptConfirmToken,
        failedOnly,
        language,
        mode: transcriptMode,
        sourceKeys,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "배치 자막 가져오기에 실패했습니다.");
      setLoadingAction("");
      return;
    }

    const body = (await response.json()) as {
      result?: { failed: number; fetched: number; skipped: number; total: number };
    };
    const result = body.result;
    setBatchSummary(
      result
        ? `자막 수집 완료: 성공 ${result.fetched}개, 실패 ${result.failed}개, 건너뜀 ${result.skipped}개`
        : "자막 수집이 완료되었습니다.",
    );
    redirectWithNotice(result?.failed ? "transcripts-batch-partial" : "transcripts-batch-fetched");
  }

  async function fetchTranscript(source: SourceVideo) {
    const key = sourceKey(source);
    const confirmation = window.prompt(
      `${fetchTranscriptConfirmToken}를 입력하면 이 소스의 공개 자막을 가져옵니다. 공개 자막만 사용하므로 생성 비용은 발생하지 않습니다.`,
    );
    if (confirmation === null) {
      return;
    }
    if (confirmation !== fetchTranscriptConfirmToken) {
      setError(`자막 가져오기에는 ${fetchTranscriptConfirmToken}가 필요합니다.`);
      return;
    }

    setLoadingAction(`transcript:${key}`);
    setError("");
    setBatchSummary("");
    const response = await fetch(`/api/runs/${runId}/transcripts/${key}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmFetch: fetchTranscriptConfirmToken,
        language,
        mode: "native",
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "자막 가져오기에 실패했습니다.");
      setLoadingAction("");
      return;
    }

    redirectWithNotice("transcript-fetched");
  }

  return (
    <section className="source-queue" aria-label="소스 영상 검토 큐">
      <div className="source-queue-toolbar">
        <div>
          <span>소스 {sources.length}</span>
          <span>분석 {includedCount}</span>
          <span>자막 확보 {transcriptReadyCount}</span>
          <span>자막 검토 {needsTranscriptCount}</span>
          <span>실패 {missingCount}</span>
          <span>분석 제외 {excludedCount}</span>
          <span>선택 {selectedCount}</span>
        </div>
        <div className="source-queue-actions">
          <label className="source-batch-mode">
            <span>방식</span>
            <select
              onChange={(event) => setTranscriptMode(event.target.value === "auto" ? "auto" : "native")}
              value={transcriptMode}
            >
              <option value="native">공개 자막만</option>
              <option value="auto">공개 자막 없으면 생성</option>
            </select>
          </label>
          <button
            className="text-button primary"
            disabled={loadingAction === "batch" || needsTranscriptCount === 0}
            onClick={() => batchFetchTranscripts(false)}
            type="button"
          >
            {loadingAction === "batch" ? <Loader2 className="spin" size={15} /> : <FileText size={15} />}
            {selectedCount > 0 ? "선택 자막 가져오기" : "전체 자막 가져오기"}
          </button>
          <button className="text-button" onClick={selectedCount === sources.length ? clearSelection : selectAll} type="button">
            {selectedCount === sources.length ? <Square size={15} /> : <CheckSquare size={15} />}
            {selectedCount === sources.length ? "선택 해제" : "전체 선택"}
          </button>
          <details className="source-queue-more-actions">
            <summary>추가 작업</summary>
            <div>
              <button
                className="text-button"
                disabled={loadingAction === "batch-failed" || (missingCount === 0 && selectedCount === 0)}
                onClick={() => batchFetchTranscripts(true)}
                type="button"
              >
                {loadingAction === "batch-failed" ? <Loader2 className="spin" size={15} /> : <RotateCcw size={15} />}
                실패한 자막만 다시 가져오기
              </button>
              <button
                className="text-button"
                disabled={loadingAction === "dedupe"}
                onClick={() => updateSources("dedupe", [], "sources-deduped")}
                type="button"
              >
                {loadingAction === "dedupe" ? <Loader2 className="spin" size={15} /> : <Scissors size={15} />}
                중복 제거
              </button>
              <button
                className="text-button"
                disabled={selectedCount === 0 || loadingAction === "keep"}
                onClick={() =>
                  updateSources(
                    "keep",
                    selectedList,
                    "sources-kept",
                    `선택한 ${selectedCount}개 소스만 유지하고 나머지는 삭제할까요?`,
                  )
                }
                type="button"
              >
                {loadingAction === "keep" ? <Loader2 className="spin" size={15} /> : <FilterX size={15} />}
                선택한 소스만 남기기
              </button>
              <button
                className="text-button"
                disabled={selectedCount === 0 || loadingAction === "exclude"}
                onClick={() => updateSources("exclude", selectedList, "sources-excluded")}
                type="button"
              >
                {loadingAction === "exclude" ? <Loader2 className="spin" size={15} /> : <RotateCcw size={15} />}
                선택 소스 분석 제외
              </button>
            </div>
          </details>
        </div>
      </div>

      {error ? (
        <div className="finder-error">
          <FilterX size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {batchSummary ? <div className="source-search-summary"><strong>자막 배치</strong><span>{batchSummary}</span></div> : null}

      <div className="source-card-list">
        {sources.map((source, index) => {
          const key = sourceKey(source);
          const selected = selectedKeys.has(key);
          const transcriptStatus = getTranscriptStatusView(source);
          const publishedDate = formatDate(source.published_at);
          const formatLabel = sourceFormat(source);
          const durationLabel = formatDuration(source.duration_seconds);
          const fetchLabel = hasUsableTranscript(source.transcript_status) ? "자막 다시 가져오기" : "자막 가져오기";
          return (
            <article className={`source-review-item ${source.analysis_excluded ? "excluded" : ""}`} key={`${key}-${index}`}>
              <div className="source-review-select">
                <button
                  aria-pressed={selected}
                  className={selected ? "active" : ""}
                  onClick={() => toggleSource(key)}
                  type="button"
                >
                  {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                  <span>{source.rank ?? index + 1}</span>
                </button>
              </div>
              <div className="source-review-main">
                <div className="source-review-title-row">
                  <div>
                    <h4>{decodeHtmlEntities(source.title)}</h4>
                    <a href={source.url}>YouTube에서 열기</a>
                  </div>
                  {source.analysis_excluded ? <span className="source-status excluded">분석 제외</span> : null}
                </div>
                <div className="source-review-facts">
                  <span>채널 {source.channel || "미확인"}</span>
                  <span>조회수 {formatNumber(source.view_count)}</span>
                  <span className={`transcript-state ${transcriptStatus.tone}`}>자막 {transcriptStatus.label}</span>
                </div>
                <details className="source-review-reason">
                  <summary>세부 정보</summary>
                  <p>{sourceReason(source)}</p>
                  <div className="source-review-search-note">
                    <span>{transcriptStatus.detail}</span>
                    <span>게시일 {publishedDate}</span>
                    <span>형식 {formatLabel}</span>
                    <span>길이 {durationLabel}</span>
                    {source.search_query ? <span>검색어 {source.search_query}</span> : null}
                    {source.search_scope ? <span>{sourceScopeCopy(source.search_scope)}</span> : null}
                  </div>
                </details>
              </div>
              <div className="source-review-actions-inline">
                <button
                  className="text-button"
                  disabled={loadingAction === `transcript:${key}`}
                  onClick={() => fetchTranscript(source)}
                  type="button"
                >
                  {loadingAction === `transcript:${key}` ? <Loader2 className="spin" size={14} /> : <FileText size={14} />}
                  {fetchLabel}
                </button>
                <details className="source-review-card-more">
                  <summary>더 보기</summary>
                  <div>
                    <button
                      className="text-button"
                      disabled={loadingAction === "exclude" || loadingAction === "include"}
                      onClick={() =>
                        updateSources(
                          source.analysis_excluded ? "include" : "exclude",
                          [key],
                          source.analysis_excluded ? "sources-included" : "sources-excluded",
                        )
                      }
                      type="button"
                    >
                      {source.analysis_excluded ? "분석에 포함" : "분석에서 제외"}
                    </button>
                    <SourceDeleteButton label="삭제" mode="single" runId={runId} sourceKey={key} />
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
