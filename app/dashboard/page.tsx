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
import { ScriptRefineButton } from "@/app/components/script-refine-button";
import { SourceTranscriptPanel } from "@/app/components/source-transcript-panel";
import { StoryboardDraftButton } from "@/app/components/storyboard-draft-button";
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
import { decodeHtmlEntities } from "@/lib/html-text";
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
  review: "검토",
  blocked: "차단",
  pending: "대기",
};

const qaStatusCopy: Record<string, string> = {
  pass: "검수 통과",
  blocked: "검수 차단",
  needs_review: "검토 필요",
};

const transcriptStatusCopy: Record<string, string> = {
  not_checked: "미확인",
  missing: "없음",
  manual_transcript: "수동 입력",
  available: "확보됨",
};

const feedbackStatusCopy: Record<string, string> = {
  learning: "학습 중",
  needs_more_data: "데이터 필요",
  strong_signal: "강한 신호",
  watch: "주의 관찰",
};

const approvalGateLabels: Record<ApprovalGate, string> = {
  generation: "생성 승인",
  render: "렌더 승인",
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
    description: "검수, 편집, 렌더, 업로드를 진행합니다.",
    key: "review",
    label: "검수/업로드",
  },
] as const;

type GuidedStepKey = (typeof guidedStepDefinitions)[number]["key"];

function guidedStepIndex(stepKey: GuidedStepKey) {
  return guidedStepDefinitions.findIndex((step) => step.key === stepKey);
}

