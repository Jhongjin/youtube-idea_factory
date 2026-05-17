"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import type { SourceVideo } from "@/lib/runs";
import type { YouTubeCandidate } from "@/lib/youtube-finder";
import { sourceDedupKey } from "@/lib/youtube-url";

type LoadingMode = "idle" | "category" | "search" | "import" | "manual";

type SearchMeta = {
  duplicateCount: number;
  label: string;
  scope?: string;
  total: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko", { notation: "compact" }).format(value);
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "알 수 없음";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatDate(value: string) {
  if (!value) {
    return "게시일 알 수 없음";
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

function regionForLanguage(language: string) {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "JP";
  }
  if (normalized.startsWith("es")) {
    return "ES";
  }
  if (normalized.startsWith("en")) {
    return "US";
  }
  return "KR";
}

function publishedAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function videoDurationForFormat(format: string, targetSeconds: number) {
  if (format === "shorts") {
    return "short";
  }
  return targetSeconds > 1200 ? "long" : "medium";
}

function selectFormatMatches(candidates: YouTubeCandidate[], format: string, targetSeconds: number) {
  if (format === "shorts") {
    const shorts = candidates.filter((candidate) => candidate.durationSeconds > 0 && candidate.durationSeconds <= 75);
    return (shorts.length >= 5 ? shorts : candidates).slice(0, 10);
  }

  const target = Number.isFinite(targetSeconds) && targetSeconds > 0 ? targetSeconds : 480;
  const lower = Math.max(240, Math.floor(target * 0.5));
  const upper = Math.max(lower + 60, Math.ceil(target * 1.75));
  const durationMatches = candidates.filter(
    (candidate) => candidate.durationSeconds >= lower && candidate.durationSeconds <= upper,
  );
  const longform = durationMatches.length >= 5 ? durationMatches : candidates.filter((candidate) => candidate.durationSeconds >= 240);
  return (longform.length >= 5 ? longform : candidates).slice(0, 10);
}

function splitManualUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
}

export function YouTubeFinderPanel({
  channelId = "",
  defaultCategoryId = "",
  defaultCategoryTitle = "",
  defaultQuery,
  existingSources = [],
  format = "shorts",
  language = "ko",
  regionCode: regionCodeProp = "",
  runId,
  targetDurationSeconds = 60,
}: {
  channelId?: string;
  defaultCategoryId?: string;
  defaultCategoryTitle?: string;
  defaultQuery: string;
  existingSources?: SourceVideo[];
  format?: string;
  language?: string;
  regionCode?: string;
  runId: string;
  targetDurationSeconds?: number;
}) {
  const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("idle");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [manualUrls, setManualUrls] = useState("");
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const existingKeys = useMemo(
    () => new Set(existingSources.map((source) => sourceDedupKey(source))),
    [existingSources],
  );
  const loading = loadingMode !== "idle";
  const regionCode = regionCodeProp || regionForLanguage(language);
  const formatLabel = format === "longform" ? "롱폼" : "쇼츠";

  function applyCandidateResults(nextCandidates: YouTubeCandidate[], label: string) {
    const freshCandidates = nextCandidates.filter((candidate) => !existingKeys.has(sourceDedupKey(candidate)));
    const scope = nextCandidates.find((candidate) => candidate.searchScope)?.searchScope;
    setCandidates(freshCandidates);
    setSearchMeta({
      duplicateCount: Math.max(0, nextCandidates.length - freshCandidates.length),
      label,
      scope,
      total: nextCandidates.length,
    });
    setCopied(false);
  }

  async function runSearch(
    payload: Record<string, string | number | undefined>,
    label: string,
    mode: Extract<LoadingMode, "category" | "search">,
    filterByFormat = false,
  ) {
    setLoadingMode(mode);
    setError("");

    const response = await fetch("/api/youtube/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "유튜브 검색에 실패했습니다.");
      setCandidates([]);
      setSearchMeta(null);
      setLoadingMode("idle");
      return;
    }

    const body = (await response.json()) as { candidates: YouTubeCandidate[] };
    const sortedCandidates = body.candidates.slice().sort((a, b) => b.viewCount - a.viewCount);
    applyCandidateResults(
      filterByFormat ? selectFormatMatches(sortedCandidates, format, targetDurationSeconds) : sortedCandidates,
      label,
    );
    setLoadingMode("idle");
  }

  async function loadCategoryTop() {
    if (!defaultCategoryId) {
      setError("이 run에는 YouTube 카테고리가 없어 카테고리 후보를 더 가져올 수 없습니다.");
      return;
    }

    await runSearch(
      {
        categoryTitle: defaultCategoryTitle,
        maxResults: 25,
        minResults: 10,
        order: "viewCount",
        publishedAfter: publishedAfterDays(7),
        query: "",
        regionCode,
        relevanceLanguage: language,
        videoCategoryId: defaultCategoryId,
        videoDuration: videoDurationForFormat(format, targetDurationSeconds),
      },
      "카테고리 TOP 후보",
      "category",
      true,
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await runSearch(
      {
        maxResults: Number(formData.get("maxResults") ?? 10),
        minResults: 10,
        order: String(formData.get("order") ?? "viewCount"),
        query: String(formData.get("query") ?? ""),
        regionCode: String(formData.get("regionCode") ?? ""),
        relevanceLanguage: String(formData.get("relevanceLanguage") ?? ""),
        videoDuration: String(formData.get("videoDuration") ?? "any"),
      },
      "유사 영상 검색",
      "search",
    );
  }

  function redirectAfterImport(notice: string) {
    const nextParams = new URLSearchParams({
      notice,
      run: runId,
      step: "research",
    });
    if (channelId) {
      nextParams.set("channel", channelId);
    }
    window.location.href = `/dashboard?${nextParams.toString()}#sources-panel`;
  }

  async function copyUrls() {
    const urls = candidates.map((candidate) => candidate.url).join("\n");
    await navigator.clipboard.writeText(urls);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function importCandidates() {
    if (candidates.length === 0) {
      setError("가져올 새 후보가 없습니다.");
      return;
    }

    setLoadingMode("import");
    setError("");
    const response = await fetch(`/api/runs/${runId}/sources/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates, mode: "append" }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "소스 가져오기에 실패했습니다.");
      setLoadingMode("idle");
      return;
    }

    redirectAfterImport("sources-imported");
  }

  async function importManualUrls() {
    const seedUrls = splitManualUrls(manualUrls);
    if (seedUrls.length === 0) {
      setError("추가할 YouTube URL을 한 줄에 하나씩 입력하세요.");
      return;
    }

    setLoadingMode("manual");
    setError("");
    const response = await fetch(`/api/runs/${runId}/sources/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "append", seedUrls }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "수동 URL 추가에 실패했습니다.");
      setLoadingMode("idle");
      return;
    }

    redirectAfterImport("sources-manual-imported");
  }

  return (
    <section className="panel finder-panel source-review-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">소스 찾기와 추가</h3>
          <p className="panel-subtitle">누르는 버튼마다 run의 소스 영상 목록에 들어갈 후보가 만들어집니다.</p>
        </div>
        {candidates.length > 0 ? (
          <div className="toolbar">
            <button className="text-button" onClick={copyUrls} type="button">
              <Copy size={15} />
              {copied ? "복사됨" : "URL 복사"}
            </button>
            <button className="text-button primary" disabled={loading} onClick={importCandidates} type="button">
              {loadingMode === "import" ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
              후보 {candidates.length}개 추가
            </button>
          </div>
        ) : null}
      </div>
      <div className="panel-body">
        <div className="source-review-actions">
          <section className="source-review-card primary">
            <div className="source-review-card-heading">
              <RefreshCw size={16} />
              <div>
                <h4>카테고리 TOP 후보 더 가져오기</h4>
                <p>1단계와 같은 기준으로 최근 7일 후보를 다시 찾고, 이미 있는 소스는 제외합니다.</p>
              </div>
            </div>
            <div className="source-review-meta">
              <span>{defaultCategoryId ? defaultCategoryTitle || defaultCategoryId : "카테고리 ID 없음"}</span>
              <span>{regionCode} / {formatLabel}</span>
            </div>
            <button className="text-button primary" disabled={loading || !defaultCategoryId} onClick={loadCategoryTop} type="button">
              {loadingMode === "category" ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
              카테고리 후보 찾기
            </button>
          </section>

          <section className="source-review-card search-card">
            <div className="source-review-card-heading">
              <Search size={16} />
              <div>
                <h4>유사 영상 검색</h4>
                <p>주제나 키워드를 바꿔 관련 영상을 찾습니다. 결과는 확인 후 소스로 추가됩니다.</p>
              </div>
            </div>
            <form className="finder-form" onSubmit={onSubmit}>
              <label className="finder-query">
                <span>검색어</span>
                <input name="query" defaultValue={defaultQuery} required />
              </label>
              <label>
                <span>정렬</span>
                <select name="order" defaultValue="viewCount">
                  <option value="viewCount">조회수</option>
                  <option value="relevance">관련도</option>
                  <option value="date">최신순</option>
                  <option value="rating">평점</option>
                </select>
              </label>
              <label>
                <span>결과 수</span>
                <input name="maxResults" type="number" min={1} max={25} defaultValue={10} />
              </label>
              <label>
                <span>지역</span>
                <input name="regionCode" defaultValue={regionCode} maxLength={2} />
              </label>
              <label>
                <span>언어</span>
                <input name="relevanceLanguage" defaultValue={language} maxLength={8} />
              </label>
              <label>
                <span>길이</span>
                <select name="videoDuration" defaultValue="any">
                  <option value="any">전체</option>
                  <option value="short">짧은 영상</option>
                  <option value="medium">중간 길이</option>
                  <option value="long">긴 영상</option>
                </select>
              </label>
              <button className="text-button primary" disabled={loading} type="submit">
                {loadingMode === "search" ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
                유사 영상 찾기
              </button>
            </form>
          </section>

          <section className="source-review-card manual-card">
            <div className="source-review-card-heading">
              <Plus size={16} />
              <div>
                <h4>수동 URL 추가</h4>
                <p>이미 정해둔 영상은 검색 없이 바로 소스 목록에 붙입니다.</p>
              </div>
            </div>
            <label className="manual-source-field">
              <span>YouTube URL</span>
              <textarea
                onChange={(event) => setManualUrls(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                rows={4}
                value={manualUrls}
              />
            </label>
            <button className="text-button" disabled={loadingMode === "manual"} onClick={importManualUrls} type="button">
              {loadingMode === "manual" ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
              URL을 소스로 추가
            </button>
          </section>
        </div>

        {error ? (
          <div className="finder-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {searchMeta ? (
          <div className="source-search-summary">
            <strong>{searchMeta.label}</strong>
            <span>
              검색 {searchMeta.total}개 중 새 후보 {candidates.length}개
              {searchMeta.duplicateCount > 0 ? `, 중복 ${searchMeta.duplicateCount}개 제외` : ""}
              {searchMeta.scope ? ` / ${searchMeta.scope}` : ""}
            </span>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="finder-results">
            {candidates.map((candidate, index) => (
              <article className="finder-result" key={candidate.videoId}>
                <div className="finder-rank">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h4>{candidate.title}</h4>
                  <p>
                    {candidate.channel} / {formatDate(candidate.publishedAt)}
                  </p>
                  <a href={candidate.url}>{candidate.url}</a>
                </div>
                <div className="finder-metrics">
                  <span>조회수 {formatNumber(candidate.viewCount)}</span>
                  <span>{formatDuration(candidate.durationSeconds)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : searchMeta ? (
          <div className="source-empty-hint">
            새로 추가할 후보가 없습니다. 검색어를 바꾸거나 수동 URL을 추가하세요.
          </div>
        ) : null}
      </div>
    </section>
  );
}
