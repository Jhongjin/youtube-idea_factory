"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus } from "lucide-react";

type FormState = "idle" | "submitting" | "error";

export function NewRunForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");

    const formData = new FormData(event.currentTarget);
    const seedUrls = String(formData.get("seedUrls") ?? "")
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);

    const payload = {
      topic: String(formData.get("topic") ?? ""),
      category: String(formData.get("category") ?? ""),
      format: String(formData.get("format") ?? "shorts"),
      language: String(formData.get("language") ?? "ko"),
      targetAudience: String(formData.get("targetAudience") ?? ""),
      tone: String(formData.get("tone") ?? ""),
      durationSeconds: Number(formData.get("durationSeconds") ?? 60),
      seedUrls,
    };

    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Run creation failed.");
      setState("error");
      return;
    }

    const body = (await response.json()) as { run?: { id?: string } };
    if (body.run?.id) {
      window.location.href = `/?run=${encodeURIComponent(body.run.id)}`;
      return;
    }

    window.location.reload();
  }

  return (
    <form className="new-run-form" onSubmit={onSubmit}>
      <label>
        <span>Topic</span>
        <input name="topic" required placeholder="AI 뉴스 요약 자동화" />
      </label>
      <div className="form-grid">
        <label>
          <span>Category</span>
          <input name="category" placeholder="Technology" />
        </label>
        <label>
          <span>Format</span>
          <select name="format" defaultValue="shorts">
            <option value="shorts">Shorts</option>
            <option value="long-form">Long-form</option>
            <option value="explainer">Explainer</option>
            <option value="documentary">Documentary</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          <span>Language</span>
          <select name="language" defaultValue="ko">
            <option value="ko">Korean</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <span>Duration</span>
          <input name="durationSeconds" type="number" min={1} defaultValue={60} />
        </label>
      </div>
      <label>
        <span>Audience</span>
        <input name="targetAudience" placeholder="AI 툴에 관심 있는 크리에이터" />
      </label>
      <label>
        <span>Tone</span>
        <input name="tone" placeholder="빠르고 실용적인 설명" />
      </label>
      <label>
        <span>Seed URLs</span>
        <textarea name="seedUrls" required rows={4} placeholder="https://www.youtube.com/watch?v=..." />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button primary form-submit" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        New Run
      </button>
    </form>
  );
}
