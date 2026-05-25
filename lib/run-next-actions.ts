import type { RunApprovals } from "@/lib/approvals";
import type { AssetGenerationState } from "@/lib/asset-generation-state";
import type { PackageValidationResult } from "@/lib/package-validation";
import type { ProductionPackage } from "@/lib/runs";
import type { RunWorkerStatus } from "@/lib/worker-status";

export type RunNextActionStatus = "done" | "review" | "blocked" | "pending";

export type RunPrimaryActionId =
  | "source-enrich"
  | "draft-flow"
  | "analysis-draft"
  | "analysis-refine"
  | "script-pattern-analysis"
  | "strategy-recommendations"
  | "script-draft"
  | "script-refine"
  | "storyboard-draft"
  | "media-draft"
  | "asset-manifest"
  | "generation-queue"
  | "subtitle-draft"
  | "render-manifest"
  | "render-job"
  | "local-render"
  | "publishing-draft"
  | "publishing-handoff"
  | "youtube-upload-job"
  | "performance-snapshot"
  | "feedback-flow"
  | "feedback-insights"
  | "learning-log"
  | "channel-memory"
  | "qa-draft"
  | "open-settings";

export type RunNextActionItem = {
  title: string;
  detail: string;
  status: RunNextActionStatus;
  command?: string;
};

export type RunNextActionPlan = {
  headline: string;
  detail: string;
  primaryActionId?: RunPrimaryActionId;
  secondaryActionIds?: RunPrimaryActionId[];
  stageIndex: number;
  stageLabel: string;
  totalStages: number;
  status: RunNextActionStatus;
  items: RunNextActionItem[];
};

const totalStages = 10;

function approvalReady(approval: RunApprovals[keyof RunApprovals]) {
  return approval.approved === true && approval.approved_by.trim() !== "" && approval.approved_at.trim() !== "";
}

function promptCount(pkg: ProductionPackage) {
  return (pkg.media_prompts.image_prompts?.length ?? 0) + (pkg.media_prompts.video_prompts?.length ?? 0);
}

function scriptPlanNotes(pkg: ProductionPackage) {
  return pkg.script_plan.notes ?? "";
}

function hasDownstreamDraftArtifacts(pkg: ProductionPackage) {
  return (
    pkg.storyboard.length > 0 ||
    promptCount(pkg) > 0 ||
    (pkg.publishing_package.title_candidates?.length ?? 0) > 0
  );
}

function hasScriptDraft(pkg: ProductionPackage) {
  const notes = scriptPlanNotes(pkg);
  return (
    notes.includes("Script draft generated") ||
    notes.includes("LLM-refined script plan generated") ||
    hasDownstreamDraftArtifacts(pkg)
  );
}

function hasStrategyRecommendations(pkg: ProductionPackage) {
  return scriptPlanNotes(pkg).includes("Source-based strategy recommendations generated") || hasScriptDraft(pkg);
}

function hasScriptPatternAnalysis(pkg: ProductionPackage) {
  return scriptPlanNotes(pkg).includes("TOP10 script pattern analysis generated") || hasStrategyRecommendations(pkg);
}

function hasTranscript(source: ProductionPackage["sources"][number]) {
  return (
    source.transcript_status === "manual_transcript" ||
    source.transcript_status === "external_transcript" ||
    source.transcript_status === "stt_transcript" ||
    source.transcript_status === "available"
  );
}

function step({
  detail,
  headline,
  items,
  primaryActionId,
  secondaryActionIds,
  stageIndex,
  stageLabel,
  status,
}: Omit<RunNextActionPlan, "totalStages">): RunNextActionPlan {
  return {
    detail,
    headline,
    items,
    primaryActionId,
    secondaryActionIds,
    stageIndex,
    stageLabel,
    status,
    totalStages,
  };
}

function firstFailures(validation: PackageValidationResult) {
  return validation.failures.slice(0, 3).map((failure) => ({
    detail: failure,
    status: "blocked" as const,
    title: "구조 실패",
  }));
}