const guidedArtifactFocus: Record<Exclude<GuidedStepKey, "setup" | "research">, string[]> = {
  draft: ["video-analysis", "claim-ledger", "script-plan", "storyboard"],
  production: ["storyboard", "media-prompts"],
  review: ["publishing", "qa"],
};

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
    output: "결과는 대본 만들기 단계의 영상 분석, 클레임 장부에서 확인합니다.",
    title: "분석 초안",
  },
  "analysis-refine": {
    goal: "등록한 LLM으로 분석 품질을 높이고 빈 주장 후보를 보강합니다.",
    output: "영상 분석과 클레임 장부가 갱신됩니다.",
    title: "분석 고도화",
  },
  "asset-manifest": {
    goal: "장면별 이미지, 영상, 음성, 자막, 썸네일 자산 목록을 잠급니다.",
    output: "미디어 만들기 단계의 자산 매니페스트와 생성 큐가 열립니다.",
    title: "자산 목록 만들기",
  },
  "channel-memory": {
    goal: "성과와 운영 메모를 다음 기획에 쓸 채널 기억으로 저장합니다.",
    output: "좌측 채널 메모리와 피드백 산출물에 반영됩니다.",
    title: "채널 메모리",
  },
  "draft-flow": {
    goal: "분석, 클레임, 대본 자리표시자를 한 번에 준비합니다.",
    output: "대본 만들기 단계의 산출물 탭이 채워집니다.",
    title: "초안 흐름 만들기",
  },
  "feedback-flow": {
    goal: "업로드 뒤 성과 수집과 다음 기획 반영 루프를 만듭니다.",
    output: "피드백 루프 산출물이 저장됩니다.",
    title: "피드백 루프",
  },
  "feedback-insights": {
    goal: "성과 신호를 다음 제목, 훅, 포맷 의사결정으로 요약합니다.",
    output: "피드백 인사이트 산출물이 저장됩니다.",
    title: "성과 인사이트",
  },
  "generation-queue": {
    goal: "승인과 provider 설정을 기준으로 생성 가능한 항목을 나눕니다.",
    output: "직접 생성, 수동 전달, 차단 항목이 생성 콘솔에 표시됩니다.",
    title: "생성 큐 준비",
  },
  "learning-log": {
    goal: "A/B 결과와 운영 판단을 다음 run에 재사용할 로그로 남깁니다.",
    output: "학습 로그 산출물이 저장됩니다.",
    title: "학습 로그",
  },
  "local-render": {
    goal: "로컬 ffmpeg 렌더로 MVP 영상을 조립합니다.",
    output: "렌더 결과와 로그가 run 산출물에 남습니다.",
    title: "로컬 렌더",
  },
  "media-draft": {
    goal: "스토리보드를 이미지와 영상 생성 프롬프트로 바꿉니다.",
    output: "미디어 만들기 단계의 프롬프트 탭에 저장됩니다.",
    title: "미디어 프롬프트",
  },
  "open-settings": {
    goal: "LLM, 이미지, 영상, TTS, 편집 provider 키와 모델을 점검합니다.",
    output: "제공자가 준비되면 생성 버튼과 워커 큐가 열립니다.",
    title: "API 설정 확인",
  },
  "performance-snapshot": {
    goal: "업로드된 영상의 성과 스냅샷을 수집할 준비를 합니다.",
    output: "성과 스냅샷 산출물이 저장됩니다.",
    title: "성과 스냅샷",
  },
  "publishing-draft": {
    goal: "제목 후보, 설명, 태그, 썸네일 문구를 먼저 만듭니다.",
    output: "검수/업로드 단계의 배포 패키지에서 확인합니다.",
    title: "배포 초안",
  },
  "publishing-handoff": {
    goal: "최종 파일과 업로드 메타데이터를 업로드 가능한 패킷으로 묶습니다.",
    output: "YouTube 업로드 작업 생성 전 체크리스트가 만들어집니다.",
    title: "배포 핸드오프",
  },
  "qa-draft": {
    goal: "구조, 근거, 승인, 업로드 위험을 한 번 더 검사합니다.",
    output: "검수 산출물과 오른쪽 차단 항목이 갱신됩니다.",
    title: "제작 검수",
  },
  "render-job": {
    goal: "외부 렌더 워커가 처리할 작업을 큐에 등록합니다.",
    output: "워커 큐와 렌더 상태 패널에 작업이 표시됩니다.",
    title: "렌더 작업 큐",
  },
  "render-manifest": {
    goal: "자산을 타임라인으로 묶고 렌더 차단 항목을 확인합니다.",
    output: "렌더 매니페스트와 검수 상태가 갱신됩니다.",
    title: "렌더 계획",
  },
  "script-draft": {
    goal: "분석과 클레임 장부를 바탕으로 대본 구조를 만듭니다.",
    output: "대본 만들기 단계의 대본 탭에 저장됩니다.",
    title: "대본 초안",
  },
  "script-refine": {
    goal: "등록한 LLM으로 훅, 전개, 내레이션을 고도화합니다.",
    output: "대본 탭이 새 버전으로 갱신됩니다.",
    title: "대본 고도화",
  },
  "source-enrich": {
    caution: "자막은 자동 확보가 되지 않을 수 있어 아래 스크립트 슬롯에 직접 붙여넣어야 합니다.",
    goal: "YouTube 후보 영상의 제목, 채널, 썸네일 같은 기본 정보를 다시 확인합니다.",
    output: "소스 영상 표와 01-research.md가 갱신됩니다.",
    title: "소스 정보 보강",
  },
  "storyboard-draft": {
    goal: "대본을 장면, 내레이션, 화면 문구, 자산 요구사항으로 나눕니다.",
    output: "스토리보드 산출물이 저장되고 미디어 만들기 단계가 준비됩니다.",
    title: "스토리보드",
  },
  "subtitle-draft": {
    goal: "내레이션 초안을 자막 초안으로 바꿉니다.",
    output: "자막 산출물이 저장됩니다.",
    title: "자막 초안",
  },
  "youtube-upload-job": {
    goal: "승인된 배포 패키지를 YouTube 업로드 워커 큐에 등록합니다.",
    output: "업로드 워커 패널에서 큐 상태를 확인합니다.",
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
      actionIds: ["draft-flow", "analysis-draft", "analysis-refine", "script-draft", "script-refine"],
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
      label: "검수/렌더",
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
  { href: "#artifact-claim-ledger", label: "클레임 탭" },
  { href: "#artifact-script-plan", label: "대본 탭" },
  { href: "#artifact-storyboard", label: "씬 탭" },
  { href: "#artifact-media-prompts", label: "프롬프트 탭" },
  { href: "#artifact-publishing", label: "배포 탭" },
  { href: "#artifact-qa", label: "검수 탭" },
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
    plan.stageLabel === "자산 구성" ||
    plan.stageLabel === "자산 생성" ||
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
    plan.primaryActionId === "script-draft" ||
    plan.primaryActionId === "script-refine" ||
    plan.primaryActionId === "storyboard-draft" ||
    plan.stageLabel === "영상 분석" ||
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
    plan.stageLabel === "자산 구성" ||
    plan.stageLabel === "자산 생성" ||
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

function resolveGuidedStep(value: string | undefined, currentStep: GuidedStepKey): GuidedStepKey {
  const requested = guidedStepDefinitions.find((step) => step.key === value)?.key;
  if (!requested) {
    return currentStep;
  }
  return guidedStepIndex(requested) <= guidedStepIndex(currentStep) ? requested : currentStep;
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
  if (plan.headline.includes("렌더 승인")) {
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
      detail: "패키지 구조가 통과해야 다음 자동화가 안전하게 이어집니다.",
      label: "구조 보정 필요",
      tone: "blocked",
    };
  }
  if (run.package.qa.blockers.length > 0 || plan.status === "blocked") {
    return {
      detail: "차단 항목을 줄인 뒤 다시 검수하거나 다음 단계로 이동하세요.",
      label: "차단됨",
      tone: "blocked",
    };
  }
  if (plan.status === "review") {
    return {
      detail: "외부 비용, 렌더, 업로드 전에 사람 확인이 필요한 상태입니다.",
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
    detail: "현재 단계의 기본 작업을 실행하면 다음 제작 단계로 넘어갑니다.",
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
      <h2>작업 큐</h2>
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
        <p className="eyebrow">작업 기준</p>
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
  channelId,
  currentStep,
  runId,
}: {
  activeStep: GuidedStepKey;
  channelId: string;
  currentStep: GuidedStepKey;
  runId: string;
}) {
  const activeIndex = guidedStepIndex(activeStep);
  const currentIndex = guidedStepIndex(currentStep);
  return (
    <nav className="guided-step-nav" aria-label="제작 단계">
      {guidedStepDefinitions.map((step, index) => {
        const state =
          index === activeIndex
            ? "current"
            : index < currentIndex
              ? "done"
              : index === currentIndex
                ? "available"
                : "pending";
        const stepBody = (
          <>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
            {state === "current" ? <em>지금</em> : null}
            {state === "available" ? <em>다음</em> : null}
            {state === "pending" ? <em>잠김</em> : null}
            <small>{step.description}</small>
          </>
        );
        return state === "pending" ? (
          <span
            aria-disabled="true"
            className={`guided-step ${state}`}
            key={step.key}
          >
            {stepBody}
          </span>
        ) : (
          <Link
            aria-current={state === "current" ? "step" : undefined}
            className={`guided-step ${state}`}
            href={dashboardHref({ channelId, runId, step: step.key })}
            key={step.key}
          >
            {stepBody}
          </Link>
        );
      })}
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
  return (
    <section className="panel guided-action-panel" id="next-action">
      <div className="guided-action-main">
        <div>
          <p className="eyebrow">지금 누를 버튼</p>
          <h3>{plan.headline}</h3>
          <p>{plan.detail}</p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="guided-action-buttons">
        <div className={`guided-primary-cta ${plan.primaryActionId ? "" : "manual"}`}>
          <div className="guided-primary-copy">
            <span>지금 할 일</span>
            <strong>{plan.headline}</strong>
            <small>
              {plan.primaryActionId
                ? "이 화면에서는 이 큰 버튼 하나만 먼저 보면 됩니다."
                : "승인 또는 확인이 끝나야 다음 버튼이 열립니다."}
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
          <p className="next-action-note">승인 게이트 확인 필요</p>
        )}
      </div>
      </div>
      {visibleActions.length > 0 ? (
        <div className="guided-tool-map" aria-label="현재 단계 기능 안내">
          <div className="guided-tool-map-header">
            <div>
              <p className="eyebrow">단계 안의 기능</p>
              <strong>버튼을 누르면 무엇이 바뀌는지 먼저 보여줍니다.</strong>
            </div>
            <span>{visibleActions.length}개 기능</span>
          </div>
          <div className="guided-tool-grid">
            {visibleActions.map((actionId, index) => {
              const guide = actionGuides[actionId] ?? {
                goal: "현재 제작 패키지의 다음 산출물을 준비합니다.",
                output: "완료 후 해당 단계의 산출물 패널에서 확인합니다.",
                title: plan.headline,
              };
              const isPrimary = actionId === plan.primaryActionId;
              return (
                <article
                  className={`guided-tool-card ${isPrimary ? "primary" : ""}`}
                  key={actionId}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{guide.title}</strong>
                    <p>{guide.goal}</p>
                    <small>{guide.output}</small>
                    {guide.caution ? <small className="warning">{guide.caution}</small> : null}
                  </div>
                  {isPrimary ? (
                    <em>위의 큰 버튼</em>
                  ) : (
                    <WorkflowActionButton
                      actionId={actionId}
                      providerSettings={providerSettings}
                      run={run}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
      <details className="guided-checklist">
        <summary>왜 이 버튼을 눌러야 하나요?</summary>
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
      <p className="guided-location-note">
        편집 provider, 이미지/영상/TTS 생성 메뉴는 해당 단계가 열릴 때만 표시됩니다. 지금 단계에서는 숨겨두고 현재 버튼만 보여줍니다.
      </p>
    </section>
  );
}

function GuidedRunWorkspace({
  activeStep,
  artifacts,
  channelId,
  currentStep,
  nextActionPlan,
  providerSettings,
  run,
}: {
  activeStep: GuidedStepKey;
  artifacts: Awaited<ReturnType<typeof getRunArtifacts>>;
  channelId: string;
  currentStep: GuidedStepKey;
  nextActionPlan: RunNextActionPlan;
  providerSettings: SafeProviderSettings;
  run: RunSummary;
}) {
  const activeStepCopy = guidedStepDefinitions.find((step) => step.key === activeStep) ?? guidedStepDefinitions[0];
  const activeStepIndex = guidedStepDefinitions.findIndex((step) => step.key === activeStep) + 1;
  const isCurrentStep = activeStep === currentStep;
  return (
    <div className="guided-workspace">
      <GuidedStepNav
        activeStep={activeStep}
        channelId={channelId}
        currentStep={currentStep}
        runId={run.id}
      />
      <section className="guided-step-intro">
        <div>
          <p className="eyebrow">{isCurrentStep ? "처음이면 여기부터" : "이전 단계 다시 보기"}</p>
          <h3>{activeStepIndex}단계: {activeStepCopy.label}</h3>
          <p>
            {isCurrentStep
              ? "아래의 큰 버튼이 이 제작 실행에서 지금 눌러야 할 작업입니다. 다른 메뉴는 이 단계가 끝난 뒤 필요할 때만 열립니다."
              : "이전 단계의 입력값과 산출물을 확인하는 화면입니다. 수정이 필요하면 이곳에서 확인하고, 진행은 현재 단계로 돌아가면 됩니다."}
          </p>
        </div>
        {isCurrentStep ? (
          <a className="text-button primary" href="#next-action">지금 할 일 보기</a>
        ) : (
          <Link
            className="text-button primary"
            href={dashboardHref({ channelId, runId: run.id, step: currentStep })}
          >
            현재 단계로 돌아가기
          </Link>
        )}
      </section>
      {isCurrentStep ? (
        <GuidedActionPanel plan={nextActionPlan} providerSettings={providerSettings} run={run} />
      ) : (
        <section className="panel guided-step-review">
          <div>
            <p className="eyebrow">진행 상태</p>
            <h3>현재 해야 할 일은 {nextActionPlan.headline}입니다.</h3>
            <p>{nextActionPlan.detail}</p>
          </div>
          <Link
            className="text-button primary"
            href={dashboardHref({ channelId, runId: run.id, step: currentStep })}
          >
            현재 단계 열기
          </Link>
        </section>
      )}

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
            description="분석, 클레임, 대본, 스토리보드만 먼저 보여줍니다. 전체 산출물은 필요할 때 펼치면 됩니다."
            focusArtifactIds={guidedArtifactFocus.draft}
            runId={run.id}
            title="대본과 스토리보드"
          />
          <details className="guided-secondary-panel">
            <summary>소스와 제작 단계 같이 보기</summary>
            <div className="workspace-grid">
              <PipelinePanel nextActionPlan={nextActionPlan} run={run} />
              <SourcesPanel run={run} />
            </div>
          </details>
        </>
      ) : null}

      {activeStep === "production" ? (
        <>
          <ArtifactWorkspace
            artifacts={artifacts}
            description="스토리보드와 미디어 프롬프트를 중심으로 생성 준비를 정리합니다."
            focusArtifactIds={guidedArtifactFocus.production}
            runId={run.id}
            title="제작 산출물"
          />
          <details className="guided-secondary-panel">
            <summary>제작 준비 상태 보기</summary>
            <PipelinePanel nextActionPlan={nextActionPlan} run={run} />
          </details>
        </>
      ) : null}

      {activeStep === "review" ? (
        <>
          <ArtifactWorkspace
            artifacts={artifacts}
            description="검수와 배포 패키지를 먼저 확인합니다. 근거와 제작 단계 세부는 아래에서 펼칠 수 있습니다."
            focusArtifactIds={guidedArtifactFocus.review}
            runId={run.id}
            title="검수와 배포"
          />
          <details className="guided-secondary-panel">
            <summary>검토 맥락 보기</summary>
            <div className="workspace-grid">
              <PipelinePanel nextActionPlan={nextActionPlan} run={run} />
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
          <span>작업 큐</span>
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
              ? "아래 새 제작 시작에서 이 운영 채널의 첫 패키지를 시작하세요."
              : "새 제작을 시작하면 패키지가 단계 흐름에 맞춰 여기에 표시됩니다."}
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
    detail: "영상 분석과 클레임 장부가 갱신됐습니다. 다음 단계가 열렸는지 확인하세요.",
    title: "분석 초안을 만들었습니다.",
    tone: "success",
  },
  "sources-checked": {
    detail: "소스 메타데이터를 확인했습니다. 자막/스크립트가 비어 있으면 아래 스크립트 슬롯에 붙여넣어야 합니다.",
    title: "소스 정보를 확인했습니다.",
    tone: "success",
  },
  "sources-enriched": {
    detail: "제목, 채널, 썸네일 등 소스 정보가 갱신됐습니다. 자막은 소스 영상 패널에서 별도로 확인하세요.",
    title: "소스 정보를 보강했습니다.",
    tone: "success",
  },
  "sources-imported": {
    detail: "검색 후보가 소스 영상 목록에 추가됐습니다. 다음으로 제목/채널 보강과 스크립트 슬롯을 확인하세요.",
    title: "후보 영상을 소스로 추가했습니다.",
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
        <p className="stat-label">클레임</p>
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
          제공자 설정
        </Link>
      );
  }
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
        {showEnrichAction ? (
          <EnrichSourcesButton runId={run.id} />
        ) : (
          <span className="meta">상단 큰 버튼에서 보강</span>
        )}
      </div>
      <div className="panel-body">
        {run.package.sources.length > 0 ? (
          <>
            <table className="source-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>소스</th>
                  <th>자막/스크립트</th>
                </tr>
              </thead>
              <tbody>
                {run.package.sources.map((source, index) => (
                  <tr key={`${source.url}-${index}`}>
                    <td>{source.rank ?? index + 1}</td>
                    <td>
                      <div className="source-title">{decodeHtmlEntities(source.title)}</div>
                      <a className="source-url" href={source.url}>
                        {source.url}
                      </a>
                    </td>
                    <td>
                      {transcriptStatusCopy[source.transcript_status ?? "not_checked"] ??
                        source.transcript_status ??
                        "미확인"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">제공자 준비 상태</h3>
        <KeyRound size={16} />
      </div>
      <div className="panel-body">
        <div className="detail-stack">
          <div className="detail-row">
            <span>준비됨</span>
            <span>
              {readyProviderCount}/{totalProviderSlots}
            </span>
          </div>
          {providerRoles.map((role) => {
            const setting = preferredSetting(role.id);
            const status =
              setting.enabled && setting.hasApiKey
                ? "준비됨"
                : setting.enabled
                  ? "키 필요"
                  : "꺼짐";
            return (
              <div className="detail-row" key={role.id}>
                <span>{role.label}</span>
                <span>{status}</span>
              </div>
            );
          })}
          <Link className="text-button form-submit" href="/settings">
            <Settings size={15} />
            제공자 설정
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
        <h3 className="panel-title">검수 차단 항목</h3>
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
    <section className="panel">
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
            <span>렌더</span>
            <span>{run.package.render_manifest?.render_ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>편집/렌더 provider</span>
            <span>
              {editingProvider.provider}
              {editingProvider.model ? ` / ${editingProvider.model}` : ""}
            </span>
          </div>
          <div className="detail-row">
            <span>편집 핸드오프</span>
            <span>{run.package.render_manifest?.editing_handoff_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>최종 파일</span>
            <span>{run.package.render_manifest?.rendered_path ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>렌더 작업</span>
            <span>{run.package.render_manifest?.worker_job_status ?? "대기"}</span>
          </div>
          <div className="detail-row">
            <span>자산 매니페스트</span>
            <span>{run.package.asset_manifest ? `${run.package.asset_manifest.items}개` : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>생성 대기열</span>
            <span>{run.package.asset_manifest?.ready_for_generation ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>대기열 차단</span>
            <span>{run.package.asset_manifest?.blocked ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>렌더 차단</span>
            <span>{run.package.render_manifest?.blockers ?? 0}</span>
          </div>
          <div className="detail-row">
            <span>배포 핸드오프</span>
            <span>{run.package.publishing_handoff?.ready ? "준비됨" : "대기"}</span>
          </div>
          <div className="detail-row">
            <span>업로드 작업</span>
            <span>{run.package.publishing_handoff?.upload_job_status ?? "대기"}</span>
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
    (source) => source.transcript_status !== "manual_transcript" && source.transcript_status !== "available",
  ).length;
  const secondaryActionCount = plan.secondaryActionIds?.length ?? 0;
  const decision = inspectorDecision({ plan, run, validation });
  const gate = activeApprovalGate(plan);
  const openApprovalCount = (Object.keys(approvals) as ApprovalGate[]).filter(
    (approvalGate) => !approvalReady(approvals[approvalGate]),
  ).length;
  const visibleItems = plan.items.slice(0, 2);
  const hiddenItemCount = Math.max(0, plan.items.length - visibleItems.length);
  return (
    <section className={`panel focus-inspector-panel ${decision.tone}`}>
      <div className="panel-header">
        <div>
          <h3 className="panel-title">현재 단계</h3>
          <p className="panel-subtitle">
            {plan.stageIndex}/{plan.totalStages} {plan.stageLabel}
          </p>
        </div>
        <StatusPill status={plan.status} />
      </div>
      <div className="panel-body">
        <div className="inspector-decision">
          <span>진행 판단</span>
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
            <p>{openApprovalCount}개 게이트가 아직 열려 있습니다.</p>
          </div>
        ) : null}
        <div className="stage-focus-actions read-only">
          {plan.primaryActionId ? (
            <div className="stage-focus-guidance">
              <strong>실행은 중앙 단계 카드에서 진행하세요.</strong>
              <p>오른쪽 패널은 현재 판단, 승인 상태, 필요한 확인만 보여줍니다.</p>
              {secondaryActionCount > 0 ? <span>보조 도구 {secondaryActionCount}개는 중앙 카드에 있습니다.</span> : null}
            </div>
          ) : (
            <p className="stage-focus-note">승인, 수동 등록, 또는 워커 실행처럼 버튼 밖의 확인이 필요한 단계입니다.</p>
          )}
        </div>
        <div className="stage-focus-inputs">
          <div className="stage-focus-inputs-header">
            <p>필요한 확인</p>
            <span>{plan.items.length}개</span>
          </div>
          {visibleItems.map((item) => (
            <div className="stage-focus-input" key={`${item.title}-${item.detail}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                {item.command ? <code>{item.command}</code> : null}
              </div>
              <StatusPill status={item.status} />
            </div>
          ))}
          {hiddenItemCount > 0 ? (
            <span className="stage-focus-hidden-count">추가 확인 {hiddenItemCount}개는 중앙 다음 작업 카드에서 확인하세요.</span>
          ) : null}
        </div>
        <div className="stage-focus-checks">
          <div>
            <span>소스</span>
            <strong>{sourceCount}</strong>
          </div>
          <div>
            <span>미확인 스크립트</span>
            <strong>{missingTranscripts}</strong>
          </div>
          <div>
            <span>클레임</span>
            <strong>{run.package.claim_ledger.length}</strong>
          </div>
          <div>
            <span>씬</span>
            <strong>{run.package.storyboard.length}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function Inspector({
  run,
  activeChannelId,
  validation,
  providerSettings,
  approvals,
  generationState,
  nextActionPlan,
  storageMode,
  workerStatus,
  channels,
}: {
  run: RunSummary;
  activeChannelId: string;
  validation: PackageValidationResult;
  providerSettings: SafeProviderSettings;
  approvals: RunApprovals;
  generationState: AssetGenerationState;
  nextActionPlan: RunNextActionPlan;
  storageMode: string;
  workerStatus: RunWorkerStatus;
  channels: SafeYouTubeChannel[];
}) {
  const stage = nextActionPlan.stageLabel;
  const showApprovals = nextActionPlan.headline.includes("승인");
  const showGeneration =
    stage === "생성 승인" || stage === "자산 구성" || stage === "자산 생성";
  const showAssembly = stage === "렌더" || stage === "배포";
  const showFeedback = stage === "피드백";
  const showProviderReadiness = showGeneration || nextActionPlan.primaryActionId === "open-settings";
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

        {showProviderReadiness ? <ProviderReadinessPanel providerSettings={providerSettings} /> : null}

        {showGeneration ? (
          <GenerationConsolePanel
            generationState={generationState}
            providerSettings={providerSettings}
            run={run}
          />
        ) : null}

        {showAssembly ? (
          <AssemblyPanel
            providerSettings={providerSettings}
            run={run}
            storageMode={storageMode}
            workerStatus={workerStatus}
          />
        ) : null}

        {showFeedback ? <FeedbackPanel run={run} /> : null}

        <details className="inspector-more new-run-drawer">
          <summary>새 제작 시작</summary>
          <div className="detail-stack">
            <NewRunPanel channels={channels} initialChannelId={activeChannelId || runChannelId(run)} />
          </div>
        </details>

        <details className="inspector-more">
          <summary>검증 세부</summary>
          <div className="detail-stack">
            {!showValidationImmediate ? <PackageValidationPanel initialResult={validation} runId={run.id} /> : null}
            {!showBlockersImmediate ? <BlockersPanel blockers={run.package.qa.blockers} /> : null}
          </div>
        </details>

        <details className="inspector-more">
          <summary>운영 세부</summary>
          <div className="detail-stack">
            <BriefPanel run={run} />
            {!showApprovals ? (
              <RunApprovalsPanel key={`${run.id}-more`} initialApprovals={approvals} runId={run.id} />
            ) : null}
            {!showProviderReadiness ? <ProviderReadinessPanel providerSettings={providerSettings} /> : null}
            {!showGeneration ? (
              <GenerationConsolePanel
                generationState={generationState}
                providerSettings={providerSettings}
                run={run}
              />
            ) : null}
            {!showAssembly ? (
              <AssemblyPanel
                providerSettings={providerSettings}
                run={run}
                storageMode={storageMode}
                workerStatus={workerStatus}
              />
            ) : null}
            {!showFeedback ? <FeedbackPanel run={run} /> : null}
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
  const activeStep = resolveGuidedStep(params.step, currentStep);

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
              <Link className="icon-button" href="/settings" title="제공자 설정">
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
              currentStep={currentStep}
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
          activeChannelId={activeChannelId}
          approvals={approvals!}
          generationState={generationState!}
          nextActionPlan={nextActionPlan!}
          providerSettings={providerSettings}
          run={activeRun}
          channels={channels}
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
