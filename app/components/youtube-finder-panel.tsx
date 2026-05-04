"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Copy, Loader2, Search } from "lucide-react";
import type { YouTubeCandidate } from "@/lib/youtube-finder";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "unknown";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function YouTubeFinderPanel({ defaultQuery }: { defaultQuery: string }) {
  const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
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
      setError(body?.error ?? "YouTube search failed.");
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

  return (
    <section className="panel finder-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">YouTube Finder</h3>
          <p className="panel-subtitle">Search candidates with the YouTube Data API adapter.</p>
        </div>
        {candidates.length > 0 ? (
          <button className="text-button" onClick={copyUrls} type="button">
            <Copy size={15} />
            {copied ? "Copied" : "Copy URLs"}
          </button>
        ) : null}
      </div>
      <div className="panel-body">
        <form className="finder-form" onSubmit={onSubmit}>
          <label className="finder-query">
            <span>Query</span>
            <input name="query" defaultValue={defaultQuery} required />
          </label>
          <label>
            <span>Order</span>
            <select name="order" defaultValue="viewCount">
              <option value="viewCount">View count</option>
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
              <option value="rating">Rating</option>
            </select>
          </label>
          <label>
            <span>Results</span>
            <input name="maxResults" type="number" min={1} max={25} defaultValue={10} />
          </label>
          <label>
            <span>Region</span>
            <input name="regionCode" defaultValue="KR" maxLength={2} />
          </label>
          <label>
            <span>Language</span>
            <input name="relevanceLanguage" defaultValue="ko" maxLength={8} />
          </label>
          <label>
            <span>Duration</span>
            <select name="videoDuration" defaultValue="any">
              <option value="any">Any</option>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
          <button className="text-button primary" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
            Search
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
                  <span>{formatNumber(candidate.viewCount)} views</span>
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

