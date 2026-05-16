"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Copy, Loader2, Plus, Search } from "lucide-react";
import type { YouTubeCandidate } from "@/lib/youtube-finder";

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

export function YouTubeFinderPanel({
  defaultQuery,
  runId,
}: {
  defaultQuery: string;
  runId: string;
}) {
  const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setCopied(false);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      query: String(formData.get("query") ?? ""),
      maxResults: Number(formData.get("maxResults") ?? 10),
      order: String(formData.get("order") ?? "viewCount"),
      regionCode: String(formData.get("regionCode") ?? ""),
      relevanceLanguage: String(formData.get("relevanceLanguage") ?? ""),
      videoDuration: String(formData.get("videoDuration") ?? "any"),
    };

    const response = await fetch("/api/youtube/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "유튜브 검색에 실패했습니다.");
      setCandidates([]);
      setLoading(false);
      return;
    }

    const body = (await response.json()) as { candidates: YouTubeCandidate[] };
    setCandidates(body.candidates);
    setLoading(false);
  }

  async function copyUrls() {
    const urls = candidates.map((candidate) => candidate.url).join("\n");
    await navigator.clipboard.writeText(urls);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function importCandidates() {
    setImporting(true);
    setError("");
    const response = await fetch(`/api/runs/${runId}/sources/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates, mode: "append" }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "소스 가져오기에 실패했습니다.");
      setImporting(false);
      return;
    }

    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=research#sources-panel`;
  }

  return (
    <section className="panel finder-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">유튜브 파인더</h3>
          <p className="panel-subtitle">YouTube Data API 어댑터로 후보 영상을 검색합니다.</p>
        </div>
        {candidates.length > 0 ? (
          <div className="toolbar">
            <button className="text-button" onClick={copyUrls} type="button">
              <Copy size={15} />
              {copied ? "복사됨" : "URL 복사"}
            </button>
            <button className="text-button primary" disabled={importing} onClick={importCandidates} type="button">
              {importing ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
              가져오기
            </button>
          </div>
        ) : null}
      </div>
      <div className="panel-body">
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
            <input name="regionCode" defaultValue="KR" maxLength={2} />
          </label>
          <label>
            <span>언어</span>
            <input name="relevanceLanguage" defaultValue="ko" maxLength={8} />
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
            {loading ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
            검색
          </button>
        </form>

        {error ? (
          <div className="finder-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="finder-results">
            {candidates.map((candidate, index) => (
              <article className="finder-result" key={candidate.videoId}>
                <div className="finder-rank">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h4>{candidate.title}</h4>
                  <p>{candidate.channel}</p>
                  <a href={candidate.url}>{candidate.url}</a>
                </div>
                <div className="finder-metrics">
                  <span>조회수 {formatNumber(candidate.viewCount)}</span>
                  <span>{formatDuration(candidate.durationSeconds)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
