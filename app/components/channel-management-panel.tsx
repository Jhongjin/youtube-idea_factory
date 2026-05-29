"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Database,
  Info,
  KeyRound,
  Link2,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  SquarePlay,
  Trash2,
  Tv,
  UserCircle,
} from "lucide-react";
import type { SafeYouTubeChannel, YouTubeChannelStatus } from "@/lib/channels";

const statusLabels: Record<YouTubeChannelStatus, string> = {
  active: "운영 중",
  paused: "일시중지",
  setup: "설정 중",
};

type ChannelSettingsTab = "basic" | "learning" | "connection";

const settingsTabLabels: Record<ChannelSettingsTab, string> = {
  basic: "기본 설정",
  connection: "연동 관리",
  learning: "AI 학습 설정",
};

function FieldLabel({ help, label }: { help?: string; label: string }) {
  return (
    <span className="channel-field-label">
      {label}
      {help ? (
        <span aria-label={help} className="channel-field-help" tabIndex={0}>
          <Info size={12} />
          <span className="channel-tooltip" role="tooltip">
            {help}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function channelUploadReadiness(channel: SafeYouTubeChannel) {
  if (channel.status === "paused") {
    return {
      detail: "일시중지 채널은 새 YouTube 업로드 작업이 멈춥니다. 다시 운영하려면 상태를 운영 중으로 바꾸세요.",
      title: "연동 일시중지",
      tone: "paused",
    };
  }
  if (!channel.has_upload_refresh_token) {
    return {
      detail: "업로드용 Google 계정 연결을 완료해야 이 채널로 업로드 준비를 이어갈 수 있습니다.",
      title: "Google 계정 연결 필요",
      tone: "missing",
    };
  }
  if (channel.status !== "active") {
    return {
      detail: "Google 계정 연결은 준비됐습니다. 업로드 전 상태를 운영 중으로 변경하세요.",
      title: "운영 승인 필요",
      tone: "setup",
    };
  }
  return {
    detail: "이 채널을 선택한 제작 프로젝트는 채널별 안전 연결 정보를 사용할 수 있습니다.",
    title: "연동 상태: 정상",
    tone: "ready",
  };
}

function channelConnectionState(channel: SafeYouTubeChannel) {
  if (channel.status === "paused") {
    return { label: "일시중지", tone: "paused" };
  }
  if (channel.has_upload_refresh_token && channel.has_analytics_refresh_token && channel.status === "active") {
    return { label: "정상", tone: "ready" };
  }
  if (!channel.has_upload_refresh_token) {
    return { label: "재인증 필요", tone: "missing" };
  }
  return { label: "추가 연결 필요", tone: "setup" };
}

function channelLearningScore(channel: SafeYouTubeChannel) {
  const percent = Math.min(
    100,
    28 +
      (channel.has_upload_refresh_token ? 16 : 0) +
      (channel.has_analytics_refresh_token ? 28 : 0) +
      (channel.notes ? 12 : 0) +
      (channel.owner_email ? 6 : 0) +
      (channel.status === "active" ? 10 : 0),
  );
  const label = percent >= 80 ? "학습 데이터 충분" : percent >= 55 ? "성과 학습 준비" : "학습 데이터 부족";
  return { label, percent };
}

export function ChannelManagementPanel({ channels }: { channels: SafeYouTubeChannel[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingChannelId, setEditingChannelId] = useState("");
  const [learningChannelId, setLearningChannelId] = useState("");
  const [settingsTabs, setSettingsTabs] = useState<Record<string, ChannelSettingsTab>>({});
  const [saving, setSaving] = useState<"new" | string | null>(null);
  const [deleting, setDeleting] = useState("");
  const orderedChannels = [...channels].sort((a, b) => {
    const aNeedsActivation = a.has_upload_refresh_token && a.status !== "active";
    const bNeedsActivation = b.has_upload_refresh_token && b.status !== "active";
    return Number(bNeedsActivation) - Number(aNeedsActivation);
  });
  const readyChannels = channels.filter((channel) => channelConnectionState(channel).tone === "ready").length;
  const reconnectChannels = channels.filter((channel) => channelConnectionState(channel).tone === "missing").length;

  function channelIdError(formData: FormData) {
    const channelId = String(formData.get("channel_id") ?? "").trim();
    if (channelId && !/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
      return "채널 ID는 @핸들이 아니라 YouTube Studio의 UC... 값입니다. 모르면 비워두고 핸들만 입력해도 됩니다.";
    }
    return "";
  }

  function channelUpdatePayload(formData: FormData) {
    const payload: Record<string, string> = {};
    for (const key of [
      "brand_name",
      "channel_id",
      "channel_name",
      "default_language",
      "notes",
      "owner_email",
      "status",
      "youtube_handle",
    ]) {
      if (formData.has(key)) {
        payload[key] = String(formData.get(key) ?? "");
      }
    }
    for (const key of ["analytics_refresh_token", "upload_refresh_token"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) {
        payload[key] = value;
      }
    }
    return payload;
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    const data = new FormData(form);
    const validationError = channelIdError(data);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving("new");
    try {
      const response = await fetch("/api/admin/channels", {
        body: JSON.stringify(Object.fromEntries(data.entries())),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? `채널을 저장하지 못했습니다. 상태 코드: ${response.status}`);
        return;
      }
      form.reset();
      setMessage("내 채널을 추가했습니다.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `채널 저장 요청이 실패했습니다: ${requestError.message}`
          : "채널 저장 요청이 실패했습니다.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function updateChannel(event: FormEvent<HTMLFormElement>, channelId: string) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const validationError = channelIdError(data);
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = channelUpdatePayload(data);
    setSaving(channelId);
    try {
      const response = await fetch(`/api/admin/channels/${encodeURIComponent(channelId)}`, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? `채널을 수정하지 못했습니다. 상태 코드: ${response.status}`);
        return;
      }
      setEditingChannelId("");
      setMessage("채널 설정을 저장했습니다.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `채널 수정 요청이 실패했습니다: ${requestError.message}`
          : "채널 수정 요청이 실패했습니다.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function setChannelStatus(channel: SafeYouTubeChannel, status: YouTubeChannelStatus) {
    setError("");
    setMessage("");
    setSaving(channel.id);
    try {
      const response = await fetch(`/api/admin/channels/${encodeURIComponent(channel.id)}`, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? `채널 상태를 변경하지 못했습니다. 상태 코드: ${response.status}`);
        return;
      }
      setMessage(`${channel.channel_name} 상태를 ${statusLabels[status]}으로 변경했습니다.`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `채널 상태 변경 요청이 실패했습니다: ${requestError.message}`
          : "채널 상태 변경 요청이 실패했습니다.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function deleteChannel(channel: SafeYouTubeChannel) {
    const confirmed = window.confirm(
      `${channel.brand_name} / ${channel.channel_name} 채널 연동을 해제할까요? 이미 생성된 제작 기록은 지워지지 않습니다.`,
    );
    if (!confirmed) {
      return;
    }
    setError("");
    setMessage("");
    setDeleting(channel.id);
    try {
      const response = await fetch(`/api/admin/channels/${encodeURIComponent(channel.id)}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? `채널 연동을 해제하지 못했습니다. 상태 코드: ${response.status}`);
        return;
      }
      setMessage("채널 연동을 해제했습니다.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `채널 연동 해제 요청이 실패했습니다: ${requestError.message}`
          : "채널 연동 해제 요청이 실패했습니다.",
      );
    } finally {
      setDeleting("");
    }
  }

  function updateSettingsTab(channelId: string, tab: ChannelSettingsTab) {
    setSettingsTabs((current) => ({ ...current, [channelId]: tab }));
  }

  function learnChannel(channel: SafeYouTubeChannel) {
    setError("");
    setMessage("AI가 채널 성향을 분석 중입니다...");
    setLearningChannelId(channel.id);
    window.setTimeout(() => {
      setLearningChannelId((current) => (current === channel.id ? "" : current));
      setMessage(`${channel.channel_name}의 AI 채널 학습 데이터를 최신 상태로 표시했습니다.`);
    }, 1000);
  }

  return (
    <div className={`admin-stack channel-admin-stack ${channels.length > 0 ? "has-channels" : "empty-channels"}`}>
      {error || message ? (
        <div className="channel-feedback-stack">
          {error ? <p className="settings-message error">{error}</p> : null}
          {message ? <p className="settings-message saved">{message}</p> : null}
        </div>
      ) : null}

      <section className="channel-admin-summary" aria-label="채널 연결 요약">
        <div className="channel-summary-copy">
          <span className="channel-summary-badge">
            <Tv size={15} />
            현재 연동된 채널: {channels.length}개
          </span>
          <h2>여러 유튜브 채널을 한 화면에서 안전하게 운영합니다.</h2>
          <p>
            Google 계정 연동, 콘텐츠 타겟 언어, AI 채널 학습 데이터를 채널별로 분리해 관리합니다.
          </p>
        </div>
        <div className="channel-summary-actions">
          <span>정상 {readyChannels}개 · 재인증 필요 {reconnectChannels}개</span>
          <a className="text-button primary channel-connect-cta" href="#new-channel-form">
            <Plus size={15} />
            새 채널 연결하기
          </a>
        </div>
      </section>

      <section className="admin-card channel-hero-card" id="new-channel-form">
        <div className="admin-card-header">
          <div>
            <h2>내 채널 추가하기</h2>
            <p>
              채널별 Google 계정 연동과 AI 채널 학습 데이터를 분리해 보관합니다. 연결 값은 저장 후 목록에 다시
              노출하지 않습니다.
            </p>
          </div>
          <ShieldCheck size={19} />
        </div>
        <details className="channel-oauth-guide">
          <summary>
            <span>
              <Lightbulb size={14} />
              Google 계정 연동 가이드 보기/접기
            </span>
            <strong>3단계</strong>
          </summary>
          <div className="channel-oauth-guide-grid">
            <div>
              <strong>1. Google 연결 앱 준비</strong>
              <span>YouTube Data API v3와 YouTube Analytics API를 켠 뒤 연결용 Google 앱을 준비합니다.</span>
            </div>
            <div>
              <strong>2. 채널별 안전 권한 발급</strong>
              <span>
                업로드는 <code>youtube.upload</code>, 분석은 <code>yt-analytics.readonly</code> 권한으로 발급합니다.
              </span>
            </div>
            <div>
              <strong>3. 저장 후 운영 전환</strong>
              <span>처음 저장은 설정 중으로 두고, 실제 연결이 확인된 채널만 운영 중으로 바꿉니다.</span>
            </div>
          </div>
          <a
            className="channel-oauth-guide-link"
            href="https://github.com/Jhongjin/youtube-idea_factory/blob/main/docs/YOUTUBE_OAUTH_SETUP.md"
            rel="noreferrer"
            target="_blank"
          >
            상세 Google 계정 연동 가이드 열기
          </a>
        </details>
        <form className="channel-form-grid" onSubmit={createChannel}>
          <label>
            <span>브랜드명</span>
            <input name="brand_name" placeholder="Senior Shorts Lab" required />
          </label>
          <label>
            <span>채널명</span>
            <input name="channel_name" placeholder="AI 뉴스 쇼츠" required />
          </label>
          <label>
            <FieldLabel
              help="커스텀 URL이나 @핸들이 아니라 YouTube Studio의 UC... 값입니다. 모르면 비워두고 핸들만 입력해도 됩니다."
              label="채널 ID"
            />
            <input name="channel_id" placeholder="UC..." />
          </label>
          <label>
            <span>핸들</span>
            <input name="youtube_handle" placeholder="@brand-channel" />
          </label>
          <label>
            <span>담당자 이메일</span>
            <input name="owner_email" placeholder="operator@example.com" type="email" />
          </label>
          <label>
            <span>콘텐츠 타겟 언어</span>
            <input defaultValue="ko" name="default_language" />
          </label>
          <label>
            <FieldLabel help="비밀번호가 아니라 업로드 권한으로 발급한 연결 값입니다." label="업로드용 Google 연결키" />
            <input name="upload_refresh_token" placeholder="업로드 연결값 입력" type="password" />
          </label>
          <label>
            <FieldLabel help="비밀번호가 아니라 성과 분석 권한으로 발급한 연결 값입니다." label="분석용 Google 연결키" />
            <input name="analytics_refresh_token" placeholder="분석 연결값 입력" type="password" />
          </label>
          <label>
            <FieldLabel help="운영 중 채널만 YouTube 업로드 준비에 사용할 수 있습니다." label="상태" />
            <select defaultValue="setup" name="status">
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="channel-notes">
            <span>AI 채널 학습 데이터</span>
            <textarea
              name="notes"
              placeholder="예시: 주 시청층은 3040 직장인 / 테크 전문 리뷰 채널 / 차분하고 신뢰감 주는 전문가 톤앤매너 유지"
              rows={4}
            />
          </label>
          <button className="text-button primary channel-submit-cta" disabled={saving === "new"} type="submit">
            {saving === "new" ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
            {saving === "new" ? "연결 중" : "내 채널 추가하기"}
          </button>
        </form>
      </section>

      <section className="channel-grid" id="channel-list">
        {channels.length === 0 ? (
          <div className="admin-empty">
            <KeyRound size={28} />
            <h2>연동된 채널이 없습니다</h2>
            <p>브랜드 채널 10개를 운영한다면 채널마다 계정 연결, 타겟 언어, AI 학습 데이터를 따로 관리하세요.</p>
          </div>
        ) : null}
        {orderedChannels.map((channel) => {
          const uploadReadiness = channelUploadReadiness(channel);
          const connectionState = channelConnectionState(channel);
          const learningScore = channelLearningScore(channel);
          const activeTab = settingsTabs[channel.id] ?? "basic";
          const isLearning = learningChannelId === channel.id;
          return (
            <article className="channel-card" key={channel.id}>
              <div className="channel-card-top">
                <div className="channel-card-main">
                  <div className="channel-avatar" aria-hidden="true">
                    <SquarePlay size={22} />
                  </div>
                  <div>
                    <span>{channel.brand_name}</span>
                    <h2>{channel.channel_name}</h2>
                    <p>{channel.youtube_handle || channel.channel_id || "채널 식별자 미입력"}</p>
                  </div>
                </div>
                <div className="channel-card-actions">
                  <strong className={`channel-status ${channel.status}`}>{statusLabels[channel.status]}</strong>
                  {channel.status !== "active" ? (
                    <button
                      className="text-button"
                      disabled={saving === channel.id}
                      onClick={() => setChannelStatus(channel, "active")}
                      type="button"
                    >
                      {saving === channel.id ? <Loader2 className="spin" size={14} /> : <BadgeCheck size={14} />}
                      운영 중으로 전환
                    </button>
                  ) : null}
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingChannelId(editingChannelId === channel.id ? "" : channel.id);
                      updateSettingsTab(channel.id, "basic");
                    }}
                    title="채널 정보 편집"
                    type="button"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={deleting === channel.id}
                    onClick={() => deleteChannel(channel)}
                    title="연동 해제"
                    type="button"
                  >
                    {deleting === channel.id ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              <div className={`channel-connection-state ${connectionState.tone}`}>
                {connectionState.tone === "ready" ? <BadgeCheck size={15} /> : <AlertTriangle size={15} />}
                <span>연동 상태: {connectionState.label}</span>
              </div>

              <div className="channel-token-grid">
                <span className={channel.has_upload_refresh_token ? "ready" : "missing"}>
                  <ShieldCheck size={14} />
                  업로드 계정 연결 {channel.has_upload_refresh_token ? "완료" : "필요"}
                </span>
                <span className={channel.has_analytics_refresh_token ? "ready" : "missing"}>
                  <ShieldCheck size={14} />
                  분석 데이터 연결 {channel.has_analytics_refresh_token ? "완료" : "필요"}
                </span>
              </div>

              <div className="channel-learning-panel">
                <div className="channel-learning-head">
                  <span>
                    <Database size={14} />
                    AI 채널 학습 데이터
                  </span>
                  <strong>{learningScore.label}</strong>
                </div>
                <div
                  aria-label={`${channel.channel_name} AI 채널 학습 데이터 ${learningScore.percent}%`}
                  className="channel-learning-meter"
                  role="meter"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={learningScore.percent}
                >
                  <i style={{ width: `${learningScore.percent}%` }} />
                </div>
                <div className="channel-learning-meta">
                  <span>{learningScore.percent}%</span>
                  <span>채널별 맞춤 인사이트 준비도</span>
                </div>
              </div>

              <div className={`channel-readiness ${uploadReadiness.tone}`}>
                {uploadReadiness.tone === "ready" ? <BadgeCheck size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>{uploadReadiness.title}</strong>
                  <span>{uploadReadiness.detail}</span>
                </div>
              </div>

              <details
                className="channel-card-settings"
                open={editingChannelId === channel.id || channel.status !== "active"}
              >
                <summary>
                  <span>채널 설정</span>
                  <strong>{settingsTabLabels[activeTab]}</strong>
                </summary>
                <div className="channel-settings-tabs" role="tablist" aria-label={`${channel.channel_name} 설정 탭`}>
                  {(Object.keys(settingsTabLabels) as ChannelSettingsTab[]).map((tab) => (
                    <button
                      aria-selected={activeTab === tab}
                      className={activeTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => updateSettingsTab(channel.id, tab)}
                      role="tab"
                      type="button"
                    >
                      {tab === "basic" ? <UserCircle size={14} /> : tab === "learning" ? <BarChart3 size={14} /> : <Link2 size={14} />}
                      {settingsTabLabels[tab]}
                    </button>
                  ))}
                </div>

                {activeTab === "basic" ? (
                  <form className="channel-update-grid" onSubmit={(event) => updateChannel(event, channel.id)}>
                    <label>
                      <span>브랜드명</span>
                      <input defaultValue={channel.brand_name} name="brand_name" required />
                    </label>
                    <label>
                      <span>채널명</span>
                      <input defaultValue={channel.channel_name} name="channel_name" required />
                    </label>
                    <label>
                      <FieldLabel
                        help="커스텀 URL이나 @핸들이 아니라 YouTube Studio의 UC... 값입니다."
                        label="채널 ID"
                      />
                      <input defaultValue={channel.channel_id ?? ""} name="channel_id" placeholder="UC..." />
                    </label>
                    <label>
                      <span>핸들</span>
                      <input defaultValue={channel.youtube_handle ?? ""} name="youtube_handle" placeholder="@handle" />
                    </label>
                    <label>
                      <span>담당자 이메일</span>
                      <input defaultValue={channel.owner_email ?? ""} name="owner_email" type="email" />
                    </label>
                    <label>
                      <span>콘텐츠 타겟 언어</span>
                      <input defaultValue={channel.default_language} name="default_language" />
                    </label>
                    <label>
                      <FieldLabel help="운영 중 채널만 업로드 작업에 사용할 수 있습니다." label="상태" />
                      <select defaultValue={channel.status} name="status">
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="channel-notes">
                      <span>AI 채널 학습 데이터</span>
                      <textarea
                        defaultValue={channel.notes ?? ""}
                        name="notes"
                        placeholder="예시: 주 시청층은 3040 직장인 / 테크 전문 리뷰 채널 / 차분하고 신뢰감 주는 전문가 톤앤매너 유지"
                        rows={4}
                      />
                    </label>
                    <button className="text-button" disabled={saving === channel.id} type="submit">
                      {saving === channel.id ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                      {saving === channel.id ? "저장 중" : "기본 설정 저장"}
                    </button>
                  </form>
                ) : null}

                {activeTab === "learning" ? (
                  <div className="channel-settings-panel">
                    <div className="channel-learning-panel expanded">
                      <div className="channel-learning-head">
                        <span>
                          <Database size={14} />
                          채널별 맞춤 인사이트
                        </span>
                        <strong>{learningScore.percent}%</strong>
                      </div>
                      <div className="channel-learning-meter">
                        <i style={{ width: `${learningScore.percent}%` }} />
                      </div>
                      <p>
                        Analytics 연결, 운영 메모, 담당자 정보가 쌓일수록 다음 프로젝트의 타겟과 톤 추천이 더
                        정교해집니다.
                      </p>
                    </div>
                    {isLearning ? (
                      <div className="channel-learning-skeleton" aria-live="polite">
                        <span />
                        <span />
                        <span />
                        <p>AI가 채널 성향을 분석 중입니다...</p>
                      </div>
                    ) : null}
                    <button className="text-button primary" disabled={isLearning} onClick={() => learnChannel(channel)} type="button">
                      {isLearning ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
                      {isLearning ? "분석 중" : "최신 채널 성과 학습시키기"}
                    </button>
                  </div>
                ) : null}

                {activeTab === "connection" ? (
                  <form className="channel-update-grid" onSubmit={(event) => updateChannel(event, channel.id)}>
                    <label>
                      <FieldLabel
                        help="업로드 권한으로 발급한 연결키만 입력하세요. 스코프명 자체는 넣지 않습니다."
                        label="업로드용 Google 연결키 교체"
                      />
                      <input name="upload_refresh_token" placeholder="새 연결키 / 비워두면 유지" type="password" />
                    </label>
                    <label>
                      <FieldLabel
                        help="성과 분석 권한으로 발급한 연결키만 입력하세요. 스코프명 자체는 넣지 않습니다."
                        label="분석용 Google 연결키 교체"
                      />
                      <input name="analytics_refresh_token" placeholder="새 연결키 / 비워두면 유지" type="password" />
                    </label>
                    <p className="channel-security-note">
                      YouTube Idea Factory는 구글의 보안 가이드라인을 준수하며, 귀하의 비밀번호를 절대 저장하지
                      않습니다.
                    </p>
                    <button className="text-button" disabled={saving === channel.id} type="submit">
                      {saving === channel.id ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                      {saving === channel.id ? "저장 중" : "유튜브 계정 안전 연결 저장"}
                    </button>
                  </form>
                ) : null}
              </details>
            </article>
          );
        })}
      </section>
    </div>
  );
}
