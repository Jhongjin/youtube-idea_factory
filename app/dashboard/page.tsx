import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Clapperboard,
  Image,
  KeyRound,
  ListChecks,
  Mic2,
  MoreHorizontal,
  PlayCircle,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { AbLearningLogButton } from "@/app/components/ab-learning-log-button";
import { AnalysisDraftButton } from "@/app/components/analysis-draft-button";
import { AnalysisRefineButton } from "@/app/components/analysis-refine-button";
import { AssetGenerationConsole } from "@/app/components/asset-generation-console";
import { AssetManifestButton } from "@/app/components/asset-manifest-button";
import { ArtifactWorkspace } from "@/app/components/artifact-workspace";
import { ChannelMemoryButton } from "@/app/components/channel-memory-button";
import { EditingHandoffButton } from "@/app/components/editing-handoff-button";
import { EnrichSourcesButton } from "@/app/components/enrich-sources-button";
import { FeedbackLoopFlowButton } from "@/app/components/feedback-loop-flow-button";
import { FeedbackInsightsButton } from "@/app/components/feedback-insights-button";
import { GenerationQueueButton } from "@/app/components/generation-queue-button";
import { MediaPromptDraftButton } from "@/app/components/media-prompt-draft-button";
import { LocalRenderButton } from "@/app/components/local-render-button";
import { NewRunForm } from "@/app/components/new-run-form";
import { PackageValidationPanel } from "@/app/components/package-validation-panel";
import { PerformanceSnapshotButton } from "@/app/components/performance-snapshot-button";
import { PublishingDraftButton } from "@/app/components/publishing-draft-button";
import { PublishingHandoffButton } from "@/app/components/publishing-handoff-button";
import { QaDraftButton } from "@/app/components/qa-draft-button";
import { RenderManifestButton } from "@/app/components/render-manifest-button";
import { RenderWorkerJobButton } from "@/app/components/render-worker-job-button";
import { RunDeleteButton } from "@/app/components/run-delete-button";
import { RunDraftFlowButton } from "@/app/components/run-draft-flow-button";
import { RunApprovalsPanel } from "@/app/components/run-approvals-panel";
import { ScriptDraftButton } from "@/app/components/script-draft-button";
import { ScriptPatternAnalysisButton } from "@/app/components/script-pattern-analysis-button";
import { ScriptRefineButton } from "@/app/components/script-refine-button";
import { SourceDeleteButton } from "@/app/components/source-delete-button";
import { SourceReviewQueue } from "@/app/components/source-review-queue";
import { SourceTranscriptPanel } from "@/app/components/source-transcript-panel";
import { StoryboardDraftButton } from "@/app/components/storyboard-draft-button";
import { StrategyRecommendationsButton } from "@/app/components/strategy-recommendations-button";
import { SubtitleDraftButton } from "@/app/components/subtitle-draft-button";
import { YouTubeFinderPanel } from "@/app/components/youtube-finder-panel";
import { YouTubeUploadJobButton } from "@/app/components/youtube-upload-job-button";
import { YouTubeUploadWorkerPanel } from "@/app/components/youtube-upload-worker-panel";
import { WorkerStatusPanel } from "@/app/components/worker-status-panel";
import { requireUser } from "@/lib/auth";
import { getRunApprovals, type ApprovalGate, type RunApprovals } from "@/lib/approvals";
import { getAssetGenerationState, type AssetGenerationState } from "@/lib/asset-generation-state";
import { getRunArtifacts } from "@/lib/artifacts";
import { getChannelMemoryIndex, type ChannelMemoryIndex } from "@/lib/channel-memory-index";
import { listYouTubeChannels, type SafeYouTubeChannel } from "@/lib/channels";
import { validateProductionPackage, type PackageValidationResult } from "@/lib/package-validation";
import { getSafeProviderSettings } from "@/lib/provider-settings";
import { providerRoles, type SafeProviderSettings } from "@/lib/provider-settings-shared";
import {
  getRunNextActionPlan,
  type RunNextActionPlan,
  type RunPrimaryActionId,
} from "@/lib/run-next-actions";
import { getRuns, getStageState, type RunSummary } from "@/lib/runs";
import { getAppStorageMode } from "@/lib/storage-mode";
import { getWorkQueueSummary, workQueueStatusCopy, type WorkQueueSummary } from "@/lib/work-queue";
import { getRunWorkerStatus, type RunWorkerStatus } from "@/lib/worker-status";

export const dynamic = "force-dynamic";

const skillItems = [
  "youtube-market-research",
  "youtube-video-analysis",
  "youtube-fact-check",
  "youtube-script-architect",
  "youtube-storyboard",
  "youtube-media-prompts",
  "youtube-production-qa",
];

const skillLabels: Record<string, string> = {
  "youtube-market-research": "시장 리서치",
  "youtube-video-analysis": "영상 분석",
  "youtube-fact-check": "팩트체크",
  "youtube-script-architect": "대본 설계",
  "youtube-storyboard": "스토리보드",
  "youtube-media-prompts": "미디어 프롬프트",
  "youtube-production-qa": "제작 검수",
};

const statusCopy = {
  done: "완료",
  review: "확인",
  blocked: "확인 필요",
  pending: "할 일",
};

const qaStatusCopy: Record<string, string> = {
  pass: "검수 통과",
  blocked: "확인 필요",
  needs_review: "검토 필요",
};

const feedbackStatusCopy: Record<string, string> = {
  learning: "학습 중",
  needs_more_data: "데이터 필요",
  strong_signal: "강한 신호",
  watch: "주의 관찰",
};

const approvalGateLabels: Record<ApprovalGate, string> = {
  generation: "생성 승인",
  render: "영상 조립 승인",
  publish: "게시 승인",
};

const guidedStepDefinitions = [
  {
    description: "채널과 이번 영상 주제를 확인합니다.",
    key: "setup",
    label: "채널/주제",
  },
  {
    description: "후보 영상과 근거를 먼저 채웁니다.",
    key: "research",
    label: "소스 찾기",
  },
  {
    description: "분석, 대본, 스토리보드를 만듭니다.",
    key: "draft",
    label: "대본 만들기",
  },
  {
    description: "이미지, 영상, 음성 생성 준비를 합니다.",
    key: "production",
    label: "미디어 만들기",
  },
  {
    description: "검수, 편집, 영상 조립, 업로드를 진행합니다.",
    key: "review",
    label: "검수/업로드",
  },
] as const;

type GuidedStepKey = (typeof guidedStepDefinitions)[number]["key"];

function guidedStepIndex(stepKey: GuidedStepKey) {
  return guidedStepDefinitions.findIndex((step) => step.key === stepKey);
}

const guidedArtifactFocus: Record<Exclude<GuidedStepKey, "setup" | "research">, string[]> = {
  draft: [
    "video-analysis",
    "script-patterns",
    "claim-ledger",
    "strategy-recommendations",
    "script-plan",
    "storyboard",
  ],
  production: ["storyboard", "media-prompts"],
  review: [
    "publishing",
    "qa",
    "render-edl",
    "youtube-upload-job",
    "performance-snapshot",
    "feedback-insights",
    "ab-learning-log",
    "channel-memory-update",
  ],
};

const actionArtifactFocus: Partial<Record<RunPrimaryActionId, string[]>> = {
  "analysis-draft": ["video-analysis", "claim-ledger"],
  "analysis-refine": ["video-analysis", "claim-ledger"],
  "asset-manifest": ["media-prompts"],
  "channel-memory": ["channel-memory-update"],
  "draft-flow": ["video-analysis", "claim-ledger", "script-plan"],
  "feedback-flow": ["performance-snapshot", "feedback-insights"],
  "feedback-insights": ["feedback-insights"],
  "generation-queue": ["media-prompts"],
  "learning-log": ["ab-learning-log"],
  "local-render": ["render-edl"],
  "media-draft": ["media-prompts"],
  "performance-snapshot": ["performance-snapshot"],
  "publishing-draft": ["publishing"],
  "publishing-handoff": ["publishing", "youtube-upload-job"],
  "qa-draft": ["qa"],
  "render-job": ["render-edl"],
  "render-manifest": ["render-edl"],
  "script-draft": ["script-plan"],
  "script-pattern-analysis": ["script-patterns"],
  "script-refine": ["script-plan"],
  "storyboard-draft": ["storyboard"],
  "strategy-recommendations": ["strategy-recommendations"],
  "subtitle-draft": ["storyboard"],
  "youtube-upload-job": ["youtube-upload-job"],
};

function getCurrentArtifactFocus(plan: RunNextActionPlan, step: GuidedStepKey) {
  if (plan.primaryActionId && actionArtifactFocus[plan.primaryActionId]) {
    return actionArtifactFocus[plan.primaryActionId] ?? [];
  }
  if (step === "draft" || step === "production" || step === "review") {
    return guidedArtifactFocus[step];
  }
  return [];
}

function getArtifactWorkspaceCopy(plan: RunNextActionPlan, step: GuidedStepKey) {
  const currentGuide = plan.primaryActionId ? actionGuides[plan.primaryActionId] : undefined;
  if (currentGuide) {
    return {
      description: "지금 할 일과 연결된 결과만 먼저 보여줍니다.",
      title: `${currentGuide.title} 결과`,
    };
  }
  if (step === "production") {
    return {
      description: "승인이 끝나면 만들 수 있는 항목부터 이어서 정리합니다.",
      title: "미디어 만들기 결과",
    };
  }
  if (step === "review") {
    return {
      description: "최종 확인에 필요한 결과만 먼저 보여줍니다.",
      title: "검수와 업로드 결과",
    };
  }
  return {
    description: "지금 만들어야 하는 결과만 먼저 보여줍니다.",
    title: "이번 작업 결과",
  };
}

