"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";

type FormState = "idle" | "submitting" | "error";
type SourceMode = "categoryTop" | "manual";
type VideoFormat = "shorts" | "longform";

type ChannelOption = {
  brand_name: string;
  channel_id: string | null;
  channel_name: string;
  default_language?: string;
  has_upload_refresh_token: boolean;
  id: string;
  status: string;
  youtube_handle?: string | null;
};

type YouTubeCategory = {
  assignable: boolean;
  id: string;
  title: string;
};

const fallbackCategories: YouTubeCategory[] = [
  { assignable: true, id: "25", title: "News & Politics" },
  { assignable: true, id: "28", title: "Science & Technology" },
  { assignable: true, id: "27", title: "Education" },
  { assignable: true, id: "24", title: "Entertainment" },
  { assignable: true, id: "22", title: "People & Blogs" },
  { assignable: true, id: "26", title: "Howto & Style" },
];

const languageOptions = [
  { label: "한국어", value: "ko" },
  { label: "영어", value: "en" },
  { label: "일본어", value: "ja" },
  { label: "스페인어", value: "es" },
];

function regionForLanguage(language: string) {
  if (language === "ja") {
    return "JP";
  }
  if (language === "es") {
    return "ES";
  }
  if (language === "en") {
    return "US";
  }
  return "KR";
}

function uniqueList(values: string[]) {
  return values.filter((value, index, array) => value.trim() && array.indexOf(value) === index).slice(0, 5);
}

