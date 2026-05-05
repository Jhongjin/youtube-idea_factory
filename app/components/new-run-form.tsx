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
      setError(body?.error ?? "새 실행 생성에 실패했습니다.");
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
        <span>주제</span>
        <input name="topic" required placeholder="AI 뉴스 요약 자동화" />
      </label>
      <div className="form-grid">
        <label>
          <span>카테고리</span>
          <input name="category" placeholder="Technology" />
        </label>
        <label>
          <span>형식</span>
          <select name="format" defaultValue="shorts">
            <option value="shorts">쇼츠</option>
            <option value="long-form">롱폼</option>
            <option value="explainer">설명형</option>
            <option value="documentary">다큐형</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          <span>언어</span>
          <select name="language" defaultValue="ko">
            <option value="ko">한국어</option>
            <option value="en">영어</option>
          </select>
        </label>
        <label>
          <span>길이(초)</span>
          <input name="durationSeconds" type="number" min={1} defaultValue={60} />
        </label>
      </div>
      <label>
        <span>대상 시청자</span>
        <input name="targetAudience" placeholder="AI 툴에 관심 있는 크리에이터" />
      </label>
      <label>
        <span>톤</span>
        <input name="tone" placeholder="빠르고 실용적인 설명" />
      </label>
      <label>
        <span>시드 URL</span>
        <textarea name="seedUrls" required rows={4} placeholder="https://www.youtube.com/watch?v=..." />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button primary form-submit" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        새 실행 만들기
      </button>
    </form>
  );
}