const actionGuides: Partial<
  Record<
    RunPrimaryActionId,
    {
      caution?: string;
      goal: string;
      output: string;
      title: string;
    }
  >
> = {
  "analysis-draft": {
    goal: "소스 영상의 훅, 구조, 주장 후보를 분석 초안으로 정리합니다.",
    output: "영상 분석과 근거 목록이 생깁니다.",
    title: "분석 초안",
  },
  "analysis-refine": {
    goal: "AI로 분석 내용을 다듬고 비어 있는 주장 후보를 보강합니다.",
    output: "영상 분석과 근거 목록이 더 정리됩니다.",
    title: "분석 고도화",
  },
  "script-pattern-analysis": {
    goal: "상위 소스의 훅, 첫 30초, 전개, 시청 유지, CTA 패턴을 요약합니다.",
    output: "대본 유형 탭에 저장됩니다.",
    title: "대본 유형 분석",
  },
  "strategy-recommendations": {
    goal: "소스 분석을 바탕으로 대상 시청자, 톤, 각도, 대본 구조를 추천합니다.",
    output: "전략 추천 탭에 저장됩니다.",
    title: "전략 추천",
  },
  "asset-manifest": {
    goal: "장면별로 필요한 이미지, 영상, 음성, 자막, 썸네일 목록을 만듭니다.",
    output: "장면별로 만들 항목이 정리됩니다.",
    title: "필요한 자료 정리",
  },
  "channel-memory": {
    goal: "성과와 운영 메모를 다음 기획에 쓸 채널 기억으로 저장합니다.",
    output: "채널 메모리에 반영됩니다.",
    title: "채널 메모리",
  },
  "draft-flow": {
    goal: "분석, 근거 목록, 대본 초안 틀을 한 번에 준비합니다.",
    output: "분석, 근거 목록, 대본 초안 틀이 채워집니다.",
    title: "초안 흐름 만들기",
  },
  "feedback-flow": {
    goal: "업로드 뒤 성과를 모아 다음 기획에 반영할 흐름을 만듭니다.",
    output: "피드백 기록이 저장됩니다.",
    title: "피드백 흐름",
  },
  "feedback-insights": {
    goal: "성과 신호를 다음 제목, 훅, 포맷 의사결정으로 요약합니다.",
    output: "성과 인사이트가 저장됩니다.",
    title: "성과 인사이트",
  },
  "generation-queue": {
    goal: "승인과 API 설정을 확인해 바로 만들 수 있는 항목을 나눕니다.",
    output: "만들 수 있는 항목, 막힌 항목, 건너뛸 항목이 정리됩니다.",
    title: "만들 항목 정리",
  },
  "learning-log": {
    goal: "A/B 결과와 운영 판단을 다음 제작에 재사용할 기록으로 남깁니다.",
    output: "학습 로그가 저장됩니다.",
    title: "학습 로그",
  },
  "local-render": {
    goal: "로컬 ffmpeg로 테스트 영상을 조립합니다.",
    output: "조립 결과와 로그가 실행 기록에 남습니다.",
    title: "로컬 조립",
  },
  "media-draft": {
    goal: "스토리보드를 이미지와 영상 생성 프롬프트로 바꿉니다.",
    output: "이미지와 영상 생성 요청서가 저장됩니다.",
    title: "미디어 프롬프트",
  },
  "open-settings": {
    goal: "AI, 이미지, 영상, TTS, 편집 API 키와 모델을 점검합니다.",
    output: "API가 준비되면 생성 버튼과 워커 작업이 열립니다.",
    title: "API 설정 확인",
  },
  "performance-snapshot": {
    goal: "업로드된 영상의 성과 스냅샷을 수집할 준비를 합니다.",
    output: "성과 스냅샷이 저장됩니다.",
    title: "성과 스냅샷",
  },
  "publishing-draft": {
    goal: "제목 후보, 설명, 태그, 썸네일 문구를 먼저 만듭니다.",
    output: "업로드 전에 확인할 제목, 설명, 태그가 정리됩니다.",
    title: "배포 초안",
  },
  "publishing-handoff": {
    goal: "최종 파일과 업로드 정보를 업로드 준비 목록으로 묶습니다.",
    output: "YouTube 업로드 작업 생성 전 체크리스트가 만들어집니다.",
    title: "업로드 준비",
  },
  "qa-draft": {
    goal: "구조, 근거, 승인, 업로드 위험을 한 번 더 검사합니다.",
    output: "남은 확인 항목이 정리됩니다.",
    title: "제작 검수",
  },
  "render-job": {
    goal: "외부 작업자가 처리할 영상 조립 작업을 등록합니다.",
    output: "작업 목록과 영상 조립 상태에 표시됩니다.",
    title: "영상 조립 등록",
  },
  "render-manifest": {
    goal: "자료를 타임라인으로 묶고 영상 조립에 빠진 항목을 확인합니다.",
    output: "영상 조립 계획과 빠진 항목이 정리됩니다.",
    title: "영상 조립 계획",
  },
  "script-draft": {
    goal: "분석과 근거 목록을 바탕으로 대본 구조를 만듭니다.",
    output: "대본 초안이 저장됩니다.",
    title: "대본 초안",
  },
  "script-refine": {
    goal: "AI로 훅, 전개, 내레이션을 더 자연스럽게 다듬습니다.",
    output: "대본 초안이 새 버전으로 다듬어집니다.",
    title: "대본 고도화",
  },
  "source-enrich": {
    caution: "자막을 못 가져오면 아래 스크립트 입력칸에 직접 붙여넣으면 됩니다.",
    goal: "YouTube 후보 영상의 제목, 채널, 썸네일 같은 기본 정보를 다시 확인합니다.",
    output: "소스 영상 표와 리서치 문서가 새로 정리됩니다.",
    title: "소스 정보 보강",
  },
  "storyboard-draft": {
    goal: "대본을 장면, 내레이션, 화면 문구, 필요한 자료로 나눕니다.",
    output: "스토리보드가 저장되고 다음 미디어 준비로 이어집니다.",
    title: "스토리보드",
  },
  "subtitle-draft": {
    goal: "내레이션 초안을 자막 초안으로 바꿉니다.",
    output: "자막 초안이 저장됩니다.",
    title: "자막 초안",
  },
  "youtube-upload-job": {
    goal: "승인된 업로드 준비 목록을 YouTube 업로드 작업으로 등록합니다.",
    output: "업로드 작업 패널에서 상태를 확인합니다.",
    title: "YouTube 업로드 작업",
  },
};

const advancedActionGroupsByStep: Record<
  GuidedStepKey,
  { actionIds: RunPrimaryActionId[]; label: string }[]
> = {
  setup: [
    { actionIds: ["open-settings"], label: "준비" },
    { actionIds: ["source-enrich"], label: "리서치" },
  ],
  research: [
    { actionIds: ["source-enrich", "analysis-draft"], label: "리서치" },
    { actionIds: ["draft-flow"], label: "초안" },
  ],
  draft: [
    {
      actionIds: [
        "draft-flow",
        "analysis-draft",
        "analysis-refine",
        "script-pattern-analysis",
        "strategy-recommendations",
        "script-draft",
        "script-refine",
      ],
      label: "대본",
    },
    { actionIds: ["storyboard-draft", "qa-draft"], label: "스토리보드" },
  ],
  production: [
    { actionIds: ["media-draft", "asset-manifest", "generation-queue"], label: "미디어" },
    { actionIds: ["subtitle-draft", "render-manifest"], label: "조립 준비" },
  ],
  review: [
    {
      actionIds: ["qa-draft", "render-manifest", "render-job", "local-render"],
      label: "검수/조립",
    },
    {
      actionIds: [
        "publishing-draft",
        "publishing-handoff",
        "youtube-upload-job",
        "performance-snapshot",
        "feedback-flow",
        "feedback-insights",
        "learning-log",
        "channel-memory",
      ],
      label: "배포/피드백",
    },
  ],
};

const pipelineStageTargets = [
  { href: "#next-action", label: "현재 작업" },
  { href: "#youtube-finder", label: "후보 검색" },
  { href: "#artifact-video-analysis", label: "분석 탭" },
  { href: "#artifact-script-patterns", label: "유형 탭" },
  { href: "#artifact-claim-ledger", label: "근거 탭" },
  { href: "#artifact-strategy-recommendations", label: "추천 탭" },
  { href: "#artifact-script-plan", label: "대본 탭" },
  { href: "#artifact-storyboard", label: "씬 탭" },
  { href: "#artifact-media-prompts", label: "프롬프트 탭" },
  { href: "#artifact-publishing", label: "배포 탭" },
  { href: "#artifact-qa", label: "검수 탭" },
  { href: "#artifact-render-edl", label: "조립 계획" },
  { href: "#artifact-youtube-upload-job", label: "업로드 작업" },
  { href: "#artifact-feedback-insights", label: "피드백" },
  { href: "#artifact-channel-memory-update", label: "채널 메모리" },
];