export function NewRunForm({
  channels = [],
  initialChannelId = "",
}: {
  channels?: ChannelOption[];
  initialChannelId?: string;
}) {
  const initialChannel = channels.find((channel) => channel.id === initialChannelId);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<VideoFormat>("shorts");
  const [language, setLanguage] = useState(initialChannel?.default_language || "ko");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [longformMinutes, setLongformMinutes] = useState(8);
  const [selectedChannelId, setSelectedChannelId] = useState(initialChannel?.id ?? "");
  const [sourceMode, setSourceMode] = useState<SourceMode>("categoryTop");
  const [categories, setCategories] = useState<YouTubeCategory[]>(fallbackCategories);
  const [categoryId, setCategoryId] = useState("25");
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? categories[0] ?? fallbackCategories[0];
  const selectedCategoryTitle = selectedCategory?.title ?? "";
  const selectedChannelReadiness = selectedChannel
    ? selectedChannel.status !== "active"
      ? {
          message: selectedChannel.has_upload_refresh_token
            ? "대본과 리서치는 진행할 수 있지만 업로드 전 채널 상태를 운영 중으로 바꿔야 합니다."
            : "업로드 전 운영 중 전환과 업로드 OAuth 토큰 등록이 모두 필요합니다.",
          tone: "setup",
        }
      : !selectedChannel.has_upload_refresh_token
        ? {
            message: "이 채널로 업로드하려면 업로드 OAuth 토큰을 먼저 등록해야 합니다.",
            tone: "missing",
          }
        : {
            message: "업로드 단계에서 이 채널의 OAuth 토큰을 사용할 수 있습니다.",
            tone: "ready",
          }
    : null;

  const audienceSuggestions = useMemo(
    () =>
      uniqueList([
        `${selectedCategoryTitle} 트렌드를 빠르게 파악하려는 시청자`,
        topic ? `${topic}을 실무에 적용하려는 초급자` : "",
        topic ? `${topic} 관련 의사결정을 해야 하는 운영자` : "",
        format === "shorts" ? "짧은 시간에 핵심만 확인하려는 모바일 시청자" : "근거와 맥락까지 확인하려는 심층 시청자",
        selectedChannel ? `${selectedChannel.brand_name} 채널의 기존 구독자` : "브랜드 채널의 잠재 구독자",
        "업계 흐름을 빠르게 훑는 일반 시청자",
        "다음 행동을 정하고 싶은 실무자",
      ]),
    [format, selectedCategoryTitle, selectedChannel, topic],
  );

  const toneSuggestions = useMemo(
    () =>
      uniqueList([
        format === "shorts" ? "빠르고 선명한 뉴스 브리핑" : "근거 중심의 차분한 분석",
        "쉽게 이해되는 실용 설명",
        "팩트와 의견을 분리하는 신뢰형 톤",
        selectedCategoryTitle.includes("Entertainment") ? "가볍고 몰입감 있는 이야기식 진행" : "",
        language === "ko" ? "한국 시청자 기준의 자연스러운 표현" : "글로벌 시청자 기준의 명료한 표현",
        "핵심 먼저 말하고 근거를 붙이는 직선형 톤",
        "전문 용어를 풀어주는 친절한 진행",
      ]),
    [format, language, selectedCategoryTitle],
  );

  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    setCategoryError("");

    fetch(`/api/youtube/categories?regionCode=${regionForLanguage(language)}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          categories?: YouTubeCategory[];
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "카테고리 목록을 가져오지 못했습니다.");
        }
        const nextCategories = body?.categories?.length ? body.categories : fallbackCategories;
        if (!cancelled) {
          setCategories(nextCategories);
          setCategoryId((current) =>
            nextCategories.some((category) => category.id === current) ? current : nextCategories[0]?.id ?? "25",
          );
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setCategories(fallbackCategories);
          setCategoryError(
            fetchError instanceof Error
              ? `공식 카테고리 조회 실패: ${fetchError.message}`
              : "공식 카테고리 조회 실패",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  function selectChannel(channelId: string) {
    setSelectedChannelId(channelId);
    const channel = channels.find((item) => item.id === channelId);
    if (channel?.default_language) {
      setLanguage(channel.default_language);
    }
  }

  function selectFormat(nextFormat: VideoFormat) {
    setFormat(nextFormat);
    setDurationSeconds(nextFormat === "shorts" ? 60 : longformMinutes * 60);
  }

  function updateLongformMinutes(value: number) {
    const minutes = Number.isFinite(value) ? Math.max(2, Math.min(180, Math.floor(value))) : 8;
    setLongformMinutes(minutes);
    if (format === "longform") {
      setDurationSeconds(minutes * 60);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");

    const formData = new FormData(event.currentTarget);
    const sourceModeValue = String(formData.get("sourceMode") ?? "categoryTop") as SourceMode;
    const seedUrls =
      sourceModeValue === "manual"
        ? String(formData.get("seedUrls") ?? "")
            .split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean)
        : [];

    const payload = {
      topic: String(formData.get("topic") ?? ""),
      category: String(formData.get("category") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      channelId: String(formData.get("channelId") ?? ""),
      format: String(formData.get("format") ?? "shorts"),
      language: String(formData.get("language") ?? "ko"),
      sourceMode: sourceModeValue,
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
      setError(body?.error ?? "새 제작 생성에 실패했습니다.");
      setState("error");
      return;
    }

    const body = (await response.json()) as { run?: { id?: string } };
    if (body.run?.id) {
      const nextParams = new URLSearchParams({
        run: body.run.id,
        step: "research",
      });
      if (payload.channelId) {
        nextParams.set("channel", payload.channelId);
      }
      window.location.href = `/dashboard?${nextParams.toString()}`;
      return;
    }

    window.location.reload();
  }

  return (
    <form className="new-run-form" onSubmit={onSubmit}>
      <input name="format" readOnly type="hidden" value={format} />
      <input name="durationSeconds" readOnly type="hidden" value={durationSeconds} />
      <input name="language" readOnly type="hidden" value={language} />
      <input name="sourceMode" readOnly type="hidden" value={sourceMode} />
      <input name="category" readOnly type="hidden" value={sourceMode === "categoryTop" ? selectedCategoryTitle : ""} />
      <input name="categoryId" readOnly type="hidden" value={sourceMode === "categoryTop" ? categoryId : ""} />

      <section className="new-run-section primary">
        <div className="new-run-section-heading">
          <span>01</span>
          <div>
            <strong>채널과 영상 방향</strong>
            <p>어느 브랜드 채널에서 만들지 고르고, 최종 제목이 아니라 리서치 기준이 될 핵심 키워드를 입력합니다.</p>
          </div>
        </div>
        <label>
          <span>영상 주제 / 리서치 키워드</span>
          <input
            name="topic"
            onChange={(event) => setTopic(event.target.value)}
            placeholder="예: AI 최신 소식, 한국 방산 수출, 생산성 자동화"
            required
            value={topic}
          />
          <small className="field-help">
            제목 후보는 나중에 따로 생성합니다. 이 값은 YouTube 후보 검색, 분석 관점, 대본 방향에 영향을 줍니다.
          </small>
        </label>
        {channels.length > 0 ? (
          <label>
            <span>운영 채널</span>
            <select
              name="channelId"
              onChange={(event) => selectChannel(event.target.value)}
              value={selectedChannelId}
            >
              <option value="">미지정</option>
              {channels.map((channel) => (
                <option disabled={channel.status === "paused"} key={channel.id} value={channel.id}>
                  {channel.brand_name} / {channel.channel_name}
                  {channel.youtube_handle ? ` (${channel.youtube_handle})` : ""}
                  {channel.default_language ? ` - ${channel.default_language}` : ""}
                  {channel.has_upload_refresh_token ? "" : " - 업로드 토큰 필요"}
                  {channel.status === "paused" ? " - 일시중지" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted">등록된 운영 채널이 없으면 채널 미지정 실행으로 시작합니다.</p>
        )}
        <div className={`new-run-channel-summary ${selectedChannel ? "" : "empty"}`}>
          <div>
            <span>선택된 채널</span>
            <strong>
              {selectedChannel
                ? `${selectedChannel.brand_name} / ${selectedChannel.channel_name}`
                : "채널 미지정"}
            </strong>
            <small>
              {selectedChannel
                ? `${selectedChannel.youtube_handle ?? "핸들 미입력"} / ${selectedChannel.default_language ?? "ko"}`
                : "전체 실행으로 시작하며 이후 채널 기준으로 다시 분류할 수 있습니다."}
            </small>
          </div>
          <div className="new-run-channel-badges">
            <span
              className={
                selectedChannel?.status === "active"
                  ? "ready"
                  : selectedChannel?.status === "paused"
                    ? "missing"
                    : "setup"
              }
            >
              {selectedChannel?.status === "active"
                ? "운영 중"
                : selectedChannel?.status === "paused"
                  ? "일시중지"
                  : selectedChannel
                    ? "설정 중"
                    : "미지정"}
            </span>
            <span
              className={
                !selectedChannel ? "setup" : selectedChannel.has_upload_refresh_token ? "ready" : "missing"
              }
            >
              {!selectedChannel
                ? "채널 선택 시 확인"
                : selectedChannel.has_upload_refresh_token
                  ? "업로드 토큰 있음"
                  : "업로드 토큰 필요"}
            </span>
          </div>
          {selectedChannelReadiness ? (
            <p className={`new-run-channel-readiness ${selectedChannelReadiness.tone}`}>
              {selectedChannelReadiness.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="new-run-section">
        <div className="new-run-section-heading">
          <span>02</span>
          <div>
            <strong>첫 소스 수집 방식</strong>
            <p>자동으로 카테고리 후보를 가져오거나, 이미 정해둔 YouTube URL을 직접 넣습니다.</p>
          </div>
        </div>

        <div className="source-mode-grid" aria-label="소스 수집 방식">
          <button
            className={sourceMode === "categoryTop" ? "active" : ""}
            onClick={() => setSourceMode("categoryTop")}
            type="button"
          >
            <strong>카테고리 TOP 10 자동 수집</strong>
            <span>공식 카테고리와 주제를 기준으로 최근 후보를 찾습니다.</span>
          </button>
          <button
            className={sourceMode === "manual" ? "active" : ""}
            onClick={() => setSourceMode("manual")}
            type="button"
          >
            <strong>첫 소스 URL 직접 입력</strong>
            <span>분석하고 싶은 영상이 이미 있을 때 사용합니다.</span>
          </button>
        </div>

        {sourceMode === "categoryTop" ? (
          <label>
            <span>유튜브 공식 카테고리</span>
            <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
            <small className="field-help">
              {categoriesLoading
                ? "공식 카테고리 목록을 불러오는 중입니다."
                : "최근 7일 게시 영상 중 현재 조회수와 형식이 맞는 후보를 최대 10개 가져옵니다."}
            </small>
            {categoryError ? <small className="field-help warning">{categoryError}</small> : null}
          </label>
        ) : (
          <label>
            <span>시드 URL</span>
            <textarea
              name="seedUrls"
              placeholder="https://www.youtube.com/watch?v=..."
              required={sourceMode === "manual"}
              rows={3}
            />
            <small className="field-help">한 줄에 하나씩 넣습니다. 이 URL들이 첫 분석 소스가 됩니다.</small>
          </label>
        )}
      </section>

      <section className="new-run-section">
        <div className="new-run-section-heading">
          <span>03</span>
          <div>
            <strong>제작 형식과 길이</strong>
            <p>쇼츠는 60초 기준, 롱폼은 원하는 분량을 직접 입력합니다.</p>
          </div>
        </div>
        <div className="format-presets two" aria-label="형식 빠른 선택">
          <button
            className={format === "shorts" ? "active" : ""}
            onClick={() => selectFormat("shorts")}
            type="button"
          >
            <strong>쇼츠</strong>
            <span>60초 내외</span>
          </button>
          <button
            className={format === "longform" ? "active" : ""}
            onClick={() => selectFormat("longform")}
            type="button"
          >
            <strong>롱폼</strong>
            <span>사용자 지정 길이</span>
          </button>
        </div>
        {format === "longform" ? (
          <label className="longform-duration-control">
            <span>롱폼 목표 길이(분)</span>
            <input
              max={180}
              min={2}
              onChange={(event) => updateLongformMinutes(Number(event.target.value))}
              type="number"
              value={longformMinutes}
            />
            <small className="field-help">대본 길이, 씬 수, 렌더 계획의 기준으로 사용됩니다.</small>
          </label>
        ) : null}
      </section>

      <details className="new-run-advanced">
        <summary>
          <span>상세 옵션</span>
          <small>언어, 대상 시청자, 톤 추천</small>
        </summary>
        <div className="new-run-advanced-body">
          <label>
            <span>언어</span>
            <select onChange={(event) => setLanguage(event.target.value)} value={language}>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>대상 시청자</span>
            <input
              name="targetAudience"
              onChange={(event) => setTargetAudience(event.target.value)}
              placeholder="비워두면 아래 추천값 중 하나를 선택할 수 있습니다."
              value={targetAudience}
            />
          </label>
          <div className="suggestion-row" aria-label="대상 시청자 추천">
            {audienceSuggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => setTargetAudience(suggestion)} type="button">
                {suggestion}
              </button>
            ))}
          </div>
          <label>
            <span>톤</span>
            <input
              name="tone"
              onChange={(event) => setTone(event.target.value)}
              placeholder="비워두면 아래 추천값 중 하나를 선택할 수 있습니다."
              value={tone}
            />
          </label>
          <div className="suggestion-row" aria-label="톤 추천">
            {toneSuggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => setTone(suggestion)} type="button">
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </details>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="text-button primary form-submit" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        새 제작 시작
      </button>
    </form>
  );
}
