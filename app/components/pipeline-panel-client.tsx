"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Circle } from "lucide-react";

type StageStatus = "done" | "review" | "blocked" | "pending";

export type PipelineStageView = {
  meta: string;
  name: string;
  status: StageStatus;
};

type AssetTransition = "approved" | "skipped";

const statusCopy: Record<StageStatus, string> = {
  blocked: "검토 및 승인 대기",
  done: "완료",
  pending: "할 일",
  review: "확인",
};

const pipelineStageTargets = [
  { href: "#next-action", label: "기획 보기" },
  { href: "#youtube-finder", label: "소스 수집" },
  { href: "#artifact-video-analysis", label: "분석 보기" },
  { href: "#artifact-claim-ledger", label: "클레임 보기" },
  { href: "#artifact-script-plan", label: "스크립트" },
  { href: "#artifact-storyboard", label: "연출 설계" },
  { href: "#media-workboard", label: "에셋 작업판" },
  { href: "#artifact-publishing", label: "메타데이터" },
  { href: "#artifact-youtube-upload-job", label: "발행 컨펌" },
];

function PipelineStatusPill({
  localTransition,
  status,
}: {
  localTransition?: AssetTransition;
  status: StageStatus;
}) {
  if (localTransition === "approved") {
    return (
      <span aria-live="polite" className="status-pill done local-stage-pill">
        <CheckCircle2 size={13} />
        승인 반영
      </span>
    );
  }
  if (localTransition === "skipped") {
    return (
      <span aria-live="polite" className="status-pill skipped local-stage-pill">
        <Circle size={12} />
        건너뜀
      </span>
    );
  }
  const Icon = status === "done" ? CheckCircle2 : status === "blocked" ? AlertTriangle : Clock3;
  return (
    <span className={`status-pill ${status}`}>
      <Icon size={13} />
      {statusCopy[status]}
    </span>
  );
}

export function PipelinePanelClient({
  currentStageIndex,
  stages,
}: {
  currentStageIndex: number;
  stages: PipelineStageView[];
}) {
  const [assetTransition, setAssetTransition] = useState<AssetTransition | null>(null);
  const currentStageLabel = String(currentStageIndex + 1).padStart(2, "0");

  useEffect(() => {
    function handleAssetTransition(event: Event) {
      const detail = (event as CustomEvent<{ transition?: AssetTransition | null }>).detail;
      if (detail?.transition === "approved" || detail?.transition === "skipped") {
        setAssetTransition(detail.transition);
      } else if (detail?.transition === null) {
        setAssetTransition(null);
      }
    }
    window.addEventListener("yif:asset-state-transition", handleAssetTransition);
    return () => window.removeEventListener("yif:asset-state-transition", handleAssetTransition);
  }, []);

  return (
    <section className="panel pipeline-panel" id="pipeline-panel">
      <div className="panel-header">
        <h3 className="panel-title">제작 단계</h3>
        <span className="meta">현재 {currentStageLabel}</span>
      </div>
      <div className="panel-body">
        <div className="stage-list">
          {stages.map((stage, index) => {
            const target = pipelineStageTargets[index] ?? { href: "#next-action", label: "보기" };
            const isCurrent = index === currentStageIndex;
            const isMediaStage = index === 6;
            const localTransition = isMediaStage ? assetTransition : null;
            return (
              <a
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "stage-row",
                  isCurrent ? "current" : "",
                  localTransition === "approved" ? "local-approved" : "",
                  localTransition === "skipped" ? "local-skipped" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-stage-key={isMediaStage ? "media" : undefined}
                href={target.href}
                key={stage.name}
              >
                <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <p className="stage-name">{stage.name}</p>
                  <p className="stage-meta">{stage.meta}</p>
                </div>
                <div className="stage-row-action">
                  <span>{localTransition ? "중앙 작업 반영" : isCurrent ? "현재 위치" : target.label}</span>
                  <PipelineStatusPill localTransition={localTransition ?? undefined} status={stage.status} />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