function getCurrentPipelineStageIndex(plan: RunNextActionPlan) {
  if (
    plan.primaryActionId === "source-enrich" ||
    plan.stageLabel === "리서치" ||
    plan.stageLabel === "소스 검토"
  ) {
    return 1;
  }
  if (
    plan.primaryActionId === "analysis-draft" ||
    plan.primaryActionId === "analysis-refine" ||
    plan.primaryActionId === "draft-flow" ||
    plan.stageLabel === "영상 분석"
  ) {
    return 2;
  }
  if (
    plan.primaryActionId === "script-draft" ||
    plan.primaryActionId === "script-refine" ||
    plan.primaryActionId === "script-pattern-analysis" ||
    plan.primaryActionId === "strategy-recommendations" ||
    plan.stageLabel === "대본 전략" ||
    plan.stageLabel === "대본"
  ) {
    return 4;
  }
  if (plan.primaryActionId === "storyboard-draft" || plan.stageLabel === "스토리보드") {
    return 5;
  }
  if (
    plan.primaryActionId === "media-draft" ||
    plan.primaryActionId === "asset-manifest" ||
    plan.primaryActionId === "generation-queue" ||
    plan.primaryActionId === "subtitle-draft" ||
    plan.stageLabel === "미디어 설계" ||
    plan.stageLabel === "미디어 준비" ||
    plan.stageLabel === "자산 구성" ||
    plan.stageLabel === "자산 생성" ||
    plan.stageLabel === "미디어 만들기" ||
    plan.stageLabel === "생성 승인"
  ) {
    return 6;
  }
  if (
    plan.primaryActionId === "publishing-draft" ||
    plan.primaryActionId === "publishing-handoff" ||
    plan.primaryActionId === "youtube-upload-job" ||
    plan.stageLabel === "배포 초안" ||
    plan.stageLabel === "배포" ||
    plan.stageLabel === "피드백"
  ) {
    return 7;
  }
  if (plan.primaryActionId === "qa-draft" || plan.stageLabel === "검수" || plan.stageLabel === "패키지 보정") {
    return 8;
  }
  if (
    plan.primaryActionId === "render-manifest" ||
    plan.primaryActionId === "render-job" ||
    plan.primaryActionId === "local-render"
  ) {
    return 7;
  }
  return 0;
}

function defaultGuidedStep(plan?: RunNextActionPlan | null): GuidedStepKey {
  if (!plan) {
    return "setup";
  }
  if (
    plan.primaryActionId === "source-enrich" ||
    plan.stageLabel === "리서치" ||
    plan.stageLabel === "소스 검토"
  ) {
    return "research";
  }
  if (
    plan.primaryActionId === "analysis-draft" ||
    plan.primaryActionId === "analysis-refine" ||
    plan.primaryActionId === "draft-flow" ||
    plan.primaryActionId === "script-pattern-analysis" ||
    plan.primaryActionId === "strategy-recommendations" ||
    plan.primaryActionId === "script-draft" ||
    plan.primaryActionId === "script-refine" ||
    plan.primaryActionId === "storyboard-draft" ||
    plan.stageLabel === "영상 분석" ||
    plan.stageLabel === "대본 전략" ||
    plan.stageLabel === "대본" ||
    plan.stageLabel === "스토리보드"
  ) {
    return "draft";
  }
  if (
    plan.primaryActionId === "media-draft" ||
    plan.primaryActionId === "asset-manifest" ||
    plan.primaryActionId === "generation-queue" ||
    plan.primaryActionId === "subtitle-draft" ||
    plan.stageLabel === "미디어 설계" ||
    plan.stageLabel === "미디어 준비" ||
    plan.stageLabel === "자산 구성" ||
    plan.stageLabel === "자산 생성" ||
    plan.stageLabel === "미디어 만들기" ||
    plan.stageLabel === "생성 승인"
  ) {
    return "production";
  }
  if (
    plan.primaryActionId === "publishing-draft" ||
    plan.primaryActionId === "publishing-handoff" ||
    plan.primaryActionId === "youtube-upload-job" ||
    plan.primaryActionId === "qa-draft" ||
    plan.primaryActionId === "render-manifest" ||
    plan.primaryActionId === "render-job" ||
    plan.primaryActionId === "local-render" ||
    plan.stageLabel === "배포 초안" ||
    plan.stageLabel === "배포" ||
    plan.stageLabel === "피드백" ||
    plan.stageLabel === "검수" ||
    plan.stageLabel === "패키지 보정"
  ) {
    return "review";
  }
  return "setup";
}

const learningStatusCopy: Record<string, string> = {
  draft: "초안",
  needs_metrics: "지표 필요",
  ready_for_comparison: "비교 준비",
};

const memoryStatusCopy: Record<string, string> = {
  draft: "초안",
  ready: "준비됨",
};

const formatCopy: Record<string, string> = {
  shorts: "쇼츠",
  longform: "롱폼",
  explainer: "설명형",
  documentary: "다큐형",
};

const languageCopy: Record<string, string> = {
  ko: "한국어",
  en: "영어",
  ja: "일본어",
  es: "스페인어",
};

function runChannelLabel(run?: RunSummary) {
  const channel = run?.package.brief.channel;
  if (!channel) {
    return "채널 미지정";
  }
  return `${channel.brand_name} / ${channel.channel_name}`;
}

function runChannelId(run?: RunSummary) {
  return run?.package.brief.channel?.id ?? "";
}

function approvalReady(approval: RunApprovals[ApprovalGate]) {
  return approval.approved === true && approval.approved_by.trim() !== "" && approval.approved_at.trim() !== "";
}

function activeApprovalGate(plan: RunNextActionPlan): ApprovalGate | null {
  if (plan.headline.includes("생성 승인")) {
    return "generation";
  }
  if (plan.headline.includes("영상 조립 승인") || plan.headline.includes("렌더 승인")) {
    return "render";
  }
  if (plan.headline.includes("게시 승인")) {
    return "publish";
  }
  return null;
}

function inspectorDecision({
  plan,
  run,
  validation,
}: {
  plan: RunNextActionPlan;
  run: RunSummary;
  validation: PackageValidationResult;
}) {
  if (validation.status === "fail") {
    return {
      detail: "제작 자료를 다시 확인해야 다음 작업으로 넘어갈 수 있습니다.",
      label: "검토 필요",
      tone: "blocked",
    };
  }
  if (run.package.qa.blockers.length > 0 || plan.status === "blocked") {
    return {
      detail: "막힌 항목을 줄인 뒤 다시 검수하거나 다음 단계로 이동하세요.",
      label: "확인 필요",
      tone: "blocked",
    };
  }
  if (plan.status === "review") {
    return {
      detail: "외부 비용, 영상 조립, 업로드 전에 사람 확인이 필요한 상태입니다.",
      label: "검토 필요",
      tone: "review",
    };
  }
  if (plan.status === "done") {
    return {
      detail: "업로드 이후 성과 수집과 다음 기획 반영 단계입니다.",
      label: "완료",
      tone: "done",
    };
  }
  return {
    detail: "지금 보이는 큰 버튼을 실행하면 다음 작업으로 넘어갑니다.",
    label: "진행 가능",
    tone: "pending",
  };
}

