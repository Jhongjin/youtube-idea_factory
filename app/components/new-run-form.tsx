"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ListVideo, Loader2, Search } from "lucide-react";

type FormState = "idle" | "submitting" | "error";
type SourceMode = "topicSearch" | "categoryTop";
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

const marketOptions = [
  { label: "대한민국 / 한국어", language: "ko", regionCode: "KR", value: "KR:ko" },
  { label: "미국 / 영어", language: "en", regionCode: "US", value: "US:en" },
  { label: "일본 / 일본어", language: "ja", regionCode: "JP", value: "JP:ja" },
  { label: "스페인 / 스페인어", language: "es", regionCode: "ES", value: "ES:es" },
  { label: "영국 / 영어", language: "en", regionCode: "GB", value: "GB:en" },
  { label: "인도 / 영어", language: "en", regionCode: "IN", value: "IN:en" },
];

const lookbackOptions = [
  { label: "최근 7일", value: "7" },
  { label: "최근 14일", value: "14" },
  { label: "최근 30일", value: "30" },
];

const candidateLimit = 10;

function marketForLanguage(language?: string) {
  const normalized = language?.toLowerCase() ?? "";
  return marketOptions.find((option) => option.language === normalized)?.value ?? marketOptions[0].value;
}

function uniqueList(values: string[]) {
  return values.filter((value, index, array) => value.trim() && array.indexOf(value) === index).slice(0, 5);
}

function longformMinutesValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8;
  }
  return Math.max(2, Math.min(180, Math.floor(parsed)));
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
  const [longformMinutes, setLongformMinutes] = useState("8");
  const [selectedChannelId, setSelectedChannelId] = useState(initialChannel?.id ?? "");
  const [sourceMode, setSourceMode] = useState<SourceMode>("topicSearch");
  const [marketCode, setMarketCode] = useState(marketForLanguage(initialChannel?.default_language));
  const [lookbackDays, setLookbackDays] = useState("7");
  const [categories, setCategories] = useState<YouTubeCategory[]>(fallbackCategories);
  const [categoryId, setCategoryId] = useState("25");
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");

  const selectedMarket = marketOptions.find((option) => option.value === marketCode) ?? marketOptions[0];
  const selectedLookback = lookbackOptions.find((option) => option.value === lookbackDays) ?? lookbackOptions[0];
  const language = selectedMarket.language;
  const regionCode = selectedMarket.regionCode;
  const durationSeconds = format === "shorts" ? 60 : longformMinutesValue(longformMinutes) * 60;
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? categories[0] ?? fallbackCategories[0];
  const selectedCategoryTitle = selectedCategory?.title ?? "";
  const formatLabel = format === "longform" ? `${longformMinutesValue(longformMinutes)}분 롱폼` : "쇼츠";
  const intakeLabel =
    sourceMode === "topicSearch"
      ? topic.trim() || "입력한 아이디어"
      : selectedCategoryTitle
        ? `${selectedCategoryTitle} 카테고리`
        : "선택한 카테고리";
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
        sourceMode === "categoryTop" ? `${selectedCategoryTitle} 트렌드를 빠르게 파악하려는 시청자` : "",
        topic ? `${topic}을 실무에 적용하려는 초급자` : "",
        topic ? `${topic} 관련 의사결정을 해야 하는 운영자` : "",
        format === "shorts" ? "짧은 시간에 핵심만 확인하려는 모바일 시청자" : "근거와 맥락까지 확인하려는 심층 시청자",
        selectedChannel ? `${selectedChannel.brand_name} 채널의 기존 구독자` : "브랜드 채널의 잠재 구독자",
        "업계 흐름을 빠르게 훑는 일반 시청자",
        "다음 행동을 정하고 싶은 실무자",
      ]),
    [format, selectedCategoryTitle, selectedChannel, sourceMode, topic],
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

    fetch(`/api/youtube/categories?regionCode=${regionCode}`)
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
  }, [regionCode]);

  function selectChannel(channelId: string) {
    setSelectedChannelId(channelId);
    const channel = channels.find((item) => item.id === channelId);
    if (channel?.default_language) {
      setMarketCode(marketForLanguage(channel.default_language));
    }
  }

  function finishLongformEdit() {
    setLongformMinutes(String(longformMinutesValue(longformMinutes)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");

    const formData = new FormData(event.currentTarget);
    const sourceModeValue = String(formData.get("sourceMode") ?? "topicSearch") as SourceMode;
    const topicValue = String(formData.get("topic") ?? "").trim();
    const categoryValue = sourceModeValue === "categoryTop" ? String(formData.get("category") ?? "") : "";
    const categoryIdValue = sourceModeValue === "categoryTop" ? String(formData.get("categoryId") ?? "") : "";

    if (sourceModeValue === "topicSearch" && !topicValue) {
      setError("아이디어 직접 작성 모드에서는 영상 주제나 리서치 키워드가 필요합니다.");
      setState("error");
      return;
    }
    if (sourceModeValue === "categoryTop" && !categoryIdValue) {
      setError("카테고리 선택 모드에서는 유튜브 공식 카테고리가 필요합니다.");
      setState("error");
      return;
    }

    const payload = {
      topic: topicValue,
      category: categoryValue,
      categoryId: categoryIdValue,
      candidateLimit,
      channelId: String(formData.get("channelId") ?? ""),
      format: String(formData.get("format") ?? "shorts"),
      language: String(formData.get("language") ?? "ko"),
      lookbackDays: Number(formData.get("lookbackDays") ?? 7),
      regionCode: String(formData.get("regionCode") ?? "KR"),
      sourceMode: sourceModeValue,
      targetAudience: String(formData.get("targetAudience") ?? ""),
      tone: String(formData.get("tone") ?? ""),
      durationSeconds: Number(formData.get("durationSeconds") ?? 60),
      seedUrls: [],
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
      <input name="lookbackDays" readOnly type="hidden" value={lookbackDays} />
      <input name="regionCode" readOnly type="hidden" value={regionCode} />
      <input name="sourceMode" readOnly type="hidden" value={sourceMode} />
      <input name="category" readOnly type="hidden" value={sourceMode === "categoryTop" ? selectedCategoryTitle : ""} />
      <input name="categoryId" readOnly type="hidden" value={sourceMode === "categoryTop" ? categoryId : ""} />

      <section className="new-run-section primary">
        <div className="new-run-section-heading">
          <span>01</span>
          <div>
            <strong>아이디어 또는 카테고리</strong>
            <p>둘 중 하나로 시작합니다. 직접 작성과 카테고리 선택은 서로 다른 검색 경로입니다.</p>
          </div>
        </div>
        <div className="source-mode-grid" aria-label="아이디어 시작 방식">
          <button
            className={sourceMode === "topicSearch" ? "active" : ""}
            onClick={() => setSourceMode("topicSearch")}
            type="button"
          >
            <strong>아이디어 직접 작성</strong>
            <span>주제나 키워드만으로 조건에 맞는 우수 후보를 찾습니다.</span>
          </button>
          <button
            className={sourceMode === "categoryTop" ? "active" : ""}
            onClick={() => setSourceMode("categoryTop")}
            type="button"
          >
            <strong>카테고리 선택</strong>
            <span>아이디어가 없을 때 공식 카테고리만으로 후보를 찾습니다.</span>
          </button>
        </div>

        {sourceMode === "topicSearch" ? (
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
              이 키워드만 적용합니다. 카테고리 필터와 함께 묶지 않습니다.
            </small>
          </label>
        ) : (
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
                ? "선택한 국가 기준 공식 카테고리 목록을 불러오는 중입니다."
                : "키워드 없이 카테고리와 국가 기준으로 후보를 가져옵니다."}
            </small>
            {categoryError ? <small className="field-help warning">{categoryError}</small> : null}
          </label>
        )}
      </section>

      <section className="new-run-section">
        <div className="new-run-section-heading">
          <span>02</span>
          <div>
            <strong>공통 검색 기준</strong>
            <p>아이디어 직접 작성과 카테고리 선택 모두 국가/언어, 쇼츠/롱폼 기준으로 후보를 가져옵니다.</p>
          </div>
        </div>
        <label>
          <span>국가 / 언어</span>
          <select onChange={(event) => setMarketCode(event.target.value)} value={marketCode}>
            {marketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="field-help">YouTube 지역 코드와 관련 언어를 함께 적용합니다.</small>
        </label>
        <div className="new-run-search-controls">
          <label>
            <span>기간</span>
            <select onChange={(event) => setLookbackDays(event.target.value)} value={lookbackDays}>
              {lookbackOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="field-help">이 기간 안에 게시된 영상의 현재 조회수를 기준으로 봅니다.</small>
          </label>
          <div className="new-run-output-card">
            <ListVideo size={16} />
            <div>
              <span>결과 수</span>
              <strong>후보 영상 최대 {candidateLimit}개</strong>
              <small>동일 채널 쏠림을 줄여 소스 검토에 넣습니다.</small>
            </div>
          </div>
        </div>
        <div className="format-presets two" aria-label="형식 빠른 선택">
          <button
            className={format === "shorts" ? "active" : ""}
            onClick={() => setFormat("shorts")}
            type="button"
          >
            <strong>쇼츠</strong>
            <span>60초 내외</span>
          </button>
          <button
            className={format === "longform" ? "active" : ""}
            onClick={() => setFormat("longform")}
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
              onBlur={finishLongformEdit}
              onChange={(event) => setLongformMinutes(event.target.value)}
              required
              type="number"
              value={longformMinutes}
            />
            <small className="field-help">값을 지우고 다시 입력할 수 있습니다. 제출 시 2-180분 범위로 사용됩니다.</small>
          </label>
        ) : null}
      </section>

      <section className="new-run-section">
        <div className="new-run-section-heading">
          <span>03</span>
          <div>
            <strong>운영 채널</strong>
            <p>채널을 고르면 이후 업로드 토큰과 채널 이력을 연결합니다. 리서치만 할 때는 미지정으로 시작할 수 있습니다.</p>
          </div>
        </div>
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

      <section className="new-run-output-summary" aria-label="생성될 후보 산출물">
        <div>
          <CalendarDays size={16} />
          <div>
            <span>찾는 조건</span>
            <strong>{intakeLabel}</strong>
            <small>
              {selectedLookback.label} / {selectedMarket.regionCode}-{selectedMarket.language} / {formatLabel}
            </small>
          </div>
        </div>
        <div>
          <ListVideo size={16} />
          <div>
            <span>생성되는 것</span>
            <strong>검토용 소스 후보 최대 {candidateLimit}개</strong>
            <small>sources.json과 production package에 기록됩니다.</small>
          </div>
        </div>
      </section>

      <details className="new-run-advanced">
        <summary>
          <span>상세 옵션</span>
          <small>대상 시청자, 톤 추천</small>
        </summary>
        <div className="new-run-advanced-body">
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
        {state === "submitting" ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
        {state === "submitting"
          ? `우수 후보 최대 ${candidateLimit}개 찾는 중`
          : `조건에 맞는 우수 영상 최대 ${candidateLimit}개 찾기`}
      </button>
    </form>
  );
}
