"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, KeyRound, Loader2, Pencil, Save, Trash2, Tv } from "lucide-react";
import type { SafeYouTubeChannel, YouTubeChannelStatus } from "@/lib/channels";

const statusLabels: Record<YouTubeChannelStatus, string> = {
  active: "운영 중",
  paused: "일시정지",
  setup: "설정 중",
};

export function ChannelManagementPanel({ channels }: { channels: SafeYouTubeChannel[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingChannelId, setEditingChannelId] = useState("");
  const [saving, setSaving] = useState<"new" | string | null>(null);
  const [deleting, setDeleting] = useState("");

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
      payload[key] = String(formData.get(key) ?? "");
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
      setMessage("채널을 저장했습니다.");
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
      setMessage("채널 정보를 저장했습니다.");
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

  async function deleteChannel(channel: SafeYouTubeChannel) {
    const confirmed = window.confirm(
      `${channel.brand_name} / ${channel.channel_name} 채널을 삭제할까요? 이미 생성된 run 기록은 지워지지 않습니다.`,
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
        setError(body?.error ?? `채널을 삭제하지 못했습니다. 상태 코드: ${response.status}`);
        return;
      }
      setMessage("채널을 삭제했습니다.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `채널 삭제 요청이 실패했습니다: ${requestError.message}`
          : "채널 삭제 요청이 실패했습니다.",
      );
    } finally {
      setDeleting("");
    }
  }

  return (
    <div className="admin-stack">
      <section className="admin-card channel-hero-card">
        <div className="admin-card-header">
          <div>
            <h2>브랜드 채널 등록</h2>
            <p>
              브랜드 채널별 업로드 OAuth와 Analytics OAuth 상태를 분리해 관리합니다. 토큰 값은 목록에 다시
              노출하지 않습니다.
            </p>
          </div>
          <Tv size={19} />
        </div>
        {error ? <p className="settings-message error">{error}</p> : null}
        {message ? <p className="settings-message saved">{message}</p> : null}
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
            <span>채널 ID</span>
            <input name="channel_id" placeholder="UC..." />
            <small>커스텀 URL이나 @핸들이 아니라 YouTube Studio의 UC... 값입니다.</small>
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
            <span>기본 언어</span>
            <input defaultValue="ko" name="default_language" />
          </label>
          <label>
            <span>업로드 refresh token</span>
            <input name="upload_refresh_token" placeholder="youtube.upload scope" type="password" />
          </label>
          <label>
            <span>Analytics refresh token</span>
            <input name="analytics_refresh_token" placeholder="yt-analytics.readonly scope" type="password" />
          </label>
          <label>
            <span>상태</span>
            <select defaultValue="setup" name="status">
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="channel-notes">
            <span>메모</span>
            <textarea name="notes" placeholder="콘텐츠 포지션, 업로드 주기, 주의할 브랜드 톤" rows={3} />
          </label>
          <button className="text-button primary" disabled={saving === "new"} type="submit">
            {saving === "new" ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
            {saving === "new" ? "저장 중" : "채널 저장"}
          </button>
        </form>
      </section>

      <section className="channel-grid">
        {channels.length === 0 ? (
          <div className="admin-empty">
            <KeyRound size={28} />
            <h2>등록된 채널이 없습니다</h2>
            <p>브랜드 채널 10개를 운영한다면 채널마다 업로드/분석 권한 상태를 따로 관리하세요.</p>
          </div>
        ) : null}
        {channels.map((channel) => (
          <article className="channel-card" key={channel.id}>
            <div className="channel-card-top">
              <div>
                <span>{channel.brand_name}</span>
                <h2>{channel.channel_name}</h2>
                <p>{channel.youtube_handle || channel.channel_id || "채널 식별자 미입력"}</p>
              </div>
              <div className="channel-card-actions">
                <strong className={`channel-status ${channel.status}`}>{statusLabels[channel.status]}</strong>
                <button
                  className="icon-button"
                  onClick={() => setEditingChannelId(editingChannelId === channel.id ? "" : channel.id)}
                  title="채널 정보 편집"
                  type="button"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={deleting === channel.id}
                  onClick={() => deleteChannel(channel)}
                  title="채널 삭제"
                  type="button"
                >
                  {deleting === channel.id ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
            <div className="channel-token-grid">
              <span className={channel.has_upload_refresh_token ? "ready" : "missing"}>
                <BadgeCheck size={14} />
                업로드 OAuth {channel.has_upload_refresh_token ? "등록" : "필요"}
              </span>
              <span className={channel.has_analytics_refresh_token ? "ready" : "missing"}>
                <BadgeCheck size={14} />
                Analytics OAuth {channel.has_analytics_refresh_token ? "등록" : "필요"}
              </span>
            </div>
            <form className="channel-update-grid" onSubmit={(event) => updateChannel(event, channel.id)}>
              {editingChannelId === channel.id ? (
                <>
                  <label>
                    <span>브랜드명</span>
                    <input defaultValue={channel.brand_name} name="brand_name" required />
                  </label>
                  <label>
                    <span>채널명</span>
                    <input defaultValue={channel.channel_name} name="channel_name" required />
                  </label>
                  <label>
                    <span>채널 ID</span>
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
                    <span>기본 언어</span>
                    <input defaultValue={channel.default_language} name="default_language" />
                  </label>
                </>
              ) : (
                <>
                  <input name="brand_name" type="hidden" value={channel.brand_name} />
                  <input name="channel_id" type="hidden" value={channel.channel_id ?? ""} />
                  <input name="channel_name" type="hidden" value={channel.channel_name} />
                  <input name="default_language" type="hidden" value={channel.default_language} />
                  <input name="owner_email" type="hidden" value={channel.owner_email ?? ""} />
                  <input name="youtube_handle" type="hidden" value={channel.youtube_handle ?? ""} />
                </>
              )}
              <label>
                <span>상태</span>
                <select defaultValue={channel.status} name="status">
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>업로드 토큰 교체</span>
                <input name="upload_refresh_token" placeholder="비워두면 유지" type="password" />
              </label>
              <label>
                <span>분석 토큰 교체</span>
                <input name="analytics_refresh_token" placeholder="비워두면 유지" type="password" />
              </label>
              <label>
                <span>메모</span>
                <input defaultValue={channel.notes ?? ""} name="notes" placeholder="운영 메모" />
              </label>
              <button className="text-button" disabled={saving === channel.id} type="submit">
                {saving === channel.id ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                {saving === channel.id ? "저장 중" : "업데이트"}
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