export function getRunNextActionPlan({
  approvals,
  generationState,
  pkg,
  storageMode,
  validation,
  workerStatus,
}: {
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  pkg: ProductionPackage;
  storageMode: string;
  validation: PackageValidationResult;
  workerStatus: RunWorkerStatus;
}): RunNextActionPlan {
  if (validation.status === "fail") {
    return step({
      detail: `${validation.failures.length}개 구조 문제가 남아 있습니다.`,
      headline: "패키지 구조 보정",
      items: firstFailures(validation),
      primaryActionId: "qa-draft",
      stageIndex: 1,
      stageLabel: "패키지 보정",
      status: "blocked",
    });
  }

  if (pkg.sources.length === 0) {
    return step({
      detail: "소스 영상이 있어야 분석, 대본, 검수 흐름이 안정적으로 이어집니다.",
      headline: "소스 영상 수집",
      items: [
        {
          detail: "유튜브 파인더에서 후보를 검색한 뒤 선택한 영상을 소스로 가져오세요.",
          status: "pending",
          title: "유튜브 파인더",
        },
      ],
      primaryActionId: "source-enrich",
      stageIndex: 1,
      stageLabel: "리서치",
      status: "pending",
    });
  }

  const includedSources = pkg.sources.filter((source) => !source.analysis_excluded);
  const missingTranscripts = includedSources.filter((source) => !hasTranscript(source)).length;
  const analysisDraftGenerated = scriptPlanNotes(pkg).includes("Analysis draft generated at");
  if (missingTranscripts > 0 && pkg.claim_ledger.length === 0 && !analysisDraftGenerated) {
    return step({
      detail: `${missingTranscripts}개 소스의 자막/스크립트가 미확인입니다. 분석 전에 소스 근거를 먼저 보강하세요.`,
      headline: "소스 보강",
      items: [
        {
          detail: "소스 보강을 실행하거나 소스 영상 패널에서 스크립트를 붙여넣고 저장하세요.",
          status: "review",
          title: "스크립트",
        },
      ],
      primaryActionId: "source-enrich",
      secondaryActionIds: ["analysis-draft"],
      stageIndex: 2,
      stageLabel: "소스 검토",
      status: "review",
    });
  }

  if (pkg.claim_ledger.length === 0) {
    return step({
      detail: "소스에서 훅, 구조, 확인할 주장을 먼저 뽑아야 대본과 검수가 안정적으로 이어집니다.",
      headline: "분석 초안 생성",
      items: [
        {
          detail: "분석 초안을 만든 뒤 근거가 필요한 항목을 검토하세요.",
          status: "pending",
          title: "영상 분석",
        },
      ],
      primaryActionId: "analysis-draft",
      secondaryActionIds: ["analysis-refine", "draft-flow"],
      stageIndex: 3,
      stageLabel: "영상 분석",
      status: "pending",
    });
  }

  if (!hasScriptPatternAnalysis(pkg)) {
    return step({
      detail: "분석된 소스들의 훅, 첫 30초, 전개, 시청 유지 장치, CTA 패턴을 먼저 뽑습니다.",
      headline: "대본 유형 분석",
      items: [
        {
          detail: "소스 구조를 베끼지 않고 참고할 패턴과 차별화 각도를 정리하세요.",
          status: "pending",
          title: "대본 유형",
        },
      ],
      primaryActionId: "script-pattern-analysis",
      secondaryActionIds: ["strategy-recommendations", "script-draft"],
      stageIndex: 3,
      stageLabel: "대본 전략",
      status: "pending",
    });
  }

  if (!hasStrategyRecommendations(pkg)) {
    return step({
      detail: "상위 소스의 패턴을 바탕으로 대상 시청자, 톤, 영상 각도, 추천 대본 구조를 고릅니다.",
      headline: "전략 추천",
      items: [
        {
          detail: "추천은 방향성 후보입니다. 최종 각도와 사실 사용은 사람이 검토해야 합니다.",
          status: "pending",
          title: "전략 추천",
        },
      ],
      primaryActionId: "strategy-recommendations",
      secondaryActionIds: ["script-draft", "script-refine"],
      stageIndex: 3,
      stageLabel: "대본 전략",
      status: "pending",
    });
  }

  if (!hasScriptDraft(pkg)) {
    return step({
      detail: "분석과 근거 목록을 바탕으로 훅, 각도, 전개 흐름을 만듭니다.",
      headline: "대본 초안 생성",
      items: [
        {
          detail: "대본 초안을 만든 뒤 AI 설정이 준비되어 있으면 대본 고도화를 실행하세요.",
          status: "pending",
          title: "대본 구성",
        },
      ],
      primaryActionId: "script-draft",
      secondaryActionIds: ["script-refine"],
      stageIndex: 4,
      stageLabel: "대본",
      status: "pending",
    });
  }

  if (pkg.storyboard.length === 0) {
    return step({
      detail: "대본 흐름을 장면, 내레이션, 화면 문구, 필요한 자료로 나눕니다.",
      headline: "스토리보드 생성",
      items: [
        {
          detail: "스토리보드가 있어야 장면별 이미지, 영상, 편집 순서를 정리할 수 있습니다.",
          status: "pending",
          title: "씬 카드",
        },
      ],
      primaryActionId: "storyboard-draft",
      stageIndex: 5,
      stageLabel: "스토리보드",
      status: "pending",
    });
  }

  if (promptCount(pkg) === 0) {
    return step({
      detail: "스토리보드를 이미지와 영상 제작 요청으로 바꿉니다.",
      headline: "미디어 요청서 만들기",
      items: [
        {
          detail: "생성 비용이 발생하기 전 만들 내용을 먼저 확인할 수 있게 정리합니다.",
          status: "pending",
          title: "미디어 요청서",
        },
      ],
      primaryActionId: "media-draft",
      stageIndex: 6,
      stageLabel: "미디어 설계",
      status: "pending",
    });
  }

  if ((pkg.publishing_package.title_candidates?.length ?? 0) === 0) {
    return step({
      detail: "제목 후보, 설명, 태그, 썸네일 문구를 먼저 작성합니다.",
      headline: "업로드 글 초안 만들기",
      items: [
        {
          detail: "최종 업로드 전에 다시 확인하므로 지금은 초안만 만듭니다.",
          status: "pending",
          title: "업로드 글",
        },
      ],
      primaryActionId: "publishing-draft",
      stageIndex: 7,
      stageLabel: "업로드 준비",
      status: "pending",
    });
  }

  if (pkg.qa.status === "blocked" || pkg.qa.blockers.length > 0) {
    return step({
      detail: `${pkg.qa.blockers.length}개 확인할 항목이 남아 있습니다.`,
      headline: "남은 확인 항목 해결",
      items: pkg.qa.blockers.slice(0, 3).map((blocker) => ({
        detail: blocker,
        status: "blocked",
        title: "확인 항목",
      })),
      primaryActionId: "qa-draft",
      secondaryActionIds: ["analysis-refine", "script-refine"],
      stageIndex: 8,
      stageLabel: "최종 확인",
      status: "blocked",
    });
  }

  if (!generationState.manifestExists || !pkg.asset_manifest) {
    return step({
      detail: "스토리보드와 미디어 요청서를 바탕으로 필요한 이미지, 영상, 음성 목록을 만듭니다.",
      headline: "필요한 자료 정리",
      items: [
        {
          detail: "버튼을 누르면 장면별로 필요한 미디어가 정리됩니다.",
          status: "pending",
          title: "필요한 자료",
        },
      ],
      primaryActionId: "asset-manifest",
      stageIndex: 9,
      stageLabel: "미디어 준비",
      status: "pending",
    });
  }

  if (!approvalReady(approvals.generation)) {
    return step({
      detail: "이미지, 영상, 음성을 만들기 전에 사람의 승인이 필요합니다.",
      headline: "생성 승인",
      items: [
        {
          detail: "오른쪽 승인 카드에서 생성 승인을 저장하세요.",
          status: "review",
          title: "생성 승인",
        },
      ],
      primaryActionId: undefined,
      stageIndex: 9,
      stageLabel: "생성 승인",
      status: "review",
    });
  }

  if (!generationState.queueExists) {
    return step({
      detail: "승인과 API 설정을 확인해서 바로 만들 수 있는 항목과 막힌 항목을 나눕니다.",
      headline: "만들 항목 정리하기",
      items: [
        {
          detail: "버튼을 누르면 만들 수 있는 항목, 막힌 항목, 건너뛸 항목이 정리됩니다.",
          status: "pending",
          title: "생성 목록",
        },
      ],
      primaryActionId: "generation-queue",
      stageIndex: 9,
      stageLabel: "미디어 준비",
      status: "pending",
    });
  }

  if ((generationState.summary?.blocked ?? 0) > 0) {
    return step({
      detail: `${generationState.summary?.blocked ?? 0}개 항목이 API 설정이나 요청서 문제로 막혀 있습니다.`,
      headline: "막힌 항목 확인하기",
      items: generationState.items
        .filter((item) => item.blockers.length > 0)
        .slice(0, 3)
        .map((item) => ({
          detail: item.blockers.join(", "),
          status: "blocked" as const,
          title: item.id,
        })),
      primaryActionId: "open-settings",
      stageIndex: 9,
      stageLabel: "미디어 준비",
      status: "blocked",
    });
  }

  if ((generationState.summary?.ready ?? 0) > 0) {
    return step({
      detail: `${generationState.summary?.ready ?? 0}개 항목을 만들거나 수동으로 등록할 수 있습니다.`,
      headline: "미디어 만들기",
      items: [
        {
          detail: "오른쪽 생성 콘솔에서 직접 만들거나, 수동으로 만든 파일을 등록하세요.",
          status: "pending",
          title: "미디어 항목",
        },
      ],
      primaryActionId: undefined,
      stageIndex: 9,
      stageLabel: "미디어 만들기",
      status: "pending",
    });
  }

  if (!approvalReady(approvals.render)) {
    return step({
      detail: "최종 영상 조립 전에 영상 조립 승인이 필요합니다.",
      headline: "영상 조립 승인",
      items: [
        {
          detail: "오른쪽 승인 카드에서 영상 조립 승인을 저장하세요.",
          status: "review",
          title: "승인",
        },
      ],
      stageIndex: 10,
      stageLabel: "영상 조립",
      status: "review",
    });
  }

  if (!pkg.render_manifest) {
    return step({
      detail: "생성된 자료를 타임라인으로 묶어 최종 영상으로 조립할 수 있는지 확인합니다.",
      headline: "영상 조립 계획 만들기",
      items: [
        {
          detail: "영상 조립 계획 버튼으로 최종 조립 조건을 확인하세요.",
          status: "pending",
          title: "조립 전 확인",
        },
      ],
      primaryActionId: "render-manifest",
      stageIndex: 10,
      stageLabel: "영상 조립",
      status: "pending",
    });
  }

  if (pkg.render_manifest.blockers > 0 || !pkg.render_manifest.render_ready) {
    return step({
      detail: `${pkg.render_manifest.blockers}개 영상 조립에 필요한 항목이 남아 있습니다.`,
      headline: "영상 조립에 빠진 항목 확인",
      items: [
        {
          detail: "누락된 영상, 음성, 자막, BGM을 등록한 뒤 영상 조립 계획을 다시 만드세요.",
          status: "blocked",
          title: "조립 재료",
        },
      ],
      primaryActionId: "render-manifest",
      stageIndex: 10,
      stageLabel: "영상 조립",
      status: "blocked",
    });
  }

  if (workerStatus.render.status === "queued") {
    return step({
      detail: "영상 조립 작업이 등록되어 외부 작업자 실행을 기다립니다.",
      headline: "영상 조립 작업 실행",
      items: [
        {
          command: `npm run render:worker -- --next --confirm RUN_RENDER_WORKER --storage ${storageMode}`,
          detail: "로컬 또는 별도 작업자 환경에서 실행하세요.",
          status: "pending",
          title: "워커 명령",
        },
      ],
      stageIndex: 10,
      stageLabel: "영상 조립",
      status: "pending",
    });
  }

  if (workerStatus.render.status !== "completed") {
    return step({
      detail: "영상 조립 준비가 끝났습니다. 작업을 등록하거나 로컬 조립을 실행할 수 있습니다.",
      headline: "영상 조립 작업 만들기",
      items: [
        {
          detail: "영상 조립 등록 버튼으로 외부 작업을 만들거나 로컬 조립 버튼으로 테스트 영상을 만드세요.",
          status: "pending",
          title: "영상 조립",
        },
      ],
      primaryActionId: "render-job",
      secondaryActionIds: ["local-render"],
      stageIndex: 10,
      stageLabel: "영상 조립",
      status: "pending",
    });
  }

  if (!pkg.publishing_handoff?.ready) {
    return step({
      detail: "최종 파일, 썸네일, 제목, 설명, 태그를 업로드 준비 목록으로 묶습니다.",
      headline: "업로드 준비 목록 만들기",
      items: [
        {
          detail: "업로드 준비 버튼으로 업로드 전 체크리스트를 만드세요.",
          status: "pending",
          title: "업로드 준비",
        },
      ],
      primaryActionId: "publishing-handoff",
      stageIndex: 10,
      stageLabel: "업로드",
      status: "pending",
    });
  }

  if (!approvalReady(approvals.publish)) {
    return step({
      detail: "YouTube 업로드나 예약 게시 전에 게시 승인이 필요합니다.",
      headline: "게시 승인",
      items: [
        {
          detail: "오른쪽 승인 카드에서 게시 승인을 저장하세요.",
          status: "review",
          title: "승인",
        },
      ],
      stageIndex: 10,
      stageLabel: "업로드",
      status: "review",
    });
  }

  if (workerStatus.upload.status === "queued") {
    return step({
      detail: "업로드 작업이 등록되어 외부 작업자 실행을 기다립니다.",
      headline: "YouTube 업로드 작업자 실행",
      items: [
        {
          command: `npm run youtube:upload-worker -- --next --confirm RUN_YOUTUBE_UPLOAD --storage ${storageMode}`,
          detail: "OAuth refresh token은 youtube.upload scope가 있어야 합니다.",
          status: "pending",
          title: "워커 명령",
        },
      ],
      stageIndex: 10,
      stageLabel: "업로드",
      status: "pending",
    });
  }

  if (workerStatus.upload.status !== "completed") {
    return step({
      detail: "업로드 전 준비가 끝났습니다. 업로드 작업을 만들 수 있습니다.",
      headline: "YouTube 업로드 작업 생성",
      items: [
        {
          detail: "상단의 YouTube 업로드 작업 버튼으로 작업을 등록하세요.",
          status: "pending",
          title: "업로드 작업",
        },
      ],
      primaryActionId: "youtube-upload-job",
      stageIndex: 10,
      stageLabel: "업로드",
      status: "pending",
    });
  }

  return step({
    detail: pkg.publishing_handoff?.uploaded_video_url ?? "업로드 로그가 완료 상태입니다.",
    headline: "업로드 완료",
    items: [
      {
        detail: "피드백 루프에서 공개 지표를 수집하고 다음 콘텐츠 메모리로 반영하세요.",
        status: "done",
        title: "피드백 루프",
      },
    ],
    primaryActionId: "performance-snapshot",
    secondaryActionIds: ["feedback-flow", "feedback-insights", "learning-log", "channel-memory"],
    stageIndex: 10,
    stageLabel: "피드백",
    status: "done",
  });
}
