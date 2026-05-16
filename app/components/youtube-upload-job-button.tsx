"use client";

import { useState } from "react";
import { CalendarClock, Loader2, UploadCloud, X } from "lucide-react";

const confirmToken = "QUEUE_YOUTUBE_UPLOAD";
const privacyLabels = {
  private: "비공개",
  unlisted: "일부 공개",
  public: "공개",
};
type PrivacyStatus = keyof typeof privacyLabels;

export function YouTubeUploadJobButton({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>("private");
  const [scheduledAt, setScheduledAt] = useState("");
  const [madeForKids, setMadeForKids] = useState(false);

  function scheduledAtIso() {
    if (!scheduledAt) {
      return "";
    }
    const scheduled = new Date(scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      throw new Error("예약 시간이 올바르지 않습니다.");
    }
    if (scheduled.getTime() <= Date.now()) {
      throw new Error("예약 시간은 현재 이후여야 합니다.");
    }
    return scheduled.toISOString();
  }

  async function queueUploadJob() {
    setError("");
    let scheduledAtValue = "";
    try {
      scheduledAtValue = scheduledAtIso();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "예약 시간이 올바르지 않습니다.");
      return;
    }
    const uploadMode = scheduledAtValue ? "예약 비공개" : privacyLabels[privacyStatus];
    const confirmation = window.prompt(
      `${confirmToken}를 입력하면 ${uploadMode} YouTube 업로드 작업을 큐에 등록합니다.`,
    );
    if (confirmation === null) {
      return;
    }
    if (confirmation !== confirmToken) {
      setError(`YouTube 업로드 작업 등록에는 ${confirmToken}가 필요합니다.`);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/runs/${runId}/publishing/upload-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmQueue: confirmToken,
        madeForKids,
        privacyStatus,
        scheduledAt: scheduledAtValue,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "YouTube 업로드 작업 등록에 실패했습니다.");
      setLoading(false);
      return;
    }
    window.location.href = `/dashboard?run=${encodeURIComponent(runId)}&step=review`;
  }

  return (
    <div className="draft-action upload-job-action">
      <button className="text-button" disabled={loading} onClick={() => setOpen((value) => !value)} type="button">
        {loading ? <Loader2 className="spin" size={15} /> : <UploadCloud size={15} />}
        업로드 작업
      </button>
      {open ? (
        <div className="upload-job-popover">
          <div className="upload-job-header">
            <strong>업로드 작업</strong>
            <button className="icon-button" onClick={() => setOpen(false)} title="닫기" type="button">
              <X size={14} />
            </button>
          </div>
          <div className="upload-job-grid">
            <label>
              <span>공개 범위</span>
              <select
                onChange={(event) => setPrivacyStatus(event.target.value as PrivacyStatus)}
                value={privacyStatus}
              >
                {Object.entries(privacyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>예약 공개</span>
              <input
                onChange={(event) => setScheduledAt(event.target.value)}
                type="datetime-local"
                value={scheduledAt}
              />
            </label>
          </div>
          <label className="upload-job-check">
            <input
              checked={madeForKids}
              onChange={(event) => setMadeForKids(event.target.checked)}
              type="checkbox"
            />
            <span>아동용 콘텐츠</span>
          </label>
          <button className="text-button primary form-submit" disabled={loading} onClick={queueUploadJob} type="button">
            {loading ? <Loader2 className="spin" size={15} /> : <CalendarClock size={15} />}
            작업 큐 등록
          </button>
          {scheduledAt ? <p className="upload-job-note">예약 공개는 비공개 상태로 업로드됩니다.</p> : null}
        </div>
      ) : null}
      {error ? <span>{error}</span> : null}
    </div>
  );
}