function dashboardHref(params: {
  allChannels?: boolean;
  channelId?: string;
  runId?: string;
  step?: string;
}) {
  const search = new URLSearchParams();
  if (params.runId) {
    search.set("run", params.runId);
  }
  if (params.allChannels) {
    search.set("channel", "all");
  } else if (params.channelId) {
    search.set("channel", params.channelId);
  }
  if (params.step) {
    search.set("step", params.step);
  }
  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

const statusIcons = {
  done: CheckCircle2,
  review: AlertTriangle,
  blocked: AlertTriangle,
  pending: PlayCircle,
};

function StatusPill({ status }: { status: "done" | "review" | "blocked" | "pending" }) {
  const Icon = statusIcons[status];
  return (
    <span className={`status-pill ${status}`} title={statusCopy[status]}>
      <Icon size={14} />
      {statusCopy[status]}
    </span>
  );
}

function ChannelMemoryIndexPanel({ index }: { index: ChannelMemoryIndex }) {
  const topExperiment = index.next_experiments[0]?.text ?? "아직 누적 실험 메모리가 없습니다";
  return (
    <section className="nav-section channel-memory-index">
      <h2>채널 메모리</h2>
      <div className="memory-index-card">
        <div className="memory-index-heading">
          <Brain size={16} />
          <strong>
            {index.ready_update_count}/{index.run_count} 준비
          </strong>
        </div>
        <p>{topExperiment}</p>
        <div className="memory-index-stats">
          <span>업데이트 {index.update_count}</span>
          <span>대기 {index.skipped_runs}</span>
        </div>
      </div>
    </section>
  );
}

function WorkQueuePanel({ summary }: { summary: WorkQueueSummary }) {
  const nextItem = summary.nextItem;
  return (
    <section className="nav-section work-queue-index">
      <h2>남은 작업</h2>
      <div className="work-queue-card">
        <div className="work-queue-heading">
          <ListChecks size={16} />
          <strong>{summary.codexReady}개 진행 가능</strong>
          <span>{summary.externalBlocked}개 외부 대기</span>
        </div>
        <p>{nextItem ? nextItem.title : "현재 Codex가 바로 진행할 작업이 없습니다"}</p>
        <div className="work-queue-stats">
          <span>
            {workQueueStatusCopy.next} {summary.next}
          </span>
          <span>
            {workQueueStatusCopy.deferred} {summary.deferred}
          </span>
          <span>
            {workQueueStatusCopy.done} {summary.done}
          </span>
        </div>
      </div>
    </section>
  );
}

function OperatingChannelBar({
  activeStep,
  allRuns,
  channels,
  selectedChannelId,
}: {
  activeStep: GuidedStepKey;
  allRuns: RunSummary[];
  channels: SafeYouTubeChannel[];
  selectedChannelId: string;
}) {
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const selectedRunCount = selectedChannel
    ? allRuns.filter((run) => runChannelId(run) === selectedChannel.id).length
    : allRuns.length;
  const channelStatus =
    selectedChannel?.status === "active"
      ? "운영 중"
      : selectedChannel?.status === "paused"
        ? "일시중지"
        : selectedChannel
          ? "설정 중"
          : "전체 보기";
  const uploadTokenStatus = selectedChannel
    ? selectedChannel.has_upload_refresh_token
      ? "업로드 OAuth 준비"
      : "업로드 OAuth 필요"
    : "채널 선택 권장";
  const selectedChannelLabel = selectedChannel
    ? `${selectedChannel.channel_name}${selectedChannel.youtube_handle ? ` / ${selectedChannel.youtube_handle}` : ""}`
    : "전체 채널의 실행 기록을 보고 있습니다.";
  const channelUploadNudge = selectedChannel
    ? selectedChannel.status !== "active"
      ? {
          detail: selectedChannel.has_upload_refresh_token
            ? "토큰은 준비됐지만 채널 상태가 설정 중입니다. 업로드 전 운영 중으로 바꿔주세요."
            : "업로드 전에 채널 상태를 운영 중으로 바꾸고 업로드 OAuth 토큰을 등록해야 합니다.",
          tone: "setup",
          title: "업로드 전 채널 활성화 필요",
        }
      : !selectedChannel.has_upload_refresh_token
        ? {
            detail: "이 채널로 업로드하려면 업로드 OAuth refresh token을 먼저 등록해야 합니다.",
            tone: "missing",
            title: "업로드 OAuth 토큰 필요",
          }
        : null
    : null;
  return (
    <section className="operating-channel-bar" aria-label="운영 채널 선택">
      <div className="operating-channel-primary">
        <p className="eyebrow">운영 채널</p>
        <h2>{selectedChannel ? selectedChannel.brand_name : "전체 실행"}</h2>
        <span>{selectedChannelLabel}</span>
      </div>
      <div className="operating-channel-meta">
        <span>{channelStatus}</span>
        <span className={selectedChannel?.has_upload_refresh_token ? "ready" : "needs-setup"}>
          {uploadTokenStatus}
        </span>
        <strong>{selectedRunCount}개 실행</strong>
        <Link className="text-button" href="/admin/channels">
          <Settings size={15} />
          채널 관리
        </Link>
      </div>
      <details className="operating-channel-switcher" open={!selectedChannel}>
        <summary>
          <span>{selectedChannel ? "채널 변경" : "채널 선택"}</span>
          <strong>{channels.length}개 채널</strong>
        </summary>
        <div className="operating-channel-selector" role="list" aria-label="운영 채널">
          <Link
            aria-current={selectedChannel ? undefined : "page"}
            className={`operating-channel-option ${selectedChannel ? "" : "active"}`}
            href={dashboardHref({ allChannels: true, step: activeStep })}
            role="listitem"
          >
            <strong>전체 실행</strong>
            <span>{allRuns.length}개</span>
          </Link>
          {channels.map((channel) => {
            const runCount = allRuns.filter((run) => runChannelId(run) === channel.id).length;
            const active = channel.id === selectedChannel?.id;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`operating-channel-option ${active ? "active" : ""}`}
                href={dashboardHref({ channelId: channel.id, step: activeStep })}
                key={channel.id}
                role="listitem"
              >
                <strong>{channel.brand_name}</strong>
                <span>
                  {channel.channel_name}
                  {channel.youtube_handle ? ` / ${channel.youtube_handle}` : ""} / {runCount}개
                </span>
              </Link>
            );
          })}
        </div>
      </details>
      {channelUploadNudge ? (
        <div className={`operating-channel-nudge ${channelUploadNudge.tone}`}>
          <AlertTriangle size={17} />
          <div>
            <strong>{channelUploadNudge.title}</strong>
            <span>{channelUploadNudge.detail}</span>
          </div>
          <Link className="text-button" href="/admin/channels">
            채널 관리
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function GuidedStepNav({
  activeStep,
}: {
  activeStep: GuidedStepKey;
}) {
  const activeIndex = guidedStepIndex(activeStep);
  const activeStepCopy = guidedStepDefinitions[activeIndex] ?? guidedStepDefinitions[0];
  return (
    <nav className="guided-step-nav" aria-label="현재 제작 단계">
      <div className="guided-step-current">
        <span>
          {activeIndex + 1}/{guidedStepDefinitions.length}
        </span>
        <div>
          <strong>{activeStepCopy.label}</strong>
          <small>{activeStepCopy.description}</small>
        </div>
      </div>
    </nav>
  );
}

function GuidedActionPanel({
  plan,
  providerSettings,
  run,
}: {
  plan: RunNextActionPlan;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  const visibleActions = Array.from(
    new Set([plan.primaryActionId, ...(plan.secondaryActionIds ?? [])].filter(Boolean)),
  ) as RunPrimaryActionId[];
  const currentGuide = plan.primaryActionId ? actionGuides[plan.primaryActionId] : undefined;
  return (
    <section className="panel guided-action-panel" id="next-action">
      <div className="guided-action-main">
        <div>
          <p className="eyebrow">지금 할 일</p>
          <h3>{plan.headline}</h3>
          <p>{currentGuide?.goal ?? plan.detail}</p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="guided-action-buttons">
        <div className={`guided-primary-cta ${plan.primaryActionId ? "" : "manual"}`}>
          <div className="guided-primary-copy">
            <span>{plan.primaryActionId ? "만들어지는 결과" : "먼저 확인할 것"}</span>
            <strong>{currentGuide?.output ?? "확인이 끝나면 다음 버튼이 열립니다."}</strong>
            <small>
              {plan.primaryActionId
                ? "완료되면 아래 결과 영역에서 바로 확인할 수 있습니다."
                : "오른쪽 카드에서 필요한 확인을 저장하면 이어서 진행됩니다."}
            </small>
          </div>
          {plan.primaryActionId ? (
            <div className="guide-action-primary">
              <WorkflowActionButton
                actionId={plan.primaryActionId}
                providerSettings={providerSettings}
                run={run}
              />
            </div>
          ) : (
            <p className="next-action-note">오른쪽 승인 카드에서 확인을 저장하세요.</p>
          )}
        </div>
      </div>
      {visibleActions.length > 1 ? (
        <details className="guided-checklist">
          <summary>보조 버튼 보기</summary>
          <div className="guided-secondary-tool-list">
            {visibleActions
              .filter((actionId) => actionId !== plan.primaryActionId)
              .map((actionId) => (
                <WorkflowActionButton
                  actionId={actionId}
                  providerSettings={providerSettings}
                  run={run}
                  key={actionId}
                />
              ))}
          </div>
        </details>
      ) : null}
      <details className="guided-checklist">
        <summary>작업 설명 보기</summary>
        <div className="next-action-list">
          {plan.items.map((item) => (
            <div className="next-action-item" key={`${item.title}-${item.detail}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                {item.command ? <code>{item.command}</code> : null}
              </div>
              <StatusPill status={item.status} />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function GuidedRunWorkspace({
  activeStep,
  artifacts,
  channelId,
  nextActionPlan,
  providerSettings,
  run,
}: {
  activeStep: GuidedStepKey;
  artifacts: Awaited<ReturnType<typeof getRunArtifacts>>;
  channelId: string;
  nextActionPlan: RunNextActionPlan;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  const focusArtifactIds = getCurrentArtifactFocus(nextActionPlan, activeStep);
  const workspaceCopy = getArtifactWorkspaceCopy(nextActionPlan, activeStep);
  return (
    <div className="guided-workspace">
      <GuidedStepNav activeStep={activeStep} />
      <GuidedActionPanel plan={nextActionPlan} providerSettings={providerSettings} run={run} />

      {activeStep === "setup" ? (
        <>
          <SummaryGrid run={run} />
          <BriefPanel run={run} />
        </>
      ) : null}

      {activeStep === "research" ? (
        <ResearchStepPanel channelId={channelId} run={run} />
      ) : null}

      {activeStep === "draft" ? (
        <>
          <ArtifactWorkspace
            artifacts={artifacts}
            description={workspaceCopy.description}
            focusArtifactIds={focusArtifactIds}
            runId={run.id}
            title={workspaceCopy.title}
          />
          <details className="guided-secondary-panel">
            <summary>필요하면 소스 확인하기</summary>
            <div className="workspace-grid">
              <SourcesPanel run={run} />
            </div>
          </details>
        </>
      ) : null}

      {activeStep === "production" ? (
        <>
          <ArtifactWorkspace
            artifacts={artifacts}
            description={workspaceCopy.description}
            focusArtifactIds={focusArtifactIds}
            runId={run.id}
            title={workspaceCopy.title}
          />
          <details className="guided-secondary-panel">
            <summary>필요하면 준비 상태 보기</summary>
            <PipelinePanel nextActionPlan={nextActionPlan} run={run} />
          </details>
        </>
      ) : null}

      {activeStep === "review" ? (
        <>
          <ArtifactWorkspace
            artifacts={artifacts}
            description={workspaceCopy.description}
            focusArtifactIds={focusArtifactIds}
            runId={run.id}
            title={workspaceCopy.title}
          />
          <details className="guided-secondary-panel">
            <summary>필요하면 소스 확인하기</summary>
            <div className="workspace-grid">
              <SourcesPanel run={run} />
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

function ResearchStepPanel({ channelId, run }: { channelId: string; run: RunSummary }) {
  const hasSources = run.package.sources.length > 0;
  return (
    <>
      <div id="youtube-finder">
        <YouTubeFinderPanel
          channelId={channelId}
          defaultCategoryId={run.package.brief.category_id ?? ""}
          defaultCategoryTitle={run.package.brief.category ?? ""}
          defaultQuery={run.package.brief.topic}
          existingSources={run.package.sources}
          format={run.package.brief.format}
          language={run.package.brief.language}
          regionCode={run.package.brief.region_code ?? ""}
          runId={run.id}
          targetDurationSeconds={run.package.brief.target_duration_seconds ?? 60}
        />
      </div>
      <SourcesPanel run={run} showEnrichAction={hasSources} />
    </>
  );
}

function Sidebar({
  activeRun,
  activeChannelId,
  allRuns,
  channels,
  memoryIndex,
  runs,
  totalRuns,
  workQueueSummary,
}: {
  activeRun?: RunSummary;
  activeChannelId: string;
  allRuns: RunSummary[];
  channels: SafeYouTubeChannel[];
  memoryIndex: ChannelMemoryIndex;
  runs: RunSummary[];
  totalRuns: number;
  workQueueSummary: WorkQueueSummary;
}) {
  const activeChannel = channels.find((channel) => channel.id === activeChannelId);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Wand2 size={19} />
        </div>
        <div>
          <h1>YouTube Idea Factory</h1>
          <p>제작 운영</p>
        </div>
      </div>

      {channels.length > 0 ? (
        <details className="sidebar-disclosure channel-filter-disclosure">
          <summary>
            <span>운영 채널</span>
            <strong>{activeChannel ? activeChannel.brand_name : `${channels.length}개`}</strong>
          </summary>
          <div className="sidebar-disclosure-body">
            <div className="channel-filter-list">
              <Link
                className={`channel-filter ${activeChannelId ? "" : "active"}`}
                href={dashboardHref({ allChannels: true })}
              >
                <strong>전체 실행</strong>
                <span>{totalRuns}개</span>
              </Link>
              {channels.map((channel) => {
                const channelRuns = allRuns.filter((run) => runChannelId(run) === channel.id).length;
                return (
                  <Link
                    className={`channel-filter ${channel.id === activeChannelId ? "active" : ""}`}
                    href={dashboardHref({ channelId: channel.id })}
                    key={channel.id}
                  >
                    <strong>{channel.brand_name}</strong>
                    <span>
                      {channel.channel_name} / {channelRuns}개
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="channel-filter-note">
              {activeChannel
                ? `${activeChannel.channel_name} 기준으로 실행 기록을 보고 있습니다.`
                : "상단 운영 채널 바에서 먼저 채널을 고르면 새 제작에도 반영됩니다."}
            </p>
          </div>
        </details>
      ) : null}

      <section className="nav-section">
        <h2>{activeChannel ? "채널 실행 기록" : "실행 기록"}</h2>
        <div className="nav-list">
          {runs.slice(0, 5).map((run) => (
            <Link
              className={`run-card ${run.id === activeRun?.id ? "active" : ""}`}
              href={dashboardHref({ channelId: activeChannelId, runId: run.id })}
              key={run.id}
            >
              <strong>{run.package.brief.topic}</strong>
              <span>
                {runChannelLabel(run)} / {run.id}
              </span>
            </Link>
          ))}
          {runs.length === 0 ? <p className="muted">이 채널의 실행 기록이 없습니다</p> : null}
        </div>
      </section>

      <details className="sidebar-disclosure">
        <summary>
          <span>채널 메모리</span>
          <strong>
            {memoryIndex.ready_update_count}/{memoryIndex.run_count} 준비
          </strong>
        </summary>
        <div className="sidebar-disclosure-body">
          <ChannelMemoryIndexPanel index={memoryIndex} />
        </div>
      </details>

      <details className="sidebar-disclosure">
        <summary>
          <span>남은 작업</span>
          <strong>{workQueueSummary.deferred} 보류</strong>
        </summary>
        <div className="sidebar-disclosure-body">
          <WorkQueuePanel summary={workQueueSummary} />
        </div>
      </details>

      <details className="sidebar-disclosure">
        <summary>
          <span>자동화 도구</span>
          <strong>{skillItems.length}개</strong>
        </summary>
        <div className="sidebar-disclosure-body">
          <ul className="nav-list sidebar-automation-list">
            {skillItems.map((skill) => (
              <li key={skill} className="nav-item">
                <Sparkles size={15} />
                {skillLabels[skill] ?? skill}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </aside>
  );
}

function EmptyState({
  allRuns,
  channelName,
  channels,
  notice,
  selectedChannelId,
}: {
  allRuns: RunSummary[];
  channelName?: string;
  channels: SafeYouTubeChannel[];
  notice?: string;
  selectedChannelId: string;
}) {
  return (
    <main className="main">
      <DashboardNotice notice={notice} />
      <OperatingChannelBar
        activeStep="setup"
        allRuns={allRuns}
        channels={channels}
        selectedChannelId={selectedChannelId}
      />
      <div className="topbar">
        <div>
          <p className="eyebrow">1단계</p>
          <h2>{channelName ? `${channelName} 제작 작업공간` : "제작 작업공간"}</h2>
        </div>
      </div>
      <div className="empty-state">
        <div>
          <Rocket size={34} />
          <h3>{channelName ? "이 채널의 제작 실행이 없습니다" : "아직 제작 실행이 없습니다"}</h3>
          <p>
            {channelName
              ? "아래 새 제작 시작에서 이 운영 채널의 첫 실행을 시작하세요."
              : "새 제작을 시작하면 단계 흐름에 맞춰 여기에 표시됩니다."}
          </p>
        </div>
      </div>
      <NewRunPanel channels={channels} initialChannelId={selectedChannelId} />
    </main>
  );
}

const dashboardNoticeCopy: Record<
  string,
  { actionHref?: string; actionLabel?: string; detail: string; title: string; tone?: "error" | "success" }
> = {
  "admin-required": {
    actionHref: "/login?next=/admin",
    actionLabel: "관리자 로그인",
    detail: "회원 승인, 채널 OAuth, API 설정은 관리자 계정으로 로그인해야 열 수 있습니다.",
    title: "관리자 권한이 필요한 화면입니다.",
  },
  "analysis-drafted": {
    detail: "영상 분석과 근거 목록이 갱신됐습니다. 다음 단계가 열렸는지 확인하세요.",
    title: "분석 초안을 만들었습니다.",
    tone: "success",
  },
  "script-patterns": {
    detail: "상위 소스의 훅, 첫 30초, 전개, 시청 유지, 신뢰 장치, CTA 패턴을 대본 전략으로 정리했습니다.",
    title: "대본 유형 분석을 만들었습니다.",
    tone: "success",
  },
  "strategy-recommendations": {
    detail: "대상 시청자 5개, 톤 5개, 영상 각도 5개, 추천 대본 구조와 채널 필터를 생성했습니다.",
    title: "전략 추천을 만들었습니다.",
    tone: "success",
  },
  "sources-checked": {
    detail: "소스 정보를 확인했습니다. 자막/스크립트가 비어 있으면 아래 스크립트 입력칸에 붙여넣어야 합니다.",
    title: "소스 정보를 확인했습니다.",
    tone: "success",
  },
  "sources-enriched": {
    detail: "제목, 채널, 썸네일 등 소스 정보가 갱신됐습니다. 자막은 소스 영상 패널에서 별도로 확인하세요.",
    title: "소스 정보를 보강했습니다.",
    tone: "success",
  },
  "sources-imported": {
    detail: "검색 후보가 소스 영상 목록에 추가됐습니다. 다음으로 제목/채널 보강과 스크립트 입력칸을 확인하세요.",
    title: "후보 영상을 소스로 추가했습니다.",
    tone: "success",
  },
  "sources-deduped": {
    detail: "중복 URL과 video ID를 기준으로 소스 목록을 정리했습니다.",
    title: "중복 소스를 제거했습니다.",
    tone: "success",
  },
  "sources-excluded": {
    detail: "선택한 소스는 실행 기록에 보관되지만 분석 입력에서는 제외됩니다.",
    title: "선택 소스를 분석에서 제외했습니다.",
    tone: "success",
  },
  "sources-included": {
    detail: "선택한 소스를 다시 분석 입력에 포함했습니다.",
    title: "선택 소스를 분석에 포함했습니다.",
    tone: "success",
  },
  "sources-kept": {
    detail: "선택한 영상만 남기고 나머지 소스는 목록에서 제거했습니다.",
    title: "선택 영상만 유지했습니다.",
    tone: "success",
  },
  "sources-manual-imported": {
    detail: "입력한 URL이 소스 영상 목록에 추가됐습니다. 메타데이터 보강을 누르면 제목과 채널명을 확인합니다.",
    title: "수동 URL을 소스로 추가했습니다.",
    tone: "success",
  },
  "sources-partial": {
    detail: "일부 영상은 YouTube 메타데이터를 가져오지 못했습니다. 소스 목록을 보고 직접 보강해 주세요.",
    title: "소스 일부만 보강됐습니다.",
  },
  "transcript-fetched": {
    detail: "선택한 소스의 공개 자막을 가져왔습니다. 스크립트 입력칸에서 내용을 확인하세요.",
    title: "자막을 가져왔습니다.",
    tone: "success",
  },
  "transcripts-batch-fetched": {
    detail: "자막이 필요한 소스를 순차 처리했습니다. 실패 항목이 있으면 실패만 재시도할 수 있습니다.",
    title: "배치 자막 수집을 완료했습니다.",
    tone: "success",
  },
  "transcripts-batch-partial": {
    detail: "일부 소스는 공개 자막이 없거나 자막 API 오류가 있어 실패했습니다. 실패만 재시도하거나 수동 입력/STT를 사용하세요.",
    title: "일부 자막 수집이 실패했습니다.",
  },
};

function DashboardNotice({ notice }: { notice?: string }) {
  const copy = notice ? dashboardNoticeCopy[notice] : undefined;
  if (!copy) {
    return null;
  }
  return (
    <section className={`dashboard-notice ${copy.tone ?? ""}`} aria-label="작업 안내">
      <ShieldCheck size={18} />
      <div>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
      {copy.actionHref && copy.actionLabel ? (
        <Link className="text-button" href={copy.actionHref}>
          {copy.actionLabel}
        </Link>
      ) : null}
    </section>
  );
}

function SummaryGrid({ run }: { run: RunSummary }) {
  const pkg = run.package;
  const promptCount =
    (pkg.media_prompts.image_prompts?.length ?? 0) +
    (pkg.media_prompts.video_prompts?.length ?? 0);
  return (
    <section className="summary-grid" aria-label="실행 요약">
      <div className="stat">
        <p className="stat-label">소스</p>
        <p className="stat-value">
          <Search size={19} />
          {pkg.sources.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">근거</p>
        <p className="stat-value">
          <ShieldCheck size={19} />
          {pkg.claim_ledger.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">씬</p>
        <p className="stat-value">
          <Clapperboard size={19} />
          {pkg.storyboard.length}
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">프롬프트</p>
        <p className="stat-value">
          <Image size={19} />
          {promptCount}
        </p>
      </div>
    </section>
  );
}

function WorkflowActionButton({
  actionId,
  providerSettings,
  run,
}: {
  actionId: RunPrimaryActionId;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  const runId = run.id;
  switch (actionId) {
    case "source-enrich":
      return <EnrichSourcesButton runId={runId} />;
    case "draft-flow":
      return <RunDraftFlowButton runId={runId} />;
    case "analysis-draft":
      return <AnalysisDraftButton runId={runId} />;
    case "analysis-refine":
      return <AnalysisRefineButton providerSettings={providerSettings} runId={runId} />;
    case "script-pattern-analysis":
      return <ScriptPatternAnalysisButton runId={runId} />;
    case "strategy-recommendations":
      return <StrategyRecommendationsButton providerSettings={providerSettings} runId={runId} />;
    case "script-draft":
      return <ScriptDraftButton runId={runId} />;
    case "script-refine":
      return <ScriptRefineButton providerSettings={providerSettings} runId={runId} />;
    case "storyboard-draft":
      return <StoryboardDraftButton runId={runId} />;
    case "media-draft":
      return <MediaPromptDraftButton runId={runId} />;
    case "asset-manifest":
      return <AssetManifestButton runId={runId} />;
    case "generation-queue":
      return <GenerationQueueButton runId={runId} />;
    case "subtitle-draft":
      return <SubtitleDraftButton runId={runId} />;
    case "render-manifest":
      return <RenderManifestButton runId={runId} />;
    case "render-job":
      return <RenderWorkerJobButton runId={runId} />;
    case "local-render":
      return <LocalRenderButton runId={runId} />;
    case "publishing-draft":
      return <PublishingDraftButton runId={runId} />;
    case "publishing-handoff":
      return <PublishingHandoffButton runId={runId} />;
    case "youtube-upload-job":
      return <YouTubeUploadJobButton runId={runId} />;
    case "performance-snapshot":
      return (
        <PerformanceSnapshotButton
          runId={runId}
          videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
        />
      );
    case "feedback-flow":
      return (
        <FeedbackLoopFlowButton
          runId={runId}
          videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
        />
      );
    case "feedback-insights":
      return <FeedbackInsightsButton runId={runId} />;
    case "learning-log":
      return <AbLearningLogButton runId={runId} />;
    case "channel-memory":
      return <ChannelMemoryButton runId={runId} />;
    case "qa-draft":
      return <QaDraftButton runId={runId} />;
    case "open-settings":
      return (
        <Link className="text-button primary" href="/settings">
          <Settings size={15} />
          API 설정
        </Link>
      );
  }
}

function sourceHasTranscript(source: RunSummary["package"]["sources"][number]) {
  return (
    source.transcript_status === "manual_transcript" ||
    source.transcript_status === "external_transcript" ||
    source.transcript_status === "stt_transcript" ||
    source.transcript_status === "available"
  );
}

function AdvancedActionMenu({
  activeStep,
  providerSettings,
  run,
}: {
  activeStep: GuidedStepKey;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  const groups = advancedActionGroupsByStep[activeStep];
  return (
    <details className="advanced-action-menu">
      <summary aria-label="고급 도구" className="icon-button advanced-action-trigger" title="고급 도구">
        <MoreHorizontal size={16} />
      </summary>
      <div className="advanced-action-grid contextual">
        {groups.map((group) => (
          <div key={group.label}>
            <strong>{group.label}</strong>
            {group.actionIds.map((actionId) => (
              <WorkflowActionButton
                actionId={actionId}
                key={actionId}
                providerSettings={providerSettings}
                run={run}
              />
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

function PipelinePanel({ nextActionPlan, run }: { nextActionPlan: RunNextActionPlan; run: RunSummary }) {
  const stages = getStageState(run.package);
  const currentStageIndex = getCurrentPipelineStageIndex(nextActionPlan);
  return (
    <section className="panel" id="pipeline-panel">
      <div className="panel-header">
        <h3 className="panel-title">제작 단계</h3>
        <span className="meta">{qaStatusCopy[run.package.qa.status] ?? run.package.qa.status}</span>
      </div>
      <div className="panel-body">
        <div className="stage-list">
          {stages.map((stage, index) => {
            const target = pipelineStageTargets[index] ?? { href: "#next-action", label: "보기" };
            const isCurrent = index === currentStageIndex;
            return (
              <a
                aria-current={isCurrent ? "step" : undefined}
                className={`stage-row ${isCurrent ? "current" : ""}`}
                href={target.href}
                key={stage.name}
              >
                <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <p className="stage-name">{stage.name}</p>
                  <p className="stage-meta">{stage.meta}</p>
                </div>
                <div className="stage-row-action">
                  <span>{isCurrent ? "현재 단계" : target.label}</span>
                  <StatusPill status={stage.status} />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SourcesPanel({
  run,
  showEnrichAction = true,
}: {
  run: RunSummary;
  showEnrichAction?: boolean;
}) {
  return (
    <section className="panel" id="sources-panel">
      <div className="panel-header">
        <h3 className="panel-title">소스 영상</h3>
        <div className="toolbar">
          {showEnrichAction ? (
            <EnrichSourcesButton runId={run.id} />
          ) : (
            <span className="meta">상단 큰 버튼에서 보강</span>
          )}
          {run.package.sources.length > 0 ? (
            <SourceDeleteButton label="전체 삭제" mode="all" runId={run.id} />
          ) : null}
        </div>
      </div>
      <div className="panel-body">
        {run.package.sources.length > 0 ? (
          <>
            <SourceReviewQueue
              language={run.package.brief.language}
              runId={run.id}
              sources={run.package.sources}
            />
            <SourceTranscriptPanel runId={run.id} sources={run.package.sources} />
          </>
        ) : (
          <div className="source-empty-hint">
            아직 소스가 없습니다. 위에서 카테고리 후보를 찾거나 YouTube URL을 직접 추가하세요.
          </div>
        )}
      </div>
    </section>
  );
}

function narrationFromStoryboard(storyboard: unknown[]) {
  return storyboard
    .filter((item): item is { narration?: unknown } => typeof item === "object" && item !== null)
    .map((item) => (typeof item.narration === "string" ? item.narration.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function NewRunPanel({
  channels,
  initialChannelId = "",
}: {
  channels: SafeYouTubeChannel[];
  initialChannelId?: string;
}) {
  return (
    <section className="panel" id="new-run-panel">
      <div className="panel-header">
        <h3 className="panel-title">새 제작 시작</h3>
        <Rocket size={16} />
      </div>
      <div className="panel-body">
        <NewRunForm channels={channels} initialChannelId={initialChannelId} />
      </div>
    </section>
  );
}

function ProviderReadinessPanel({
  providerSettings,
}: {
  providerSettings: SafeProviderSettings;
}) {
  function preferredSetting(roleId: (typeof providerRoles)[number]["id"]) {
    const base = providerSettings.roles[roleId];
    return base.enabled
      ? base
      : providerSettings.profiles.find((profile) => profile.role === roleId && profile.enabled) ?? base;
  }
  const readyProviderCount =
    providerRoles.filter((role) => {
      const setting = preferredSetting(role.id);
      return setting.enabled && setting.hasApiKey;
    }).length;
  const totalProviderSlots = providerRoles.length;
  return (
    <section className="panel provider-readiness-panel">
      <div className="panel-header">
        <h3 className="panel-title">API 준비 상태</h3>
        <KeyRound size={16} />
      </div>
      <div className="panel-body">
        <div className="provider-readiness-list">
          <div className="provider-readiness-meter">
            <span>준비됨</span>
            <strong>
              {readyProviderCount}/{totalProviderSlots}
            </strong>
          </div>
          {providerRoles.map((role) => {
            const setting = preferredSetting(role.id);
            const statusClass = setting.enabled && setting.hasApiKey ? "ready" : setting.enabled ? "warning" : "off";
            const status = statusClass === "ready" ? "준비됨" : statusClass === "warning" ? "키 필요" : "꺼짐";
            return (
              <div className="provider-readiness-row" key={role.id}>
                <span>{role.label}</span>
                <strong className={`provider-readiness-status ${statusClass}`}>{status}</strong>
              </div>
            );
          })}
          <Link className="text-button form-submit" href="/settings">
            <Settings size={15} />
            API 설정
          </Link>
        </div>
      </div>
    </section>
  );
}

function BriefPanel({ run }: { run: RunSummary }) {
  const brief = run.package.brief;
  const channel = brief.channel;
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">실행 브리프</h3>
        <BarChart3 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>실행</span>
            <span>{run.id}</span>
          </div>
          <div className="detail-row">
            <span>주제</span>
            <span>{brief.topic}</span>
          </div>
          <div className="detail-row">
            <span>카테고리</span>
            <span>{brief.category || "미지정"}</span>
          </div>
          <div className="detail-row">
            <span>운영 채널</span>
            <span>{channel ? `${channel.brand_name} / ${channel.channel_name}` : "미지정"}</span>
          </div>
          {channel?.youtube_handle ? (
            <div className="detail-row">
              <span>YouTube 핸들</span>
              <span>{channel.youtube_handle}</span>
            </div>
          ) : null}
          <div className="detail-row">
            <span>형식</span>
            <span>{formatCopy[brief.format] ?? brief.format}</span>
          </div>
          <div className="detail-row">
            <span>언어</span>
            <span>{languageCopy[brief.language] ?? brief.language}</span>
          </div>
          <div className="detail-row">
            <span>길이</span>
            <span>{brief.target_duration_seconds ?? 0}s</span>
          </div>
          <RunDeleteButton runId={run.id} topic={brief.topic} />
        </div>
      </div>
    </section>
  );
}

function BlockersPanel({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) {
    return null;
  }
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">남은 확인 항목</h3>
        <AlertTriangle size={16} />
      </div>
      <div className="panel-body">
        <ul className="blocker-list">
          {blockers.map((blocker) => (
            <li key={blocker}>
              <AlertTriangle size={15} color="#b7791f" />
              <span>{blocker}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GenerationConsolePanel({
  generationState,
  providerSettings,
  run,
}: {
  generationState: AssetGenerationState;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  return (
    <section className="panel generation-console-panel">
      <div className="panel-header">
        <h3 className="panel-title">생성 콘솔</h3>
        <Sparkles size={16} />
      </div>
      <div className="panel-body">
        <AssetGenerationConsole
          defaultNarration={narrationFromStoryboard(run.package.storyboard)}
          providerSettings={providerSettings}
          runId={run.id}
          state={generationState}
        />
      </div>
    </section>
  );
}

function AssemblyPanel({
  providerSettings,
  run,
  storageMode,
  workerStatus,
}: {
  providerSettings: SafeProviderSettings;
  run: RunSummary;
  storageMode: string;
  workerStatus: RunWorkerStatus;
}) {
  const editingBase = providerSettings.roles.editing;
  const editingProfile = providerSettings.profiles.find((profile) => profile.role === "editing" && profile.enabled);
  const editingProvider = editingBase.enabled ? editingBase : editingProfile ?? editingBase;
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">영상 조립</h3>
        <Mic2 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>음성</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>자막</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>BGM</span>
            <span>대기</span>
          </div>
          <div className="detail-row">
            <span>영상 조립</span>
            <span>{run.package.render_manifest?.render_ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>편집/조립 방식</span>
            <span>
              {editingProvider.provider}
              {editingProvider.model ? ` / ${editingProvider.model}` : ""}
            </span>
          </div>
          <div className="detail-row">
            <span>편집 전달 파일</span>
            <span>{run.package.render_manifest?.editing_handoff_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>조립 계획</span>
            <span>{run.package.render_manifest?.edl_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>최종 파일</span>
            <span>{run.package.render_manifest?.rendered_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>영상 조립 작업</span>
            <span>{run.package.render_manifest?.worker_job_status ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>필요한 미디어</span>
            <span>{run.package.asset_manifest ? `${run.package.asset_manifest.items}개` : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>생성 가능</span>
            <span>{run.package.asset_manifest?.ready_for_generation ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>생성 보류</span>
            <span>{run.package.asset_manifest?.blocked ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>조립 확인</span>
            <span>{run.package.render_manifest?.blockers ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>업로드 준비</span>
            <span>{run.package.publishing_handoff?.ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>업로드 작업</span>
            <span>{run.package.publishing_handoff?.upload_job_status ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>업로드 채널</span>
            <span>{run.package.publishing_handoff?.upload_channel_name ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>공개/예약</span>
            <span>
              {run.package.publishing_handoff?.upload_privacy_status ?? "대기"}
              {run.package.publishing_handoff?.upload_scheduled_at
                ? ` / ${run.package.publishing_handoff.upload_scheduled_at}`
                : ""}
            </span>
          </div>
          <WorkerStatusPanel runId={run.id} status={workerStatus} />
          <EditingHandoffButton providerSettings={providerSettings} runId={run.id} />
          <YouTubeUploadWorkerPanel
            runId={run.id}
            storageMode={storageMode}
            uploadJobStatus={run.package.publishing_handoff?.upload_job_status}
          />
        </div>
      </div>
    </section>
  );
}

function FeedbackPanel({ run }: { run: RunSummary }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">피드백 루프</h3>
        <BarChart3 size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>영상 ID</span>
            <span>{run.package.feedback_loop?.video_id ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>조회수</span>
            <span>{run.package.feedback_loop?.view_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>좋아요</span>
            <span>{run.package.feedback_loop?.like_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>댓글</span>
            <span>{run.package.feedback_loop?.comment_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>수집 시각</span>
            <span>{run.package.feedback_loop?.fetched_at ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>누적 스냅샷</span>
            <span>{run.package.feedback_loop?.snapshot_count ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>CTR / 평균시청</span>
            <span>
              {run.package.feedback_loop?.analytics_ctr ?? "n/a"}% /{" "}
              {run.package.feedback_loop?.analytics_average_view_percentage ?? "n/a"}%
            </span>
          </div>
          <div className="detail-row">
            <span>주요 유입</span>
            <span>{run.package.feedback_loop?.analytics_top_traffic_source ?? "n/a"}</span>
          </div>
          <PerformanceSnapshotButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackLoopFlowButton
            runId={run.id}
            videoId={run.package.publishing_handoff?.uploaded_video_id ?? run.package.feedback_loop?.video_id}
          />
          <FeedbackInsightsButton runId={run.id} />
          <AbLearningLogButton runId={run.id} />
          <ChannelMemoryButton runId={run.id} />
          <div className="detail-row">
            <span>인사이트</span>
            <span>
              {run.package.feedback_insights?.status
                ? feedbackStatusCopy[run.package.feedback_insights.status] ??
                  run.package.feedback_insights.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>추천 항목</span>
            <span>{run.package.feedback_insights?.recommendations ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>A/B 로그</span>
            <span>
              {run.package.learning_log?.status
                ? learningStatusCopy[run.package.learning_log.status] ?? run.package.learning_log.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>변형 카드</span>
            <span>{run.package.learning_log?.variants ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>채널 메모리</span>
            <span>
              {run.package.channel_memory_update?.status
                ? memoryStatusCopy[run.package.channel_memory_update.status] ??
                  run.package.channel_memory_update.status
                : "대기"}
            </span>
          </div>
          <div className="detail-row">
            <span>메모리 항목</span>
            <span>{run.package.channel_memory_update?.items ?? 0}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageFocusPanel({
  approvals,
  plan,
  run,
  validation,
}: {
  approvals: RunApprovals;
  plan: RunNextActionPlan;
  run: RunSummary;
  validation: PackageValidationResult;
}) {
  const sourceCount = run.package.sources.length;
  const missingTranscripts = run.package.sources.filter(
    (source) => !source.analysis_excluded && !sourceHasTranscript(source),
  ).length;
  const decision = inspectorDecision({ plan, run, validation });
  const gate = activeApprovalGate(plan);
  const guidedStepKey = defaultGuidedStep(plan);
  const guidedStepPosition = Math.max(guidedStepIndex(guidedStepKey), 0);
  const guidedStep = guidedStepDefinitions[guidedStepPosition] ?? guidedStepDefinitions[0];
  const openApprovalCount = (Object.keys(approvals) as ApprovalGate[]).filter(
    (approvalGate) => !approvalReady(approvals[approvalGate]),
  ).length;
  return (
    <section className={`panel focus-inspector-panel ${decision.tone}`}>
      <div className="panel-header">
        <div>
          <h3 className="panel-title">이번 단계</h3>
          <p className="panel-subtitle">
            {guidedStepPosition + 1}/{guidedStepDefinitions.length} {guidedStep.label}
          </p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="panel-body">
        <div className="inspector-decision">
          <span>진행 상태</span>
          <strong>{decision.label}</strong>
          <p>{decision.detail}</p>
        </div>
        <div className="stage-focus-summary">
          <span>다음 작업</span>
          <strong>{plan.headline}</strong>
          <p>{plan.detail}</p>
        </div>
        {gate ? (
          <div className="approval-gate-summary">
            <span>{approvalGateLabels[gate]}</span>
            <strong>{approvalReady(approvals[gate]) ? "승인됨" : "승인 대기"}</strong>
            <p>{openApprovalCount}개 승인이 아직 남아 있습니다.</p>
          </div>
        ) : null}
        <details className="stage-focus-details">
          <summary>세부 항목 보기</summary>
          <div className="stage-focus-inputs compact">
            <div className="stage-focus-inputs-header">
              <p>{plan.stageLabel}</p>
              <span>{plan.items.length}개</span>
            </div>
            {plan.items.map((item) => (
              <div className="stage-focus-input" key={`${item.title}-${item.detail}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  {item.command ? <code>{item.command}</code> : null}
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </div>
          <div className="stage-focus-checks compact">
            <div>
              <span>소스</span>
              <strong>{sourceCount}</strong>
            </div>
            <div>
              <span>미확인 스크립트</span>
              <strong>{missingTranscripts}</strong>
            </div>
            <div>
              <span>근거</span>
              <strong>{run.package.claim_ledger.length}</strong>
            </div>
            <div>
              <span>씬</span>
              <strong>{run.package.storyboard.length}</strong>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function Inspector({
  run,
  validation,
  providerSettings,
  approvals,
  generationState,
  nextActionPlan,
  storageMode,
  workerStatus,
}: {
  run: RunSummary;
  validation: PackageValidationResult;
  providerSettings: SafeProviderSettings;
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  nextActionPlan: RunNextActionPlan;
  storageMode: string;
  workerStatus: RunWorkerStatus;
}) {
  const stage = nextActionPlan.stageLabel;
  const showApprovals = nextActionPlan.headline.includes("승인");
  const waitingForMainButton = Boolean(nextActionPlan.primaryActionId);
  const showGeneration = (stage === "자산 생성" || stage === "미디어 만들기") && !waitingForMainButton;
  const showAssembly = (stage === "영상 조립" || stage === "렌더" || stage === "배포") && !waitingForMainButton;
  const showFeedback = stage === "피드백" && !waitingForMainButton;
  const showProviderReadiness = nextActionPlan.primaryActionId === "open-settings";
  const showValidationImmediate = validation.status === "fail";
  const showBlockersImmediate =
    run.package.qa.blockers.length > 0 && (stage === "검수" || nextActionPlan.status === "blocked");

  return (
    <aside className="inspector">
      <div className="detail-stack">
        <StageFocusPanel approvals={approvals} plan={nextActionPlan} run={run} validation={validation} />

        {showValidationImmediate ? <PackageValidationPanel initialResult={validation} runId={run.id} /> : null}

        {showBlockersImmediate ? <BlockersPanel blockers={run.package.qa.blockers} /> : null}

        {showApprovals ? (
          <RunApprovalsPanel key={run.id} initialApprovals={approvals} runId={run.id} />
        ) : null}

        {showProviderReadiness ? (
          <details className="inspector-more">
            <summary>API 상태 보기</summary>
            <div className="detail-stack">
              <ProviderReadinessPanel providerSettings={providerSettings} />
            </div>
          </details>
        ) : null}

        {showGeneration ? (
          <details className="inspector-more">
            <summary>생성 버튼과 API 설정</summary>
            <div className="detail-stack">
              <GenerationConsolePanel
                generationState={generationState}
                providerSettings={providerSettings}
                run={run}
              />
            </div>
          </details>
        ) : null}

        {showAssembly ? (
          <details className="inspector-more">
            <summary>영상 조립 상태 보기</summary>
            <div className="detail-stack">
              <AssemblyPanel
                providerSettings={providerSettings}
                run={run}
                storageMode={storageMode}
                workerStatus={workerStatus}
              />
            </div>
          </details>
        ) : null}

        {showFeedback ? (
          <details className="inspector-more">
            <summary>성과 확인 도구 보기</summary>
            <div className="detail-stack">
              <FeedbackPanel run={run} />
            </div>
          </details>
        ) : null}

        <details className="inspector-more">
          <summary>고급 정보</summary>
          <div className="detail-stack">
            {!showValidationImmediate ? <PackageValidationPanel initialResult={validation} runId={run.id} /> : null}
            {!showBlockersImmediate ? <BlockersPanel blockers={run.package.qa.blockers} /> : null}
            <BriefPanel run={run} />
          </div>
        </details>
      </div>
    </aside>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ channel?: string; notice?: string; run?: string; step?: string }>;
}) {
  await requireUser({ redirectTo: "/login?next=/dashboard" });
  const runs = await getRuns();
  const channels = await listYouTubeChannels();
  const memoryIndex = await getChannelMemoryIndex(runs);
  const workQueueSummary = getWorkQueueSummary();
  const providerSettings = await getSafeProviderSettings();
  const params = searchParams ? await searchParams : {};
  const channelParam = params.channel?.trim() ?? "";
  const requestedAllChannels = channelParam === "all";
  const requestedChannelId = channels.some((channel) => channel.id === channelParam)
    ? channelParam
    : "";
  const defaultChannelId =
    !requestedAllChannels && !requestedChannelId && channels.length === 1 ? channels[0].id : "";
  const activeChannelId = requestedChannelId || defaultChannelId;
  const visibleRuns = activeChannelId
    ? runs.filter((run) => runChannelId(run) === activeChannelId)
    : runs;
  const activeChannel = channels.find((channel) => channel.id === activeChannelId);
  const requestedRun = params.run ? runs.find((run) => run.id === params.run) : undefined;
  const activeRun =
    requestedRun && (!activeChannelId || runChannelId(requestedRun) === activeChannelId)
      ? requestedRun
      : visibleRuns[0];
  const artifacts = activeRun ? await getRunArtifacts(activeRun.id) : [];
  const generationState = activeRun ? await getAssetGenerationState(activeRun.id) : null;
  const validation = activeRun ? validateProductionPackage(activeRun.package) : null;
  const approvals = activeRun ? await getRunApprovals(activeRun.id) : null;
  const workerStatus = activeRun ? await getRunWorkerStatus(activeRun.id, activeRun.package) : null;
  const storageMode = getAppStorageMode();
  const nextActionPlan =
    activeRun && validation && approvals && generationState && workerStatus
      ? getRunNextActionPlan({
          approvals,
          generationState,
          pkg: activeRun.package,
          storageMode,
          validation,
          workerStatus,
        })
      : null;
  const selectedChannelId = activeChannelId || runChannelId(activeRun);
  const currentStep = defaultGuidedStep(nextActionPlan);
  const activeStep = currentStep;

  return (
    <div className="shell">
      <Sidebar
        activeRun={activeRun}
        activeChannelId={activeChannelId}
        allRuns={runs}
        channels={channels}
        memoryIndex={memoryIndex}
        runs={visibleRuns}
        totalRuns={runs.length}
        workQueueSummary={workQueueSummary}
      />
      {activeRun ? (
        <main className="main" id="main-content">
          <DashboardNotice notice={params.notice} />
          <OperatingChannelBar
            activeStep={activeStep}
            allRuns={runs}
            channels={channels}
            selectedChannelId={selectedChannelId}
          />
          <div className="topbar">
            <div>
              <p className="eyebrow">제작 작업공간</p>
              <h2>{activeRun.package.brief.topic}</h2>
              <p className="muted">
                {runChannelLabel(activeRun)} /{" "}
                {formatCopy[activeRun.package.brief.format] ?? activeRun.package.brief.format} /{" "}
                {languageCopy[activeRun.package.brief.language] ?? activeRun.package.brief.language} /{" "}
                {activeRun.package.brief.target_audience || "대상 시청자 미정"}
              </p>
            </div>
            <div className="toolbar">
              <Link
                className="icon-button"
                href={dashboardHref({
                  channelId: selectedChannelId,
                  runId: activeRun.id,
                  step: activeStep,
                })}
                title="실행 데이터 새로고침"
              >
                <RefreshCw size={16} />
              </Link>
              <Link className="icon-button" href="/settings" title="API 설정">
                <Settings size={16} />
              </Link>
              <AdvancedActionMenu
                activeStep={activeStep}
                providerSettings={providerSettings}
                run={activeRun}
              />
            </div>
          </div>

          {nextActionPlan ? (
            <GuidedRunWorkspace
              activeStep={activeStep}
              artifacts={artifacts}
              channelId={selectedChannelId}
              nextActionPlan={nextActionPlan}
              providerSettings={providerSettings}
              run={activeRun}
            />
          ) : null}
        </main>
      ) : (
        <EmptyState
          allRuns={runs}
          channelName={activeChannel?.channel_name}
          channels={channels}
          notice={params.notice}
          selectedChannelId={selectedChannelId}
        />
      )}
      {activeRun ? (
        <Inspector
          approvals={approvals!}
          generationState={generationState!}
          nextActionPlan={nextActionPlan!}
          providerSettings={providerSettings}
          run={activeRun}
          storageMode={storageMode}
          validation={validation!}
          workerStatus={workerStatus!}
        />
      ) : (
        <aside className="inspector">
          <section className="panel">
            <div className="panel-header">
              <h3 className="panel-title">시작 순서</h3>
              <ListChecks size={16} />
            </div>
            <div className="panel-body">
              <div className="detail-stack">
                <div className="detail-row">
                  <span>1</span>
                  <span>상단에서 운영 채널 확인</span>
                </div>
                <div className="detail-row">
                  <span>2</span>
                  <span>가운데 새 제작 시작 작성</span>
                </div>
                <div className="detail-row">
                  <span>3</span>
                  <span>생성 후 다음 작업 버튼 진행</span>
                </div>
              </div>
            </div>
          </section>
        </aside>
      )}
    </div>
  );
}
