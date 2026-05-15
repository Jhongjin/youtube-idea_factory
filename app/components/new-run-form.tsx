"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus } from "lucide-react";

type FormState = "idle" | "submitting" | "error";

export function NewRunForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [format, setFormat] = useState("shorts");
  const [language, setLanguage] = useState("ko");
  const [durationSeconds, setDurationSeconds] = useState(60);

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
      <div className="run-builder-steps" aria-label="새 실행 생성 순서">
        <span className="active">1 브리프</span>
        <span>2 소스</span>
        <span>3 생성</span>
      </div>

      <section className="new-run-section primary">
        <div className="new-run-section-heading">
          <span>01</span>
          <div>
            <strong>주제와 출력 기준</strong>
            <p>필수값만 먼저 입력하면 실행 패키지가 생성됩니다.</p>
          </div>
        </div>
        <label>
          <span>주제</span>
          <input name="topic" required placeholder="AI 뉴스 요약 자동화" />
        </label>
        <div className="format-presets" aria-label="형식 빠른 선택">
          {[
            { label: "쇼츠 60초", format: "shorts", duration: 60 },
            { label: "설명형 180초", format: "explainer", duration: 180 },
            { label: "롱폼 8분", format: "long-form", duration: 480 },
          ].map((preset) => (
            <button
              className={format === preset.format && durationSeconds === preset.duration ? "active" : ""}
              key={preset.label}
              onClick={() => {
                setFormat(preset.format);
                setDurationSeconds(preset.duration);
              }}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            <span>형식</span>
            <select name="format" onChange={(event) => setFormat(event.target.value)} value={format}>
              <option value="shorts">쇼츠</option>
              <option value="long-form">롱폼</option>
              <option value="explainer">설명형</option>
              <option value="documentary">다큐형</option>
            </select>
          </label>
          <label>
            <span>길이(초)</span>
            <input
              name="durationSeconds"
              onChange={(event) => setDurationSeconds(Number(event.target.value))}
              min={1}
              type="number"
              value={durationSeconds}
            />
          </label>
        </div>
      </section>

      <section className="new-run-section">
        <div className="new-run-section-heading">
          <span>02</span>
          <div>
            <strong>첫 소스 영상</strong>
            <p>YouTube URL 한 개 이상이 필요합니다. 이후 파인더에서 더 보강할 수 있습니다.</p>
          </div>
        </div>
        <label>
          <span>시드 URL</span>
          <textarea name="seedUrls" required rows={3} placeholder="https://www.youtube.com/watch?v=..." />
        </label>
      </section>

      <details className="new-run-advanced">
        <summary>상세 옵션</summary>
        <div className="new-run-advanced-body">
          <div className="form-grid">
            <label>
              <span>카테고리</span>
              <input name="category" placeholder="Technology" />
            </label>
            <label>
              <span>언어</span>
              <select name="language" onChange={(event) => setLanguage(event.target.value)} value={language}>
                <option value="ko">한국어</option>
                <option value="en">영어</option>
              </select>
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
        </div>
      </details>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button primary form-submit" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        새 실행 만들기
      </button>
    </form>
  );
}
