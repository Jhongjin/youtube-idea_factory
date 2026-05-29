import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileJson, Loader2 } from "lucide-react";
import { WorkerJobActions } from "@/app/components/worker-job-actions";
import type { RunWorkerStatus, WorkerStageStatus, WorkerStageStatusView } from "@/lib/worker-status";

const statusLabel: Record<WorkerStageStatus, string> = {
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
  pending: "대기",
  queued: "큐 등록",
  running: "실행 중",
  unknown: "상태 검토",
};

const statusClass: Record<WorkerStageStatus, "done" | "review" | "blocked" | "pending"> = {
  completed: "done",
  failed: "blocked",
  cancelled: "pending",
  pending: "pending",
  queued: "pending",
  running: "review",
  unknown: "review",
};

const statusIcon = {
  completed: CheckCircle2,
  failed: AlertTriangle,
  cancelled: Clock3,
  pending: Clock3,
  queued: Clock3,
  running: Loader2,
  unknown: AlertTriangle,
};

function formatDate(value: string) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(parsed);
}

function StageCard({ runId, stage }: { runId: string; stage: WorkerStageStatusView }) {
  const Icon = statusIcon[stage.status];
  const time = formatDate(stage.completedAt || stage.updatedAt || stage.createdAt);
  return (
    <div className="worker-status-card">
      <div className="worker-status-heading">
        <div>
          <h4>{stage.label}</h4>
          {time ? <p>{time}</p> : <p>작업 이력 없음</p>}
        </div>
        <span className={`status-pill ${statusClass[stage.status]}`}>
          <Icon className={stage.status === "running" ? "spin" : ""} size={14} />
          {statusLabel[stage.status]}
        </span>
      </div>
      <div className="worker-status-meta">
        {stage.jobId ? (
          <div>
            <span>작업 ID</span>
            <strong>{stage.jobId}</strong>
          </div>
        ) : null}
        {stage.jobPath ? (
          <div>
            <span>작업 파일</span>
            <strong>{stage.jobPath}</strong>
          </div>
        ) : null}
        {stage.logPath ? (
          <div>
            <span>로그 파일</span>
            <strong>{stage.logPath}</strong>
          </div>
        ) : null}
        {stage.queue ? (
          <>
            <div>
              <span>큐 상태</span>
              <strong>{stage.queue.status}</strong>
            </div>
            <div>
              <span>시도</span>
              <strong>{stage.queue.attempts}</strong>
            </div>
          </>
        ) : null}
      </div>
      {stage.error || stage.queue?.lastError ? (
        <p className="worker-status-error">
          <AlertTriangle size={14} />
          {stage.error || stage.queue?.lastError}
        </p>
      ) : null}
      {stage.details.length > 0 ? (
        <div className="worker-status-details">
          {stage.details.map((detail) => (
            <div key={`${stage.label}-${detail.label}`}>
              <span>{detail.label}</span>
              {detail.href ? (
                <a href={detail.href} rel="noreferrer" target="_blank">
                  {detail.value}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <strong>{detail.value}</strong>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="worker-status-empty">
          <FileJson size={14} />
          아직 완료 로그가 없습니다.
        </p>
      )}
      {stage.queue?.id ? (
        <WorkerJobActions jobId={stage.queue.id} runId={runId} status={stage.queue.status} />
      ) : null}
    </div>
  );
}

export function WorkerStatusPanel({ runId, status }: { runId: string; status: RunWorkerStatus }) {
  return (
    <section className="worker-status-panel">
      <StageCard runId={runId} stage={status.render} />
      <StageCard runId={runId} stage={status.upload} />
    </section>
  );
}
